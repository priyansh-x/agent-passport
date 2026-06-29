<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/Agent_Passport-white?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkw0IDZ2NmMwIDUuNTUgMy44NCAxMC43NCAxMiAxMiA4LjE2LTEuMjYgMTItNi40NSAxMi0xMlY2TDEyIDJ6IiBmaWxsPSIjMEQ5NDg4Ii8+PC9zdmc+"/>
    <img src="https://img.shields.io/badge/Agent_Passport-black?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkw0IDZ2NmMwIDUuNTUgMy44NCAxMC43NCAxMiAxMiA4LjE2LTEuMjYgMTItNi40NSAxMi0xMlY2TDEyIDJ6IiBmaWxsPSIjMEQ5NDg4Ii8+PC9zdmc+" alt="Agent Passport"/>
  </picture>
</p>

<p align="center">
  <strong>Cryptographic authorization for AI agents.</strong><br/>
  Scoped permissions · Spend limits · Delegation chains · Instant revocation<br/>
  <em>The missing authorization layer between humans and autonomous agents.</em>
</p>

<p align="center">
  <a href="https://github.com/priyansh-x/agent-passport/actions"><img src="https://img.shields.io/github/actions/workflow/status/priyansh-x/agent-passport/ci.yml?style=flat-square&label=CI" alt="CI" /></a>
  <img src="https://img.shields.io/badge/protocol-v0.1-blue?style=flat-square" alt="Protocol v0.1" />
  <img src="https://img.shields.io/npm/v/@passport-agent/core?style=flat-square&color=black" alt="npm" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/badge/crypto-Ed25519-purple?style=flat-square" alt="Ed25519" />
  <img src="https://img.shields.io/badge/tokens-Biscuit%20%2B%20JWT-orange?style=flat-square" alt="Biscuit + JWT" />
</p>

<p align="center">
  <a href="#10-lines-to-production">Quickstart</a> · <a href="https://priyansh-x.github.io/agent-passport/docs">Docs</a> · <a href="#packages">Packages</a> · <a href="#architecture">Architecture</a> · <a href="CONTRIBUTING.md">Contributing</a>
</p>

<br/>

## The Problem

AI agents are acting on behalf of humans with **zero guardrails**:

- **97%** of deployed agents are over-permissioned
- **53%** use static API keys copied from human credentials  
- No standard way to scope *what* an agent can do, *how much* it can spend, or *when* to cut it off
- Agent-to-agent delegation? Just vibes and trust

IETF AIMS handles agent *identity*. Agent Passport handles agent *authorization*.

## 10 Lines to Production

```bash
npm install @passport-agent/sdk
```

```typescript
import { AgentPassport } from '@passport-agent/sdk';

const passport = AgentPassport.issue({
  principal: 'user:alice@company.com',
  agent: 'agent:booking-bot',
  permissions: ['calendar:read', 'calendar:write', 'email:send'],
  limits: { maxSpend: 500, currency: 'USD' },
  expiresIn: 24 * 60 * 60 * 1000,
});

passport.authorize('calendar:write');       // ok
passport.authorize('database:drop');        // throws PassportDeniedError
```

## How It Works

```
Human                    Agent Passport              Agent
  |                          |                         |
  |-- "Book me a flight" --> |                         |
  |                          |-- issue passport -----> |
  |                          |   [fly:book, $500 max]  |
  |                          |                         |
  |                          |   authorize("fly:book") |
  |                          | <---------------------- |
  |                          |-- allowed ------------> |
  |                          |                         |
  |                          |   authorize("db:drop")  |
  |                          | <---------------------- |
  |                          |-- DENIED -------------> |
  |                          |                         |
  |-- "Stop everything" --> |                          |
  |                          |-- revoke (cascade) ---> X
```

Every passport is:

- **Signed** with Ed25519 (tamper-proof)
- **Scoped** to specific actions (permission allow-list)
- **Budget-capped** (spend tracking per passport)
- **Time-bound** (automatic expiration)
- **Chain-aware** (delegation trees with cascade revocation)

## Multi-Agent Delegation

Agents can delegate to sub-agents, but privileges **only narrow, never escalate**:

```typescript
// Root agent has broad permissions
const root = AgentPassport.issue({
  principal: 'user:alice@company.com',
  agent: 'agent:orchestrator',
  permissions: ['calendar:*', 'email:*', 'payment:charge'],
  limits: { maxSpend: 1000 },
});

// Sub-agent gets strictly fewer permissions
const emailAgent = root.delegate({
  agent: 'agent:email-drafter',
  permissions: ['email:send'],      // calendar, payment stripped
  limits: { maxSpend: 0 },          // no spending allowed
});

// This throws - can't escalate beyond parent
root.delegate({
  agent: 'agent:rogue',
  permissions: ['admin:*'],          // not in parent's permissions
});

// Revoke root = entire chain dies
root.revoke();  // orchestrator, email-drafter all revoked
```

## Biscuit Tokens (Datalog Policy Engine)

For deep delegation chains where intermediate agents may be untrusted, Agent Passport supports [Biscuit tokens](https://www.biscuitsec.org/) with Datalog policy enforcement:

```typescript
import { BiscuitIssuer } from '@passport-agent/core';

const issuer = new BiscuitIssuer();

const token = issuer.issue({
  id: 'passport-1',
  sub: 'agent:bot',
  principal: 'user:alice',
  permissions: [{ action: 'read' }, { action: 'write' }],
  // ... other fields
});

// Attenuate: add Datalog checks that restrict the token
const restricted = issuer.attenuate(token.token, {
  // ... narrower permissions
  permissions: [{ action: 'read' }],  // write stripped via Datalog check
});

// Datalog policy prevents escalation cryptographically
issuer.authorize(restricted.token, 'write');  // { allowed: false }
```

## Framework Integrations

### MCP (Model Context Protocol)

```typescript
import { PassportToolGuard } from '@passport-agent/mcp';

const guard = new PassportToolGuard(server, {
  permissions: {
    'read_file': ['files:read'],
    'send_email': ['email:send'],
  },
});
// Tools are now passport-protected
```

### Express / Fastify / Next.js

```typescript
import { expressPassport } from '@passport-agent/middleware';

app.use('/api', expressPassport({
  issuer,
  // Auto-extracts action from method + path: GET /api/users → api:users:get
}));
```

### LangChain

```typescript
import { withPassport } from '@passport-agent/langchain';

const protectedTool = withPassport(myTool, passport, 'tool:execute');
```

### CrewAI

```typescript
import { PassportAgent } from '@passport-agent/crewai';

const agent = new PassportAgent(baseAgent, passport);
// All tool calls now require passport authorization
```

## Passport Authority Server

Run a local authority with SQLite persistence, REST API, and web dashboard:

```bash
npx @passport-agent/server
```

```
  ╔══════════════════════════════════════════╗
  ║   Agent Passport Authority Server        ║
  ╠══════════════════════════════════════════╣
  ║  http://localhost:3100                   ║
  ╚══════════════════════════════════════════╝
```

**REST API:**

```bash
# Issue a passport
curl -X POST localhost:3100/v1/passports \
  -H 'Content-Type: application/json' \
  -d '{"principal":"user:alice","agent":"agent:bot","permissions":["read","write"],"limits":{"maxSpend":100}}'

# Authorize an action
curl -X POST localhost:3100/v1/passports/{id}/authorize \
  -d '{"action":"read"}'

# Token introspection (RFC 7662-style)
curl -X POST localhost:3100/v1/passports/{id}/introspect

# Cascade revocation
curl -X POST localhost:3100/v1/passports/{id}/revoke

# Full audit trail
curl localhost:3100/v1/passports/{id}/audit
```

**Features:** Persistent SQLite storage, cascade revocation, spend tracking, delegation trees, audit logs, token introspection.

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  Your Application                 │
├──────────────┬───────────────┬────────────────────┤
│   LangChain  │    CrewAI     │      A2A           │
│   Wrapper    │   Decorator   │   Agent Card       │
├──────────────┴───────────────┴────────────────────┤
│              @passport-agent/sdk                   │
│         AgentPassport.issue / authorize / delegate  │
├───────────────────────────────────────────────────┤
│              @passport-agent/core                  │
│   Ed25519 Signing  │  Policy Engine  │  Biscuit    │
├───────────────────────────────────────────────────┤
│           @passport-agent/server                   │
│   REST API  │  SQLite  │  Audit Log  │  Dashboard  │
└───────────────────────────────────────────────────┘
```

## Packages

| Package | Description |
|---|---|
| [`@passport-agent/core`](https://www.npmjs.com/package/@passport-agent/core) | Token creation, validation, policy engine, Biscuit support |
| [`@passport-agent/sdk`](https://www.npmjs.com/package/@passport-agent/sdk) | Developer-facing API — the main entry point |
| [`@passport-agent/server`](https://www.npmjs.com/package/@passport-agent/server) | Authority server with REST API, SQLite, dashboard |
| [`@passport-agent/mcp`](https://www.npmjs.com/package/@passport-agent/mcp) | MCP middleware for tool call authorization |
| [`@passport-agent/middleware`](https://www.npmjs.com/package/@passport-agent/middleware) | Express, Fastify, Next.js middleware |
| [`@passport-agent/langchain`](https://www.npmjs.com/package/@passport-agent/langchain) | LangChain tool wrapper |
| [`@passport-agent/crewai`](https://www.npmjs.com/package/@passport-agent/crewai) | CrewAI agent decorator |
| [`@passport-agent/a2a`](https://www.npmjs.com/package/@passport-agent/a2a) | A2A Agent Card extensions |

## Fluent Builder API

```typescript
import { passport } from '@passport-agent/sdk';

const p = passport()
  .for('user:alice@company.com')
  .agent('agent:finance-bot')
  .allow('invoices:read', 'invoices:create', 'payment:charge')
  .budget(1000, 'USD')
  .expiresInHours(8)
  .build();
```

## Token Serialization

Passports serialize to compact `ap1.*` tokens for transport:

```typescript
const token = p.toToken();
// "ap1.eyJpZCI6Ij..." (base64url-encoded)

const restored = AgentPassport.fromToken(token, issuer);
```

## Custom Policy Engine

```typescript
import { policy } from '@passport-agent/core';

const authorize = policy()
  .requirePermission()
  .requireNotExpired()
  .requireBudget()
  .denyActions('admin:delete')
  .timeWindow(9, 17) // Business hours only (UTC)
  .build();

authorize(passport.payload, 'invoices:read'); // { allowed: true }
```

## Security Model

| Property | Guarantee |
|---|---|
| **Tamper-proof** | Ed25519 signatures verified on every `authorize()` call |
| **No escalation** | Delegation only narrows permissions (enforced by policy engine + Datalog) |
| **Cascade revocation** | Revoking a parent kills the entire delegation subtree |
| **Replay protection** | 128-bit nonce per passport |
| **Budget enforcement** | Server-side spend tracking (clients can't lie about spending) |
| **Time-bound** | Automatic expiration, child can't outlive parent |
| **Depth-limited** | Max 10-level delegation chains, max 50 permissions per passport |
| **Rate-limited** | Built-in sliding-window rate limiter on the authority server |

## What Agent Passport Is NOT

- **Not an identity protocol** — SPIFFE/WIMSE handle "who is this agent?"
- **Not an IAM tool** — Okta/Auth0 handle enterprise identity management
- **Not a blockchain** — just cryptography where it matters

Agent Passport answers one question: **"Is this agent allowed to do this specific thing, right now, within these limits?"**

## Documentation

Full documentation is available at [priyansh-x.github.io/agent-passport/docs](https://priyansh-x.github.io/agent-passport/docs) — covers installation, permissions model, delegation chains, spend limits, framework integrations, API reference, and the protocol spec.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). We use an RFC process for protocol changes.

## License

MIT
