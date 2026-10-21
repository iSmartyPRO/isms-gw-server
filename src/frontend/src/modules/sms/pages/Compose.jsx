import { useEffect, useRef, useState } from 'react';
import { SendOutlined, SnippetsOutlined, ThunderboltOutlined, UploadOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { App, Button, Collapse, DatePicker, Dropdown, Input, Progress, Select, Switch, Tag, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { useLocale } from '../../../context/LocaleContext';
import { MenuIcon } from '../../../components/icons/menuIcons';
import { errorMessage } from '../../../lib/errors';
import { formatNumber } from '../../../lib/format';
import { nonGsmChars, smsApi, smsSegments } from '../api';
import { useSms } from '../SmsContext';
import { Empty, OnlineDot, SimCard, StatusTag, prettyPhone } from '../components/ui';

function SegmentMeter({ text }) {
  const { t, locale } = useLocale();
  const info = smsSegments(text);
  const unicode = nonGsmChars(text);
  const share = info.parts ? Math.min(100, ((info.parts * info.perPart - info.remaining) / (info.parts * info.perPart)) * 100) : 0;
  return (
    <div className="sx-meter">
      <div className="sx-meter__bar">
        <i style={{ width: `${share}%` }} />
      </div>
      <div className="sx-meter__row">
        <Tooltip title={info.encoding === 'GSM-7' ? t('sms.compose.gsmHint') : t('sms.compose.ucsHint')}>
          <span className={`sx-meter__enc is-${info.encoding === 'GSM-7' ? 'gsm' : 'ucs'}`}>{info.encoding}</span>
        </Tooltip>
        <span>{t('sms.compose.chars', { count: info.length })}</span>
        <span>
          <b>{formatNumber(info.parts, locale)}</b> {t('sms.compose.partsLabel', { count: info.parts })}
        </span>
        <span className="sx-meter__left">{t('sms.compose.left', { count: info.remaining })}</span>
      </div>
      {unicode.length > 0 && info.encoding === 'UCS-2' && text.length > 0 && (
        <p className="sx-meter__note">
          {t('sms.compose.unicodeBecause')}{' '}
          {unicode.slice(0, 8).map((char) => (
            <code key={char}>{char === ' ' ? '␣' : char}</code>
          ))}
        </p>
      )}
    </div>
  );
}

function PhonePreview({ text, sender, recipients }) {
  const { t } = useLocale();
  return (
    <div className="sx-preview" aria-label={t('sms.compose.preview')}>
      <div className="sx-preview__device">
        <div className="sx-preview__notch" />
        <div className="sx-preview__bar">
          <span>9:41</span>
          <span className="sx-preview__icons">
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="sx-preview__head">
          <span className="sx-preview__avatar">{(recipients[0] || '?').replace(/\D/g, '').slice(-2) || '#'}</span>
          <strong>{recipients[0] ? prettyPhone(recipients[0]) : t('sms.compose.previewNobody')}</strong>
          {recipients.length > 1 && <span>{t('sms.compose.andMore', { count: recipients.length - 1 })}</span>}
        </div>
        <div className="sx-preview__chat">
          {text ? <div className="sx-bubble is-out">{text}</div> : <div className="sx-preview__placeholder">{t('sms.compose.previewEmpty')}</div>}
        </div>
        <div className="sx-preview__from">{sender}</div>
      </div>
    </div>
  );
}

const FINAL = ['delivered', 'failed', 'cancelled', 'expired'];

function Tracker({ result, onReset }) {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [messages, setMessages] = useState(result.messages);
  const settled = messages.every((message) => FINAL.includes(message.status));
  useEffect(() => {
    if (settled) return undefined;
    let alive = true;
    const ids = result.messages.map((message) => message.id);
    const timer = setInterval(async () => {
      try {
        let list = [];
        if (result.batchId) {
          // A batch can be larger than one page (200): walk the pages.
          let before = null;
          do {
            const { data } = await smsApi.messages({ batchId: result.batchId, limit: 200, before: before || undefined });
            list = list.concat(data.messages);
            before = data.next;
          } while (before && alive);
        } else {
          list = [(await smsApi.message(ids[0])).data.message];
        }
        if (!alive) return;
        const byId = new Map(list.map((message) => [message.id, message]));
        setMessages((current) => current.map((message) => byId.get(message.id) || message));
      } catch {
        /* keep the last known statuses */
      }
    }, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [result, settled]);
  const count = (statuses) => messages.filter((message) => statuses.includes(message.status)).length;
  const done = count(['sent', 'delivered']);
  const failed = count(['failed', 'expired', 'cancelled']);
  const delivered = count(['delivered']);
  const total = messages.length;
  const scheduled = count(['scheduled']);
  return (
    <section className="sx-card sx-tracker">
      <div className="sx-tracker__head">
        <div className="sx-done-badge is-small">
          <MenuIcon name={failed === total ? 'alert' : 'check'} />
        </div>
        <div>
          <h2>{scheduled === total ? t('sms.compose.scheduledTitle', { count: total }) : t('sms.compose.queuedTitle', { count: total })}</h2>
          <p>{t('sms.compose.trackerLead')}</p>
        </div>
      </div>
      {scheduled !== total && (
        <Progress
          percent={total ? Math.round(((done + failed) / total) * 100) : 0}
          success={{ percent: total ? Math.round((delivered / total) * 100) : 0 }}
          strokeColor="var(--sx-sent)"
          format={() => `${formatNumber(done, locale)} / ${formatNumber(total, locale)}`}
        />
      )}
      <ul className="sx-tracker__list">
        {messages.slice(0, 50).map((message) => (
          <li key={message.id}>
            <span>{prettyPhone(message.phone)}</span>
            <span className="sx-muted">{message.deviceName}{message.simLabel ? ` · ${message.simLabel}` : ''}</span>
            <StatusTag status={message.status} compact />
          </li>
        ))}
      </ul>
      {result.invalid?.length > 0 && (
        <p className="sx-warn">
          {t('sms.compose.skipped', { count: result.invalid.length })}: {result.invalid.slice(0, 10).map((item) => item.input).join(', ')}
        </p>
      )}
      <div className="sx-tracker__actions">
        <Button type="primary" onClick={onReset}>
          {t('sms.compose.another')}
        </Button>
        {result.batchId ? (
          <Button onClick={() => navigate(`/app/sms/messages?batchId=${result.batchId}`)}>{t('sms.compose.openBatch')}</Button>
        ) : (
          <Button onClick={() => navigate(`/app/sms/inbox?device=${messages[0]?.deviceId}&phone=${encodeURIComponent(messages[0]?.phone || '')}`)}>{t('sms.compose.openThread')}</Button>
        )}
      </div>
    </section>
  );
}

export default function Compose() {
  const { t, locale } = useLocale();
  const { message, modal } = App.useApp();
  const [params] = useSearchParams();
  const { senders, config, loaded } = useSms();
  const [to, setTo] = useState(params.get('to') || '');
  const [text, setText] = useState(params.get('text') || '');
  const [deviceId, setDeviceId] = useState(params.get('device') ? Number(params.get('device')) : 'auto');
  const [simId, setSimId] = useState(null);
  const [schedule, setSchedule] = useState(false);
  const [sendAt, setSendAt] = useState(null);
  const [ref, setRef] = useState('');
  const [check, setCheck] = useState({ valid: [], invalid: [] });
  const [checking, setChecking] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const fileInput = useRef(null);

  useEffect(() => {
    smsApi
      .templates()
      .then(({ data }) => setTemplates(data.templates))
      .catch(() => {});
  }, []);

  // Numbers are checked on the server (libphonenumber, default country) a moment after typing stops.
  useEffect(() => {
    if (!to.trim()) {
      setCheck({ valid: [], invalid: [] });
      setChecking(false);
      return undefined;
    }
    let alive = true;
    setChecking(true);
    const timer = setTimeout(() => {
      smsApi
        .numbers(to)
        .then(({ data }) => alive && setCheck(data))
        .catch(() => {})
        .finally(() => alive && setChecking(false));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [to]);

  const device = deviceId === 'auto' ? null : senders.find((item) => item.id === deviceId);
  const sims = device ? device.sims.filter((sim) => sim.active) : [];
  const info = smsSegments(text);
  const totalParts = info.parts * check.valid.length;
  const senderLabel = device ? `${device.name}${simId ? ` · ${sims.find((sim) => sim.id === simId)?.label || sims.find((sim) => sim.id === simId)?.carrier || ''}` : ''}` : t('sms.compose.auto');
  const maxLength = config?.maxTextLength || 1600;

  const readFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const numbers = String(reader.result || '')
        .split(/[\n,;\t]+/)
        .map((item) => item.replace(/["']/g, '').trim())
        .filter((item) => /\d{3,}/.test(item));
      setTo((value) => [value.trim(), ...numbers].filter(Boolean).join('\n'));
      message.success(t('sms.compose.imported', { count: numbers.length }));
    };
    reader.readAsText(file);
  };

  const submit = async () => {
    if (schedule && (!sendAt || !sendAt.isAfter(dayjs()))) {
      message.error(t('sms.compose.pastTime'));
      return;
    }
    const payload = {
      to: check.valid,
      text,
      deviceId: device ? device.id : undefined,
      simId: simId || undefined,
      sendAt: schedule && sendAt ? sendAt.toISOString() : undefined,
      ref: ref || undefined,
    };
    setSending(true);
    try {
      const { data } = await smsApi.send(payload);
      setResult(data);
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const confirm = () => {
    if (check.valid.length <= 1) return submit();
    return modal.confirm({
      title: t('sms.compose.confirmTitle', { count: check.valid.length }),
      content: t('sms.compose.confirmText', { parts: totalParts, sender: senderLabel }),
      okText: t('sms.compose.send'),
      cancelText: t('sms.cancel'),
      onOk: submit,
    });
  };

  const saveTemplate = () => {
    let name = '';
    modal.confirm({
      title: t('sms.templates.saveAs'),
      icon: null,
      content: <Input autoFocus maxLength={120} placeholder={t('sms.templates.name')} onChange={(event) => (name = event.target.value)} />,
      okText: t('sms.save'),
      cancelText: t('sms.cancel'),
      onOk: async () => {
        if (!name.trim()) {
          message.error(t('sms.templates.nameRequired'));
          throw new Error('name');
        }
        try {
          const { data } = await smsApi.createTemplate({ name, text });
          setTemplates((list) => [...list, data.template]);
          message.success(t('sms.saved'));
        } catch (err) {
          message.error(errorMessage(err));
          throw err;
        }
      },
    });
  };

  if (!loaded) return null;
  if (!senders.length) {
    return (
      <Empty
        icon="smartphone"
        title={t('sms.compose.noDevicesTitle')}
        text={t('sms.compose.noDevicesText')}
        action={
          config?.canAddDevices && (
            <Link to="/app/sms/devices?add=1">
              <Button type="primary" size="large">
                {t('sms.devices.add')}
              </Button>
            </Link>
          )
        }
      />
    );
  }

  if (result) {
    return (
      <div className="sx-page sx-compose">
        <Tracker
          result={result}
          onReset={() => {
            setResult(null);
            setTo('');
            setText('');
            setSchedule(false);
            setSendAt(null);
          }}
        />
      </div>
    );
  }

  const pastTime = schedule && sendAt && !sendAt.isAfter(dayjs().add(1, 'minute'));
  const canSend = !checking && check.valid.length > 0 && text.trim().length > 0 && text.length <= maxLength && (!schedule || (sendAt && !pastTime));

  return (
    <div className="sx-page sx-compose">
      <header className="mod-hero" style={{ '--c': '#00A3E0' }}>
        <span className="mod-hero__badge">
          <MenuIcon name="send" />
        </span>
        <div className="mod-hero__text">
          <h1>{t('sms.compose.title')}</h1>
          <p>{t('sms.compose.lead')}</p>
        </div>
      </header>
      <div className="sx-compose__grid">
        <div className="sx-compose__form">
          <section className="sx-field" data-tour="sms.from">
            <label className="sx-field__label">{t('sms.compose.from')}</label>
            <Select
              size="large"
              value={deviceId}
              onChange={(value) => {
                setDeviceId(value);
                setSimId(null);
              }}
              style={{ width: '100%' }}
              options={[
                { value: 'auto', label: <span className="sx-option"><ThunderboltOutlined /> {t('sms.compose.auto')}<span className="sx-muted"> — {t('sms.compose.autoHint')}</span></span> },
                ...senders.map((item) => ({
                  value: item.id,
                  label: (
                    <span className="sx-option">
                      <OnlineDot online={item.online} pulse={false} /> {item.name}
                      <span className="sx-muted"> · {item.online ? t('sms.device.online') : t('sms.device.offline')}</span>
                    </span>
                  ),
                })),
              ]}
            />
            {device && sims.length > 1 && (
              <div className="sx-sim-picker">
                <button type="button" className={`sx-sim-picker__auto${simId ? '' : ' is-selected'}`} onClick={() => setSimId(null)}>
                  <ThunderboltOutlined />
                  <span>{t('sms.compose.anySim')}</span>
                </button>
                {sims.map((sim) => (
                  <SimCard key={sim.id} sim={sim} size="sm" selected={simId === sim.id} onClick={() => setSimId(sim.id)} />
                ))}
              </div>
            )}
            {device && !device.online && <p className="sx-hint is-warning">{t('sms.compose.offlineNote')}</p>}
          </section>

          <section className="sx-field" data-tour="sms.to">
            <div className="sx-field__row">
              <label className="sx-field__label" htmlFor="sx-to">
                {t('sms.compose.to')}
              </label>
              <Button size="small" type="link" onClick={() => fileInput.current?.click()} icon={<UploadOutlined />}>
                {t('sms.compose.import')}
              </Button>
              <input ref={fileInput} type="file" accept=".csv,.txt,text/plain,text/csv" hidden onChange={(event) => {
                  if (event.target.files?.[0]) readFile(event.target.files[0]);
                  event.target.value = '';
                }}
              />
            </div>
            <Input.TextArea id="sx-to" value={to} onChange={(event) => setTo(event.target.value)} autoSize={{ minRows: 2, maxRows: 8 }} placeholder={t('sms.compose.toPlaceholder', { country: config?.defaultCountry || '—' })} className="sx-mono" />
            <div className="sx-recipients">
              {check.valid.length > 0 && <Tag color="green">{t('sms.compose.valid', { count: check.valid.length })}</Tag>}
              {check.invalid.length > 0 && (
                <Tooltip title={check.invalid.map((item) => `${item.input} — ${t(`sms.compose.reasons.${item.reason}`)}`).join('\n')}>
                  <Tag color="red">{t('sms.compose.invalid', { count: check.invalid.length })}</Tag>
                </Tooltip>
              )}
              {check.valid.slice(0, 6).map((phone) => (
                <span key={phone} className="sx-chip">
                  {prettyPhone(phone)}
                </span>
              ))}
              {check.valid.length > 6 && <span className="sx-chip is-more">+{formatNumber(check.valid.length - 6, locale)}</span>}
            </div>
          </section>

          <section className="sx-field" data-tour="sms.text">
            <div className="sx-field__row">
              <label className="sx-field__label" htmlFor="sx-text">
                {t('sms.compose.text')}
              </label>
              {templates.length > 0 && (
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: templates.map((template) => ({ key: String(template.id), label: template.name })),
                    onClick: ({ key }) => setText(templates.find((template) => String(template.id) === key)?.text || ''),
                  }}
                >
                  <Button size="small" type="link" icon={<SnippetsOutlined />}>
                    {t('sms.compose.useTemplate')}
                  </Button>
                </Dropdown>
              )}
              {text.trim() && (
                <Button size="small" type="link" onClick={saveTemplate}>
                  {t('sms.templates.saveAs')}
                </Button>
              )}
            </div>
            <Input.TextArea id="sx-text" value={text} onChange={(event) => setText(event.target.value)} autoSize={{ minRows: 5, maxRows: 14 }} maxLength={maxLength} placeholder={t('sms.compose.textPlaceholder')} />
            <SegmentMeter text={text} />
          </section>

          <section className="sx-field sx-field--inline">
            <Switch checked={schedule} onChange={setSchedule} />
            <span>{t('sms.compose.schedule')}</span>
            {schedule && (
              <DatePicker
                showTime={{ format: 'HH:mm' }}
                format="DD.MM.YYYY HH:mm"
                value={sendAt}
                onChange={setSendAt}
                disabledDate={(day) => day && (day < dayjs().startOf('day') || day > dayjs().add(90, 'day'))}
                placeholder={t('sms.compose.when')}
                status={pastTime ? 'error' : undefined}
              />
            )}
            {pastTime && <span className="sx-hint is-warning">{t('sms.compose.pastTime')}</span>}
          </section>

          <Collapse
            ghost
            className="sx-advanced"
            items={[
              {
                key: 'more',
                label: t('sms.compose.advanced'),
                children: (
                  <div className="sx-field">
                    <label className="sx-field__label">{t('sms.compose.ref')}</label>
                    <Input value={ref} onChange={(event) => setRef(event.target.value)} maxLength={64} placeholder="order-1001" />
                    <p className="sx-hint">{t('sms.compose.refHint')}</p>
                  </div>
                ),
              },
            ]}
          />

          <div className="sx-sendbar">
            <div className="sx-sendbar__info">
              <strong>{t('sms.compose.summary', { count: check.valid.length })}</strong>
              <span>{t('sms.compose.summaryParts', { count: totalParts })}</span>
            </div>
            <Button type="primary" size="large" disabled={!canSend} loading={sending} onClick={confirm} icon={<SendOutlined />} data-tour="sms.sendButton">
              {schedule ? t('sms.compose.scheduleButton') : t('sms.compose.send')}
            </Button>
          </div>
        </div>
        <aside className="sx-compose__side">
          <PhonePreview text={text} sender={senderLabel} recipients={check.valid} />
        </aside>
      </div>
    </div>
  );
}
