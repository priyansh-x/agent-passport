import type { PassportPayload, SignedPassport } from './types.js';

function timeRemaining(expMs: number, now = Date.now()): string {
  const diff = expMs - now;
  if (diff <= 0) return 'expired';
  if (diff < 60_000) return `${Math.round(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h`;
  return `${Math.round(diff / 86_400_000)}d`;
}

export function formatPassport(passport: SignedPassport | PassportPayload): string {
  const p = 'payload' in passport ? passport.payload : passport;
  const perms = p.permissions.map((perm) => perm.action).join(', ');
  const ttl = timeRemaining(p.exp);
  const budget = p.limits.maxSpend > 0
    ? `$${p.limits.maxSpend - p.limits.spent}/$${p.limits.maxSpend} ${p.limits.currency}`
    : 'no budget';
  const parent = p.parentId ? ` (delegated from ${p.parentId.slice(0, 8)}…)` : '';

  return `[${p.id.slice(0, 8)}…] ${p.sub} ← ${p.principal} | ${perms} | ${budget} | ${ttl}${parent}`;
}

export function formatPassportTable(passports: (SignedPassport | PassportPayload)[]): string {
  const rows = passports.map((p) => {
    const payload = 'payload' in p ? p.payload : p;
    return {
      id: payload.id.slice(0, 12),
      agent: payload.sub,
      principal: payload.principal,
      permissions: payload.permissions.map((perm) => perm.action).join(', '),
      budget: payload.limits.maxSpend > 0
        ? `$${payload.limits.maxSpend - payload.limits.spent}/$${payload.limits.maxSpend}`
        : '-',
      ttl: timeRemaining(payload.exp),
    };
  });

  if (rows.length === 0) return '(no passports)';

  const header = 'ID           | Agent                | Principal            | Permissions          | Budget      | TTL';
  const sep = '-'.repeat(header.length);
  const lines = rows.map((r) =>
    `${r.id.padEnd(12)} | ${r.agent.padEnd(20)} | ${r.principal.padEnd(20)} | ${r.permissions.slice(0, 20).padEnd(20)} | ${r.budget.padEnd(11)} | ${r.ttl}`
  );

  return [header, sep, ...lines].join('\n');
}
