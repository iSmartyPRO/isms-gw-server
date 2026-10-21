import { query, withTransaction } from '../../config/database.js';
import { getSettingsView } from '../../services/settings.js';
import { portalRegional } from '../../services/regional.js';
import { isoDay, startOfDay } from '../../services/datetime.js';
import { cleanEntries, httpError, LEVEL, LEVEL_NAMES, levelMap, levelOn, readAcl, requireLevel } from '../shared/acl.js';
import { parseRecipients, smsSegments } from './phone.js';
import { planBatch, usable } from './routing.js';
import { newDeviceToken } from './tokens.js';
import { ACL, emitMessage, logDeviceEvent, messageShape } from './events.js';
import { disconnect, isOnline, kick, loadMessage, requestStatus } from './hub.js';

/*
 * The SMS gateway's business logic. Every function takes the access context
 * of the caller (modules/shared/acl.js → contextFromRequest(req, 'sms.admin')):
 *   view   read the phone, its SIMs and messages
 *   edit   send through the phone
 *   manage change it, share it, see and replace its token, delete it
 * sms.admin has manage on every phone unless an API token narrows it.
 */

export const moduleSettings = async () => (await getSettingsView()).modules.sms?.settings || {};

const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const HEX = /^#[0-9a-f]{6}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clampInt = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

// ── Devices ──

function simShape(row) {
  return {
    id: row.id,
    simId: row.sim_id,
    slot: row.slot,
    active: row.active,
    embedded: row.embedded,
    carrier: row.carrier,
    displayName: row.display_name,
    number: row.number,
    country: row.country,
    phoneLabel: row.phone_label,
    phoneColor: row.phone_color,
    phoneSend: row.phone_send,
    phoneReceive: row.phone_receive,
    iccTail: row.icc_tail,
    label: row.label,
    color: row.color,
    sendEnabled: row.send_enabled,
    dailyLimit: row.daily_limit,
    sentToday: Number(row.sent_today || 0),
    receivedToday: Number(row.received_today || 0),
    lastSeenAt: row.last_seen_at,
  };
}

function deviceShape(row, level, sims = []) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    enabled: row.enabled,
    online: isOnline(row.id),
    ownerId: row.owner_id,
    ownerName: row.owner_name ?? null,
    phoneName: row.phone_name,
    deviceUid: level >= LEVEL.manage ? row.device_uid : undefined,
    appVersion: row.app_version,
    connectedAt: row.connected_at,
    lastSeenAt: row.last_seen_at,
    lastIp: level >= LEVEL.manage ? row.last_ip : undefined,
    tokenPrefix: level >= LEVEL.manage ? row.token_prefix : undefined,
    tokenCreatedAt: level >= LEVEL.manage ? row.token_created_at : undefined,
    ratePerMinute: row.rate_per_minute,
    phoneStats: row.stats || null,
    sentToday: Number(row.sent_today || 0),
    receivedToday: Number(row.received_today || 0),
    failedToday: Number(row.failed_today || 0),
    queued: Number(row.queued || 0),
    level: LEVEL_NAMES[level],
    sims,
    createdAt: row.created_at,
  };
}

/** "Today" starts at midnight in the portal's time zone (Settings → Region), not the database's. */
async function portalDay() {
  const zone = (await portalRegional()).timeZone;
  return { zone, today: startOfDay(new Date(), zone) };
}

// `today` is the placeholder of the start-of-day parameter.
const deviceSelect = (today) => `
  SELECT d.*, COALESCE(u.display_name, u.username) AS owner_name,
    (SELECT COUNT(*) FROM sms_messages WHERE device_id = d.id AND direction = 'out' AND status IN ('sent', 'delivered') AND created_at >= ${today}) AS sent_today,
    (SELECT COUNT(*) FROM sms_messages WHERE device_id = d.id AND direction = 'in' AND created_at >= ${today}) AS received_today,
    (SELECT COUNT(*) FROM sms_messages WHERE device_id = d.id AND direction = 'out' AND status = 'failed' AND created_at >= ${today}) AS failed_today,
    (SELECT COUNT(*) FROM sms_messages WHERE device_id = d.id AND status IN ('queued', 'scheduled', 'dispatched')) AS queued
  FROM sms_devices d LEFT JOIN users u ON u.id = d.owner_id`;

async function simsOf(deviceIds) {
  if (!deviceIds.length) return new Map();
  const { rows } = await query(
    `SELECT s.*,
       (SELECT COUNT(*) FROM sms_messages m WHERE m.sim_row_id = s.id AND m.direction = 'out'
          AND m.status NOT IN ('failed', 'cancelled', 'expired') AND m.created_at >= $2) AS sent_today,
       (SELECT COUNT(*) FROM sms_messages m WHERE m.sim_row_id = s.id AND m.direction = 'in' AND m.created_at >= $2) AS received_today
     FROM sms_sims s WHERE s.device_id = ANY($1) ORDER BY s.active DESC, s.slot, s.id`,
    [deviceIds, (await portalDay()).today]
  );
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.device_id)) map.set(row.device_id, []);
    map.get(row.device_id).push(simShape(row));
  }
  return map;
}

/** Phones the caller can see, with their level: [{ row, level }]. */
async function visibleDevices(ctx, minLevel = LEVEL.view) {
  const levels = await levelMap(ACL, ctx);
  const allowed = (await query(`SELECT id FROM sms_devices`)).rows.map((row) => row.id).filter((id) => levels.of(id) >= minLevel);
  if (!allowed.length) return [];
  // Counters only for the phones the caller sees.
  const { rows } = await query(`${deviceSelect('$2')} WHERE d.id = ANY($1) ORDER BY LOWER(d.name), d.id`, [allowed, (await portalDay()).today]);
  return rows.map((row) => ({ row, level: levels.of(row.id) }));
}

/** Ids of the phones the caller sees (no counters: used by every message query). */
export async function visibleDeviceIds(ctx, minLevel = LEVEL.view) {
  const levels = await levelMap(ACL, ctx);
  const { rows } = await query(`SELECT id FROM sms_devices ORDER BY id`);
  return rows.map((row) => row.id).filter((id) => levels.of(id) >= minLevel);
}

export async function listDevices(ctx) {
  const items = await visibleDevices(ctx);
  const sims = await simsOf(items.map((item) => item.row.id));
  return items.map(({ row, level }) => deviceShape(row, level, sims.get(row.id) || []));
}

async function deviceRow(id) {
  const { rows } = await query(`${deviceSelect('$2')} WHERE d.id = $1`, [Number(id), (await portalDay()).today]);
  return rows[0] || null;
}

async function loadDevice(ctx, id, needed = LEVEL.view) {
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId) || deviceId <= 0) throw httpError(404, 'Phone not found', 'NOT_FOUND');
  const level = await levelOn(ACL, deviceId, ctx);
  requireLevel(level, needed);
  const row = await deviceRow(deviceId);
  if (!row) throw httpError(404, 'Phone not found', 'NOT_FOUND');
  return { row, level };
}

export async function getDevice(ctx, id) {
  const { row, level } = await loadDevice(ctx, id);
  const sims = await simsOf([row.id]);
  return deviceShape(row, level, sims.get(row.id) || []);
}

function deviceInput(input, current = {}) {
  const out = {};
  if (input.name !== undefined) {
    out.name = clean(input.name, 120);
    if (!out.name) throw httpError(400, 'Name is required', 'NAME_REQUIRED');
  }
  if (input.description !== undefined) out.description = clean(input.description, 1000) || null;
  if (input.color !== undefined) out.color = HEX.test(String(input.color)) ? String(input.color).toUpperCase() : null;
  if (typeof input.enabled === 'boolean') out.enabled = input.enabled;
  if (input.ratePerMinute !== undefined) out.rate_per_minute = input.ratePerMinute === null || input.ratePerMinute === '' ? null : clampInt(input.ratePerMinute, 1, 120, current.rate_per_minute ?? null);
  return out;
}

/** A new phone: returns it with its connection token, shown this once. */
export async function createDevice(ctx, input = {}) {
  const settings = await moduleSettings();
  // A token limited to some phones could not even see the phone it adds.
  if (ctx.limits?.[ACL]) throw httpError(403, 'This API token is limited to some phones and cannot add one', 'FORBIDDEN');
  if (!settings.userDevices && !ctx.isAdmin) throw httpError(403, 'Only administrators add phones', 'FORBIDDEN');
  if (!ctx.isAdmin) {
    const { rows } = await query(`SELECT COUNT(*)::int AS n FROM sms_devices WHERE owner_id = $1`, [ctx.userId]);
    if (rows[0].n >= (settings.maxDevicesPerUser || 20)) throw httpError(409, 'You have reached the limit of phones', 'DEVICE_LIMIT');
  }
  const fields = deviceInput({ name: input.name ?? '', description: input.description, color: input.color, ratePerMinute: input.ratePerMinute });
  const token = newDeviceToken();
  const id = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO sms_devices (owner_id, name, description, color, token_hash, token_prefix, rate_per_minute)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [ctx.userId, fields.name, fields.description ?? null, fields.color ?? null, token.hash, token.prefix, fields.rate_per_minute ?? null]
    );
    await client.query(`INSERT INTO sms_device_acl (resource_id, subject_type, subject_id, level) VALUES ($1, 'user', $2, $3)`, [rows[0].id, ctx.userId, LEVEL.manage]);
    return rows[0].id;
  });
  await logDeviceEvent(id, 'created', { by: ctx.userId });
  return { device: await getDevice(ctx, id), token: token.token };
}

export async function updateDevice(ctx, id, input = {}) {
  const { row } = await loadDevice(ctx, id, LEVEL.manage);
  const fields = deviceInput(input, row);
  const keys = Object.keys(fields);
  if (keys.length) {
    await query(
      `UPDATE sms_devices SET ${keys.map((key, index) => `${key} = $${index + 2}`).join(', ')}, updated_at = NOW() WHERE id = $1`,
      [row.id, ...keys.map((key) => fields[key])]
    );
  }
  if (fields.enabled === false) disconnect(row.id, 'switched off');
  if (fields.enabled === true && !row.enabled) await logDeviceEvent(row.id, 'enabled', { by: ctx.userId });
  if (fields.enabled === false && row.enabled) await logDeviceEvent(row.id, 'disabled', { by: ctx.userId });
  return getDevice(ctx, row.id);
}

export async function deleteDevice(ctx, id) {
  const { row } = await loadDevice(ctx, id, LEVEL.manage);
  disconnect(row.id, 'deleted');
  await query(`DELETE FROM sms_devices WHERE id = $1`, [row.id]);
}

export async function rotateToken(ctx, id) {
  const { row } = await loadDevice(ctx, id, LEVEL.manage);
  const token = newDeviceToken();
  await query(`UPDATE sms_devices SET token_hash = $2, token_prefix = $3, token_created_at = NOW(), updated_at = NOW() WHERE id = $1`, [row.id, token.hash, token.prefix]);
  disconnect(row.id, 'token replaced');
  await logDeviceEvent(row.id, 'token_rotated', { by: ctx.userId });
  return { device: await getDevice(ctx, row.id), token: token.token };
}

export async function refreshDevice(ctx, id) {
  const { row } = await loadDevice(ctx, id, LEVEL.view);
  return { requested: requestStatus(row.id) };
}

export async function deviceEvents(ctx, id, limit = 100) {
  const { row } = await loadDevice(ctx, id, LEVEL.view);
  const { rows } = await query(`SELECT id, kind, detail, created_at FROM sms_device_events WHERE device_id = $1 ORDER BY id DESC LIMIT $2`, [row.id, clampInt(limit, 1, 500, 100)]);
  return rows.map((event) => ({ id: Number(event.id), kind: event.kind, detail: event.detail, createdAt: event.created_at }));
}

export async function getDeviceAccess(ctx, id) {
  const { row } = await loadDevice(ctx, id, LEVEL.manage);
  return { entries: await readAcl(ACL, row.id), ownerId: row.owner_id };
}

export async function setDeviceAccess(ctx, id, input = {}) {
  const { row } = await loadDevice(ctx, id, LEVEL.manage);
  const entries = cleanEntries(input.entries);
  // The owner always keeps full control of their phone.
  if (row.owner_id && !entries.some((entry) => entry.subjectType === 'user' && entry.subjectId === row.owner_id)) {
    entries.push({ subjectType: 'user', subjectId: row.owner_id, level: LEVEL.manage });
  }
  for (const entry of entries) if (entry.subjectType === 'user' && entry.subjectId === row.owner_id) entry.level = LEVEL.manage;
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM sms_device_acl WHERE resource_id = $1`, [row.id]);
    for (const entry of entries) {
      await client.query(`INSERT INTO sms_device_acl (resource_id, subject_type, subject_id, level) VALUES ($1, $2, $3, $4)`, [row.id, entry.subjectType, entry.subjectId, entry.level]);
    }
  });
  await logDeviceEvent(row.id, 'access_changed', { by: ctx.userId, entries: entries.length });
  return getDeviceAccess(ctx, row.id);
}

// ── SIM cards ──

export async function updateSim(ctx, simRowId, input = {}) {
  const { rows } = await query(`SELECT * FROM sms_sims WHERE id = $1`, [Number(simRowId)]);
  const sim = rows[0];
  if (!sim) throw httpError(404, 'SIM not found', 'NOT_FOUND');
  await loadDevice(ctx, sim.device_id, LEVEL.manage);
  const fields = {};
  if (input.label !== undefined) fields.label = clean(input.label, 60) || null;
  if (input.color !== undefined) fields.color = HEX.test(String(input.color)) ? String(input.color).toUpperCase() : null;
  if (typeof input.sendEnabled === 'boolean') fields.send_enabled = input.sendEnabled;
  if (input.dailyLimit !== undefined) fields.daily_limit = clampInt(input.dailyLimit, 0, 100000, sim.daily_limit);
  const keys = Object.keys(fields);
  if (keys.length) {
    await query(`UPDATE sms_sims SET ${keys.map((key, index) => `${key} = $${index + 2}`).join(', ')} WHERE id = $1`, [sim.id, ...keys.map((key) => fields[key])]);
  }
  const map = await simsOf([sim.device_id]);
  return (map.get(sim.device_id) || []).find((item) => item.id === sim.id);
}

export async function deleteSim(ctx, simRowId) {
  const { rows } = await query(`SELECT * FROM sms_sims WHERE id = $1`, [Number(simRowId)]);
  const sim = rows[0];
  if (!sim) throw httpError(404, 'SIM not found', 'NOT_FOUND');
  await loadDevice(ctx, sim.device_id, LEVEL.manage);
  if (sim.active) throw httpError(409, 'An active SIM cannot be removed: take it out of the phone first', 'SIM_ACTIVE');
  await query(`DELETE FROM sms_sims WHERE id = $1`, [sim.id]);
}

// ── Sending ──

/** Phones and SIMs the caller may send through, as routing candidates. */
async function candidates(ctx, { deviceId = null, simRowId = null } = {}) {
  const devices = (await visibleDevices(ctx, LEVEL.edit)).filter(({ row }) => !deviceId || row.id === deviceId);
  if (!devices.length) return [];
  const sims = await simsOf(devices.map(({ row }) => row.id));
  const list = [];
  for (const { row } of devices) {
    const own = (sims.get(row.id) || []).filter((sim) => sim.active);
    if (!own.length) {
      // A chosen SIM never goes through another phone.
      if (simRowId) continue;
      // Never connected yet: the phone picks the SIM itself (slot 0).
      list.push({ deviceId: row.id, simRowId: -row.id, slot: 0, online: isOnline(row.id), deviceEnabled: row.enabled, simActive: true, sendEnabled: true, sentToday: Number(row.sent_today || 0), dailyLimit: 0 });
      continue;
    }
    for (const sim of own) {
      if (simRowId && sim.id !== simRowId) continue;
      list.push({ deviceId: row.id, simRowId: sim.id, slot: sim.slot, online: isOnline(row.id), deviceEnabled: row.enabled, simActive: sim.active, sendEnabled: sim.sendEnabled && sim.phoneSend !== false, sentToday: sim.sentToday, dailyLimit: sim.dailyLimit });
    }
  }
  return list;
}

function parseSendAfter(value) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw httpError(400, 'sendAt must be a date and time (ISO 8601)', 'SEND_AT_INVALID');
  if (date.getTime() < Date.now() + 5_000) return null;
  if (date.getTime() > Date.now() + 90 * 86_400_000) throw httpError(400, 'sendAt is more than 90 days ahead', 'SEND_AT_TOO_FAR');
  return date;
}

/**
 * Queues messages: `{ to, text, deviceId?, simId?, sendAt?, ref? }`.
 * `to` is a number, a list, or text with numbers separated by commas or lines.
 */
export async function sendMessages(ctx, input = {}, source = 'web') {
  const settings = await moduleSettings();
  const text = String(input.text ?? '').replace(/\r\n/g, '\n');
  if (!text.trim()) throw httpError(400, 'Text is required', 'TEXT_REQUIRED');
  if (text.length > (settings.maxTextLength || 1600)) throw httpError(400, `Text is longer than ${settings.maxTextLength || 1600} characters`, 'TEXT_TOO_LONG');
  const recipients = parseRecipients(input.to ?? input.phone ?? input.phones, input.country || settings.defaultCountry, settings.maxRecipients || 1000);
  if (!recipients.valid.length) {
    throw Object.assign(httpError(400, 'No valid phone numbers', 'NO_RECIPIENTS'), { details: { invalid: recipients.invalid } });
  }
  if (recipients.truncated) throw httpError(400, `At most ${settings.maxRecipients || 1000} recipients per request`, 'TOO_MANY_RECIPIENTS');

  const deviceId = input.deviceId ? Number(input.deviceId) : null;
  const simRowId = input.simId ? Number(input.simId) : null;
  if (simRowId) {
    const { rows } = await query(`SELECT device_id FROM sms_sims WHERE id = $1`, [simRowId]);
    // A SIM of a phone the caller cannot see does not exist for them.
    if (!rows[0] || (await levelOn(ACL, rows[0].device_id, ctx)) < LEVEL.view) throw httpError(404, 'SIM not found', 'SIM_NOT_FOUND');
    if (deviceId && rows[0].device_id !== deviceId) throw httpError(400, 'The SIM belongs to another phone', 'SIM_DEVICE_MISMATCH');
  }
  if (deviceId) await loadDevice(ctx, deviceId, LEVEL.edit);
  const pool = await candidates(ctx, { deviceId: deviceId || null, simRowId });
  if (!pool.length) throw httpError(409, deviceId || simRowId ? 'You cannot send through this phone or SIM' : 'You have no phone to send through. Add a phone first.', 'NO_DEVICE');
  if (simRowId) {
    const sim = pool.find((candidate) => candidate.simRowId === simRowId);
    if (!sim || !sim.sendEnabled || !sim.simActive) throw httpError(409, 'Sending is switched off for this SIM', 'SIM_DISABLED');
    if (!usable(sim, recipients.valid.length - 1)) throw httpError(409, 'The daily limit of this SIM is used up', 'SIM_LIMIT');
  }
  const plan = planBatch(pool, recipients.valid.length);
  if (plan.some((choice) => !choice)) {
    const anyEnabled = pool.some((candidate) => candidate.deviceEnabled && candidate.sendEnabled && candidate.simActive);
    throw httpError(409, anyEnabled ? 'Daily SIM limits are used up for this many messages' : 'Sending is switched off on every available phone', anyEnabled ? 'LIMIT_REACHED' : 'NO_DEVICE');
  }

  const sendAfter = parseSendAfter(input.sendAt);
  const ttlMs = (settings.queueTtlHours || 24) * 3_600_000;
  const expiresAt = new Date((sendAfter ? sendAfter.getTime() : Date.now()) + ttlMs);
  const segments = smsSegments(text);
  const ref = input.ref ? clean(input.ref, 64) : null;
  const status = sendAfter ? 'scheduled' : 'queued';
  const batchId = recipients.valid.length > 1 ? crypto.randomUUID() : null;

  const ids = await withTransaction(async (client) => {
    const out = [];
    for (let index = 0; index < recipients.valid.length; index += 1) {
      const choice = plan[index];
      const { rows } = await client.query(
        `INSERT INTO sms_messages (device_id, sim_row_id, slot, direction, phone, text, parts, encoding, status, ref, batch_id, source, created_by, send_after, expires_at, is_read)
         VALUES ($1, $2, $3, 'out', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, TRUE) RETURNING id`,
        [choice.deviceId, choice.simRowId > 0 ? choice.simRowId : null, choice.slot, recipients.valid[index], text, segments.parts, segments.encoding, status, ref, batchId, source, ctx.userId, sendAfter, expiresAt]
      );
      out.push(rows[0].id);
    }
    return out;
  });
  if (!sendAfter) kick(plan.map((choice) => choice.deviceId));
  const { rows } = await query(`${MESSAGE_SELECT} WHERE m.id = ANY($1) ORDER BY m.id`, [ids]);
  return { batchId, segments, messages: rows.map(messageShape), invalid: recipients.invalid };
}

// ── Messages ──

const MESSAGE_SELECT = `SELECT m.*, d.name AS device_name, COALESCE(s.label, s.phone_label, s.carrier) AS sim_label
  FROM sms_messages m LEFT JOIN sms_devices d ON d.id = m.device_id LEFT JOIN sms_sims s ON s.id = m.sim_row_id`;

const STATUS_GROUPS = {
  pending: ['scheduled', 'queued', 'dispatched', 'accepted'],
  done: ['sent', 'delivered'],
  problem: ['failed', 'expired', 'cancelled'],
};

/** WHERE clause for message filters within the visible phones. */
async function messageFilter(ctx, filters = {}) {
  const ids = await visibleDeviceIds(ctx);
  const where = ['m.device_id = ANY($1)'];
  const args = [ids];
  const add = (sql, value) => {
    args.push(value);
    where.push(sql.replace('?', `$${args.length}`));
  };
  if (['in', 'out'].includes(filters.direction)) add('m.direction = ?', filters.direction);
  if (filters.status) {
    const list = String(filters.status)
      .split(',')
      .flatMap((item) => STATUS_GROUPS[item.trim()] || [item.trim()])
      .filter((item) => /^[a-z]{3,12}$/.test(item));
    if (list.length) add('m.status = ANY(?)', list);
  }
  if (filters.deviceId) add('m.device_id = ?', Number(filters.deviceId) || 0);
  if (filters.simId) add('m.sim_row_id = ?', Number(filters.simId) || 0);
  if (filters.phone) add('m.phone LIKE ?', `%${String(filters.phone).replace(/[^\d+]/g, '').slice(0, 20)}%`);
  if (filters.q) add('m.text ILIKE ?', `%${String(filters.q).slice(0, 100).replace(/[%_\\]/g, (char) => `\\${char}`)}%`);
  if (filters.batchId && UUID.test(filters.batchId)) add('m.batch_id = ?', filters.batchId);
  if (filters.ref) add('m.ref = ?', String(filters.ref).slice(0, 64));
  if (filters.unread === '1' || filters.unread === 'true' || filters.unread === true) where.push(`m.direction = 'in' AND NOT m.is_read`);
  if (filters.from && !Number.isNaN(Date.parse(filters.from))) add('m.created_at >= ?', new Date(filters.from));
  if (filters.to && !Number.isNaN(Date.parse(filters.to))) add('m.created_at < ?', new Date(filters.to));
  if (filters.sinceId) add('m.id > ?', Number(filters.sinceId) || 0);
  if (filters.before) add('m.id < ?', Number(filters.before) || 0);
  return { where: where.join(' AND '), args };
}

export async function listMessages(ctx, filters = {}) {
  const limit = clampInt(filters.limit, 1, 200, 50);
  const { where, args } = await messageFilter(ctx, filters);
  const ascending = Boolean(filters.sinceId);
  const { rows } = await query(`${MESSAGE_SELECT} WHERE ${where} ORDER BY m.id ${ascending ? 'ASC' : 'DESC'} LIMIT ${limit + 1}`, args);
  const more = rows.length > limit;
  const page = rows.slice(0, limit);
  return { messages: page.map(messageShape), next: more && !ascending ? Number(page[page.length - 1].id) : null };
}

export async function countMessages(ctx, filters = {}) {
  const { where, args } = await messageFilter(ctx, filters);
  const { rows } = await query(`SELECT COUNT(*)::int AS n FROM sms_messages m WHERE ${where}`, args);
  return rows[0].n;
}

async function messageRow(ctx, idOrUuid, needed = LEVEL.view) {
  const key = String(idOrUuid);
  const { rows } = UUID.test(key) ? await query(`${MESSAGE_SELECT} WHERE m.uuid = $1`, [key]) : await query(`${MESSAGE_SELECT} WHERE m.id = $1`, [Number(key) || 0]);
  const row = rows[0];
  if (!row) throw httpError(404, 'Message not found', 'NOT_FOUND');
  requireLevel(await levelOn(ACL, row.device_id, ctx), needed);
  return row;
}

export async function getMessage(ctx, id) {
  return messageShape(await messageRow(ctx, id));
}

export async function cancelMessage(ctx, id) {
  const row = await messageRow(ctx, id, LEVEL.edit);
  if (!['queued', 'scheduled'].includes(row.status)) throw httpError(409, 'Only a message waiting in the queue can be cancelled', 'NOT_CANCELLABLE');
  await query(`UPDATE sms_messages SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND status IN ('queued', 'scheduled')`, [row.id]);
  return messageShape(await loadMessage(row.id));
}

export async function retryMessage(ctx, id) {
  const row = await messageRow(ctx, id, LEVEL.edit);
  if (row.direction !== 'out' || !['failed', 'expired', 'cancelled'].includes(row.status)) throw httpError(409, 'Only a failed, expired or cancelled message can be sent again', 'NOT_RETRYABLE');
  const settings = await moduleSettings();
  const expiresAt = new Date(Date.now() + (settings.queueTtlHours || 24) * 3_600_000);
  const { rowCount } = await query(
    `UPDATE sms_messages SET status = 'queued', attempts = 0, error = NULL, error_code = NULL, failed_at = NULL, dispatched_at = NULL,
            accepted_at = NULL, sent_at = NULL, delivered_at = NULL, device_message_id = NULL, send_after = NULL, expires_at = $2, updated_at = NOW()
     WHERE id = $1 AND status = $3`,
    [row.id, expiresAt, row.status]
  );
  // A late report changed it meanwhile (e.g. "sent" after NO_ACK): it is not sent twice.
  if (!rowCount) throw httpError(409, 'The message changed meanwhile, reload it', 'NOT_RETRYABLE');
  kick([row.device_id]);
  return messageShape(await loadMessage(row.id));
}

export async function markRead(ctx, { ids, deviceId, phone, all } = {}) {
  const visible = await visibleDeviceIds(ctx);
  if (Array.isArray(ids) && ids.length) {
    const list = ids.map(Number).filter((id) => Number.isInteger(id)).slice(0, 1000);
    const { rowCount } = await query(`UPDATE sms_messages SET is_read = TRUE WHERE id = ANY($1) AND device_id = ANY($2) AND NOT is_read`, [list, visible]);
    return rowCount;
  }
  if (deviceId && phone) {
    const { rowCount } = await query(`UPDATE sms_messages SET is_read = TRUE WHERE device_id = $1 AND phone = $2 AND device_id = ANY($3) AND NOT is_read`, [Number(deviceId), String(phone), visible]);
    return rowCount;
  }
  if (all) {
    const { rowCount } = await query(`UPDATE sms_messages SET is_read = TRUE WHERE device_id = ANY($1) AND NOT is_read`, [visible]);
    return rowCount;
  }
  return 0;
}

// ── Conversations ──

/** Latest message per phone number and phone, newest first. */
export async function listThreads(ctx, { deviceId, q, limit, before } = {}) {
  const ids = await visibleDeviceIds(ctx);
  const args = [deviceId ? ids.filter((id) => id === Number(deviceId)) : ids];
  let extra = '';
  if (q) {
    args.push(`%${String(q).slice(0, 100).replace(/[%_\\]/g, (char) => `\\${char}`)}%`);
    extra += ` AND (m.phone ILIKE $${args.length} OR m.text ILIKE $${args.length})`;
  }
  args.push(clampInt(limit, 1, 200, 60));
  const limitArg = `$${args.length}`;
  let beforeSql = '';
  if (before) {
    args.push(Number(before) || 0);
    beforeSql = `WHERE last.id < $${args.length}`;
  }
  const { rows } = await query(
    `SELECT last.*, d.name AS device_name, t.unread, t.total
     FROM (
       SELECT device_id, phone, MAX(id) AS last_id,
              COUNT(*) FILTER (WHERE direction = 'in' AND NOT is_read)::int AS unread, COUNT(*)::int AS total
       FROM sms_messages m WHERE m.device_id = ANY($1) ${extra}
       GROUP BY device_id, phone
     ) t
     JOIN sms_messages last ON last.id = t.last_id
     JOIN sms_devices d ON d.id = last.device_id
     ${beforeSql}
     ORDER BY last.id DESC LIMIT ${limitArg}`,
    args
  );
  return rows.map((row) => ({ deviceId: row.device_id, deviceName: row.device_name, phone: row.phone, unread: row.unread, total: row.total, last: messageShape(row) }));
}

export async function getThread(ctx, { deviceId, phone, before, limit } = {}) {
  const device = await loadDevice(ctx, deviceId, LEVEL.view);
  const args = [device.row.id, String(phone || '').slice(0, 40)];
  let beforeSql = '';
  if (before) {
    args.push(Number(before) || 0);
    beforeSql = ` AND m.id < $${args.length}`;
  }
  const size = clampInt(limit, 1, 200, 80);
  const { rows } = await query(`${MESSAGE_SELECT} WHERE m.device_id = $1 AND m.phone = $2 ${beforeSql} ORDER BY m.id DESC LIMIT ${size + 1}`, args);
  const more = rows.length > size;
  const page = rows.slice(0, size).reverse();
  return { messages: page.map(messageShape), next: more ? Number(page[0].id) : null, canSend: device.level >= LEVEL.edit };
}

// ── Statistics ──

export async function overview(ctx, { days = 14, deviceId = null } = {}) {
  const span = clampInt(days, 1, 90, 14);
  const { zone, today: dayStart } = await portalDay();
  const since = startOfDay(new Date(), zone, -(span - 1));
  let ids = await visibleDeviceIds(ctx);
  if (deviceId) ids = ids.filter((id) => id === Number(deviceId));
  const { rows: [today] } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE direction = 'out' AND status IN ('sent', 'delivered'))::int AS sent,
       COUNT(*) FILTER (WHERE direction = 'out' AND status = 'delivered')::int AS delivered,
       COUNT(*) FILTER (WHERE direction = 'out' AND status IN ('failed', 'expired'))::int AS failed,
       COUNT(*) FILTER (WHERE direction = 'in')::int AS received,
       COALESCE(SUM(parts) FILTER (WHERE direction = 'out' AND status IN ('sent', 'delivered')), 0)::int AS parts
     FROM sms_messages WHERE device_id = ANY($1) AND created_at >= $2`,
    [ids, dayStart]
  );
  const { rows: [pending] } = await query(
    `SELECT COUNT(*) FILTER (WHERE status IN ('queued', 'dispatched', 'accepted'))::int AS queued,
            COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
            COUNT(*) FILTER (WHERE direction = 'in' AND NOT is_read)::int AS unread
     FROM sms_messages WHERE device_id = ANY($1) AND (status IN ('queued', 'dispatched', 'accepted', 'scheduled') OR (direction = 'in' AND NOT is_read))`,
    [ids]
  );
  // Days of the portal's zone (DST safe): their starts are computed here, the database only counts.
  const starts = [];
  for (let back = span - 1; back >= -1; back -= 1) starts.push(startOfDay(new Date(), zone, -back));
  const { rows: counted } = await query(
    `SELECT b.n,
       COUNT(m.id) FILTER (WHERE m.direction = 'out' AND m.status IN ('sent', 'delivered'))::int AS sent,
       COUNT(m.id) FILTER (WHERE m.direction = 'out' AND m.status = 'delivered')::int AS delivered,
       COUNT(m.id) FILTER (WHERE m.direction = 'out' AND m.status IN ('failed', 'expired'))::int AS failed,
       COUNT(m.id) FILTER (WHERE m.direction = 'in')::int AS received
     FROM unnest($2::timestamptz[], $3::timestamptz[]) WITH ORDINALITY AS b(start, stop, n)
     LEFT JOIN sms_messages m ON m.device_id = ANY($1) AND m.created_at >= b.start AND m.created_at < b.stop
     GROUP BY b.n ORDER BY b.n`,
    [ids, starts.slice(0, -1), starts.slice(1)]
  );
  const series = counted.map((row, index) => ({ day: isoDay(starts[index], zone), sent: row.sent, delivered: row.delivered, failed: row.failed, received: row.received }));
  const { rows: [totals] } = await query(
    `SELECT COUNT(*) FILTER (WHERE direction = 'out')::int AS out, COUNT(*) FILTER (WHERE direction = 'in')::int AS in,
            COUNT(*) FILTER (WHERE direction = 'out' AND status = 'delivered')::int AS delivered,
            COUNT(*) FILTER (WHERE direction = 'out' AND status IN ('sent', 'delivered', 'failed', 'expired'))::int AS finished
     FROM sms_messages WHERE device_id = ANY($1) AND created_at >= $2`,
    [ids, since]
  );
  const online = ids.filter((id) => isOnline(id)).length;
  return {
    today: { ...today, ...pending },
    period: { days: span, ...totals, deliveryRate: totals.finished ? Math.round((totals.delivered / totals.finished) * 1000) / 10 : null },
    series,
    devices: { total: ids.length, online },
  };
}

// ── Templates ──

function templateShape(row, ctx) {
  return { id: row.id, name: row.name, text: row.text, shared: row.shared, ownerId: row.owner_id, ownerName: row.owner_name, mine: row.owner_id === ctx.userId, updatedAt: row.updated_at };
}

export async function listTemplates(ctx) {
  const { rows } = await query(
    `SELECT t.*, COALESCE(u.display_name, u.username) AS owner_name FROM sms_templates t LEFT JOIN users u ON u.id = t.owner_id
     WHERE t.owner_id = $1 OR t.shared ORDER BY LOWER(t.name)`,
    [ctx.userId]
  );
  return rows.map((row) => templateShape(row, ctx));
}

function templateInput(input) {
  const name = clean(input.name, 120);
  const text = String(input.text ?? '').trim().slice(0, 5000);
  if (!name) throw httpError(400, 'Name is required', 'NAME_REQUIRED');
  if (!text) throw httpError(400, 'Text is required', 'TEXT_REQUIRED');
  return { name, text, shared: input.shared === true };
}

export async function createTemplate(ctx, input = {}) {
  const fields = templateInput(input);
  const { rows } = await query(`INSERT INTO sms_templates (owner_id, name, text, shared) VALUES ($1, $2, $3, $4) RETURNING id`, [ctx.userId, fields.name, fields.text, fields.shared]);
  return (await listTemplates(ctx)).find((item) => item.id === rows[0].id);
}

async function ownTemplate(ctx, id) {
  const { rows } = await query(`SELECT * FROM sms_templates WHERE id = $1`, [Number(id) || 0]);
  const row = rows[0];
  if (!row || (row.owner_id !== ctx.userId && !row.shared)) throw httpError(404, 'Template not found', 'NOT_FOUND');
  if (row.owner_id !== ctx.userId && !ctx.isAdmin) throw httpError(403, 'Only the author changes a template', 'FORBIDDEN');
  return row;
}

export async function updateTemplate(ctx, id, input = {}) {
  const row = await ownTemplate(ctx, id);
  const fields = templateInput({ name: input.name ?? row.name, text: input.text ?? row.text, shared: input.shared ?? row.shared });
  await query(`UPDATE sms_templates SET name = $2, text = $3, shared = $4, updated_at = NOW() WHERE id = $1`, [row.id, fields.name, fields.text, fields.shared]);
  return (await listTemplates(ctx)).find((item) => item.id === row.id);
}

export async function deleteTemplate(ctx, id) {
  const row = await ownTemplate(ctx, id);
  await query(`DELETE FROM sms_templates WHERE id = $1`, [row.id]);
}

// ── Housekeeping (scheduler) ──

/** Queued messages past their time expire; tells webhooks. */
export async function expireQueue() {
  const { rows } = await query(
    `UPDATE sms_messages SET status = 'expired', error = 'The phone was not reachable in time', error_code = 'EXPIRED', failed_at = NOW(), updated_at = NOW()
     WHERE status IN ('queued', 'scheduled') AND expires_at < NOW() RETURNING id`
  );
  for (const row of rows) await emitMessage(await loadMessage(row.id));
  return rows.length;
}

export async function purgeOld() {
  const settings = await moduleSettings();
  let removed = 0;
  if (settings.retentionDays > 0) {
    const result = await query(`DELETE FROM sms_messages WHERE created_at < NOW() - make_interval(days => $1) AND status NOT IN ('queued', 'scheduled', 'dispatched')`, [settings.retentionDays]);
    removed += result.rowCount;
  }
  await query(`DELETE FROM sms_device_events WHERE created_at < NOW() - INTERVAL '30 days'`);
  return removed;
}

/** Phones offline longer than the alert threshold: their managers hear about it once. */
export async function offlineDevices() {
  const settings = await moduleSettings();
  const minutes = settings.offlineAlertMinutes || 0;
  if (!minutes) return [];
  const { rows } = await query(
    `UPDATE sms_devices SET offline_notified = TRUE
     WHERE enabled AND NOT online AND NOT offline_notified AND last_seen_at < NOW() - make_interval(mins => $1)
     RETURNING *`,
    [minutes]
  );
  return rows.map((row) => ({ row, minutes }));
}
