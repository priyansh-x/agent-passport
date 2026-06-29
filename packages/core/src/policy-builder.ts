import type { PassportPayload, AuthorizeResult } from './types.js';

export type PolicyCheck = (payload: PassportPayload, action: string, context: PolicyContext) => PolicyDecision;

export interface PolicyContext {
  spendAmount?: number;
  resource?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
}

export class PolicyBuilder {
  private checks: PolicyCheck[] = [];

  requirePermission(): this {
    this.checks.push((payload, action) => {
      const matched = payload.permissions.some(
        (p) => p.action === action || p.action === '*' || (p.action.endsWith(':*') && action.startsWith(p.action.slice(0, -1))),
      );
      return matched ? { allowed: true } : { allowed: false, reason: `Action "${action}" not permitted` };
    });
    return this;
  }

  requireNotExpired(): this {
    this.checks.push((payload, _action, ctx) => {
      const now = ctx.timestamp ?? Date.now();
      return now <= payload.exp
        ? { allowed: true }
        : { allowed: false, reason: 'Passport expired' };
    });
    return this;
  }

  requireBudget(): this {
    this.checks.push((payload, _action, ctx) => {
      if (!ctx.spendAmount || ctx.spendAmount <= 0) return { allowed: true };
      const remaining = payload.limits.maxSpend - payload.limits.spent;
      return ctx.spendAmount <= remaining
        ? { allowed: true }
        : { allowed: false, reason: `Spend $${ctx.spendAmount} exceeds remaining $${remaining}` };
    });
    return this;
  }

  requireNotRevoked(isRevoked: (id: string) => boolean): this {
    this.checks.push((payload) => {
      return isRevoked(payload.id)
        ? { allowed: false, reason: 'Passport revoked' }
        : { allowed: true };
    });
    return this;
  }

  addCheck(check: PolicyCheck): this {
    this.checks.push(check);
    return this;
  }

  denyActions(...actions: string[]): this {
    this.checks.push((_payload, action) => {
      return actions.includes(action)
        ? { allowed: false, reason: `Action "${action}" is explicitly denied` }
        : { allowed: true };
    });
    return this;
  }

  requireResource(resource: string): this {
    this.checks.push((payload, action) => {
      const matched = payload.permissions.some(
        (p) => p.resource === resource && (p.action === action || p.action.endsWith(':*')),
      );
      return matched
        ? { allowed: true }
        : { allowed: false, reason: `No permission for resource "${resource}"` };
    });
    return this;
  }

  timeWindow(startHour: number, endHour: number): this {
    this.checks.push((_payload, _action, ctx) => {
      const hour = new Date(ctx.timestamp ?? Date.now()).getUTCHours();
      return hour >= startHour && hour < endHour
        ? { allowed: true }
        : { allowed: false, reason: `Action only allowed between ${startHour}:00-${endHour}:00 UTC` };
    });
    return this;
  }

  build(): (payload: PassportPayload, action: string, context?: PolicyContext) => AuthorizeResult {
    const checks = [...this.checks];
    return (payload, action, context = {}) => {
      for (const check of checks) {
        const decision = check(payload, action, context);
        if (!decision.allowed) {
          return { allowed: false, reason: decision.reason, passportId: payload.id };
        }
      }
      return { allowed: true, passportId: payload.id };
    };
  }
}

export function policy(): PolicyBuilder {
  return new PolicyBuilder();
}
