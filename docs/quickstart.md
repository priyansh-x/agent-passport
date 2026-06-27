# Quickstart — 5 Minutes to Agent Authorization

## Install

```bash
npm install @passport-agent/sdk @passport-agent/core
```

## 1. Issue a Passport

```typescript
import { AgentPassport } from '@passport-agent/sdk';
import { PassportIssuer } from '@passport-agent/core';

const issuer = new PassportIssuer();

const passport = AgentPassport.issue({
  principal: 'user:alice@company.com',
  agent: 'agent:my-bot',
  permissions: ['calendar:read', 'email:send'],
  limits: { maxSpend: 100 },
}, issuer);
```

## 2. Check Before Acting

```typescript
// Throws PassportDeniedError if not allowed
passport.authorize('calendar:read');

// Or check without throwing
const result = passport.tryAuthorize('email:send');
if (result.allowed) {
  // do the thing
}
```

## 3. Delegate to Sub-Agents

```typescript
const helper = passport.delegate({
  agent: 'agent:email-drafter',
  permissions: ['email:send'],  // must be subset of parent
  limits: { maxSpend: 0 },      // no spending allowed
});

// helper can send emails but NOT read calendar
helper.authorize('email:send');    // OK
helper.tryAuthorize('calendar:read'); // { allowed: false }
```

## 4. Revoke

```typescript
// Kills the passport and ALL child passports
passport.revoke();
```

## 5. View Audit Trail

```typescript
for (const entry of passport.auditLog) {
  console.log(`${entry.action} → ${entry.allowed ? 'OK' : 'DENIED'}`);
}
```

## Using the MCP Plugin

```typescript
import { PassportToolGuard } from '@passport-agent/mcp';

const guard = new PassportToolGuard({ issuer });

// Wraps any tool call with passport check
const result = guard.guard(
  passport.signed,
  'read_file',
  { path: '/data.csv' },
  () => readFile('/data.csv'),
);
```

## Running the Local Authority Server

```bash
npx @passport-agent/server
# Server starts at http://localhost:3100

# Issue a passport via API
curl -X POST http://localhost:3100/v1/passports \
  -H "Content-Type: application/json" \
  -d '{"principal":"user:alice@co.com","agent":"agent:bot","permissions":["read"]}'

# Authorize an action
curl -X POST http://localhost:3100/v1/passports/{id}/authorize \
  -H "Content-Type: application/json" \
  -d '{"action":"read"}'
```

## Next Steps

- [Protocol Spec](./protocol-spec.md) — full token format and rules
- [Delegation Example](../examples/delegation/) — multi-agent chains
- [Architecture](../ARCHITECTURE.md) — system design overview
