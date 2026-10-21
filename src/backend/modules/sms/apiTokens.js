import { query } from '../../config/database.js';
import { apiConfig } from '../../api/config.js';
import { createToken, revokeResourceToken } from '../../api/tokens.js';
import { cleanRules } from '../../api/scopes.js';
import { httpError, LEVEL, levelOn, requireLevel } from '../shared/acl.js';
import { moduleSettings } from './service.js';
import { ACL } from './events.js';

/*
 * API tokens made right on a phone's page: a platform token (pat_…) of the
 * person who makes it, narrowed to this phone and, when chosen, one SIM card.
 * It sends and reads messages; it never changes the phone, its SIM cards,
 * its connection token or who has access.
 */

const EXPIRY_DAYS = [0, 30, 90, 180, 365];

/** Scopes and rules of a phone token (pure, tested). */
export function phoneTokenPolicy() {
  return {
    // Read everything of the SMS gateway the limits leave visible…
    scopes: { sms: 'read' },
    rules: cleanRules([
      // …and write only what sending needs.
      { effect: 'allow', methods: ['POST'], path: '/app/sms/messages', note: 'Send' },
      { effect: 'allow', methods: ['POST'], path: '/app/sms/messages/*/cancel', note: 'Cancel a queued message' },
      { effect: 'allow', methods: ['POST'], path: '/app/sms/messages/*/retry', note: 'Send again' },
      { effect: 'allow', methods: ['POST'], path: '/app/sms/messages/read', note: 'Mark incoming as read' },
      { effect: 'allow', methods: ['POST'], path: '/app/sms/tools/**', note: 'Count parts, check numbers' },
      // Who has access to the phone and its journal stay with its managers.
      { effect: 'deny', methods: [], path: '/app/sms/devices/*/access', note: 'Phone access list' },
      { effect: 'deny', methods: [], path: '/app/sms/devices/*/events', note: 'Phone journal' },
      { effect: 'deny', methods: [], path: '/app/sms/devices/*/tokens/**', note: 'Phone API tokens' },
      { effect: 'deny', methods: [], path: '/app/sms/subjects', note: 'People and groups' },
    ]),
  };
}

const simName = (sim) => sim.label || sim.phone_label || sim.carrier || `SIM ${sim.slot}`;

async function managedDevice(ctx, deviceId) {
  const id = Number(deviceId);
  if (!Number.isInteger(id) || id <= 0) throw httpError(404, 'Phone not found', 'NOT_FOUND');
  requireLevel(await levelOn(ACL, id, ctx), LEVEL.manage);
  const { rows } = await query(`SELECT id, name FROM sms_devices WHERE id = $1`, [id]);
  if (!rows[0]) throw httpError(404, 'Phone not found', 'NOT_FOUND');
  return rows[0];
}

/** Whether people who manage a phone may make tokens for it (module setting + API on). */
export async function phoneTokensAllowed(ctx) {
  const [settings, config] = await Promise.all([moduleSettings(), apiConfig()]);
  return Boolean(config.enabled && (settings.phoneTokens !== false || ctx.isAdmin));
}

export async function listPhoneTokens(ctx, deviceId) {
  const device = await managedDevice(ctx, deviceId);
  const { rows } = await query(
    `SELECT k.id, k.name, k.prefix, k.user_id, k.created_by, k.limits, k.ip_allow, k.expires_at, k.revoked_at, k.last_used_at, k.last_ip,
            k.use_count, k.created_at, COALESCE(u.display_name, u.username) AS owner_name
     FROM api_tokens k JOIN users u ON u.id = k.user_id
     WHERE k.limits -> 'sms.devices' @> $1::jsonb
     ORDER BY k.revoked_at IS NOT NULL, k.created_at DESC`,
    [JSON.stringify([device.id])]
  );
  const simIds = [...new Set(rows.flatMap((row) => row.limits?.['sms.sims'] || []))];
  const { rows: sims } = simIds.length ? await query(`SELECT id, slot, label, phone_label, carrier, number FROM sms_sims WHERE id = ANY($1)`, [simIds]) : { rows: [] };
  const byId = new Map(sims.map((sim) => [sim.id, sim]));
  return rows.map((row) => {
    const sim = (row.limits?.['sms.sims'] || []).map((id) => byId.get(id)).filter(Boolean)[0] || null;
    const expired = row.expires_at && new Date(row.expires_at) < new Date();
    return {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      state: row.revoked_at ? 'revoked' : expired ? 'expired' : 'active',
      owner: { id: row.user_id, name: row.owner_name },
      mine: row.user_id === ctx.userId,
      sim: sim ? { id: sim.id, slot: sim.slot, name: simName(sim), number: sim.number } : null,
      phonesCount: (row.limits?.['sms.devices'] || []).length,
      ipAllow: row.ip_allow || [],
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      lastUsedAt: row.last_used_at,
      lastIp: row.last_ip,
      useCount: Number(row.use_count || 0),
      createdAt: row.created_at,
    };
  });
}

/**
 * A new token for this phone: `{ name?, simId?, expiresDays?, ipAllow?, rateLimit? }`.
 * Returns { token, secret, deviceId, simId } — the secret is shown once.
 */
export async function createPhoneToken(ctx, req, deviceId, input = {}) {
  if (req.apiToken) throw httpError(403, 'API tokens cannot make API tokens', 'ROUTE_NOT_AVAILABLE');
  if (!(await phoneTokensAllowed(ctx))) throw httpError(403, 'API tokens for phones are switched off', 'PHONE_TOKENS_OFF');
  const device = await managedDevice(ctx, deviceId);
  let sim = null;
  if (input.simId) {
    const { rows } = await query(`SELECT * FROM sms_sims WHERE id = $1 AND device_id = $2`, [Number(input.simId), device.id]);
    sim = rows[0];
    if (!sim) throw httpError(404, 'SIM not found', 'SIM_NOT_FOUND');
    if (!sim.active) throw httpError(409, 'This SIM card is no longer in the phone', 'SIM_INACTIVE');
  }
  const days = EXPIRY_DAYS.includes(Number(input.expiresDays)) ? Number(input.expiresDays) : 0;
  const name = String(input.name || '').trim().slice(0, 120) || `SMS · ${device.name}${sim ? ` · ${simName(sim)}` : ''}`;
  const policy = phoneTokenPolicy();
  const { token, secret } = await createToken(
    { id: ctx.userId, permissions: req.access?.permissions || [] },
    {
      name,
      description: sim ? `Phone «${device.name}», SIM «${simName(sim)}» — made on the phone page` : `Phone «${device.name}» — made on the phone page`,
      scopes: policy.scopes,
      rules: policy.rules,
      limits: { 'sms.devices': [device.id], ...(sim ? { 'sms.sims': [sim.id] } : {}) },
      ipAllow: input.ipAllow ?? [],
      rateLimit: input.rateLimit ?? null,
      expiresAt: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
    },
    { resourceToken: true }
  );
  return { token: { id: token.id, name: token.name, prefix: token.prefix, expiresAt: token.expiresAt }, secret, deviceId: device.id, simId: sim?.id || null };
}

/** Revokes a token of this phone: its owner, or a manager when the token reaches only this phone. */
export async function revokePhoneToken(ctx, req, deviceId, tokenId) {
  if (req.apiToken) throw httpError(403, 'API tokens cannot revoke API tokens', 'ROUTE_NOT_AVAILABLE');
  const device = await managedDevice(ctx, deviceId);
  const { rows } = await query(`SELECT id, user_id, limits FROM api_tokens WHERE id = $1 AND limits -> 'sms.devices' @> $2::jsonb`, [Number(tokenId), JSON.stringify([device.id])]);
  const row = rows[0];
  if (!row) throw httpError(404, 'Token not found', 'NOT_FOUND');
  const onlyThisPhone = (row.limits?.['sms.devices'] || []).length === 1;
  if (row.user_id !== ctx.userId && !ctx.isAdmin && !onlyThisPhone) throw httpError(403, 'This token reaches other phones too: ask its owner or an administrator', 'FORBIDDEN');
  await revokeResourceToken(row.id, ctx.userId);
}
