import { createMiddlewareHandler, type MiddlewareConfig, type PassportContext } from './core.js';

export interface FastifyRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  passportContext?: PassportContext;
}

export interface FastifyReply {
  status(code: number): FastifyReply;
  send(body: unknown): void;
}

export function fastifyPassport(config: MiddlewareConfig) {
  const handle = createMiddlewareHandler(config);

  return async function passportHook(req: FastifyRequest, reply: FastifyReply) {
    const path = req.url.split('?')[0] ?? req.url;
    const result = handle(req.method, path, req.headers);

    if (!result.allowed) {
      reply.status(result.status).send(result.body);
      return;
    }

    req.passportContext = result.context;
  };
}
