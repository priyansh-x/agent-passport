import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PassportIssuer } from '@passport-agent/core';
import { expressPassport } from '../express.js';
import { fastifyPassport } from '../fastify.js';
import { nextjsPassport } from '../nextjs.js';
import { createMiddlewareHandler } from '../core.js';

describe('Framework Middleware', () => {
  let issuer: PassportIssuer;
  let passportHeader: string;

  beforeEach(() => {
    issuer = new PassportIssuer();
    const signed = issuer.issue({
      principal: 'user:alice',
      agent: 'agent:bot',
      permissions: ['api:*'],
    });
    passportHeader = JSON.stringify(signed);
  });

  describe('core handler', () => {
    it('allows valid passport with matching permission', () => {
      const handle = createMiddlewareHandler({ issuer });
      const result = handle('GET', '/api/data', { 'x-agent-passport': passportHeader });
      expect(result.allowed).toBe(true);
    });

    it('returns 401 without passport header', () => {
      const handle = createMiddlewareHandler({ issuer });
      const result = handle('GET', '/api/data', {});
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.status).toBe(401);
    });

    it('returns 403 for denied action', () => {
      const denied = issuer.issue({
        principal: 'user:alice',
        agent: 'agent:bot',
        permissions: ['other:action'],
      });
      const handle = createMiddlewareHandler({ issuer });
      const result = handle('GET', '/api/data', {
        'x-agent-passport': JSON.stringify(denied),
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.status).toBe(403);
    });

    it('uses custom header name', () => {
      const handle = createMiddlewareHandler({ issuer, headerName: 'authorization' });
      const result = handle('GET', '/api', { 'authorization': passportHeader });
      expect(result.allowed).toBe(true);
    });

    it('calls onDenied callback', () => {
      const onDenied = vi.fn();
      const handle = createMiddlewareHandler({ issuer, onDenied });
      handle('DELETE', '/admin/users', { 'x-agent-passport': passportHeader });
      expect(onDenied).toHaveBeenCalled();
    });

    it('calls onAllowed callback', () => {
      const onAllowed = vi.fn();
      const handle = createMiddlewareHandler({ issuer, onAllowed });
      handle('GET', '/api/data', { 'x-agent-passport': passportHeader });
      expect(onAllowed).toHaveBeenCalled();
    });
  });

  describe('Express middleware', () => {
    it('calls next() on allowed request', () => {
      const mw = expressPassport({ issuer });
      const req: Record<string, unknown> = { method: 'GET', path: '/api/data', headers: { 'x-agent-passport': passportHeader } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      mw(req as any, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.passportContext).toBeDefined();
    });

    it('returns 401 without passport', () => {
      const mw = expressPassport({ issuer });
      const req = { method: 'GET', path: '/api', headers: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      mw(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Fastify hook', () => {
    it('sets passport context on allowed request', async () => {
      const hook = fastifyPassport({ issuer });
      const req: Record<string, unknown> = { method: 'GET', url: '/api/data?q=1', headers: { 'x-agent-passport': passportHeader } };
      const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };

      await hook(req as any, reply);

      expect(reply.send).not.toHaveBeenCalled();
      expect(req.passportContext).toBeDefined();
    });

    it('sends 401 without passport', async () => {
      const hook = fastifyPassport({ issuer });
      const req = { method: 'GET', url: '/api', headers: {} };
      const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };

      await hook(req, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalled();
    });
  });

  describe('Next.js middleware', () => {
    it('returns null on allowed request', () => {
      const MockNextResponse = { json: vi.fn().mockReturnValue('response') };
      const mw = nextjsPassport({ issuer }, MockNextResponse);
      const req = {
        method: 'GET',
        nextUrl: { pathname: '/api/data' },
        headers: { get: (name: string) => name === 'x-agent-passport' ? passportHeader : null },
      };

      const result = mw(req);
      expect(result).toBeNull();
    });

    it('returns JSON response on denied request', () => {
      const MockNextResponse = { json: vi.fn().mockReturnValue('response') };
      const mw = nextjsPassport({ issuer }, MockNextResponse);
      const req = {
        method: 'GET',
        nextUrl: { pathname: '/api/data' },
        headers: { get: () => null },
      };

      const result = mw(req);
      expect(result).toBe('response');
      expect(MockNextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) }),
        expect.objectContaining({ status: 401 }),
      );
    });
  });
});
