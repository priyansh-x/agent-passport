import { describe, it, expect, vi } from 'vitest';
import { PassportIssuer } from '@passport-agent/core';
import { withPassport, createPassportToolkit, wrapLangChainTool, wrapLangChainToolkit, type ToolDefinition, type LangChainToolInput } from '../wrapper.js';

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

    it('calls onAuthorized callback on success', async () => {
      const { issuer, passport } = setup();
      const onAuthorized = vi.fn();
      const wrapped = withPassport(searchTool, passport, { issuer, onAuthorized });
      await wrapped.execute({ query: 'test' });
      expect(onAuthorized).toHaveBeenCalledWith('search', expect.objectContaining({ allowed: true }));
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

  describe('wrapLangChainTool', () => {
    const lcSearchTool: LangChainToolInput = {
      name: 'search',
      description: 'Search the web',
      schema: { type: 'object', properties: { query: { type: 'string' } } },
      invoke: async (input) => `Found: ${input['query']}`,
    };

    const lcDeleteTool: LangChainToolInput = {
      name: 'delete_db',
      description: 'Delete database',
      invoke: async () => 'deleted',
    };

    it('allows permitted tool invocation', async () => {
      const { issuer, passport } = setup();
      const wrapped = wrapLangChainTool(lcSearchTool, passport, { issuer });
      const result = await wrapped.invoke({ query: 'hello' });
      expect(result).toBe('Found: hello');
    });

    it('blocks unpermitted tool invocation', async () => {
      const { issuer, passport } = setup();
      const wrapped = wrapLangChainTool(lcDeleteTool, passport, { issuer });
      await expect(wrapped.invoke({})).rejects.toThrow('denied');
    });

    it('preserves schema', () => {
      const { issuer, passport } = setup();
      const wrapped = wrapLangChainTool(lcSearchTool, passport, { issuer });
      expect(wrapped.schema).toEqual(lcSearchTool.schema);
    });

    it('fires callback handlers', async () => {
      const { issuer, passport } = setup();
      const onStart = vi.fn();
      const onEnd = vi.fn();
      const wrapped = wrapLangChainTool(lcSearchTool, passport, {
        issuer,
        callbacks: { onToolStart: onStart, onToolEnd: onEnd },
      });
      await wrapped.invoke({ query: 'test' });
      expect(onStart).toHaveBeenCalledWith('search', { query: 'test' });
      expect(onEnd).toHaveBeenCalledWith('search', 'Found: test');
    });

    it('fires error callback on denial', async () => {
      const { issuer, passport } = setup();
      const onError = vi.fn();
      const wrapped = wrapLangChainTool(lcDeleteTool, passport, {
        issuer,
        callbacks: { onToolError: onError },
      });
      await expect(wrapped.invoke({})).rejects.toThrow();
      expect(onError).toHaveBeenCalledWith('delete_db', expect.any(Error));
    });
  });

  describe('wrapLangChainToolkit', () => {
    it('wraps multiple LangChain tools', async () => {
      const { issuer, passport } = setup();
      const tools: LangChainToolInput[] = [
        { name: 'search', description: 'Search', invoke: async () => 'ok' },
        { name: 'delete_db', description: 'Delete', invoke: async () => 'ok' },
      ];
      const wrapped = wrapLangChainToolkit(tools, passport, { issuer });
      expect(wrapped).toHaveLength(2);
      await expect(wrapped[0]!.invoke({})).resolves.toBe('ok');
      await expect(wrapped[1]!.invoke({})).rejects.toThrow('denied');
    });
  });
});
