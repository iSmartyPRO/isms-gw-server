/*
 * The iSMS GW "persistent link" protocol (Android: net/RemoteClient.kt).
 * Pure functions: parse what the phone sends, build what the server sends,
 * and decide how a message status may move. No database, no sockets.
 *
 *   phone → server: hello, event, ack, error, status, pong
 *   server → phone: send, ack_event, get_status, ping
 */

export const PHONE_FRAMES = ['hello', 'event', 'ack', 'error', 'status', 'pong'];
export const PHONE_EVENTS = ['sms.received', 'sms.sent', 'sms.delivered', 'sms.failed'];
const MAX_FRAME = 256 * 1024;

const str = (value, max = 200) => (value === undefined || value === null ? '' : String(value).slice(0, max));
const int = (value, fallback = null) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
};
const bool = (value) => value === true || value === 'true' || value === 1;
// Columns are SMALLINT / INTEGER / BIGINT: a value out of range would fail the whole frame.
const bounded = (value, min, max, fallback) => {
  const number = int(value, fallback);
  return number === null ? null : Math.min(max, Math.max(min, number));
};
const safeId = (value) => {
  const number = int(value);
  return number !== null && Number.isSafeInteger(number) && number >= 0 ? number : null;
};
// Milliseconds since 1970 up to the year 2286; anything else is ignored (the server time is used).
const epochMs = (value) => {
  const number = int(value, 0);
  return number > 0 && number < 1e13 ? number : 0;
};

/** A text frame → `{ type, … }` or null when it is not a frame we understand. */
export function parseFrame(text) {
  if (typeof text !== 'string' || !text || text.length > MAX_FRAME) return null;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const type = str(data.type, 20);
  if (!PHONE_FRAMES.includes(type)) return null;
  switch (type) {
    case 'hello':
      return {
        type,
        deviceId: str(data.deviceId, 100),
        deviceName: str(data.deviceName, 120),
        version: str(data.version, 40),
        sims: cleanSims(data.sims),
      };
    case 'status':
      return { type, sims: cleanSims(data.sims), stats: cleanStats(data.stats) };
    case 'event': {
      const event = str(data.event, 40);
      if (!PHONE_EVENTS.includes(event)) return null;
      const message = cleanMessage(data.data);
      return message ? { type, event, message } : null;
    }
    case 'ack':
      return { type, ref: str(data.id, 64) || null, to: str(data.to, 40), messageId: safeId(data.messageId), status: str(data.status, 20) };
    case 'error':
      return { type, ref: str(data.id, 64) || null, to: str(data.to, 40), error: str(data.error, 500) || 'Rejected by the phone' };
    case 'pong':
      return { type, ts: int(data.ts) };
    default:
      return null;
  }
}

/** SimInfo list from the phone, trimmed to what the server keeps. */
export function cleanSims(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const sim of list.slice(0, 16)) {
    if (!sim || typeof sim !== 'object') continue;
    const simId = int(sim.simId ?? sim.subscriptionId);
    if (simId === null || simId < -2147483648 || simId > 2147483647 || seen.has(simId)) continue;
    seen.add(simId);
    out.push({
      simId,
      slot: bounded(sim.slot, 0, 32767, 0),
      active: sim.active === undefined ? true : bool(sim.active),
      embedded: bool(sim.embedded),
      carrier: str(sim.carrier, 80),
      displayName: str(sim.displayName, 80),
      number: str(sim.number, 40),
      country: str(sim.country, 8).toUpperCase(),
      label: str(sim.label, 60),
      color: /^#[0-9a-f]{6}$/i.test(str(sim.color, 7)) ? str(sim.color, 7) : '',
      sendEnabled: sim.sendEnabled === undefined ? true : bool(sim.sendEnabled),
      receiveEnabled: sim.receiveEnabled === undefined ? true : bool(sim.receiveEnabled),
      dailyLimit: bounded(sim.dailyLimit, 0, 2147483647, 0),
      isDefault: bool(sim.isDefault),
      iccTail: str(sim.iccTail, 8),
    });
  }
  return out;
}

function cleanStats(stats) {
  if (!stats || typeof stats !== 'object') return null;
  const keys = ['sentToday', 'receivedToday', 'failedToday', 'queued', 'totalOut', 'totalIn'];
  const out = {};
  for (const key of keys) out[key] = bounded(stats[key], 0, Number.MAX_SAFE_INTEGER, 0);
  return out;
}

/** A Message from an `event` frame. */
export function cleanMessage(data) {
  if (!data || typeof data !== 'object') return null;
  const id = safeId(data.id);
  if (id === null) return null;
  const direction = data.direction === 'in' ? 'in' : 'out';
  return {
    id,
    direction,
    phone: str(data.phone, 40),
    text: str(data.text, 5000),
    slot: bounded(data.sim, 0, 32767, 0),
    simId: bounded(data.simId, -1, 2147483647, -1),
    status: str(data.status, 20),
    error: data.error ? str(data.error, 500) : null,
    parts: bounded(data.parts, 1, 255, 1),
    source: str(data.source, 20),
    ref: data.ref ? str(data.ref, 64) : null,
    createdAt: epochMs(data.createdAt),
    sentAt: epochMs(data.sentAt),
    deliveredAt: epochMs(data.deliveredAt),
  };
}

// ── Commands ──

export const sendCommand = ({ ref, phone, text, slot = 0 }) => JSON.stringify({ type: 'send', id: ref, to: phone, text, sim: Math.max(0, int(slot, 0)) });
export const ackEventCommand = (messageId) => JSON.stringify({ type: 'ack_event', messageId });
export const statusCommand = () => JSON.stringify({ type: 'get_status' });
export const pingCommand = () => JSON.stringify({ type: 'ping' });

// ── Message status ──

/*
 * Outgoing:  scheduled → queued → dispatched → accepted → sent → delivered
 *            failed / cancelled / expired end the way.
 * Incoming:  received.
 */
export const OUT_STATUSES = ['scheduled', 'queued', 'dispatched', 'accepted', 'sent', 'delivered', 'failed', 'cancelled', 'expired'];
export const FINAL = new Set(['delivered', 'failed', 'cancelled', 'expired', 'received']);
const RANK = { scheduled: 0, queued: 1, dispatched: 2, accepted: 3, sent: 4, delivered: 5 };

/** What the phone reports (Message.status / event) → our status. */
export function phoneStatus(value, event = null) {
  if (event === 'sms.delivered') return 'delivered';
  if (event === 'sms.failed') return 'failed';
  if (event === 'sms.sent') return 'sent';
  switch (String(value || '')) {
    case 'queued':
    case 'sending':
      return 'accepted';
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'failed':
      return 'failed';
    case 'received':
      return 'received';
    default:
      return null;
  }
}

/**
 * The status a message moves to, or null when the change must be ignored:
 * statuses never go back (a late "sent" after "delivered"), and a final one
 * stays — except that a delivery report may still arrive after "failed"
 * caused by a lost acknowledgement (NO_ACK).
 */
export function nextStatus(current, incoming, { error = null } = {}) {
  if (!incoming || incoming === current) return null;
  if (incoming === 'failed') return ['delivered', 'cancelled', 'expired', 'failed'].includes(current) ? null : 'failed';
  if (current === 'failed' && error === 'NO_ACK' && RANK[incoming] >= RANK.accepted) return incoming;
  if (FINAL.has(current)) return null;
  if (!(incoming in RANK)) return null;
  return RANK[incoming] > (RANK[current] ?? -1) ? incoming : null;
}
