import { randomUUID } from 'node:crypto';
import type { Context, Next } from 'hono';

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  scopes: string[];
  createdAt: number;
}

export class ApiKeyManager {
  private keys = new Map<string, ApiKey>();

  create(name: string, scopes: string[] = ['*']): ApiKey {
    const id = randomUUID().slice(0, 8);
    const key = `pak_${randomUUID().replace(/-/g, '')}`;
    const entry: ApiKey = { id, key, name, scopes, createdAt: Date.now() };
    this.keys.set(key, entry);
    return entry;
  }

  validate(key: string): ApiKey | null {
    return this.keys.get(key) ?? null;
  }

  revoke(id: string): boolean {
    for (const [key, entry] of this.keys) {
      if (entry.id === id) {
        this.keys.delete(key);
        return true;
      }
    }
    return false;
  }

  list(): Omit<ApiKey, 'key'>[] {
    return [...this.keys.values()].map(({ key, ...rest }) => ({
      ...rest,
      keyPrefix: key.slice(0, 8) + '...',
    })) as unknown as Omit<ApiKey, 'key'>[];
  }
}

export function apiKeyAuth(manager: ApiKeyManager, requiredScope = '*') {
  return async (c: Context, next: Next) => {
    const auth = c.req.header('authorization');
    if (!auth?.startsWith('Bearer pak_')) {
      return c.json({ error: 'Missing or invalid API key' }, 401);
    }

    const key = auth.slice(7);
    const entry = manager.validate(key);
    if (!entry) {
      return c.json({ error: 'Invalid API key' }, 401);
    }

    if (requiredScope !== '*' && !entry.scopes.includes('*') && !entry.scopes.includes(requiredScope)) {
      return c.json({ error: 'Insufficient scope' }, 403);
    }

    await next();
  };
}
