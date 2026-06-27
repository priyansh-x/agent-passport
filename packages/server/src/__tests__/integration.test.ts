import { describe, it, expect, beforeEach } from 'vitest';
import { PassportIssuer } from '@agent-passport/core';
import { createApi } from '../api.js';
import { PassportDB } from '../db.js';

describe('Integration: Full Agent Lifecycle', () => {
  let app: ReturnType<typeof createApi>;
  let db: PassportDB;

  beforeEach(() => {
    const issuer = new PassportIssuer();
    db = new PassportDB(':memory:');
    app = createApi(issuer, db);
  });

  async function req(method: string, path: string, body?: unknown) {
    const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) init.body = JSON.stringify(body);
    return app.request(path, init);
  }

  it('agent issues passport, authorizes actions, exhausts budget, gets denied', async () => {
    // 1. Issue passport with $50 budget
    const issue = await req('POST', '/v1/passports', {
      principal: 'user:alice@acme.com',
      agent: 'agent:shopping-bot',
      permissions: ['purchase', 'browse'],
      limits: { maxSpend: 50 },
    });
    expect(issue.status).toBe(201);
    const { id } = await issue.json();

    // 2. Browse (no spend) — allowed
    const browse = await req('POST', `/v1/passports/${id}/authorize`, { action: 'browse' });
    expect((await browse.json()).allowed).toBe(true);

    // 3. Purchase $30 — allowed
    const buy1 = await req('POST', `/v1/passports/${id}/authorize`, { action: 'purchase', spendAmount: 30 });
    const buy1Data = await buy1.json();
    expect(buy1Data.allowed).toBe(true);
    expect(buy1Data.remaining).toBe(20);

    // 4. Purchase $25 — denied (exceeds remaining)
    const buy2 = await req('POST', `/v1/passports/${id}/authorize`, { action: 'purchase', spendAmount: 25 });
    expect((await buy2.json()).allowed).toBe(false);

    // 5. Purchase $20 — allowed (exact remaining)
    const buy3 = await req('POST', `/v1/passports/${id}/authorize`, { action: 'purchase', spendAmount: 20 });
    expect((await buy3.json()).allowed).toBe(true);

    // 6. Introspect shows fully spent
    const introspect = await req('POST', `/v1/passports/${id}/introspect`);
    const state = await introspect.json();
    expect(state.limits.spent).toBe(50);
    expect(state.limits.remaining).toBe(0);

    // 7. Audit log has all 4 authorize events
    const audit = await req('GET', `/v1/passports/${id}/audit`);
    const { entries } = await audit.json();
    expect(entries).toHaveLength(4);
    expect(entries.filter((e: { allowed: number }) => e.allowed).length).toBe(3);
    expect(entries.filter((e: { allowed: number }) => !e.allowed).length).toBe(1);
  });

  it('multi-agent delegation chain with cascade revocation', async () => {
    // 1. Root agent gets broad permissions
    const root = await req('POST', '/v1/passports', {
      principal: 'user:admin@corp.com',
      agent: 'agent:orchestrator',
      permissions: ['email:read', 'email:send', 'calendar:read', 'calendar:write'],
      limits: { maxSpend: 1000 },
    });
    const { id: rootId } = await root.json();

    // 2. Delegate to email agent (narrower scope)
    const emailAgent = await req('POST', `/v1/passports/${rootId}/delegate`, {
      agent: 'agent:email-handler',
      permissions: ['email:read', 'email:send'],
      limits: { maxSpend: 200 },
    });
    expect(emailAgent.status).toBe(201);
    const { id: emailId } = await emailAgent.json();

    // 3. Delegate to calendar agent (different scope)
    const calAgent = await req('POST', `/v1/passports/${rootId}/delegate`, {
      agent: 'agent:calendar-bot',
      permissions: ['calendar:read'],
      limits: { maxSpend: 0 },
    });
    const { id: calId } = await calAgent.json();

    // 4. Email agent can read email
    const emailRead = await req('POST', `/v1/passports/${emailId}/authorize`, { action: 'email:read' });
    expect((await emailRead.json()).allowed).toBe(true);

    // 5. Email agent cannot access calendar
    const emailCal = await req('POST', `/v1/passports/${emailId}/authorize`, { action: 'calendar:read' });
    expect((await emailCal.json()).allowed).toBe(false);

    // 6. Calendar agent can read calendar
    const calRead = await req('POST', `/v1/passports/${calId}/authorize`, { action: 'calendar:read' });
    expect((await calRead.json()).allowed).toBe(true);

    // 7. Calendar agent cannot write calendar (narrowed away)
    const calWrite = await req('POST', `/v1/passports/${calId}/authorize`, { action: 'calendar:write' });
    expect((await calWrite.json()).allowed).toBe(false);

    // 8. Revoke root — cascades to both children
    const revoke = await req('POST', `/v1/passports/${rootId}/revoke`);
    const revokeData = await revoke.json();
    expect(revokeData.revoked).toContain(rootId);
    expect(revokeData.revoked).toContain(emailId);
    expect(revokeData.revoked).toContain(calId);

    // 9. All three show as revoked
    for (const id of [rootId, emailId, calId]) {
      const verify = await req('POST', `/v1/passports/${id}/verify`);
      const data = await verify.json();
      expect(data.valid).toBe(false);
      expect(data.revoked).toBe(true);
    }

    // 10. Authorizing on revoked passport is denied
    const postRevoke = await req('POST', `/v1/passports/${emailId}/authorize`, { action: 'email:read' });
    expect((await postRevoke.json()).allowed).toBe(false);
  });

  it('escalation prevention in delegation', async () => {
    // 1. Issue with limited permissions
    const parent = await req('POST', '/v1/passports', {
      principal: 'user:bob@corp.com',
      agent: 'agent:reader',
      permissions: ['files:read'],
      limits: { maxSpend: 100 },
    });
    const { id: parentId } = await parent.json();

    // 2. Try to delegate with more permissions — should fail
    const escalate = await req('POST', `/v1/passports/${parentId}/delegate`, {
      agent: 'agent:writer',
      permissions: ['files:read', 'files:write'],
    });
    expect(escalate.status).toBe(400);
    const error = await escalate.json();
    expect(error.error).toContain('subset');

    // 3. Try to delegate with higher spend — should fail
    const overspend = await req('POST', `/v1/passports/${parentId}/delegate`, {
      agent: 'agent:spender',
      permissions: ['files:read'],
      limits: { maxSpend: 200 },
    });
    expect(overspend.status).toBe(400);

    // 4. Valid delegation with narrower scope succeeds
    const valid = await req('POST', `/v1/passports/${parentId}/delegate`, {
      agent: 'agent:narrow-reader',
      permissions: ['files:read'],
      limits: { maxSpend: 50 },
    });
    expect(valid.status).toBe(201);
  });

  it('passport list and global audit across multiple agents', async () => {
    // Issue 3 passports
    const ids: string[] = [];
    for (const agent of ['agent:a', 'agent:b', 'agent:c']) {
      const res = await req('POST', '/v1/passports', {
        principal: 'user:admin',
        agent,
        permissions: ['read'],
      });
      ids.push((await res.json()).id);
    }

    // Authorize some actions
    await req('POST', `/v1/passports/${ids[0]}/authorize`, { action: 'read' });
    await req('POST', `/v1/passports/${ids[1]}/authorize`, { action: 'read' });
    await req('POST', `/v1/passports/${ids[1]}/authorize`, { action: 'write' }); // denied
    await req('POST', `/v1/passports/${ids[2]}/authorize`, { action: 'read' });

    // List all passports
    const list = await req('GET', '/v1/passports');
    const { passports } = await list.json();
    expect(passports).toHaveLength(3);

    // Global audit shows all actions
    const audit = await req('GET', '/v1/audit');
    const { entries } = await audit.json();
    expect(entries.length).toBe(4);

    // Revoke one, list still shows all 3
    await req('POST', `/v1/passports/${ids[0]}/revoke`);
    const list2 = await req('GET', '/v1/passports');
    expect((await list2.json()).passports).toHaveLength(3);

    // But introspection shows it inactive
    const introspect = await req('POST', `/v1/passports/${ids[0]}/introspect`);
    expect((await introspect.json()).active).toBe(false);
  });
});
