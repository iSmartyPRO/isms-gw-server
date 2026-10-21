import { useEffect, useState } from 'react';
import { InboxOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Skeleton } from 'antd';
import { useLocale } from '../../../context/LocaleContext';
import { useAuth } from '../../../context/AuthContext';
import { formatNumber } from '../../../lib/format';
import { smsApi } from '../api';
import { useSms } from '../SmsContext';
import { Ago, Empty, Kpi, OnlineDot, Ring, SimCard, StatusTag, TrafficChart, prettyPhone } from '../components/ui';

function Welcome({ canAdd }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const steps = ['install', 'connect', 'send'];
  return (
    <section className="sx-welcome">
      <div className="sx-welcome__text">
        <span className="sx-eyebrow">{t('sms.welcome.eyebrow')}</span>
        <h1>{t('sms.welcome.title')}</h1>
        <p>{t('sms.welcome.lead')}</p>
        <div className="sx-welcome__actions">
          {canAdd && (
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate('/app/sms/devices?add=1')}>
              {t('sms.devices.add')}
            </Button>
          )}
          <Button size="large" href="https://github.com/iSmartyPRO/isms-gw-android/releases/latest" target="_blank" rel="noreferrer">
            {t('sms.welcome.download')}
          </Button>
        </div>
      </div>
      <ol className="sx-welcome__steps">
        {steps.map((step, index) => (
          <li key={step}>
            <span className="sx-welcome__num">{index + 1}</span>
            <div>
              <strong>{t(`sms.welcome.steps.${step}.title`)}</strong>
              <p>{t(`sms.welcome.steps.${step}.text`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Overview() {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { devices, overview, loaded, config, online } = useSms();
  const [recent, setRecent] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      smsApi
        .messages({ limit: 8 })
        .then(({ data }) => alive && setRecent(data.messages))
        .catch(() => alive && setRecent([]));
    load();
    const timer = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!loaded) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (!devices.length) return <Welcome canAdd={config?.canAddDevices} />;

  const today = overview?.today || {};
  const period = overview?.period || {};
  const n = (value) => formatNumber(value || 0, locale);
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'day' : 'evening';
  const name = (user?.displayName || user?.username || '').split(' ')[0];

  return (
    <div className="sx-page">
      <section className="sx-hero" data-tour="sms.hero">
        <div className="sx-hero__text">
          <span className="sx-eyebrow">{t('sms.overview.eyebrow')}</span>
          <h1>{t(`sms.overview.greeting.${greeting}`, { name })}</h1>
          <p>
            {t('sms.overview.summary', { online, total: devices.length })}
            {today.unread > 0 && (
              <>
                {' '}
                <Link to="/app/sms/inbox">{t('sms.overview.unread', { count: today.unread })}</Link>
              </>
            )}
          </p>
        </div>
        <div className="sx-hero__actions">
          <Button type="primary" size="large" icon={<SendOutlined />} onClick={() => navigate('/app/sms/send')}>
            {t('sms.nav.send')}
          </Button>
          <Button size="large" icon={<InboxOutlined />} onClick={() => navigate('/app/sms/inbox')}>
            {t('sms.nav.inbox')}
          </Button>
        </div>
      </section>

      <div className="sx-kpis" data-tour="sms.kpis">
        <Kpi icon="send" tone="sent" label={t('sms.overview.kpi.sent')} value={n(today.sent)} hint={t('sms.overview.kpi.parts', { count: today.parts || 0 })} />
        <Kpi icon="check" tone="delivered" label={t('sms.overview.kpi.delivered')} value={n(today.delivered)} hint={today.failed ? t('sms.overview.kpi.failed', { count: today.failed }) : t('sms.overview.kpi.noFailures')} />
        <Kpi icon="inbox" tone="received" label={t('sms.overview.kpi.received')} value={n(today.received)} hint={today.unread ? t('sms.overview.unread', { count: today.unread }) : t('sms.overview.kpi.allRead')} />
        <Kpi icon="hourglass" tone="queue" label={t('sms.overview.kpi.queue')} value={n((today.queued || 0) + (today.scheduled || 0))} hint={today.scheduled ? t('sms.overview.kpi.scheduled', { count: today.scheduled }) : t('sms.overview.kpi.queueHint')} />
      </div>

      <div className="sx-grid-2">
        <section className="sx-card sx-card--chart">
          <header className="sx-card__head">
            <div>
              <h2>{t('sms.overview.chartTitle')}</h2>
              <p>{t('sms.overview.chartLead', { days: period.days || 14 })}</p>
            </div>
          </header>
          <TrafficChart series={overview?.series || []} />
        </section>
        <section className="sx-card sx-card--rate">
          <header className="sx-card__head">
            <div>
              <h2>{t('sms.overview.rateTitle')}</h2>
              <p>{t('sms.overview.rateLead', { days: period.days || 14 })}</p>
            </div>
          </header>
          <div className="sx-rate">
            <Ring value={period.deliveryRate} size={132} label={t('sms.overview.delivered')} />
            <dl>
              <div>
                <dt>{t('sms.overview.totalOut')}</dt>
                <dd>{n(period.out)}</dd>
              </div>
              <div>
                <dt>{t('sms.overview.totalIn')}</dt>
                <dd>{n(period.in)}</dd>
              </div>
              <div>
                <dt>{t('sms.overview.phonesOnline')}</dt>
                <dd>
                  {n(online)} / {n(devices.length)}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

      <section className="sx-section">
        <header className="sx-section__head">
          <h2>{t('sms.nav.devices')}</h2>
          <Link to="/app/sms/devices">{t('sms.overview.allDevices')}</Link>
        </header>
        <div className="sx-device-strip">
          {devices.slice(0, 6).map((device) => (
            <Link key={device.id} to={`/app/sms/devices/${device.id}`} className="sx-mini-device" style={{ '--c': device.color || 'var(--da-primary)' }}>
              <div className="sx-mini-device__top">
                <OnlineDot online={device.online} />
                <strong>{device.name}</strong>
                <span className="sx-mini-device__count">{t('sms.overview.sentShort', { count: device.sentToday })}</span>
              </div>
              <div className="sx-mini-device__sims">
                {device.sims.filter((sim) => sim.active).slice(0, 2).map((sim) => (
                  <SimCard key={sim.id} sim={sim} size="sm" />
                ))}
                {!device.sims.length && <span className="sx-muted">{device.online ? t('sms.device.waitingSims') : t('sms.device.neverConnected')}</span>}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="sx-section">
        <header className="sx-section__head">
          <h2>{t('sms.overview.recent')}</h2>
          <Link to="/app/sms/messages">{t('sms.overview.allMessages')}</Link>
        </header>
        {recent === null ? (
          <Skeleton active />
        ) : recent.length === 0 ? (
          <Empty icon="send" title={t('sms.overview.noMessages')} text={t('sms.overview.noMessagesText')} action={<Button type="primary" onClick={() => navigate('/app/sms/send')}>{t('sms.nav.send')}</Button>} />
        ) : (
          <ul className="sx-feed">
            {recent.map((message) => (
              <li key={message.id}>
                <Link to={`/app/sms/inbox?device=${message.deviceId}&phone=${encodeURIComponent(message.phone)}`} className="sx-feed__item">
                  <span className={`sx-feed__dir is-${message.direction}`} aria-label={t(`sms.direction.${message.direction}`)}>
                    {message.direction === 'in' ? '↙' : '↗'}
                  </span>
                  <span className="sx-feed__main">
                    <strong>{prettyPhone(message.phone)}</strong>
                    <span>{message.text}</span>
                  </span>
                  <span className="sx-feed__meta">
                    <StatusTag status={message.status} compact />
                    <Ago value={message.createdAt} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
