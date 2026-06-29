import type { SignedPassport } from './types.js';
import { verify, fromHex, encodePayload } from './crypto.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePassport(
  passport: SignedPassport,
  options: {
    checkExpiry?: boolean;
    checkSignature?: boolean;
    isRevoked?: (id: string) => boolean;
    now?: number;
  } = {},
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const now = options.now ?? Date.now();
  const { payload } = passport;

  if (!payload.id) errors.push('Missing passport ID');
  if (!payload.iss) errors.push('Missing issuer (iss)');
  if (!payload.sub) errors.push('Missing subject (sub)');
  if (!payload.principal) errors.push('Missing principal');
  if (!payload.iat) errors.push('Missing issued-at (iat)');
  if (!payload.exp) errors.push('Missing expiration (exp)');
  if (!payload.nonce) errors.push('Missing nonce');

  if (!payload.permissions || payload.permissions.length === 0) {
    errors.push('No permissions defined');
  }

  if (payload.permissions && payload.permissions.length > 50) {
    errors.push(`Too many permissions: ${payload.permissions.length} (max 50)`);
  }

  if (options.checkExpiry !== false && payload.iat && payload.exp && payload.exp <= payload.iat) {
    errors.push('Expiration is before or equal to issued-at');
  }

  if (options.checkExpiry !== false && payload.exp && now > payload.exp) {
    errors.push(`Passport expired ${Math.round((now - payload.exp) / 1000)}s ago`);
  }

  if (payload.iat && payload.iat > now + 60_000) {
    warnings.push('Passport issued-at is in the future');
  }

  if (payload.limits) {
    if (payload.limits.maxSpend < 0) errors.push('Negative spend limit');
    if (payload.limits.spent < 0) errors.push('Negative spent amount');
    if (payload.limits.spent > payload.limits.maxSpend) {
      errors.push(`Spent (${payload.limits.spent}) exceeds limit (${payload.limits.maxSpend})`);
    }
  }

  if (options.checkSignature !== false) {
    try {
      const message = encodePayload(payload);
      const sigValid = verify(fromHex(passport.signature), message, fromHex(passport.publicKey));
      if (!sigValid) errors.push('Invalid signature');
    } catch {
      errors.push('Signature verification failed (malformed key or signature)');
    }
  }

  if (options.isRevoked && options.isRevoked(payload.id)) {
    errors.push('Passport has been revoked');
  }

  const expiresIn = payload.exp - now;
  if (expiresIn > 0 && expiresIn < 300_000) {
    warnings.push(`Passport expires in ${Math.round(expiresIn / 1000)}s`);
  }

  if (payload.exp - payload.iat > 30 * 24 * 60 * 60 * 1000) {
    warnings.push('Passport validity exceeds 30 days');
  }

  return { valid: errors.length === 0, errors, warnings };
}
