import type { PassportDB } from './db.js';

export interface ExportData {
  version: 1;
  exportedAt: string;
  passports: Array<{
    id: string;
    payload: Record<string, unknown>;
    signature: string;
    publicKey: string;
    revoked: boolean;
  }>;
  stats: ReturnType<PassportDB['getStats']>;
}

export function exportAll(db: PassportDB): ExportData {
  const rows = db.listPassports();
  const passports = rows.map((r) => ({
    id: r.id,
    payload: JSON.parse(r.payload),
    signature: r.signature,
    publicKey: r.public_key,
    revoked: db.isRevoked(r.id),
  }));

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    passports,
    stats: db.getStats(),
  };
}
