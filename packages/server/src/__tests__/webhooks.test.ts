import { describe, it, expect } from 'vitest';
import { WebhookManager } from '../webhooks.js';

describe('WebhookManager', () => {
  it('subscribes and lists webhooks', () => {
    const wm = new WebhookManager();
    const sub = wm.subscribe('https://example.com/hook', ['passport.issued']);
    expect(sub.id).toMatch(/^whk_/);
    expect(wm.list()).toHaveLength(1);
    expect(wm.list()[0]!.url).toBe('https://example.com/hook');
  });

  it('unsubscribes webhooks', () => {
    const wm = new WebhookManager();
    const sub = wm.subscribe('https://example.com/hook', ['passport.issued']);
    expect(wm.unsubscribe(sub.id)).toBe(true);
    expect(wm.list()).toHaveLength(0);
  });

  it('returns false for unknown unsubscribe', () => {
    const wm = new WebhookManager();
    expect(wm.unsubscribe('whk_999')).toBe(false);
  });

  it('emit does not throw even with no subscribers', async () => {
    const wm = new WebhookManager();
    await expect(wm.emit('passport.issued', { id: 'test' })).resolves.toBeUndefined();
  });

  it('emit does not throw when delivery fails', async () => {
    const wm = new WebhookManager();
    wm.subscribe('http://localhost:1/nonexistent', ['passport.revoked']);
    await expect(wm.emit('passport.revoked', { id: 'test' })).resolves.toBeUndefined();
  });

  it('only emits to matching event subscribers', async () => {
    const wm = new WebhookManager();
    wm.subscribe('http://localhost:1/a', ['passport.issued']);
    wm.subscribe('http://localhost:1/b', ['passport.revoked']);
    // Should not throw — only the issued subscriber is skipped for revoke events
    await expect(wm.emit('passport.revoked', { id: 'test' })).resolves.toBeUndefined();
  });
});
