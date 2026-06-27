import { describe, it, expect, vi } from 'vitest';
import { PassportIssuer } from '@passport-agent/core';
import { withPassport, createPassportToolkit, type ToolDefinition } from '../wrapper.js';

describe('LangChain Integration', () => {
  function setup() {
    const issuer = new PassportIssuer();
    const passport = issuer.issue({
      principal: 'user:alice@test.com',
      agent: 'agent:langchain-bot',
      permissions: ['tool:search', 'tool:read_file', 'tool:write_file'],
      limits: { maxSpend: 200 },
    });
    return { issuer, passport };
  }

  const searchTool: ToolDefinition = {
    name: 'search',
    description: 'Search the web',
    execute: async (args) => ({ results: [`result for ${args['query']}`] }),
  };

  const deleteTool: ToolDefinition = {
    name: 'delete_db',
    description: 'Delete database',
    execute: async () => 'deleted',
  };

  describe('withPassport', () => {
    it('allows permitted tool execution', async () => {
      const { issuer, passport } = setup();
      const wrapped = withPassport(searchTool, passport, { issuer });
      const result = await wrapped.execute({ query: 'test' });
      expect(result).toEqual({ results: ['result for test'] });
    });

    it('blocks unpermitted tools', async () => {
      const { issuer, passport } = setup();
      const wrapped = withPassport(deleteTool, passport, { issuer });
      await expect(wrapped.execute({})).rejects.toThrow('denied');
    });

    it('preserves tool name and description', () => {
      const { issuer, passport } = setup();
      const wrapped = withPassport(searchTool, passport, { issuer });
      expect(wrapped.name).toBe('search');
      expect(wrapped.description).toBe('Search the web');
    });

    it('supports custom permission mapping', async () => {
      const issuer = new PassportIssuer();
      const passport = issuer.issue({
        principal: 'user:bob@test.com',
        agent: 'agent:bot',
        permissions: ['web:search'],
      });
      const wrapped = withPassport(searchTool, passport, {
        issuer,
        permissionMapper: (name) => name === 'search' ? 'web:search' : `tool:${name}`,
      });
      const result = await wrapped.execute({ query: 'hi' });
      expect(result).toEqual({ results: ['result for hi'] });
    });

    it('enforces spend limits via spendMapper', async () => {
      const { issuer, passport } = setup();
      const writeTool: ToolDefinition = {
        name: 'write_file',
        description: 'Write a file',
        execute: async () => 'written',
      };
      const wrapped = withPassport(writeTool, passport, {
        issuer,
        spendMapper: (_name, args) => (args['cost'] as number) ?? 0,
      });

      await wrapped.execute({ cost: 150 });
      await expect(wrapped.execute({ cost: 100 })).rejects.toThrow('denied');
    });

    it('calls onDenied callback', async () => {
      const { issuer, passport } = setup();
      const onDenied = vi.fn();
      const wrapped = withPassport(deleteTool, passport, { issuer, onDenied });
      await expect(wrapped.execute({})).rejects.toThrow();
      expect(onDenied).toHaveBeenCalledWith('delete_db', expect.any(String));
    });
  });

  describe('createPassportToolkit', () => {
    it('wraps all tools with passport checks', async () => {
      const { issuer, passport } = setup();
      const tools = createPassportToolkit(
        [searchTool, deleteTool],
        passport,
        { issuer },
      );
      expect(tools).toHaveLength(2);

      await expect(tools[0]!.execute({ query: 'test' })).resolves.toBeTruthy();
      await expect(tools[1]!.execute({})).rejects.toThrow('denied');
    });
  });
});
