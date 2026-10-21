export default {
  id: 'sms',
  purpose: 'The SMS gateway is the main product of this portal: it turns Android phones running the iSMS GW app into a company SMS service. Employees send and receive SMS from their own SIM cards in the browser, integrations do the same through the API and webhooks, and every message is tracked from the queue to delivery — with no third-party SMS provider and no per-message fees beyond the carrier’s tariff.',
  audience: `- **Phone owners** — add phones, set up SIM cards and limits, share access.
- **Operators and support** — answer customers in the Inbox, send mailings and reminders.
- **Developers** — connect CRM, website, ERP or monitoring through the API and webhooks.
- **SMS administrators** — see every phone and message on the portal for support and audit.`,
  setup: [
    {
      title: 'Turn the module on',
      text: 'In [Settings → Modules → SMS gateway](/admin/settings/sms) make sure the module is enabled. Give the module to the right roles in the menu and access settings if not everyone should see it.',
    },
    {
      title: 'Decide who adds phones',
      text: '“Users may add their own phones” on — everyone connects their own phone, up to the “Max phones per user” limit (20 by default). Off — only SMS administrators add phones and share them with colleagues.',
    },
    {
      title: 'Set the sending defaults',
      text: '**Default country** (KG by default) is added to local numbers; leave it empty to accept only international numbers. **Messages per minute** (20) is the pace for phones without their own value — keep it modest so carriers do not block SIM cards.',
    },
    {
      title: 'Tune the queue',
      text: '**Queue lifetime** (24 h) — how long a message waits for an offline phone before it expires. **Ack timeout** (60 s) and **attempts** (3) — how long to wait for the phone to confirm a message and how many times to retry. **Max recipients** (1,000) and **max text length** (1,600 characters) cap a single request.',
    },
    {
      title: 'Monitoring and retention',
      text: '**Offline alert** (15 min) notifies phone managers when a phone drops out; 0 turns it off. **Retention** (365 days) deletes older messages automatically; 0 keeps them forever.',
    },
    {
      title: 'Connect the first phone',
      text: 'Install iSMS GW on a phone that stays on charge and on the network, exclude it from battery optimisation, then add it in [Phones](/app/sms/devices) and set daily limits on its SIM cards.',
    },
  ],
  roles: {
    'sms.admin': 'Sees and manages every phone, SIM card, message and template on the portal, regardless of who owns them; can add phones even when users are not allowed to. Give it to the people who support the gateway and to auditors — not to every operator.',
  },
  access: `Access to a phone is set by its owner with “Share”, for a person, group, role or everyone:

- **View** — messages and conversations of the phone.
- **Edit** — also sending through it and replying.
- **Manage** — also settings, SIM cards, token replacement, sharing and deletion.

API tokens act with the rights of their owner and can be narrowed further to read-only, to specific phones and to IP addresses. Webhooks deliver only events of the phones their owner can see.`,
  scenarios: [
    {
      title: 'Customer notifications from the CRM',
      text: 'Two office phones with two SIM cards each, daily limit 300 per SIM. The CRM sends order statuses through the API with “Auto” routing; the load spreads across four SIM cards and delivery reports return by the `sms.delivered` webhook.',
    },
    {
      title: 'Support line on SMS',
      text: 'The support phone is shared with the “Support” group with **Edit**: operators answer in the Inbox from the same number, the team lead keeps **Manage**, and everyone gets a push notification on a new SMS.',
    },
    {
      title: 'Monitoring alerts',
      text: 'The monitoring system sends alerts to the duty engineers’ numbers through a token limited to one phone. If that phone goes offline, its managers are notified after 15 minutes and a `device.offline` webhook goes to the monitoring system.',
    },
  ],
  faq: [
    {
      q: 'Does the portal pay for SMS or need a provider contract?',
      a: 'No. Messages are sent by the SIM cards in your phones at your carrier’s tariff. Choose a tariff with an SMS package and check the carrier’s rules for bulk sending.',
    },
    {
      q: 'How do we avoid carrier blocks?',
      a: 'Keep “Messages per minute” low (10–20), set a daily limit on every SIM card, spread mailings across several SIM cards with “Auto” routing and send only to people who agreed to receive messages.',
    },
    {
      q: 'What happens to messages when a phone is offline?',
      a: 'They wait in the queue and go out when a suitable phone reconnects. After the queue lifetime they become “expired” and can be retried manually. Incoming SMS are kept on the phone and delivered to the portal once it reconnects.',
    },
    {
      q: 'An employee left. What do we do with their phone?',
      a: 'An SMS administrator opens the phone, shares **Manage** with the new owner or replaces the token and reconnects the phone. Message history stays on the portal.',
    },
    {
      q: 'Is the connection between the phone and the portal secure?',
      a: 'The phone connects over an encrypted channel with its own token, which is stored on the portal only as a hash and shown once. Replacing the token cuts the old connection at once.',
    },
    {
      q: 'How long are messages kept?',
      a: 'As long as “Retention” says (365 days by default). Older messages are deleted automatically; 0 keeps everything. The phone journal is kept for 30 days.',
    },
  ],
};
