import type { SignedPassport, AuthorizeResult } from '@passport-agent/core';
import { PassportIssuer } from '@passport-agent/core';

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
  onAuthorized?: (toolName: string, result: AuthorizeResult) => void;
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

      config.onAuthorized?.(tool.name, authResult);
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

/**
 * LangChain-compatible tool interface.
 * Mirrors @langchain/core StructuredToolInterface so users can
 * integrate without adding @langchain/core as a hard dependency.
 */
export interface LangChainToolInput {
  name: string;
  description: string;
  schema?: Record<string, unknown>;
  invoke: (input: Record<string, unknown>) => Promise<string>;
}

export interface PassportCallbackHandler {
  onToolStart?: (tool: string, input: Record<string, unknown>) => void;
  onToolEnd?: (tool: string, output: string) => void;
  onToolError?: (tool: string, error: Error) => void;
}

export function wrapLangChainTool(
  tool: LangChainToolInput,
  passport: SignedPassport,
  config: PassportToolConfig & { callbacks?: PassportCallbackHandler },
): LangChainToolInput {
  const mapPermission = config.permissionMapper ?? ((name: string) => `tool:${name}`);
  const mapSpend = config.spendMapper ?? (() => 0);

  return {
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    invoke: async (input: Record<string, unknown>) => {
      config.callbacks?.onToolStart?.(tool.name, input);

      const permission = mapPermission(tool.name);
      const spend = mapSpend(tool.name, input);
      const authResult = config.issuer.authorize(passport, permission, spend);

      if (!authResult.allowed) {
        const err = new Error(`Tool "${tool.name}" denied: ${authResult.reason}`);
        config.onDenied?.(tool.name, authResult.reason ?? 'Unknown');
        config.callbacks?.onToolError?.(tool.name, err);
        throw err;
      }

      config.onAuthorized?.(tool.name, authResult);
      const output = await tool.invoke(input);
      config.callbacks?.onToolEnd?.(tool.name, output);
      return output;
    },
  };
}

export function wrapLangChainToolkit(
  tools: LangChainToolInput[],
  passport: SignedPassport,
  config: PassportToolConfig & { callbacks?: PassportCallbackHandler },
): LangChainToolInput[] {
  return tools.map((tool) => wrapLangChainTool(tool, passport, config));
}
