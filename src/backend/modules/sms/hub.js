import { WebSocketServer } from 'ws';
import proxyaddr from 'proxy-addr';
import { query } from '../../config/database.js';
import { getSettingsView } from '../../services/settings.js';
import { trustProxy } from '../../services/security.js';
import { ackEventCommand, nextStatus, parseFrame, phoneStatus, pingCommand, sendCommand, statusCommand } from './protocol.js';
import { smsSegments } from './phone.js';
import { bearerOf, hashToken } from './tokens.js';
import { emitDevice, emitMessage, logDeviceEvent, notifyIncoming } from './events.js';

/*
 * The WebSocket hub: phones running iSMS GW keep a connection to
 * wss://<portal>/ws/device (Authorization: Bearer <device token>).
 *
 * In memory: device id → its live connection (one per phone; a new one
 * replaces the old). The send queue lives in sms_messages; the dispatcher
 * hands queued messages to connected phones at the phone's pace and puts back
 * the ones a phone never confirmed.
 */

export const DEVICE_PATHS = new Set(['/ws/device', '/api/sms/device']);
const HEARTBEAT_MS = 30_000;
const PUMP_MS = 2_000;
const SEEN_WRITE_MS = 30_000;
// Frames of one phone are handled one after another; this much unprocessed text closes the connection.
const MAX_PENDING_BYTES = 16 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const connections = new Map();
const pumping = new Set();
const failures = new Map();
const trust = trustProxy(process.env.TRUST_PROXY_HOPS);
let wss = null;
let timers = [];

const settingsOf = async () => (await getSettingsView()).modules.sms || { enabled: false, settings: {} };

export const isOnline = (deviceId) => connections.has(Number(deviceId));
export const onlineIds = () => [...connections.keys()];

/** Sends a frame to a connected phone; false when it is offline. */
export function sendTo(deviceId, frame) {
  const conn = connections.get(Number(deviceId));
  if (!conn || conn.ws.readyState !== conn.ws.OPEN) return false;
  conn.ws.send(frame);
  return true;
}

export const requestStatus = (deviceId) => sendTo(deviceId, statusCommand());

/** Drops a phone's connection (token changed, phone deleted or switched off). */
export function disconnect(deviceId, reason = 'closed by server') {
  const conn = connections.get(Number(deviceId));
  if (conn) conn.ws.close(4001, reason);
}

// ── Brute force: 20 bad tokens per address in 10 minutes close the door for 10 minutes ──

function blocked(ip) {
  const entry = failures.get(ip);
  return Boolean(entry && entry.count >= 20 && entry.until > Date.now());
}

function failed(ip) {
  const now = Date.now();
  const entry = failures.get(ip);
  if (!entry || entry.until < now) failures.set(ip, { count: 1, until: now + 10 * 60_000 });
  else entry.count += 1;
  if (failures.size > 10_000) failures.clear();
}

function refuse(socket, status, text) {
  try {
    socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  } finally {
    socket.destroy();
  }
}

function ignoreSocketError() {}

function clientIp(req) {
  try {
    return proxyaddr(req, trust || (() => false));
  } catch {
    return req.socket?.remoteAddress || '';
  }
}

export function attachDeviceHub(server) {
  wss = new WebSocketServer({ noServer: true, maxPayload: 512 * 1024 });
  server.on('upgrade', (req, socket, head) => {
    const path = String(req.url || '').split('?')[0];
    if (!DEVICE_PATHS.has(path)) {
      socket.destroy();
      return;
    }
    // The HTTP server drops its own error listener on upgrade: a reset during the
    // token check would otherwise be an uncaught 'error' and end the process.
    socket.on('error', ignoreSocketError);
    accept(req, socket, head).catch((err) => {
      console.warn('[sms] upgrade failed:', err.message);
      refuse(socket, 500, 'Internal Server Error');
    });
  });
  timers = [
    setInterval(heartbeat, HEARTBEAT_MS),
    setInterval(() => pumpAll().catch((err) => console.warn('[sms] dispatcher:', err.message)), PUMP_MS),
    setInterval(() => requeueUnacked().catch((err) => console.warn('[sms] ack timeouts:', err.message)), 10_000),
  ];
  for (const timer of timers) timer.unref?.();
}

export function stopDeviceHub() {
  for (const timer of timers) clearInterval(timer);
  timers = [];
  for (const conn of connections.values()) conn.ws.close(1001, 'server restart');
}

async function accept(req, socket, head) {
  const ip = clientIp(req);
  if (blocked(ip)) return refuse(socket, 429, 'Too Many Requests');
  const state = await settingsOf();
  if (!state.enabled) return refuse(socket, 404, 'Not Found');
  const token = bearerOf(req.headers.authorization);
  if (!token) {
    failed(ip);
    return refuse(socket, 401, 'Unauthorized');
  }
  const { rows } = await query(`SELECT * FROM sms_devices WHERE token_hash = $1`, [hashToken(token)]);
  const device = rows[0];
  if (!device) {
    failed(ip);
    return refuse(socket, 401, 'Unauthorized');
  }
  if (!device.enabled) return refuse(socket, 403, 'Forbidden');
  socket.removeListener('error', ignoreSocketError);
  wss.handleUpgrade(req, socket, head, (ws) =>
    connected(ws, device, req, ip).catch((err) => console.warn(`[sms] device ${device.id} connect:`, err.message))
  );
}

async function connected(ws, device, req, ip) {
  const previous = connections.get(device.id);
  const conn = { ws, deviceId: device.id, ip, alive: true, seenWrittenAt: Date.now(), name: device.name, chain: Promise.resolve(), pendingBytes: 0 };
  connections.set(device.id, conn);
  if (previous) {
    previous.replaced = true;
    previous.ws.close(4000, 'replaced by a new connection');
  }

  const uid = String(req.headers['x-device-id'] || '').slice(0, 100) || null;
  const phoneName = String(req.headers['x-device-name'] || '').slice(0, 120) || null;
  const version = /iSMS-GW\/(\S+)/i.exec(String(req.headers['user-agent'] || ''))?.[1]?.slice(0, 40) || null;

  ws.on('pong', () => {
    conn.alive = true;
  });
  ws.on('message', (data, isBinary) => {
    if (isBinary) return;
    const text = data.toString();
    if (conn.pendingBytes + text.length > MAX_PENDING_BYTES) {
      ws.close(1008, 'too many frames');
      return;
    }
    conn.pendingBytes += text.length;
    // One frame at a time: an ack and the "sent" report of the same message must not race.
    conn.chain = conn.chain
      .then(() => onFrame(conn, text))
      .catch((err) => console.warn(`[sms] device ${conn.deviceId} frame:`, err.message))
      .finally(() => {
        conn.pendingBytes -= text.length;
      });
  });
  ws.on('close', (code, reason) => {
    closed(conn, code, String(reason || '')).catch((err) => console.warn('[sms] close:', err.message));
  });
  ws.on('error', () => {});

  const { rows } = await query(
    `UPDATE sms_devices
     SET online = TRUE, connected_at = NOW(), last_seen_at = NOW(), last_ip = $2, offline_notified = FALSE,
         device_uid = COALESCE($3, device_uid), phone_name = COALESCE($4, phone_name), app_version = COALESCE($5, app_version), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [device.id, ip, uid, phoneName, version]
  );
  const fresh = rows[0] || device;
  if (connections.get(device.id) !== conn) {
    // Closed (or replaced) while the row was being written: closed() already ran, keep the row offline.
    if (!connections.has(device.id)) await query(`UPDATE sms_devices SET online = FALSE WHERE id = $1`, [device.id]);
    return;
  }
  if (device.device_uid && uid && device.device_uid !== uid) {
    await logDeviceEvent(device.id, 'phone_changed', { from: device.device_uid, to: uid, ip });
  }
  await logDeviceEvent(device.id, 'connected', { ip, version, phone: phoneName });
  if (!previous && !device.online) await emitDevice('device.online', fresh);
  sendTo(device.id, statusCommand());
  pump(device.id).catch(() => {});
}

async function closed(conn, code, reason) {
  if (connections.get(conn.deviceId) !== conn) return; // replaced by a newer connection
  connections.delete(conn.deviceId);
  const { rows } = await query(`UPDATE sms_devices SET online = FALSE, last_seen_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`, [conn.deviceId]);
  await logDeviceEvent(conn.deviceId, 'disconnected', { code, reason: reason.slice(0, 120) });
  if (rows[0]) await emitDevice('device.offline', rows[0]);
}

function heartbeat() {
  for (const conn of connections.values()) {
    if (!conn.alive) {
      conn.ws.terminate();
      continue;
    }
    conn.alive = false;
    try {
      conn.ws.ping();
      // The app answers a JSON ping too; it proves the app (not just the socket) is alive.
      conn.ws.send(pingCommand());
    } catch {
      /* closed meanwhile */
    }
  }
}

// ── Frames from the phone ──

async function onFrame(conn, text) {
  conn.alive = true;
  if (Date.now() - conn.seenWrittenAt > SEEN_WRITE_MS) {
    conn.seenWrittenAt = Date.now();
    await query(`UPDATE sms_devices SET last_seen_at = NOW() WHERE id = $1`, [conn.deviceId]);
  }
  const frame = parseFrame(text);
  if (!frame) return;
  switch (frame.type) {
    case 'hello':
      await query(
        `UPDATE sms_devices SET device_uid = COALESCE(NULLIF($2, ''), device_uid), phone_name = COALESCE(NULLIF($3, ''), phone_name),
                app_version = COALESCE(NULLIF($4, ''), app_version), updated_at = NOW() WHERE id = $1`,
        [conn.deviceId, frame.deviceId, frame.deviceName, frame.version]
      );
      await syncSims(conn.deviceId, frame.sims);
      break;
    case 'status':
      await syncSims(conn.deviceId, frame.sims);
      if (frame.stats) await query(`UPDATE sms_devices SET stats = $2 WHERE id = $1`, [conn.deviceId, JSON.stringify({ ...frame.stats, at: new Date().toISOString() })]);
      break;
    case 'event':
      await onEvent(conn, frame.event, frame.message);
      break;
    case 'ack':
      await onAck(conn, frame);
      break;
    case 'error':
      await onReject(conn, frame);
      break;
    default:
      break;
  }
}

/** Stores the SIM list the phone reported; SIMs it no longer lists become inactive. */
export async function syncSims(deviceId, sims) {
  if (!sims.length) return;
  const list = sims.map((sim) => ({
    sim_id: sim.simId, slot: sim.slot, active: sim.active, embedded: sim.embedded, carrier: sim.carrier, display_name: sim.displayName,
    number: sim.number, country: sim.country, phone_label: sim.label, phone_color: sim.color || null,
    phone_send: sim.sendEnabled, phone_receive: sim.receiveEnabled, icc_tail: sim.iccTail,
  }));
  // One statement for the whole list (at most 16 SIMs).
  await query(
    `INSERT INTO sms_sims (device_id, sim_id, slot, active, embedded, carrier, display_name, number, country,
                           phone_label, phone_color, phone_send, phone_receive, icc_tail, last_seen_at)
     SELECT $1, x.sim_id, x.slot, x.active, x.embedded, x.carrier, x.display_name, x.number, x.country,
            x.phone_label, x.phone_color, x.phone_send, x.phone_receive, x.icc_tail, NOW()
     FROM jsonb_to_recordset($2::jsonb) AS x(sim_id int, slot smallint, active boolean, embedded boolean, carrier text, display_name text,
            number text, country text, phone_label text, phone_color text, phone_send boolean, phone_receive boolean, icc_tail text)
     ON CONFLICT (device_id, sim_id) DO UPDATE SET
       slot = EXCLUDED.slot, active = EXCLUDED.active, embedded = EXCLUDED.embedded, carrier = EXCLUDED.carrier,
       display_name = EXCLUDED.display_name, number = COALESCE(NULLIF(EXCLUDED.number, ''), sms_sims.number),
       country = EXCLUDED.country, phone_label = EXCLUDED.phone_label, phone_color = EXCLUDED.phone_color,
       phone_send = EXCLUDED.phone_send, phone_receive = EXCLUDED.phone_receive, icc_tail = EXCLUDED.icc_tail, last_seen_at = NOW()`,
    [deviceId, JSON.stringify(list)]
  );
  await query(`UPDATE sms_sims SET active = FALSE WHERE device_id = $1 AND active AND NOT (sim_id = ANY($2::int[]))`, [deviceId, sims.map((sim) => sim.simId)]);
}

async function simRowFor(deviceId, message) {
  const { rows } = await query(
    `SELECT id, slot FROM sms_sims WHERE device_id = $1 AND (sim_id = $2 OR ($2 < 0 AND slot = $3 AND active)) ORDER BY (sim_id = $2) DESC LIMIT 1`,
    [deviceId, message.simId ?? -1, message.slot || 0]
  );
  return rows[0] || null;
}

const MESSAGE_SELECT = `SELECT m.*, d.name AS device_name, COALESCE(s.label, s.phone_label, s.carrier) AS sim_label
  FROM sms_messages m LEFT JOIN sms_devices d ON d.id = m.device_id LEFT JOIN sms_sims s ON s.id = m.sim_row_id`;

export async function loadMessage(id) {
  const { rows } = await query(`${MESSAGE_SELECT} WHERE m.id = $1`, [id]);
  return rows[0] || null;
}

/** Sets the phone's own message id; an id the phone reused after a reinstall is taken from the old row. */
async function bindPhoneId(id, deviceId, direction, phoneId) {
  if (phoneId === null || phoneId === undefined) return;
  await query(
    `UPDATE sms_messages SET device_message_id = NULL WHERE device_id = $1 AND direction = $2 AND device_message_id = $3 AND id <> $4`,
    [deviceId, direction, phoneId, id]
  );
  await query(`UPDATE sms_messages SET device_message_id = $2 WHERE id = $1`, [id, phoneId]);
}

/**
 * True when the phone already reported this message (same id, number and text):
 * a re-send after a reconnect. The same id with another text means the app was
 * reinstalled and counts from 1 again — the old row lets go of the id.
 */
async function knownPhoneMessage(deviceId, direction, message) {
  const { rows } = await query(`SELECT id, phone, text FROM sms_messages WHERE device_id = $1 AND direction = $2 AND device_message_id = $3`, [deviceId, direction, message.id]);
  const old = rows[0];
  if (!old) return false;
  if (old.phone === (message.phone || 'unknown') && old.text === message.text) return true;
  await query(`UPDATE sms_messages SET device_message_id = NULL WHERE id = $1`, [old.id]);
  return false;
}

const STAMP = { accepted: 'accepted_at', sent: 'sent_at', delivered: 'delivered_at', failed: 'failed_at' };

/** Moves a message to `status` when the rules allow it; returns the updated row or null. */
export async function advance(row, status, { error = null, errorCode = null } = {}, retry = true) {
  const next = nextStatus(row.status, status, { error: row.error_code });
  if (!next) return null;
  const stamp = STAMP[next];
  const { rows } = await query(
    `UPDATE sms_messages SET status = $2::text, ${stamp ? `${stamp} = COALESCE(${stamp}, NOW()),` : ''}
            error = CASE WHEN $2::text = 'failed' THEN $3::text ELSE NULL END,
            error_code = CASE WHEN $2::text = 'failed' THEN $4::text ELSE NULL END, updated_at = NOW()
     WHERE id = $1 AND status = $5 RETURNING id`,
    [row.id, next, error, errorCode, row.status]
  );
  if (!rows[0]) {
    // The status changed meanwhile (ack timeout, expiry, cancel): decide again on the fresh row.
    if (!retry) return null;
    const { rows: [fresh] } = await query(`SELECT * FROM sms_messages WHERE id = $1`, [row.id]);
    return fresh ? advance(fresh, status, { error, errorCode }, false) : null;
  }
  return loadMessage(row.id);
}

async function onEvent(conn, event, message) {
  const deviceId = conn.deviceId;
  if (event === 'sms.received' || message.direction === 'in') {
    if (await knownPhoneMessage(deviceId, 'in', message)) {
      sendTo(deviceId, ackEventCommand(message.id));
      return;
    }
    const sim = await simRowFor(deviceId, message);
    const segments = smsSegments(message.text);
    const { rows } = await query(
      `INSERT INTO sms_messages (device_id, sim_row_id, slot, direction, phone, text, parts, encoding, status, source, device_message_id, created_at)
       VALUES ($1, $2, $3, 'in', $4, $5, $6, $7, 'received', 'device', $8, COALESCE(to_timestamp($9 / 1000.0), NOW()))
       ON CONFLICT (device_id, direction, device_message_id) WHERE device_message_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [deviceId, sim?.id || null, sim?.slot ?? message.slot, message.phone || 'unknown', message.text, Math.max(message.parts, segments.parts || 1), segments.encoding, message.id, message.createdAt || null]
    );
    // Acknowledge duplicates as well, or the phone keeps re-sending them.
    sendTo(deviceId, ackEventCommand(message.id));
    if (rows[0]) {
      const row = await loadMessage(rows[0].id);
      await emitMessage(row);
      const { rows: devices } = await query(`SELECT * FROM sms_devices WHERE id = $1`, [deviceId]);
      if (devices[0]) await notifyIncoming(devices[0], row);
    }
    return;
  }

  const status = phoneStatus(message.status, event);
  let row = null;
  if (message.ref && UUID.test(message.ref)) {
    ({ rows: [row] } = await query(`SELECT * FROM sms_messages WHERE uuid = $1 AND device_id = $2`, [message.ref, deviceId]));
  }
  if (!row) {
    ({ rows: [row] } = await query(`SELECT * FROM sms_messages WHERE device_id = $1 AND direction = 'out' AND device_message_id = $2`, [deviceId, message.id]));
    if (row && message.text && row.text !== message.text) {
      // The app was reinstalled and counts from 1 again: this id now names another message.
      await query(`UPDATE sms_messages SET device_message_id = NULL WHERE id = $1`, [row.id]);
      row = null;
    }
  }
  if (!row) {
    // Sent from the phone itself (its app, its local API, Telegram): keep it in the history too.
    const sim = await simRowFor(deviceId, message);
    const segments = smsSegments(message.text);
    const { rows } = await query(
      `INSERT INTO sms_messages (device_id, sim_row_id, slot, direction, phone, text, parts, encoding, status, source, ref, device_message_id, created_at)
       VALUES ($1, $2, $3, 'out', $4, $5, $6, $7, 'accepted', 'phone', $8, $9, COALESCE(to_timestamp($10 / 1000.0), NOW()))
       ON CONFLICT (device_id, direction, device_message_id) WHERE device_message_id IS NOT NULL DO NOTHING
       RETURNING *`,
      [deviceId, sim?.id || null, sim?.slot ?? message.slot, message.phone || 'unknown', message.text, message.parts, segments.encoding, message.ref, message.id, message.createdAt || null]
    );
    row = rows[0];
    if (!row) return;
  } else if (row.device_message_id === null) {
    await bindPhoneId(row.id, deviceId, 'out', message.id);
  }
  const updated = await advance(row, status, { error: message.error, errorCode: status === 'failed' ? 'PHONE_FAILED' : null });
  if (updated) await emitMessage(updated);
}

async function onAck(conn, frame) {
  if (!frame.ref || !UUID.test(frame.ref)) return;
  const { rows } = await query(`SELECT * FROM sms_messages WHERE uuid = $1 AND device_id = $2`, [frame.ref, conn.deviceId]);
  const row = rows[0];
  if (!row) return;
  if (frame.messageId !== null) await bindPhoneId(row.id, conn.deviceId, 'out', frame.messageId);
  const status = phoneStatus(frame.status) || 'accepted';
  const updated = await advance(row, status, status === 'failed' ? { error: 'Rejected by the phone', errorCode: 'PHONE_REJECTED' } : {});
  if (updated) await emitMessage(updated);
}

async function onReject(conn, frame) {
  if (!frame.ref || !UUID.test(frame.ref)) return;
  const { rows } = await query(`SELECT * FROM sms_messages WHERE uuid = $1 AND device_id = $2`, [frame.ref, conn.deviceId]);
  if (!rows[0]) return;
  const updated = await advance(rows[0], 'failed', { error: frame.error, errorCode: 'PHONE_REJECTED' });
  if (updated) await emitMessage(updated);
}

// ── Dispatcher ──

async function pumpAll() {
  if (!connections.size) return;
  const state = await settingsOf();
  if (!state.enabled) return;
  for (const deviceId of connections.keys()) await pump(deviceId, state.settings);
}

/** Hands this phone what is due, without exceeding its messages per minute. */
export async function pump(deviceId, settings = null) {
  deviceId = Number(deviceId);
  if (!connections.has(deviceId) || pumping.has(deviceId)) return;
  pumping.add(deviceId);
  try {
    const config = settings || (await settingsOf()).settings || {};
    const { rows: [info] } = await query(
      `SELECT d.enabled, d.rate_per_minute,
              (SELECT COUNT(*)::int FROM sms_messages WHERE device_id = d.id AND dispatched_at > NOW() - INTERVAL '60 seconds') AS recent
       FROM sms_devices d WHERE d.id = $1`,
      [deviceId]
    );
    if (!info?.enabled) return;
    const rate = info.rate_per_minute || config.ratePerMinute || 20;
    const room = Math.min(rate - info.recent, Math.max(1, Math.ceil(rate / 30)));
    if (room <= 0) return;
    const { rows } = await query(
      `UPDATE sms_messages m SET status = 'dispatched', dispatched_at = NOW(), attempts = m.attempts + 1, updated_at = NOW()
       WHERE m.id IN (
         SELECT id FROM sms_messages
         WHERE device_id = $1 AND status IN ('queued', 'scheduled') AND (send_after IS NULL OR send_after <= NOW())
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY id LIMIT $2 FOR UPDATE SKIP LOCKED)
       RETURNING m.id, m.uuid, m.phone, m.text, m.slot, m.sim_row_id`,
      [deviceId, room]
    );
    if (!rows.length) return;
    const { rows: sims } = await query(`SELECT id, slot FROM sms_sims WHERE device_id = $1`, [deviceId]);
    const slots = new Map(sims.map((sim) => [sim.id, sim.slot]));
    for (const row of rows.sort((a, b) => Number(a.id) - Number(b.id))) {
      const slot = row.sim_row_id ? (slots.get(row.sim_row_id) ?? row.slot) : row.slot;
      if (!sendTo(deviceId, sendCommand({ ref: row.uuid, phone: row.phone, text: row.text, slot }))) {
        await query(`UPDATE sms_messages SET status = 'queued', attempts = GREATEST(attempts - 1, 0), dispatched_at = NULL WHERE id = $1`, [row.id]);
      }
    }
  } finally {
    pumping.delete(deviceId);
  }
}

/** Messages a phone never confirmed go back to the queue, or fail after the last attempt. */
async function requeueUnacked() {
  const state = await settingsOf();
  const config = state.settings || {};
  const { rows } = await query(
    `UPDATE sms_messages
     SET status = CASE WHEN attempts >= $2 THEN 'failed' ELSE 'queued' END,
         error = CASE WHEN attempts >= $2 THEN 'The phone did not confirm the message' ELSE error END,
         error_code = CASE WHEN attempts >= $2 THEN 'NO_ACK' ELSE error_code END,
         failed_at = CASE WHEN attempts >= $2 THEN NOW() ELSE failed_at END,
         updated_at = NOW()
     WHERE status = 'dispatched' AND dispatched_at < NOW() - make_interval(secs => $1)
     RETURNING id, status`,
    [config.ackTimeoutSec || 60, config.maxAttempts || 3]
  );
  for (const row of rows.filter((item) => item.status === 'failed')) await emitMessage(await loadMessage(row.id));
}

/** Kick the dispatcher for these phones right away (after new messages were queued). */
export function kick(deviceIds) {
  for (const id of new Set(deviceIds.map(Number))) pump(id).catch(() => {});
}
