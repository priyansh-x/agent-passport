# Contributing to Agent Passport

Thanks for your interest in contributing! This project uses a **BDFL + RFC** governance model.

## Quick Start

```bash
git clone https://github.com/priyansh-x/agent-passport.git
cd agent-passport
pnpm install
pnpm build
pnpm test
```

## Development Workflow

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add a changeset: `pnpm changeset`
4. Run `pnpm test` and `pnpm lint`
5. Open a PR

## Proposing Changes (RFC Process)

For non-trivial changes (new features, protocol modifications, API changes):

1. Open an issue using the **RFC** template
2. Community discusses in the issue
3. BDFL (@priyansh-x) makes the final decision
4. Once accepted, implementation PRs are welcome

## Code Style

- TypeScript, strict mode
- No `any` types
- Write tests for all new code
- Security-critical code requires 100% coverage

## Commit Messages

Use conventional commits:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `test:` adding tests
- `chore:` maintenance

## Developer Certificate of Origin (DCO)

By contributing, you certify that your contribution is your original work and you have the right to submit it under the MIT license. Sign off your commits:

```
git commit -s -m "feat: add thing"
```

## Questions?

Open an issue or start a discussion. We're friendly.
