# Agent Passport Check — GitHub Action

Validate agent passports in CI. Catch **expired tokens**, **scope escalation**, and **over-broad permissions** before they ship.

If your agents run on passports, this is your guardrail in the pipeline — the same policy engine that runs at runtime, run as a check on every PR.

## Usage

```yaml
- name: Validate agent passports
  uses: priyansh-x/agent-passport/github-action@v1
  with:
    policy-file: .passport/policy.json
    deny-wildcards: true
    max-risk: medium
```

## What it checks

| Check | What it catches |
|---|---|
| **Token format** | Malformed `ap1.*` tokens |
| **Expiry** | Passports already past their `exp` (toggle with `fail-on-expired`) |
| **Scope escalation** | A delegated passport granting permissions its parent never had |
| **Wildcards** | `*` or `resource:*` grants (toggle with `deny-wildcards`) |
| **Risk ceiling** | Permissions above `max-risk` (`low` / `medium` / `high`) |

Findings appear as inline GitHub annotations and fail the check on any violation.

## Inputs

| Input | Default | Description |
|---|---|---|
| `token` | `''` | A single passport token (`ap1.*`) to validate |
| `policy-file` | `.passport/policy.json` | JSON file of passport definitions or tokens |
| `deny-wildcards` | `false` | Fail on `*` / `resource:*` permissions |
| `max-risk` | `high` | Highest allowed permission risk |
| `fail-on-expired` | `true` | Fail on expired passports |

## Outputs

| Output | Description |
|---|---|
| `checked` | Number of passports inspected |
| `violations` | Number of violations found |

## Policy file format

An array, or `{ "passports": [...] }`. Each entry is either a raw `ap1.*` token string, or an inline definition:

```json
{
  "passports": [
    { "id": "root",  "agent": "agent:orchestrator", "permissions": ["calendar:read", "email:send"] },
    { "id": "child", "agent": "agent:drafter", "permissions": ["email:send"], "parent": "root" }
  ]
}
```

The `parent` field links a passport to its delegator — the action verifies the child's permissions are a strict subset (monotonic narrowing).

## Example: block escalation on every PR

```yaml
name: Agent Passport
on: [pull_request]
jobs:
  passport-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: priyansh-x/agent-passport/github-action@v1
        with:
          policy-file: .passport/policy.json
          deny-wildcards: true
          max-risk: medium
```

Part of [Agent Passport](https://github.com/priyansh-x/agent-passport) — authorization for AI agents. MIT.
