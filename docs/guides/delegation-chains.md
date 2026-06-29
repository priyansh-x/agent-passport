# Guide: Delegation Chains

Delegation chains let a parent agent create child agents with narrower permissions. This is the core security primitive in Agent Passport — privileges can only decrease, never escalate.

## Basic Delegation

```typescript
import { PassportIssuer } from '@passport-agent/core';

const issuer = new PassportIssuer();

// Root passport: full access
const root = issuer.issue({
  principal: 'user:alice@company.com',
  agent: 'agent:orchestrator',
  permissions: ['calendar:*', 'email:send', 'purchase'],
  limits: { maxSpend: 500, currency: 'USD' },
});

// Child: can only read calendars, no spending
const reader = issuer.delegate(root, {
  agent: 'agent:calendar-reader',
  permissions: ['calendar:read'],
  limits: { maxSpend: 0 },
});

// Grandchild: even narrower
const roomFinder = issuer.delegate(reader, {
  agent: 'agent:room-finder',
  permissions: ['calendar:read'],
  limits: { maxSpend: 0 },
  expiresIn: 5 * 60 * 1000, // 5 minutes only
});
```

## What Gets Enforced

Every delegation is checked against five invariants:

1. **Permission subset** — child permissions must be satisfiable by parent
2. **Spend cap** — child `maxSpend ≤ parent maxSpend`
3. **Time bound** — child `exp ≤ parent exp`
4. **Principal preserved** — cannot change the authorizing human
5. **Chain linkage** — `parentId` is set automatically

Violations throw an error:

```typescript
try {
  issuer.delegate(reader, {
    agent: 'agent:hacker',
    permissions: ['admin:delete'], // NOT in parent
    limits: { maxSpend: 0 },
  });
} catch (e) {
  // "Cannot delegate: permission 'admin:delete' not in parent scope"
}
```

## Validating a Chain

Use `validateChain` to verify an entire delegation path:

```typescript
import { validateChain } from '@passport-agent/core';

const result = validateChain([root, reader, roomFinder], {
  isRevoked: (id) => db.isRevoked(id),
});

if (!result.valid) {
  for (const link of result.links) {
    if (!link.valid) console.log(`Link ${link.depth}: ${link.reason}`);
  }
}
```

## Cascade Revocation

Revoking a parent kills all descendants:

```typescript
const revoked = issuer.revoke(root.payload.id);
// revoked = [root.id, reader.id, roomFinder.id]
```

## Visualizing the Tree

The server provides a tree endpoint:

```bash
curl http://localhost:3100/v1/passports/{rootId}/tree
```

```json
{
  "id": "abc123",
  "agent": "agent:orchestrator",
  "permissions": ["calendar:*", "email:send", "purchase"],
  "children": [
    {
      "id": "def456",
      "agent": "agent:calendar-reader",
      "permissions": ["calendar:read"],
      "children": [
        {
          "id": "ghi789",
          "agent": "agent:room-finder",
          "permissions": ["calendar:read"],
          "children": []
        }
      ]
    }
  ]
}
```

## Best Practices

- **Principle of least privilege** — give each agent only what it needs
- **Short TTLs** — use `expiresIn` aggressively, especially for leaf agents
- **Zero spend for readers** — if an agent doesn't need to spend, set `maxSpend: 0`
- **Depth limit** — keep chains shallow (< 5 levels) for auditability
