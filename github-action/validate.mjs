// ─────────────────────────────────────────────────────────────────────────
//  Agent Passport — CI validator
//  Self-contained (zero deps). Mirrors packages/core policy semantics:
//  token format, expiry, delegation-chain subset checks, risk + wildcard gates.
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync, appendFileSync } from 'node:fs';

const env = (k, d = '') => process.env[k] ?? d;
const truthy = (v) => /^(1|true|yes)$/i.test(String(v).trim());

const opts = {
  token: env('INPUT_TOKEN').trim(),
  policyFile: env('INPUT_POLICY_FILE', '.passport/policy.json').trim(),
  denyWildcards: truthy(env('INPUT_DENY_WILDCARDS')),
  maxRisk: env('INPUT_MAX_RISK', 'high').trim().toLowerCase(),
  failOnExpired: truthy(env('INPUT_FAIL_ON_EXPIRED', 'true')),
};

const RISK_ORDER = { low: 0, medium: 1, high: 2 };
let checked = 0;
let violations = 0;
const errors = [];
const warnings = [];

// ── GitHub annotation helpers ──
function err(msg, file) {
  violations++;
  errors.push(msg);
  console.log(`::error${file ? ` file=${file}` : ''}::${msg}`);
}
function warn(msg, file) {
  warnings.push(msg);
  console.log(`::warning${file ? ` file=${file}` : ''}::${msg}`);
}

// ── policy logic (mirrors core/policy.ts) ──
function matchesPermission(required, granted) {
  return granted.some((p) => {
    if (p === required) return true;
    if (p.endsWith(':*') && required.startsWith(p.slice(0, -1))) return true;
    return p === '*';
  });
}
function isSubset(child, parent) {
  return child.every((c) => matchesPermission(c, parent));
}
function riskOf(action) {
  if (action === '*' || action.endsWith(':*') || action.endsWith(':delete') || action.endsWith(':drop')) return 'high';
  if (action.endsWith(':write') || action.endsWith(':send') || action.endsWith(':charge') || action.endsWith(':book')) return 'medium';
  return 'low';
}

// ── token decoding (mirrors core/token.ts ap1 format) ──
function b64urlToStr(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf-8');
}
function decodeToken(token, label) {
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'ap1') {
    err(`${label}: invalid token format — expected ap1.<payload>.<sig>.<key>`);
    return null;
  }
  try {
    return JSON.parse(b64urlToStr(parts[1]));
  } catch {
    err(`${label}: payload is not valid JSON`);
    return null;
  }
}

// ── normalize a definition (token string OR inline object) into a payload ──
function toPayload(entry, label) {
  if (typeof entry === 'string') return decodeToken(entry, label);
  if (entry && typeof entry === 'object') {
    // inline passport definition: { agent, permissions: [...], parent?, exp? }
    const perms = (entry.permissions || []).map((p) => (typeof p === 'string' ? p : p.action));
    return {
      id: entry.id || label,
      sub: entry.agent || entry.sub || label,
      permissions: perms.map((a) => ({ action: a })),
      exp: entry.exp ?? null,
      parentId: entry.parent ?? entry.parentId ?? null,
      _parentRef: entry.parent ?? null,
      limits: entry.limits,
    };
  }
  err(`${label}: unrecognized passport entry`);
  return null;
}

// ── validate one payload ──
function validatePayload(payload, label, byId) {
  if (!payload) return;
  checked++;
  const agent = payload.sub || label;
  const perms = (payload.permissions || []).map((p) => (typeof p === 'string' ? p : p.action));

  // expiry
  if (opts.failOnExpired && payload.exp && Date.now() > payload.exp) {
    err(`${agent}: passport expired at ${new Date(payload.exp).toISOString()}`);
  }

  // wildcard gate
  if (opts.denyWildcards) {
    const wild = perms.filter((p) => p === '*' || p.endsWith(':*'));
    if (wild.length) err(`${agent}: wildcard permissions not allowed — ${wild.join(', ')}`);
  }

  // risk gate
  const cap = RISK_ORDER[opts.maxRisk] ?? 2;
  for (const p of perms) {
    const r = riskOf(p);
    if (RISK_ORDER[r] > cap) {
      err(`${agent}: permission "${p}" is ${r}-risk, exceeds max-risk=${opts.maxRisk}`);
    }
  }

  // escalation check against parent (delegation chain)
  const parentRef = payload._parentRef || payload.parentId;
  if (parentRef && byId) {
    const parent = byId.get(parentRef);
    if (!parent) {
      warn(`${agent}: declares parent "${parentRef}" not found in policy — cannot verify narrowing`);
    } else {
      const parentPerms = (parent.permissions || []).map((p) => (typeof p === 'string' ? p : p.action));
      if (!isSubset(perms, parentPerms)) {
        const bad = perms.filter((p) => !matchesPermission(p, parentPerms));
        err(`${agent}: scope escalation — ${bad.join(', ')} not granted by parent "${parentRef}"`);
      }
    }
  }
}

// ── main ──
function main() {
  const entries = [];

  if (opts.token) {
    entries.push({ key: 'input.token', value: opts.token });
  }

  if (opts.policyFile && existsSync(opts.policyFile)) {
    let json;
    try {
      json = JSON.parse(readFileSync(opts.policyFile, 'utf-8'));
    } catch (e) {
      err(`Failed to parse ${opts.policyFile}: ${e.message}`, opts.policyFile);
      return finish();
    }
    const list = Array.isArray(json) ? json : json.passports || [];
    if (!Array.isArray(list)) {
      err(`${opts.policyFile}: expected an array or { "passports": [...] }`, opts.policyFile);
      return finish();
    }
    list.forEach((e, i) => entries.push({ key: `${opts.policyFile}#${i}`, value: e }));
  } else if (!opts.token) {
    warn(`No token provided and policy file "${opts.policyFile}" not found — nothing to check.`);
    return finish();
  }

  // build payloads + index by id/agent for chain resolution
  const payloads = entries.map((e) => ({ label: e.key, payload: toPayload(e.value, e.key) }));
  const byId = new Map();
  for (const { payload } of payloads) {
    if (payload) {
      if (payload.id) byId.set(payload.id, payload);
      if (payload.sub) byId.set(payload.sub, payload);
    }
  }

  for (const { label, payload } of payloads) validatePayload(payload, label, byId);
  finish();
}

function finish() {
  if (process.env.GITHUB_OUTPUT) {
    try {
      appendFileSync(process.env.GITHUB_OUTPUT, `checked=${checked}\nviolations=${violations}\n`);
    } catch { /* ignore */ }
  }

  console.log('');
  console.log(`🛡️  Agent Passport check — ${checked} passport(s) inspected`);
  if (violations === 0 && warnings.length === 0) {
    console.log('✅ All passports valid. No violations.');
  } else {
    if (warnings.length) console.log(`⚠️  ${warnings.length} warning(s)`);
    if (violations) console.log(`❌ ${violations} violation(s)`);
  }

  if (violations > 0) process.exit(1);
}

main();
