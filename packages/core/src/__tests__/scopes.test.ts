import { describe, it, expect } from 'vitest';
import { ScopeRegistry, createDefaultRegistry } from '../scopes.js';

describe('ScopeRegistry', () => {
  it('registers and retrieves scopes', () => {
    const reg = new ScopeRegistry();
    reg.register({ name: 'test:read', description: 'Read test', risk: 'low' });
    expect(reg.has('test:read')).toBe(true);
    expect(reg.get('test:read')?.risk).toBe('low');
  });

  it('lists all scopes', () => {
    const reg = createDefaultRegistry();
    const scopes = reg.list();
    expect(scopes.length).toBeGreaterThan(10);
  });

  it('infers risk from suffix', () => {
    const reg = new ScopeRegistry();
    expect(reg.riskLevel('foo:read')).toBe('low');
    expect(reg.riskLevel('foo:write')).toBe('medium');
    expect(reg.riskLevel('foo:delete')).toBe('high');
    expect(reg.riskLevel('foo:*')).toBe('high');
    expect(reg.riskLevel('something')).toBe('unknown');
  });

  it('uses registered risk over inference', () => {
    const reg = new ScopeRegistry();
    reg.register({ name: 'foo:read', description: 'Actually high risk', risk: 'high' });
    expect(reg.riskLevel('foo:read')).toBe('high');
  });

  it('expands implied permissions', () => {
    const reg = createDefaultRegistry();
    const expanded = reg.expandImplied(['admin']);
    expect(expanded).toContain('admin');
    expect(expanded).toContain('read');
    expect(expanded).toContain('write');
    expect(expanded).toContain('delete');
  });

  it('expands transitive implications', () => {
    const reg = new ScopeRegistry();
    reg.register({ name: 'super', description: '', risk: 'high', implies: ['admin'] });
    reg.register({ name: 'admin', description: '', risk: 'high', implies: ['write'] });
    reg.register({ name: 'write', description: '', risk: 'medium' });

    const expanded = reg.expandImplied(['super']);
    expect(expanded).toEqual(expect.arrayContaining(['super', 'admin', 'write']));
  });

  it('validates permissions against registry', () => {
    const reg = createDefaultRegistry();
    expect(reg.validate(['read', 'write']).valid).toBe(true);
    const result = reg.validate(['read', 'nonexistent']);
    expect(result.valid).toBe(false);
    expect(result.unknown).toEqual(['nonexistent']);
  });

  it('skips wildcard permissions in validation', () => {
    const reg = createDefaultRegistry();
    expect(reg.validate(['custom:*']).valid).toBe(true);
  });
});
