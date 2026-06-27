import { describe, it, expect } from 'vitest';
import { PassportIssuer } from '@passport-agent/core';
import { createAgentCard, validatePassportForCard } from '../agent-card.js';

describe('A2A Agent Card Integration', () => {
  describe('createAgentCard', () => {
    it('creates an agent card with passport requirements', () => {
      const card = createAgentCard({
        name: 'Flight Search Agent',
        description: 'Searches for flights',
        url: 'https://flights.example.com/.well-known/agent.json',
        capabilities: ['flights:search', 'flights:compare'],
        passportRequirements: {
          requiredPermissions: ['flights:search'],
          minSpendLimit: 0,
        },
      });

      expect(card.name).toBe('Flight Search Agent');
      expect(card.passport?.requiredPermissions).toEqual(['flights:search']);
    });

    it('creates card without passport requirements', () => {
      const card = createAgentCard({
        name: 'Public Agent',
        description: 'No auth needed',
        url: 'https://public.example.com',
        capabilities: ['info'],
      });

      expect(card.passport).toBeUndefined();
    });
  });

  describe('validatePassportForCard', () => {
    it('validates passport meets card requirements', () => {
      const issuer = new PassportIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:caller',
        permissions: ['flights:search', 'flights:book'],
        limits: { maxSpend: 500 },
      });

      const card = createAgentCard({
        name: 'Flight Agent',
        description: 'Flights',
        url: 'https://flights.example.com',
        capabilities: ['flights:search'],
        passportRequirements: {
          requiredPermissions: ['flights:search'],
          minSpendLimit: 100,
        },
      });

      const result = validatePassportForCard(passport, card);
      expect(result.valid).toBe(true);
      expect(result.missingPermissions).toEqual([]);
    });

    it('detects missing permissions', () => {
      const issuer = new PassportIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:caller',
        permissions: ['flights:search'],
      });

      const card = createAgentCard({
        name: 'Booking Agent',
        description: 'Books flights',
        url: 'https://booking.example.com',
        capabilities: ['flights:book'],
        passportRequirements: {
          requiredPermissions: ['flights:book', 'payment:charge'],
        },
      });

      const result = validatePassportForCard(passport, card);
      expect(result.valid).toBe(false);
      expect(result.missingPermissions).toEqual(['flights:book', 'payment:charge']);
    });

    it('detects insufficient spend limit', () => {
      const issuer = new PassportIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:caller',
        permissions: ['flights:book'],
        limits: { maxSpend: 50 },
      });

      const card = createAgentCard({
        name: 'Booking Agent',
        description: 'Books flights',
        url: 'https://booking.example.com',
        capabilities: ['flights:book'],
        passportRequirements: {
          requiredPermissions: ['flights:book'],
          minSpendLimit: 200,
        },
      });

      const result = validatePassportForCard(passport, card);
      expect(result.valid).toBe(false);
      expect(result.insufficientSpend).toBe(true);
    });

    it('passes cards without passport requirements', () => {
      const issuer = new PassportIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:caller',
        permissions: [],
      });

      const card = createAgentCard({
        name: 'Public',
        description: 'No auth',
        url: 'https://public.example.com',
        capabilities: ['info'],
      });

      const result = validatePassportForCard(passport, card);
      expect(result.valid).toBe(true);
    });

    it('wildcard permissions satisfy specific requirements', () => {
      const issuer = new PassportIssuer();
      const passport = issuer.issue({
        principal: 'user:alice@test.com',
        agent: 'agent:caller',
        permissions: ['flights:*'],
        limits: { maxSpend: 1000 },
      });

      const card = createAgentCard({
        name: 'Flight Agent',
        description: 'Flights',
        url: 'https://flights.example.com',
        capabilities: ['flights:search', 'flights:book'],
        passportRequirements: {
          requiredPermissions: ['flights:search', 'flights:book'],
          minSpendLimit: 500,
        },
      });

      const result = validatePassportForCard(passport, card);
      expect(result.valid).toBe(true);
    });
  });
});
