import { useCallback, useEffect, useRef, useState } from 'react';
import { DeleteOutlined, KeyOutlined, SendOutlined, SyncOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Descriptions, Dropdown, Form, Input, InputNumber, Modal, Result, Skeleton, Switch, Tabs, Timeline } from 'antd';
import { useLocale } from '../../../context/LocaleContext';
import { MenuIcon } from '../../../components/icons/menuIcons';
import { errorMessage } from '../../../lib/errors';
import { formatDateTime, formatNumber } from '../../../lib/format';
import AccessDialog from '../../shared/AccessDialog';
import { deviceUrl, smsApi, SIM_COLORS } from '../api';
import { useSms } from '../SmsContext';
import { ConnectGuide } from '../components/AddDeviceWizard';
import { Ago, Kpi, OnlineDot, SimCard, TrafficChart } from '../components/ui';
import PhoneTokens from '../components/PhoneTokens';

function SimDialog({ sim, onClose, onToken }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [color, setColor] = useState(null);
  const [saving, setSaving] = useState(false);
  const label = Form.useWatch('label', form);
  useEffect(() => {
    if (!sim) return;
    form.setFieldsValue({ label: sim.label || '', sendEnabled: sim.sendEnabled, dailyLimit: sim.dailyLimit || 0 });
    setColor(sim.color || sim.phoneColor || null);
  }, [sim, form]);
  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await smsApi.updateSim(sim.id, { ...values, color });
      message.success(t('sms.saved'));
      onClose(true);
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={Boolean(sim)}
      title={t('sms.sim.settings')}
      onCancel={() => onClose(false)}
      destroyOnClose
      footer={
        <div className="sx-dialog-footer">
          {onToken && (
            <Button icon={<KeyOutlined />} onClick={() => onToken(sim)}>
              {t('sms.tokens.forSim')}
            </Button>
          )}
          <span className="sx-dialog-footer__grow" />
          <Button onClick={() => onClose(false)}>{t('sms.cancel')}</Button>
          <Button type="primary" loading={saving} onClick={save}>
            {t('sms.save')}
          </Button>
        </div>
      }
    >
      {sim && (
        <div className="sx-sim-dialog">
          <SimCard sim={{ ...sim, color, label: label || sim.label }} />
          <Form form={form} layout="vertical" requiredMark={false}>
            <Form.Item name="label" label={t('sms.sim.label')} extra={t('sms.sim.labelHint', { carrier: sim.carrier || '—' })}>
              <Input maxLength={60} placeholder={sim.phoneLabel || sim.carrier || ''} />
            </Form.Item>
            <Form.Item label={t('sms.device.color')}>
              <div className="sx-swatches">
                {SIM_COLORS.map((value) => (
                  <button key={value} type="button" className={`sx-swatch${value === color ? ' is-active' : ''}`} style={{ '--c': value }} onClick={() => setColor(value)} aria-label={value} />
                ))}
              </div>
            </Form.Item>
            <Form.Item name="sendEnabled" label={t('sms.sim.sendEnabled')} valuePropName="checked" extra={t('sms.sim.sendEnabledHint')}>
              <Switch />
            </Form.Item>
            <Form.Item name="dailyLimit" label={t('sms.sim.dailyLimit')} extra={t('sms.sim.dailyLimitHint')}>
              <InputNumber min={0} max={100000} style={{ width: 180 }} addonAfter={t('sms.sim.perDay')} />
            </Form.Item>
          </Form>
          {sim.phoneSend === false && <p className="sx-warn">{t('sms.sim.phoneSendOff')}</p>}
        </div>
      )}
    </Modal>
  );
}

function SettingsTab({ device, onSaved }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [color, setColor] = useState(device.color);
  const [saving, setSaving] = useState(false);
  // Only when the saved values change — the page polls every few seconds and must not wipe what is being typed.
  const { id, name, description, ratePerMinute, enabled, color: savedColor } = device;
  useEffect(() => {
    form.setFieldsValue({ name, description: description || '', ratePerMinute, enabled });
    setColor(savedColor);
  }, [id, name, description, ratePerMinute, enabled, savedColor, form]);
  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await smsApi.updateDevice(device.id, { ...values, ratePerMinute: values.ratePerMinute ?? null, color });
      message.success(t('sms.saved'));
      onSaved();
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Form form={form} layout="vertical" requiredMark={false} className="sx-form" onFinish={save}>
      <div className="form-grid-2">
        <Form.Item name="name" label={t('sms.device.name')} rules={[{ required: true, whitespace: true, message: t('sms.device.nameRequired') }]}>
          <Input maxLength={120} />
        </Form.Item>
        <Form.Item name="ratePerMinute" label={t('sms.device.rate')} extra={t('sms.device.rateHint')}>
          <InputNumber min={1} max={120} style={{ width: '100%' }} placeholder={t('sms.device.rateDefault')} addonAfter={t('sms.device.perMinute')} />
        </Form.Item>
      </div>
      <Form.Item name="description" label={t('sms.device.description')}>
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={1000} />
      </Form.Item>
      <Form.Item label={t('sms.device.color')}>
        <div className="sx-swatches">
          {SIM_COLORS.map((value) => (
            <button key={value} type="button" className={`sx-swatch${value === color ? ' is-active' : ''}`} style={{ '--c': value }} onClick={() => setColor(value)} aria-label={value} />
          ))}
        </div>
      </Form.Item>
      <Form.Item name="enabled" label={t('sms.device.enabled')} valuePropName="checked" extra={t('sms.device.enabledHint')}>
        <Switch />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={saving}>
        {t('sms.save')}
      </Button>
    </Form>
  );
}

const EVENT_COLORS = { connected: 'green', disconnected: 'gray', token_rotated: 'blue', phone_changed: 'orange', offline_alert: 'red', disabled: 'red' };

function JournalTab({ deviceId }) {
  const { t, locale } = useLocale();
  const [events, setEvents] = useState(null);
  useEffect(() => {
    smsApi
      .deviceEvents(deviceId)
      .then(({ data }) => setEvents(data.events))
      .catch(() => setEvents([]));
  }, [deviceId]);
  if (!events) return <Skeleton active />;
  if (!events.length) return <p className="sx-muted">{t('sms.journal.empty')}</p>;
  return (
    <Timeline
      className="sx-journal"
      items={events.map((event) => ({
        color: EVENT_COLORS[event.kind] || 'blue',
        children: (
          <div className="sx-journal__item">
            <strong>{t(`sms.journal.kinds.${event.kind}`)}</strong>
            <span className="sx-muted">
              {formatDateTime(event.createdAt, locale)}
              {event.detail?.ip ? ` · ${event.detail.ip}` : ''}
              {event.detail?.version ? ` · iSMS GW ${event.detail.version}` : ''}
              {event.detail?.minutes ? ` · ${t('sms.journal.minutes', { count: event.detail.minutes })}` : ''}
            </span>
          </div>
        ),
      }))}
    />
  );
}

export default function DeviceDetail() {
  const { id } = useParams();
  const { t, locale } = useLocale();
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { refresh: refreshAll, config } = useSms();
  const [device, setDevice] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [tab, setTab] = useState('sims');
  const [tokenSim, setTokenSim] = useState(null);

  const shown = useRef(null);
  const loadedId = useRef(null);
  const load = useCallback(async () => {
    try {
      const [one, overview] = await Promise.all([smsApi.device(id), smsApi.overview({ deviceId: id, days: 14 })]);
      if (shown.current !== id) return;
      loadedId.current = id;
      setDevice(one.data.device);
      setStats(overview.data);
      setError(null);
    } catch (err) {
      if (shown.current !== id) return;
      // A failed poll (network blip) keeps the page; a deleted or no longer shared phone shows the error.
      if (!loadedId.current || [403, 404].includes(err?.response?.status)) setError(err);
    }
  }, [id]);

  useEffect(() => {
    shown.current = id;
    loadedId.current = null;
    setDevice(null);
    setStats(null);
    setError(null);
    setNewToken(null);
    setTab('sims');
    load();
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  if (error) return <Result status="404" title={t('sms.device.notFound')} subTitle={errorMessage(error)} extra={<Button onClick={() => navigate('/app/sms/devices')}>{t('sms.devices.title')}</Button>} />;
  if (!device) return <Skeleton active paragraph={{ rows: 10 }} />;

  const manage = device.level === 'manage';
  const canSend = device.level === 'edit' || manage;
  const today = stats?.today || {};

  const rotate = () =>
    modal.confirm({
      title: t('sms.token.rotateTitle'),
      content: t('sms.token.rotateText'),
      okText: t('sms.token.rotate'),
      okButtonProps: { danger: true },
      cancelText: t('sms.cancel'),
      onOk: async () => {
        try {
          const { data } = await smsApi.rotateToken(device.id);
          setNewToken(data.token);
          setTab('connection');
          load();
        } catch (err) {
          message.error(errorMessage(err));
        }
      },
    });

  const remove = () =>
    modal.confirm({
      title: t('sms.device.deleteTitle', { name: device.name }),
      content: t('sms.device.deleteText'),
      okText: t('sms.delete'),
      okButtonProps: { danger: true },
      cancelText: t('sms.cancel'),
      onOk: async () => {
        try {
          await smsApi.deleteDevice(device.id);
          message.success(t('sms.device.deleted'));
          await refreshAll();
          navigate('/app/sms/devices');
        } catch (err) {
          message.error(errorMessage(err));
        }
      },
    });

  const ping = async () => {
    try {
      const { data } = await smsApi.refreshDevice(device.id);
      message[data.requested ? 'success' : 'warning'](data.requested ? t('sms.device.refreshed') : t('sms.device.offlineHint'));
      setTimeout(load, 1500);
    } catch (err) {
      message.error(errorMessage(err));
    }
  };

  const more = [
    { key: 'refresh', icon: <SyncOutlined />, label: t('sms.device.refresh'), onClick: ping },
    manage && { key: 'share', icon: <TeamOutlined />, label: t('sms.device.share'), onClick: () => setSharing(true) },
    manage && { key: 'token', icon: <KeyOutlined />, label: t('sms.token.rotate'), onClick: rotate },
    manage && { type: 'divider' },
    manage && { key: 'delete', danger: true, icon: <DeleteOutlined />, label: t('sms.delete'), onClick: remove },
  ].filter(Boolean);

  const activeSims = device.sims.filter((sim) => sim.active);
  const oldSims = device.sims.filter((sim) => !sim.active);

  return (
    <div className="sx-page">
      <header className="sx-device-hero" style={{ '--c': device.color || 'var(--da-primary)' }}>
        <div className="sx-device-hero__phone" aria-hidden>
          <span className="sx-device__notch" />
          <OnlineDot online={device.online} />
        </div>
        <div className="sx-device-hero__text">
          <span className="sx-eyebrow">{device.online ? t('sms.device.online') : t('sms.device.offline')}</span>
          <h1>{device.name}</h1>
          <p>
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
            {device.phoneName && ` · ${device.phoneName}`}
            {device.appVersion && ` · iSMS GW ${device.appVersion}`}
          </p>
          {device.description && <p className="sx-device-hero__desc">{device.description}</p>}
        </div>
        <div className="sx-device-hero__actions">
          {canSend && (
            <Button type="primary" size="large" icon={<SendOutlined />} onClick={() => navigate(`/app/sms/send?device=${device.id}`)}>
              {t('sms.nav.send')}
            </Button>
          )}
          <Dropdown menu={{ items: more }} trigger={['click']} placement="bottomRight">
            <Button size="large">{t('sms.more')}</Button>
          </Dropdown>
        </div>
      </header>

      {!device.enabled && <div className="sx-banner is-warning">{t('sms.device.disabledBanner')}</div>}
      {!device.lastSeenAt && manage && (
        <div className="sx-banner">
          <span>{t('sms.device.notConnectedBanner')}</span>
          <Button size="small" onClick={() => setTab('connection')}>
            {t('sms.device.howToConnect')}
          </Button>
        </div>
      )}

      <div className="sx-kpis">
        <Kpi icon="send" tone="sent" label={t('sms.overview.kpi.sent')} value={formatNumber(today.sent || 0, locale)} hint={t('sms.overview.kpi.parts', { count: today.parts || 0 })} />
        <Kpi icon="check" tone="delivered" label={t('sms.overview.kpi.delivered')} value={formatNumber(today.delivered || 0, locale)} hint={stats?.period?.deliveryRate != null ? t('sms.device.rateShort', { rate: stats.period.deliveryRate }) : ' '} />
        <Kpi icon="inbox" tone="received" label={t('sms.overview.kpi.received')} value={formatNumber(today.received || 0, locale)} hint={today.unread ? t('sms.overview.unread', { count: today.unread }) : t('sms.overview.kpi.allRead')} />
        <Kpi icon="hourglass" tone="queue" label={t('sms.overview.kpi.queue')} value={formatNumber((today.queued || 0) + (today.scheduled || 0), locale)} hint={device.online ? t('sms.overview.kpi.queueHint') : t('sms.device.queueOffline')} />
      </div>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        className="sx-tabs"
        items={[
          {
            key: 'sims',
            label: t('sms.device.tabs.sims', { count: activeSims.length }),
            children: (
              <div>
                {!device.sims.length ? (
                  <p className="sx-muted">{device.online ? t('sms.device.waitingSims') : t('sms.device.noSims')}</p>
                ) : (
                  <div className="sx-sims-grid">
                    {activeSims.map((sim) => (
                      <SimCard
                        key={sim.id}
                        sim={sim}
                        size="lg"
                        onClick={manage ? () => setEditing(sim) : undefined}
                        footer={
                          <span className="sx-sim__foot">
                            <span>
                              {t('sms.sim.today')}: <b>{formatNumber(sim.sentToday, locale)}</b>
                              {sim.dailyLimit ? ` / ${formatNumber(sim.dailyLimit, locale)}` : ''}
                            </span>
                            {sim.dailyLimit > 0 && (
                              <span className="sx-sim__bar">
                                <i style={{ width: `${Math.min(100, (sim.sentToday / sim.dailyLimit) * 100)}%` }} />
                              </span>
                            )}
                          </span>
                        }
                      />
                    ))}
                  </div>
                )}
                {oldSims.length > 0 && (
                  <>
                    <h3 className="sx-subhead">{t('sms.sim.removed')}</h3>
                    <div className="sx-sims-grid is-muted">
                      {oldSims.map((sim) => (
                        <SimCard key={sim.id} sim={sim} size="md" />
                      ))}
                    </div>
                  </>
                )}
                <section className="sx-card sx-card--chart sx-mt">
                  <header className="sx-card__head">
                    <div>
                      <h2>{t('sms.overview.chartTitle')}</h2>
                      <p>{t('sms.overview.chartLead', { days: 14 })}</p>
                    </div>
                  </header>
                  <TrafficChart series={stats?.series || []} height={200} />
                </section>
              </div>
            ),
          },
          manage && {
            key: 'connection',
            label: t('sms.device.tabs.connection'),
            children: (
              <div className="sx-stack">
                {newToken && (
                  <div className="sx-banner is-success">
                    <MenuIcon name="key" />
                    <span>{t('sms.token.newShown')}</span>
                  </div>
                )}
                <ConnectGuide url={deviceUrl()} token={newToken} tokenHidden={!newToken} />
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  className="sx-desc"
                  items={[
                    { key: 'prefix', label: t('sms.token.prefix'), children: <code>{device.tokenPrefix}_••••</code> },
                    { key: 'created', label: t('sms.token.created'), children: formatDateTime(device.tokenCreatedAt, locale) },
                    { key: 'uid', label: t('sms.device.uid'), children: device.deviceUid ? <code>{device.deviceUid}</code> : '—' },
                    { key: 'ip', label: t('sms.device.ip'), children: device.lastIp || '—' },
                    { key: 'version', label: t('sms.device.version'), children: device.appVersion || '—' },
                  ]}
                />
                <div>
                  <Button icon={<KeyOutlined />} onClick={rotate} danger>
                    {t('sms.token.rotate')}
                  </Button>
                </div>
              </div>
            ),
          },
          manage &&
            config?.canCreateTokens && {
              key: 'api',
              label: t('sms.device.tabs.api'),
              children: <PhoneTokens device={device} presetSimId={tokenSim} maxDays={config?.maxTokenDays || 0} onPresetUsed={() => setTokenSim(null)} />,
            },
          {
            key: 'journal',
            label: t('sms.device.tabs.journal'),
            children: <JournalTab deviceId={device.id} />,
          },
          manage && {
            key: 'settings',
            label: t('sms.device.tabs.settings'),
            children: (
              <SettingsTab
                device={device}
                onSaved={() => {
                  load();
                  refreshAll();
                }}
              />
            ),
          },
        ].filter(Boolean)}
      />

      <SimDialog
        sim={editing}
        onToken={
          config?.canCreateTokens
            ? (sim) => {
                setEditing(null);
                setTokenSim(sim.id);
                setTab('api');
              }
            : null
        }
        onClose={(saved) => {
          setEditing(null);
          if (saved) load();
        }}
      />
      {manage && (
        <AccessDialog
          open={sharing}
          title={device.name}
          load={() => smsApi.access(device.id)}
          loadSubjects={() => smsApi.subjects()}
          save={(entries) => smsApi.saveAccess(device.id, entries)}
          levelKey="sms.level"
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}
