import type { SignedPassport } from '@passport-agent/core';
import { PassportIssuer, deserializePassport } from '@passport-agent/core';
import { createPassportMiddleware, type MiddlewareConfig, type ToolCallContext } from './middleware.js';

export class PassportToolGuard {
  private check: ReturnType<typeof createPassportMiddleware>;
  private issuer: PassportIssuer;

  constructor(config: MiddlewareConfig) {
    this.issuer = config.issuer;
    this.check = createPassportMiddleware(config);
  }

  guard<T>(
    passport: SignedPassport,
    toolName: string,
    args: Record<string, unknown>,
    handler: () => T,
    spendAmount?: number,
  ): T {
    const context: ToolCallContext = { toolName, arguments: args, spendAmount };
    const result = this.check(passport, context);

    if (!result.allowed) {
      throw new Error(
        `Tool "${toolName}" blocked by passport: ${result.reason}`,
      );
    }

    return handler();
  }

  async guardAsync<T>(
    passport: SignedPassport,
    toolName: string,
    args: Record<string, unknown>,
    handler: () => Promise<T>,
    spendAmount?: number,
  ): Promise<T> {
    const context: ToolCallContext = { toolName, arguments: args, spendAmount };
    const result = this.check(passport, context);

    if (!result.allowed) {
      throw new Error(
        `Tool "${toolName}" blocked by passport: ${result.reason}`,
      );
    }

    return handler();
  }

  guardWithToken<T>(
    token: string,
    toolName: string,
    args: Record<string, unknown>,
    handler: () => T,
    spendAmount?: number,
  ): T {
    const passport = deserializePassport(token);
    return this.guard(passport, toolName, args, handler, spendAmount);
  }

  async guardWithTokenAsync<T>(
    token: string,
    toolName: string,
    args: Record<string, unknown>,
    handler: () => Promise<T>,
    spendAmount?: number,
  ): Promise<T> {
    const passport = deserializePassport(token);
    return this.guardAsync(passport, toolName, args, handler, spendAmount);
  }

  static fromHeader(header: string | undefined | null): SignedPassport | null {
    if (!header) return null;
    const token = header.startsWith('Bearer ') ? header.slice(7) : header;
    if (!token.startsWith('ap1.')) return null;
    try {
      return deserializePassport(token);
    } catch {
      return null;
    }
  }
}
