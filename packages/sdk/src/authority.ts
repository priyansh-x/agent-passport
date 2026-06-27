import { PassportIssuer } from '@passport-agent/core';

export interface AuthorityConfig {
  issuer?: string;
}

let defaultAuthority: PassportIssuer | null = null;

export function createPassportAuthority(config?: AuthorityConfig): PassportIssuer {
  const authority = new PassportIssuer();
  if (!defaultAuthority) {
    defaultAuthority = authority;
  }
  return authority;
}

export function getDefaultAuthority(): PassportIssuer {
  if (!defaultAuthority) {
    defaultAuthority = new PassportIssuer();
  }
  return defaultAuthority;
}
