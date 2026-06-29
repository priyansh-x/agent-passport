# API Reference

## Core (`@passport-agent/core`)

### PassportIssuer

The central authority that issues, verifies, and revokes passports.

```typescript
import { PassportIssuer } from '@passport-agent/core';

const issuer = new PassportIssuer();
```

#### `issuer.issue(options): SignedPassport`

Issue a new root passport.

| Param | Type | Description |
|-------|------|-------------|
| `principal` | `string` | Human who authorizes the agent |
| `agent` | `string` | Agent receiving the passport |
| `permissions` | `string[]` | Allowed actions (`calendar:read`, `email:*`, etc.) |
| `limits` | `{ maxSpend: number; currency?: string }` | Spending constraints |
| `expiresIn` | `number` | TTL in milliseconds (default: 24h) |

```typescript
const passport = issuer.issue({
  principal: 'user:alice@co.com',
  agent: 'agent:bot',
  permissions: ['read', 'write'],
  limits: { maxSpend: 500, currency: 'USD' },
  expiresIn: 3600000,
});
```

#### `issuer.authorize(passport, action, spendAmount?): AuthorizeResult`

Check if an action is permitted.

```typescript
const result = issuer.authorize(passport, 'read', 0);
// { allowed: true, passportId: '...' }
```

#### `issuer.delegate(parent, options): SignedPassport`

Create a child passport with narrower permissions. Throws if child would escalate privileges.

```typescript
const child = issuer.delegate(passport, {
  agent: 'agent:helper',
  permissions: ['read'],       // must be subset
  limits: { maxSpend: 50 },    // must be ≤ parent
});
```

#### `issuer.revoke(id): string[]`

Revoke a passport and all descendants. Returns list of revoked IDs.

---

### Token Serialization

Compact wire format: `ap1.<payload>.<signature>.<publicKey>`

```typescript
import { serializePassport, deserializePassport } from '@passport-agent/core';

const token = serializePassport(signed);
// "ap1.eyJpZCI6Ii4uLg.a1b2c3...f4e5d6"

const restored = deserializePassport(token);
```

---

### Validation

```typescript
import { validatePassport } from '@passport-agent/core';

const result = validatePassport(signed, {
  isRevoked: (id) => revokedSet.has(id),
  checkExpiry: true,
});
// { valid: true, errors: [], warnings: ['Expires in < 5 minutes'] }
```

---

### Chain Validation

Validate an entire delegation chain from root to leaf.

```typescript
import { validateChain } from '@passport-agent/core';

const result = validateChain([root, child, grandchild], {
  isRevoked: (id) => db.isRevoked(id),
});
// { valid: true, depth: 2, rootPrincipal: 'user:alice', leafAgent: 'agent:gc' }
```

---

### Policy Builder

Declarative authorization policies with a fluent API.

```typescript
import { policy } from '@passport-agent/core';

const check = policy()
  .requirePermission('write')
  .requireBudget(100)
  .timeWindow(9, 17)           // 9am–5pm UTC
  .denyActions('admin', 'delete')
  .build();

const decision = check(payload, 'write', { hour: 14 });
// { allowed: true }
```

---

### Templates

Pre-built passport configurations for common use cases.

```typescript
import { fromTemplate, PassportIssuer } from '@passport-agent/core';

const issuer = new PassportIssuer();
const opts = fromTemplate('readonly', 'user:alice', 'agent:bot');
const passport = issuer.issue(opts);
```

Available templates: `readonly`, `readwrite`, `spender`, `automation`, `admin`

---

### Constraints

Time, day, IP, and action-count constraints.

```typescript
import { checkConstraints } from '@passport-agent/core';

const result = checkConstraints(
  { time: { startHour: 9, endHour: 17 }, maxActions: 100 },
  { actionCount: 50 },
);
// { allowed: true }
```

---

### Composable Conditions

Build complex authorization rules with `and`, `or`, `not`.

```typescript
import { and, hasPermission, isAgent, maxSpendBelow } from '@passport-agent/core';

const canRead = and(
  hasPermission('read'),
  isAgent('agent:*'),
  maxSpendBelow(1000),
);

canRead(payload, 'read'); // true or false
```

---

### Batch Authorization

Check multiple actions atomically with cumulative spend tracking.

```typescript
import { authorizeBatch } from '@passport-agent/core';

const result = authorizeBatch(passport, [
  { action: 'read' },
  { action: 'purchase', spendAmount: 50 },
  { action: 'purchase', spendAmount: 30 },
]);
// { allAllowed: true, totalSpend: 80, results: [...] }
```

---

### Merge Passports

Combine multiple passports into a single authorization context.

```typescript
import { mergePassports } from '@passport-agent/core';

const ctx = mergePassports([passportA, passportB]);
ctx.authorize('read');       // tries each passport
ctx.permissions();           // union of all permissions
ctx.principals();            // unique principals
```

---

### Utilities

```typescript
import {
  formatPassport,        // one-line summary
  formatPassportTable,   // ASCII table
  diffPassports,         // compare parent/child
  redactPassport,        // safe for logging
  fingerprint,           // human-readable "alpha-bravo-cedar-42"
  shortId,               // first 8 chars of ID
  inspectPassport,       // structured debug report
  printInspection,       // ASCII box output
} from '@passport-agent/core';
```

---

## SDK (`@passport-agent/sdk`)

### AgentPassport

High-level API wrapping core functionality with better DX.

```typescript
import { AgentPassport } from '@passport-agent/sdk';

const p = AgentPassport.issue({
  principal: 'user:alice',
  agent: 'agent:bot',
  permissions: ['read', 'write'],
  limits: { maxSpend: 100 },
});

p.authorize('read');                    // throws on denial
p.tryAuthorize('delete');               // returns { allowed: false }
const child = p.delegate({ ... });      // monotonic narrowing
p.revoke();                             // cascade
```

#### Token Serialization

```typescript
const token = p.toToken();              // "ap1...."
const restored = AgentPassport.fromToken(token, issuer);
```

---

### PassportBuilder

Fluent builder pattern for passport creation.

```typescript
import { passport } from '@passport-agent/sdk';

const p = passport()
  .for('user:alice')
  .agent('agent:bot')
  .allow('read', 'write')
  .budget(500)
  .expiresInHours(24)
  .build();
```

---

### Guards

Authorization decorators for functions and objects.

```typescript
import { requirePassport, withBudget, createGuardedProxy } from '@passport-agent/sdk';

// Wrap a function
const safeFn = requirePassport(passport, 'read', myFunction);

// Budget-aware wrapper
const purchase = withBudget(passport, 'purchase', buyItem, 50);

// Guard all methods on an object
const guarded = createGuardedProxy(service, passport, {
  getUser: 'read',
  deleteUser: 'admin',
});
```

---

### Async Context

Thread passports implicitly through async call stacks.

```typescript
import { runWithPassport, requireCurrentPassport } from '@passport-agent/sdk';

runWithPassport(passport, async () => {
  const p = requireCurrentPassport(); // retrieves from AsyncLocalStorage
  p.authorize('read');
});
```

---

### Events

Typed event emitter for observability. Events fire automatically from `AgentPassport` methods.

```typescript
import { passportEvents } from '@passport-agent/sdk';

passportEvents.on('authorize', (e) => {
  console.log(`${e.passportId}: ${e.action} → ${e.allowed}`);
});

passportEvents.on('delegate', (e) => {
  console.log(`${e.parentId} → ${e.childId}`);
});

// Events: authorize, authorize:denied, delegate, revoke, spend
```

---

### Structured Logger

Auto-logs all passport events as structured JSON.

```typescript
import { PassportLogger } from '@passport-agent/sdk';

const logger = new PassportLogger({ level: 'info' });
// All authorize/delegate/revoke/spend events now logged

logger.detach(); // stop logging
```

---

### Retry

Resilient API calls with automatic re-authorization.

```typescript
import { withRetry } from '@passport-agent/sdk';

const data = await withRetry(passport, 'api:call', fetchData, {
  maxAttempts: 3,
  backoff: 'exponential',
  onRetry: (attempt, err) => console.warn(`Retry ${attempt}`, err),
});
```

---

## Server (`@passport-agent/server`)

### CLI

```bash
npx @passport-agent/server --port 3100 --db ./passports.db --cors
```

### REST API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check with DB latency |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/openapi.json` | OpenAPI 3.0 spec |
| `POST` | `/v1/passports` | Issue a passport |
| `GET` | `/v1/passports` | List all passports |
| `GET` | `/v1/passports/search?agent=&principal=&status=` | Search/filter |
| `GET` | `/v1/passports/:id` | Get passport details |
| `POST` | `/v1/passports/:id/authorize` | Authorize an action |
| `POST` | `/v1/passports/:id/authorize-bulk` | Bulk authorize |
| `POST` | `/v1/passports/:id/delegate` | Create child passport |
| `POST` | `/v1/passports/:id/revoke` | Revoke (cascades) |
| `POST` | `/v1/passports/:id/verify` | Check validity |
| `POST` | `/v1/passports/:id/introspect` | Token introspection |
| `GET` | `/v1/passports/:id/audit` | Audit log |
| `GET` | `/v1/passports/:id/tree` | Delegation tree |
| `GET` | `/v1/passports/:id/validate` | Full validation |
| `GET` | `/v1/passports/:id/token` | Compact token |
| `GET` | `/v1/audit` | Recent audit entries |
| `GET` | `/v1/stats` | Aggregate statistics |
| `GET` | `/v1/export` | Full data export |
| `GET/POST/DELETE` | `/v1/webhooks` | Webhook management |

### Webhooks

Subscribe to passport lifecycle events.

```bash
curl -X POST http://localhost:3100/v1/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhook",
    "events": ["passport.issued", "passport.revoked"],
    "secret": "whsec_..."
  }'
```

Events: `passport.issued`, `passport.authorized`, `passport.denied`, `passport.delegated`, `passport.revoked`, `passport.expired`

Deliveries include an `X-Passport-Signature` header (HMAC-SHA256) for verification.

---

## MCP Plugin (`@passport-agent/mcp`)

```typescript
import { PassportToolGuard } from '@passport-agent/mcp';

const guard = new PassportToolGuard({ issuer });

// From a SignedPassport object
guard.guard(passport, 'tool_name', args, handler);

// From a compact token string
guard.guardWithToken('ap1....', 'tool_name', args, handler);

// Extract from HTTP header
const passport = PassportToolGuard.fromHeader(req.headers.authorization);
```

---

## Middleware (`@passport-agent/middleware`)

### Express

```typescript
import { expressPassport } from '@passport-agent/middleware';

app.use('/api', expressPassport({ issuer }));
```

### Fastify

```typescript
import { fastifyPassport } from '@passport-agent/middleware';

fastify.register(fastifyPassport, { issuer });
```

### Next.js

```typescript
import { nextPassport } from '@passport-agent/middleware';

export default nextPassport({ issuer })(handler);
```

The middleware accepts passports as JSON in the `x-agent-passport` header, compact `ap1.*` tokens, or `Bearer ap1.*` format.
