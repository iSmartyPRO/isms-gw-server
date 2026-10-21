#!/usr/bin/env node
/*
 * End-to-end check of the SMS gateway with a simulated phone that speaks the
 * iSMS GW protocol (Android net/RemoteClient.kt). Creates a phone, connects,
 * sends and receives messages, checks statuses, then deletes the phone.
 *
 *   BASE=http://127.0.0.1:3999 SESSION=<da_session cookie> node scripts/sms-e2e.mjs
 *   (or JWT_SECRET + USER_ID: the script signs a session itself)
 *
 * Run from src/backend (it uses the backend's ws and jsonwebtoken packages).
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(join(process.cwd(), 'package.json'));
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const BASE = process.env.BASE || 'http://127.0.0.1:3999';
const WS_URL = BASE.replace(/^http/, 'ws') + '/ws/device';
const session = process.env.SESSION || jwt.sign({ sub: String(process.env.USER_ID || 1), tv: Number(process.env.TOKEN_VERSION || 0) }, process.env.JWT_SECRET, { expiresIn: '1h' });

let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${label}`);
  if (!cond) failures += 1;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(method, path, body) {
  const res = await fetch(`${BASE}/api/app/sms${path}`, {
    method,
    headers: { Cookie: `da_session=${session}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ...data };
}

async function waitFor(fn, label, ms = 8000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const value = await fn();
    if (value) return value;
    await sleep(200);
  }
  ok(false, `timeout: ${label}`);
  return null;
}

class Phone {
  constructor(token) {
    this.frames = [];
    this.nextId = 100;
    this.ws = new WebSocket(WS_URL, { headers: { Authorization: `Bearer ${token}`, 'X-Device-Id': 'e2e-device-uid', 'X-Device-Name': 'E2E Pixel', 'User-Agent': 'iSMS-GW/9.9.9' } });
    this.ws.on('message', (data) => this.onFrame(JSON.parse(data.toString())));
    this.opened = new Promise((resolve, reject) => {
      this.ws.once('open', resolve);
      this.ws.once('unexpected-response', (req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
      this.ws.once('error', reject);
    });
  }
  send(frame) {
    this.ws.send(JSON.stringify(frame));
  }
  onFrame(frame) {
    this.frames.push(frame);
    if (frame.type === 'ping') this.send({ type: 'pong', ts: Date.now() });
    if (frame.type === 'get_status') this.send({ type: 'status', sims: SIMS, stats: { sentToday: 1, receivedToday: 2, failedToday: 0, queued: 0, totalOut: 10, totalIn: 20 } });
    if (frame.type === 'send' && this.autoAck) {
      const id = (this.nextId += 1);
      this.send({ type: 'ack', id: frame.id, to: frame.to, messageId: id, status: 'queued' });
      setTimeout(() => this.send({ type: 'event', event: 'sms.sent', data: message(id, frame, 'sent') }), 100);
      setTimeout(() => this.send({ type: 'event', event: 'sms.delivered', data: message(id, frame, 'delivered') }), 250);
    }
  }
  close() {
    this.ws.close();
  }
}

const SIMS = [
  { simId: 11, slot: 1, active: true, embedded: false, carrier: 'MegaCom', displayName: 'MegaCom', number: '+996555000111', country: 'KG', label: '', color: '', sendEnabled: true, receiveEnabled: true, dailyLimit: 0, isDefault: true, iccTail: '1234', lastSeen: Date.now() },
  { simId: 12, slot: 2, active: true, embedded: true, carrier: 'Beeline', displayName: 'Beeline', number: '', country: 'KG', label: '', color: '', sendEnabled: true, receiveEnabled: true, dailyLimit: 0, isDefault: false, iccTail: '5678', lastSeen: Date.now() },
];
const message = (id, frame, status) => ({ id, direction: 'out', phone: frame.to, text: frame.text, sim: frame.sim || 1, simId: 11, status, parts: 1, source: 'remote', ref: frame.id, createdAt: Date.now(), updatedAt: Date.now() });

async function main() {
  console.log(`SMS gateway e2e against ${BASE}`);
  const created = await api('POST', '/devices', { name: 'E2E phone', color: '#4F46E5' });
  ok(created.status === 201 && /^smsgw_/.test(created.token || ''), 'phone created with a token');
  const deviceId = created.device?.id;
  if (!deviceId) throw new Error(JSON.stringify(created));

  const bad = new WebSocket(WS_URL, { headers: { Authorization: 'Bearer smsgw_AAAAAAAA_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } });
  const badStatus = await new Promise((resolve) => {
    bad.on('unexpected-response', (req, res) => resolve(res.statusCode));
    bad.on('open', () => resolve(101));
    bad.on('error', () => resolve(0));
  });
  ok(badStatus === 401, `a wrong token is refused (${badStatus})`);

  const phone = new Phone(created.token);
  await phone.opened;
  phone.send({ type: 'hello', deviceId: 'e2e-device-uid', deviceName: 'E2E Pixel', version: '9.9.9', sims: SIMS });
  const online = await waitFor(async () => {
    const res = await api('GET', `/devices/${deviceId}`);
    return res.device?.online && res.device.sims.length === 2 ? res.device : null;
  }, 'phone online with 2 SIMs');
  ok(Boolean(online), 'phone is online and reported 2 SIMs');
  ok(online?.appVersion === '9.9.9', 'app version taken from the phone');
  ok(phone.frames.some((frame) => frame.type === 'get_status'), 'server asked the phone for its status');

  // Outgoing through automatic routing, the phone confirms and reports delivery.
  phone.autoAck = true;
  const sent = await api('POST', '/messages', { to: '0555 123 456', text: 'E2E hello', ref: 'e2e-1', deviceId });
  ok(sent.status === 201 && sent.messages?.[0]?.phone === '+996555123456', 'message queued, number normalised');
  const id = sent.messages?.[0]?.id;
  const delivered = await waitFor(async () => {
    const res = await api('GET', `/messages/${id}`);
    return res.message?.status === 'delivered' ? res.message : null;
  }, 'delivered');
  ok(Boolean(delivered?.deliveredAt && delivered?.sentAt), 'status went to delivered with timestamps');
  const command = phone.frames.find((frame) => frame.type === 'send' && frame.id === sent.messages?.[0]?.uuid);
  ok(Boolean(command && command.to === '+996555123456' && command.sim >= 1), 'the phone got a send command with a SIM slot');

  // A batch spreads over both SIMs.
  const batch = await api('POST', '/messages', { to: ['+996555000001', '+996555000002', '+996555000003', '+996555000004', 'oops'], text: 'Batch Привет', deviceId });
  ok(batch.status === 201 && batch.messages?.length === 4 && batch.invalid?.length === 1 && batch.batchId, 'batch of 4 queued, 1 invalid number reported');
  ok(new Set(batch.messages?.map((m) => m.simId)).size === 2, 'batch spread over both SIMs');
  ok(batch.segments?.encoding === 'UCS-2', 'Cyrillic text counted as UCS-2');
  await waitFor(async () => {
    const res = await api('GET', `/messages?batchId=${batch.batchId}&status=delivered`);
    return res.messages?.length === 4;
  }, 'batch delivered', 15000);

  // The phone rejects a message.
  phone.autoAck = false;
  const rejected = await api('POST', '/messages', { to: '+996555999999', text: 'Blocked destination', deviceId });
  const rejectId = rejected.messages?.[0]?.uuid;
  await waitFor(() => phone.frames.some((frame) => frame.type === 'send' && frame.id === rejectId), 'send command for the rejected one');
  phone.send({ type: 'error', id: rejectId, to: '+996555999999', error: 'Destination blocked by the filter' });
  const failed = await waitFor(async () => {
    const res = await api('GET', `/messages/${rejectId}`);
    return res.message?.status === 'failed' ? res.message : null;
  }, 'rejected → failed');
  ok(failed?.errorCode === 'PHONE_REJECTED', 'a rejected message fails with the phone’s reason');

  // Incoming: stored once, acknowledged every time.
  const incoming = { id: 501, direction: 'in', phone: '+905321234567', text: 'Merhaba from Istanbul', sim: 2, simId: 12, status: 'received', parts: 1, source: 'sim', createdAt: Date.now(), updatedAt: Date.now() };
  phone.send({ type: 'event', event: 'sms.received', data: incoming });
  phone.send({ type: 'event', event: 'sms.received', data: incoming });
  await waitFor(() => phone.frames.filter((frame) => frame.type === 'ack_event' && frame.messageId === 501).length === 2, 'two ack_event');
  const inbox = await api('GET', `/messages?direction=in&deviceId=${deviceId}`);
  ok(inbox.messages?.filter((m) => m.phone === '+905321234567').length === 1, 'incoming stored once although the phone sent it twice');
  ok(inbox.messages?.[0]?.simId === online?.sims?.find((s) => s.simId === 12)?.id, 'incoming bound to the right SIM');

  // Reinstalled app: the same phone id with another text is a new message.
  phone.send({ type: 'event', event: 'sms.received', data: { ...incoming, text: 'After reinstall' } });
  await waitFor(async () => (await api('GET', `/messages?direction=in&deviceId=${deviceId}`)).messages?.length === 2, 'reinstall message stored');

  const threads = await api('GET', `/threads?deviceId=${deviceId}`);
  const thread = threads.threads?.find((item) => item.phone === '+905321234567');
  ok(thread?.unread === 2, 'conversation shows 2 unread');
  const conversation = await api('GET', `/threads/${deviceId}/${encodeURIComponent('+905321234567')}`);
  ok(conversation.messages?.length === 2 && conversation.canSend === true, 'conversation loads');
  const read = await api('POST', '/messages/read', { deviceId, phone: '+905321234567' });
  ok(read.updated === 2, 'conversation marked read');

  // Phone-originated message (sent from the phone's own app) appears in history.
  phone.send({ type: 'event', event: 'sms.sent', data: { id: 900, direction: 'out', phone: '+996700111222', text: 'Typed on the phone', sim: 1, simId: 11, status: 'sent', parts: 1, source: 'app', ref: null, createdAt: Date.now() } });
  await waitFor(async () => (await api('GET', `/messages?direction=out&phone=700111222`)).messages?.[0]?.source === 'phone', 'phone-originated message stored');

  // Scheduled and cancel.
  const later = await api('POST', '/messages', { to: '+996555777888', text: 'Later', sendAt: new Date(Date.now() + 3600_000).toISOString(), deviceId });
  ok(later.messages?.[0]?.status === 'scheduled', 'scheduled message');
  const cancelled = await api('POST', `/messages/${later.messages?.[0]?.id}/cancel`);
  ok(cancelled.message?.status === 'cancelled', 'scheduled message cancelled');
  const retried = await api('POST', `/messages/${later.messages?.[0]?.id}/retry`);
  ok(retried.message?.status === 'queued', 'cancelled message re-queued');

  // Overview and SIM settings.
  const overview = await api('GET', `/overview?deviceId=${deviceId}`);
  ok(overview.today?.delivered >= 5 && overview.series?.length === 14, 'overview counts today and a 14-day series');
  const simRow = online.sims.find((s) => s.simId === 12);
  const sim = await api('PUT', `/sims/${simRow.id}`, { label: 'Corporate', dailyLimit: 1, sendEnabled: true });
  ok(sim.sim?.label === 'Corporate' && sim.sim?.dailyLimit === 1, 'SIM label and limit saved');
  const limited = await api('POST', '/messages', { to: ['+996555000010', '+996555000011'], text: 'Limit', simId: simRow.id });
  ok(limited.status === 409 && limited.code === 'SIM_LIMIT', `SIM limit enforced (${limited.code})`);

  // An API token made on the phone page, pinned to SIM 1.
  phone.autoAck = true;
  const sim1 = online.sims.find((s) => s.simId === 11);
  const sim2 = online.sims.find((s) => s.simId === 12);
  const made = await api('POST', `/devices/${deviceId}/tokens`, { simId: sim1.id, expiresDays: 30 });
  ok(made.status === 201 && /^pat_/.test(made.secret || ''), 'phone token created for one SIM');
  const pat = async (method, path, body) => {
    const res = await fetch(`${BASE}/api/v1/app/sms${path}`, { method, headers: { Authorization: `Bearer ${made.secret}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, ...(await res.json().catch(() => ({}))) };
  };
  const viaToken = await pat('POST', '/messages', { to: '+996555111222', text: 'Via phone token' });
  ok(viaToken.status === 201 && viaToken.messages?.[0]?.simId === sim1.id, 'token sends through its SIM without naming it');
  ok((await pat('POST', '/messages', { to: '+996555111223', text: 'Other SIM', simId: sim2.id })).code === 'SIM_NOT_ALLOWED', 'token refuses another SIM');
  const tokenDevices = await pat('GET', '/devices');
  ok(tokenDevices.devices?.length === 1 && tokenDevices.devices[0].sims.length === 1, 'token sees one phone and one SIM');
  const tokenMessages = await pat('GET', '/messages?limit=200');
  ok(tokenMessages.messages?.every((m) => m.simId === sim1.id), 'token reads only messages of its SIM');
  ok((await pat('PUT', `/devices/${deviceId}`, { name: 'Hacked' })).status === 403, 'token cannot change the phone');
  ok((await pat('GET', `/devices/${deviceId}/access`)).status === 403, 'token cannot read the access list');
  ok((await pat('POST', `/devices/${deviceId}/token`)).status === 403, 'token cannot replace the phone token');
  ok((await pat('POST', `/devices/${deviceId}/tokens`, {})).status === 403, 'token cannot make tokens');
  const listed = await api('GET', `/devices/${deviceId}/tokens`);
  ok(listed.tokens?.[0]?.sim?.id === sim1.id && listed.tokens[0].state === 'active', 'phone page lists the token with its SIM');
  await api('POST', `/devices/${deviceId}/tokens/${made.token.id}/revoke`);
  await sleep(16000); // token lookups are cached for 15 s
  ok((await pat('GET', '/devices')).status === 401, 'revoked token stops working');

  // Token rotation drops the connection.
  const closed = new Promise((resolve) => phone.ws.once('close', (code) => resolve(code)));
  const rotated = await api('POST', `/devices/${deviceId}/token`);
  ok(/^smsgw_/.test(rotated.token || ''), 'token rotated');
  ok((await closed) === 4001, 'old connection closed by the server');
  const offline = await waitFor(async () => !(await api('GET', `/devices/${deviceId}`)).device?.online, 'offline after rotation');
  ok(Boolean(offline), 'phone shows offline');

  const events = await api('GET', `/devices/${deviceId}/events`);
  ok(events.events?.some((e) => e.kind === 'connected') && events.events?.some((e) => e.kind === 'token_rotated'), 'device journal records connection and token rotation');

  const removed = await api('DELETE', `/devices/${deviceId}`);
  ok(removed.success === true, 'phone deleted');
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
