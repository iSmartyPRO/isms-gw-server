import { useCallback, useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { DownloadOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { App, Button, DatePicker, Descriptions, Drawer, Input, Segmented, Select, Space, Steps, Table, Tag } from 'antd';
import { useLocale } from '../../../context/LocaleContext';
import { MenuIcon } from '../../../components/icons/menuIcons';
import { errorMessage } from '../../../lib/errors';
import { formatDateTime, formatNumber } from '../../../lib/format';
import { smsApi } from '../api';
import { useSms } from '../SmsContext';
import { StatusTag, prettyPhone } from '../components/ui';

const { RangePicker } = DatePicker;
const STEPS = ['createdAt', 'dispatchedAt', 'acceptedAt', 'sentAt', 'deliveredAt'];

function MessageDrawer({ message: item, onClose, onChanged }) {
  const { t, locale } = useLocale();
  const { message } = App.useApp();
  if (!item) return null;
  const failed = ['failed', 'expired', 'cancelled'].includes(item.status);
  const reached = STEPS.filter((key) => item[key]).length;
  const act = async (fn) => {
    try {
      const { data } = await fn(item.id);
      onChanged(data.message);
    } catch (err) {
      message.error(errorMessage(err));
    }
  };
  return (
    <Drawer open onClose={onClose} width={520} title={t(`sms.direction.${item.direction}`)} className="sx-drawer">
      <div className={`sx-bubble is-${item.direction} is-wide`}>
        <span className="sx-bubble__text">{item.text}</span>
      </div>
      {item.direction === 'out' && (
        <Steps
          direction="vertical"
          size="small"
          className="sx-steps"
          current={failed ? reached : reached - 1}
          status={failed ? 'error' : item.status === 'delivered' ? 'finish' : 'process'}
          items={STEPS.map((key) => ({ title: t(`sms.timeline.${key}`), description: item[key] ? formatDateTime(item[key], locale, { dateStyle: 'medium', timeStyle: 'medium' }) : '—' })).concat(
            failed ? [{ title: t(`sms.status.${item.status}`), description: item.error || formatDateTime(item.failedAt, locale) }] : []
          )}
        />
      )}
      <Descriptions
        column={1}
        size="small"
        bordered
        className="sx-desc"
        items={[
          { key: 'status', label: t('sms.messages.col.status'), children: <StatusTag status={item.status} /> },
          { key: 'phone', label: t('sms.messages.col.phone'), children: prettyPhone(item.phone) },
          { key: 'device', label: t('sms.messages.col.device'), children: `${item.deviceName || '—'}${item.simLabel ? ` · ${item.simLabel}` : ''}${item.slot ? ` · SIM ${item.slot}` : ''}` },
          { key: 'parts', label: t('sms.messages.col.parts'), children: `${item.parts} · ${item.encoding || '—'}` },
          { key: 'source', label: t('sms.messages.col.source'), children: t(`sms.source.${item.source}`) },
          item.ref && { key: 'ref', label: t('sms.compose.ref'), children: <code>{item.ref}</code> },
          item.sendAfter && { key: 'sendAfter', label: t('sms.messages.sendAfter'), children: formatDateTime(item.sendAfter, locale) },
          item.attempts > 0 && { key: 'attempts', label: t('sms.messages.attempts'), children: item.attempts },
          item.errorCode && { key: 'code', label: t('sms.messages.errorCode'), children: <code>{item.errorCode}</code> },
          { key: 'uuid', label: 'UUID', children: <code className="sx-small">{item.uuid}</code> },
        ].filter(Boolean)}
      />
      <Space className="sx-mt">
        {['queued', 'scheduled'].includes(item.status) && (
          <Button danger onClick={() => act(smsApi.cancel)}>
            {t('sms.messages.cancel')}
          </Button>
        )}
        {item.direction === 'out' && failed && (
          <Button type="primary" onClick={() => act(smsApi.retry)}>
            {t('sms.retry')}
          </Button>
        )}
      </Space>
    </Drawer>
  );
}

export default function Messages() {
  const { t, locale } = useLocale();
  const { message } = App.useApp();
  const [params, setParams] = useSearchParams();
  const { devices } = useSms();
  const [rows, setRows] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState(params.get('q') || '');

  const filters = {
    direction: params.get('direction') || undefined,
    status: params.get('status') || undefined,
    deviceId: params.get('deviceId') || undefined,
    phone: params.get('phone') || undefined,
    batchId: params.get('batchId') || undefined,
    q: params.get('q') || undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
  };
  const key = JSON.stringify(filters);

  const seq = useRef(0);
  const load = useCallback(
    async (before = null) => {
      // Only the latest request may fill the table (filters can change while one is on the way).
      const mine = ++seq.current;
      setLoading(true);
      try {
        const query = { ...JSON.parse(key), before: before || undefined, limit: 50 };
        const [{ data }, count] = await Promise.all([smsApi.messages(query), before ? Promise.resolve(null) : smsApi.count(JSON.parse(key))]);
        if (mine !== seq.current) return;
        setRows((list) => (before ? [...list, ...data.messages] : data.messages));
        setNext(data.next);
        if (count) setTotal(count.data.count);
      } catch (err) {
        if (mine === seq.current) message.error(errorMessage(err));
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    },
    [key, message]
  );

  useEffect(() => {
    load();
  }, [load]);

  const set = (name, value) => {
    const nextParams = new URLSearchParams(params);
    if (value === undefined || value === null || value === '' || value === 'all') nextParams.delete(name);
    else nextParams.set(name, value);
    setParams(nextParams);
  };

  const columns = [
    {
      title: '',
      dataIndex: 'direction',
      width: 44,
      render: (direction) => <span className={`sx-feed__dir is-${direction}`}>{direction === 'in' ? '↙' : '↗'}</span>,
    },
    {
      title: t('sms.messages.col.phone'),
      dataIndex: 'phone',
      width: 170,
      render: (phone) => <strong className="sx-nowrap">{prettyPhone(phone)}</strong>,
    },
    {
      title: t('sms.messages.col.text'),
      dataIndex: 'text',
      ellipsis: true,
      render: (text, row) => (
        <span className="sx-cell-text">
          {text}
          {row.parts > 1 && <Tag className="sx-parts">×{row.parts}</Tag>}
        </span>
      ),
    },
    {
      title: t('sms.messages.col.device'),
      dataIndex: 'deviceName',
      width: 180,
      responsive: ['lg'],
      render: (name, row) => (
        <span className="sx-muted sx-nowrap">
          {name}
          {row.simLabel ? ` · ${row.simLabel}` : ''}
        </span>
      ),
    },
    {
      title: t('sms.messages.col.status'),
      dataIndex: 'status',
      width: 140,
      render: (status) => <StatusTag status={status} compact />,
    },
    {
      title: t('sms.messages.col.time'),
      dataIndex: 'createdAt',
      width: 170,
      responsive: ['md'],
      render: (value) => <span className="sx-muted sx-nowrap">{formatDateTime(value, locale)}</span>,
    },
  ];

  return (
    <div className="sx-page">
      <header className="mod-hero" style={{ '--c': '#4C6EF5' }}>
        <span className="mod-hero__badge">
          <MenuIcon name="table" />
        </span>
        <div className="mod-hero__text">
          <h1>{t('sms.messages.title')}</h1>
          <p>{total === null ? t('sms.messages.lead') : t('sms.messages.found', { count: total })}</p>
        </div>
        <div className="mod-hero__actions">
          <Button icon={<DownloadOutlined />} href={smsApi.exportUrl(filters)}>
            {t('sms.messages.export')}
          </Button>
        </div>
      </header>

      <div className="sx-filters">
        <Segmented
          value={filters.direction || 'all'}
          onChange={(value) => set('direction', value)}
          options={[
            { value: 'all', label: t('sms.messages.filter.all') },
            { value: 'out', label: t('sms.direction.out') },
            { value: 'in', label: t('sms.direction.in') },
          ]}
        />
        <Select
          value={filters.status || 'all'}
          onChange={(value) => set('status', value)}
          style={{ minWidth: 170 }}
          options={[
            { value: 'all', label: t('sms.messages.filter.anyStatus') },
            { value: 'pending', label: t('sms.messages.filter.pending') },
            { value: 'done', label: t('sms.messages.filter.done') },
            { value: 'delivered', label: t('sms.status.delivered') },
            { value: 'problem', label: t('sms.messages.filter.problem') },
            { value: 'received', label: t('sms.status.received') },
            { value: 'scheduled', label: t('sms.status.scheduled') },
          ]}
        />
        {devices.length > 1 && (
          <Select
            value={filters.deviceId ? Number(filters.deviceId) : 'all'}
            onChange={(value) => set('deviceId', value)}
            style={{ minWidth: 170 }}
            options={[{ value: 'all', label: t('sms.inbox.allDevices') }, ...devices.map((device) => ({ value: device.id, label: device.name }))]}
          />
        )}
        <RangePicker
          allowEmpty={[true, true]}
          value={filters.from || filters.to ? [filters.from ? dayjs(filters.from) : null, filters.to ? dayjs(filters.to) : null] : null}
          onChange={(range) => {
            const nextParams = new URLSearchParams(params);
            if (range?.[0]) nextParams.set('from', range[0].startOf('day').toISOString());
            else nextParams.delete('from');
            if (range?.[1]) nextParams.set('to', range[1].endOf('day').toISOString());
            else nextParams.delete('to');
            setParams(nextParams);
          }}
        />
        <Input.Search allowClear placeholder={t('sms.messages.search')} value={q} onChange={(event) => setQ(event.target.value)} onSearch={(value) => set('q', value.trim())} style={{ maxWidth: 260 }} />
        {(filters.phone || filters.batchId) && (
          <Tag
            closable
            onClose={(event) => {
              event.preventDefault();
              const nextParams = new URLSearchParams(params);
              nextParams.delete('phone');
              nextParams.delete('batchId');
              setParams(nextParams);
            }}
            color="blue"
          >
            {filters.phone ? prettyPhone(filters.phone) : t('sms.messages.batch')}
          </Tag>
        )}
      </div>

      <Table
        className="sx-table"
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading && !rows.length}
        pagination={false}
        scroll={{ x: 640 }}
        size="middle"
        onRow={(row) => ({ onClick: () => setSelected(row), style: { cursor: 'pointer' } })}
        locale={{ emptyText: t('sms.messages.empty') }}
      />
      {next && (
        <div className="sx-more">
          <Button loading={loading} onClick={() => load(next)}>
            {t('sms.messages.more')}
          </Button>
          {total !== null && <span className="sx-muted">{t('sms.messages.shown', { shown: formatNumber(rows.length, locale), total: formatNumber(total, locale) })}</span>}
        </div>
      )}
      <MessageDrawer
        message={selected}
        onClose={() => setSelected(null)}
        onChanged={(updated) => {
          setSelected(updated);
          setRows((list) => list.map((row) => (row.id === updated.id ? updated : row)));
        }}
      />
    </div>
  );
}
