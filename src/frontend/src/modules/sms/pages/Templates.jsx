import { useEffect, useState } from 'react';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { App, Button, Form, Input, Modal, Skeleton, Switch } from 'antd';
import { useLocale } from '../../../context/LocaleContext';
import { MenuIcon } from '../../../components/icons/menuIcons';
import { errorMessage } from '../../../lib/errors';
import { smsApi, smsSegments } from '../api';
import { Empty } from '../components/ui';

function TemplateDialog({ template, onClose }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const text = Form.useWatch('text', form) || '';
  useEffect(() => {
    if (template) form.setFieldsValue({ name: template.name || '', text: template.text || '', shared: Boolean(template.shared) });
  }, [template, form]);
  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (template.id) await smsApi.updateTemplate(template.id, values);
      else await smsApi.createTemplate(values);
      message.success(t('sms.saved'));
      onClose(true);
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const info = smsSegments(text);
  return (
    <Modal open={Boolean(template)} title={template?.id ? t('sms.templates.edit') : t('sms.templates.new')} onCancel={() => onClose(false)} onOk={save} confirmLoading={saving} okText={t('sms.save')} cancelText={t('sms.cancel')} destroyOnClose>
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="name" label={t('sms.templates.name')} rules={[{ required: true, whitespace: true, message: t('sms.templates.nameRequired') }]}>
          <Input maxLength={120} autoFocus />
        </Form.Item>
        <Form.Item name="text" label={t('sms.compose.text')} rules={[{ required: true, whitespace: true, message: t('sms.templates.textRequired') }]} extra={`${info.encoding} · ${t('sms.compose.chars', { count: info.length })} · ${t('sms.compose.partsLabel', { count: info.parts })}`}>
          <Input.TextArea autoSize={{ minRows: 4, maxRows: 12 }} maxLength={5000} />
        </Form.Item>
        <Form.Item name="shared" label={t('sms.templates.shared')} valuePropName="checked" extra={t('sms.templates.sharedHint')}>
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default function Templates() {
  const { t } = useLocale();
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null);
  const load = () =>
    smsApi
      .templates()
      .then(({ data }) => setList(data.templates))
      .catch((err) => {
        message.error(errorMessage(err));
        setList([]);
      });
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = (template) =>
    modal.confirm({
      title: t('sms.templates.deleteTitle', { name: template.name }),
      okText: t('sms.delete'),
      okButtonProps: { danger: true },
      cancelText: t('sms.cancel'),
      onOk: async () => {
        try {
          await smsApi.deleteTemplate(template.id);
          load();
        } catch (err) {
          message.error(errorMessage(err));
        }
      },
    });

  return (
    <div className="sx-page">
      <header className="mod-hero" style={{ '--c': '#7950F2' }}>
        <span className="mod-hero__badge">
          <MenuIcon name="clipboard" />
        </span>
        <div className="mod-hero__text">
          <h1>{t('sms.templates.title')}</h1>
          <p>{t('sms.templates.lead')}</p>
        </div>
        <div className="mod-hero__actions">
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setEditing({})}>
            {t('sms.templates.new')}
          </Button>
        </div>
      </header>
      {list === null ? (
        <Skeleton active />
      ) : list.length === 0 ? (
        <Empty icon="clipboard" title={t('sms.templates.emptyTitle')} text={t('sms.templates.emptyText')} action={<Button type="primary" onClick={() => setEditing({})}>{t('sms.templates.new')}</Button>} />
      ) : (
        <div className="sx-templates">
          {list.map((template) => {
            const info = smsSegments(template.text);
            return (
              <article key={template.id} className="sx-template">
                <header>
                  <h3>{template.name}</h3>
                  {template.shared && <span className="sx-pill">{t('sms.templates.sharedBadge')}</span>}
                </header>
                <p className="sx-template__text">{template.text}</p>
                <footer>
                  <span className="sx-muted">
                    {info.encoding} · {t('sms.compose.partsLabel', { count: info.parts })}
                    {!template.mine && template.ownerName ? ` · ${template.ownerName}` : ''}
                  </span>
                  <span className="sx-template__actions">
                    <Button size="small" type="primary" onClick={() => navigate(`/app/sms/send?text=${encodeURIComponent(template.text)}`)}>
                      {t('sms.templates.use')}
                    </Button>
                    {template.mine && (
                      <>
                        <Button size="small" onClick={() => setEditing(template)}>
                          {t('sms.edit')}
                        </Button>
                        <Button size="small" danger type="text" onClick={() => remove(template)} icon={<DeleteOutlined />} aria-label={t('sms.delete')} />
                      </>
                    )}
                  </span>
                </footer>
              </article>
            );
          })}
        </div>
      )}
      <TemplateDialog
        template={editing}
        onClose={(saved) => {
          setEditing(null);
          if (saved) load();
        }}
      />
    </div>
  );
}
