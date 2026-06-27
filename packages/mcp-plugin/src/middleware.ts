import type { SignedPassport, AuthorizeResult } from '@passport-agent/core';
import { PassportIssuer } from '@passport-agent/core';

export interface ToolCallContext {
  toolName: string;
  arguments: Record<string, unknown>;
  spendAmount?: number;
}

export interface ToolCallResult {
  allowed: boolean;
  reason?: string;
  passportId: string;
}

export interface MiddlewareConfig {
  issuer: PassportIssuer;
  permissionMapper?: (toolName: string) => string;
  onDenied?: (context: ToolCallContext, result: ToolCallResult) => void;
  onAllowed?: (context: ToolCallContext, result: ToolCallResult) => void;
}

export function createPassportMiddleware(config: MiddlewareConfig) {
  const { issuer, permissionMapper, onDenied, onAllowed } = config;

  const mapPermission = permissionMapper ?? ((toolName: string) => `tool:${toolName}`);

  return function checkPassport(
    passport: SignedPassport,
    context: ToolCallContext,
  ): ToolCallResult {
    const permission = mapPermission(context.toolName);
    const authResult = issuer.authorize(passport, permission, context.spendAmount ?? 0);

    const result: ToolCallResult = {
      allowed: authResult.allowed,
      reason: authResult.reason,
      passportId: authResult.passportId,
    };

    if (authResult.allowed) {
      onAllowed?.(context, result);
    } else {
      onDenied?.(context, result);
    }

    return result;
  };
}
