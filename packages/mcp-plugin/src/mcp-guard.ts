import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { PassportIssuer, SignedPassport, AuthorizeResult } from '@passport-agent/core';
import { deserializePassport } from '@passport-agent/core';

export interface PassportGuardOptions {
  issuer: PassportIssuer;
  permissionMapper?: (toolName: string) => string;
  extractPassport?: (request: { _meta?: Record<string, unknown> }) => string | SignedPassport | null;
  onDenied?: (toolName: string, result: AuthorizeResult) => void;
  onAllowed?: (toolName: string, result: AuthorizeResult) => void;
}

export function passportGuard(server: McpServer, options: PassportGuardOptions): McpServer {
  const { issuer, permissionMapper, extractPassport, onDenied, onAllowed } = options;

  const mapPermission = permissionMapper ?? ((tool: string) => `tool:${tool}`);

  const extract = extractPassport ?? ((req: { _meta?: Record<string, unknown> }) => {
    const meta = req._meta;
    if (!meta) return null;
    const token = meta['x-passport'] ?? meta['passport'];
    if (typeof token === 'string') return token;
    return null;
  });

  const originalTool = server.tool.bind(server);
  const toolProxy = new Proxy(originalTool, {
    apply(target, thisArg, args: unknown[]) {
      const lastIdx = args.length - 1;
      const originalCb = args[lastIdx] as (...cbArgs: unknown[]) => unknown;

      args[lastIdx] = (...cbArgs: unknown[]) => {
        const extra = cbArgs[cbArgs.length - 1] as { _meta?: Record<string, unknown> };
        const toolArgs = cbArgs.length > 1 ? cbArgs[0] : undefined;

        const toolName: string = typeof args[0] === 'string' ? args[0] : 'unknown';
        const permission = mapPermission(toolName);

        const raw = extract(extra ?? {});
        if (!raw) {
          const denied: AuthorizeResult = {
            allowed: false,
            reason: 'No passport provided in request _meta',
            passportId: '',
          };
          onDenied?.(toolName, denied);
          return {
            content: [{ type: 'text' as const, text: `Denied: ${denied.reason}` }],
            isError: true,
          };
        }

        let passport: SignedPassport;
        if (typeof raw === 'string') {
          try {
            passport = deserializePassport(raw);
          } catch {
            const denied: AuthorizeResult = {
              allowed: false,
              reason: 'Invalid passport token',
              passportId: '',
            };
            onDenied?.(toolName, denied);
            return {
              content: [{ type: 'text' as const, text: `Denied: ${denied.reason}` }],
              isError: true,
            };
          }
        } else {
          passport = raw;
        }

        const result = issuer.authorize(passport, permission);

        if (!result.allowed) {
          onDenied?.(toolName, result);
          return {
            content: [{ type: 'text' as const, text: `Denied: ${result.reason}` }],
            isError: true,
          };
        }

        onAllowed?.(toolName, result);
        return originalCb(...cbArgs);
      };

      return Reflect.apply(target, thisArg, args);
    },
  });

  (server as { tool: typeof server.tool }).tool = toolProxy as typeof server.tool;

  return server;
}
