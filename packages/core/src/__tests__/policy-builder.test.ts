import { describe, it, expect } from 'vitest';
import { PassportIssuer } from '../passport.js';
import { policy } from '../policy-builder.js';

describe('PolicyBuilder', () => {
  function makePayload(perms: string[], maxSpend = 0) {
    const issuer = new PassportIssuer();
    return issuer.issue({
      principal: 'user:alice',
      agent: 'agent:bot',
      permissions: perms,
      limits: { maxSpend },
    }).payload;
  }

  it('allows matching permissions', () => {
    const authorize = policy().requirePermission().build();
    const payload = makePayload(['read', 'write']);

    expect(authorize(payload, 'read').allowed).toBe(true);
    expect(authorize(payload, 'delete').allowed).toBe(false);
  });

  it('supports wildcard permissions', () => {
    const authorize = policy().requirePermission().build();
    const payload = makePayload(['files:*']);

    expect(authorize(payload, 'files:read').allowed).toBe(true);
    expect(authorize(payload, 'files:write').allowed).toBe(true);
    expect(authorize(payload, 'email:send').allowed).toBe(false);
  });

  it('checks budget', () => {
    const authorize = policy().requirePermission().requireBudget().build();
    const payload = makePayload(['purchase'], 100);

    expect(authorize(payload, 'purchase', { spendAmount: 50 }).allowed).toBe(true);
    expect(authorize(payload, 'purchase', { spendAmount: 150 }).allowed).toBe(false);
  });

  it('checks expiry', () => {
    const authorize = policy().requireNotExpired().build();
    const issuer = new PassportIssuer();
    const expired = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:bot',
      permissions: ['read'],
      expiresIn: -1000,
    }).payload;

    expect(authorize(expired, 'read').allowed).toBe(false);
  });

  it('denies specific actions', () => {
    const authorize = policy().requirePermission().denyActions('delete', 'admin').build();
    const payload = makePayload(['read', 'delete']);

    expect(authorize(payload, 'read').allowed).toBe(true);
    expect(authorize(payload, 'delete').allowed).toBe(false);
  });

  it('enforces time windows', () => {
    const authorize = policy().timeWindow(9, 17).build();
    const payload = makePayload(['read']);

    const businessHours = new Date();
    businessHours.setUTCHours(12);
    expect(authorize(payload, 'read', { timestamp: businessHours.getTime() }).allowed).toBe(true);

    const lateNight = new Date();
    lateNight.setUTCHours(3);
    expect(authorize(payload, 'read', { timestamp: lateNight.getTime() }).allowed).toBe(false);
  });

  it('chains multiple checks', () => {
    const authorize = policy()
      .requirePermission()
      .requireNotExpired()
      .requireBudget()
      .denyActions('admin')
      .build();

    const payload = makePayload(['read', 'write'], 500);
    expect(authorize(payload, 'read').allowed).toBe(true);
    expect(authorize(payload, 'admin').allowed).toBe(false);
  });

  it('supports custom checks', () => {
    const authorize = policy()
      .addCheck((_payload, _action, ctx) => {
        if (ctx.metadata?.['region'] !== 'us-east') {
          return { allowed: false, reason: 'Wrong region' };
        }
        return { allowed: true };
      })
      .build();

    const payload = makePayload(['read']);
    expect(authorize(payload, 'read', { metadata: { region: 'us-east' } }).allowed).toBe(true);
    expect(authorize(payload, 'read', { metadata: { region: 'eu-west' } }).allowed).toBe(false);
  });
});
