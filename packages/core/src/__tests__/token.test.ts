import { describe, it, expect } from 'vitest';
import { PassportIssuer } from '../passport.js';
import { serializePassport, deserializePassport } from '../token.js';

describe('Token serialization', () => {
  it('round-trips a passport through serialize/deserialize', () => {
    const issuer = new PassportIssuer();
    const passport = issuer.issue({
      principal: 'user:alice@test.com',
      agent: 'agent:bot',
      permissions: ['read', 'write'],
      limits: { maxSpend: 100 },
    });

    const token = serializePassport(passport);
    expect(token).toMatch(/^ap1\./);

    const restored = deserializePassport(token);
    expect(restored.payload.id).toBe(passport.payload.id);
    expect(restored.payload.principal).toBe('user:alice@test.com');
    expect(restored.signature).toBe(passport.signature);
    expect(restored.publicKey).toBe(passport.publicKey);
  });

  it('preserves signature validity', () => {
    const issuer = new PassportIssuer();
    const passport = issuer.issue({
      principal: 'user:alice@test.com',
      agent: 'agent:bot',
      permissions: ['read'],
    });

    const token = serializePassport(passport);
    const restored = deserializePassport(token);
    expect(issuer.verifySignature(restored)).toBe(true);
  });

  it('rejects invalid token format', () => {
    expect(() => deserializePassport('invalid')).toThrow('Invalid passport token format');
    expect(() => deserializePassport('ap2.a.b.c')).toThrow('Invalid passport token format');
  });

  it('produces compact tokens', () => {
    const issuer = new PassportIssuer();
    const passport = issuer.issue({
      principal: 'user:alice@test.com',
      agent: 'agent:bot',
      permissions: ['read'],
    });

    const token = serializePassport(passport);
    const jsonSize = JSON.stringify(passport).length;
    // Base64url should be reasonably compact compared to hex-encoded JSON
    expect(token.length).toBeLessThan(jsonSize * 1.5);
  });
});
