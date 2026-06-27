import { Hono } from 'hono';
import { PassportIssuer } from '@agent-passport/core';
import { PassportDB } from './db.js';

export function createApi(issuer: PassportIssuer, db: PassportDB) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok' }));

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

    const result = issuer.authorize(signed, body.action, body.spendAmount ?? 0);

    db.addAuditEntry({
      passportId: id,
      action: body.action,
      resource: undefined,
      allowed: result.allowed,
      reason: result.reason,
      timestamp: Date.now(),
    });

    return c.json(result);
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

      return c.json({ passport: child.payload, id: child.payload.id }, 201);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json({ error: msg }, 400);
    }
  });

  app.post('/v1/passports/:id/revoke', (c) => {
    const id = c.req.param('id');
    const revoked = issuer.revoke(id);
    for (const rid of revoked) {
      db.addRevocation(rid);
    }
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

  return app;
}
