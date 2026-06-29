export { AgentPassport } from './agent-passport.js';
export { PassportBuilder, passport } from './builder.js';
export { createPassportAuthority } from './authority.js';
export { requirePassport, withBudget, withPassportAsync, createGuardedProxy } from './guards.js';
export type { AuthorityConfig } from './authority.js';
export type {
  Permission,
  SpendLimit,
  PassportPayload,
  SignedPassport,
  AuthorizeResult,
  AuditEntry,
} from '@passport-agent/core';
