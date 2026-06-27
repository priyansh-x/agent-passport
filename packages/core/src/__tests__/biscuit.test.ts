import { describe, it, expect, beforeEach } from 'vitest';
import { BiscuitIssuer } from '../biscuit.js';
import type { PassportPayload } from '../types.js';

function makePayload(overrides: Partial<PassportPayload> = {}): PassportPayload {
  return {
    id: 'test-id',
    iss: 'agent-passport:local',
    sub: 'agent:bot',
    principal: 'user:alice',
    permissions: [{ action: 'read' }, { action: 'write' }],
    limits: { maxSpend: 100, currency: 'USD', spent: 0 },
    iat: Date.now(),
    exp: Date.now() + 3600000,
    parentId: null,
    nonce: 'test-nonce',
    ...overrides,
  };
}

describe('BiscuitIssuer', () => {
  let issuer: BiscuitIssuer;

  beforeEach(() => {
    issuer = new BiscuitIssuer();
  });

  it('issues a biscuit token', () => {
    const passport = issuer.issue(makePayload());
    expect(passport.token).toBeInstanceOf(Uint8Array);
    expect(passport.token.length).toBeGreaterThan(0);
    expect(passport.payload.sub).toBe('agent:bot');
  });

  it('verifies a valid token', () => {
    const passport = issuer.issue(makePayload());
    expect(issuer.verify(passport.token)).toBe(true);
  });

  it('rejects a tampered token', () => {
    const passport = issuer.issue(makePayload());
    const tampered = new Uint8Array(passport.token);
    tampered[tampered.length - 1]! ^= 0xff;
    expect(issuer.verify(tampered)).toBe(false);
  });

  it('rejects tokens from different issuer', () => {
    const other = new BiscuitIssuer();
    const passport = other.issue(makePayload());
    expect(issuer.verify(passport.token)).toBe(false);
  });

  it('authorizes permitted actions', () => {
    const passport = issuer.issue(makePayload());
    const result = issuer.authorize(passport.token, 'read');
    expect(result.allowed).toBe(true);
  });

  it('denies unpermitted actions', () => {
    const passport = issuer.issue(makePayload());
    const result = issuer.authorize(passport.token, 'delete');
    expect(result.allowed).toBe(false);
  });

  it('supports wildcard permissions', () => {
    const passport = issuer.issue(makePayload({
      permissions: [{ action: '*' }],
    }));
    expect(issuer.authorize(passport.token, 'anything').allowed).toBe(true);
  });

  it('supports prefix wildcard permissions', () => {
    const passport = issuer.issue(makePayload({
      permissions: [{ action: 'email:*' }],
    }));
    expect(issuer.authorize(passport.token, 'email:read').allowed).toBe(true);
    expect(issuer.authorize(passport.token, 'calendar:read').allowed).toBe(false);
  });

  describe('attenuation (delegation)', () => {
    it('creates an attenuated token with narrower permissions', () => {
      const parent = issuer.issue(makePayload());
      const child = issuer.attenuate(parent.token, makePayload({
        id: 'child-id',
        sub: 'agent:child',
        permissions: [{ action: 'read' }],
        parentId: 'test-id',
      }));

      expect(child.token.length).toBeGreaterThan(parent.token.length);
      expect(issuer.verify(child.token)).toBe(true);

      // Child can still read
      expect(issuer.authorize(child.token, 'read').allowed).toBe(true);
      // Child cannot write (attenuated away)
      expect(issuer.authorize(child.token, 'write').allowed).toBe(false);
    });

    it('prevents permission escalation via Datalog checks', () => {
      const parent = issuer.issue(makePayload({
        permissions: [{ action: 'read' }],
      }));

      // Even if child claims "write", the check will fail because
      // the authority block doesn't have permission("write")
      const child = issuer.attenuate(parent.token, makePayload({
        id: 'child-id',
        sub: 'agent:child',
        permissions: [{ action: 'write' }],
        parentId: 'test-id',
      }));

      expect(issuer.authorize(child.token, 'write').allowed).toBe(false);
    });
  });

  it('inspects token contents', () => {
    const passport = issuer.issue(makePayload());
    const inspection = issuer.inspect(passport.token);
    expect(inspection).toContain('permission');
    expect(inspection).toContain('read');
  });

  it('exposes public key', () => {
    expect(issuer.publicKey).toMatch(/^ed25519\//);
  });
});
