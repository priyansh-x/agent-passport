import type { AgentPassport } from './agent-passport.js';

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoff?: 'fixed' | 'exponential';
  onRetry?: (attempt: number, error: Error) => void;
}

export async function withRetry<T>(
  passport: AgentPassport,
  action: string,
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const baseDelay = options?.delayMs ?? 1000;
  const backoff = options?.backoff ?? 'exponential';

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    passport.authorize(action);

    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxAttempts) {
        options?.onRetry?.(attempt, lastError);
        const delay = backoff === 'exponential' ? baseDelay * 2 ** (attempt - 1) : baseDelay;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}
