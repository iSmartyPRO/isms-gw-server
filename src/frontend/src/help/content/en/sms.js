export default {
  id: 'sms',
  icon: 'sms',
  title: 'SMS gateway',
  tagline: 'Send and receive SMS through your own Android phones and SIM cards.',
  summary: 'The SMS gateway turns ordinary Android phones running the iSMS GW app into a shared SMS service. Connect a phone, and you can send messages from the browser or through the API, answer incoming SMS in conversations, track every message from the queue to delivery and share phones with colleagues. Messages go out from your own SIM cards, at your carrier’s rates, without third-party SMS providers.',
  highlights: [
    {
      icon: '📱',
      title: 'Your phones, your SIM cards',
      text: 'Add a phone in a minute with a QR code — it connects over Wi-Fi or mobile data, no public IP needed.',
    },
    {
      icon: '✉️',
      title: 'Bulk sending',
      text: 'Paste a list or import a CSV, pick a template, see the segment count and schedule sending up to 90 days ahead.',
    },
    {
      icon: '💬',
      title: 'Inbox as conversations',
      text: 'Incoming SMS are grouped by number; a reply goes out from the same SIM card the message arrived on.',
    },
    {
      icon: '🧭',
      title: 'Automatic routing',
      text: 'The gateway picks an online phone and the SIM card with the most room left in its daily limit.',
    },
    {
      icon: '📊',
      title: 'Every status in view',
      text: 'From “queued” to “delivered”: a timeline for each message, filters, CSV export, cancel and retry.',
    },
    {
      icon: '🔌',
      title: 'API and webhooks',
      text: 'Send SMS from your CRM, website or 1C and get incoming messages and delivery reports pushed to your system.',
    },
  ],
  tips: [
    'Keep the phone on charge and exclude iSMS GW from battery optimisation — otherwise Android may put it to sleep.',
    'Give each SIM card a clear label and colour (“Office MegaCom”, “Sales O!”) — it shows in the inbox, history and “From” list.',
    'Set a daily limit on every SIM card: carriers block numbers that send too much, and the gateway will spread the load for you.',
    'Use the “Reference” field (or `ref` in the API) for your order or ticket number — you can then search the history by it.',
    'Have a text you send often? Save it as a shared template so the whole team uses the same wording.',
    'Copy the connection token right away — it is shown only once. Lost it? Issue a new one on the phone’s “Connection” tab.',
  ],
  sections: [
    {
      id: 'how-it-works',
      title: 'How it works',
      body: `Each phone runs the free **iSMS GW** app ([download](https://github.com/iSmartyPRO/isms-gw-android/releases/latest), Android 8 or newer). The app keeps a permanent secure connection to the portal, so the phone can sit behind a home router or on mobile data.

- You write a message in the portal or send it through the API.
- The portal puts it in the **queue** and passes it to a suitable phone.
- The phone sends the SMS from the chosen SIM card and reports back: sent, delivered or failed.
- Incoming SMS travel the other way: the phone forwards them to the portal, and they appear in the **Inbox**.

If a phone is offline, messages wait in the queue and go out as soon as it reconnects. The module is at [SMS gateway](/app/sms) and has these sections: **Overview**, **Inbox**, **Send**, **Messages**, **Templates**, **API** and **Phones**.`,
      note: 'SMS are sent by your SIM cards, so your carrier’s tariff and limits apply. The portal does not charge for messages.',
    },
    {
      id: 'add-phone',
      title: 'Adding a phone',
      body: `A phone is added with a short wizard in [Phones](/app/sms/devices). You need the phone itself with the iSMS GW app installed and set as the default SMS app.

The wizard shows the **server address** \`wss://<portal>/ws/device\`, a **connection token** and a **QR code** with both. Then it waits for the phone live — as soon as the phone connects, you see its SIM cards.`,
      steps: [
        'Open “Phones” and click “Add phone”.',
        'Enter a name (for example “Office Pixel”) and pick a colour — it marks the phone’s messages everywhere.',
        'On the phone open iSMS GW → Settings → SMS server. Scan the QR code or paste the address and token by hand.',
        'Turn the server link on in the app. The wizard notices the connection within seconds.',
        'Check the list of SIM cards the phone reported and click “Done” — or go straight to sending your first SMS.',
      ],
      note: 'The token is shown only once. If you close the wizard without copying it, open the phone and issue a new token on the “Connection” tab.',
    },
    {
      id: 'phone-page',
      title: 'Phone page and SIM cards',
      body: `Click a phone in the list to open its page. On top — status (online or offline, last seen), today’s counters and a chart of sent and received messages. Tabs:

- **SIM cards** — every SIM and eSIM of the phone with carrier and number. For each you can set your own **label** and **colour**, switch **sending** on or off and set a **daily limit**. The bar shows how much of today’s limit is used.
- **Connection** — the server address, app version, IP address and **token replacement**. A new token makes the old one stop working at once: enter the new one in the app.
- **Journal** — when the phone connected and disconnected, when the token was changed, errors.
- **Settings** — name, description, colour, **messages per minute** (leave empty to use the portal default) and the **Enabled** switch. A disabled phone stays connected but gets no new messages.`,
      example: {
        title: 'One phone, two SIM cards',
        body: 'SIM 1 “Office MegaCom” — sending on, limit 300 a day, for customer notifications. SIM 2 “Personal” — sending off: the portal still shows its incoming SMS, but automatic routing never uses it.',
      },
      note: 'A SIM card removed from the phone stays in the list as inactive with its history; it comes back to life when it is inserted again.',
    },
    {
      id: 'send',
      title: 'Sending SMS',
      body: `The [Send](/app/sms/send) section works for one message and for a mailing alike.

- **Recipients** — paste numbers separated by commas, spaces or new lines, or **import** a CSV or TXT file. Each number is checked as you type: valid ones are shown in international format, invalid and duplicate ones are skipped with an explanation. Local numbers get the portal’s default country code.
- **From** — **Auto** (the gateway chooses) or a specific phone and SIM card.
- **Text** — type it or take a **template**. The counter shows characters and **SMS segments**.
- **Schedule** — send now or at a set date and time, up to 90 days ahead.
- **Reference** — your own label, such as an order number. It is kept with each message and returned in the API and webhooks.

Before sending, check the preview and the summary: how many recipients, how many segments in total.`,
      steps: [
        'Paste the numbers or click “Import” and choose a file.',
        'Leave “From” on “Auto” or choose a phone and SIM card.',
        'Write the text or click “Use template”.',
        'If needed, open the advanced options: schedule and reference.',
        'Click “Send” (or “Schedule”) and confirm. You can follow the batch in “Messages”.',
      ],
      example: {
        title: 'Segments and encoding',
        body: `An SMS in Latin letters (GSM-7) holds **160 characters**; longer text is split into parts of 153. A single Cyrillic letter, emoji or special character switches the whole message to Unicode (UCS-2): **70 characters**, or 67 per part.

“Your order is ready” is 1 segment. An 80-character text in Cyrillic, or with a single emoji 🙂, is already 2 segments — and costs as two SMS.`,
      },
    },
    {
      id: 'routing',
      title: 'Automatic routing and limits',
      body: `With “From: Auto” the gateway decides itself which phone and SIM card send each message:

- only phones you are allowed to send from, that are **enabled** and **online**;
- only SIM cards with sending switched on and room left in their **daily limit**;
- of those, the SIM card with the **most room left today** — so the load spreads evenly.

Each phone also has a pace, **messages per minute** (20 by default): a mailing of 1,000 SMS goes out smoothly instead of in one burst that carriers dislike.

If no phone is online, messages wait in the queue. If none comes online within the queue lifetime (24 hours by default), the messages become **expired**.`,
      note: 'Picked a specific SIM card that has reached its daily limit or has sending off? The message will not go out through another SIM — choose “Auto” if any SIM will do.',
    },
    {
      id: 'inbox',
      title: 'Inbox and replies',
      body: `[Inbox](/app/sms/inbox) collects incoming SMS as conversations — one per number, with the full exchange in both directions. Unread conversations are in bold, and the counter in the menu shows how many are waiting.

- Filter by phone or search by number and text.
- Open a conversation and type a reply below — it goes out **from the same SIM card** the last message came to, so the other person sees a familiar number.
- “Mark all as read” clears the counter at once.

If you only have view access to a phone, its conversations are read-only.`,
    },
    {
      id: 'messages',
      title: 'Message history and statuses',
      body: `[Messages](/app/sms/messages) is a table of all incoming and outgoing SMS on your phones. Filter by phone, direction, status group (pending, done, problems) and period, search by number, text or reference, and **export to CSV** what you see.

Click a row to open the message card: full text, phone and SIM, segments, attempts, error code and a **status timeline**.

- **Scheduled** — waiting for its time.
- **Queued** — waiting for a free phone.
- **Dispatched** — passed to the phone.
- **Accepted** — the phone took it.
- **Sent** — left the SIM card.
- **Delivered** — the carrier confirmed delivery.
- **Failed** — the phone or carrier could not send it; the reason is in the card.
- **Cancelled** — you cancelled it before sending.
- **Expired** — no phone took it during the queue lifetime.

A message that is still scheduled or queued can be **cancelled**; a failed or expired one can be **retried**.`,
      note: '“Delivered” depends on the carrier sending a delivery report. Some carriers do not, so a message may stay “Sent” even though it arrived.',
    },
    {
      id: 'templates',
      title: 'Templates',
      body: `[Templates](/app/sms/templates) keep texts you send often: confirmation codes, reminders, greetings. A template is **personal** by default; tick **Shared** to make it available to all your colleagues in the SMS gateway. Only its author (or an SMS administrator) can edit a shared template.

Pick a template in “Send” with “Use template”, or save the text you have just written with “Save as template”.`,
    },
    {
      id: 'sharing',
      title: 'Sharing a phone',
      body: `The phone’s owner can give colleagues, groups or roles access with “Share”:

- **View** — see the phone, its messages and conversations.
- **Edit** — also send SMS through it and reply in conversations.
- **Manage** — also change settings and SIM cards, replace the token, share and delete the phone.

People with the **SMS administrator** permission see and manage every phone on the portal.`,
      example: {
        title: 'Support desk',
        body: 'The office manager adds the support phone and gives the “Support” group **Edit**: everyone on duty answers customers in the Inbox, while only the manager can change limits and the token.',
      },
    },
    {
      id: 'api',
      title: 'API and webhooks',
      body: `Everything you do in the interface is available to other systems. The [API](/app/sms/api) section collects the details:

- Base URL: \`https://<portal>/api/v1/app/sms\`.
- Authorization: a personal token from [Account → API tokens](/account/api) with access to the SMS gateway. A token can be limited to read-only, to specific phones and to IP addresses.
- Ready-made examples: sending an SMS, checking its status, reading the inbox.

**Webhooks** let the portal call your system when something happens: \`sms.received\`, \`sms.sent\`, \`sms.delivered\`, \`sms.failed\`, \`device.online\`, \`device.offline\`. Each call is signed so your system can verify it came from the portal.`,
      example: {
        title: 'Sending from a script',
        body: '`POST /api/v1/app/sms/messages` with `{"to": "+996555123456", "text": "Your code: 4821", "ref": "order-1001"}` — the answer comes at once with the message id and status `queued`; delivery arrives later by webhook `sms.delivered`.',
      },
    },
    {
      id: 'notifications',
      title: 'Notifications',
      body: `The module sends two kinds of notifications:

- **New SMS** — to everyone who can see the phone; a push notification by default.
- **Phone offline** — to the phone’s managers when it has been offline longer than the time set by the administrator (15 minutes by default); in all channels.

Change the channels in [Account → Notifications](/account/notifications).`,
    },
  ],
  faq: [
    {
      q: 'The phone shows “offline” although it is on. What should I check?',
      a: 'Make sure the server link is on in iSMS GW, the phone has internet, and the app is excluded from battery optimisation (on Samsung also from “Sleeping apps”, on Xiaomi allow “Autostart”). The phone’s “Journal” tab shows when and how it disconnected.',
    },
    {
      q: 'A message has been “Queued” for a long time. Why?',
      a: 'There is no phone that can take it: the phones are offline or disabled, or every SIM card has reached its daily limit or has sending off. Once a phone comes online or the limit resets the next day, the message goes out — unless the queue lifetime runs out first.',
    },
    {
      q: 'Why did my message count as several SMS?',
      a: 'Long text is split into segments: 160 Latin characters or 70 Unicode characters fit in one SMS. One Cyrillic letter or emoji switches the whole message to Unicode. The counter under the text shows the exact number.',
    },
    {
      q: 'Can I send through a particular SIM card?',
      a: 'Yes — in “From” choose the phone and the SIM card. Through the API, pass `deviceId` and `simId`.',
    },
    {
      q: 'Will a scheduled message go out if the phone is offline at that moment?',
      a: 'It moves to the queue at the scheduled time and goes out as soon as a suitable phone is online, within the queue lifetime.',
    },
    {
      q: 'I replaced the token and the phone stopped connecting.',
      a: 'That is expected: the old token stops working at once. Enter the new token in iSMS GW → Settings → SMS server, or scan the QR code on the “Connection” tab again.',
    },
    {
      q: 'Can I add a phone if there is no “Add phone” button?',
      a: 'The administrator may have allowed only SMS administrators to add phones, or you have reached the limit of phones per user. Ask the administrator to add the phone and share it with you.',
    },
  ],
  related: ['api', 'notifications', 'account'],
};
