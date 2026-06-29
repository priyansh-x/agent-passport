import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { PassportIssuer, serializePassport, validatePassport } from '@passport-agent/core';
import { PassportDB } from './db.js';
import { rateLimiter } from './rate-limit.js';
import { WebhookManager } from './webhooks.js';
import { requestLogger, type LoggerOptions } from './logger.js';
import { getOpenApiSpec } from './openapi.js';
import { checkHealth } from './health.js';
import { getPrometheusMetrics } from './metrics.js';
import { exportAll } from './export.js';

export interface ApiOptions {
  cors?: boolean;
  webhooks?: WebhookManager;
  logger?: LoggerOptions | boolean;
}

export function createApi(issuer: PassportIssuer, db: PassportDB, options: ApiOptions = {}) {
  const webhooks = options.webhooks ?? new WebhookManager();
  const app = new Hono();

  if (options.cors) {
    app.use('*', cors());
  }

  if (options.logger) {
    const logOpts = typeof options.logger === 'object' ? options.logger : {};
    app.use('*', requestLogger(logOpts));
  }

  app.use('/v1/*', rateLimiter({ windowMs: 60_000, maxRequests: 100 }));

  app.get('/health', (c) => c.json(checkHealth(db)));

  app.get('/openapi.json', (c) => c.json(getOpenApiSpec()));

  app.get('/metrics', (c) => {
    c.header('Content-Type', 'text/plain; version=0.0.4');
    return c.text(getPrometheusMetrics(db));
  });

  app.get('/v1/passports', (c) => {
    const rows = db.listPassports();
    const passports = rows.map((r) => JSON.parse(r.payload));
    return c.json({ passports });
  });

  app.get('/v1/passports/search', (c) => {
    const agent = c.req.query('agent');
    const principal = c.req.query('principal');
    const status = c.req.query('status') as 'active' | 'revoked' | undefined;
    const limit = parseInt(c.req.query('limit') ?? '50');

    const rows = db.searchPassports({ agent, principal, status, limit });
    const passports = rows.map((r) => ({ id: r.id, ...JSON.parse(r.payload) }));
    return c.json({ passports, count: passports.length });
  });

  app.post('/v1/passports', async (c) => {
    const body = await c.req.json<{
      principal: string;
      agent: string;
      permissions: string[];
      limits?: { maxSpend: number; currency?: string };
      expiresIn?: number;
    }>();

    const passport = issuer.issue({
      principal: body.principal,
      agent: body.agent,
      permissions: body.permissions,
      limits: body.limits,
      expiresIn: body.expiresIn,
    });

    db.savePassport(
      passport.payload.id,
      JSON.stringify(passport.payload),
      passport.signature,
      passport.publicKey,
    );

    webhooks.emit('passport.issued', { id: passport.payload.id, principal: body.principal, agent: body.agent });

    return c.json({ passport: passport.payload, id: passport.payload.id }, 201);
  });

  app.get('/v1/passports/:id', (c) => {
    const row = db.getPassport(c.req.param('id'));
    if (!row) return c.json({ error: 'Passport not found' }, 404);

    const revoked = db.isRevoked(row.id);
    return c.json({
      passport: JSON.parse(row.payload),
      revoked,
    });
  });

  // Token introspection endpoint (RFC 7662-style)
  app.post('/v1/passports/:id/introspect', (c) => {
    const id = c.req.param('id');
    const row = db.getPassport(id);
    if (!row) {
      return c.json({ active: false }, 200);
    }

    const payload = JSON.parse(row.payload);
    const revoked = db.isRevoked(id);
    const expired = Date.now() > payload.exp;
    const active = !revoked && !expired;
    const spent = db.getSpent(id);

    return c.json({
      active,
      id: payload.id,
      sub: payload.sub,
      principal: payload.principal,
      iss: payload.iss,
      iat: payload.iat,
      exp: payload.exp,
      permissions: payload.permissions,
      limits: {
        maxSpend: payload.limits.maxSpend,
        currency: payload.limits.currency,
        spent,
        remaining: Math.max(0, payload.limits.maxSpend - spent),
      },
      revoked,
      expired,
      parentId: payload.parentId,
      publicKey: row.public_key,
    });
  });

  app.post('/v1/passports/:id/verify', (c) => {
    const id = c.req.param('id');
    const row = db.getPassport(id);
    if (!row) return c.json({ error: 'Passport not found' }, 404);

    const revoked = db.isRevoked(id);
    const payload = JSON.parse(row.payload);
    const expired = Date.now() > payload.exp;

    return c.json({
      valid: !revoked && !expired,
      revoked,
      expired,
    });
  });

  app.post('/v1/passports/:id/authorize', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<{ action: string; spendAmount?: number }>();

    const signed = issuer.getPassport(id);
    if (!signed) return c.json({ error: 'Passport not found' }, 404);

    const currentSpent = db.getSpent(id);
    const spendAmount = body.spendAmount ?? 0;

    const result = issuer.authorize(signed, body.action, spendAmount);

    // Use DB-backed spend tracking instead of in-memory
    if (result.allowed && spendAmount > 0) {
      db.addSpend(id, spendAmount, signed.payload.limits.currency);
    }

    db.addAuditEntry({
      passportId: id,
      action: body.action,
      resource: undefined,
      allowed: result.allowed,
      reason: result.reason,
      timestamp: Date.now(),
    });

    webhooks.emit(result.allowed ? 'passport.authorized' : 'passport.denied', {
      id, action: body.action, allowed: result.allowed, reason: result.reason,
    });

    return c.json({
      ...result,
      spent: currentSpent + (result.allowed ? spendAmount : 0),
      remaining: Math.max(0, signed.payload.limits.maxSpend - currentSpent - (result.allowed ? spendAmount : 0)),
    });
  });

  app.post('/v1/passports/:id/delegate', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<{
      agent: string;
      permissions: string[];
      limits?: { maxSpend: number; currency?: string };
      expiresIn?: number;
    }>();

    const parent = issuer.getPassport(id);
    if (!parent) return c.json({ error: 'Parent passport not found' }, 404);

    try {
      const child = issuer.delegate(parent, {
        agent: body.agent,
        permissions: body.permissions,
        limits: body.limits,
        expiresIn: body.expiresIn,
      });

      db.savePassport(
        child.payload.id,
        JSON.stringify(child.payload),
        child.signature,
        child.publicKey,
      );

      // Persist delegation relationship for cascade revocation
      db.registerChild(id, child.payload.id);

      webhooks.emit('passport.delegated', { parentId: id, childId: child.payload.id, agent: body.agent });

      return c.json({ passport: child.payload, id: child.payload.id }, 201);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json({ error: msg }, 400);
    }
  });

  app.post('/v1/passports/:id/revoke', (c) => {
    const id = c.req.param('id');
    // Use DB-backed cascade revocation (survives restarts)
    const revoked = db.cascadeRevoke(id);
    // Also update in-memory state
    issuer.revoke(id);
    webhooks.emit('passport.revoked', { id, cascadeCount: revoked.length, revoked });
    return c.json({ revoked });
  });

  app.get('/v1/passports/:id/audit', (c) => {
    const entries = db.getAuditLog(c.req.param('id'));
    return c.json({ entries });
  });

  app.get('/v1/audit', (c) => {
    const limit = parseInt(c.req.query('limit') ?? '50');
    const entries = db.getRecentAudit(limit);
    return c.json({ entries });
  });

  app.post('/v1/passports/:id/authorize-bulk', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<{ actions: string[] }>();

    const signed = issuer.getPassport(id);
    if (!signed) return c.json({ error: 'Passport not found' }, 404);

    const results = body.actions.map((action) => {
      const result = issuer.authorize(signed, action, 0);
      return { action, allowed: result.allowed, reason: result.reason };
    });

    const allAllowed = results.every((r) => r.allowed);
    return c.json({ allAllowed, results });
  });

  app.get('/v1/stats', (c) => {
    return c.json(db.getStats());
  });

  app.get('/v1/export', (c) => {
    return c.json(exportAll(db));
  });

  app.get('/v1/passports/:id/tree', (c) => {
    const id = c.req.param('id');
    const row = db.getPassport(id);
    if (!row) return c.json({ error: 'Passport not found' }, 404);

    function buildNode(nodeId: string): Record<string, unknown> | null {
      const r = db.getPassport(nodeId);
      if (!r) return null;
      const payload = JSON.parse(r.payload);
      const children = db.getChildren(nodeId);
      return {
        id: nodeId,
        agent: payload.sub,
        permissions: payload.permissions.map((p: { action: string }) => p.action),
        maxSpend: payload.limits.maxSpend,
        revoked: db.isRevoked(nodeId),
        children: children.map(buildNode).filter(Boolean),
      };
    }

    return c.json(buildNode(id));
  });

  app.get('/v1/passports/:id/validate', (c) => {
    const row = db.getPassport(c.req.param('id'));
    if (!row) return c.json({ error: 'Passport not found' }, 404);

    const signed = {
      payload: JSON.parse(row.payload),
      signature: row.signature,
      publicKey: row.public_key,
    };
    const result = validatePassport(signed, {
      isRevoked: (id) => db.isRevoked(id),
    });
    return c.json(result);
  });

  app.get('/v1/passports/:id/token', (c) => {
    const row = db.getPassport(c.req.param('id'));
    if (!row) return c.json({ error: 'Passport not found' }, 404);

    const signed = {
      payload: JSON.parse(row.payload),
      signature: row.signature,
      publicKey: row.public_key,
    };
    return c.json({ token: serializePassport(signed) });
  });

  // Webhook management
  app.get('/v1/webhooks', (c) => {
    return c.json({ webhooks: webhooks.list() });
  });

  app.post('/v1/webhooks', async (c) => {
    const body = await c.req.json<{
      url: string;
      events: string[];
      secret?: string;
    }>();

    if (!body.url || !body.events?.length) {
      return c.json({ error: 'url and events are required' }, 400);
    }

    const sub = webhooks.subscribe(body.url, body.events as import('./webhooks.js').WebhookEvent[], body.secret);
    return c.json({ webhook: sub }, 201);
  });

  app.delete('/v1/webhooks/:id', (c) => {
    const removed = webhooks.unsubscribe(c.req.param('id'));
    if (!removed) return c.json({ error: 'Webhook not found' }, 404);
    return c.json({ ok: true });
  });

  return app;
}
