import { describe, it, expect, vi } from 'vitest';
import { PassportIssuer } from '@passport-agent/core';
import { createPassportMiddleware } from '../middleware.js';
import { PassportToolGuard } from '../guard.js';

describe('MCP Middleware', () => {
  function setup() {
    const issuer = new PassportIssuer();
    const passport = issuer.issue({
      principal: 'user:alice@test.com',
      agent: 'agent:mcp-bot',
      permissions: ['tool:read_file', 'tool:search', 'tool:write_file'],
      limits: { maxSpend: 100 },
    });
    return { issuer, passport };
  }

  describe('createPassportMiddleware', () => {
    it('allows permitted tool calls', () => {
      const { issuer, passport } = setup();
      const check = createPassportMiddleware({ issuer });
      const result = check(passport, { toolName: 'read_file', arguments: { path: '/foo' } });
      expect(result.allowed).toBe(true);
    });

    it('denies unpermitted tool calls', () => {
      const { issuer, passport } = setup();
      const check = createPassportMiddleware({ issuer });
      const result = check(passport, { toolName: 'delete_db', arguments: {} });
      expect(result.allowed).toBe(false);
    });

    it('uses custom permission mapper', () => {
      const { issuer, passport } = setup();
      const issuer2 = new PassportIssuer();
      const passport2 = issuer2.issue({
        principal: 'user:bob@test.com',
        agent: 'agent:bot',
        permissions: ['files:read'],
      });
      const check = createPassportMiddleware({
        issuer: issuer2,
        permissionMapper: (tool) => tool === 'read_file' ? 'files:read' : `tool:${tool}`,
      });
      expect(check(passport2, { toolName: 'read_file', arguments: {} }).allowed).toBe(true);
    });

    it('calls onDenied callback', () => {
      const { issuer, passport } = setup();
      const onDenied = vi.fn();
      const check = createPassportMiddleware({ issuer, onDenied });
      check(passport, { toolName: 'nuke', arguments: {} });
      expect(onDenied).toHaveBeenCalledOnce();
    });

    it('calls onAllowed callback', () => {
      const { issuer, passport } = setup();
      const onAllowed = vi.fn();
      const check = createPassportMiddleware({ issuer, onAllowed });
      check(passport, { toolName: 'read_file', arguments: {} });
      expect(onAllowed).toHaveBeenCalledOnce();
    });
  });

  describe('PassportToolGuard', () => {
    it('executes handler when allowed', () => {
      const { issuer, passport } = setup();
      const guard = new PassportToolGuard({ issuer });
      const result = guard.guard(passport, 'read_file', { path: '/foo' }, () => 'file contents');
      expect(result).toBe('file contents');
    });

    it('throws when denied', () => {
      const { issuer, passport } = setup();
      const guard = new PassportToolGuard({ issuer });
      expect(() =>
        guard.guard(passport, 'drop_table', {}, () => 'bad'),
      ).toThrow('blocked by passport');
    });

    it('handles async tool calls', async () => {
      const { issuer, passport } = setup();
      const guard = new PassportToolGuard({ issuer });
      const result = await guard.guardAsync(
        passport, 'search', { query: 'test' },
        async () => ['result1', 'result2'],
      );
      expect(result).toEqual(['result1', 'result2']);
    });

    it('enforces spend limits on tool calls', () => {
      const { issuer, passport } = setup();
      const guard = new PassportToolGuard({ issuer });

      guard.guard(passport, 'write_file', {}, () => 'ok', 80);
      expect(() =>
        guard.guard(passport, 'write_file', {}, () => 'ok', 30),
      ).toThrow('blocked by passport');
    });
  });
});
