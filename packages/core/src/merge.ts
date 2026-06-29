import type { SignedPassport, AuthorizeResult } from './types.js';
import { authorize } from './policy.js';

export interface MergedContext {
  passports: SignedPassport[];
  authorize(action: string, spendAmount?: number): AuthorizeResult;
  permissions(): string[];
  principals(): string[];
  minExpiry(): Date;
}

export function mergePassports(passports: SignedPassport[]): MergedContext {
  return {
    passports,

    authorize(action: string, spendAmount = 0): AuthorizeResult {
      for (const p of passports) {
        const result = authorize(p.payload, action, spendAmount, () => false);
        if (result.allowed) return result;
      }
      return {
        allowed: false,
        reason: `No passport authorizes "${action}"`,
        passportId: passports[0]?.payload.id ?? 'none',
      };
    },

    permissions(): string[] {
      const all = new Set<string>();
      for (const p of passports) {
        for (const perm of p.payload.permissions) all.add(perm.action);
      }
      return [...all];
    },

    principals(): string[] {
      return [...new Set(passports.map((p) => p.payload.principal))];
    },

    minExpiry(): Date {
      const min = Math.min(...passports.map((p) => p.payload.exp));
      return new Date(min);
    },
  };
}
