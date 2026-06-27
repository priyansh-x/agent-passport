# Landscape Research

## Existing Standards (What We Build On Top Of)

### IETF AIMS (draft-klrc-aiagent-auth-02, June 2026)
- Composes WIMSE + SPIFFE + OAuth 2.0 for agent **authentication**
- Covers identity binding and credential rotation
- Authorization section is explicitly incomplete ("TODO Security")
- **Our gap:** the pre-action policy layer they don't address

### AIP — Agent Identity Protocol (arXiv:2603.24775, March 2026)
- Introduces Invocation-Bound Capability Tokens (IBCTs)
- JWT for single-hop, Biscuit tokens with Datalog for multi-hop
- MCP + A2A protocol bindings
- 0.22ms overhead on MCP calls
- **Closest prior art to what we're building. Key difference:** we focus on developer experience (SDK-first) while AIP is protocol-spec-first

### Auth0 for AI Agents (GA April 2026)
- Token Vault, On-Behalf-Of exchange, FGA for RAG
- Enterprise-grade, complex setup
- **Our gap:** they solve enterprise SSO; we solve the "10 lines of code" developer case

### Google A2A Protocol
- Agent-to-agent communication standard, 150+ orgs
- Agent Cards for capability discovery
- **Complementary:** we can ride on A2A for transport, add authorization layer

## The Gap We Fill

```
Identity layer:  SPIFFE / WIMSE / AIMS  ← "who is this agent?"
                        ↓
>>> AGENT PASSPORT <<<                  ← "is this agent allowed to do THIS?"
                        ↓
Action layer:    MCP / A2A / APIs       ← "do the thing"
```

Nobody owns the middle layer in a developer-friendly way.

## Market Numbers
- NHIs outnumber humans 40:1 in enterprises (some report 144:1)
- NHI growth: 40%+ annually
- EU AI Act high-risk requirements: August 2, 2026
- $23B emerging market segment

## Token Format Decision

| Option | Single-hop | Multi-hop | Datalog policies | Maturity |
|--------|-----------|-----------|-----------------|----------|
| JWT | Great | Bad (nested = bloat) | No | Very mature |
| Biscuit | Good | Great (append-only) | Yes | Growing |
| **Our approach** | JWT | Biscuit | Yes | Best of both |

We use JWT for simple single-hop (most developers), Biscuit for delegation chains (advanced).
