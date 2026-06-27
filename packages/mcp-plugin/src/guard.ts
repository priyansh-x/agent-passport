import type { SignedPassport } from '@passport-agent/core';
import { PassportIssuer } from '@passport-agent/core';
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
}
