import { AgentPassport } from './agent-passport.js';

export function requirePassport<T extends (...args: unknown[]) => unknown>(
  passport: AgentPassport,
  action: string,
  fn: T,
): T {
  return ((...args: unknown[]) => {
    passport.authorize(action);
    return fn(...args);
  }) as T;
}

export function withBudget<T>(
  passport: AgentPassport,
  action: string,
  amount: number,
  fn: () => T,
): T {
  passport.authorize(action, amount);
  return fn();
}

export async function withPassportAsync<T>(
  passport: AgentPassport,
  action: string,
  fn: () => Promise<T>,
  options?: { spendAmount?: number },
): Promise<T> {
  passport.authorize(action, options?.spendAmount ?? 0);
  return fn();
}

export function createGuardedProxy<T extends object>(
  target: T,
  passport: AgentPassport,
  permissionMap: Record<string, string>,
): T {
  return new Proxy(target, {
    get(obj, prop: string) {
      const original = (obj as Record<string, unknown>)[prop];
      if (typeof original !== 'function') return original;

      const permission = permissionMap[prop];
      if (!permission) return original;

      return (...args: unknown[]) => {
        passport.authorize(permission);
        return (original as (...a: unknown[]) => unknown).apply(obj, args);
      };
    },
  }) as T;
}
