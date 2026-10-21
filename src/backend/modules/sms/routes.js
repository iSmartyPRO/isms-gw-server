import { Router } from 'express';
import { contextFromRequest, wrap } from '../shared/acl.js';
import { smsSegments, parseRecipients } from './phone.js';
import { onlineIds } from './hub.js';
import * as sms from './service.js';
import { createPhoneToken, listPhoneTokens, maxTokenDays, phoneTokensAllowed, revokePhoneToken } from './apiTokens.js';
import { listSubjects } from '../kb/service.js';

const ctxOf = (req) => contextFromRequest(req, 'sms.admin');
const sourceOf = (req) => (req.apiToken ? 'api' : 'web');

const CSV_COLUMNS = ['id', 'uuid', 'createdAt', 'direction', 'status', 'deviceName', 'simLabel', 'slot', 'phone', 'text', 'parts', 'encoding', 'ref', 'errorCode', 'error', 'sentAt', 'deliveredAt'];
const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  // Formulas would run in a spreadsheet: a leading =, +, -, @ is neutralised.
  // Only a plain number or phone number (+996555123456, -5) keeps its sign: "+1+cmd|…" is a formula.
  const safe = /^[=+\-@\t\r]/.test(text) && !/^[+-]?\d+(\.\d+)?$/.test(text) ? `'${text}` : text;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** /api/app/sms — the gateway for signed-in people (and API tokens through /api/v1). */
export function privateRoutes() {
  const router = Router();

  // ── Overview ──
  router.get('/overview', wrap(async (req, res) => {
    res.json({ success: true, ...(await sms.overview(ctxOf(req), { days: req.query.days, deviceId: req.query.deviceId })) });
  }));
  router.get('/config', wrap(async (req, res) => {
    const settings = await sms.moduleSettings();
    const ctx = ctxOf(req);
    res.json({
      success: true,
      config: {
        defaultCountry: settings.defaultCountry,
        maxRecipients: settings.maxRecipients,
        maxTextLength: settings.maxTextLength,
        canAddDevices: Boolean(settings.userDevices || ctx.isAdmin),
        canCreateTokens: !req.apiToken && (await phoneTokensAllowed(ctx)),
        maxTokenDays: await maxTokenDays(),
        isAdmin: ctx.isAdmin,
        devicePath: '/ws/device',
        online: ctx.isAdmin ? onlineIds().length : undefined,
      },
    });
  }));
  router.post('/tools/segments', wrap(async (req, res) => {
    res.json({ success: true, segments: smsSegments(req.body?.text) });
  }));
  router.post('/tools/numbers', wrap(async (req, res) => {
    const settings = await sms.moduleSettings();
    res.json({ success: true, ...parseRecipients(req.body?.to, req.body?.country ?? settings.defaultCountry, settings.maxRecipients) });
  }));

  // ── Phones ──
  router.get('/devices', wrap(async (req, res) => {
    res.json({ success: true, devices: await sms.listDevices(ctxOf(req)) });
  }));
  router.post('/devices', wrap(async (req, res) => {
    res.status(201).json({ success: true, ...(await sms.createDevice(ctxOf(req), req.body || {})) });
  }));
  router.get('/devices/:id', wrap(async (req, res) => {
    res.json({ success: true, device: await sms.getDevice(ctxOf(req), req.params.id) });
  }));
  router.put('/devices/:id', wrap(async (req, res) => {
    res.json({ success: true, device: await sms.updateDevice(ctxOf(req), req.params.id, req.body || {}) });
  }));
  router.delete('/devices/:id', wrap(async (req, res) => {
    await sms.deleteDevice(ctxOf(req), req.params.id);
    res.json({ success: true });
  }));
  router.post('/devices/:id/token', wrap(async (req, res) => {
    res.json({ success: true, ...(await sms.rotateToken(ctxOf(req), req.params.id)) });
  }));
  router.post('/devices/:id/refresh', wrap(async (req, res) => {
    res.json({ success: true, ...(await sms.refreshDevice(ctxOf(req), req.params.id)) });
  }));
  router.get('/devices/:id/events', wrap(async (req, res) => {
    res.json({ success: true, events: await sms.deviceEvents(ctxOf(req), req.params.id, req.query.limit) });
  }));
  router.get('/devices/:id/access', wrap(async (req, res) => {
    res.json({ success: true, ...(await sms.getDeviceAccess(ctxOf(req), req.params.id)) });
  }));
  router.put('/devices/:id/access', wrap(async (req, res) => {
    res.json({ success: true, ...(await sms.setDeviceAccess(ctxOf(req), req.params.id, req.body || {})) });
  }));

  // API tokens limited to this phone (and a SIM), made by its managers.
  router.get('/devices/:id/tokens', wrap(async (req, res) => {
    res.json({ success: true, tokens: await listPhoneTokens(ctxOf(req), req, req.params.id) });
  }));
  router.post('/devices/:id/tokens', wrap(async (req, res) => {
    res.status(201).json({ success: true, ...(await createPhoneToken(ctxOf(req), req, req.params.id, req.body || {})) });
  }));
  router.post('/devices/:id/tokens/:tokenId/revoke', wrap(async (req, res) => {
    await revokePhoneToken(ctxOf(req), req, req.params.id, req.params.tokenId);
    res.json({ success: true });
  }));

  // People, groups and roles to share a phone with.
  router.get('/subjects', wrap(async (req, res) => {
    res.json({ success: true, ...(await listSubjects()) });
  }));

  // ── SIM cards ──
  router.put('/sims/:id', wrap(async (req, res) => {
    res.json({ success: true, sim: await sms.updateSim(ctxOf(req), req.params.id, req.body || {}) });
  }));
  router.delete('/sims/:id', wrap(async (req, res) => {
    await sms.deleteSim(ctxOf(req), req.params.id);
    res.json({ success: true });
  }));

  // ── Messages ──
  router.get('/messages', wrap(async (req, res) => {
    res.json({ success: true, ...(await sms.listMessages(ctxOf(req), req.query)) });
  }));
  router.get('/messages/count', wrap(async (req, res) => {
    res.json({ success: true, count: await sms.countMessages(ctxOf(req), req.query) });
  }));
  router.get('/messages/export', wrap(async (req, res) => {
    const ctx = ctxOf(req);
    const lines = [CSV_COLUMNS.join(',')];
    let before = null;
    let total = 0;
    do {
      const page = await sms.listMessages(ctx, { ...req.query, before, sinceId: undefined, limit: 200 });
      for (const message of page.messages) lines.push(CSV_COLUMNS.map((key) => csvCell(message[key])).join(','));
      total += page.messages.length;
      before = page.next;
    } while (before && total < 50_000);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sms-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`﻿${lines.join('\r\n')}\r\n`);
  }));
  router.post('/messages', wrap(async (req, res) => {
    res.status(201).json({ success: true, ...(await sms.sendMessages(ctxOf(req), req.body || {}, sourceOf(req))) });
  }));
  router.post('/messages/read', wrap(async (req, res) => {
    res.json({ success: true, updated: await sms.markRead(ctxOf(req), req.body || {}) });
  }));
  router.get('/messages/:id', wrap(async (req, res) => {
    res.json({ success: true, message: await sms.getMessage(ctxOf(req), req.params.id) });
  }));
  router.post('/messages/:id/cancel', wrap(async (req, res) => {
    res.json({ success: true, message: await sms.cancelMessage(ctxOf(req), req.params.id) });
  }));
  router.post('/messages/:id/retry', wrap(async (req, res) => {
    res.json({ success: true, message: await sms.retryMessage(ctxOf(req), req.params.id) });
  }));

  // ── Conversations ──
  router.get('/threads', wrap(async (req, res) => {
    res.json({ success: true, threads: await sms.listThreads(ctxOf(req), req.query) });
  }));
  router.get('/threads/:deviceId/:phone', wrap(async (req, res) => {
    res.json({ success: true, ...(await sms.getThread(ctxOf(req), { deviceId: req.params.deviceId, phone: req.params.phone, before: req.query.before, limit: req.query.limit })) });
  }));

  // ── Templates ──
  router.get('/templates', wrap(async (req, res) => {
    res.json({ success: true, templates: await sms.listTemplates(ctxOf(req)) });
  }));
  router.post('/templates', wrap(async (req, res) => {
    res.status(201).json({ success: true, template: await sms.createTemplate(ctxOf(req), req.body || {}) });
  }));
  router.put('/templates/:id', wrap(async (req, res) => {
    res.json({ success: true, template: await sms.updateTemplate(ctxOf(req), req.params.id, req.body || {}) });
  }));
  router.delete('/templates/:id', wrap(async (req, res) => {
    await sms.deleteTemplate(ctxOf(req), req.params.id);
    res.json({ success: true });
  }));

  return router;
}
