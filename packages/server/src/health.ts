import type { PassportDB } from './db.js';

const startTime = Date.now();

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  uptime: number;
  version: string;
  checks: {
    database: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
  };
}

export function checkHealth(db: PassportDB): HealthStatus {
  const checks = { database: checkDatabase(db) };
  const status = Object.values(checks).every((c) => c.status === 'ok') ? 'ok' : 'degraded';

  return {
    status,
    uptime: Date.now() - startTime,
    version: '0.1.0',
    checks,
  };
}

function checkDatabase(db: PassportDB): HealthStatus['checks']['database'] {
  const start = Date.now();
  try {
    db.getStats();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}
