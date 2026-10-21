import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, parseRecipients, smsSegments } from '../modules/sms/phone.js';
import { cleanSims, nextStatus, parseFrame, phoneStatus, sendCommand } from '../modules/sms/protocol.js';
import { pickRoute, planBatch, usable } from '../modules/sms/routing.js';
import { bearerOf, hashToken, newDeviceToken, TOKEN_PATTERN } from '../modules/sms/tokens.js';
import { MODULE_CATALOG } from '../modules/catalog.js';
import { EVENT_TYPES } from '../api/events.js';
import { cleanLimits, RESOURCE_KINDS } from '../api/scopes.js';

test('sms: local numbers use the default country, international ones keep theirs', () => {
  assert.equal(normalizePhone('0555 123 456', 'KG').phone, '+996555123456');
  assert.equal(normalizePhone('+90 532 123 45 67', 'KG').phone, '+905321234567');
  assert.equal(normalizePhone('00996555123456', '').phone, '+996555123456');
  assert.equal(normalizePhone('996555123456', '').phone, '+996555123456');
  assert.equal(normalizePhone('(555) 12-34-56', 'KG').phone, '+996555123456');
});

test('sms: short service numbers pass as they are, rubbish is refused with a reason', () => {
  assert.deepEqual(normalizePhone('1414', 'KG'), { ok: true, phone: '1414', country: null, short: true });
  assert.equal(normalizePhone('', 'KG').reason, 'EMPTY');
  assert.equal(normalizePhone('hello', 'KG').reason, 'FORMAT');
  assert.equal(normalizePhone('+1', 'KG').ok, false);
  assert.equal(normalizePhone('12345678901234567890', 'KG').ok, false);
});

test('sms: recipients are split, normalised and deduplicated in order', () => {
  const result = parseRecipients('0555123456, +996555123456\n+905321234567; bad', 'KG');
  assert.deepEqual(result.valid, ['+996555123456', '+905321234567']);
  assert.deepEqual(result.invalid, [{ input: 'bad', reason: 'FORMAT' }]);
  assert.equal(parseRecipients(['0555123456', '0555123457', '0555123458'], 'KG', 2).truncated, true);
});

test('sms: segments follow GSM-7 and UCS-2 limits', () => {
  assert.deepEqual(smsSegments(''), { encoding: 'GSM-7', length: 0, parts: 0, perPart: 160, remaining: 160 });
  assert.equal(smsSegments('a'.repeat(160)).parts, 1);
  assert.equal(smsSegments('a'.repeat(161)).parts, 2);
  assert.equal(smsSegments('a'.repeat(306)).parts, 2);
  assert.equal(smsSegments('a'.repeat(307)).parts, 3);
  // An extension character ([, €, …) takes two septets.
  assert.equal(smsSegments('€'.repeat(80)).length, 160);
  assert.equal(smsSegments('€'.repeat(81)).parts, 2);
  const cyrillic = smsSegments('Привет');
  assert.equal(cyrillic.encoding, 'UCS-2');
  assert.equal(smsSegments('я'.repeat(70)).parts, 1);
  assert.equal(smsSegments('я'.repeat(71)).parts, 2);
  // Turkish ı and ş are not in GSM-7 (the phone does not use national shift tables).
  assert.equal(smsSegments('Merhaba dünya ış').encoding, 'UCS-2');
  // An emoji outside the BMP counts as two UTF-16 units.
  assert.equal(smsSegments('🙂').length, 2);
});

test('sms protocol: frames from the phone are parsed and trimmed', () => {
  assert.equal(parseFrame('not json'), null);
  assert.equal(parseFrame('[]'), null);
  assert.equal(parseFrame(JSON.stringify({ type: 'unknown' })), null);
  const hello = parseFrame(JSON.stringify({ type: 'hello', deviceId: 'abc', deviceName: 'Pixel', version: '1.4.0', sims: [{ simId: 3, slot: 1, carrier: 'MegaCom', color: 'red' }, { simId: 3 }, { slot: 2 }] }));
  assert.equal(hello.deviceId, 'abc');
  assert.equal(hello.sims.length, 1);
  assert.equal(hello.sims[0].color, '');
  assert.equal(hello.sims[0].sendEnabled, true);
  const event = parseFrame(JSON.stringify({ type: 'event', event: 'sms.received', data: { id: 7, direction: 'in', phone: '+996555123456', text: 'Hi', sim: 1, simId: 3, status: 'received' } }));
  assert.equal(event.message.id, 7);
  assert.equal(event.message.slot, 1);
  assert.equal(parseFrame(JSON.stringify({ type: 'event', event: 'call.missed', data: { id: 1 } })), null);
  assert.equal(parseFrame(JSON.stringify({ type: 'event', event: 'sms.sent', data: { phone: 'x' } })), null);
  const ack = parseFrame(JSON.stringify({ type: 'ack', id: 'u-1', to: '+1', messageId: 12, status: 'queued' }));
  assert.deepEqual(ack, { type: 'ack', ref: 'u-1', to: '+1', messageId: 12, status: 'queued' });
  assert.equal(parseFrame(JSON.stringify({ type: 'error', id: 'u-1' })).error, 'Rejected by the phone');
});

test('sms protocol: subscriptionId is read as simId (API v1 of the app)', () => {
  assert.equal(cleanSims([{ subscriptionId: 5, slot: 2 }])[0].simId, 5);
});

test('sms protocol: commands match RemoteClient.kt', () => {
  assert.deepEqual(JSON.parse(sendCommand({ ref: 'r', phone: '+1', text: 't', slot: 2 })), { type: 'send', id: 'r', to: '+1', text: 't', sim: 2 });
  assert.equal(JSON.parse(sendCommand({ ref: 'r', phone: '+1', text: 't', slot: null })).sim, 0);
});

test('sms status: phone statuses map onto ours', () => {
  assert.equal(phoneStatus('queued'), 'accepted');
  assert.equal(phoneStatus('sending'), 'accepted');
  assert.equal(phoneStatus('sent'), 'sent');
  assert.equal(phoneStatus('whatever'), null);
  assert.equal(phoneStatus('sent', 'sms.delivered'), 'delivered');
  assert.equal(phoneStatus('queued', 'sms.failed'), 'failed');
});

test('sms status: never goes back, final states stay, a late report after a lost ack is taken', () => {
  assert.equal(nextStatus('queued', 'dispatched'), 'dispatched');
  assert.equal(nextStatus('dispatched', 'accepted'), 'accepted');
  assert.equal(nextStatus('accepted', 'delivered'), 'delivered');
  assert.equal(nextStatus('delivered', 'sent'), null);
  assert.equal(nextStatus('sent', 'accepted'), null);
  assert.equal(nextStatus('sent', 'failed'), 'failed');
  assert.equal(nextStatus('delivered', 'failed'), null);
  assert.equal(nextStatus('cancelled', 'sent'), null);
  assert.equal(nextStatus('failed', 'sent'), null);
  assert.equal(nextStatus('failed', 'sent', { error: 'NO_ACK' }), 'sent');
  assert.equal(nextStatus('queued', 'queued'), null);
});

const sim = (over) => ({ deviceId: 1, simRowId: 1, slot: 1, online: true, deviceEnabled: true, simActive: true, sendEnabled: true, sentToday: 0, dailyLimit: 0, ...over });

test('sms routing: switched-off phones, SIMs and used-up limits are skipped', () => {
  assert.equal(usable(sim({ deviceEnabled: false })), false);
  assert.equal(usable(sim({ sendEnabled: false })), false);
  assert.equal(usable(sim({ simActive: false })), false);
  assert.equal(usable(sim({ dailyLimit: 10, sentToday: 10 })), false);
  assert.equal(usable(sim({ dailyLimit: 10, sentToday: 9 }), 1), false);
  assert.equal(usable(sim({ dailyLimit: 10, sentToday: 9 })), true);
  assert.equal(pickRoute([sim({ sendEnabled: false })]), null);
});

test('sms routing: online first, then the SIM with most room', () => {
  const offline = sim({ simRowId: 1, online: false });
  const busy = sim({ simRowId: 2, sentToday: 50 });
  const quiet = sim({ simRowId: 3, sentToday: 5 });
  assert.equal(pickRoute([offline, busy, quiet]).simRowId, 3);
  assert.equal(pickRoute([offline]).simRowId, 1);
  const limited = sim({ simRowId: 4, dailyLimit: 100, sentToday: 0 });
  const almost = sim({ simRowId: 5, dailyLimit: 100, sentToday: 95 });
  assert.equal(pickRoute([almost, limited]).simRowId, 4);
});

test('sms routing: a batch spreads over SIMs and stops at the limits', () => {
  const a = sim({ simRowId: 1 });
  const b = sim({ simRowId: 2 });
  const plan = planBatch([a, b], 4).map((choice) => choice.simRowId);
  assert.deepEqual(plan, [1, 2, 1, 2]);
  const small = sim({ simRowId: 3, dailyLimit: 2 });
  const out = planBatch([small], 3);
  assert.equal(out[0].simRowId, 3);
  assert.equal(out[1].simRowId, 3);
  assert.equal(out[2], null);
});

test('sms tokens: format, hash and bearer header', () => {
  const { token, prefix, hash } = newDeviceToken();
  assert.match(token, TOKEN_PATTERN);
  assert.ok(token.startsWith(`${prefix}_`));
  assert.equal(hash, hashToken(token));
  assert.equal(bearerOf(`Bearer ${token}`), token);
  assert.equal(bearerOf(`bearer   ${token}`), token);
  assert.equal(bearerOf('Bearer pat_abc'), null);
  assert.equal(bearerOf(''), null);
  assert.notEqual(newDeviceToken().token, token);
});

test('sms settings: sanitize keeps values in range and ignores junk', () => {
  const entry = MODULE_CATALOG.find((module) => module.id === 'sms');
  const next = entry.sanitize(entry.defaults, { defaultCountry: 'tr', ratePerMinute: 1000, queueTtlHours: 0, userDevices: 'yes', retentionDays: -5, unknown: 1 });
  assert.equal(next.defaultCountry, 'TR');
  assert.equal(next.ratePerMinute, 120);
  assert.equal(next.queueTtlHours, 1);
  assert.equal(next.userDevices, true);
  assert.equal(next.retentionDays, 0);
  assert.equal('unknown' in next, false);
  assert.equal(entry.sanitize(entry.defaults, { defaultCountry: 'Turkey' }).defaultCountry, 'KG');
  assert.equal(entry.sanitize(entry.defaults, { defaultCountry: '' }).defaultCountry, '');
});

test('sms platform wiring: webhook events and token limits by phone', () => {
  for (const type of ['sms.received', 'sms.sent', 'sms.delivered', 'sms.failed', 'device.online', 'device.offline']) assert.ok(EVENT_TYPES.includes(type), type);
  assert.ok(RESOURCE_KINDS.some((kind) => kind.key === 'sms.devices' && kind.table === 'sms_device_acl'));
  assert.deepEqual(cleanLimits({ 'sms.devices': ['2', 2, 0] }), { 'sms.devices': [2] });
});

test('sms knowledge base: guides use the portal host, never a hard-coded one', async () => {
  const { portalHost } = await import('../modules/sms/kbSeed.js');
  assert.equal(portalHost('https://sms.acme.io'), 'sms.acme.io');
  assert.equal(portalHost('http://localhost:8092'), 'sms.example.com');
  assert.equal(portalHost(''), 'sms.example.com');
  for (const lang of ['en', 'ru', 'tr']) {
    const pack = (await import(`../modules/sms/kb/${lang}.js`)).default;
    const text = JSON.stringify(pack);
    assert.ok(!/ismarty\.pro/i.test(text), `${lang}: no installation-specific host`);
    assert.ok(text.includes('{{HOST}}'), `${lang}: uses {{HOST}}`);
    assert.equal(pack.articles.length, 14);
  }
});

test('sms phone tokens: send and read, never change the phone, its SIMs, token or access', async () => {
  const { phoneTokenPolicy } = await import('../modules/sms/apiTokens.js');
  const { decide, effectivePolicy, limitsByTable } = await import('../api/scopes.js');
  const policy = effectivePolicy(null, phoneTokenPolicy());
  const ok = (method, path) => decide(policy, method, path).ok;
  assert.ok(ok('POST', '/app/sms/messages'));
  assert.ok(ok('GET', '/app/sms/messages'));
  assert.ok(ok('GET', '/app/sms/messages/42'));
  assert.ok(ok('POST', '/app/sms/messages/42/retry'));
  assert.ok(ok('POST', '/app/sms/messages/42/cancel'));
  assert.ok(ok('POST', '/app/sms/messages/read'));
  assert.ok(ok('POST', '/app/sms/tools/segments'));
  assert.ok(ok('GET', '/app/sms/devices'));
  assert.ok(ok('GET', '/app/sms/threads'));
  assert.ok(!ok('POST', '/app/sms/devices'));
  assert.ok(!ok('PUT', '/app/sms/devices/3'));
  assert.ok(!ok('DELETE', '/app/sms/devices/3'));
  assert.ok(!ok('POST', '/app/sms/devices/3/token'));
  assert.ok(!ok('PUT', '/app/sms/sims/7'));
  assert.ok(!ok('GET', '/app/sms/devices/3/access'));
  assert.ok(!ok('GET', '/app/sms/devices/3/events'));
  assert.ok(!ok('GET', '/app/sms/devices/3/tokens'));
  assert.ok(!ok('POST', '/app/sms/devices/3/tokens'));
  assert.ok(!ok('GET', '/app/sms/subjects'));
  assert.ok(!ok('GET', '/app/files/'));
  assert.ok(!ok('GET', '/admin/users'));
  assert.deepEqual([...limitsByTable({ 'sms.devices': [3], 'sms.sims': [7] }).sms_sims], [7]);
});

test('sms phone tokens: a SIM limit narrows what the service lets through', async () => {
  const { simLimit } = await import('../modules/sms/service.js');
  assert.equal(simLimit({ limits: null }), null);
  assert.deepEqual(simLimit({ limits: { sms_sims: new Set([7, 9]) } }), [7, 9]);
});

test('sms phone tokens: only tokens made on the phone page are listed and revoked there', async () => {
  const { isPhoneToken, phoneTokenPolicy } = await import('../modules/sms/apiTokens.js');
  const policy = phoneTokenPolicy();
  const made = { template_id: null, scopes: policy.scopes, rules: policy.rules, limits: { 'sms.devices': [3], 'sms.sims': [7] } };
  assert.equal(isPhoneToken(made), true);
  assert.equal(isPhoneToken({ ...made, scopes: { sms: 'write' } }), false, 'wider scopes: a console token');
  assert.equal(isPhoneToken({ ...made, scopes: { ...policy.scopes, crm: 'write' } }), false);
  assert.equal(isPhoneToken({ ...made, template_id: 2 }), false);
  assert.equal(isPhoneToken({ ...made, limits: { 'sms.devices': [3, 4] } }), false, 'reaches other phones');
  assert.equal(isPhoneToken({ ...made, rules: [] }), false);
  assert.equal(isPhoneToken({ ...made, limits: { 'sms.devices': [3], 'files.spaces': [1] } }), false);
});
