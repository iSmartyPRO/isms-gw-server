export default {
  folder: {
    name: "SMS Gateway — Guides",
    description: "Step-by-step guides for iSMS Gateway: connecting Android phones, sending and receiving SMS, the API, webhooks, security and troubleshooting.",
    icon: "book",
    color: "#00A3E0",
  },
  articles: [
    {
      title: "Quick start: from zero to the first SMS in 5 minutes",
      description: "Install the app, connect a phone to {{HOST}} and send your first message from the browser and from the API.",
      content: `This guide takes you from an empty account to a delivered SMS. You need an Android phone (8.0 or newer) with an active SIM card, and an account on **https://{{HOST}}**.

## How it works in one paragraph

The gateway does not talk to carriers directly. Your own Android phone with the **iSMS GW** app does the sending: it keeps a secure WebSocket connection to the server (\`wss://{{HOST}}/ws/device\`), receives "send" commands, sends the SMS through its SIM card and reports back the status. Incoming SMS travel the other way. Because the phone opens the connection itself, it works behind NAT, on Wi-Fi or on mobile data, with no public IP address.

## Step 1. Install iSMS GW

1. On the phone, open **https://github.com/iSmartyPRO/isms-gw-android/releases/latest** and download the APK.
2. Allow installation from this source when Android asks.
3. Open the app and, on the welcome screen, **set iSMS GW as the default SMS app**. Android only lets the default SMS app send and read SMS reliably, so this step is mandatory.
4. Grant the permissions it asks for (SMS, phone, notifications).

## Step 2. Add the phone in the portal

1. Sign in at https://{{HOST}} and open **Phones → Add phone**.
2. Give it a clear name, for example \`Office Samsung A15\`, and finish the wizard.
3. The wizard shows the **connection address** and a personal **token** that starts with \`smsgw_\`, plus a QR code that contains both (URL on the first line, token on the second).

> **Important:** the token is shown only once. If you lose it, open the phone page and press **New token** — the old one stops working.

## Step 3. Connect the app

In iSMS GW open **Settings → SMS server**:

| Field | Value |
|---|---|
| URL | \`wss://{{HOST}}/ws/device\` |
| Token | \`smsgw_…\` from the wizard (or scan the QR code) |
| Enabled | on |

Within a few seconds the wizard in the browser switches to **Connected** and lists the phone's SIM cards. If nothing happens, check that the phone has internet access and that the token was copied completely.

## Step 4. Send a test SMS from the browser

1. Open **Send**.
2. Enter your own mobile number. A local number like \`0555 123 456\` is fine — it is completed with the default country (Kyrgyzstan, \`+996\`) unless you type a \`+\` prefix.
3. Type a short text, leave the SIM on **Auto** and press **Send**.
4. Open **Messages**: the status moves through \`queued → dispatched → accepted → sent → delivered\` in a few seconds.

## Step 5. Send the same SMS from code

Create a token in **Account → API tokens** with the \`sms\` area set to **write**, then:

\`\`\`bash
curl -X POST https://{{HOST}}/api/v1/app/sms/messages \\
  -H "Authorization: Bearer pat_XXXXXXXX_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "+996555123456", "text": "Hello from the API", "ref": "test-1"}'
\`\`\`

The answer comes back at once with the message in status \`queued\`; the phone sends it within seconds.

## What next

- Prepare the phone for round-the-clock work — battery optimisation kills more gateways than anything else (see *Preparing the Android phone for 24/7 work*).
- Set daily limits on your SIM cards before the first bulk send.
- Connect a webhook so your system learns about deliveries and replies instantly.

> **Tip:** use a dedicated phone and a SIM with an SMS package for the gateway. A personal phone that you carry around, reboot and let the battery drain on is the most common reason for "the gateway stopped working".
`,
    },
    {
      title: "Preparing the Android phone for 24/7 work",
      description: "Default SMS app, permissions, battery optimisation and vendor-specific settings that keep iSMS GW alive day and night.",
      content: `A gateway phone is a small server. Android, however, is designed to save battery on phones that sit in a pocket, and it will happily freeze an app that runs in the background for hours. This checklist makes sure iSMS GW keeps its connection open around the clock.

## The basics (every phone)

1. **Android 8.0 or newer.** Older versions are not supported.
2. **Default SMS app.** *Settings → Apps → Default apps → SMS app → iSMS GW.* Without it the app cannot send reliably or see incoming SMS.
3. **Permissions.** SMS, Phone, Notifications — all allowed. Do not let Android "remove permissions for unused apps": *App info → Permissions → turn off "Pause app activity if unused"*.
4. **Battery optimisation off.** *Settings → Apps → iSMS GW → Battery → Unrestricted* (on some phones: *Battery optimisation → All apps → iSMS GW → Don't optimise*).
5. **Keep the notification.** The app runs as a foreground service with a permanent notification. Do not hide or swipe it away: on many firmwares this downgrades the service.
6. **Background data.** Allow background data and unrestricted mobile data use for the app, and turn off Data Saver.

## Samsung (One UI)

Samsung has its own sleeping list on top of Android's optimisation:

- *Settings → Battery → Background usage limits*: turn off **Put unused apps to sleep**, and make sure iSMS GW is **not** in *Sleeping apps* or *Deep sleeping apps*. Add it to **Never sleeping apps**.
- *Settings → Apps → iSMS GW → Battery → Unrestricted*.
- Turn off **Adaptive battery** and **Auto optimise daily** (*Device care → Automation*), which reboots the phone at night.

## Xiaomi, Redmi, POCO (MIUI / HyperOS)

- *Settings → Apps → Manage apps → iSMS GW → Autostart*: **on**.
- *Battery saver*: **No restrictions** for iSMS GW.
- *Other permissions*: allow **Send SMS**, **Service SMS** and **Show on lock screen**. MIUI has a separate permission for sending SMS that is denied by default.
- In the recent apps screen, pull iSMS GW down and **lock** it so "Clear all" does not kill it.
- Turn off *MIUI optimisation* in developer options if messages stop after a few hours.

## Huawei and Honor (EMUI / MagicOS)

- *Settings → Battery → App launch → iSMS GW*: switch off **Manage automatically**, then enable **Auto-launch**, **Secondary launch** and **Run in background**.
- Turn off *Power saving mode* and *Ultra power saving*.
- Lock the app in recent apps.

## Other vendors

Oppo, Realme, Vivo, OnePlus and others have similar settings called "auto-start", "background activity" or "app freezing". The rule is the same everywhere: allow auto-start, allow background activity, no battery restrictions. The site *dontkillmyapp.com* lists the exact steps for most models.

## Power and network

- **Keep it charging.** A gateway phone lives on the charger. Use a quality adapter and, if the phone supports it, a battery protection mode that stops charging at 80–85% to avoid swelling.
- **Stable network.** Wi-Fi is preferred; keep mobile data on as a fallback so the phone reconnects if the router reboots. Turn off "Switch to mobile data" tricks that drop Wi-Fi aggressively only if they cause disconnects.
- **No VPN apps or "cleaners".** Battery boosters and antivirus cleaners close background apps.
- **Updates.** Turn off automatic system updates at night, or plan them: an update reboots the phone, and the app must start again.

## The SIM card

- Use a SIM with an **SMS package** suitable for your volume; per-message pricing on a default tariff gets expensive quickly.
- Disable the PIN on the SIM, otherwise after a reboot the phone waits for the PIN and sends nothing.
- Check that the number is not blocked for mass sending by the carrier's terms.

## A spare phone

For anything important (OTP codes, alerts), connect **two phones**. Automatic routing uses any online phone, so if one goes offline, the other keeps sending. Keep a second SIM in a different carrier's network for even better resilience.

## How to check the result

1. Lock the phone and leave it for an hour.
2. Open **Phones** in the portal: the phone should stay **online** all that time, and the journal should not show repeated *disconnected / connected* entries.
3. Send a test SMS while the screen is off.

> **Tip:** the portal notifies the phone owner when a phone has been offline for 15 minutes. If you get such notices at night, it is almost always a battery or "sleeping apps" setting.
`,
    },
    {
      title: "Connecting a phone to the server",
      description: "The add-phone wizard, the connection address and token, QR code, what happens on connect, the journal and replacing a token.",
      content: `Each phone connects to the server with its own token. This article explains the wizard, what happens behind the scenes, and how to manage tokens and several phones.

## The add-phone wizard

Open **Phones → Add phone**:

1. **Name and colour.** Pick something that tells you where the phone is: \`Bishkek office · Samsung\`, \`Warehouse · Redmi\`. The colour helps to spot the phone in lists and charts.
2. **Sending rate (optional).** By default a phone sends up to **20 messages per minute**. You can set your own value from 1 to 120.
3. **Connection details.** The wizard shows:
   - the address \`wss://{{HOST}}/ws/device\`;
   - a token \`smsgw_…\` that belongs to this phone only;
   - a **QR code** with the URL on the first line and the token on the second.
4. **Waiting for the phone.** The page waits live; as soon as the phone connects, it turns green and shows the SIM cards.

## Settings in the app

In iSMS GW go to **Settings → SMS server**, scan the QR code or paste the URL and the token, and switch the connection **on**. The app status changes to *Connected*.

> **Note:** the token is shown once and stored on the server only as a hash. Copy it straight into the app or a password manager; do not send it in chats.

## What happens on connect

1. The phone opens a WebSocket to \`/ws/device\` with the token in the \`Authorization\` header and its own ID, name and app version.
2. The server checks the token and marks the phone **online**.
3. The phone sends a \`hello\` message with its SIM cards: slot, carrier, number (if the SIM reports it), country.
4. The phone re-sends any incoming SMS that the server has not yet acknowledged, so nothing received while offline is lost.
5. The server sends the phone everything that waited in the queue, at the phone's rate.

The phone pings the server every 25 seconds. If the connection breaks, it reconnects automatically with a growing delay (from 2 seconds up to 1 minute).

## The phone page

Everything about one phone is on its page:

| Block | What you see and do |
|---|---|
| Status | Online / offline, last seen, IP address, app version, device model |
| SIM cards | Label, colour, sending on/off, daily limit, sent today |
| Settings | Name, colour, rate per minute, enabled / disabled |
| Token | **New token** |
| Journal | Connections, disconnections, token changes, errors (kept for 30 days) |
| Access | Who else can view, send or manage this phone |

A **disabled** phone cannot connect at all — handy when you want to stop a phone remotely without touching it.

## The journal

The journal is the first place to look when something is wrong:

- many *connected / disconnected* pairs per hour — unstable network or battery optimisation;
- *rejected token* — the app has an old token after you created a new one;
- a long gap — the phone was off, without internet, or frozen by the system.

## Replacing the token

Press **New token** on the phone page when:

- the token may have leaked (shown on screen in a video call, sent in a chat);
- the phone was lost or handed to someone else;
- you move the gateway to a different phone.

The old token stops working immediately and the connected phone is **disconnected**. Enter the new token in the app to bring it back. Messages waiting in the queue are not lost; they leave as soon as the phone reconnects (within the queue time, 24 hours by default).

## Several phones

You can add many phones to one account (up to 20 per person by default). Typical setups:

- **Redundancy:** two phones with different carriers; automatic routing uses whichever is online.
- **Capacity:** several phones, each with its own rate and SIM limits, share a large batch.
- **Branches:** one phone per city or department, each shared with its own team.

Each phone needs its own token. Never put the same token into two phones: they would keep pushing each other off the connection.

## Updating the app

Install a new APK over the old one; settings and the token are kept. After the update, open the app once so Android restarts the service, and check that the phone is online in the portal.
`,
    },
    {
      title: "SIM cards, limits and routing",
      description: "How to label SIM cards, set daily limits, switch sending off and how automatic routing chooses a phone and a SIM.",
      content: `A phone can have one or two SIM cards or eSIM profiles. The server knows each of them and lets you decide which ones send, how much, and in what order.

## SIM settings on the server

On the phone page every SIM has its own card:

| Setting | What it does |
|---|---|
| **Label** | Your name for the SIM: \`MegaCom corporate\`, \`O! marketing\`. Shown everywhere instead of the slot number |
| **Colour** | A colour tag in lists, conversations and charts |
| **Sending** | On / off. A SIM with sending off still **receives** SMS, but is never used for outgoing ones |
| **Daily limit** | How many messages this SIM may send per day. \`0\` means no limit |

The carrier, number and country come from the phone. If the SIM does not report its own number (many do not), add it to the label so colleagues know which number replies go to.

> **Note:** a SIM is selected by **slot**. If you swap cards between slots, check the labels and limits afterwards.

## Daily limits: why and how much

Carriers watch for unusual activity. A fresh SIM that suddenly sends 2,000 identical messages looks like spam and may be blocked within hours. Daily limits protect you from that, and from runaway integrations that send in a loop.

Reasonable starting points:

| SIM | Daily limit |
|---|---|
| New SIM, first week | 50–100 |
| Personal tariff, used for months | 200–300 |
| Corporate tariff with an SMS package | according to the package, e.g. 500–1000 |

Raise limits gradually. The count resets every day; the phone page shows how many were sent today.

The app on the phone can have its own per-SIM limits and a destination filter as well. If the phone refuses a message because of them, the message fails with \`PHONE_REJECTED\` — see *Troubleshooting*.

## Sending rate per phone

Separately from daily limits, each phone has a **rate per minute** — 20 by default (1–120). The server hands messages to the phone no faster than that. A batch of 300 messages through one phone at 20 per minute therefore takes about 15 minutes. That is intended: a steady stream is far less likely to trigger carrier anti-spam than a burst.

## Automatic routing

When you send without choosing a phone or SIM (in the UI: **Auto**; in the API: no \`deviceId\` or \`simId\`), the server picks the route:

1. It takes the phones you may send through (your own and those shared with you at the **edit** level or higher).
2. It keeps phones that are enabled and SIMs with sending on and room left in the daily limit.
3. It prefers **online** phones.
4. It chooses the SIM with the **most room left** in today's limit.

For a batch, messages are spread across SIMs according to the room each one has, so two SIMs with limits 300 and 100 share the load roughly 3:1.

If the limits do not have room for the whole batch, the request is rejected with \`LIMIT_REACHED\` before anything is queued, so you never get a half-sent campaign by surprise.

## Choosing a route explicitly

- **A phone:** \`deviceId\` (or choose the phone in the UI) — the server picks the best SIM on it.
- **A SIM:** \`simId\` from \`GET /devices\` — exactly that card is used. Useful when replies must come back to a particular number or a tariff is cheaper.

\`\`\`json
{ "to": "+996555123456", "text": "Your order is ready", "simId": 7 }
\`\`\`

If that SIM has sending off, you get \`SIM_DISABLED\`; if its limit is used up, \`SIM_LIMIT\`.

## What happens when a phone is offline

Messages routed to an offline phone wait in the queue. When the phone returns, they leave at its normal rate. If the phone does not come back within the **queue time (24 hours by default)**, they become \`expired\`. For time-critical messages connect a second phone — automatic routing prefers the one that is online.

## Practical setups

- **Marketing and service on different SIMs.** Put newsletters on one SIM with a modest limit, and codes and notifications on another. If the marketing SIM gets blocked, the important messages keep flowing.
- **One number for replies.** Choose a specific \`simId\` for messages where the customer is expected to answer.
- **Night pause.** Switch **Sending** off for a SIM to pause it without deleting anything; queued messages wait for another SIM or for it to come back.
`,
    },
    {
      title: "Sending SMS: single, bulk, templates, scheduling and tracking",
      description: "Everything about the Send page: recipients, CSV lists, templates, scheduled sending, cancelling, retrying and following delivery.",
      content: `The **Send** page covers everything from a single test message to a campaign of a thousand recipients.

## Recipients

Paste numbers into the recipients field separated by commas, semicolons or new lines:

\`\`\`
+996555123456
0700 112 233
+7 701 555 44 33
\`\`\`

- Local numbers (without \`+\`) are completed with the portal's default country — **KG** here.
- Duplicates are removed automatically; the order is kept.
- Numbers that cannot be understood are shown as invalid and are not sent.
- Up to **1000 recipients** per send.

## Importing from CSV or Excel

There is no separate import step: open the file, copy the column with phone numbers and paste it into the field. Each line becomes one recipient. For lists over 1000, split them into several sends — or better, use the API with a loop and a pause.

## Text and segment counter

Under the text you see the encoding (GSM-7 or UCS-2), the number of characters and the number of **parts**. A single SMS holds 160 Latin characters or 70 Cyrillic ones; a longer text is split. Each part costs as one SMS. The maximum text length is 1600 characters. See *SMS length, encodings and segments* for details.

## Templates

**Templates** keep texts you send often: "Your code is", "Your order is ready", "Reminder: appointment tomorrow".

- A template can be **personal** or **shared** with everyone on the portal.
- On the Send page pick a template and edit the text before sending.
- Keep templates short and in a single encoding to control the number of parts.

## Choosing the route

Leave **Auto** to let the server choose the phone and the SIM with the most room left today, or choose a specific phone or SIM. Auto routing spreads a batch across SIMs. See *SIM cards, limits and routing*.

## Scheduling

Switch on **Send later** and choose a date and time (up to 90 days ahead). Messages get the status \`scheduled\` and wait. At the set time they become \`queued\` and go to the phone. The queue time (24 hours) counts from the scheduled moment, not from creation.

> **Tip:** schedule promotional messages for local daytime, e.g. 10:00–19:00. Messages at night annoy people and lead to complaints to the carrier.

## Following the delivery

Every message goes through these statuses:

| Status | Meaning |
|---|---|
| \`scheduled\` | Waiting for its scheduled time |
| \`queued\` | In the queue, waiting for the phone |
| \`dispatched\` | Handed to the phone, waiting for confirmation |
| \`accepted\` | The phone confirmed it took the message |
| \`sent\` | The SIM sent it to the carrier |
| \`delivered\` | The carrier reported delivery to the handset |
| \`failed\` | Not sent; see the error code |
| \`cancelled\` | Cancelled by a person before it left |
| \`expired\` | The phone was offline longer than the queue time |

Not all carriers return delivery reports. If yours does not, \`sent\` is the final status you will see.

## Messages page

**Messages** is the full history with filters: direction, status (or the groups *pending*, *done*, *problem*), phone, SIM, number, text, your reference, batch and date range. From here you can:

- **Cancel** a message that is still \`scheduled\` or \`queued\`;
- **Retry** a failed or expired one;
- **Export to CSV** with the same filters (up to 50,000 rows) for reports or reconciliation.

A bulk send has a **batch ID**; filter by it to see the progress of one campaign.

## Inbox

Replies land in **Inbox**, grouped into conversations per number and phone, with an unread counter. You can answer right from the conversation; the reply goes through the same phone, so the customer sees the same number.

## Sending checklist for a campaign

1. Check the list: valid numbers, no duplicates, people who agreed to receive messages.
2. Check the text: parts per message, a sender name, an opt-out phrase.
3. Make sure SIM limits cover the batch.
4. Schedule for daytime.
5. After sending, filter by the batch and look at the *problem* group.
`,
    },
    {
      title: "SMS length, encodings and segments",
      description: "Why one letter can double the cost of a message: GSM-7 and UCS-2, extension characters, emoji and how parts are counted.",
      content: `The cost of an SMS is counted in **parts** (segments), not in messages. How many parts a text takes depends on the characters in it. Understanding this saves real money on bulk sends.

## Two encodings

| Encoding | Used when | One SMS | Each part of a long SMS |
|---|---|---|---|
| **GSM-7** | Every character is in the GSM alphabet (Latin letters, digits, common punctuation) | 160 characters | 153 characters |
| **UCS-2** | At least one character is outside the GSM alphabet (Cyrillic, Turkish ğ ş ı İ ç, Chinese, emoji…) | 70 characters | 67 characters |

A long text is split into parts, and each part carries a small header so the handset can reassemble it — that is why the limit per part is lower (153 instead of 160, 67 instead of 70).

## Examples

| Text | Encoding | Length | Parts |
|---|---|---|---|
| 150 Latin characters | GSM-7 | 150 | 1 |
| 200 Latin characters | GSM-7 | 200 | 2 |
| 70 Cyrillic characters | UCS-2 | 70 | 1 |
| 71 Cyrillic characters | UCS-2 | 71 | 2 |
| 140 Latin characters + one "ş" | UCS-2 | 141 | 3 |

The last line is the trap: a single non-GSM character switches the **whole** message to UCS-2 and can triple the price.

## Extension characters count double

The GSM alphabet has an extension table. These characters are allowed in GSM-7 but take **two** positions each:

\`\`\`
^ { } \\ [ ] ~ | €
\`\`\`

A message with ten \`€\` signs loses ten characters of capacity. Brackets in templates like \`[code]\` are better replaced with plain words or parentheses \`( )\`, which are normal characters.

## Letters that force UCS-2

- **Cyrillic** — any Russian or Kyrgyz text, including ө, ү, ң.
- **Turkish:** ğ, Ğ, ş, Ş, ı, İ, ç are outside the basic alphabet. Ö, ö, Ü, ü and Ç are in it, so they do not change the encoding by themselves.
- **Typographic quotes and dashes:** “ ” ‘ ’ « » — … — they often sneak in when text is copied from Word or a website.
- **Emoji.** Every emoji switches to UCS-2, and most of them take **two** units each, so 😀 counts as two characters.

The segment counter on the Send page and the endpoint \`POST /api/v1/app/sms/tools/segments\` show the encoding and the number of parts before you send:

\`\`\`json
{ "success": true, "segments": { "encoding": "UCS-2", "length": 82, "parts": 2, "perPart": 67, "remaining": 52 } }
\`\`\`

\`remaining\` tells you how many characters you can still add without creating a new part.

## How to save parts

1. **Replace typographic characters** with plain ones: \`"\` instead of \`« »\`, \`-\` instead of \`—\`, \`...\` instead of \`…\`.
2. **No emoji** in bulk messages. They rarely add value and always cost.
3. **For Latin-script languages**, consider writing without special letters when that is acceptable to your audience (\`Siparisiniz hazir\` instead of \`Siparişiniz hazır\`) — it turns a 2-part message into 1. Do this only where it does not look careless.
4. **Shorten links.** A long URL with parameters can be a whole part on its own.
5. **Cut greetings and repetition.** "Dear customer, we are glad to inform you that…" costs a part by itself in Cyrillic.
6. **Watch the border.** A 72-character Cyrillic text is 2 parts; trimming two characters halves the cost.

## The cost of a campaign

Multiply recipients by parts. 1,000 recipients × 3 parts = 3,000 SMS from your package and your daily SIM limits. Count limits in parts when planning: a 3-part message is three SMS for the carrier too, and a burst of long messages is more likely to trigger anti-spam rules.

> **Tip:** the gateway does not change your text. If you want it in GSM-7, prepare it that way in your system before sending.

## Long messages on the receiving side

Modern phones show a multi-part SMS as one message. Some older handsets or feature phones may show parts separately or out of order — another reason to keep important messages within a single part.
`,
    },
    {
      title: "Phone number formats: E.164, default country and short codes",
      description: "How the gateway reads phone numbers, which format to store in your systems, and the mistakes that most often lead to invalid recipients.",
      content: `Every number is converted to the international **E.164** format before sending: a \`+\`, the country code and the national number, with no spaces or punctuation — for example \`+996555123456\`. This article explains how the conversion works and how to avoid surprises.

## The E.164 format

| Part | Example |
|---|---|
| \`+\` | always present |
| Country code | \`996\` (Kyrgyzstan), \`7\` (Kazakhstan, Russia), \`90\` (Türkiye), \`998\` (Uzbekistan) |
| National number | without the leading trunk \`0\` or \`8\` |

E.164 is unambiguous: a number written this way means the same thing everywhere. **Store numbers in E.164 in your CRM, shop or database**, and you will never depend on the default country.

## What the gateway accepts

- \`+996555123456\`, \`+996 555 123 456\`, \`+996 (555) 12-34-56\` — spaces, brackets, dots and dashes are removed.
- \`00996555123456\` — the \`00\` prefix is read as \`+\`.
- \`0555123456\` — a **local** number: completed with the default country.
- \`555123\` — a **short code** of 3–6 digits is sent as it is (carrier services, banks).

## The default country

Numbers without \`+\` or \`00\` are treated as local numbers of the **default country**. On this portal it is **KG** (Kyrgyzstan), so \`0555 123 456\` becomes \`+996555123456\`.

In the API you can override it per request with \`country\`:

\`\`\`json
{ "to": ["8 701 555 44 33", "8 777 123 45 67"], "text": "...", "country": "KZ" }
\`\`\`

## Examples by country

| Country | Local writing | E.164 |
|---|---|---|
| Kyrgyzstan (KG) | \`0555 12 34 56\`, \`0700 112233\` | \`+996555123456\`, \`+996700112233\` |
| Kazakhstan (KZ) | \`8 701 555 44 33\` | \`+77015554433\` |
| Russia (RU) | \`8 (916) 123-45-67\` | \`+79161234567\` |
| Türkiye (TR) | \`0532 123 45 67\` | \`+905321234567\` |
| Uzbekistan (UZ) | \`90 123 45 67\` | \`+998901234567\` |

> **Note:** Kazakhstan and Russia share the country code \`+7\`. \`8 701…\` with country KZ and \`8 916…\` with country RU both convert correctly, but always prefer the full \`+7…\` form when a list mixes the two countries.

## Checking a list before sending

\`POST /api/v1/app/sms/tools/numbers\` checks numbers without sending anything:

\`\`\`bash
curl -X POST https://{{HOST}}/api/v1/app/sms/tools/numbers \\
  -H "Authorization: Bearer $SMS_TOKEN" -H "Content-Type: application/json" \\
  -d '{"to": "0555123456, +905321234567, 12", "country": "KG"}'
\`\`\`

\`\`\`json
{ "success": true, "valid": ["+996555123456", "+905321234567"], "invalid": [{ "input": "12", "reason": "FORMAT" }], "truncated": false }
\`\`\`

Reasons for invalid numbers:

| Reason | Meaning |
|---|---|
| \`EMPTY\` | An empty line |
| \`FORMAT\` | Not a number: letters, too short or too long |
| \`COUNTRY\` | A local number, but no default country is set |
| \`INVALID\` | Not a possible number for that country (wrong length or prefix) |

When you send, invalid numbers are returned in \`invalid\` and the valid ones are still queued. If none is valid, the request fails with \`NO_RECIPIENTS\`.

## Common mistakes

1. **Leading zero after the country code:** \`+9960555123456\` — wrong. Drop the \`0\`: \`+996555123456\`.
2. **\`8\` instead of \`+7\` without a country:** \`89161234567\` with country KG becomes a wrong Kyrgyz number. Use \`+7\` or set \`country: "RU"\`.
3. **Numbers stored as numbers in Excel.** Excel removes the leading \`+\` and \`0\`, or shows \`9.96556E+11\`. Format the column as text before pasting.
4. **Two numbers in one cell:** \`0555123456 / 0700112233\` — split them.
5. **Landlines.** Most landline numbers cannot receive SMS; the carrier will report failure.
6. **Foreign numbers by mistake.** Short international numbers can be premium-rate. The destination filter in the app helps to block unexpected countries.

## Short codes

Numbers of 3 to 6 digits are passed through unchanged. Use them to talk to carrier services (balance, packages) or bank short numbers. Remember that short codes only work inside the SIM's own network and country, and some of them charge for each message.

## Duplicates

The same number written in different ways (\`0555123456\` and \`+996 555 123 456\`) is recognised as one recipient and gets only one message per send.
`,
    },
    {
      title: "REST API: tokens, first request and code examples",
      description: "Create a token and send, track and receive SMS from your own code, with examples in cURL, Python, Node.js and PHP.",
      content: `Everything you can do in the interface is also available through the REST API. Integrations usually need four things: send a message, check its status, read replies, and handle errors.

## Base URL and authentication

- **Base URL:** \`https://{{HOST}}/api/v1/app/sms\`
- **Header:** \`Authorization: Bearer pat_…\`
- **Format:** JSON in UTF-8.

## Creating a token

1. Open **Account → API tokens** (\`/account/api\`). You need the \`api.tokens\` permission; ask an administrator if the page is not there.
2. Press **New token**, give it a name (\`Shop notifications\`) and set the **sms** area to **write** (or **read** for reporting tools).
3. Optional, but recommended: limit it to specific phones, add an IP allow-list and an expiry date.
4. Copy the token — it is shown only once.

Administrators manage all tokens in **Administration → API** (\`/admin/api\`). The full reference with a live "Try it" console is at **/developers**.

> **Tip:** a request runs on behalf of the token owner. It sees exactly the phones that person can see. For integrations create a separate technical account and give it access only to the phones it needs.

## Endpoints you will use most

| Method | Path | What |
|---|---|---|
| \`GET\` | \`/devices\` | Phones and SIMs with today's counters |
| \`POST\` | \`/messages\` | Send one or many SMS |
| \`GET\` | \`/messages/:id\` | A message and its status (id or uuid) |
| \`GET\` | \`/messages\` | History; incoming with \`direction=in\` |
| \`POST\` | \`/messages/:id/cancel\` | Cancel a queued message |
| \`POST\` | \`/messages/:id/retry\` | Send again |
| \`POST\` | \`/messages/read\` | Mark incoming as read |
| \`POST\` | \`/tools/segments\` | Count SMS parts |
| \`POST\` | \`/tools/numbers\` | Validate numbers |

## Sending

Body fields: \`to\` (string or array, **required**), \`text\` (**required**), \`deviceId\`, \`simId\`, \`sendAt\` (ISO 8601, up to 90 days), \`ref\` (your ID, up to 64 characters), \`country\`.

### cURL

\`\`\`bash
curl -X POST https://{{HOST}}/api/v1/app/sms/messages \\
  -H "Authorization: Bearer $SMS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"to": ["+996555123456", "+996700112233"], "text": "Your order #1001 is ready", "ref": "order-1001"}'
\`\`\`

### Python

\`\`\`python
import os, requests

API = "https://{{HOST}}/api/v1/app/sms"
HEADERS = {"Authorization": f"Bearer {os.environ['SMS_TOKEN']}"}

r = requests.post(f"{API}/messages", headers=HEADERS, timeout=15, json={
    "to": "+996555123456",
    "text": "Your code: 4821",
    "ref": "otp-77812",
})
r.raise_for_status()
msg = r.json()["messages"][0]
print(msg["id"], msg["status"])
\`\`\`

### Node.js (18+)

\`\`\`js
const API = 'https://{{HOST}}/api/v1/app/sms';
const headers = { Authorization: \`Bearer \${process.env.SMS_TOKEN}\`, 'Content-Type': 'application/json' };

const res = await fetch(\`\${API}/messages\`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ to: '+996555123456', text: 'Your code: 4821', ref: 'otp-77812' }),
});
const data = await res.json();
if (!data.success) throw new Error(\`\${data.code}: \${data.error}\`);
console.log(data.messages[0].id);
\`\`\`

### PHP

\`\`\`php
<?php
$ch = curl_init('https://{{HOST}}/api/v1/app/sms/messages');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . getenv('SMS_TOKEN'),
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode(['to' => '+996555123456', 'text' => 'Your code: 4821']),
]);
$data = json_decode(curl_exec($ch), true);
echo $data['messages'][0]['status'];
\`\`\`

The answer comes back immediately:

\`\`\`json
{
  "success": true,
  "batchId": null,
  "segments": { "encoding": "GSM-7", "parts": 1 },
  "messages": [{ "id": 1842, "uuid": "1f0c6a52-…", "phone": "+996555123456", "status": "queued", "ref": "otp-77812" }],
  "invalid": []
}
\`\`\`

## Checking the status

\`\`\`bash
curl https://{{HOST}}/api/v1/app/sms/messages/1842 -H "Authorization: Bearer $SMS_TOKEN"
\`\`\`

Statuses: \`scheduled → queued → dispatched → accepted → sent → delivered\`, or \`failed\` / \`cancelled\` / \`expired\`. Instead of polling every message, use webhooks (\`sms.sent\`, \`sms.delivered\`, \`sms.failed\`) — or filter the list by your reference: \`GET /messages?ref=order-1001\`.

## Receiving replies by polling

If you cannot accept webhooks, poll for incoming messages. Remember the highest \`id\` you processed and ask only for newer ones; with \`sinceId\` the answer comes in **ascending** order:

\`\`\`python
import time
last_id = load_last_id()  # 0 the first time
while True:
    r = requests.get(f"{API}/messages", headers=HEADERS, timeout=15,
                     params={"direction": "in", "sinceId": last_id, "limit": 200})
    for m in r.json()["messages"]:
        handle_reply(m["phone"], m["text"])
        last_id = m["id"]
        save_last_id(last_id)
    time.sleep(10)
\`\`\`

## Errors

Errors have the form \`{ "success": false, "code": "…", "error": "…" }\`.

| HTTP | Code | What to do |
|---|---|---|
| 400 | \`TEXT_REQUIRED\`, \`TEXT_TOO_LONG\` | Text is empty or over 1600 characters |
| 400 | \`NO_RECIPIENTS\`, \`TOO_MANY_RECIPIENTS\` | No valid numbers / over 1000 per request |
| 400 | \`SEND_AT_INVALID\`, \`SEND_AT_TOO_FAR\` | Bad date, or more than 90 days ahead |
| 401 | \`TOKEN_INVALID\`, \`TOKEN_EXPIRED\`, \`TOKEN_REVOKED\` | Check or replace the token |
| 403 | \`SCOPE_DENIED\` | The token has no \`sms:write\` |
| 403 | \`IP_NOT_ALLOWED\`, \`TOKEN_LIMITED\` | Wrong source IP / phone outside the token's limits |
| 404 | \`SIM_NOT_FOUND\`, \`NOT_FOUND\` | Wrong id or no access |
| 409 | \`NO_DEVICE\` | No phone you can send through, or sending is off everywhere |
| 409 | \`SIM_DISABLED\`, \`SIM_LIMIT\`, \`LIMIT_REACHED\` | Sending off, or daily limits used up |
| 429 | \`RATE_LIMITED\` | Too many requests; wait \`Retry-After\` seconds |

Every response carries \`X-RateLimit-Remaining\` and \`X-Request-Id\`; log the request ID — it makes support much faster.

> **Tip:** always send a \`ref\`. If your call times out and you are not sure whether the message was queued, look it up with \`GET /messages?ref=…\` before sending again.
`,
    },
    {
      title: "Webhooks: events, payload, signatures and retries",
      description: "Receive deliveries, failures, replies and phone status changes in real time, and verify that every request really comes from the gateway.",
      content: `A webhook is an HTTP request the server sends to your URL when something happens: a reply arrives, a message is delivered, a phone goes offline. It is faster and lighter than polling.

## Creating a webhook

Webhooks are created by administrators in **Administration → API** (\`/admin/api\`) → *Webhooks*:

1. **URL** — your HTTPS endpoint, e.g. \`https://crm.example.com/hooks/sms\`.
2. **Events** — single events, the whole group \`sms.*\`, or \`*\` for everything.
3. **Run as** — the person whose access applies. The webhook receives events only about phones this person can see. Use a technical account with access to the right phones.
4. Optionally limit it to specific phones, the same way as a token.
5. Copy the **secret** (\`whsec_…\`) — shown once.

Press **Send a test** to deliver a \`ping\` event and see your server's answer immediately.

## Events

| Event | When |
|---|---|
| \`sms.received\` | An incoming SMS arrived at one of the phones |
| \`sms.sent\` | The SIM sent an outgoing message to the carrier |
| \`sms.delivered\` | The carrier confirmed delivery |
| \`sms.failed\` | A message failed (see \`errorCode\`) |
| \`device.online\` | A phone connected |
| \`device.offline\` | A phone lost the connection |

## Payload

\`\`\`json
{
  "id": "6b0f8a8e-5f3c-4c9e-9a51-2f8d0c7c1e11",
  "type": "sms.delivered",
  "createdAt": "2026-10-19T09:31:09.000Z",
  "data": {
    "message": {
      "id": 1842, "uuid": "1f0c6a52-…", "deviceId": 3, "simId": 7, "slot": 1,
      "direction": "out", "phone": "+996555123456", "text": "Your code: 4821",
      "parts": 1, "status": "delivered", "ref": "otp-77812"
    }
  }
}
\`\`\`

Phone events carry \`data.device\` (id, name, online state) instead of \`data.message\`. Your \`ref\` comes back in every message event — use it to find the order or ticket in your system.

## Delivery

- \`POST\` with \`Content-Type: application/json\`.
- Headers: \`X-Portal-Event\`, \`X-Portal-Delivery\`, \`X-Portal-Signature\`, and \`X-Portal-Redelivery: 1\` when an administrator resent the delivery by hand.
- Success is any **2xx** answer within **10 seconds**.
- Retries: after **1 min, 5 min, 30 min, 2 h and 6 h**; then the delivery is marked failed. After 20 failed deliveries in a row the webhook switches itself off.

> **Tip:** answer \`200\` immediately and do the work in a background job. Slow handlers cause timeouts, and timeouts cause duplicate deliveries.

## Verifying the signature

\`X-Portal-Signature: t=<unix time>,v1=<hex>\`, where \`v1 = HMAC-SHA256(secret, "<t>.<raw body>")\`. Always compute it over the **raw** request body, before JSON parsing, and reject old timestamps (more than 5 minutes).

### Node.js (Express)

\`\`\`js
import crypto from 'node:crypto';
import express from 'express';

const app = express();
app.post('/hooks/sms', express.raw({ type: 'application/json' }), (req, res) => {
  const header = req.get('X-Portal-Signature') || '';
  const { t, v1 } = Object.fromEntries(header.split(',').map((p) => p.split('=', 2)));
  const expected = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET).update(\`\${t}.\${req.body}\`).digest();
  const given = Buffer.from(v1 || '', 'hex');
  const fresh = Math.abs(Date.now() / 1000 - Number(t)) < 300;
  if (!fresh || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return res.sendStatus(401);
  const event = JSON.parse(req.body);
  queue.add(event); // process later
  res.sendStatus(200);
});
\`\`\`

### Python (Flask)

\`\`\`python
import hmac, hashlib, time, os
from flask import Flask, request, abort

app = Flask(__name__)
SECRET = os.environ["WEBHOOK_SECRET"].encode()

@app.post("/hooks/sms")
def sms_hook():
    raw = request.get_data()
    parts = dict(p.split("=", 1) for p in request.headers.get("X-Portal-Signature", "").split(",") if "=" in p)
    t, v1 = parts.get("t", "0"), parts.get("v1", "")
    expected = hmac.new(SECRET, f"{t}.".encode() + raw, hashlib.sha256).hexdigest()
    if abs(time.time() - int(t)) > 300 or not hmac.compare_digest(expected, v1):
        abort(401)
    event = request.get_json()
    enqueue(event)
    return "", 200
\`\`\`

### PHP

\`\`\`php
<?php
$raw = file_get_contents('php://input');
parse_str(str_replace(',', '&', $_SERVER['HTTP_X_PORTAL_SIGNATURE'] ?? ''), $sig);
$expected = hash_hmac('sha256', ($sig['t'] ?? '') . '.' . $raw, getenv('WEBHOOK_SECRET'));
if (abs(time() - (int)($sig['t'] ?? 0)) > 300 || !hash_equals($expected, $sig['v1'] ?? '')) {
    http_response_code(401);
    exit;
}
$event = json_decode($raw, true);
// save $event and process it in the background
http_response_code(200);
\`\`\`

## Idempotency

An event can arrive twice — for example, when your server processed it but answered too late and the gateway retried. Store the event \`id\` and skip events you have already processed:

\`\`\`sql
INSERT INTO sms_events (event_id, payload) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING;
\`\`\`

A manual **Send again** from the console keeps the same event \`id\` and adds \`X-Portal-Redelivery: 1\`. If you want manual resends to be processed again, honour that header.

## Order of events

Events may arrive out of order: \`sms.delivered\` can overtake \`sms.sent\` after a retry. Never move a message "backwards" in your system — if you already have \`delivered\`, ignore a later \`sent\`.

## Private addresses

Webhooks to private networks (10.x, 192.168.x, localhost…) are refused by default. Use a public HTTPS address, or ask the administrator to allow private addresses if your receiver lives in the internal network.
`,
    },
    {
      title: "Access and teamwork: sharing phones and narrowing tokens",
      description: "Give colleagues the right level of access to a phone, and limit API tokens to specific phones, IP addresses and dates.",
      content: `A phone belongs to the person who added it. Everyone else gets access only when the owner (or an administrator) shares it. The same model applies to people in the interface and to integrations through API tokens.

## Access levels

| Level | What it allows |
|---|---|
| **View** | Read the phone's messages and conversations, see its SIM cards and status |
| **Edit** | Everything in *view*, plus **sending** messages through this phone |
| **Manage** | Everything in *edit*, plus settings, SIM limits, the token, sharing and deleting the phone |

The owner always has *manage*.

## Sharing a phone

Open the phone page → **Access**, then add:

- a **user** — one person;
- a **group** — for example "Support", so new team members get access automatically;
- a **role**;
- **everyone** on the portal — rarely a good idea for sending, sometimes useful for *view*.

Choose the level and save. The change applies immediately; there is no need to reconnect the phone.

## Typical team setups

| Who | Level |
|---|---|
| Support operators who answer customers in Inbox | **Edit** on the support phone |
| A manager who reads conversations and reports | **View** |
| An IT engineer who maintains the phones | **Manage** |
| An integration (technical account) that sends codes | **Edit** on the OTP phones only |

> **Tip:** give *manage* to as few people as possible. Anyone with *manage* can create a new token, which disconnects the phone until the app gets the new one.

## How access affects routing

Automatic routing only uses phones on which you have **edit** or **manage**. A phone shared with you at *view* level appears in your lists, but your messages never go through it.

## API tokens: the same access, narrowed further

A token always acts on behalf of its owner, and never gets more than the owner has. On top of that you can narrow it:

\`\`\`
owner's rights ∩ token areas ∩ phone limits ∩ IP list, expiry, rate limit
\`\`\`

### Area and level

- \`sms: read\` — read phones, messages and conversations (reporting, BI, polling incoming).
- \`sms: write\` — also send, cancel and retry.

### Limiting to specific phones

In the token settings choose **resource limits → SMS phones** (\`sms.devices\`) and tick the phones. The token then works only with those phones even if the owner has access to more:

- an attempt to use another phone is rejected with \`TOKEN_LIMITED\`;
- automatic routing chooses only among the allowed phones;
- message lists contain only their messages.

This is the right way to give a shop integration access to the "notifications" phone without exposing the support conversations on another phone.

### IP allow-list

Enter the addresses or IPv4 networks your servers call from, e.g. \`203.0.113.10\` or \`10.0.0.0/8\`. Requests from anywhere else get \`403 IP_NOT_ALLOWED\`. If your integration runs on a server with a static IP, always set this.

### Expiry

Choose 30, 90 or 365 days, a date, or no expiry. An expired token stops at the end of that day with \`401 TOKEN_EXPIRED\`. Short-lived tokens are ideal for contractors and tests.

### Rate limit

Requests per minute for this token (the portal default is 120). It limits API calls, not SMS — the SMS pace is controlled by each phone's rate.

## Technical accounts

For each integration create a separate account, e.g. \`svc-shop\`, \`svc-1c\`, \`svc-monitoring\`:

1. Share only the phones it needs, at the lowest sufficient level.
2. Create its token with the needed area and limits (an administrator can issue a token on behalf of another account).
3. If an employee leaves, nothing breaks: the integration does not depend on their personal account.

## Reviewing access

Once a quarter go through the phones' **Access** tabs and the token list:

- remove people who left or changed roles;
- revoke tokens that have not been used for months (the console shows idle tokens);
- check that tokens of external partners have an expiry date.
`,
    },
    {
      title: "Best practices to avoid carrier blocking",
      description: "How to send through ordinary SIM cards for a long time without your numbers being blocked as spam.",
      content: `A gateway sends through regular SIM cards. Carriers protect their networks from spam, and a SIM that behaves like a spammer gets limited or blocked — sometimes in hours. These practices keep your numbers healthy.

## 1. Keep the pace human

- Leave the phone rate at the default **20 per minute** or lower for ordinary SIMs. Raising it to 60+ is a common reason for sudden blocks.
- Use **daily limits** on every SIM. They are your safety net against integration bugs that send in a loop.
- Spread large volumes over several hours or days instead of one burst.

## 2. Warm up new SIM cards

A brand-new SIM with no history that immediately sends hundreds of messages is the classic spam pattern.

| Period | Daily limit |
|---|---|
| Days 1–3 | 20–50, mostly to people who will reply |
| Days 4–7 | 100 |
| Week 2 | 200 |
| After that | Raise gradually, watching the failure rate |

Normal activity helps: incoming messages, replies, occasional calls and mobile data use make a SIM look like a real subscriber.

## 3. Avoid identical mass texts

Thousands of byte-for-byte identical messages are easy to detect. Personalise:

- the recipient's name, order number, date or amount;
- a few template variants for promotional texts.

Personalisation also improves the response rate.

## 4. Watch the content

Carrier filters react to:

- shortened links from public shorteners (use your own domain);
- words typical of fraud: "win", "prize", "urgent", "your card is blocked";
- capital letters and many exclamation marks;
- links in the first message to someone who has never heard of you.

Always say **who** is writing: "Clinic Aidar: your appointment is tomorrow at 10:00".

## 5. Give people a way to opt out

Add a short line to promotional messages: "Reply STOP to unsubscribe". Process such replies (they arrive in **Inbox** and as \`sms.received\` webhooks) and remove those numbers from your lists. People who cannot unsubscribe complain to the carrier — and complaints are the fastest route to a block.

## 6. Respect the time of day

Send promotional messages during local daytime, roughly **09:00–20:00**. Use scheduled sending for campaigns. Transactional messages — codes, order updates, alerts — can go at any time because people expect them.

## 7. Separate traffic

- Put **marketing** and **transactional** traffic on different SIMs.
- Keep at least two SIMs (preferably on different carriers) for important messages.
- If a marketing SIM gets blocked, codes and notifications keep working.

## 8. Clean your lists

- Remove numbers that fail again and again (\`PHONE_FAILED\`): they are often disconnected or landlines.
- Do not buy databases of numbers. Besides being illegal in many countries, they generate complaints and failures.
- Validate numbers before a campaign with \`POST /tools/numbers\`.

## 9. Follow local rules and get consent

Most countries regulate commercial SMS: consent of the recipient, sender identification, opt-out, quiet hours. Kyrgyzstan, Kazakhstan, Russia, Türkiye and Uzbekistan all have personal data and advertising laws that apply to SMS. In Türkiye, for example, commercial messages require prior consent and must be registered in the national messaging system (İYS). Check the rules of every country you send to, and keep a record of how and when each person agreed.

## 10. Read the signals

| Signal | Meaning | Action |
|---|---|---|
| The failure rate of one SIM grows | Carrier limits or a block is starting | Pause the SIM, lower its limit |
| Messages are \`sent\` but never \`delivered\` | Filtering on the carrier side | Change content, slow down |
| The SIM cannot send at all, even manually | Blocked | Contact the carrier, move traffic to another SIM |
| Many replies "who is this?" | Unclear sender | Add your name at the beginning |

> **Tip:** for very large volumes (tens of thousands per day) ordinary SIM cards are the wrong tool. Talk to your carrier about a corporate SMS package or an official bulk SMS service.
`,
    },
    {
      title: "Use cases and integration recipes",
      description: "Ready-made patterns for one-time codes, order notifications, appointment reminders, two-way support and monitoring alerts.",
      content: `These recipes show how to build common scenarios on top of the gateway. All of them use the same API: \`POST /messages\` to send, webhooks or polling to receive.

## 1. One-time codes (OTP / 2FA)

**Goal:** a user receives a login or confirmation code within seconds.

1. Your backend generates a code, stores its hash with an expiry (e.g. 5 minutes).
2. It sends the SMS with a unique \`ref\`:

\`\`\`python
requests.post(f"{API}/messages", headers=HEADERS, timeout=10, json={
    "to": user_phone,
    "text": f"Your code: {code}. Do not share it with anyone.",
    "ref": f"otp-{attempt_id}",
})
\`\`\`

3. The webhook \`sms.failed\` with this \`ref\` tells you to offer another channel (email, call) immediately.

Good practices:

- Keep the text short and in GSM-7 so it is a single part.
- Limit attempts per phone number and per IP in your system — SMS bombing through your login form costs money and may get your SIM blocked.
- Use at least **two phones** for codes; automatic routing switches to the online one.
- Do not schedule OTPs and keep the queue short: a code that arrives after an hour is useless. Consider cancelling (\`POST /messages/:id/cancel\`) codes that are still queued after a minute.

## 2. Order notifications from a shop, 1C or CRM

**Goal:** a customer receives "order accepted", "shipped", "ready for pickup".

- Trigger the send from the status change in your system.
- Use \`ref\` = order number + status, e.g. \`order-1001-shipped\`. It makes duplicates easy to spot and comes back in webhooks.
- Keep texts in templates on your side with placeholders: name, number, amount, pickup address.

For **1C**, send the request from a background job with \`HTTPConnection\` over SSL (\`OpenSSLSecureConnection\`): method \`POST\`, path \`/api/v1/app/sms/messages\`, headers \`Authorization: Bearer pat_…\` and \`Content-Type: application/json\`, body:

\`\`\`json
{ "to": "+996555123456", "text": "Order 1001 is ready for pickup", "ref": "order-1001-ready" }
\`\`\`

Store the returned message \`id\` next to the document to show the delivery status later.

## 3. Appointment reminders

**Goal:** fewer no-shows at a clinic, salon or service centre.

Use scheduled sending — no cron job of your own needed:

\`\`\`json
{
  "to": "+905321234567",
  "text": "Clinic Aidar: reminder, tomorrow at 10:30 with Dr. Kaya. Reply 1 to confirm, 2 to cancel.",
  "sendAt": "2026-10-20T07:00:00Z",
  "ref": "visit-5531"
}
\`\`\`

If the appointment is cancelled or moved, call \`POST /messages/:id/cancel\` and create a new one. Replies "1" or "2" arrive as \`sms.received\`; match them to the visit by the phone number and the date of the last reminder.

## 4. Two-way support desk

**Goal:** customers write to a number, operators answer, everything is in one place.

- Operators work in **Inbox**: conversations per number, unread counters, answers from the same phone.
- Share the support phone with the support group at **edit** level.
- To mirror conversations into a helpdesk, subscribe a webhook to \`sms.received\` and create or update a ticket by phone number. Agent answers from the helpdesk go back through \`POST /messages\` with \`deviceId\` of the support phone, so the customer always sees the same number.
- Mark messages as read via \`POST /messages/read\` when the ticket is opened, so the Inbox counters stay accurate.

## 5. Monitoring alerts

**Goal:** an engineer gets an SMS when the internet or the monitoring dashboard is unreachable.

SMS is useful exactly when other channels fail. Send from Zabbix, Prometheus Alertmanager or a simple script:

\`\`\`bash
#!/bin/sh
# /usr/local/bin/sms-alert "<number>" "<text>"
curl -s -X POST https://{{HOST}}/api/v1/app/sms/messages \\
  -H "Authorization: Bearer $SMS_TOKEN" -H "Content-Type: application/json" \\
  -d "$(jq -n --arg to "$1" --arg text "$2" '{to:$to, text:($text|.[0:300])}')"
\`\`\`

Tips:

- Group alerts and limit them (e.g. no more than one SMS per problem per 15 minutes), otherwise a flapping service burns your daily limit.
- Subscribe to \`device.offline\` for the gateway phones themselves and alert by email or messenger — you cannot send an SMS about a phone that is offline.

## 6. Two-step confirmation of payments or deliveries

Send a code to the courier or recipient, and accept the reply as an SMS: \`sms.received\` gives you the number and text; check the code and update the order. This works even without a mobile app on the customer's side.

## Choosing between webhooks and polling

| | Webhooks | Polling |
|---|---|---|
| Speed | Instant | Every N seconds |
| Needs | A public HTTPS endpoint | Nothing |
| Load | Minimal | Constant requests |
| Best for | CRMs, helpdesks, bots | Scripts, internal systems behind NAT |
`,
    },
    {
      title: "Troubleshooting",
      description: "What to do when a phone is offline, messages are stuck, fail with an error code, or replies and delivery reports do not arrive.",
      content: `Most problems come down to three things: the phone cannot keep its connection, the SIM cannot send, or the number or text is wrong. Start with the table, then follow the steps for your case.

## Quick reference

| Symptom | Most likely cause | First step |
|---|---|---|
| The phone is offline | No internet, the app was killed, wrong token | Open the app, check *SMS server* status and the error |
| Messages stay \`queued\` | The phone is offline, or the rate holds them back | Check the phone status and its rate per minute |
| Messages stay \`accepted\` | The phone lost the connection after taking the message | Wait for reconnection; check the phone's own history |
| \`failed\` · \`PHONE_REJECTED\` | The phone refused: destination filter, SIM limit in the app, no SIM | Check the app's filter and limits |
| \`failed\` · \`PHONE_FAILED\` | Carrier or radio error | Check balance, signal, SMS package; try manually |
| \`failed\` · \`NO_ACK\` | No confirmation from the phone in 60 s, 3 times | Check network stability and the app version |
| \`expired\` · \`EXPIRED\` | The phone was offline longer than 24 hours | Bring the phone online, retry |
| No incoming messages | iSMS GW is not the default SMS app | Set it as default again |
| No \`delivered\` status | The carrier sends no delivery reports | Treat \`sent\` as final for that carrier |
| Duplicates | Your code retries the request | Use \`ref\` and check before resending |

## The phone is offline

1. **Is the app running?** Open iSMS GW. If the notification of the gateway service is missing, the system killed it. Go through *Preparing the Android phone for 24/7 work*.
2. **Look at the error** in *Settings → SMS server*:
   - \`HTTP 401\` — the token is wrong or was replaced. Copy the current one from the portal (or press **New token**) and enter it.
   - \`HTTP 403\` — the phone is **disabled** on the portal. Enable it on the phone page.
   - a timeout or DNS error — no internet. Open any website in the phone's browser.
3. **Check the URL**: exactly \`wss://{{HOST}}/ws/device\`.
4. **Check the journal** on the phone page. Frequent reconnects point to Wi-Fi sleep or battery optimisation.

## Messages stuck in the queue

- \`queued\` with an online phone usually means the phone is working through a batch at its rate: 300 messages at 20 per minute take 15 minutes.
- If the SIM's sending is switched off or its daily limit is used up, messages wait for another SIM or for the next day.
- Messages that do not leave within the queue time become \`expired\`. You can **retry** them after fixing the cause.

## Messages stuck in \`accepted\`

The phone took the message but the status report never arrived. Status reports come only while the phone is connected and are not repeated, so a disconnection at the wrong moment leaves the message in \`accepted\`. Open the phone and check whether the SMS is in its sent folder. It is usually sent; the portal just does not know.

## Failed messages by error code

- **\`PHONE_REJECTED\`** — the app refused the message before sending. Causes: the number is blocked by the **destination filter** in the app (another country, premium range), the **daily limit** set in the app is reached, the SIM slot is empty or disabled in the app. The error text shows the reason.
- **\`PHONE_FAILED\`** — Android tried and the radio or carrier refused. Check balance or the SMS package, signal strength, airplane mode, whether the SIM can send SMS at all (try manually from the same SIM), and whether the carrier blocked the SIM for spam.
- **\`NO_ACK\`** — the server handed the message to the phone three times and got no confirmation within 60 seconds each time. Usually the connection is half-dead (Wi-Fi asleep). If the phone later reports that it sent the message after all, the status is corrected to \`sent\` or \`delivered\` automatically. Check the phone before retrying to avoid a double send.
- **\`EXPIRED\`** — the phone was offline longer than the queue time. Fix the connection, then **retry**.

## No incoming messages

1. iSMS GW must be the **default SMS app**. Some system updates and other messaging apps silently take this role back.
2. On Xiaomi, check *Service SMS* and *Notifications* permissions.
3. Incoming SMS received while the phone was offline are delivered when it reconnects — the phone resends them until the server acknowledges them.
4. If you use webhooks, check the delivery log in **Administration → API → Webhooks**: the event may be arriving, but your endpoint answers with an error.

## Delivery reports missing

Some carriers and some destinations (especially international) do not return delivery reports. In addition, a report is lost if the phone is disconnected at the moment it arrives. If a message is \`sent\` and the recipient confirms receipt, everything works as designed.

## Duplicates

- **Your side:** a timeout makes your code send again. Always pass \`ref\`, and on a timeout check \`GET /messages?ref=…\` first.
- **Webhooks:** an event may arrive twice by design. Deduplicate by the event \`id\`.
- **Retry after \`NO_ACK\`:** the first attempt may have been sent after all. Check the phone's history before retrying.

## Battery killers

If everything works during the day but stops at night, it is almost certainly power management: Samsung *Sleeping apps*, Xiaomi *Battery saver*, Huawei *App launch*, automatic night restarts, or a "cleaner" app. Revisit the phone preparation article.

## Collecting information for support

- The message \`id\` or \`uuid\`, its status and error text.
- The phone name and the time of the problem.
- The \`X-Request-Id\` of the API response.
- A screenshot of *Settings → SMS server* in the app.
`,
    },
    {
      title: "Security checklist",
      description: "How to keep tokens, phones and webhooks safe, and what to do if a phone or a token is lost.",
      content: `An SMS gateway can send messages on behalf of your company and read replies that often contain personal data and confirmation codes. Treat it with the same care as an email server.

## Tokens

There are two kinds of secrets:

| Secret | Format | Gives |
|---|---|---|
| Phone connection token | \`smsgw_…\` | The right to connect **as that phone** |
| API token | \`pat_…\` | Access to the API **on behalf of a person** |
| Webhook secret | \`whsec_…\` | The ability to sign (and forge) webhook requests |

Checklist:

- [ ] Store tokens in a secrets manager or environment variables, **never** in source code, Git, tickets or chat.
- [ ] Each integration has **its own** API token, so you can revoke one without breaking the others.
- [ ] Every token has the **lowest level** that works: \`read\` for reports, \`write\` only for those who send.
- [ ] Tokens are **limited to the phones** they need (\`sms.devices\`).
- [ ] Tokens used from servers have an **IP allow-list**.
- [ ] Tokens for contractors and tests have an **expiry date**.
- [ ] Tokens are **rotated** regularly (e.g. once a year) and immediately when someone with access leaves.

## Accounts and access

- [ ] Integrations run under **separate technical accounts**, not personal ones.
- [ ] Phones are shared with **groups** rather than individuals, so leaving a group removes access automatically.
- [ ] *Manage* is given to as few people as possible.
- [ ] Access is reviewed quarterly: people who left, idle tokens, external partners.
- [ ] Accounts with *manage* on phones and administrators use strong, unique passwords.

## Webhooks

- [ ] The endpoint uses **HTTPS** only.
- [ ] Every request is **verified** with the HMAC signature over the raw body; requests with old timestamps are rejected.
- [ ] Events are **deduplicated** by \`id\`.
- [ ] The webhook runs as a technical account that sees only the phones it needs.
- [ ] The secret is replaced (**New secret**) if it may have leaked; give the new one to your receiver right away.

## The phone

- [ ] The phone is **dedicated** to the gateway, not someone's personal device.
- [ ] Screen lock with a PIN; no personal accounts, no unnecessary apps.
- [ ] Physically secure place: a locked room or cabinet, not an open desk.
- [ ] The SIM PIN is disabled for automatic restarts — therefore physical security of the phone matters even more.
- [ ] The app's **local web panel and API** are not exposed to the internet: keep the app firewall in *LAN only* mode or turn the local server off if you only use the portal connection.
- [ ] The **destination filter** in the app blocks countries and premium ranges you never send to — protection against abuse if a token leaks.
- [ ] Daily SIM limits are set — they cap the damage of any mistake or abuse.

## Network

- Use only \`https://\` and \`wss://\` addresses, both for the API and for the phone connection.
- Do not disable certificate checks in your HTTP client "just to make it work".

## Data

- Incoming SMS often contain codes from banks and services. Limit who can **view** a phone.
- Messages are kept for **365 days** by default and then deleted. Export what you must keep for longer, and do not keep more than you need.
- CSV exports contain personal data: store and share them accordingly.

## If a phone is lost or stolen

1. Open the phone page and press **New token** — the lost phone can no longer connect.
2. Or **disable** the phone entirely.
3. Block the SIM card with the carrier and order a replacement.
4. Check **Messages** for anything sent from that phone after the loss.
5. Set up a replacement phone with a new token; restore the SIM labels and limits.

## If an API token leaked

1. **Revoke** it in *Account → API tokens* (or *Administration → API*) — it stops working immediately.
2. Check the token's **request log**: which IP addresses used it and what was sent.
3. Look at **Messages** for unexpected sends and cancel any still queued.
4. Create a new token with tighter limits (phones, IP list, expiry) and update the integration.

> **Tip:** write these two procedures into your internal runbook now, with names of who does what. In an incident there is no time to look for instructions.
`,
    },
  ],
};
