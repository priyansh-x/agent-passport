# @passport-agent/dashboard

Web UI for the Agent Passport authority server.

## Usage

Start the server and dashboard together from the monorepo root:

```bash
pnpm dev
```

Or run them separately:

```bash
# Terminal 1 — server on :3100
cd packages/server && pnpm dev

# Terminal 2 — dashboard on :3200
cd packages/dashboard && pnpm dev
```

Open [localhost:3200](http://localhost:3200).

## Pages

- **Passports** — list all issued passports, view status, revoke
- **Audit Log** — action history with allow/deny indicators
- **Issue** — consent form to issue new passports
