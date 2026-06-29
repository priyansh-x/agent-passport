import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import Database from 'better-sqlite3';

export interface BackupResult {
  path: string;
  size: number;
  timestamp: number;
}

export function backupDatabase(dbPath: string, backupDir: string): BackupResult {
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });

  const timestamp = Date.now();
  const name = `passport-backup-${timestamp}.db`;
  const dest = join(backupDir, name);

  const source = new Database(dbPath, { readonly: true });
  source.backup(dest).then(() => source.close());

  return {
    path: dest,
    size: existsSync(dest) ? statSync(dest).size : 0,
    timestamp,
  };
}

export function listBackups(backupDir: string): BackupResult[] {
  if (!existsSync(backupDir)) return [];

  return readdirSync(backupDir)
    .filter((f) => f.startsWith('passport-backup-') && f.endsWith('.db'))
    .map((f) => {
      const full = join(backupDir, f);
      const ts = parseInt(f.replace('passport-backup-', '').replace('.db', ''));
      return { path: full, size: statSync(full).size, timestamp: ts };
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}
