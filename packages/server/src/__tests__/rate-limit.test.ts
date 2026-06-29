import { describe, it, expect, beforeEach } from 'vitest';
import { PassportIssuer } from '@passport-agent/core';
import { createApi } from '../api.js';
import { PassportDB } from '../db.js';

describe('Rate Limiter', () => {
  let app: ReturnType<typeof createApi>;

  beforeEach(() => {
    const issuer = new PassportIssuer();
    const db = new PassportDB(':memory:');
    app = createApi(issuer, db);
  });

  async function req(path: string) {
    return app.request(path, {
      method: 'GET',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
  }

  it('sets rate limit headers', async () => {
    const res = await req('/v1/passports');
    expect(res.headers.get('x-ratelimit-limit')).toBe('100');
    expect(res.headers.get('x-ratelimit-remaining')).toBe('99');
    expect(res.headers.get('x-ratelimit-reset')).toBeTruthy();
  });

  it('decrements remaining count', async () => {
    await req('/v1/passports');
    const res = await req('/v1/passports');
    expect(res.headers.get('x-ratelimit-remaining')).toBe('98');
  });

  it('does not rate limit health endpoint', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-ratelimit-limit')).toBeNull();
  });

  it('returns 429 after exceeding limit', async () => {
    const issuer = new PassportIssuer();
    const db = new PassportDB(':memory:');
    const limitedApp = createApi(issuer, db);

    for (let i = 0; i < 101; i++) {
      await limitedApp.request('/v1/passports', {
        method: 'GET',
        headers: { 'x-forwarded-for': '5.6.7.8' },
      });
    }

    const res = await limitedApp.request('/v1/passports', {
      method: 'GET',
      headers: { 'x-forwarded-for': '5.6.7.8' },
    });
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe('Too many requests');
    expect(data.retryAfter).toBeGreaterThan(0);
  });
});
