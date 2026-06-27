# Agent Passport

## What is this?
An open protocol + TypeScript SDK that gives AI agents cryptographically verifiable delegation envelopes. The "Stripe for agent auth" — simple DX, serious security underneath.

## Core Concept
Before an agent calls a tool or API, it must present a **passport** — a signed token proving:
- Which human authorized it
- What it's allowed to do (scoped permissions)
- Spend/rate limits and time windows
- That privileges only narrow, never escalate (monotonic scope narrowing)

## Tech Stack
- **Language:** TypeScript (Node.js)
- **Token Format:** JWT (single-hop) + Biscuit tokens with Datalog policies (multi-hop delegation chains)
- **Crypto:** Ed25519 signing
- **Framework Bindings:** MCP, A2A, LangChain, CrewAI
- **Package Manager:** pnpm
- **Monorepo:** Turborepo

## Project Structure
```
packages/
  core/          — token creation, validation, policy engine
  sdk/           — developer-facing API (npm install @passport-agent/sdk)
  server/        — passport authority service (issue, revoke, audit)
  mcp-plugin/    — MCP middleware integration
examples/
  basic/         — minimal usage
  multi-agent/   — delegation chain demo
docs/            — protocol spec, guides
```

## Key Commands
```bash
pnpm install          # install deps
pnpm build            # build all packages
pnpm test             # run tests
pnpm dev              # start dev server
```

## Architecture Decisions
- Tokens are append-only chains (can't escalate, only narrow)
- Sub-agent gets a derived passport with <= parent's permissions
- Revocation cascades: revoking a parent kills all children
- Every action logged to audit trail with passport ID
