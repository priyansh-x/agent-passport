import type { PassportDB } from './db.js';
import type { WebhookManager } from './webhooks.js';

export class ExpiryWatcher {
  private interval: ReturnType<typeof setInterval> | null = null;
  private notified = new Set<string>();

  constructor(
    private db: PassportDB,
    private webhooks: WebhookManager,
    private checkIntervalMs = 60_000,
  ) {}

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => this.check(), this.checkIntervalMs);
    this.interval.unref();
    this.check();
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  check(): void {
    const now = Date.now();
    const passports = this.db.listPassports();

    for (const row of passports) {
      if (this.notified.has(row.id)) continue;
      if (this.db.isRevoked(row.id)) continue;

      const payload = JSON.parse(row.payload);
      if (now > payload.exp) {
        this.notified.add(row.id);
        this.webhooks.emit('passport.expired', {
          id: row.id,
          agent: payload.sub,
          principal: payload.principal,
          expiredAt: payload.exp,
        });
      }
    }
  }
}
