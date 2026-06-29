import type { PassportPayload } from './types.js';

export type ConditionFn = (payload: PassportPayload, action: string, context?: Record<string, unknown>) => boolean;

export function and(...conditions: ConditionFn[]): ConditionFn {
  return (payload, action, context) => conditions.every((c) => c(payload, action, context));
}

export function or(...conditions: ConditionFn[]): ConditionFn {
  return (payload, action, context) => conditions.some((c) => c(payload, action, context));
}

export function not(condition: ConditionFn): ConditionFn {
  return (payload, action, context) => !condition(payload, action, context);
}

export function hasPermission(perm: string): ConditionFn {
  return (payload) => payload.permissions.some((p) => p.action === perm || p.action === '*');
}

export function maxSpendBelow(amount: number): ConditionFn {
  return (payload) => payload.limits.maxSpend <= amount;
}

export function isAgent(agentPattern: string): ConditionFn {
  return (payload) => {
    if (agentPattern.endsWith('*')) {
      return payload.sub.startsWith(agentPattern.slice(0, -1));
    }
    return payload.sub === agentPattern;
  };
}

export function isPrincipal(principalPattern: string): ConditionFn {
  return (payload) => {
    if (principalPattern.endsWith('*')) {
      return payload.principal.startsWith(principalPattern.slice(0, -1));
    }
    return payload.principal === principalPattern;
  };
}

export function notExpiredWithin(ms: number): ConditionFn {
  return (payload) => payload.exp - Date.now() > ms;
}
