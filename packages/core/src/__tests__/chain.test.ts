import { describe, it, expect } from 'vitest';
import { PassportIssuer } from '../passport.js';
import { validateChain } from '../chain.js';

describe('validateChain', () => {
  it('validates a single-link chain', () => {
    const issuer = new PassportIssuer();
    const root = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:root',
      permissions: ['read', 'write'],
      limits: { maxSpend: 500 },
    });

    const result = validateChain([root]);
    expect(result.valid).toBe(true);
    expect(result.depth).toBe(0);
    expect(result.rootPrincipal).toBe('user:alice');
    expect(result.leafAgent).toBe('agent:root');
  });

  it('validates a multi-link delegation chain', () => {
    const issuer = new PassportIssuer();
    const root = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:root',
      permissions: ['read', 'write'],
      limits: { maxSpend: 500 },
    });
    const child = issuer.delegate(root, {
      agent: 'agent:child',
      permissions: ['read'],
      limits: { maxSpend: 100 },
    });
    const grandchild = issuer.delegate(child, {
      agent: 'agent:grandchild',
      permissions: ['read'],
      limits: { maxSpend: 50 },
    });

    const result = validateChain([root, child, grandchild]);
    expect(result.valid).toBe(true);
    expect(result.depth).toBe(2);
    expect(result.leafAgent).toBe('agent:grandchild');
  });

  it('detects expired links', () => {
    const issuer = new PassportIssuer();
    const root = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:root',
      permissions: ['read'],
      limits: { maxSpend: 100 },
    });

    const result = validateChain([root], { now: Date.now() + 100 * 60 * 60 * 1000 });
    expect(result.valid).toBe(false);
    expect(result.links[0]!.reason).toBe('Expired');
  });

  it('detects revoked links', () => {
    const issuer = new PassportIssuer();
    const root = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:root',
      permissions: ['read'],
      limits: { maxSpend: 100 },
    });

    const result = validateChain([root], {
      isRevoked: (id) => id === root.payload.id,
    });
    expect(result.valid).toBe(false);
    expect(result.links[0]!.reason).toBe('Revoked');
  });

  it('returns invalid for empty chain', () => {
    const result = validateChain([]);
    expect(result.valid).toBe(false);
    expect(result.depth).toBe(0);
  });
});
