import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PassportIssuer, serializePassport } from '@passport-agent/core';
import { passportGuard } from '../mcp-guard.js';

function setup() {
  const issuer = new PassportIssuer();
  const passport = issuer.issue({
    principal: 'user:alice@test.com',
    agent: 'agent:mcp-bot',
    permissions: ['tool:read_file', 'tool:search'],
    limits: { maxSpend: 100 },
  });
  const token = serializePassport(passport);
  const server = new McpServer({ name: 'test', version: '1.0.0' });
  return { issuer, passport, token, server };
}

describe('passportGuard', () => {
  it('wraps server and returns it', () => {
    const { issuer, server } = setup();
    const guarded = passportGuard(server, { issuer });
    expect(guarded).toBe(server);
  });

  it('allows tool call with valid passport', async () => {
    const { issuer, token, server } = setup();
    const onAllowed = vi.fn();
    passportGuard(server, { issuer, onAllowed });

    const handler = vi.fn().mockReturnValue({
      content: [{ type: 'text', text: 'file contents' }],
    });

    server.tool('read_file', handler);

    // Simulate what McpServer does internally — call the registered handler
    const tool = (server as any)._registeredTools['read_file'];
    const result = await tool.handler(
      { _meta: { 'x-passport': token } },
    );

    expect(handler).toHaveBeenCalled();
    expect(onAllowed).toHaveBeenCalled();
    expect(result.content[0].text).toBe('file contents');
  });

  it('denies tool call without passport', async () => {
    const { issuer, server } = setup();
    const onDenied = vi.fn();
    passportGuard(server, { issuer, onDenied });

    const handler = vi.fn();
    server.tool('read_file', handler);

    const tool = (server as any)._registeredTools['read_file'];
    const result = await tool.handler({ _meta: {} });

    expect(handler).not.toHaveBeenCalled();
    expect(onDenied).toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No passport');
  });

  it('denies tool call with wrong permission', async () => {
    const { issuer, token, server } = setup();
    const onDenied = vi.fn();
    passportGuard(server, { issuer, onDenied });

    const handler = vi.fn();
    server.tool('delete_db', handler);

    const tool = (server as any)._registeredTools['delete_db'];
    const result = await tool.handler(
      { _meta: { 'x-passport': token } },
    );

    expect(handler).not.toHaveBeenCalled();
    expect(onDenied).toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });

  it('denies tool call with invalid token', async () => {
    const { issuer, server } = setup();
    passportGuard(server, { issuer });

    const handler = vi.fn();
    server.tool('read_file', handler);

    const tool = (server as any)._registeredTools['read_file'];
    const result = await tool.handler(
      { _meta: { 'x-passport': 'ap1.garbage.data' } },
    );

    expect(handler).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid passport');
  });

  it('supports custom permission mapper', async () => {
    const { issuer, server } = setup();
    const passport = issuer.issue({
      principal: 'user:bob@test.com',
      agent: 'agent:bot',
      permissions: ['files:read'],
    });
    const token = serializePassport(passport);

    passportGuard(server, {
      issuer,
      permissionMapper: (tool) => tool === 'read_file' ? 'files:read' : `tool:${tool}`,
    });

    const handler = vi.fn().mockReturnValue({
      content: [{ type: 'text', text: 'ok' }],
    });
    server.tool('read_file', handler);

    const tool = (server as any)._registeredTools['read_file'];
    const result = await tool.handler(
      { _meta: { 'x-passport': token } },
    );

    expect(handler).toHaveBeenCalled();
    expect(result.content[0].text).toBe('ok');
  });

  it('supports custom passport extractor', async () => {
    const { issuer, token, server } = setup();

    passportGuard(server, {
      issuer,
      extractPassport: (req) => {
        const t = req._meta?.['auth'] as string | undefined;
        return t ?? null;
      },
    });

    const handler = vi.fn().mockReturnValue({
      content: [{ type: 'text', text: 'ok' }],
    });
    server.tool('read_file', handler);

    const tool = (server as any)._registeredTools['read_file'];
    const result = await tool.handler(
      { _meta: { auth: token } },
    );

    expect(handler).toHaveBeenCalled();
  });
});
