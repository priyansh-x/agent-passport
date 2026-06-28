# Agent Passport Protocol Specification

**Version:** 0.1.0-draft  
**Status:** Draft  
**Authors:** priyansh-x

## 1. Overview

Agent Passport is an authorization protocol that provides cryptographically verifiable delegation envelopes for AI agents. It sits between the identity layer (SPIFFE/WIMSE) and the action layer (MCP/A2A/APIs), answering the question: **"Is this agent allowed to do this specific thing right now?"**

## 2. Terminology

- **Principal**: The human who authorizes an agent to act on their behalf.
- **Passport**: A signed token granting scoped permissions to an agent.
- **Delegation**: Creating a child passport with a subset of the parent's permissions.
- **Authority**: The service that issues, verifies, and revokes passports.
- **Action**: A named operation an agent wants to perform (e.g., `calendar:write`).
- **Spend**: A numeric cost associated with an action, tracked against a budget.

## 3. Passport Token Format

### 3.1 Payload Schema

```json
{
  "id": "hex-string-32-chars",
  "iss": "agent-passport:local",
  "sub": "agent:booking-bot",
  "principal": "user:alice@company.com",
  "permissions": [
    { "action": "calendar:read" },
    { "action": "calendar:write", "resource": "calendar" },
    { "action": "email:*" }
  ],
  "limits": {
    "maxSpend": 500,
    "currency": "USD",
    "spent": 0
  },
  "iat": 1719475200000,
  "exp": 1719561600000,
  "parentId": null,
  "nonce": "hex-string-32-chars"
}
```

### 3.2 Signed Passport

```json
{
  "payload": { ... },
  "signature": "hex-encoded-ed25519-signature",
  "publicKey": "hex-encoded-ed25519-public-key"
}
```

### 3.3 Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique passport identifier (128-bit hex) |
| `iss` | string | yes | Issuing authority identifier |
| `sub` | string | yes | Agent receiving the passport |
| `principal` | string | yes | Human who authorized the delegation |
| `permissions` | Permission[] | yes | Allow-list of actions |
| `limits` | SpendLimit | yes | Spending constraints |
| `iat` | number | yes | Issued-at timestamp (ms since epoch) |
| `exp` | number | yes | Expiration timestamp (ms since epoch) |
| `parentId` | string\|null | yes | Parent passport ID (null for root) |
| `nonce` | string | yes | Replay protection (128-bit hex) |

## 4. Permission Model

### 4.1 Format

Permissions use colon-separated namespaces: `<namespace>:<action>`

Examples:
- `calendar:read` — read calendar events
- `calendar:write` — create/modify calendar events
- `email:*` — all email operations
- `*` — unrestricted (use with caution)

### 4.2 Matching Rules

1. **Exact match**: `calendar:read` matches `calendar:read`
2. **Wildcard**: `calendar:*` matches `calendar:read`, `calendar:write`, etc.
3. **Global wildcard**: `*` matches everything
4. **No upward match**: `calendar:read` does NOT match `calendar:*`

### 4.3 Spend Limits

Each passport has a `maxSpend` in a given `currency`. The authority tracks cumulative spend. When `currentSpent + requestedSpend > maxSpend`, the action is denied.

A `maxSpend` of `0` means no spend tracking (free actions only).

## 5. Delegation Rules (Monotonic Narrowing)

When creating a child passport from a parent:

1. **Permission subset**: Every child permission must be satisfiable by some parent permission.
2. **Spend cap**: Child `maxSpend` must be ≤ parent's remaining budget (`maxSpend - spent`).
3. **Time bound**: Child `exp` must be ≤ parent `exp`.
4. **Principal preserved**: Child inherits parent's `principal` (cannot change).
5. **Chain linkage**: Child's `parentId` is set to parent's `id`.

These rules are **invariants** — the protocol guarantees privileges can only narrow, never escalate.

### 5.1 Delegation Example

```
Root Passport (alice)
├── permissions: [calendar:*, email:send, purchase]
├── maxSpend: $500
└── exp: 2025-01-02T00:00:00Z

  └── Child Passport (booking-bot)
      ├── permissions: [calendar:read, calendar:write]  ← subset of calendar:*
      ├── maxSpend: $100                                ← ≤ $500
      └── exp: 2025-01-01T12:00:00Z                    ← ≤ parent exp

        └── Grandchild Passport (room-finder)
            ├── permissions: [calendar:read]             ← subset of parent
            ├── maxSpend: $0                             ← ≤ $100
            └── exp: 2025-01-01T06:00:00Z               ← ≤ parent exp
```

### 5.2 Delegation Violations (Rejected)

| Attempt | Violation |
|---------|-----------|
| Child requests `admin:delete` | Parent doesn't have `admin:*` |
| Child `maxSpend: 600` | Exceeds parent's remaining $500 |
| Child `exp: 2025-01-03` | Exceeds parent's `exp` |
| Child sets different `principal` | Principal is immutable |

## 6. Revocation

### 6.1 Cascade Rule

Revoking a passport revokes all descendants in the delegation chain. This is implemented via a parent→children registry: revoking ID X walks the tree and revokes every reachable descendant.

### 6.2 Revocation Check

Before authorizing any action, the authority checks if the passport ID (or any ancestor) appears in the revocation list.

### 6.3 Revocation is Immediate

Once revoked, a passport cannot be un-revoked. The authority must issue a new passport if access needs to be restored.

## 7. Authorization Flow

```
Agent → Authority: authorize(passportId, action, spendAmount)

Authority checks:
  1. Passport signature is valid
  2. Passport is not revoked (including ancestors)
  3. Current time is within [iat, exp]
  4. Action matches a permission (glob matching)
  5. spendAmount ≤ remaining budget

Authority → Agent: { allowed: true } or { allowed: false, reason: "..." }
```

### 7.1 Error Reasons

| Reason | Description |
|--------|-------------|
| `REVOKED` | Passport or an ancestor has been revoked |
| `EXPIRED` | Current time is past `exp` |
| `NOT_YET_VALID` | Current time is before `iat` |
| `PERMISSION_DENIED` | No matching permission for the requested action |
| `SPEND_LIMIT_EXCEEDED` | Requested spend exceeds remaining budget |
| `INVALID_SIGNATURE` | Signature verification failed |

### 7.2 Usage Example

```typescript
import { PassportIssuer } from '@passport-agent/core';

const issuer = new PassportIssuer();

// Issue a root passport
const passport = issuer.issue({
  principal: 'user:alice@company.com',
  agent: 'agent:booking-bot',
  permissions: ['calendar:read', 'calendar:write'],
  limits: { maxSpend: 100, currency: 'USD' },
  ttl: 3600000, // 1 hour
});

// Authorize an action
const result = issuer.authorize(passport, 'calendar:read', 0);
// → { allowed: true }

// Delegate to a sub-agent
const childPassport = issuer.delegate(passport, {
  agent: 'agent:room-finder',
  permissions: ['calendar:read'],
  limits: { maxSpend: 0 },
});

// Revoke (cascades to all children)
issuer.revoke(passport.payload.id);
```

## 8. Cryptographic Scheme

- **Algorithm**: Ed25519
- **Key format**: DER-encoded PKCS#8 (private), SPKI (public)
- **Signature input**: JSON-serialized payload (canonical, no whitespace formatting)
- **Encoding**: Hex-encoded signatures and public keys

### 8.1 Signature Verification

```
signature = Ed25519.sign(privateKey, JSON.stringify(payload))
valid = Ed25519.verify(publicKey, JSON.stringify(payload), signature)
```

The payload is serialized with `JSON.stringify()` (no indentation, no sorting). Implementations must preserve field order from the issuing authority to ensure deterministic signatures.

## 9. Wire Formats

### 9.1 Simple Mode (current)

Single signed JWT-like envelope. Suitable for single-hop and simple delegation chains.

The passport is transmitted as a JSON object in an HTTP header:

```
X-Agent-Passport: <base64url-encoded SignedPassport JSON>
```

### 9.2 Chain Mode (planned)

Biscuit token format with Datalog policy blocks. Each delegation appends an attenuation block. Suitable for deep delegation chains where each intermediate agent may be untrusted.

## 10. Framework Integration

### 10.1 MCP (Model Context Protocol)

The `@passport-agent/mcp` plugin intercepts tool calls and checks them against the agent's passport before execution. Tools are mapped to permissions via naming convention (`tool:<toolName>`) or custom mappers.

### 10.2 HTTP Middleware

The `@passport-agent/middleware` package provides Express/Fastify/Next.js middleware that extracts the passport from the `X-Agent-Passport` header, verifies it, and attaches the validated passport to the request object.

### 10.3 A2A (Agent-to-Agent)

The `@passport-agent/a2a` package extends Agent Cards with passport requirements, allowing agents to advertise required permissions and spend minimums for interaction.

### 10.4 LangChain

The `@passport-agent/langchain` package wraps LangChain tools with passport authorization, checking permissions before each tool invocation.

### 10.5 CrewAI

The `@passport-agent/crewai` package provides `PassportAgent` and `runPipeline` for multi-agent workflows with delegated passports.

## 11. Audit Trail

Every `authorize()` call produces an audit entry:

```json
{
  "id": "audit-entry-id",
  "passportId": "passport-id",
  "action": "calendar:write",
  "allowed": true,
  "reason": null,
  "spend": 10,
  "timestamp": 1719475200000
}
```

Audit logs are append-only and queryable by passport ID or time range. They provide a complete record of every action an agent attempted, whether authorized or denied.

## 12. Security Considerations

- Passports should be transmitted over TLS.
- Private keys must never leave the authority.
- Nonces prevent replay attacks.
- Signature verification on every `authorize()` call prevents tampering.
- Spend tracking is server-side to prevent client-side manipulation.
- Clock skew tolerance should be configurable (default: 0).
- Delegation chains should have a maximum depth (recommended: 10).
- Expired passports should be garbage-collected from the revocation list.
