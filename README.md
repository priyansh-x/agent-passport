<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.svg"/>
    <img src=".github/logo.svg" width="80" alt="Agent Passport"/>
  </picture>
</p>

<h1 align="center">Agent Passport</h1>

<p align="center">
  <strong>Authorization for AI agents. 10 lines of code.</strong><br/>
  <em>Scoped permissions · Spend limits · Delegation chains · Instant revocation</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@passport-agent/sdk"><img src="https://img.shields.io/npm/v/@passport-agent/core?style=flat-square&color=black&label=npm" alt="npm"/></a>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT"/>
  <img src="https://img.shields.io/badge/crypto-Ed25519-purple?style=flat-square" alt="Ed25519"/>
  <img src="https://img.shields.io/badge/node-%3E%3D18-blue?style=flat-square" alt="Node 18+"/>
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> · 
  <a href="#how-it-works">How It Works</a> · 
  <a href="#delegation">Delegation</a> · 
  <a href="#server">Server</a> · 
  <a href="docs/api-reference.md">API Reference</a> · 
  <a href="docs/quickstart.md">Docs</a>
</p>

---

## Why

AI agents act on behalf of humans with zero guardrails. No standard way to scope *what* an agent can do, *how much* it can spend, or *when* to cut it off.

IETF AIMS handles agent **identity**. Agent Passport handles agent **authorization**.

## Quickstart

```bash
npm install @passport-agent/sdk @passport-agent/core
```

```typescript
import { AgentPassport } from '@passport-agent/sdk';

// Issue a passport — agent can read calendars and send emails, spend up to $500
const passport = AgentPassport.issue({
  principal: 'user:alice@company.com',
  agent: 'agent:booking-bot',
  permissions: ['calendar:read', 'calendar:write', 'email:send'],
  limits: { maxSpend: 500, currency: 'USD' },
});

passport.authorize('calendar:write');    // ✓ allowed
passport.authorize('database:drop');     // ✗ throws PassportDeniedError
```

That's it. Every action is checked, logged, and budget-tracked.

## How It Works

```
Human                    Agent Passport              Agent
  │                          │                         │
  │── "Book me a flight" ──▶ │                         │
  │                          │── issue passport ─────▶ │
  │                          │   [fly:book, $500 max]  │
  │                          │                         │
  │                          │   authorize("fly:book") │
  │                          │ ◀────────────────────── │
  │                          │── ✓ allowed ──────────▶ │
  │                          │                         │
  │                          │   authorize("db:drop")  │
  │                          │ ◀────────────────────── │
  │                          │── ✗ DENIED ───────────▶ │
  │                          │                         │
  │── "Stop everything" ───▶ │                         │
  │                          │── revoke (cascade) ───▶ ✗
```

Every passport is **Ed25519-signed**, **scoped** to specific actions, **budget-capped**, **time-bound**, and **chain-aware** with cascade revocation.

## Delegation

Agents delegate to sub-agents, but privileges **only narrow, never escalate**:

```typescript
const root = AgentPassport.issue({
  principal: 'user:alice@company.com',
  agent: 'agent:orchestrator',
  permissions: ['calendar:*', 'email:*', 'payment:charge'],
  limits: { maxSpend: 1000 },
});

// Sub-agent: email only, no spending
const emailAgent = root.delegate({
  agent: 'agent:email-drafter',
  permissions: ['email:send'],
  limits: { maxSpend: 0 },
});

// Can't escalate beyond parent — throws
root.delegate({
  agent: 'agent:rogue',
  permissions: ['admin:*'],  // ✗ not in parent's scope
});

// Revoke root → entire chain dies instantly
root.revoke();
```

## Builder API

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

## Policy Engine

Declarative authorization rules:

```typescript
import { policy } from '@passport-agent/core';

const authorize = policy()
  .requirePermission()
  .requireBudget()
  .timeWindow(9, 17)              // business hours only
  .denyActions('admin:delete')
  .build();

authorize(payload, 'invoices:read');  // { allowed: true }
```

## Token Format

Passports serialize to compact `ap1.*` tokens:

```typescript
const token = p.toToken();
// "ap1.eyJpZCI6Ij..." — send in headers, store in DB

const restored = AgentPassport.fromToken(token, issuer);
```

## Server

Run a local passport authority with SQLite persistence:

```bash
npx @passport-agent/server --port 3100 --db ./passports.db
```

```bash
# Issue
curl -X POST localhost:3100/v1/passports \
  -H 'Content-Type: application/json' \
  -d '{"principal":"user:alice","agent":"agent:bot","permissions":["read","write"],"limits":{"maxSpend":100}}'

# Authorize
curl -X POST localhost:3100/v1/passports/{id}/authorize \
  -d '{"action":"read"}'

# Revoke (cascades to all children)
curl -X POST localhost:3100/v1/passports/{id}/revoke
```

**Includes:** REST API (20+ endpoints), SQLite persistence, cascade revocation, spend tracking, delegation trees, audit logs, webhooks, Prometheus metrics, web dashboard.

## Framework Integrations

```typescript
// MCP — protect tool calls
import { PassportToolGuard } from '@passport-agent/mcp';
const guard = new PassportToolGuard({ issuer });
guard.guard(passport, 'read_file', args, handler);

// Express / Fastify / Next.js
import { expressPassport } from '@passport-agent/middleware';
app.use('/api', expressPassport({ issuer }));

// LangChain
import { withPassport } from '@passport-agent/langchain';
const tool = withPassport(myTool, passport, 'tool:execute');

// CrewAI
import { PassportAgent } from '@passport-agent/crewai';
const agent = new PassportAgent(baseAgent, passport);
```

## Packages

| Package | Description |
|---|---|
| [`@passport-agent/core`](packages/core) | Token creation, validation, policy engine, Ed25519 + Biscuit |
| [`@passport-agent/sdk`](packages/sdk) | Developer-facing API — issue, authorize, delegate, revoke |
| [`@passport-agent/server`](packages/server) | Authority server — REST API, SQLite, dashboard |
| [`@passport-agent/mcp`](packages/mcp-plugin) | MCP tool call authorization |
| [`@passport-agent/middleware`](packages/middleware) | Express, Fastify, Next.js middleware |
| [`@passport-agent/langchain`](packages/langchain) | LangChain tool wrapper |
| [`@passport-agent/crewai`](packages/crewai) | CrewAI agent decorator |
| [`@passport-agent/a2a`](packages/a2a) | A2A Agent Card extensions |

## Security Model

| Property | Guarantee |
|---|---|
| **Tamper-proof** | Ed25519 signatures on every `authorize()` |
| **No escalation** | Delegation only narrows (policy engine + Datalog) |
| **Cascade revocation** | Revoking a parent kills the entire subtree |
| **Replay protection** | 128-bit nonce per passport |
| **Budget enforcement** | Server-side spend tracking |
| **Time-bound** | Auto-expiry, child can't outlive parent |
| **Rate-limited** | Sliding-window rate limiter on authority server |

## What This Is NOT

- **Not identity** — SPIFFE/WIMSE handle "who is this agent?"
- **Not IAM** — Okta/Auth0 handle enterprise identity
- **Not a blockchain** — just cryptography where it matters

Agent Passport answers: **"Is this agent allowed to do this specific thing, right now, within these limits?"**

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). We use an RFC process for protocol changes.

## License

MIT
