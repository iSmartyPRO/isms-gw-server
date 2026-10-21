import { useEffect, useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input, Segmented, Skeleton } from 'antd';
import { useLocale } from '../../../context/LocaleContext';
import { MenuIcon } from '../../../components/icons/menuIcons';
import { formatNumber } from '../../../lib/format';
import { useSms } from '../SmsContext';
import AddDeviceWizard from '../components/AddDeviceWizard';
import { Ago, Empty, OnlineDot, SimCard } from '../components/ui';

function DeviceCard({ device }) {
  const { t, locale } = useLocale();
  const active = device.sims.filter((sim) => sim.active);
  return (
    <Link to={`/app/sms/devices/${device.id}`} className={`sx-device${device.online ? ' is-online' : ''}${device.enabled ? '' : ' is-disabled'}`} style={{ '--c': device.color || 'var(--da-primary)' }}>
      <div className="sx-device__phone" aria-hidden>
        <span className="sx-device__notch" />
        <span className="sx-device__screen">
          <MenuIcon name="sms" />
        </span>
      </div>
      <div className="sx-device__body">
        <div className="sx-device__title">
          <OnlineDot online={device.online} />
          <h3>{device.name}</h3>
          {!device.enabled && <span className="sx-pill is-muted">{t('sms.device.disabled')}</span>}
          {device.level !== 'manage' && <span className="sx-pill">{t(`sms.level.${device.level}`)}</span>}
        </div>
        <p className="sx-device__meta">
          {device.online ? (
            <>
              {t('sms.device.onlineSince')} <Ago value={device.connectedAt} />
            </>
          ) : device.lastSeenAt ? (
            <>
              {t('sms.device.lastSeen')} <Ago value={device.lastSeenAt} />
            </>
          ) : (
            t('sms.device.neverConnected')
          )}
          {device.phoneName && <span> · {device.phoneName}</span>}
        </p>
        <div className="sx-device__sims">
          {active.length ? active.map((sim) => <SimCard key={sim.id} sim={sim} size="sm" />) : <span className="sx-muted">{t('sms.device.noSims')}</span>}
        </div>
        <div className="sx-device__stats">
          <span>
            <b>{formatNumber(device.sentToday, locale)}</b> {t('sms.device.sentToday')}
          </span>
          <span>
            <b>{formatNumber(device.receivedToday, locale)}</b> {t('sms.device.receivedToday')}
          </span>
          {device.queued > 0 && (
            <span className="is-queue">
              <b>{formatNumber(device.queued, locale)}</b> {t('sms.device.inQueue')}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Devices() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { devices, loaded, config, refresh, online } = useSms();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const adding = params.get('add') === '1';

  useEffect(() => {
    if (adding && config && !config.canAddDevices) setParams({}, { replace: true });
  }, [adding, config, setParams]);

  const shown = devices.filter((device) => (filter === 'online' ? device.online : filter === 'offline' ? !device.online : true)).filter((device) => !query || `${device.name} ${device.phoneName || ''} ${device.sims.map((sim) => `${sim.carrier} ${sim.number}`).join(' ')}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="sx-page">
      <header className="mod-hero" style={{ '--c': '#334155' }}>
        <span className="mod-hero__badge">
          <MenuIcon name="smartphone" />
        </span>
        <div className="mod-hero__text">
          <h1>{t('sms.devices.title')}</h1>
          <p>{t('sms.devices.lead', { online, total: devices.length })}</p>
        </div>
        {config?.canAddDevices && (
          <div className="mod-hero__actions">
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setParams({ add: '1' })} data-tour="sms.addDevice">
              {t('sms.devices.add')}
            </Button>
          </div>
        )}
      </header>

      {!loaded ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : devices.length === 0 ? (
        <Empty
          icon="smartphone"
          title={t('sms.devices.emptyTitle')}
          text={t('sms.devices.emptyText')}
          action={
            config?.canAddDevices && (
              <Button type="primary" size="large" onClick={() => setParams({ add: '1' })}>
                {t('sms.devices.add')}
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="mod-toolbar">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: t('sms.devices.filter.all') },
                { value: 'online', label: t('sms.devices.filter.online') },
                { value: 'offline', label: t('sms.devices.filter.offline') },
              ]}
            />
            <span className="mod-toolbar__grow" />
            <Input.Search allowClear placeholder={t('sms.devices.search')} value={query} onChange={(event) => setQuery(event.target.value)} style={{ maxWidth: 280 }} />
          </div>
          <div className="sx-devices">
            {shown.map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
            {config?.canAddDevices && filter === 'all' && !query && (
              <button type="button" className="sx-device sx-device--add" onClick={() => setParams({ add: '1' })}>
                <span className="sx-device--add__plus">+</span>
                <strong>{t('sms.devices.add')}</strong>
                <span>{t('sms.devices.addHint')}</span>
              </button>
            )}
          </div>
        </>
      )}

      <AddDeviceWizard
        open={adding}
        onClose={async (id) => {
          setParams({}, { replace: true });
          await refresh();
          if (id) navigate(`/app/sms/devices/${id}`);
        }}
      />
    </div>
  );
}
