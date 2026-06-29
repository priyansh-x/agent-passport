import { AsyncLocalStorage } from 'node:async_hooks';
import type { AgentPassport } from './agent-passport.js';

const storage = new AsyncLocalStorage<AgentPassport>();

export function runWithPassport<T>(passport: AgentPassport, fn: () => T): T {
  return storage.run(passport, fn);
}

export function getCurrentPassport(): AgentPassport | undefined {
  return storage.getStore();
}

export function requireCurrentPassport(): AgentPassport {
  const passport = storage.getStore();
  if (!passport) {
    throw new Error('No passport in current context. Wrap your code with runWithPassport().');
  }
  return passport;
}
