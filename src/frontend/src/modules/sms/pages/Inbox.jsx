import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SendOutlined } from '@ant-design/icons';
import { Link, useSearchParams } from 'react-router-dom';
import { App, Button, Input, Select, Skeleton } from 'antd';
import { useLocale } from '../../../context/LocaleContext';
import { errorMessage } from '../../../lib/errors';
import { formatNumber } from '../../../lib/format';
import { smsApi, smsSegments } from '../api';
import { useSms } from '../SmsContext';
import { Ago, Empty, StatusTag, Ticks, prettyPhone } from '../components/ui';

const avatarColor = (phone) => {
  const palette = ['#00A3E0', '#7950F2', '#F59F00', '#E64980', '#0CA678', '#4C6EF5', '#E8590C', '#15AABF'];
  let hash = 0;
  for (const char of String(phone)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
};

function Avatar({ phone }) {
  const digits = String(phone).replace(/\D/g, '');
  return (
    <span className="sx-avatar" style={{ '--c': avatarColor(phone) }}>
      {/^\d+$/.test(digits) && digits.length ? digits.slice(-2) : String(phone).slice(0, 2).toUpperCase()}
    </span>
  );
}

function dayKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function Conversation({ deviceId, phone, onBack, onChanged }) {
  const { t, locale } = useLocale();
  const { message } = App.useApp();
  const { deviceById } = useSms();
  const [data, setData] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scroller = useRef(null);
  const lastId = useRef(null);
  const changed = useRef(onChanged);
  changed.current = onChanged;
  const device = deviceById(deviceId);

  const load = useCallback(async () => {
    try {
      const { data: next } = await smsApi.thread(deviceId, phone);
      setData(next);
      const newest = next.messages[next.messages.length - 1]?.id;
      if (newest !== lastId.current) {
        lastId.current = newest;
        requestAnimationFrame(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }));
        if (next.messages.some((item) => item.direction === 'in' && !item.isRead)) {
          await smsApi.markRead({ deviceId, phone });
          changed.current?.();
        }
      }
    } catch (err) {
      message.error(errorMessage(err));
    }
  }, [deviceId, phone, message]);

  useEffect(() => {
    setData(null);
    lastId.current = null;
    load();
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), 4000);
    return () => clearInterval(timer);
  }, [load]);

  // Reply through the SIM the last incoming message arrived on — if it can still send; else let the server pick.
  const lastSim = useMemo(() => [...(data?.messages || [])].reverse().find((item) => item.direction === 'in' && item.simId)?.simId, [data]);
  const replySim = device?.sims?.some((sim) => sim.id === lastSim && sim.active && sim.sendEnabled !== false) ? lastSim : undefined;

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await smsApi.send({ to: phone, text, deviceId, simId: replySim || undefined });
      setText('');
      await load();
      changed.current?.();
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const info = smsSegments(text);
  return (
    <div className="sx-chat">
      <header className="sx-chat__head">
        <Button className="sx-chat__back" type="text" onClick={onBack} aria-label={t('sms.inbox.back')}>
          ←
        </Button>
        <Avatar phone={phone} />
        <div className="sx-chat__who">
          <strong>{prettyPhone(phone)}</strong>
          <span>{device ? t('sms.inbox.via', { device: device.name }) : ''}</span>
        </div>
        <Link to={`/app/sms/messages?phone=${encodeURIComponent(phone)}&deviceId=${deviceId}`} className="sx-chat__link">
          {t('sms.inbox.history')}
        </Link>
      </header>
      <div className="sx-chat__body" ref={scroller}>
        {!data ? (
          <Skeleton active />
        ) : (
          data.messages.map((item, index) => {
            const previous = data.messages[index - 1];
            const newDay = !previous || dayKey(previous.createdAt) !== dayKey(item.createdAt);
            return (
              <Fragment key={item.id}>
                {newDay && (
                  <div className="sx-chat__day">
                    <span>{new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: new Date(item.createdAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }).format(new Date(item.createdAt))}</span>
                  </div>
                )}
                <div className={`sx-bubble-row is-${item.direction}`}>
                  <div className={`sx-bubble is-${item.direction}${['failed', 'expired'].includes(item.status) ? ' is-failed' : ''}`}>
                    <span className="sx-bubble__text">{item.text}</span>
                    <span className="sx-bubble__meta">
                      {item.simLabel && <span className="sx-bubble__sim">{item.simLabel}</span>}
                      <time>{new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(item.createdAt))}</time>
                      {item.direction === 'out' && <Ticks status={item.status} />}
                    </span>
                  </div>
                  {item.direction === 'out' && ['failed', 'expired'].includes(item.status) && (
                    <div className="sx-bubble__error">
                      <StatusTag status={item.status} compact /> {item.error}
                      <Button
                        size="small"
                        type="link"
                        onClick={async () => {
                          try {
                            await smsApi.retry(item.id);
                            load();
                          } catch (err) {
                            message.error(errorMessage(err));
                          }
                        }}
                      >
                        {t('sms.retry')}
                      </Button>
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })
        )}
      </div>
      {data?.canSend ? (
        <footer className="sx-chat__composer">
          <Input.TextArea
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoSize={{ minRows: 1, maxRows: 6 }}
            placeholder={t('sms.inbox.reply')}
            onPressEnter={(event) => {
              if (!event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
          />
          <div className="sx-chat__send">
            {text && (
              <span className="sx-muted">
                {info.length} · {t('sms.compose.partsLabel', { count: info.parts })}
              </span>
            )}
            <Button type="primary" shape="circle" size="large" loading={sending} disabled={!text.trim()} onClick={send} icon={<SendOutlined />} aria-label={t('sms.compose.send')} />
          </div>
        </footer>
      ) : (
        data && <footer className="sx-chat__readonly">{t('sms.inbox.readOnly')}</footer>
      )}
    </div>
  );
}

export default function Inbox() {
  const { t, locale } = useLocale();
  const { message } = App.useApp();
  const [params, setParams] = useSearchParams();
  const { devices, refresh } = useSms();
  const [threads, setThreads] = useState(null);
  const [query, setQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState(params.get('filter') || 'all');
  const open = params.get('device') && params.get('phone') ? { deviceId: Number(params.get('device')), phone: params.get('phone') } : null;

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const { data } = await smsApi.threads({ q: query || undefined, deviceId: deviceFilter === 'all' ? undefined : deviceFilter, limit: 100 });
      if (mine === seq.current) setThreads(data.threads);
    } catch {
      if (mine === seq.current) setThreads((list) => list || []);
    }
  }, [query, deviceFilter]);

  useEffect(() => {
    const timer = setTimeout(load, query ? 250 : 0);
    const poll = setInterval(() => document.visibilityState === 'visible' && load(), 6000);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
    };
  }, [load, query]);

  const select = (thread) => setParams({ device: String(thread.deviceId), phone: thread.phone });
  const unreadTotal = (threads || []).reduce((sum, thread) => sum + thread.unread, 0);

  return (
    <div className={`sx-inbox${open ? ' has-open' : ''}`}>
      <aside className="sx-inbox__list">
        <header className="sx-inbox__head">
          <div>
            <h1>{t('sms.nav.inbox')}</h1>
            <span className="sx-muted">{unreadTotal ? t('sms.overview.unread', { count: unreadTotal }) : t('sms.inbox.allRead')}</span>
          </div>
          {unreadTotal > 0 && (
            <Button
              size="small"
              onClick={async () => {
                try {
                  await smsApi.markRead({ all: true });
                } catch (err) {
                  message.error(errorMessage(err));
                }
                load();
                refresh();
              }}
            >
              {t('sms.inbox.markAll')}
            </Button>
          )}
        </header>
        <div className="sx-inbox__filters">
          <Input.Search allowClear placeholder={t('sms.inbox.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
          {devices.length > 1 && (
            <Select
              value={deviceFilter}
              onChange={setDeviceFilter}
              options={[{ value: 'all', label: t('sms.inbox.allDevices') }, ...devices.map((device) => ({ value: device.id, label: device.name }))]}
              style={{ width: '100%' }}
            />
          )}
        </div>
        <div className="sx-inbox__threads">
          {threads === null ? (
            <Skeleton active avatar paragraph={{ rows: 2 }} />
          ) : threads.length === 0 ? (
            <Empty icon="inbox" title={t('sms.inbox.emptyTitle')} text={t('sms.inbox.emptyText')} />
          ) : (
            threads.map((thread) => {
              const active = open && open.deviceId === thread.deviceId && open.phone === thread.phone;
              return (
                <button key={`${thread.deviceId}:${thread.phone}`} type="button" className={`sx-thread${active ? ' is-active' : ''}${thread.unread ? ' is-unread' : ''}`} onClick={() => select(thread)}>
                  <Avatar phone={thread.phone} />
                  <span className="sx-thread__main">
                    <span className="sx-thread__top">
                      <strong>{prettyPhone(thread.phone)}</strong>
                      <Ago value={thread.last.createdAt} />
                    </span>
                    <span className="sx-thread__text">
                      {thread.last.direction === 'out' && <Ticks status={thread.last.status} />}
                      {thread.last.text}
                    </span>
                    {devices.length > 1 && <span className="sx-thread__device">{thread.deviceName}</span>}
                  </span>
                  {thread.unread > 0 && <span className="sx-thread__badge">{formatNumber(thread.unread, locale)}</span>}
                </button>
              );
            })
          )}
        </div>
      </aside>
      <section className="sx-inbox__chat">
        {open ? (
          <Conversation
            key={`${open.deviceId}:${open.phone}`}
            deviceId={open.deviceId}
            phone={open.phone}
            onBack={() => setParams({})}
            onChanged={() => {
              load();
              refresh();
            }}
          />
        ) : (
          <Empty icon="chat" title={t('sms.inbox.pickTitle')} text={t('sms.inbox.pickText')} />
        )}
      </section>
    </div>
  );
}
