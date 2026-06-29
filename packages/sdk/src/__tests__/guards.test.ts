import { describe, it, expect } from 'vitest';
import { AgentPassport, PassportDeniedError } from '../agent-passport.js';
import { requirePassport, withBudget, withPassportAsync, createGuardedProxy } from '../guards.js';
import { PassportIssuer } from '@passport-agent/core';

describe('Guards', () => {
  function setup(perms: string[], maxSpend = 0) {
    const issuer = new PassportIssuer();
    const passport = AgentPassport.issue(
      { principal: 'user:alice', agent: 'agent:bot', permissions: perms, limits: { maxSpend } },
      issuer,
    );
    return passport;
  }

  describe('requirePassport', () => {
    it('wraps a function with authorization check', () => {
      const passport = setup(['read']);
      const fn = requirePassport(passport, 'read', (x: unknown) => `got ${x}`);
      expect(fn('hello')).toBe('got hello');
    });

    it('throws on unauthorized action', () => {
      const passport = setup(['read']);
      const fn = requirePassport(passport, 'admin', () => 'nope');
      expect(() => fn()).toThrow(PassportDeniedError);
    });
  });

  describe('withBudget', () => {
    it('authorizes with spend amount', () => {
      const passport = setup(['purchase'], 100);
      const result = withBudget(passport, 'purchase', 50, () => 'purchased');
      expect(result).toBe('purchased');
    });

    it('throws when over budget', () => {
      const passport = setup(['purchase'], 10);
      expect(() => withBudget(passport, 'purchase', 50, () => 'nope')).toThrow(PassportDeniedError);
    });
  });

  describe('withPassportAsync', () => {
    it('wraps async functions', async () => {
      const passport = setup(['fetch']);
      const result = await withPassportAsync(passport, 'fetch', async () => 'data');
      expect(result).toBe('data');
    });
  });

  describe('createGuardedProxy', () => {
    it('guards specific methods via permission map', () => {
      const passport = setup(['files:read']);
      const service = {
        readFile: (name: string) => `contents of ${name}`,
        deleteFile: (_name: string) => 'deleted',
      };

      const guarded = createGuardedProxy(service, passport, {
        readFile: 'files:read',
        deleteFile: 'files:delete',
      }) as typeof service;

      expect(guarded.readFile('test.txt')).toBe('contents of test.txt');
      expect(() => guarded.deleteFile('test.txt')).toThrow(PassportDeniedError);
    });
  });
});
