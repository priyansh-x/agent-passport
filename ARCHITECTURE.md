# Architecture

## System Overview

```
┌─────────────────────────────────────────────────┐
│                  Human Principal                 │
│              (alice@company.com)                  │
└──────────────────┬──────────────────────────────┘
                   │ authorizes
                   ▼
┌─────────────────────────────────────────────────┐
│            Passport Authority                    │
│  ┌───────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  Issuer   │ │ Revoker  │ │  Audit Log    │  │
│  └───────────┘ └──────────┘ └───────────────┘  │
└──────────────────┬──────────────────────────────┘
                   │ issues passport
                   ▼
┌─────────────────────────────────────────────────┐
│              Root Agent                          │
│  passport: [calendar:*, email:send, $500 limit] │
│                                                  │
│  ┌─ delegates ──────────────────────────┐       │
│  ▼                                      ▼       │
│  Sub-Agent A                    Sub-Agent B      │
│  [email:send, $0 limit]        [calendar:read]  │
│  (narrowed passport)           (narrowed)        │
└─────────────────────────────────────────────────┘
```

## Core Components

### 1. Passport (Token)
A signed envelope containing:
- `iss` — passport authority that issued it
- `sub` — the agent receiving the passport
- `principal` — the human who authorized it
- `permissions` — allow-list of actions
- `limits` — spend caps, rate limits
- `exp` — expiration timestamp
- `chain` — parent passport ID (for delegation)
- `nonce` — replay protection

### 2. Policy Engine
Evaluates every action request against the passport:
```
request(agent, action, context) → allow | deny + reason
```
Rules:
- Action must be in permissions list (glob matching)
- Spend must be within remaining limits
- Current time must be within validity window
- Passport must not be revoked
- For delegated passports: action must also be allowed by every ancestor

### 3. Passport Authority (Server)
- Issues passports after human authorization
- Maintains revocation list
- Stores audit trail
- Exposes API for verification

### 4. SDK
Developer-facing wrapper:
- `AgentPassport.issue()` — create a passport
- `passport.authorize()` — check before acting
- `passport.delegate()` — create child passport
- `passport.revoke()` — kill passport + all children

## Key Invariants

1. **Monotonic narrowing:** child.permissions ⊆ parent.permissions, always
2. **Cascade revocation:** revoking parent revokes all descendants
3. **Append-only chains:** delegation chain can only grow, never shrink
4. **No ambient authority:** every action requires explicit passport check

## Token Wire Formats

**Simple mode (JWT):** For single agent, no delegation
```
Header.Payload.Signature
```

**Chain mode (Biscuit):** For multi-agent delegation
```
Authority block (root passport)
  → Attenuation block 1 (sub-agent A narrowing)
    → Attenuation block 2 (sub-sub-agent narrowing)
```

## Framework Integration Points

| Framework | Integration | How |
|-----------|------------|-----|
| MCP | Middleware | Intercept tool calls, check passport |
| A2A | Agent Card extension | Passport requirements in discovery |
| LangChain | Tool wrapper | Wrap tools with passport.authorize() |
| CrewAI | Agent decorator | Inject passport into agent lifecycle |
