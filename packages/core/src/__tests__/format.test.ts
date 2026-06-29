import { describe, it, expect } from 'vitest';
import { PassportIssuer } from '../passport.js';
import { formatPassport, formatPassportTable } from '../format.js';

describe('formatPassport', () => {
  it('formats a passport as a one-liner', () => {
    const issuer = new PassportIssuer();
    const passport = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:bot',
      permissions: ['read', 'write'],
      limits: { maxSpend: 500 },
      expiresIn: 3_600_000,
    });

    const output = formatPassport(passport);
    expect(output).toContain('agent:bot');
    expect(output).toContain('user:alice');
    expect(output).toContain('read, write');
    expect(output).toContain('$500');
  });

  it('shows delegation info', () => {
    const issuer = new PassportIssuer();
    const parent = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:root',
      permissions: ['read'],
    });
    const child = issuer.delegate(parent, {
      agent: 'agent:child',
      permissions: ['read'],
    });

    const output = formatPassport(child);
    expect(output).toContain('delegated from');
  });
});

describe('formatPassportTable', () => {
  it('formats multiple passports as a table', () => {
    const issuer = new PassportIssuer();
    const p1 = issuer.issue({ principal: 'user:alice', agent: 'agent:a', permissions: ['read'] });
    const p2 = issuer.issue({ principal: 'user:bob', agent: 'agent:b', permissions: ['write'] });

    const table = formatPassportTable([p1, p2]);
    expect(table).toContain('Agent');
    expect(table).toContain('agent:a');
    expect(table).toContain('agent:b');
  });

  it('handles empty list', () => {
    expect(formatPassportTable([])).toBe('(no passports)');
  });
});
