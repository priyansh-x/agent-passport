export { PassportIssuer } from './passport.js';
export { BiscuitIssuer, type BiscuitPassport } from './biscuit.js';
export { RevocationList } from './revocation.js';
export { AuditLog } from './audit.js';
export { matchesPermission, authorize, isSubsetPermissions } from './policy.js';
export { generateKeyPair, sign, verify, toHex, fromHex } from './crypto.js';
export { serializePassport, deserializePassport } from './token.js';
export { ScopeRegistry, createDefaultRegistry, DEFAULT_SCOPES, type ScopeDefinition } from './scopes.js';
export { validatePassport, type ValidationResult } from './validator.js';
export { diffPassports, type PassportDiff } from './diff.js';
export { formatPassport, formatPassportTable } from './format.js';
export { PolicyBuilder, policy, type PolicyCheck, type PolicyContext, type PolicyDecision } from './policy-builder.js';
export { inspectPassport, printInspection, type InspectionReport } from './inspector.js';
export { validateChain, type ChainLink, type ChainValidation } from './chain.js';
export { TEMPLATES, fromTemplate, type PassportTemplate } from './templates.js';
export { redactPassport, type RedactOptions } from './redact.js';
export { fingerprint, shortId } from './fingerprint.js';
export { mergePassports, type MergedContext } from './merge.js';
export { checkConstraints, checkTimeConstraint, checkDayConstraint, type Constraints, type TimeConstraint, type DayConstraint } from './constraints.js';
export { authorizeBatch, type BatchAction, type BatchResult } from './batch.js';
export { and, or, not, hasPermission, maxSpendBelow, isAgent, isPrincipal, notExpiredWithin, type ConditionFn } from './condition.js';
export { toBase64Url, fromBase64Url, encodePayload, decodePayload } from './encoding.js';
export type {
  Permission,
  SpendLimit,
  PassportPayload,
  SignedPassport,
  IssueOptions,
  DelegateOptions,
  AuthorizeResult,
  AuditEntry,
} from './types.js';
