import { createMiddlewareHandler, type MiddlewareConfig, type PassportContext } from './core.js';

export interface ExpressRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  passportContext?: PassportContext;
}

export interface ExpressResponse {
  status(code: number): ExpressResponse;
  json(body: unknown): void;
}

export type ExpressNextFunction = (err?: unknown) => void;

export function expressPassport(config: MiddlewareConfig) {
  const handle = createMiddlewareHandler(config);

  return function passportMiddleware(
    req: ExpressRequest,
    res: ExpressResponse,
    next: ExpressNextFunction,
  ) {
    const result = handle(req.method, req.path, req.headers);

    if (!result.allowed) {
      res.status(result.status).json(result.body);
      return;
    }

    req.passportContext = result.context;
    next();
  };
}
