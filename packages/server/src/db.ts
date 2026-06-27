import Database from 'better-sqlite3';
import type { AuditEntry } from '@agent-passport/core';

export class PassportDB {
  private db: Database.Database;

  constructor(path = ':memory:') {
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS passports (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        signature TEXT NOT NULL,
        public_key TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );

      CREATE TABLE IF NOT EXISTS revocations (
        passport_id TEXT PRIMARY KEY,
        revoked_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        passport_id TEXT NOT NULL,
        action TEXT NOT NULL,
        allowed INTEGER NOT NULL,
        reason TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_passport ON audit_log(passport_id);

      CREATE TABLE IF NOT EXISTS spend_tracking (
        passport_id TEXT PRIMARY KEY,
        spent REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD'
      );

      CREATE TABLE IF NOT EXISTS delegation_tree (
        parent_id TEXT NOT NULL,
        child_id TEXT NOT NULL,
        PRIMARY KEY (parent_id, child_id)
      );

      CREATE INDEX IF NOT EXISTS idx_delegation_child ON delegation_tree(child_id);
    `);
  }

  savePassport(id: string, payload: string, signature: string, publicKey: string) {
    this.db.prepare(
      'INSERT INTO passports (id, payload, signature, public_key) VALUES (?, ?, ?, ?)',
    ).run(id, payload, signature, publicKey);
  }

  listPassports() {
    return this.db.prepare('SELECT * FROM passports ORDER BY created_at DESC').all() as Array<{ id: string; payload: string; signature: string; public_key: string }>;
  }

  getPassport(id: string) {
    return this.db.prepare('SELECT * FROM passports WHERE id = ?').get(id) as
      | { id: string; payload: string; signature: string; public_key: string }
      | undefined;
  }

  addRevocation(passportId: string) {
    this.db.prepare(
      'INSERT OR IGNORE INTO revocations (passport_id) VALUES (?)',
    ).run(passportId);
  }

  isRevoked(passportId: string): boolean {
    const row = this.db.prepare(
      'SELECT 1 FROM revocations WHERE passport_id = ?',
    ).get(passportId);
    return !!row;
  }

  addAuditEntry(entry: AuditEntry) {
    this.db.prepare(
      'INSERT INTO audit_log (passport_id, action, allowed, reason, timestamp) VALUES (?, ?, ?, ?, ?)',
    ).run(entry.passportId, entry.action, entry.allowed ? 1 : 0, entry.reason ?? null, entry.timestamp);
  }

  getAuditLog(passportId: string): AuditEntry[] {
    const rows = this.db.prepare(
      'SELECT * FROM audit_log WHERE passport_id = ? ORDER BY timestamp ASC',
    ).all(passportId) as Array<{ passport_id: string; action: string; allowed: number; reason: string | null; timestamp: number }>;

    return rows.map((r) => ({
      passportId: r.passport_id,
      action: r.action,
      resource: undefined,
      allowed: r.allowed === 1,
      reason: r.reason ?? undefined,
      timestamp: r.timestamp,
    }));
  }

  getRecentAudit(limit = 50): AuditEntry[] {
    const rows = this.db.prepare(
      'SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?',
    ).all(limit) as Array<{ passport_id: string; action: string; allowed: number; reason: string | null; timestamp: number }>;

    return rows.map((r) => ({
      passportId: r.passport_id,
      action: r.action,
      resource: undefined,
      allowed: r.allowed === 1,
      reason: r.reason ?? undefined,
      timestamp: r.timestamp,
    }));
  }

  getSpent(passportId: string): number {
    const row = this.db.prepare(
      'SELECT spent FROM spend_tracking WHERE passport_id = ?',
    ).get(passportId) as { spent: number } | undefined;
    return row?.spent ?? 0;
  }

  addSpend(passportId: string, amount: number, currency = 'USD') {
    this.db.prepare(
      'INSERT INTO spend_tracking (passport_id, spent, currency) VALUES (?, ?, ?) ON CONFLICT(passport_id) DO UPDATE SET spent = spent + ?',
    ).run(passportId, amount, currency, amount);
  }

  registerChild(parentId: string, childId: string) {
    this.db.prepare(
      'INSERT OR IGNORE INTO delegation_tree (parent_id, child_id) VALUES (?, ?)',
    ).run(parentId, childId);
  }

  getChildren(parentId: string): string[] {
    const rows = this.db.prepare(
      'SELECT child_id FROM delegation_tree WHERE parent_id = ?',
    ).all(parentId) as Array<{ child_id: string }>;
    return rows.map((r) => r.child_id);
  }

  cascadeRevoke(passportId: string): string[] {
    const revoked: string[] = [];
    const queue = [passportId];
    while (queue.length > 0) {
      const id = queue.pop()!;
      if (this.isRevoked(id)) continue;
      this.addRevocation(id);
      revoked.push(id);
      const children = this.getChildren(id);
      for (const child of children) queue.push(child);
    }
    return revoked;
  }

  close() {
    this.db.close();
  }
}
