# Roadmap

## Phase 1 — Core Protocol (Current)
- [ ] Define passport token schema (TypeScript types)
- [ ] Implement Ed25519 signing/verification
- [ ] Build policy engine (permission matching, limit checks)
- [ ] JWT passport creation and validation
- [ ] In-memory revocation list
- [ ] Basic audit logging
- [ ] Unit tests for all core logic

## Phase 2 — SDK & DX
- [ ] Developer-facing `AgentPassport` class
- [ ] `passport.authorize()` middleware pattern
- [ ] `passport.delegate()` with monotonic narrowing
- [ ] Cascade revocation
- [ ] Error messages that help developers fix issues
- [ ] npm package setup

## Phase 3 — Multi-Agent Delegation
- [ ] Biscuit token support for chains
- [ ] Datalog policy evaluation
- [ ] Delegation depth limits
- [ ] Chain verification (walk full ancestry)
- [ ] Multi-agent demo (booking bot → email drafter → calendar checker)

## Phase 4 — Framework Integrations
- [ ] MCP middleware plugin
- [ ] LangChain tool wrapper
- [ ] CrewAI agent decorator
- [ ] A2A Agent Card extension

## Phase 5 — Passport Authority Server
- [ ] REST API for issue/revoke/verify
- [ ] Persistent storage (SQLite → Postgres)
- [ ] Human authorization UI (consent screen)
- [ ] Dashboard for audit trail
- [ ] Webhook notifications on revocation

## Phase 6 — Production Hardening
- [ ] Redis-backed revocation list
- [ ] Rate limiting on authority server
- [ ] Passport rotation / renewal
- [ ] SPIFFE/WIMSE identity binding
- [ ] Security audit
- [ ] Documentation site
