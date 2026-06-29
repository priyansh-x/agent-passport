import type { SignedPassport } from './types.js';

export interface RedactOptions {
  showId?: boolean;
  showPrincipal?: boolean;
  showAgent?: boolean;
  showPermissions?: boolean;
  truncateId?: number;
}

const DEFAULTS: Required<RedactOptions> = {
  showId: true,
  showPrincipal: false,
  showAgent: true,
  showPermissions: true,
  truncateId: 8,
};

export function redactPassport(passport: SignedPassport, options?: RedactOptions) {
  const opts = { ...DEFAULTS, ...options };
  const { payload } = passport;

  return {
    id: opts.showId ? (opts.truncateId > 0 ? payload.id.slice(0, opts.truncateId) + '...' : payload.id) : '[REDACTED]',
    principal: opts.showPrincipal ? payload.principal : '[REDACTED]',
    agent: opts.showAgent ? payload.sub : '[REDACTED]',
    permissions: opts.showPermissions ? payload.permissions.map((p) => p.action) : '[REDACTED]',
    expiresAt: new Date(payload.exp).toISOString(),
    signature: '[REDACTED]',
    publicKey: '[REDACTED]',
  };
}
