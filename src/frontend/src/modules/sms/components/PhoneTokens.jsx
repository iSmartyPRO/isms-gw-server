import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Empty as AntEmpty, Form, Input, Modal, Segmented, Select, Skeleton, Tag, Tooltip } from 'antd';
import { CheckOutlined, CopyOutlined, DownloadOutlined, KeyOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import { useLocale } from '../../../context/LocaleContext';
import { errorMessage } from '../../../lib/errors';
import { formatDateTime } from '../../../lib/format';
import { smsApi } from '../api';
import { Ago, Copyable, SimCard, copyText } from './ui';

/*
 * API tokens of one phone (DeviceDetail → «API»): a list with revoke, and a
 * two-step dialog — choose the SIM, expiry and addresses → the token, shown
 * once, with a short guide for developers prefilled with this phone and SIM.
 */

const EXPIRY = [0, 30, 90, 180, 365];

/** Code samples prefilled with the base URL, phone and SIM. The token stays a variable. */
export function guideSamples({ base, deviceId, simId }) {
  // One payload, written in each language's syntax: the SIM when the token has one, else the phone.
  const [key, value] = simId ? ['simId', simId] : ['deviceId', deviceId];
  const body = `{"to": ["+996555123456"], "text": "Your code: 4821", "${key}": ${value}}`;
  const pyBody = body;
  const jsBody = `{ to: ['+996555123456'], text: 'Your code: 4821', ${key}: ${value} }`;
  const phpBody = `['to' => ['+996555123456'], 'text' => 'Your code: 4821', '${key}' => ${value}]`;
  return {
    curl: `# Send
curl -X POST ${base}/messages \\
  -H "Authorization: Bearer $SMS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${body}'

# Status of a message (id from the answer)
curl ${base}/messages/1842 -H "Authorization: Bearer $SMS_TOKEN"

# Incoming messages newer than the last id you processed
curl "${base}/messages?direction=in&sinceId=0&limit=100" -H "Authorization: Bearer $SMS_TOKEN"`,
    python: `import os, requests

BASE = "${base}"
HEADERS = {"Authorization": f"Bearer {os.environ['SMS_TOKEN']}"}

# Send
r = requests.post(f"{BASE}/messages", headers=HEADERS, json=${pyBody}, timeout=15)
r.raise_for_status()
message = r.json()["messages"][0]
print(message["id"], message["status"])

# Status: queued → dispatched → accepted → sent → delivered (or failed)
print(requests.get(f"{BASE}/messages/{message['id']}", headers=HEADERS).json()["message"]["status"])`,
    node: `const BASE = '${base}';
const headers = { Authorization: \`Bearer \${process.env.SMS_TOKEN}\`, 'Content-Type': 'application/json' };

// Send
const res = await fetch(\`\${BASE}/messages\`, { method: 'POST', headers, body: JSON.stringify(${jsBody}) });
const { messages } = await res.json();
console.log(messages[0].id, messages[0].status);

// Status: queued → dispatched → accepted → sent → delivered (or failed)
const { message } = await (await fetch(\`\${BASE}/messages/\${messages[0].id}\`, { headers })).json();
console.log(message.status);`,
    php: `<?php
$base = '${base}';
$headers = ['Authorization: Bearer ' . getenv('SMS_TOKEN'), 'Content-Type: application/json'];

// Send
$ch = curl_init("$base/messages");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => $headers,
  CURLOPT_POSTFIELDS => json_encode(${phpBody}),
]);
$data = json_decode(curl_exec($ch), true);
echo $data['messages'][0]['id'], ' ', $data['messages'][0]['status'], PHP_EOL;`,
  };
}

/** The guide as a Markdown file for developers (without the token itself). */
function guideMarkdown({ t, base, device, sim, token, samples }) {
  const lines = [
    `# ${t('sms.tokens.guide.fileTitle', { phone: device.name })}`,
    '',
    `- ${t('sms.tokens.guide.baseUrl')}: \`${base}\``,
    `- ${t('sms.tokens.guide.auth')}: \`Authorization: Bearer <token>\` (${t('sms.tokens.guide.tokenPrefix')} \`${token.prefix}_…\`)`,
    `- ${t('sms.tokens.guide.phone')}: ${device.name} (deviceId = ${device.id})`,
    sim ? `- ${t('sms.tokens.guide.sim')}: ${sim.label || sim.phoneLabel || sim.carrier || `SIM ${sim.slot}`}${sim.number ? ` ${sim.number}` : ''} (simId = ${sim.id})` : `- ${t('sms.tokens.guide.anySim')}`,
    token.expiresAt ? `- ${t('sms.tokens.guide.expires')}: ${new Date(token.expiresAt).toISOString().slice(0, 10)}` : '',
    '',
    `## ${t('sms.tokens.guide.can')}`,
    '',
    ...t('sms.tokens.guide.canList').split('\n').map((line) => `- ${line}`),
    '',
    `## cURL`,
    '',
    '```bash',
    samples.curl,
    '```',
    '',
    '## Python',
    '',
    '```python',
    samples.python,
    '```',
    '',
    '## Node.js',
    '',
    '```js',
    samples.node,
    '```',
    '',
    '## PHP',
    '',
    '```php',
    samples.php,
    '```',
    '',
    `## ${t('sms.tokens.guide.statusesTitle')}`,
    '',
    t('sms.tokens.guide.statuses'),
    '',
    `## ${t('sms.tokens.guide.errorsTitle')}`,
    '',
    ...t('sms.tokens.guide.errors').split('\n').map((line) => `- ${line}`),
    '',
    `${t('sms.tokens.guide.reference')}: ${window.location.origin}/developers`,
    '',
  ];
  return lines.filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n');
}

function Code({ code }) {
  const { t } = useLocale();
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

/** The developer guide shown right after a token is made. */
function Guide({ device, sim, created }) {
  const { t } = useLocale();
  const [lang, setLang] = useState('curl');
  const base = `${window.location.origin}/api/v1/app/sms`;
  const samples = useMemo(() => guideSamples({ base, deviceId: device.id, simId: sim?.id }), [base, device.id, sim]);
  const download = () => {
    const text = guideMarkdown({ t, base, device, sim, token: created.token, samples });
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `sms-api-${device.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}${sim ? `-sim${sim.slot}` : ''}.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="sx-guide">
      <div className="sx-wizard__note">
        <KeyOutlined />
        <span>{t('sms.tokens.once')}</span>
      </div>
      <Copyable label={t('sms.tokens.token')} value={created.secret} />
      <div className="sx-guide__facts">
        <div>
          <span>{t('sms.tokens.guide.baseUrl')}</span>
          <code>{base}</code>
        </div>
        <div>
          <span>{t('sms.tokens.guide.phone')}</span>
          <code>deviceId = {device.id}</code>
        </div>
        <div>
          <span>{t('sms.tokens.guide.sim')}</span>
          <code>{sim ? `simId = ${sim.id}` : t('sms.tokens.anySim')}</code>
        </div>
      </div>
      <ul className="sx-checks">
        {t('sms.tokens.guide.canList')
          .split('\n')
          .map((line) => (
            <li key={line}>{line}</li>
          ))}
      </ul>
      <div className="sx-code-tabs">
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
        <Button icon={<DownloadOutlined />} onClick={download}>
          {t('sms.tokens.download')}
        </Button>
      </div>
      <Code code={samples[lang]} />
      <p className="sx-hint">{t('sms.tokens.guide.hint')}</p>
    </div>
  );
}

export function CreateTokenDialog({ open, device, presetSimId = null, maxDays = 0, onClose }) {
  const { t } = useLocale();
  // The API console's longest lifetime: longer choices and «no expiry» are not offered.
  const choices = EXPIRY.filter((days) => (maxDays ? days && days <= maxDays : true)).concat(maxDays && !EXPIRY.includes(maxDays) ? [maxDays] : []).sort((a, b) => (a || Infinity) - (b || Infinity));
  const defaultDays = choices.includes(365) ? 365 : choices[choices.length - 1];
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [simId, setSimId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const sims = device.sims.filter((sim) => sim.active);

  useEffect(() => {
    if (!open) return;
    setCreated(null);
    setSimId(presetSimId);
    form.resetFields();
  }, [open, presetSimId, form]);

  const sim = sims.find((item) => item.id === simId) || null;

  const create = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const { data } = await smsApi.createPhoneToken(device.id, {
        name: values.name,
        simId: simId || undefined,
        expiresDays: values.expiresDays,
        ipAllow: String(values.ipAllow || '')
          .split(/[\s,;]+/)
          .filter(Boolean),
      });
      setCreated(data);
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={() => onClose(Boolean(created))}
      width={created ? 820 : 640}
      className="sx-wizard"
      destroyOnClose
      maskClosable={!created}
      keyboard={!created}
      title={created ? t('sms.tokens.createdTitle') : t('sms.tokens.newTitle', { phone: device.name })}
      footer={
        created ? (
          <Button type="primary" onClick={() => onClose(true)}>
            {t('sms.tokens.done')}
          </Button>
        ) : (
          <>
            <Button onClick={() => onClose(false)}>{t('sms.cancel')}</Button>
            <Button type="primary" icon={<KeyOutlined />} loading={saving} onClick={create}>
              {t('sms.tokens.create')}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <Guide device={device} sim={sim} created={created} />
      ) : (
        <div className="sx-stack">
          <p className="sx-muted">{t('sms.tokens.lead')}</p>
          <div className="sx-field">
            <label className="sx-field__label">{t('sms.tokens.simLabel')}</label>
            <div className="sx-sim-picker">
              <button type="button" className={`sx-sim-picker__auto${simId ? '' : ' is-selected'}`} onClick={() => setSimId(null)}>
                <KeyOutlined />
                <span>{t('sms.tokens.anySim')}</span>
              </button>
              {sims.map((item) => (
                <SimCard key={item.id} sim={item} size="sm" selected={simId === item.id} onClick={() => setSimId(item.id)} />
              ))}
            </div>
            <p className="sx-hint">{simId ? t('sms.tokens.simOnlyHint') : t('sms.tokens.anySimHint')}</p>
          </div>
          <Form form={form} layout="vertical" requiredMark={false} initialValues={{ expiresDays: defaultDays }}>
            <Form.Item name="name" label={t('sms.tokens.name')} extra={t('sms.tokens.nameHint')}>
              <Input maxLength={120} placeholder={`SMS · ${device.name}${sim ? ` · ${sim.label || sim.phoneLabel || sim.carrier || `SIM ${sim.slot}`}` : ''}`} />
            </Form.Item>
            <div className="form-grid-2">
              <Form.Item name="expiresDays" label={t('sms.tokens.expires')}>
                <Select options={choices.map((days) => ({ value: days, label: days ? t('sms.tokens.days', { count: days }) : t('sms.tokens.never') }))} />
              </Form.Item>
              <Form.Item name="ipAllow" label={t('sms.tokens.ipAllow')} extra={t('sms.tokens.ipAllowHint')}>
                <Input placeholder="203.0.113.10, 10.0.0.0/8" />
              </Form.Item>
            </div>
          </Form>
        </div>
      )}
    </Modal>
  );
}

/** The «API» tab of a phone. */
export default function PhoneTokens({ device, presetSimId = null, maxDays = 0, onPresetUsed }) {
  const { t, locale } = useLocale();
  const { message, modal } = App.useApp();
  const [tokens, setTokens] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    smsApi
      .phoneTokens(device.id)
      .then(({ data }) => setTokens(data.tokens))
      .catch((err) => {
        message.error(errorMessage(err));
        setTokens([]);
      });
  }, [device.id, message]);

  useEffect(load, [load]);

  // «API token for this SIM» on a SIM card opens the dialog with the SIM chosen.
  useEffect(() => {
    if (presetSimId) setCreating(true);
  }, [presetSimId]);

  const revoke = (token) =>
    modal.confirm({
      title: t('sms.tokens.revokeTitle', { name: token.name }),
      content: t('sms.tokens.revokeText'),
      okText: t('sms.tokens.revoke'),
      okButtonProps: { danger: true },
      cancelText: t('sms.cancel'),
      onOk: async () => {
        try {
          await smsApi.revokePhoneToken(device.id, token.id);
          load();
        } catch (err) {
          message.error(errorMessage(err));
        }
      },
    });

  return (
    <div className="sx-stack">
      <div className="sx-banner">
        <KeyOutlined />
        <span>{t('sms.tokens.intro')}</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          {t('sms.tokens.create')}
        </Button>
      </div>
      {tokens === null ? (
        <Skeleton active />
      ) : tokens.length === 0 ? (
        <AntEmpty description={t('sms.tokens.empty')} />
      ) : (
        <ul className="sx-tokens">
          {tokens.map((token) => (
            <li key={token.id} className={`sx-token is-${token.state}`}>
              <div className="sx-token__main">
                <strong>{token.name}</strong>
                <span className="sx-muted">
                  <code>{token.prefix}_…</code> ·{' '}
                  {token.sims?.length
                    ? token.sims.map((sim) => (sim.gone ? t('sms.tokens.simGone', { id: sim.id }) : `${sim.name}${sim.number ? ` ${sim.number}` : ''}`)).join(', ')
                    : t('sms.tokens.anySim')}
                  {token.phonesCount > 1 ? ` · ${t('sms.tokens.morePhones', { count: token.phonesCount - 1 })}` : ''}
                  {!token.mine ? ` · ${token.owner.name}` : ''}
                </span>
                <span className="sx-muted sx-small">
                  {token.lastUsedAt ? (
                    <>
                      {t('sms.tokens.lastUsed')} <Ago value={token.lastUsedAt} />
                      {token.lastIp ? ` · ${token.lastIp}` : ''}
                    </>
                  ) : (
                    t('sms.tokens.neverUsed')
                  )}
                  {' · '}
                  {token.expiresAt ? t('sms.tokens.until', { date: formatDateTime(token.expiresAt, locale, { dateStyle: 'medium' }) }) : t('sms.tokens.noExpiry')}
                  {token.ipAllow.length ? ` · IP: ${token.ipAllow.join(', ')}` : ''}
                </span>
              </div>
              <Tag color={token.state === 'active' ? 'green' : token.state === 'expired' ? 'orange' : 'default'}>{t(`sms.tokens.state.${token.state}`)}</Tag>
              {token.state === 'active' && (
                <Tooltip title={t('sms.tokens.revoke')}>
                  <Button danger type="text" icon={<StopOutlined />} onClick={() => revoke(token)} aria-label={t('sms.tokens.revoke')} />
                </Tooltip>
              )}
            </li>
          ))}
        </ul>
      )}
      <CreateTokenDialog
        open={creating}
        device={device}
        presetSimId={presetSimId}
        maxDays={maxDays}
        onClose={(made) => {
          setCreating(false);
          onPresetUsed?.();
          if (made) load();
        }}
      />
    </div>
  );
}
