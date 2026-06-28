import { describe, it, expect } from 'vitest';
import { PassportIssuer } from '../passport.js';

describe('PassportIssuer', () => {
  function createIssuer() {
    return new PassportIssuer();
  }

  describe('issue', () => {
    it('creates a signed passport with correct fields', () => {
      const issuer = createIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:booking-bot',
        permissions: ['calendar:read', 'calendar:write', 'email:send'],
        limits: { maxSpend: 500 },
      });

      expect(passport.payload.principal).toBe('user:alice@test.com');
      expect(passport.payload.sub).toBe('agent:booking-bot');
      expect(passport.payload.permissions).toHaveLength(3);
      expect(passport.payload.limits.maxSpend).toBe(500);
      expect(passport.payload.parentId).toBeNull();
      expect(passport.signature).toBeTruthy();
    });

    it('verifies its own signatures', () => {
      const issuer = createIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:bot',
        permissions: ['read'],
      });

      expect(issuer.verifySignature(passport)).toBe(true);
    });

    it('detects tampered passports', () => {
      const issuer = createIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:bot',
        permissions: ['read'],
      });

      passport.payload.permissions.push({ action: 'admin:*' });
      expect(issuer.verifySignature(passport)).toBe(false);
    });
  });

  describe('authorize', () => {
    it('allows permitted actions', () => {
      const issuer = createIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:bot',
        permissions: ['calendar:read', 'email:send'],
      });

      const result = issuer.authorize(passport, 'calendar:read');
      expect(result.allowed).toBe(true);
    });

    it('denies unpermitted actions', () => {
      const issuer = createIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:bot',
        permissions: ['calendar:read'],
      });

      const result = issuer.authorize(passport, 'email:send');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not permitted');
    });

    it('supports wildcard permissions', () => {
      const issuer = createIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:bot',
        permissions: ['calendar:*'],
      });

      expect(issuer.authorize(passport, 'calendar:read').allowed).toBe(true);
      expect(issuer.authorize(passport, 'calendar:write').allowed).toBe(true);
      expect(issuer.authorize(passport, 'email:send').allowed).toBe(false);
    });

    it('enforces spend limits', () => {
      const issuer = createIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:bot',
        permissions: ['payment:charge'],
        limits: { maxSpend: 100 },
      });

      expect(issuer.authorize(passport, 'payment:charge', 50).allowed).toBe(true);
      expect(issuer.authorize(passport, 'payment:charge', 60).allowed).toBe(false);
      expect(issuer.authorize(passport, 'payment:charge', 50).allowed).toBe(true);
      expect(issuer.authorize(passport, 'payment:charge', 1).allowed).toBe(false);
    });

    it('denies expired passports', () => {
      const issuer = createIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:bot',
        permissions: ['read'],
        expiresIn: -1000,
      });

      const result = issuer.authorize(passport, 'read');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('expired');
    });

    it('denies revoked passports', () => {
      const issuer = createIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:bot',
        permissions: ['read'],
      });

      issuer.revoke(passport.payload.id);
      const result = issuer.authorize(passport, 'read');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('revoked');
    });

    it('records audit entries', () => {
      const issuer = createIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:bot',
        permissions: ['read'],
      });

      issuer.authorize(passport, 'read');
      issuer.authorize(passport, 'write');

      const entries = issuer.audit.getByPassport(passport.payload.id);
      expect(entries).toHaveLength(2);
      expect(entries[0]!.allowed).toBe(true);
      expect(entries[1]!.allowed).toBe(false);
    });
  });

  describe('delegate', () => {
    it('creates child passport with narrowed permissions', () => {
      const issuer = createIssuer();
      const parent = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:root',
        permissions: ['calendar:read', 'email:send'],
        limits: { maxSpend: 500 },
      });

      const child = issuer.delegate(parent, {
        agent: 'agent:email-helper',
        permissions: ['email:send'],
        limits: { maxSpend: 100 },
      });

      expect(child.payload.parentId).toBe(parent.payload.id);
      expect(child.payload.permissions).toHaveLength(1);
      expect(child.payload.limits.maxSpend).toBe(100);
      expect(child.payload.principal).toBe('user:alice@test.com');
    });

    it('rejects permission escalation', () => {
      const issuer = createIssuer();
      const parent = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:root',
        permissions: ['calendar:read'],
      });

      expect(() =>
        issuer.delegate(parent, {
          agent: 'agent:evil',
          permissions: ['admin:delete'],
        }),
      ).toThrow('subset');
    });

    it('rejects spend limit escalation', () => {
      const issuer = createIssuer();
      const parent = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:root',
        permissions: ['pay'],
        limits: { maxSpend: 100 },
      });

      expect(() =>
        issuer.delegate(parent, {
          agent: 'agent:child',
          permissions: ['pay'],
          limits: { maxSpend: 200 },
        }),
      ).toThrow('exceeds');
    });

    it('child expiry cannot exceed parent expiry', () => {
      const issuer = createIssuer();
      const parent = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:root',
        permissions: ['read'],
        expiresIn: 60_000,
      });

      const child = issuer.delegate(parent, {
        agent: 'agent:child',
        permissions: ['read'],
        expiresIn: 999_999_999,
      });

      expect(child.payload.exp).toBeLessThanOrEqual(parent.payload.exp);
    });
  });

  describe('revocation cascade', () => {
    it('revoking parent revokes all descendants', () => {
      const issuer = createIssuer();
      const root = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:root',
        permissions: ['a', 'b', 'c'],
        limits: { maxSpend: 1000 },
      });

      const childA = issuer.delegate(root, {
        agent: 'agent:a',
        permissions: ['a'],
        limits: { maxSpend: 300 },
      });

      const childB = issuer.delegate(root, {
        agent: 'agent:b',
        permissions: ['b'],
        limits: { maxSpend: 300 },
      });

      const grandchild = issuer.delegate(childA, {
        agent: 'agent:aa',
        permissions: ['a'],
        limits: { maxSpend: 100 },
      });

      const revoked = issuer.revoke(root.payload.id);
      expect(revoked).toHaveLength(4);

      expect(issuer.authorize(root, 'a').allowed).toBe(false);
      expect(issuer.authorize(childA, 'a').allowed).toBe(false);
      expect(issuer.authorize(childB, 'b').allowed).toBe(false);
      expect(issuer.authorize(grandchild, 'a').allowed).toBe(false);
    });

    it('rejects delegation beyond max depth', () => {
      const issuer = createIssuer();
      let current = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:level-0',
        permissions: ['read'],
      });

      for (let i = 1; i <= 10; i++) {
        current = issuer.delegate(current, {
          agent: `agent:level-${i}`,
          permissions: ['read'],
        });
      }

      expect(() =>
        issuer.delegate(current, {
          agent: 'agent:too-deep',
          permissions: ['read'],
        }),
      ).toThrow('maximum chain depth');
    });

    it('rejects too many permissions on issue', () => {
      const issuer = createIssuer();
      const perms = Array.from({ length: 51 }, (_, i) => `perm:${i}`);
      expect(() =>
        issuer.issue({
          principal: 'user:alice@test.com',
          agent: 'agent:bot',
          permissions: perms,
        }),
      ).toThrow('Too many permissions');
    });

    it('rejects too many permissions on delegate', () => {
      const issuer = createIssuer();
      const perms = Array.from({ length: 50 }, (_, i) => `perm:${i}`);
      const parent = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:root',
        permissions: perms,
      });

      const childPerms = Array.from({ length: 51 }, (_, i) => `perm:${i}`);
      expect(() =>
        issuer.delegate(parent, {
          agent: 'agent:child',
          permissions: childPerms,
        }),
      ).toThrow('Too many permissions');
    });

    it('revoking child does not affect parent', () => {
      const issuer = createIssuer();
      const parent = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:root',
        permissions: ['read'],
      });

      const child = issuer.delegate(parent, {
        agent: 'agent:child',
        permissions: ['read'],
      });

      issuer.revoke(child.payload.id);
      expect(issuer.authorize(parent, 'read').allowed).toBe(true);
      expect(issuer.authorize(child, 'read').allowed).toBe(false);
    });
  });
});
