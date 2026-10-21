import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Form, Input, InputNumber, Switch } from 'antd';
import SaveBar from '../../components/ui/SaveBar';
import LoadState from '../../components/ui/LoadState';
import { SettingRow, SettingsSection } from '../../components/ui/SettingsSection';
import { useAdminSettings } from '../../hooks/useAdminSettings';
import { useSettingsForm } from '../../hooks/useSettingsForm';
import { useLocale } from '../../context/LocaleContext';
import SettingsPageHeader from '../../pages/admin/settings/SettingsPageHeader';

function SmsForm({ settings, save }) {
  const { t } = useLocale();
  const state = settings.modules?.sms || { enabled: true, settings: {} };
  const initial = useMemo(() => ({ enabled: state.enabled, ...state.settings }), [state]);
  const { dirty, saving, submit, reset, formProps } = useSettingsForm(initial, ({ enabled, ...rest }) =>
    save({ modules: { sms: { enabled, settings: { ...rest, defaultCountry: String(rest.defaultCountry || '').toUpperCase() } } } })
  );
  const row = (name, min, max, suffix) => (
    <SettingRow label={t(`smsSettings.${name}`)} description={t(`smsSettings.${name}Desc`)}>
      <Form.Item name={name} noStyle>
        <InputNumber min={min} max={max} suffix={suffix} style={{ width: 180 }} />
      </Form.Item>
    </SettingRow>
  );
  return (
    <Form {...formProps}>
      <SettingsSection>
        <SettingRow label={t('modules.enabledLabel')} description={t('smsSettings.enabledDesc')}>
          <Form.Item name="enabled" valuePropName="checked" noStyle>
            <Switch />
          </Form.Item>
        </SettingRow>
        <SettingRow label={t('smsSettings.open')} description={t('smsSettings.openDesc')}>
          <Link to="/app/sms">{t('smsSettings.openLink')} →</Link>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t('smsSettings.devices')} description={t('smsSettings.devicesDesc')}>
        <SettingRow label={t('smsSettings.userDevices')} description={t('smsSettings.userDevicesDesc')}>
          <Form.Item name="userDevices" valuePropName="checked" noStyle>
            <Switch />
          </Form.Item>
        </SettingRow>
        {row('maxDevicesPerUser', 1, 500)}
        {row('offlineAlertMinutes', 0, 1440, t('smsSettings.min'))}
      </SettingsSection>

      <SettingsSection title={t('smsSettings.sending')} description={t('smsSettings.sendingDesc')}>
        <SettingRow label={t('smsSettings.defaultCountry')} description={t('smsSettings.defaultCountryDesc')}>
          <Form.Item name="defaultCountry" noStyle rules={[{ pattern: /^([A-Za-z]{2})?$/ }]}>
            <Input maxLength={2} style={{ width: 90, textTransform: 'uppercase' }} placeholder="KG" />
          </Form.Item>
        </SettingRow>
        {row('ratePerMinute', 1, 120, t('smsSettings.perMinute'))}
        {row('queueTtlHours', 1, 720, t('smsSettings.hours'))}
        {row('ackTimeoutSec', 10, 600, t('smsSettings.sec'))}
        {row('maxAttempts', 1, 10)}
        {row('maxRecipients', 1, 10000)}
        {row('maxTextLength', 70, 5000)}
      </SettingsSection>

      <SettingsSection title={t('smsSettings.storage')} description={t('smsSettings.storageDesc')}>
        {row('retentionDays', 0, 3650, t('smsSettings.days'))}
      </SettingsSection>
      <SaveBar visible={dirty} saving={saving} onSave={submit} onReset={reset} />
    </Form>
  );
}

/** Settings → Modules → SMS gateway. */
export default function SmsSettings() {
  const { settings, ready, error, refresh, save } = useAdminSettings();
  return (
    <>
      <SettingsPageHeader id="sms" />
      <LoadState ready={ready} error={error} onRetry={refresh}>
        {settings && <SmsForm settings={settings} save={save} />}
      </LoadState>
    </>
  );
}
