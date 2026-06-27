import { describe, it, expect, beforeEach } from 'vitest';
import { PassportIssuer } from '@agent-passport/core';
import { createApi } from '../api.js';
import { PassportDB } from '../db.js';

describe('Passport Authority API', () => {
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

  describe('POST /v1/passports', () => {
    it('issues a passport', async () => {
      const res = await req('POST', '/v1/passports', {
        principal: 'user:alice@test.com',
        agent: 'agent:bot',
        permissions: ['read', 'write'],
        limits: { maxSpend: 100 },
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeTruthy();
      expect(data.passport.principal).toBe('user:alice@test.com');
    });
  });

  describe('GET /v1/passports', () => {
    it('lists all passports', async () => {
      const empty = await req('GET', '/v1/passports');
      expect((await empty.json()).passports).toHaveLength(0);

      await req('POST', '/v1/passports', {
        principal: 'user:alice@test.com',
        agent: 'agent:a',
        permissions: ['read'],
      });
      await req('POST', '/v1/passports', {
        principal: 'user:bob@test.com',
        agent: 'agent:b',
        permissions: ['write'],
      });

      const res = await req('GET', '/v1/passports');
      const data = await res.json();
      expect(data.passports).toHaveLength(2);
      expect(data.passports[0].sub).toBeTruthy();
    });
  });

  describe('GET /v1/passports/:id', () => {
    it('retrieves a passport', async () => {
      const create = await req('POST', '/v1/passports', {
        principal: 'user:alice@test.com',
        agent: 'agent:bot',
        permissions: ['read'],
      });
      const { id } = await create.json();

      const res = await req('GET', `/v1/passports/${id}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.passport.sub).toBe('agent:bot');
      expect(data.revoked).toBe(false);
    });

    it('returns 404 for unknown passport', async () => {
      const res = await req('GET', '/v1/passports/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /v1/passports/:id/authorize', () => {
    it('authorizes permitted actions', async () => {
      const create = await req('POST', '/v1/passports', {
        principal: 'user:alice@test.com',
        agent: 'agent:bot',
        permissions: ['read'],
      });
      const { id } = await create.json();

      const res = await req('POST', `/v1/passports/${id}/authorize`, { action: 'read' });
      const data = await res.json();
      expect(data.allowed).toBe(true);
    });

    it('denies unpermitted actions', async () => {
      const create = await req('POST', '/v1/passports', {
        principal: 'user:alice@test.com',
        agent: 'agent:bot',
        permissions: ['read'],
      });
      const { id } = await create.json();

      const res = await req('POST', `/v1/passports/${id}/authorize`, { action: 'delete' });
      const data = await res.json();
      expect(data.allowed).toBe(false);
    });
  });

  describe('POST /v1/passports/:id/delegate', () => {
    it('creates a child passport', async () => {
      const create = await req('POST', '/v1/passports', {
        principal: 'user:alice@test.com',
        agent: 'agent:root',
        permissions: ['read', 'write'],
        limits: { maxSpend: 500 },
      });
      const { id } = await create.json();

      const res = await req('POST', `/v1/passports/${id}/delegate`, {
        agent: 'agent:child',
        permissions: ['read'],
        limits: { maxSpend: 100 },
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.passport.parentId).toBe(id);
    });

    it('rejects escalation', async () => {
      const create = await req('POST', '/v1/passports', {
        principal: 'user:alice@test.com',
        agent: 'agent:root',
        permissions: ['read'],
      });
      const { id } = await create.json();

      const res = await req('POST', `/v1/passports/${id}/delegate`, {
        agent: 'agent:child',
        permissions: ['admin'],
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /v1/passports/:id/revoke', () => {
    it('revokes passport and returns cascade list', async () => {
      const create = await req('POST', '/v1/passports', {
        principal: 'user:alice@test.com',
        agent: 'agent:root',
        permissions: ['read'],
      });
      const { id } = await create.json();

      const res = await req('POST', `/v1/passports/${id}/revoke`);
      const data = await res.json();
      expect(data.revoked).toContain(id);

      const verify = await req('POST', `/v1/passports/${id}/verify`);
      const verifyData = await verify.json();
      expect(verifyData.valid).toBe(false);
      expect(verifyData.revoked).toBe(true);
    });
  });

  describe('GET /v1/passports/:id/audit', () => {
    it('returns audit log for a passport', async () => {
      const create = await req('POST', '/v1/passports', {
        principal: 'user:alice@test.com',
        agent: 'agent:bot',
        permissions: ['read'],
      });
      const { id } = await create.json();

      await req('POST', `/v1/passports/${id}/authorize`, { action: 'read' });
      await req('POST', `/v1/passports/${id}/authorize`, { action: 'write' });

      const res = await req('GET', `/v1/passports/${id}/audit`);
      const data = await res.json();
      expect(data.entries).toHaveLength(2);
    });
  });

  describe('GET /health', () => {
    it('returns ok', async () => {
      const res = await req('GET', '/health');
      expect(res.status).toBe(200);
    });
  });
});
