import { describe, it, expect } from 'vitest';
import { PassportIssuer } from '@agent-passport/core';
import { PassportAgent, createCrew } from '../agent.js';

describe('CrewAI Integration', () => {
  describe('PassportAgent', () => {
    it('executes permitted tasks', async () => {
      const issuer = new PassportIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:researcher',
        permissions: ['search', 'summarize'],
      });

      const agent = new PassportAgent(
        { name: 'researcher', role: 'Research Agent', permissions: ['search', 'summarize'] },
        passport,
        issuer,
      );

      const result = await agent.executeTask({
        description: 'Search for papers',
        requiredPermission: 'search',
        execute: () => ['paper1', 'paper2'],
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual(['paper1', 'paper2']);
    });

    it('blocks unpermitted tasks', async () => {
      const issuer = new PassportIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:researcher',
        permissions: ['search'],
      });

      const agent = new PassportAgent(
        { name: 'researcher', role: 'Research Agent', permissions: ['search'] },
        passport,
        issuer,
      );

      const result = await agent.executeTask({
        description: 'Delete everything',
        requiredPermission: 'admin:delete',
        execute: () => 'destroyed',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Denied');
    });

    it('enforces spend limits on tasks', async () => {
      const issuer = new PassportIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:buyer',
        permissions: ['purchase'],
        limits: { maxSpend: 100 },
      });

      const agent = new PassportAgent(
        { name: 'buyer', role: 'Purchasing Agent', permissions: ['purchase'] },
        passport,
        issuer,
      );

      const r1 = await agent.executeTask({
        description: 'Buy item A',
        requiredPermission: 'purchase',
        spendAmount: 80,
        execute: () => 'bought A',
      });
      expect(r1.success).toBe(true);

      const r2 = await agent.executeTask({
        description: 'Buy item B',
        requiredPermission: 'purchase',
        spendAmount: 50,
        execute: () => 'bought B',
      });
      expect(r2.success).toBe(false);
    });
  });

  describe('createCrew', () => {
    it('creates agents with delegated passports', () => {
      const issuer = new PassportIssuer();
      const crew = createCrew(
        {
          principal: 'user:alice@test.com',
          issuer,
          permissions: ['search', 'write', 'publish'],
          limits: { maxSpend: 500 },
        },
        [
          { name: 'researcher', role: 'Research', permissions: ['search'], limits: { maxSpend: 0 } },
          { name: 'writer', role: 'Writer', permissions: ['write'], limits: { maxSpend: 100 } },
          { name: 'editor', role: 'Editor', permissions: ['write', 'publish'], limits: { maxSpend: 200 } },
        ],
      );

      expect(crew).toHaveLength(3);
      expect(crew[0]!.name).toBe('researcher');
      expect(crew[0]!.permissions).toEqual(['search']);
      expect(crew[2]!.permissions).toEqual(['write', 'publish']);
    });

    it('each agent has independent scope', async () => {
      const issuer = new PassportIssuer();
      const crew = createCrew(
        {
          principal: 'user:alice@test.com',
          issuer,
          permissions: ['search', 'write'],
        },
        [
          { name: 'reader', role: 'Reader', permissions: ['search'] },
          { name: 'writer', role: 'Writer', permissions: ['write'] },
        ],
      );

      const [reader, writer] = crew;

      const r1 = await reader!.executeTask({
        description: 'Search',
        requiredPermission: 'search',
        execute: () => 'found',
      });
      expect(r1.success).toBe(true);

      const r2 = await reader!.executeTask({
        description: 'Write',
        requiredPermission: 'write',
        execute: () => 'written',
      });
      expect(r2.success).toBe(false);

      const r3 = await writer!.executeTask({
        description: 'Write',
        requiredPermission: 'write',
        execute: () => 'written',
      });
      expect(r3.success).toBe(true);
    });
  });
});
