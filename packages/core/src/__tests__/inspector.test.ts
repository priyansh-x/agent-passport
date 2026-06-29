import { describe, it, expect } from 'vitest';
import { PassportIssuer } from '../passport.js';
import { inspectPassport, printInspection } from '../inspector.js';

describe('inspectPassport', () => {
  it('produces a complete inspection report', () => {
    const issuer = new PassportIssuer();
    const passport = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:bot',
      permissions: ['read', 'write'],
      limits: { maxSpend: 500 },
    });

    const report = inspectPassport(passport);
    expect(report.validation.valid).toBe(true);
    expect(report.details.agent).toBe('agent:bot');
    expect(report.details.permissions).toEqual(['read', 'write']);
    expect(report.details.maxSpend).toBe(500);
    expect(report.details.remaining).toBe(500);
  });

  it('includes delegation diff when parent provided', () => {
    const issuer = new PassportIssuer();
    const parent = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:root',
      permissions: ['read', 'write', 'delete'],
      limits: { maxSpend: 1000 },
    });
    const child = issuer.delegate(parent, {
      agent: 'agent:child',
      permissions: ['read'],
      limits: { maxSpend: 200 },
    });

    const report = inspectPassport(child, { parent, delegationDepth: 1 });
    expect(report.diff).toBeDefined();
    expect(report.diff!.permissionsRemoved).toContain('write');
    expect(report.diff!.permissionsRemoved).toContain('delete');
    expect(report.details.delegationDepth).toBe(1);
  });
});

describe('printInspection', () => {
  it('formats a readable output', () => {
    const issuer = new PassportIssuer();
    const passport = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:bot',
      permissions: ['read'],
      limits: { maxSpend: 100 },
    });

    const report = inspectPassport(passport);
    const output = printInspection(report);
    expect(output).toContain('Passport Inspection');
    expect(output).toContain('agent:bot');
    expect(output).toContain('VALID');
  });
});
