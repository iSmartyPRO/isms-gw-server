import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Form, Input, Modal, Steps } from 'antd';
import QRCode from 'qrcode';
import { useLocale } from '../../../context/LocaleContext';
import { errorMessage } from '../../../lib/errors';
import { MenuIcon } from '../../../components/icons/menuIcons';
import { deviceUrl, smsApi, SIM_COLORS } from '../api';
import { Copyable, SimCard } from './ui';

/**
 * The QR code carries both values as text (address on the first line, token
 * on the second): scan it with the phone's camera to copy them, or type them
 * in iSMS GW → Settings → SMS server.
 */
function ConnectQr({ url, token }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(`${url}\n${token}`, { margin: 1, width: 220, errorCorrectionLevel: 'M', color: { dark: '#0B1220', light: '#FFFFFF' } })
      .then(setSrc)
      .catch(() => setSrc(''));
  }, [url, token]);
  return src ? <img className="sx-qr" src={src} width={180} height={180} alt="QR" /> : <div className="sx-qr sx-qr--empty" />;
}

/** Instructions for the iSMS GW app, shared by the wizard and the phone page. */
export function ConnectGuide({ url, token, tokenHidden = false }) {
  const { t } = useLocale();
  return (
    <div className="sx-connect">
      <div className="sx-connect__fields">
        <Copyable label={t('sms.connect.url')} value={url} />
        {token ? <Copyable label={t('sms.connect.token')} value={token} secret /> : tokenHidden && <p className="sx-muted">{t('sms.connect.tokenHidden')}</p>}
        <ol className="sx-connect__steps">
          <li>
            {t('sms.connect.steps.install')}{' '}
            <a href="https://github.com/iSmartyPRO/isms-gw-android/releases/latest" target="_blank" rel="noreferrer">
              {t('sms.connect.download')}
            </a>
          </li>
          <li>{t('sms.connect.steps.open')}</li>
          <li>{t('sms.connect.steps.paste')}</li>
          <li>{t('sms.connect.steps.enable')}</li>
          <li>{t('sms.connect.steps.battery')}</li>
        </ol>
      </div>
      {token && (
        <div className="sx-connect__qr">
          <ConnectQr url={url} token={token} />
          <span>{t('sms.connect.qrHint')}</span>
        </div>
      )}
    </div>
  );
}

export default function AddDeviceWizard({ open, onClose }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const [live, setLive] = useState(null);
  const [color, setColor] = useState(SIM_COLORS[0]);
  const navigate = useNavigate();
  const url = deviceUrl();

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setCreated(null);
    setLive(null);
    setColor(SIM_COLORS[Math.floor(Math.random() * SIM_COLORS.length)]);
    form.resetFields();
  }, [open, form]);

  // Waiting for the phone: poll until it is online and has told us its SIM cards.
  // Stops when the wizard is closed (it stays mounted on the phones page).
  useEffect(() => {
    if (!open || step !== 1 || !created) return undefined;
    let alive = true;
    let busy = false;
    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const { data } = await smsApi.device(created.id);
        if (alive && data.device.online) {
          setLive(data.device);
          if (data.device.sims.length) setStep(2);
        }
      } catch {
        /* keep waiting */
      } finally {
        busy = false;
      }
    }, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [open, step, created]);

  const create = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const { data } = await smsApi.createDevice({ ...values, color });
      setCreated({ ...data.device, token: data.token });
      setStep(1);
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const close = () => onClose(created?.id || null);

  return (
    <Modal open={open} onCancel={close} footer={null} width={760} className="sx-wizard" destroyOnClose maskClosable={step !== 1} keyboard={step !== 1}>
      <div className="sx-wizard__head">
        <span className="sx-wizard__badge">
          <MenuIcon name="smartphone" />
        </span>
        <div>
          <h2>{t('sms.wizard.title')}</h2>
          <p>{t('sms.wizard.lead')}</p>
        </div>
      </div>
      <Steps
        size="small"
        current={step}
        className="sx-wizard__steps"
        items={[{ title: t('sms.wizard.steps.name') }, { title: t('sms.wizard.steps.connect') }, { title: t('sms.wizard.steps.ready') }]}
      />

      {step === 0 && (
        <Form form={form} layout="vertical" requiredMark={false} onFinish={create} className="sx-wizard__body">
          <Form.Item name="name" label={t('sms.device.name')} rules={[{ required: true, whitespace: true, message: t('sms.device.nameRequired') }]}>
            <Input size="large" autoFocus maxLength={120} placeholder={t('sms.device.namePlaceholder')} />
          </Form.Item>
          <Form.Item name="description" label={t('sms.device.description')}>
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={1000} placeholder={t('sms.device.descriptionPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('sms.device.color')}>
            <div className="sx-swatches">
              {SIM_COLORS.map((value) => (
                <button key={value} type="button" className={`sx-swatch${value === color ? ' is-active' : ''}`} style={{ '--c': value }} onClick={() => setColor(value)} aria-label={value} />
              ))}
            </div>
          </Form.Item>
          <div className="sx-wizard__footer">
            <Button onClick={close}>{t('sms.cancel')}</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {t('sms.wizard.next')}
            </Button>
          </div>
        </Form>
      )}

      {step === 1 && created && (
        <div className="sx-wizard__body">
          <div className="sx-wizard__note">
            <MenuIcon name="key" />
            <span>{t('sms.wizard.tokenOnce')}</span>
          </div>
          <ConnectGuide url={url} token={created.token} />
          <div className={`sx-waiting${live ? ' is-online' : ''}`}>
            <span className="sx-waiting__pulse" />
            <div>
              <strong>{live ? t('sms.wizard.onlineWaitingSims') : t('sms.wizard.waiting')}</strong>
              <span>{live ? t('sms.wizard.onlineWaitingSimsHint') : t('sms.wizard.waitingHint')}</span>
            </div>
          </div>
          <div className="sx-wizard__footer">
            <Button onClick={close}>{t('sms.wizard.later')}</Button>
          </div>
        </div>
      )}

      {step === 2 && live && (
        <div className="sx-wizard__body sx-wizard__done">
          <div className="sx-confetti" aria-hidden>
            {Array.from({ length: 18 }).map((_, index) => (
              <i key={index} style={{ '--i': index }} />
            ))}
          </div>
          <div className="sx-done-badge">
            <MenuIcon name="check" />
          </div>
          <h3>{t('sms.wizard.doneTitle', { name: live.name })}</h3>
          <p>{t('sms.wizard.doneText', { count: live.sims.filter((sim) => sim.active).length, version: live.appVersion || '—' })}</p>
          <div className="sx-sims-row">
            {live.sims.map((sim) => (
              <SimCard key={sim.id} sim={sim} />
            ))}
          </div>
          <div className="sx-wizard__footer is-center">
            <Button size="large" onClick={close}>
              {t('sms.wizard.openPhone')}
            </Button>
            <Button
              size="large"
              type="primary"
              onClick={() => {
                onClose(null);
                navigate(`/app/sms/send?device=${live.id}`);
              }}
            >
              {t('sms.wizard.sendFirst')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
