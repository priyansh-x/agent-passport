import { describe, it, expect } from 'vitest';
import { AgentPassport } from '../agent-passport.js';
import { PassportIssuer } from '@passport-agent/core';

describe('AgentPassport SDK', () => {
  function createWithIssuer() {
    const issuer = new PassportIssuer();
    const passport = AgentPassport.issue(
      {
        principal: 'user:alice@test.com',
        agent: 'agent:booking-bot',
        permissions: ['calendar:read', 'calendar:write', 'email:send'],
        limits: { maxSpend: 500 },
        expiresIn: 3600_000,
      },
      issuer,
    );
    return { passport, issuer };
  }

  describe('issue', () => {
    it('creates a passport with correct properties', () => {
      const { passport } = createWithIssuer();
      expect(passport.principal).toBe('user:alice@test.com');
      expect(passport.agent).toBe('agent:booking-bot');
      expect(passport.permissions).toEqual(['calendar:read', 'calendar:write', 'email:send']);
      expect(passport.parentId).toBeNull();
      expect(passport.id).toBeTruthy();
    });

    it('serializes to JSON', () => {
      const { passport } = createWithIssuer();
      const json = passport.toJSON();
      expect(json.principal).toBe('user:alice@test.com');
      expect(json.agent).toBe('agent:booking-bot');
      expect(json.expiresAt).toBeTruthy();
    });
  });

  describe('authorize', () => {
    it('allows permitted actions', () => {
      const { passport } = createWithIssuer();
      const result = passport.authorize('calendar:read');
      expect(result.allowed).toBe(true);
    });

    it('throws PassportDeniedError for unpermitted actions', () => {
      const { passport } = createWithIssuer();
      expect(() => passport.authorize('admin:delete')).toThrow('denied');
    });

    it('tryAuthorize returns result without throwing', () => {
      const { passport } = createWithIssuer();
      const result = passport.tryAuthorize('admin:delete');
      expect(result.allowed).toBe(false);
    });

    it('tracks spend across calls', () => {
      const { passport } = createWithIssuer();
      passport.authorize('calendar:write', 200);
      passport.authorize('calendar:write', 200);
      expect(() => passport.authorize('calendar:write', 200)).toThrow('exceeds');
    });
  });

  describe('delegate', () => {
    it('creates narrowed child passport', () => {
      const { passport } = createWithIssuer();
      const child = passport.delegate({
        agent: 'agent:email-helper',
        permissions: ['email:send'],
        limits: { maxSpend: 50 },
      });

      expect(child.agent).toBe('agent:email-helper');
      expect(child.permissions).toEqual(['email:send']);
      expect(child.parentId).toBe(passport.id);
      expect(child.principal).toBe('user:alice@test.com');
    });

    it('throws PassportDelegationError on escalation', () => {
      const { passport } = createWithIssuer();
      expect(() =>
        passport.delegate({
          agent: 'agent:evil',
          permissions: ['admin:nuke'],
        }),
      ).toThrow('subset');
    });

    it('child can authorize within its scope', () => {
      const { passport } = createWithIssuer();
      const child = passport.delegate({
        agent: 'agent:email-helper',
        permissions: ['email:send'],
      });

      expect(child.tryAuthorize('email:send').allowed).toBe(true);
      expect(child.tryAuthorize('calendar:read').allowed).toBe(false);
    });
  });

  describe('revoke', () => {
    it('revokes passport and all children', () => {
      const { passport } = createWithIssuer();
      const child = passport.delegate({
        agent: 'agent:helper',
        permissions: ['email:send'],
      });

      const revoked = passport.revoke();
      expect(revoked).toHaveLength(2);
      expect(child.tryAuthorize('email:send').allowed).toBe(false);
    });
  });

  describe('audit', () => {
    it('records all authorize calls', () => {
      const { passport } = createWithIssuer();
      passport.authorize('calendar:read');
      passport.tryAuthorize('admin:delete');

      const log = passport.auditLog;
      expect(log).toHaveLength(2);
      expect(log[0]!.allowed).toBe(true);
      expect(log[1]!.allowed).toBe(false);
    });
  });
});
