import { describe, it, expect } from 'vitest';
import { TEMPLATES, fromTemplate } from '../templates.js';

describe('templates', () => {
  it('has all expected templates', () => {
    expect(Object.keys(TEMPLATES)).toEqual(['readonly', 'readwrite', 'spender', 'automation', 'admin']);
  });

  it('fromTemplate produces valid IssueOptions', () => {
    const opts = fromTemplate('readonly', 'user:alice', 'agent:bot');
    expect(opts.principal).toBe('user:alice');
    expect(opts.agent).toBe('agent:bot');
    expect(opts.permissions).toContain('read');
    expect(opts.limits!.maxSpend).toBe(0);
  });

  it('fromTemplate supports overrides', () => {
    const opts = fromTemplate('spender', 'user:bob', 'agent:shop', {
      limits: { maxSpend: 50 },
    });
    expect(opts.limits!.maxSpend).toBe(50);
  });

  it('fromTemplate throws on unknown template', () => {
    expect(() => fromTemplate('nonexistent', 'u', 'a')).toThrow('Unknown template');
  });
});
