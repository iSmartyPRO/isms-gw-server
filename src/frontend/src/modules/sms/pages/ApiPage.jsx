import { useState } from 'react';
import { Link } from 'react-router-dom';
import { App, Button, Segmented } from 'antd';
import { ApiOutlined, CheckOutlined, CopyOutlined, KeyOutlined, ReadOutlined } from '@ant-design/icons';
import { useLocale } from '../../../context/LocaleContext';
import { useAuth } from '../../../context/AuthContext';
import { can } from '../../../lib/access';
import { Copyable, copyText } from '../components/ui';

function Code({ code }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const [copied, setCopied] = useState(false);
  return (
    <div className="sx-code">
      <Button
        size="small"
        className="sx-code__copy"
        icon={copied ? <CheckOutlined /> : <CopyOutlined />}
        onClick={async () => {
          await copyText(code);
          setCopied(true);
          message.success(t('sms.copied'));
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {t('sms.copy')}
      </Button>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

const SAMPLES = (base) => ({
  send: {
    curl: `curl -X POST ${base}/messages \\
  -H "Authorization: Bearer $SMS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"to": ["+996555123456"], "text": "Your code: 4821", "ref": "order-1001"}'`,
    python: `import os, requests

r = requests.post(
    "${base}/messages",
    headers={"Authorization": f"Bearer {os.environ['SMS_TOKEN']}"},
    json={"to": ["+996555123456"], "text": "Your code: 4821", "ref": "order-1001"},
    timeout=15,
)
r.raise_for_status()
message = r.json()["messages"][0]
print(message["id"], message["status"])`,
    node: `const res = await fetch('${base}/messages', {
  method: 'POST',
  headers: { Authorization: \`Bearer \${process.env.SMS_TOKEN}\`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: ['+996555123456'], text: 'Your code: 4821', ref: 'order-1001' }),
});
const { messages } = await res.json();
console.log(messages[0].id, messages[0].status);`,
    php: `<?php
$ch = curl_init('${base}/messages');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . getenv('SMS_TOKEN'), 'Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode(['to' => ['+996555123456'], 'text' => 'Your code: 4821', 'ref' => 'order-1001']),
]);
$data = json_decode(curl_exec($ch), true);
echo $data['messages'][0]['status'];`,
  },
  status: {
    curl: `curl ${base}/messages/1842 -H "Authorization: Bearer $SMS_TOKEN"`,
    python: `import os, requests

r = requests.get("${base}/messages/1842", headers={"Authorization": f"Bearer {os.environ['SMS_TOKEN']}"})
print(r.json()["message"]["status"])  # queued → … → delivered`,
    node: `const { message } = await (await fetch('${base}/messages/1842', { headers: { Authorization: \`Bearer \${process.env.SMS_TOKEN}\` } })).json();
console.log(message.status); // queued → … → delivered`,
    php: `$ch = curl_init('${base}/messages/1842');
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . getenv('SMS_TOKEN')]]);
echo json_decode(curl_exec($ch), true)['message']['status'];`,
  },
  inbox: {
    curl: `# Incoming newer than the last id you processed (ascending order)
curl "${base}/messages?direction=in&sinceId=0&limit=100" -H "Authorization: Bearer $SMS_TOKEN"`,
    python: `import os, time, requests

last_id = 0
while True:
    r = requests.get("${base}/messages", params={"direction": "in", "sinceId": last_id, "limit": 100},
                     headers={"Authorization": f"Bearer {os.environ['SMS_TOKEN']}"})
    for m in r.json()["messages"]:
        print(m["phone"], m["text"])
        last_id = m["id"]
    time.sleep(10)`,
    node: `let lastId = 0;
setInterval(async () => {
  const url = '${base}/messages?direction=in&limit=100&sinceId=' + lastId;
  const { messages } = await (await fetch(url, { headers: { Authorization: \`Bearer \${process.env.SMS_TOKEN}\` } })).json();
  for (const m of messages) { console.log(m.phone, m.text); lastId = m.id; }
}, 10000);`,
    php: `$url = '${base}/messages?direction=in&limit=100&sinceId=' . $lastId;
$ch = curl_init($url);
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . getenv('SMS_TOKEN')]]);
foreach (json_decode(curl_exec($ch), true)['messages'] as $m) { echo $m['phone'], ': ', $m['text'], PHP_EOL; $lastId = $m['id']; }`,
  },
  webhook: {
    node: `import crypto from 'node:crypto';
// X-Portal-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>
function verify(rawBody, header, secret) {
  const { t, v1 } = Object.fromEntries(String(header || '').split(',').map((p) => p.split('=', 2)));
  const expected = crypto.createHmac('sha256', secret).update(\`\${t}.\${rawBody}\`).digest();
  const given = Buffer.from(String(v1 || ''), 'hex');
  return Math.abs(Date.now() / 1000 - Number(t)) < 300 && given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
// event.type: sms.received | sms.sent | sms.delivered | sms.failed | device.online | device.offline`,
    python: `import hmac, hashlib, time

def verify(raw_body: bytes, header: str, secret: str) -> bool:
    parts = dict(p.split("=", 1) for p in header.split(","))
    expected = hmac.new(secret.encode(), f"{parts['t']}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return abs(time.time() - int(parts["t"])) < 300 and hmac.compare_digest(expected, parts.get("v1", ""))`,
    php: `function verify(string $raw, string $header, string $secret): bool {
  parse_str(str_replace(',', '&', $header), $p);
  $expected = hash_hmac('sha256', $p['t'] . '.' . $raw, $secret);
  return abs(time() - (int)$p['t']) < 300 && hash_equals($expected, $p['v1'] ?? '');
}`,
    curl: `# Webhooks are created in Administration → API → Webhooks.
# Events: sms.received, sms.sent, sms.delivered, sms.failed, device.online, device.offline`,
  },
});

const EVENTS = ['sms.received', 'sms.sent', 'sms.delivered', 'sms.failed', 'device.online', 'device.offline'];

export default function ApiPage() {
  const { t } = useLocale();
  const { user } = useAuth();
  const [lang, setLang] = useState('curl');
  const [sample, setSample] = useState('send');
  const base = `${window.location.origin}/api/v1/app/sms`;
  const samples = SAMPLES(base);
  const canTokens = can(user, 'api.tokens') || can(user, 'api.admin');
  const canAdmin = can(user, 'api.admin');

  return (
    <div className="sx-page">
      <section className="sx-api-hero">
        <div>
          <span className="sx-eyebrow">REST · JSON · Webhooks</span>
          <h1>{t('sms.api.title')}</h1>
          <p>{t('sms.api.lead')}</p>
          <div className="sx-api-hero__actions">
            {canTokens ? (
              <Link to="/account/api">
                <Button type="primary" size="large" icon={<KeyOutlined />}>
                  {t('sms.api.createToken')}
                </Button>
              </Link>
            ) : (
              <span className="sx-hint">{t('sms.api.askAdmin')}</span>
            )}
            <Link to="/developers">
              <Button size="large" icon={<ReadOutlined />}>
                {t('sms.api.reference')}
              </Button>
            </Link>
          </div>
        </div>
        <div className="sx-api-hero__base">
          <Copyable label={t('sms.api.baseUrl')} value={base} />
          <ul className="sx-checks">
            <li>{t('sms.api.points.auth')}</li>
            <li>{t('sms.api.points.scope')}</li>
            <li>{t('sms.api.points.limit')}</li>
            <li>{t('sms.api.points.ip')}</li>
          </ul>
        </div>
      </section>

      <section className="sx-card sx-quick-token">
        <header className="sx-card__head">
          <div>
            <h2>{t('sms.api.quickTitle')}</h2>
            <p>{t('sms.api.quickLead')}</p>
          </div>
        </header>
        <ol className="sx-connect__steps">
          <li>{t('sms.api.quickSteps.phone')}</li>
          <li>{t('sms.api.quickSteps.sim')}</li>
          <li>{t('sms.api.quickSteps.give')}</li>
        </ol>
        <Link to="/app/sms/devices">
          <Button icon={<KeyOutlined />}>{t('sms.api.quickOpen')}</Button>
        </Link>
      </section>

      <section className="sx-card">
        <header className="sx-card__head">
          <div>
            <h2>{t('sms.api.examples')}</h2>
            <p>{t('sms.api.examplesLead')}</p>
          </div>
        </header>
        <div className="sx-code-tabs">
          <Segmented
            value={sample}
            onChange={setSample}
            options={[
              { value: 'send', label: t('sms.api.samples.send') },
              { value: 'status', label: t('sms.api.samples.status') },
              { value: 'inbox', label: t('sms.api.samples.inbox') },
              { value: 'webhook', label: t('sms.api.samples.webhook') },
            ]}
          />
          <Segmented
            value={lang}
            onChange={setLang}
            options={[
              { value: 'curl', label: 'cURL' },
              { value: 'python', label: 'Python' },
              { value: 'node', label: 'Node.js' },
              { value: 'php', label: 'PHP' },
            ]}
          />
        </div>
        <Code code={samples[sample][lang]} />
      </section>

      <div className="sx-grid-2 is-even">
        <section className="sx-card">
          <header className="sx-card__head">
            <div>
              <h2>{t('sms.api.webhooks')}</h2>
              <p>{t('sms.api.webhooksLead')}</p>
            </div>
          </header>
          <ul className="sx-events">
            {EVENTS.map((event) => (
              <li key={event}>
                <code>{event}</code>
                <span>{t(`sms.api.events.${event.replace('.', '_')}`)}</span>
              </li>
            ))}
          </ul>
          {canAdmin && (
            <Link to="/admin/api">
              <Button icon={<ApiOutlined />}>{t('sms.api.manageWebhooks')}</Button>
            </Link>
          )}
        </section>
        <section className="sx-card">
          <header className="sx-card__head">
            <div>
              <h2>{t('sms.api.statuses')}</h2>
              <p>{t('sms.api.statusesLead')}</p>
            </div>
          </header>
          <ol className="sx-flow">
            {['queued', 'dispatched', 'accepted', 'sent', 'delivered'].map((status) => (
              <li key={status}>
                <code>{status}</code>
                <span>{t(`sms.api.flow.${status}`)}</span>
              </li>
            ))}
          </ol>
          <p className="sx-hint">{t('sms.api.flowEnd')}</p>
        </section>
      </div>
    </div>
  );
}
