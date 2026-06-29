import { PassportIssuer } from './passport.js';
import type { SignedPassport, IssueOptions } from './types.js';

let testIssuer: PassportIssuer | null = null;

export function getTestIssuer(): PassportIssuer {
  if (!testIssuer) testIssuer = new PassportIssuer();
  return testIssuer;
}

export function resetTestIssuer(): void {
  testIssuer = null;
}

export function createTestPassport(overrides?: Partial<IssueOptions>): SignedPassport {
  const issuer = getTestIssuer();
  return issuer.issue({
    principal: 'user:test@example.com',
    agent: 'agent:test-bot',
    permissions: ['read', 'write'],
    limits: { maxSpend: 1000 },
    expiresIn: 60 * 60 * 1000,
    ...overrides,
  });
}

export function createTestDelegation(
  parent: SignedPassport,
  overrides?: Partial<IssueOptions>,
): SignedPassport {
  const issuer = getTestIssuer();
  return issuer.delegate(parent, {
    agent: overrides?.agent ?? 'agent:child-bot',
    permissions: overrides?.permissions ?? ['read'],
    limits: overrides?.limits ?? { maxSpend: 100 },
    expiresIn: overrides?.expiresIn,
  });
}

export function createExpiredPassport(overrides?: Partial<IssueOptions>): SignedPassport {
  return createTestPassport({ ...overrides, expiresIn: -1000 });
}
