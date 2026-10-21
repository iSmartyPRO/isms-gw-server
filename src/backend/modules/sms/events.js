import { query } from '../../config/database.js';
import { emitEvent } from '../../api/events.js';
import { notify } from '../../services/notifications.js';
import { tr } from '../../services/i18n/index.js';
import { contextFromRequest, levelOn, LEVEL } from '../shared/acl.js';

/*
 * What the gateway tells the outside world: webhook events (api/events.js)
 * and notifications (services/notifications.js). Never throws.
 */

export const ACL = 'sms_device_acl';

/** A message as the API and webhooks show it. */
export function messageShape(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    uuid: row.uuid,
    deviceId: row.device_id,
    deviceName: row.device_name ?? undefined,
    simId: row.sim_row_id,
    slot: row.slot,
    simLabel: row.sim_label ?? undefined,
    direction: row.direction,
    phone: row.phone,
    text: row.text,
    parts: row.parts,
    encoding: row.encoding,
    status: row.status,
    error: row.error,
    errorCode: row.error_code,
    ref: row.ref,
    batchId: row.batch_id,
    source: row.source,
    createdBy: row.created_by,
    isRead: row.is_read,
    attempts: row.attempts,
    sendAfter: row.send_after,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    dispatchedAt: row.dispatched_at,
    acceptedAt: row.accepted_at,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    failedAt: row.failed_at,
    updatedAt: row.updated_at,
  };
}

const canSeeDevice = (deviceId) => async (req) => (await levelOn(ACL, deviceId, contextFromRequest(req, 'sms.admin'))) >= LEVEL.view;

const EVENT_OF_STATUS = { sent: 'sms.sent', delivered: 'sms.delivered', failed: 'sms.failed', expired: 'sms.failed', received: 'sms.received' };

/** Webhook for a message that reached `row.status`. */
export async function emitMessage(row) {
  const type = EVENT_OF_STATUS[row?.status];
  if (!type || !row.device_id) return;
  await emitEvent(type, { data: { message: messageShape(row) }, visible: canSeeDevice(row.device_id) });
}

export async function emitDevice(type, device) {
  await emitEvent(type, {
    data: { device: { id: device.id, name: device.name, online: type === 'device.online', lastSeenAt: device.last_seen_at || null, appVersion: device.app_version || null } },
    visible: canSeeDevice(device.id),
  });
}

/** People with at least `level` on a phone through a personal or group grant (not "everyone"). */
export async function devicePeople(deviceId, level = LEVEL.view) {
  const { rows } = await query(
    `SELECT DISTINCT u.id
     FROM sms_device_acl a
     LEFT JOIN user_group_members m ON a.subject_type = 'group' AND m.group_id = a.subject_id
     JOIN users u ON u.id = CASE WHEN a.subject_type = 'user' THEN a.subject_id ELSE m.user_id END
     WHERE a.resource_id = $1 AND a.level >= $2 AND a.subject_type IN ('user', 'group')`,
    [deviceId, level]
  );
  return rows.map((row) => row.id);
}

const excerpt = (text, max = 160) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export async function notifyIncoming(device, row) {
  try {
    const userIds = await devicePeople(device.id, LEVEL.view);
    await notify({
      userIds,
      kind: 'sms.received',
      module: 'sms',
      link: `/app/sms/inbox?device=${device.id}&phone=${encodeURIComponent(row.phone)}`,
      render: (locale) => ({ title: tr(locale, 'sms.notify.received.title', { phone: row.phone, device: device.name }), body: excerpt(row.text) }),
    });
  } catch (err) {
    console.warn('[sms] incoming notification failed:', err.message);
  }
}

export async function notifyOffline(device, minutes) {
  try {
    const userIds = await devicePeople(device.id, LEVEL.manage);
    await notify({
      userIds,
      kind: 'sms.deviceOffline',
      module: 'sms',
      link: `/app/sms/devices/${device.id}`,
      render: (locale) => ({ title: tr(locale, 'sms.notify.offline.title', { device: device.name }), body: tr(locale, 'sms.notify.offline.body', { minutes }) }),
    });
  } catch (err) {
    console.warn('[sms] offline notification failed:', err.message);
  }
}

export async function logDeviceEvent(deviceId, kind, detail = null) {
  try {
    await query(`INSERT INTO sms_device_events (device_id, kind, detail) VALUES ($1, $2, $3)`, [deviceId, kind, detail ? JSON.stringify(detail) : null]);
  } catch (err) {
    console.warn('[sms] device event not saved:', err.message);
  }
}
