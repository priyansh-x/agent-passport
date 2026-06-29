import { describe, it, expect } from 'vitest';
import { PassportIssuer } from '../passport.js';
import { validatePassport } from '../validator.js';

describe('validatePassport', () => {
  it('validates a correctly issued passport', () => {
    const issuer = new PassportIssuer();
    const passport = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:bot',
      permissions: ['read'],
    });

    const result = validatePassport(passport);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects expired passports', () => {
    const issuer = new PassportIssuer();
    const passport = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:bot',
      permissions: ['read'],
      expiresIn: -1000,
    });

    const result = validatePassport(passport);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('expired'))).toBe(true);
  });

  it('skips expiry check when disabled', () => {
    const issuer = new PassportIssuer();
    const passport = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:bot',
      permissions: ['read'],
      expiresIn: -1000,
    });

    const result = validatePassport(passport, { checkExpiry: false });
    expect(result.valid).toBe(true);
  });

  it('detects tampered signatures', () => {
    const issuer = new PassportIssuer();
    const passport = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:bot',
      permissions: ['read'],
    });

    passport.payload.permissions.push({ action: 'admin' });
    const result = validatePassport(passport);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('signature'))).toBe(true);
  });

  it('detects revoked passports', () => {
    const issuer = new PassportIssuer();
    const passport = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:bot',
      permissions: ['read'],
    });

    const result = validatePassport(passport, { isRevoked: () => true });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('revoked'))).toBe(true);
  });

  it('warns about soon-to-expire passports', () => {
    const issuer = new PassportIssuer();
    const passport = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:bot',
      permissions: ['read'],
      expiresIn: 60_000,
    });

    const result = validatePassport(passport);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('expires in'))).toBe(true);
  });

  it('warns about long-lived passports', () => {
    const issuer = new PassportIssuer();
    const passport = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:bot',
      permissions: ['read'],
      expiresIn: 60 * 24 * 60 * 60 * 1000,
    });

    const result = validatePassport(passport);
    expect(result.warnings.some((w) => w.includes('30 days'))).toBe(true);
  });
});
