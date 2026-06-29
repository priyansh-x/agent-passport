import { describe, it, expect } from 'vitest';
import { PassportIssuer } from '../passport.js';
import { diffPassports } from '../diff.js';

describe('diffPassports', () => {
  it('shows permissions removed in delegation', () => {
    const issuer = new PassportIssuer();
    const parent = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:root',
      permissions: ['read', 'write', 'delete'],
      limits: { maxSpend: 500 },
    });
    const child = issuer.delegate(parent, {
      agent: 'agent:helper',
      permissions: ['read'],
      limits: { maxSpend: 100 },
    });

    const diff = diffPassports(parent.payload, child.payload);
    expect(diff.isDelegation).toBe(true);
    expect(diff.permissionsRemoved).toContain('write');
    expect(diff.permissionsRemoved).toContain('delete');
    expect(diff.permissionsAdded).toHaveLength(0);
    expect(diff.spendLimitChange).toEqual({ from: 500, to: 100 });
    expect(diff.agentChange).toEqual({ from: 'agent:root', to: 'agent:helper' });
  });

  it('shows no diff for identical passports', () => {
    const issuer = new PassportIssuer();
    const p = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:bot',
      permissions: ['read'],
    });

    const diff = diffPassports(p.payload, p.payload);
    expect(diff.permissionsAdded).toHaveLength(0);
    expect(diff.permissionsRemoved).toHaveLength(0);
    expect(diff.spendLimitChange).toBeNull();
    expect(diff.agentChange).toBeNull();
  });

  it('detects expiry changes', () => {
    const issuer = new PassportIssuer();
    const parent = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:root',
      permissions: ['read'],
      expiresIn: 86_400_000,
    });
    const child = issuer.delegate(parent, {
      agent: 'agent:child',
      permissions: ['read'],
      expiresIn: 3_600_000,
    });

    const diff = diffPassports(parent.payload, child.payload);
    expect(diff.expiryChange).not.toBeNull();
    expect(diff.expiryChange!.to).toBeLessThan(diff.expiryChange!.from);
  });
});
