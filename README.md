# Agent Passport

**The Stripe for agent authorization.**

Give every AI agent a cryptographically verifiable passport before it acts on behalf of humans.

```typescript
import { AgentPassport } from '@passport-agent/sdk';

// Human authorizes an agent with scoped permissions
const passport = await AgentPassport.issue({
  principal: 'user:alice@company.com',
  agent: 'agent:booking-bot',
  permissions: ['calendar:read', 'calendar:write', 'email:send'],
  limits: { maxSpend: 500, currency: 'USD' },
  expiresIn: '24h',
});

// Agent presents passport before every action
const result = await passport.authorize('calendar:write', {
  action: 'book_meeting',
  metadata: { attendees: 3, cost: 0 },
});

// Sub-agent gets narrower passport (can never escalate)
const subPassport = await passport.delegate('agent:email-drafter', {
  permissions: ['email:send'], // subset only
  limits: { maxSpend: 0 },
});
```

## The Problem

- 97% of deployed agents are over-permissioned
- 53% use static API keys shared from human credentials
- No standard way to prove what an agent can do, for whom, within what limits
- IETF AIMS covers authentication but authorization is still "TODO"

## What Agent Passport Does

| Feature | How |
|---|---|
| Human-authorized delegation | Passport tied to a specific principal |
| Scoped permissions | Allow-list of actions, spend limits, time windows |
| Monotonic narrowing | Sub-agents can only get fewer permissions |
| Instant revocation | Cascade down the entire delegation chain |
| Full audit trail | Every action logged with passport ID + chain |

## What It Is NOT

- Not an identity protocol (SPIFFE/WIMSE handle that)
- Not an enterprise IAM tool (Okta/Auth0 handle that)
- Not a blockchain thing

Agent Passport fills the gap between "who is this agent?" (identity) and "should this agent do this specific thing right now?" (pre-action policy).

## Status

Early development. Protocol spec and core SDK in progress.

## License

MIT
