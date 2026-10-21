# SMS gateway (module `sms`)

Android phones running [iSMS GW](https://github.com/iSmartyPRO/isms-gw-android) connect to the portal and become an SMS
gateway: people send and receive SMS from the browser, integrations use the REST API and webhooks. The plan and the
protocol analysis are in [sms-gateway-plan.md](sms-gateway-plan.md).

| Where | What |
|---|---|
| `/app/sms` | Overview, Inbox, Send, Messages, Templates, API, Phones |
| `/admin/settings/sms` | Module settings (Settings → Modules → SMS gateway) |
| `wss://<portal>/ws/device` | Phones connect here (`Authorization: Bearer smsgw_…`) |
| `/api/app/sms/**`, `/api/v1/app/sms/**` | REST API (session or API token, area `sms`) |

## Code map

```
src/backend/modules/sms/
  index.js      descriptor, scheduler jobs (queue expiry, offline alerts, cleanup), KB seed
  schema.js     sms_devices, sms_device_acl, sms_sims, sms_messages, sms_device_events, sms_templates
  hub.js        WebSocket hub: upgrade + auth, frames from phones, dispatcher, ack timeouts
  protocol.js   pure: frame parsing, commands, status mapping and transitions (nextStatus)
  phone.js      pure: E.164 normalisation (libphonenumber), recipients parsing, SMS segments
  routing.js    pure: choosing phone and SIM (pickRoute, planBatch)
  tokens.js     phone tokens smsgw_<8>_<32>, SHA-256 at rest
  service.js    devices, SIMs, sending, messages, threads, overview, templates, housekeeping
  events.js     webhooks (emitEvent) and notifications (notify)
  routes.js     /api/app/sms router
  apiDocs.js    section and endpoint texts for the developer portal
  kbSeed.js     guides in the knowledge base (kb/en.js, ru.js, tr.js), once per database
src/frontend/src/modules/sms/
  SmsApp.jsx, SmsContext.jsx, SmsSettings.jsx, api.js, sms.css, tour.js
  pages/        Overview, Inbox, Compose, Messages, Devices, DeviceDetail, Templates, ApiPage
  components/   ui.jsx (status, SIM card, KPI, chart…), AddDeviceWizard.jsx
```

## Phone protocol

JSON text frames over one WebSocket per phone (Android `net/RemoteClient.kt`):

| Phone → server | Server → phone |
|---|---|
| `hello {deviceId, deviceName, version, sims[]}` | `send {id, to, text, sim}` — `id` is the message uuid, `sim` the slot |
| `event {event: sms.received/sent/delivered/failed, data: Message}` | `ack_event {messageId}` — after storing an incoming SMS |
| `ack {id, to, messageId, status}` / `error {id, to, error}` | `get_status` (on connect, «Ask the phone») |
| `status {sims[], stats}`, `pong` | `ping` every 30 s (plus WebSocket ping frames) |

- One connection per phone; a new one replaces the old (`4000`). Token change, delete or switch-off close it (`4001`).
- A wrong token answers `401` before the upgrade; 20 wrong tokens per address in 10 minutes → `429` for 10 minutes.
- Incoming SMS are stored once: the phone re-sends unacknowledged ones after reconnecting; the same phone id with another
  text means the app was reinstalled (its ids start over) — the old row lets the id go.
- Messages sent on the phone itself (its app, local API, Telegram) arrive as `sms.sent` without our `ref` and are stored
  with `source = 'phone'`.

## Queue and statuses

`scheduled → queued → dispatched → accepted → sent → delivered`, or `failed` / `cancelled` / `expired`
(`protocol.js → nextStatus`: never backwards, final states stay, except a late report after `NO_ACK`).

- **Dispatcher** (every 2 s and right after sending): per connected phone, at most `ratePerMinute` per rolling minute,
  spread evenly; `UPDATE … FOR UPDATE SKIP LOCKED` claims the rows.
- **Ack timeout** (every 10 s): `dispatched` older than `ackTimeoutSec` goes back to `queued`; after `maxAttempts` →
  `failed` / `NO_ACK`.
- **Expiry** (job `sms.queue`, every minute): `queued`/`scheduled` past `expires_at` → `expired` / `EXPIRED`.
- On start every `dispatched` returns to `queued` and every phone is offline until it reconnects.
- Error codes: `PHONE_REJECTED` (the phone refused: its destination filter, SIM limit…), `PHONE_FAILED` (radio/carrier),
  `NO_ACK`, `EXPIRED`.

Limitations of the phone protocol: delivery reports are sent only while connected and not repeated; SIM is chosen by slot;
USSD and calls are not available over the link.

## Access

`modules/shared/acl.js` on `sms_device_acl`: `view` (phone, SIMs, messages), `edit` (send), `manage` (settings, token,
access, delete). The creator gets `manage` and always keeps it. `sms.admin` = manage on every phone unless an API token
narrows it. API tokens can be limited to phones (`RESOURCE_KINDS` → `sms.devices`). Templates: own + shared; only the
author (or `sms.admin`) changes a shared one.

## API tokens for one phone or SIM

The quick way to give an integration access (`modules/sms/apiTokens.js`, UI `components/PhoneTokens.jsx`):
**phone page → «API»** (or a SIM card → «API token for this SIM») → choose the SIM, expiry and IP addresses → the
token is shown once with a developer guide (base URL, `deviceId`, `simId`, examples in cURL / Python / Node.js / PHP,
a downloadable `.md` without the token).

- It is a regular platform token (`pat_…`) of the person who makes it, so it also appears in their API console.
- Scopes: area `sms` = `read`, plus allow rules for sending (`POST /app/sms/messages`, `…/cancel`, `…/retry`,
  `…/read`, `/tools/**`) and deny rules for the access list, the journal, phone tokens and `/subjects`. It can never
  change the phone, its SIM cards, the connection token or access (`phoneTokenPolicy()`, tested).
- Resource limits: `sms.devices = [phone]` and, with a SIM, `sms.sims = [sim]`. A SIM limit (`simLimit(ctx)` in
  `service.js`) makes the gateway send only through that SIM (without `simId` too), refuse another one
  (`403 SIM_NOT_ALLOWED`) and show only that SIM and its messages (lists, threads, overview, export, mark-read).
- Who: people with `manage` on the phone, while the module setting `phoneTokens` is on (default) and the API is on;
  API tokens themselves cannot make or revoke them. The phone page lists tokens limited to the phone; a manager may
  revoke a token that reaches only this phone, the owner or an administrator any.
- The `sms.sims` limit is also available in the API console for hand-made tokens and webhooks.

## Webhooks and notifications

Events (`api/events.js`, area `sms`): `sms.received`, `sms.sent`, `sms.delivered`, `sms.failed` (also for `expired`),
`device.online`, `device.offline`; payload `data.message` (see `events.js → messageShape`) or `data.device`. A webhook
gets an event only when its run-as person may see the phone.

Notifications (`services/notificationCatalog.js`): `sms.received` (people with a personal or group grant on the phone;
push by default) and `sms.deviceOffline` (managers, after `offlineAlertMinutes`).

## Settings

`modules/catalog.js` → `sms`: `defaultCountry` (KG), `userDevices`, `maxDevicesPerUser`, `ratePerMinute` (20),
`queueTtlHours` (24), `ackTimeoutSec` (60), `maxAttempts` (3), `maxRecipients` (1000), `maxTextLength` (1600),
`retentionDays` (365), `offlineAlertMinutes` (15), `phoneTokens` (true — phone managers make API tokens). `defaultCountry`, `maxRecipients`, `userDevices`, `maxTextLength`
are public (the UI reads them).

## Deployment notes

- nginx in the container proxies `location = /ws/device` with upgrade and 1 h timeouts; a proxy in front must pass
  `Upgrade`/`Connection` too.
- The hub keeps connections in memory: run a single backend instance (several would need a shared hub, e.g. Redis).

## Tests

- `src/backend/test/sms.test.js` — numbers, segments, protocol parsing, status transitions, routing, tokens, settings,
  platform wiring (no database).
- `scripts/sms-e2e.mjs` — end to end against a running backend with a simulated phone: create, connect, send (single,
  batch over two SIMs), delivery reports, rejection, incoming (dedupe, reinstall), conversations, schedule/cancel/retry,
  SIM limit, token rotation, journal, delete. Run from `src/backend`:

  ```bash
  BASE=http://127.0.0.1:3999 JWT_SECRET=… USER_ID=1 node ../../scripts/sms-e2e.mjs
  ```
