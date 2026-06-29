import type { SignedPassport } from './types.js';
import { validatePassport, type ValidationResult } from './validator.js';
import { diffPassports, type PassportDiff } from './diff.js';
import { formatPassport } from './format.js';

export interface InspectionReport {
  summary: string;
  validation: ValidationResult;
  details: {
    id: string;
    agent: string;
    principal: string;
    issuer: string;
    permissions: string[];
    maxSpend: number;
    spent: number;
    remaining: number;
    currency: string;
    issuedAt: string;
    expiresAt: string;
    timeRemaining: string;
    parentId: string | null;
    delegationDepth: number;
  };
  diff?: PassportDiff;
}

function timeRemaining(expMs: number): string {
  const diff = expMs - Date.now();
  if (diff <= 0) return 'EXPIRED';
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function inspectPassport(
  passport: SignedPassport,
  options?: {
    parent?: SignedPassport;
    isRevoked?: (id: string) => boolean;
    delegationDepth?: number;
  },
): InspectionReport {
  const { payload } = passport;
  const validation = validatePassport(passport, { isRevoked: options?.isRevoked });

  const report: InspectionReport = {
    summary: formatPassport(passport),
    validation,
    details: {
      id: payload.id,
      agent: payload.sub,
      principal: payload.principal,
      issuer: payload.iss,
      permissions: payload.permissions.map((p) => p.action),
      maxSpend: payload.limits.maxSpend,
      spent: payload.limits.spent,
      remaining: Math.max(0, payload.limits.maxSpend - payload.limits.spent),
      currency: payload.limits.currency,
      issuedAt: new Date(payload.iat).toISOString(),
      expiresAt: new Date(payload.exp).toISOString(),
      timeRemaining: timeRemaining(payload.exp),
      parentId: payload.parentId,
      delegationDepth: options?.delegationDepth ?? 0,
    },
  };

  if (options?.parent) {
    report.diff = diffPassports(options.parent.payload, payload);
  }

  return report;
}

export function printInspection(report: InspectionReport): string {
  const lines: string[] = [];
  const { details: d, validation: v } = report;

  lines.push(`┌─ Passport Inspection ──────────────────────────`);
  lines.push(`│ ID:          ${d.id}`);
  lines.push(`│ Agent:       ${d.agent}`);
  lines.push(`│ Principal:   ${d.principal}`);
  lines.push(`│ Issuer:      ${d.issuer}`);
  lines.push(`│ Permissions: ${d.permissions.join(', ')}`);
  if (d.maxSpend > 0) {
    lines.push(`│ Budget:      $${d.remaining}/$${d.maxSpend} ${d.currency} (spent: $${d.spent})`);
  }
  lines.push(`│ Issued:      ${d.issuedAt}`);
  lines.push(`│ Expires:     ${d.expiresAt} (${d.timeRemaining})`);
  if (d.parentId) {
    lines.push(`│ Parent:      ${d.parentId} (depth: ${d.delegationDepth})`);
  }

  lines.push(`├─ Validation ───────────────────────────────────`);
  lines.push(`│ Status:      ${v.valid ? '✓ VALID' : '✗ INVALID'}`);
  if (v.errors.length > 0) {
    for (const e of v.errors) lines.push(`│ ERROR:       ${e}`);
  }
  if (v.warnings.length > 0) {
    for (const w of v.warnings) lines.push(`│ WARNING:     ${w}`);
  }

  if (report.diff) {
    lines.push(`├─ Delegation Diff ──────────────────────────────`);
    if (report.diff.permissionsRemoved.length > 0) {
      lines.push(`│ Removed:     ${report.diff.permissionsRemoved.join(', ')}`);
    }
    if (report.diff.permissionsAdded.length > 0) {
      lines.push(`│ Added:       ${report.diff.permissionsAdded.join(', ')}`);
    }
    if (report.diff.spendLimitChange) {
      lines.push(`│ Budget:      $${report.diff.spendLimitChange.from} → $${report.diff.spendLimitChange.to}`);
    }
  }

  lines.push(`└────────────────────────────────────────────────`);
  return lines.join('\n');
}
