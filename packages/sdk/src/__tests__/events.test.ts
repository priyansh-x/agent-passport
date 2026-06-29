import { describe, it, expect, vi } from 'vitest';
import { PassportEvents } from '../events.js';

describe('PassportEvents', () => {
  it('emits and receives events', () => {
    const events = new PassportEvents();
    const handler = vi.fn();
    events.on('authorize', handler);
    events.emit('authorize', { passportId: '123', action: 'read', allowed: true });
    expect(handler).toHaveBeenCalledWith({ passportId: '123', action: 'read', allowed: true });
  });

  it('supports unsubscribe', () => {
    const events = new PassportEvents();
    const handler = vi.fn();
    const unsub = events.on('authorize', handler);
    unsub();
    events.emit('authorize', { passportId: '123', action: 'read', allowed: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it('once fires only once', () => {
    const events = new PassportEvents();
    const handler = vi.fn();
    events.once('revoke', handler);
    events.emit('revoke', { passportId: '1', count: 1 });
    events.emit('revoke', { passportId: '2', count: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('removeAll clears listeners', () => {
    const events = new PassportEvents();
    const handler = vi.fn();
    events.on('authorize', handler);
    events.removeAll();
    events.emit('authorize', { passportId: '1', action: 'x', allowed: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it('removeAll with specific event', () => {
    const events = new PassportEvents();
    const h1 = vi.fn();
    const h2 = vi.fn();
    events.on('authorize', h1);
    events.on('revoke', h2);
    events.removeAll('authorize');
    events.emit('authorize', { passportId: '1', action: 'x', allowed: true });
    events.emit('revoke', { passportId: '1', count: 1 });
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });
});
