import { useMemo, useState } from 'react';
import { App, Button, Tooltip } from 'antd';
import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import { useLocale } from '../../../context/LocaleContext';
import { MenuIcon } from '../../../components/icons/menuIcons';
import { formatNumber, formatRelative } from '../../../lib/format';
import { SIM_COLORS, STATUS_COLORS } from '../api';

/* Small building blocks of the SMS module; styles in sms.css (.sx-*). */

export function StatusTag({ status, compact = false }) {
  const { t } = useLocale();
  return (
    <span className={`sx-status sx-status--${status}${compact ? ' is-compact' : ''}`} style={{ '--c': STATUS_COLORS[status] || '#868E96' }}>
      <span className="sx-status__dot" />
      {t(`sms.status.${status}`)}
    </span>
  );
}

/** Delivery ticks for chat bubbles: ⏱ queued, ✓ sent, ✓✓ delivered, ! failed. */
export function Ticks({ status }) {
  const { t } = useLocale();
  const title = t(`sms.status.${status}`);
  if (['failed', 'expired', 'cancelled'].includes(status)) {
    return (
      <span className="sx-ticks is-failed" title={title}>
        !
      </span>
    );
  }
  if (['scheduled', 'queued', 'dispatched'].includes(status)) {
    return (
      <span className="sx-ticks is-wait" title={title}>
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 4.8V8l2.2 1.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  const two = status === 'delivered';
  return (
    <span className={`sx-ticks${two ? ' is-delivered' : ''}${status === 'accepted' ? ' is-wait' : ''}`} title={title}>
      <svg viewBox="0 0 20 16" width="17" height="13" aria-hidden>
        <path d="M1.5 8.5 5 12l7-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {two && <path d="M8.6 11.6 9 12l7.5-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    </span>
  );
}

export function OnlineDot({ online, pulse = true }) {
  const { t } = useLocale();
  return <span className={`sx-online${online ? ' is-on' : ''}${online && pulse ? ' is-pulse' : ''}`} title={online ? t('sms.device.online') : t('sms.device.offline')} />;
}

/** A SIM card drawn like the real thing: cut corner, golden chip, carrier and number. */
export function SimCard({ sim, size = 'md', onClick, selected = false, footer = null }) {
  const { t } = useLocale();
  const color = sim.color || sim.phoneColor || SIM_COLORS[Math.max(0, (sim.slot || 1) - 1) % SIM_COLORS.length];
  const title = sim.label || sim.phoneLabel || sim.carrier || sim.displayName || t('sms.sim.slot', { slot: sim.slot });
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`sx-sim sx-sim--${size}${sim.active ? '' : ' is-inactive'}${selected ? ' is-selected' : ''}${onClick ? ' is-clickable' : ''}`}
      style={{ '--c': color }}
      onClick={onClick}
    >
      <span className="sx-sim__chip" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className="sx-sim__slot">{sim.embedded ? 'eSIM' : `SIM ${sim.slot || '—'}`}</span>
      <span className="sx-sim__name">{title}</span>
      <span className="sx-sim__number">{sim.number || (sim.iccTail ? `•••• ${sim.iccTail}` : t('sms.sim.noNumber'))}</span>
      {!sim.active && <span className="sx-sim__badge">{t('sms.sim.inactive')}</span>}
      {sim.active && sim.sendEnabled === false && <span className="sx-sim__badge">{t('sms.sim.sendOff')}</span>}
      {footer}
    </Tag>
  );
}

export function Kpi({ icon, label, value, hint, tone = 'primary', trend = null }) {
  return (
    <div className={`sx-kpi sx-kpi--${tone}`}>
      <div className="sx-kpi__icon">
        <MenuIcon name={icon} />
      </div>
      <div className="sx-kpi__body">
        <span className="sx-kpi__label">{label}</span>
        <strong className="sx-kpi__value">{value}</strong>
        {(hint || trend) && (
          <span className="sx-kpi__hint">
            {trend}
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

/** Copies text; falls back to execCommand where the Clipboard API is missing (plain http). */
export async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const area = document.createElement('textarea');
    area.value = value;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

/** Copy-to-clipboard field: monospace value with a copy button. */
export function Copyable({ value, secret = false, label }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(!secret);
  const copy = async () => {
    await copyText(value);
    setCopied(true);
    message.success(t('sms.copied'));
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="sx-copy">
      {label && <span className="sx-copy__label">{label}</span>}
      <div className="sx-copy__row">
        <code className="sx-copy__value" onClick={() => setShown(true)}>
          {shown ? value : `${value.slice(0, 15)}${'•'.repeat(18)}`}
        </code>
        <Tooltip title={copied ? t('sms.copied') : t('sms.copy')}>
          <Button type={copied ? 'primary' : 'default'} icon={copied ? <CheckOutlined /> : <CopyOutlined />} onClick={copy} aria-label={t('sms.copy')} />
        </Tooltip>
      </div>
    </div>
  );
}

export function Empty({ icon = 'sms', title, text, action }) {
  return (
    <div className="sx-empty">
      <div className="sx-empty__art" aria-hidden>
        <span className="sx-empty__ring" />
        <MenuIcon name={icon} />
      </div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Ago({ value }) {
  const { locale } = useLocale();
  if (!value) return null;
  return <time dateTime={value} title={new Date(value).toLocaleString()}>{formatRelative(value, locale)}</time>;
}

/**
 * Stacked area chart of the daily series (sent / delivered / failed / received), drawn in SVG.
 * `series` = [{ day: 'YYYY-MM-DD', sent, delivered, failed, received }].
 */
export function TrafficChart({ series = [], height = 220 }) {
  const { t, locale } = useLocale();
  const [hover, setHover] = useState(null);
  const width = 720;
  const pad = { top: 16, right: 28, bottom: 28, left: 36 };
  const lines = [
    { key: 'sent', color: 'var(--sx-sent)' },
    { key: 'received', color: 'var(--sx-received)' },
    { key: 'failed', color: 'var(--sx-failed)' },
  ];
  const geometry = useMemo(() => {
    const max = Math.max(4, ...series.flatMap((point) => lines.map((line) => point[line.key] || 0)));
    const nice = Math.ceil(max / 4) * 4;
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const x = (index) => pad.left + (series.length <= 1 ? innerW / 2 : (index / (series.length - 1)) * innerW);
    const y = (value) => pad.top + innerH - (value / nice) * innerH;
    const path = (key) => series.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point[key] || 0).toFixed(1)}`).join(' ');
    const area = (key) => `${path(key)} L${x(series.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
    return { nice, x, y, path, area, innerW };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, height]);
  if (!series.length) return null;
  const dayLabel = (day) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(`${day}T00:00:00`));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((share) => Math.round(geometry.nice * share));
  const step = Math.max(1, Math.ceil(series.length / 7));
  const point = hover !== null ? series[hover] : null;
  return (
    <div className="sx-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('sms.overview.chartTitle')} onMouseLeave={() => setHover(null)}>
        <defs>
          {lines.map((line) => (
            <linearGradient key={line.key} id={`sx-grad-${line.key}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={line.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={line.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((value) => (
          <g key={value}>
            <line x1={pad.left} x2={width - pad.right} y1={geometry.y(value)} y2={geometry.y(value)} className="sx-chart__grid" />
            <text x={pad.left - 8} y={geometry.y(value) + 4} className="sx-chart__axis" textAnchor="end">
              {formatNumber(value, locale)}
            </text>
          </g>
        ))}
        {series.map((item, index) =>
          index % step === 0 || index === series.length - 1 ? (
            <text key={item.day} x={geometry.x(index)} y={height - 8} className="sx-chart__axis" textAnchor="middle">
              {dayLabel(item.day)}
            </text>
          ) : null
        )}
        {lines.map((line) => (
          <g key={line.key}>
            <path d={geometry.area(line.key)} fill={`url(#sx-grad-${line.key})`} />
            <path d={geometry.path(line.key)} fill="none" stroke={line.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        ))}
        {hover !== null && <line x1={geometry.x(hover)} x2={geometry.x(hover)} y1={pad.top} y2={height - pad.bottom} className="sx-chart__cursor" />}
        {hover !== null &&
          lines.map((line) => <circle key={line.key} cx={geometry.x(hover)} cy={geometry.y(series[hover][line.key] || 0)} r="4.5" fill="var(--da-surface)" stroke={line.color} strokeWidth="2.4" />)}
        {series.map((item, index) => (
          <rect
            key={item.day}
            x={geometry.x(index) - geometry.innerW / Math.max(1, series.length - 1) / 2}
            y={pad.top}
            width={geometry.innerW / Math.max(1, series.length - 1)}
            height={height - pad.top - pad.bottom}
            fill="transparent"
            onMouseEnter={() => setHover(index)}
          />
        ))}
      </svg>
      <div className="sx-chart__legend">
        {lines.map((line) => (
          <span key={line.key} style={{ '--c': line.color }}>
            <i />
            {t(`sms.overview.series.${line.key}`)}
            {point && <b>{formatNumber(point[line.key] || 0, locale)}</b>}
          </span>
        ))}
        {point && <span className="sx-chart__day">{dayLabel(point.day)}</span>}
      </div>
    </div>
  );
}

/** A ring showing a share (delivery rate). */
export function Ring({ value, size = 88, label }) {
  const radius = (size - 12) / 2;
  const length = 2 * Math.PI * radius;
  const share = value === null || value === undefined ? 0 : Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="sx-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} className="sx-ring__track" />
        <circle cx={size / 2} cy={size / 2} r={radius} className="sx-ring__bar" strokeDasharray={`${length * share} ${length}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="sx-ring__value">{value === null || value === undefined ? '—' : `${Math.round(value)}%`}</span>
      {label && <span className="sx-ring__label">{label}</span>}
    </div>
  );
}

/** "+996 555 123 456" for display; the stored value stays E.164. */
export function prettyPhone(phone) {
  const value = String(phone || '');
  if (!/^\+\d{8,15}$/.test(value)) return value;
  const digits = value.slice(1);
  const cc = digits.length > 11 ? 3 : digits.length === 11 ? (digits.startsWith('7') || digits.startsWith('1') ? 1 : 2) : 2;
  const rest = digits.slice(cc);
  return `+${digits.slice(0, cc)} ${rest.replace(/(\d{3})(?=\d{3,})/g, '$1 ').trim()}`;
}
