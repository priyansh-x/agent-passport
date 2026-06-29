import type { Context, Next } from 'hono';

export interface LogEntry {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  timestamp: number;
}

export interface LoggerOptions {
  onLog?: (entry: LogEntry) => void;
  skip?: (path: string) => boolean;
}

export function requestLogger(options: LoggerOptions = {}) {
  const log = options.onLog ?? ((entry: LogEntry) => {
    const status = entry.status >= 400 ? `\x1b[31m${entry.status}\x1b[0m` : `\x1b[32m${entry.status}\x1b[0m`;
    console.log(`  ${entry.method.padEnd(6)} ${entry.path.padEnd(40)} ${status}  ${entry.durationMs}ms`);
  });

  return async (c: Context, next: Next) => {
    if (options.skip?.(c.req.path)) {
      await next();
      return;
    }

    const start = performance.now();
    await next();
    const durationMs = Math.round(performance.now() - start);

    log({
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs,
      timestamp: Date.now(),
    });
  };
}
