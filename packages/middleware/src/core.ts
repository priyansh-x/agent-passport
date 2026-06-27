import { PassportIssuer, type SignedPassport, type AuthorizeResult } from '@passport-agent/core';

export interface MiddlewareConfig {
  issuer: PassportIssuer;
  headerName?: string;
  extractAction?: (method: string, path: string) => string;
  onDenied?: (result: AuthorizeResult, action: string) => void;
  onAllowed?: (result: AuthorizeResult, action: string) => void;
}

export interface PassportContext {
  passport: SignedPassport;
  result: AuthorizeResult;
}

const DEFAULT_HEADER = 'x-agent-passport';

export function parsePassportHeader(
  header: string | undefined | null,
  issuer: PassportIssuer,
): SignedPassport | null {
  if (!header) return null;
  try {
    const parsed = JSON.parse(header);
    if (parsed.payload && parsed.signature && parsed.publicKey) {
      if (issuer.verifySignature(parsed)) {
        return parsed;
      }
    }
  } catch {
    // not valid JSON passport
  }
  return null;
}

export function defaultActionExtractor(method: string, path: string): string {
  const verb = method.toLowerCase();
  const resource = path.split('/').filter(Boolean).slice(0, 2).join(':') || 'root';
  return `${resource}:${verb}`;
}

export function createMiddlewareHandler(config: MiddlewareConfig) {
  const headerName = config.headerName ?? DEFAULT_HEADER;
  const extractAction = config.extractAction ?? defaultActionExtractor;

  return function handle(
    method: string,
    path: string,
    headers: Record<string, string | string[] | undefined>,
  ): { allowed: true; context: PassportContext } | { allowed: false; status: number; body: object } {
    const raw = headers[headerName];
    const headerValue = Array.isArray(raw) ? raw[0] : raw;
    const passport = parsePassportHeader(headerValue, config.issuer);

    if (!passport) {
      return {
        allowed: false,
        status: 401,
        body: {
          error: 'Missing or invalid agent passport',
          hint: `Provide a signed passport in the "${headerName}" header`,
        },
      };
    }

    const action = extractAction(method, path);
    const result = config.issuer.authorize(passport, action);

    if (!result.allowed) {
      config.onDenied?.(result, action);
      return {
        allowed: false,
        status: 403,
        body: {
          error: 'Agent passport denied',
          action,
          reason: result.reason,
          passportId: result.passportId,
        },
      };
    }

    config.onAllowed?.(result, action);
    return { allowed: true, context: { passport, result } };
  };
}
