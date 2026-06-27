import type { SignedPassport, AuthorizeResult } from '@agent-passport/core';
import { PassportIssuer } from '@agent-passport/core';

export interface ToolDefinition {
  name: string;
  description: string;
  execute: (args: Record<string, unknown>) => unknown | Promise<unknown>;
}

export interface ToolResult {
  name: string;
  result?: unknown;
  error?: string;
  authorized: boolean;
}

export interface PassportToolConfig {
  issuer: PassportIssuer;
  permissionMapper?: (toolName: string) => string;
  spendMapper?: (toolName: string, args: Record<string, unknown>) => number;
  onDenied?: (toolName: string, reason: string) => void;
}

export function withPassport(
  tool: ToolDefinition,
  passport: SignedPassport,
  config: PassportToolConfig,
): ToolDefinition {
  const mapPermission = config.permissionMapper ?? ((name: string) => `tool:${name}`);
  const mapSpend = config.spendMapper ?? (() => 0);

  return {
    name: tool.name,
    description: tool.description,
    execute: async (args: Record<string, unknown>) => {
      const permission = mapPermission(tool.name);
      const spend = mapSpend(tool.name, args);
      const authResult = config.issuer.authorize(passport, permission, spend);

      if (!authResult.allowed) {
        const msg = `Tool "${tool.name}" denied: ${authResult.reason}`;
        config.onDenied?.(tool.name, authResult.reason ?? 'Unknown');
        throw new Error(msg);
      }

      return tool.execute(args);
    },
  };
}

export function createPassportToolkit(
  tools: ToolDefinition[],
  passport: SignedPassport,
  config: PassportToolConfig,
): ToolDefinition[] {
  return tools.map((tool) => withPassport(tool, passport, config));
}
