import type { AuditEntry } from './types.js';

export class AuditLog {
  private entries: AuditEntry[] = [];

  record(entry: Omit<AuditEntry, 'timestamp'>): void {
    this.entries.push({ ...entry, timestamp: Date.now() });
  }

  getByPassport(passportId: string): AuditEntry[] {
    return this.entries.filter((e) => e.passportId === passportId);
  }

  getAll(): AuditEntry[] {
    return [...this.entries];
  }

  get size(): number {
    return this.entries.length;
  }
}
