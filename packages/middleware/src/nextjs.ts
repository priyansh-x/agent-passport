import { createMiddlewareHandler, type MiddlewareConfig } from './core.js';

export interface NextRequest {
  method: string;
  nextUrl: { pathname: string };
  headers: { get(name: string): string | null };
}

export interface NextResponse {
  json(body: unknown, init?: { status?: number }): NextResponse;
}

export function nextjsPassport(
  config: MiddlewareConfig,
  NextResponseClass: { json(body: unknown, init?: { status?: number }): unknown },
) {
  const handle = createMiddlewareHandler(config);
  const headerName = config.headerName ?? 'x-agent-passport';

  return function passportMiddleware(req: NextRequest) {
    const headers: Record<string, string | undefined> = {};
    const val = req.headers.get(headerName);
    if (val) headers[headerName] = val;

    const result = handle(
      req.method,
      req.nextUrl.pathname,
      headers,
    );

    if (!result.allowed) {
      return NextResponseClass.json(result.body, { status: result.status });
    }

    return null;
  };
}
