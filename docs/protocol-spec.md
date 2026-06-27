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

### 4.2 Matching Rules

1. **Exact match**: `calendar:read` matches `calendar:read`
2. **Wildcard**: `calendar:*` matches `calendar:read`, `calendar:write`, etc.
3. **Global wildcard**: `*` matches everything

### 4.3 Spend Limits

Each passport has a `maxSpend` in a given `currency`. The authority tracks cumulative spend. When `currentSpent + requestedSpend > maxSpend`, the action is denied.

## 5. Delegation Rules (Monotonic Narrowing)

When creating a child passport from a parent:

1. **Permission subset**: Every child permission must be satisfiable by some parent permission.
2. **Spend cap**: Child `maxSpend` must be ≤ parent's remaining budget (`maxSpend - spent`).
3. **Time bound**: Child `exp` must be ≤ parent `exp`.
4. **Principal preserved**: Child inherits parent's `principal` (cannot change).
5. **Chain linkage**: Child's `parentId` is set to parent's `id`.

These rules are **invariants** — the protocol guarantees privileges can only narrow, never escalate.

## 6. Revocation

### 6.1 Cascade Rule

Revoking a passport revokes all descendants in the delegation chain. This is implemented via a parent→children registry: revoking ID X walks the tree and revokes every reachable descendant.

### 6.2 Revocation Check

Before authorizing any action, the authority checks if the passport ID (or any ancestor) appears in the revocation list.

## 7. Authorization Flow

```
Agent → Authority: authorize(passportId, action, spendAmount)

Authority checks:
  1. Passport signature is valid
  2. Passport is not revoked
  3. Current time is within [iat, exp]
  4. Action matches a permission (glob matching)
  5. spendAmount ≤ remaining budget

Authority → Agent: { allowed: true } or { allowed: false, reason: "..." }
```

## 8. Cryptographic Scheme

- **Algorithm**: Ed25519
- **Key format**: DER-encoded PKCS#8 (private), SPKI (public)
- **Signature input**: JSON-serialized payload (canonical, no whitespace formatting)
- **Encoding**: Hex-encoded signatures and public keys

## 9. Wire Formats

### 9.1 Simple Mode (current)

Single signed JWT-like envelope. Suitable for single-hop and simple delegation chains.

### 9.2 Chain Mode (planned)

Biscuit token format with Datalog policy blocks. Each delegation appends an attenuation block. Suitable for deep delegation chains where each intermediate agent may be untrusted.

## 10. Security Considerations

- Passports should be transmitted over TLS.
- Private keys must never leave the authority.
- Nonces prevent replay attacks.
- Signature verification on every authorize() call prevents tampering.
- Spend tracking is server-side to prevent client-side manipulation.
- Clock skew tolerance should be configurable (default: 0).
