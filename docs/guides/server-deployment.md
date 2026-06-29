# Guide: Server Deployment

How to run the Agent Passport authority server in production.

## Quick Start

```bash
npx @passport-agent/server --port 3100 --db ./passports.db --cors
```

This starts a Hono-based HTTP server with SQLite persistence, CORS enabled, and request logging.

## CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `3100` | HTTP port |
| `--db` | `:memory:` | SQLite database path (use a file path for persistence) |
| `--cors` | `false` | Enable CORS headers |
| `--help` | — | Show help |

## Programmatic Usage

```typescript
import { PassportIssuer } from '@passport-agent/core';
import { createApi, PassportDB } from '@passport-agent/server';

const issuer = new PassportIssuer();
const db = new PassportDB('./data/passports.db');

const app = createApi(issuer, db, {
  cors: true,
  logger: { skip: (path) => path === '/health' },
});

// app is a Hono instance — deploy to any runtime
export default app; // Bun/Deno
```

## Monitoring

### Health Check

```bash
curl http://localhost:3100/health
```

Returns DB latency, uptime, and component status. Use for load balancer health probes.

### Prometheus Metrics

```bash
curl http://localhost:3100/metrics
```

Exposes: `passport_total`, `passport_active`, `authorization_total`, `authorization_allowed`, `authorization_denied`, `spend_total`, `delegation_total`.

### Stats Dashboard

```bash
curl http://localhost:3100/v1/stats
```

JSON aggregate statistics for the dashboard UI.

## Webhooks

Subscribe to lifecycle events for real-time integrations:

```bash
curl -X POST http://localhost:3100/v1/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/passport-events",
    "events": ["passport.issued", "passport.revoked", "passport.denied"],
    "secret": "whsec_your_signing_secret"
  }'
```

Webhook payloads include an `X-Passport-Signature` HMAC-SHA256 header for verification.

## Backup

The server uses SQLite with WAL mode. To back up:

```typescript
import { backupDatabase, listBackups } from '@passport-agent/server';

backupDatabase('./passports.db', './backups');
const backups = listBackups('./backups');
```

Or use SQLite's built-in backup: `sqlite3 passports.db ".backup backup.db"`

## Data Export

Export all passport data as JSON for migration:

```bash
curl http://localhost:3100/v1/export
```

## Security Checklist

- [ ] Use HTTPS in production (reverse proxy with TLS)
- [ ] Set `--db` to a persistent file path
- [ ] Enable API key authentication for admin endpoints
- [ ] Configure webhook secrets for HMAC verification
- [ ] Set up monitoring on `/health` and `/metrics`
- [ ] Regular backups of the SQLite database
- [ ] Rate limiting is enabled by default (100 req/min per IP)
