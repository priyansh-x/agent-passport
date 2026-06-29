# Guide: Framework Integration

Agent Passport ships with plugins for MCP, LangChain, CrewAI, A2A, and generic HTTP middleware.

## MCP (Model Context Protocol)

Protect MCP tool calls with passport authorization.

```typescript
import { PassportIssuer } from '@passport-agent/core';
import { PassportToolGuard } from '@passport-agent/mcp';

const issuer = new PassportIssuer();
const guard = new PassportToolGuard({ issuer });

const passport = issuer.issue({
  principal: 'user:alice',
  agent: 'agent:mcp-client',
  permissions: ['tool:read_file', 'tool:search'],
  limits: { maxSpend: 0 },
});

// Guard a tool call
const content = guard.guard(
  passport, 'read_file', { path: '/data.csv' },
  () => fs.readFileSync('/data.csv', 'utf-8'),
);

// Using compact tokens instead of SignedPassport objects
const token = serializePassport(passport);
const result = guard.guardWithToken(token, 'search', { q: 'test' }, () => search('test'));

// Extract passport from HTTP Authorization header
const extracted = PassportToolGuard.fromHeader('Bearer ap1.eyJ...');
```

### Custom Permission Mapping

By default, tool names map to `tool:<name>`. Override with a custom mapper:

```typescript
const guard = new PassportToolGuard({
  issuer,
  permissionMapper: (toolName) => {
    if (toolName.startsWith('read_')) return 'data:read';
    if (toolName.startsWith('write_')) return 'data:write';
    return `tool:${toolName}`;
  },
});
```

## HTTP Middleware

### Express

```typescript
import express from 'express';
import { expressPassport } from '@passport-agent/middleware';

const app = express();

app.use('/api', expressPassport({
  issuer,
  extractAction: (method, path) => `${path.split('/')[2]}:${method.toLowerCase()}`,
}));

app.get('/api/users', (req, res) => {
  // Only reached if passport allows "users:get"
  res.json(users);
});
```

### Fastify

```typescript
import Fastify from 'fastify';
import { fastifyPassport } from '@passport-agent/middleware';

const app = Fastify();
app.register(fastifyPassport, { issuer });
```

### Next.js API Routes

```typescript
import { nextPassport } from '@passport-agent/middleware';

const handler = (req, res) => res.json({ ok: true });
export default nextPassport({ issuer })(handler);
```

### Sending Passports

The middleware accepts three header formats:

```
# JSON passport
x-agent-passport: {"payload":...,"signature":"...","publicKey":"..."}

# Compact token
x-agent-passport: ap1.eyJ...

# Bearer token
x-agent-passport: Bearer ap1.eyJ...
```

## LangChain

Wrap LangChain tools with passport checks:

```typescript
import { PassportIssuer } from '@passport-agent/core';
import { createPassportTool } from '@passport-agent/langchain';

const issuer = new PassportIssuer();
const passport = issuer.issue({
  principal: 'user:alice',
  agent: 'agent:langchain',
  permissions: ['search', 'calculator'],
  limits: { maxSpend: 50 },
});

const protectedSearch = createPassportTool(searchTool, {
  issuer,
  passport,
  permission: 'search',
});
```

## CrewAI

Multi-agent workflows with delegated passports:

```typescript
import { PassportAgent, runPipeline } from '@passport-agent/crewai';

const orchestrator = new PassportAgent({
  issuer,
  passport: rootPassport,
  role: 'orchestrator',
});

const researcher = orchestrator.delegate({
  role: 'researcher',
  permissions: ['search', 'read'],
  limits: { maxSpend: 0 },
});

await runPipeline([orchestrator, researcher], tasks);
```

## A2A (Agent-to-Agent)

Extend Agent Cards with passport requirements:

```typescript
import { createPassportAgentCard } from '@passport-agent/a2a';

const card = createPassportAgentCard({
  name: 'Booking Agent',
  requiredPermissions: ['calendar:write', 'purchase'],
  minSpendBudget: 100,
  issuer,
});
```
