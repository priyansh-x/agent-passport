import { describe, it, expect } from 'vitest';
import { passport, PassportBuilder } from '../builder.js';
import { PassportIssuer } from '@passport-agent/core';

describe('PassportBuilder', () => {
  it('builds a passport with fluent API', () => {
    const issuer = new PassportIssuer();
    const p = passport()
      .for('user:alice@company.com')
      .agent('agent:booking-bot')
      .allow('calendar:read', 'calendar:write')
      .allow('email:send')
      .budget(500)
      .expiresInHours(24)
      .withIssuer(issuer)
      .build();

    expect(p.principal).toBe('user:alice@company.com');
    expect(p.agent).toBe('agent:booking-bot');
    expect(p.permissions).toEqual(['calendar:read', 'calendar:write', 'email:send']);
  });

  it('supports expiresInDays', () => {
    const issuer = new PassportIssuer();
    const p = passport()
      .for('user:alice')
      .agent('agent:bot')
      .allow('read')
      .expiresInDays(7)
      .withIssuer(issuer)
      .build();

    const msUntilExpiry = p.expiresAt.getTime() - Date.now();
    expect(msUntilExpiry).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(msUntilExpiry).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });

  it('throws without principal', () => {
    expect(() =>
      passport().agent('agent:bot').allow('read').build(),
    ).toThrow('principal is required');
  });

  it('throws without agent', () => {
    expect(() =>
      passport().for('user:alice').allow('read').build(),
    ).toThrow('agent is required');
  });

  it('throws without permissions', () => {
    expect(() =>
      passport().for('user:alice').agent('agent:bot').build(),
    ).toThrow('at least one permission');
  });

  it('returns a PassportBuilder instance', () => {
    expect(passport()).toBeInstanceOf(PassportBuilder);
  });
});
