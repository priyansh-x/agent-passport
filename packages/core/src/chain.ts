import type { SignedPassport } from './types.js';
import { isSubsetPermissions } from './policy.js';

export interface ChainLink {
  passport: SignedPassport;
  depth: number;
  valid: boolean;
  reason?: string;
}

export interface ChainValidation {
  valid: boolean;
  links: ChainLink[];
  depth: number;
  rootPrincipal: string;
  leafAgent: string;
}

export function validateChain(
  chain: SignedPassport[],
  options?: {
    isRevoked?: (id: string) => boolean;
    now?: number;
  },
): ChainValidation {
  if (chain.length === 0) {
    return { valid: false, links: [], depth: 0, rootPrincipal: '', leafAgent: '' };
  }

  const now = options?.now ?? Date.now();
  const links: ChainLink[] = [];

  for (let i = 0; i < chain.length; i++) {
    const passport = chain[i]!;
    const { payload } = passport;
    let valid = true;
    let reason: string | undefined;

    if (now > payload.exp) {
      valid = false;
      reason = 'Expired';
    }

    if (options?.isRevoked?.(payload.id)) {
      valid = false;
      reason = 'Revoked';
    }

    if (i > 0) {
      const parent = chain[i - 1]!;

      if (payload.parentId !== parent.payload.id) {
        valid = false;
        reason = 'Parent ID mismatch';
      }

      if (payload.principal !== parent.payload.principal) {
        valid = false;
        reason = 'Principal changed across delegation';
      }

      if (!isSubsetPermissions(payload.permissions, parent.payload.permissions)) {
        valid = false;
        reason = 'Permissions escalated beyond parent';
      }

      if (payload.limits.maxSpend > parent.payload.limits.maxSpend) {
        valid = false;
        reason = 'Spend limit exceeds parent';
      }

      if (payload.exp > parent.payload.exp) {
        valid = false;
        reason = 'Expiry exceeds parent';
      }
    }

    links.push({ passport, depth: i, valid, reason });
  }

  const allValid = links.every((l) => l.valid);
  return {
    valid: allValid,
    links,
    depth: chain.length - 1,
    rootPrincipal: chain[0]!.payload.principal,
    leafAgent: chain[chain.length - 1]!.payload.sub,
  };
}
