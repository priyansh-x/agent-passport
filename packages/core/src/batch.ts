import type { SignedPassport, AuthorizeResult } from './types.js';
import { authorize } from './policy.js';

export interface BatchAction {
  action: string;
  spendAmount?: number;
}

export interface BatchResult {
  allAllowed: boolean;
  results: (AuthorizeResult & { action: string })[];
  totalSpend: number;
}

export function authorizeBatch(
  passport: SignedPassport,
  actions: BatchAction[],
  isRevoked: (id: string) => boolean = () => false,
  currentSpent = 0,
): BatchResult {
  let runningSpent = currentSpent;
  const results: (AuthorizeResult & { action: string })[] = [];

  for (const { action, spendAmount = 0 } of actions) {
    const result = authorize(passport.payload, action, spendAmount, isRevoked, runningSpent);
    results.push({ ...result, action });
    if (result.allowed) runningSpent += spendAmount;
  }

  const allAllowed = results.every((r) => r.allowed);
  return { allAllowed, results, totalSpend: runningSpent - currentSpent };
}
