export interface ScopeDefinition {
  name: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  implies?: string[];
}

export class ScopeRegistry {
  private scopes = new Map<string, ScopeDefinition>();

  register(scope: ScopeDefinition): void {
    this.scopes.set(scope.name, scope);
  }

  registerMany(scopes: ScopeDefinition[]): void {
    for (const s of scopes) this.register(s);
  }

  get(name: string): ScopeDefinition | undefined {
    return this.scopes.get(name);
  }

  has(name: string): boolean {
    return this.scopes.has(name);
  }

  list(): ScopeDefinition[] {
    return [...this.scopes.values()];
  }

  riskLevel(name: string): 'low' | 'medium' | 'high' | 'unknown' {
    const scope = this.scopes.get(name);
    if (scope) return scope.risk;
    if (name.endsWith(':read')) return 'low';
    if (name.endsWith(':write')) return 'medium';
    if (name.endsWith(':delete') || name.endsWith(':*') || name === '*') return 'high';
    return 'unknown';
  }

  expandImplied(permissions: string[]): string[] {
    const expanded = new Set(permissions);
    const queue = [...permissions];
    while (queue.length > 0) {
      const perm = queue.pop()!;
      const scope = this.scopes.get(perm);
      if (scope?.implies) {
        for (const implied of scope.implies) {
          if (!expanded.has(implied)) {
            expanded.add(implied);
            queue.push(implied);
          }
        }
      }
    }
    return [...expanded];
  }

  validate(permissions: string[]): { valid: boolean; unknown: string[] } {
    const unknown = permissions.filter((p) => !this.scopes.has(p) && !p.includes('*'));
    return { valid: unknown.length === 0, unknown };
  }
}

export const DEFAULT_SCOPES: ScopeDefinition[] = [
  { name: 'read', description: 'Read-only access', risk: 'low' },
  { name: 'write', description: 'Create and modify resources', risk: 'medium' },
  { name: 'delete', description: 'Permanently remove resources', risk: 'high' },
  { name: 'admin', description: 'Full administrative access', risk: 'high', implies: ['read', 'write', 'delete'] },
  { name: 'email:read', description: 'Read email messages', risk: 'low' },
  { name: 'email:send', description: 'Send emails', risk: 'medium' },
  { name: 'email:*', description: 'Full email access', risk: 'high', implies: ['email:read', 'email:send'] },
  { name: 'calendar:read', description: 'View calendar events', risk: 'low' },
  { name: 'calendar:write', description: 'Create/modify calendar events', risk: 'medium' },
  { name: 'calendar:*', description: 'Full calendar access', risk: 'medium', implies: ['calendar:read', 'calendar:write'] },
  { name: 'files:read', description: 'Read files', risk: 'low' },
  { name: 'files:write', description: 'Upload and modify files', risk: 'medium' },
  { name: 'files:delete', description: 'Delete files', risk: 'high' },
  { name: 'files:*', description: 'Full file access', risk: 'high', implies: ['files:read', 'files:write', 'files:delete'] },
  { name: 'payment:charge', description: 'Make payments', risk: 'high' },
  { name: 'payment:refund', description: 'Issue refunds', risk: 'high' },
  { name: 'payment:*', description: 'Full payment access', risk: 'high', implies: ['payment:charge', 'payment:refund'] },
];

export function createDefaultRegistry(): ScopeRegistry {
  const registry = new ScopeRegistry();
  registry.registerMany(DEFAULT_SCOPES);
  return registry;
}
