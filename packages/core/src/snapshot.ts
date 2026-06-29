import type { SignedPassport } from './types.js';

export interface PassportSnapshot {
  version: 1;
  timestamp: number;
  passports: SignedPassport[];
  revoked: string[];
}

export function createSnapshot(
  passports: SignedPassport[],
  isRevoked: (id: string) => boolean,
): PassportSnapshot {
  const revoked = passports
    .filter((p) => isRevoked(p.payload.id))
    .map((p) => p.payload.id);

  return {
    version: 1,
    timestamp: Date.now(),
    passports,
    revoked,
  };
}

export function serializeSnapshot(snapshot: PassportSnapshot): string {
  return JSON.stringify(snapshot);
}

export function deserializeSnapshot(data: string): PassportSnapshot {
  const parsed = JSON.parse(data);
  if (parsed.version !== 1) {
    throw new Error(`Unsupported snapshot version: ${parsed.version}`);
  }
  return parsed as PassportSnapshot;
}
