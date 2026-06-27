import type { PassportPayload, AuthorizeResult, Permission } from './types.js';

export function matchesPermission(
  required: string,
  granted: Permission[],
): boolean {
  for (const perm of granted) {
    if (perm.action === required) return true;
    if (perm.action.endsWith(':*')) {
      const prefix = perm.action.slice(0, -1);
      if (required.startsWith(prefix)) return true;
    }
    if (perm.action === '*') return true;
  }
  return false;
}

export function authorize(
  passport: PassportPayload,
  action: string,
  spendAmount: number,
  isRevoked: (id: string) => boolean,
  currentSpent = 0,
): AuthorizeResult {
  const base = { passportId: passport.id };

  if (isRevoked(passport.id)) {
    return { ...base, allowed: false, reason: 'Passport has been revoked' };
  }

  const now = Date.now();
  if (now > passport.exp) {
    return { ...base, allowed: false, reason: 'Passport has expired' };
  }
  if (now < passport.iat) {
    return { ...base, allowed: false, reason: 'Passport is not yet valid' };
  }

  if (!matchesPermission(action, passport.permissions)) {
    return {
      ...base,
      allowed: false,
      reason: `Action "${action}" is not permitted. Allowed: ${passport.permissions.map((p) => p.action).join(', ')}`,
    };
  }

  if (spendAmount > 0) {
    const remaining = passport.limits.maxSpend - currentSpent;
    if (spendAmount > remaining) {
      return {
        ...base,
        allowed: false,
        reason: `Spend $${spendAmount} exceeds remaining limit $${remaining} ${passport.limits.currency}`,
      };
    }
  }

  return { ...base, allowed: true };
}

export function isSubsetPermissions(
  child: Permission[],
  parent: Permission[],
): boolean {
  return child.every((cp) => matchesPermission(cp.action, parent));
}
