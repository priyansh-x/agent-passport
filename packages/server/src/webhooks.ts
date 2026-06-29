export type WebhookEvent =
  | 'passport.issued'
  | 'passport.authorized'
  | 'passport.denied'
  | 'passport.revoked'
  | 'passport.delegated'
  | 'passport.expired';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  createdAt: number;
}

export class WebhookManager {
  private subscriptions: WebhookSubscription[] = [];
  private idCounter = 0;

  subscribe(url: string, events: WebhookEvent[], secret?: string): WebhookSubscription {
    const sub: WebhookSubscription = {
      id: `whk_${++this.idCounter}`,
      url,
      events,
      secret,
      createdAt: Date.now(),
    };
    this.subscriptions.push(sub);
    return sub;
  }

  unsubscribe(id: string): boolean {
    const idx = this.subscriptions.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    this.subscriptions.splice(idx, 1);
    return true;
  }

  list(): WebhookSubscription[] {
    return [...this.subscriptions];
  }

  async emit(event: WebhookEvent, data: Record<string, unknown>): Promise<void> {
    const payload: WebhookPayload = { event, timestamp: Date.now(), data };
    const matching = this.subscriptions.filter((s) => s.events.includes(event));

    await Promise.allSettled(
      matching.map((sub) => this.deliver(sub, payload)),
    );
  }

  private async deliver(sub: WebhookSubscription, payload: WebhookPayload): Promise<void> {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sub.secret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(sub.secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
      headers['x-passport-signature'] = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }

    try {
      await fetch(sub.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(5000) });
    } catch {
      // Fire-and-forget: webhook delivery failures are silently ignored
    }
  }
}
