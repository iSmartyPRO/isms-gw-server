import { Suspense, lazy, useState } from 'react';
import { SendOutlined } from '@ant-design/icons';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Button, Drawer, Result, Spin } from 'antd';
import Chrome from '../../components/Chrome';
import PageTransition from '../../components/ui/PageTransition';
import { MenuIcon } from '../../components/icons/menuIcons';
import { useLocale } from '../../context/LocaleContext';
import { errorMessage } from '../../lib/errors';
import { formatNumber } from '../../lib/format';
import SideRail from '../shared/SideRail';
import { SmsProvider, useSms } from './SmsContext';
import { OnlineDot } from './components/ui';
import '../shared/module.css';
import './sms.css';

const Overview = lazy(() => import('./pages/Overview'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Compose = lazy(() => import('./pages/Compose'));
const Messages = lazy(() => import('./pages/Messages'));
const Devices = lazy(() => import('./pages/Devices'));
const DeviceDetail = lazy(() => import('./pages/DeviceDetail'));
const Templates = lazy(() => import('./pages/Templates'));
const ApiPage = lazy(() => import('./pages/ApiPage'));

function Sidebar({ onNavigate }) {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const { devices, unread, overview, config } = useSms();
  const queued = (overview?.today?.queued || 0) + (overview?.today?.scheduled || 0);
  const link = (to, icon, label, { end = false, count = 0, alert = false, tour } = {}) => (
    <NavLink to={to} end={end} className="mod-nav__link" onClick={onNavigate} data-tour={tour}>
      <MenuIcon name={icon} variant="mono" />
      <span className="mod-nav__text">{label}</span>
      {count > 0 && <span className={`mod-nav__count${alert ? ' is-alert' : ''}`}>{formatNumber(count, locale)}</span>}
    </NavLink>
  );
  return (
    <div className="mod-side sx-side">
      <NavLink to="/app/sms" end className="mod-side__brand" onClick={onNavigate}>
        <MenuIcon name="sms" />
        <span>{t('apps.sms.name')}</span>
      </NavLink>
      <Button
        type="primary"
        size="large"
        className="sx-side__compose"
        icon={<SendOutlined />}
        onClick={() => {
          navigate('/app/sms/send');
          onNavigate?.();
        }}
        data-tour="sms.compose"
        data-tip={t('sms.nav.send')}
      >
        <span className="mod-nav__text">{t('sms.nav.send')}</span>
      </Button>
      <nav className="mod-nav" data-tour="sms.nav">
        {link('/app/sms', 'dashboard', t('sms.nav.overview'), { end: true })}
        {link('/app/sms/inbox', 'inbox', t('sms.nav.inbox'), { count: unread, alert: unread > 0 })}
        {link('/app/sms/messages', 'table', t('sms.nav.messages'), { count: queued })}
        {link('/app/sms/templates', 'clipboard', t('sms.nav.templates'))}
        {link('/app/sms/api', 'code', t('sms.nav.api'))}
      </nav>
      <div className="mod-side__label" data-tour="sms.devices">
        <span>{t('sms.nav.devices')}</span>
        {config?.canAddDevices && (
          <button
            type="button"
            onClick={() => {
              navigate('/app/sms/devices?add=1');
              onNavigate?.();
            }}
            aria-label={t('sms.devices.add')}
          >
            +
          </button>
        )}
      </div>
      <nav className="mod-nav">
        {link('/app/sms/devices', 'smartphone', t('sms.nav.allDevices'), { end: true })}
        {devices.map((device) => (
          <NavLink key={device.id} to={`/app/sms/devices/${device.id}`} className="mod-nav__link" onClick={onNavigate}>
            <span className="sx-side__dot">
              <OnlineDot online={device.online} pulse={false} />
            </span>
            <span className="mod-nav__text">{device.name}</span>
            {device.queued > 0 && <span className="mod-nav__count">{formatNumber(device.queued, locale)}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Shell() {
  const { t } = useLocale();
  const { config, error } = useSms();
  const [drawer, setDrawer] = useState(false);
  if (error) {
    const status = error?.response?.status;
    return <Result status={status === 404 ? '404' : 'warning'} title={status === 404 ? t('sms.disabled') : errorMessage(error)} />;
  }
  if (!config) {
    return (
      <div className="boot-screen">
        <Spin size="large" />
      </div>
    );
  }
  return (
    <div className="mod-shell sx-shell">
      <SideRail moduleKey="sms">
        <Sidebar />
      </SideRail>
      <Drawer open={drawer} onClose={() => setDrawer(false)} placement="left" width={300} styles={{ body: { padding: 0 } }}>
        <Sidebar onNavigate={() => setDrawer(false)} />
      </Drawer>
      <main className="mod-shell__main">
        <Button className="mod-shell__menu" onClick={() => setDrawer(true)} icon={<span>☰</span>}>
          {t('apps.sms.name')}
        </Button>
        <Suspense
          fallback={
            <div className="page-fallback">
              <Spin />
            </div>
          }
        >
          <PageTransition>
            <Routes>
              <Route index element={<Overview />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="send" element={<Compose />} />
              <Route path="messages" element={<Messages />} />
              <Route path="devices" element={<Devices />} />
              <Route path="devices/:id" element={<DeviceDetail />} />
              <Route path="templates" element={<Templates />} />
              <Route path="api" element={<ApiPage />} />
              <Route path="*" element={<Navigate to="/app/sms" replace />} />
            </Routes>
          </PageTransition>
        </Suspense>
      </main>
    </div>
  );
}

/** SMS gateway: /app/sms (overview), /inbox, /send, /messages, /devices[/:id], /templates, /api. */
export default function SmsApp() {
  return (
    <div className="shell">
      <Chrome dense />
      <SmsProvider>
        <Shell />
      </SmsProvider>
    </div>
  );
}
