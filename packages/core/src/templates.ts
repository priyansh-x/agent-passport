import type { IssueOptions } from './types.js';

export interface PassportTemplate {
  name: string;
  description: string;
  options: Omit<IssueOptions, 'principal' | 'agent'>;
}

export const TEMPLATES: Record<string, PassportTemplate> = {
  readonly: {
    name: 'Read-Only',
    description: 'Can only read data, no writes or deletes',
    options: {
      permissions: ['read', 'list', 'get', 'search'],
      limits: { maxSpend: 0 },
      expiresIn: 24 * 60 * 60 * 1000,
    },
  },
  readwrite: {
    name: 'Read-Write',
    description: 'Can read and write data, no deletes or admin actions',
    options: {
      permissions: ['read', 'list', 'get', 'search', 'write', 'create', 'update'],
      limits: { maxSpend: 0 },
      expiresIn: 8 * 60 * 60 * 1000,
    },
  },
  spender: {
    name: 'Spending Agent',
    description: 'Can make purchases up to $100',
    options: {
      permissions: ['read', 'purchase', 'order'],
      limits: { maxSpend: 100, currency: 'USD' },
      expiresIn: 4 * 60 * 60 * 1000,
    },
  },
  automation: {
    name: 'Automation',
    description: 'Background task agent with broad read/write but no admin',
    options: {
      permissions: ['read', 'write', 'create', 'update', 'delete', 'list', 'execute'],
      limits: { maxSpend: 0 },
      expiresIn: 30 * 60 * 1000,
    },
  },
  admin: {
    name: 'Admin',
    description: 'Full admin access (use sparingly, short-lived)',
    options: {
      permissions: ['admin', 'read', 'write', 'create', 'update', 'delete', 'list', 'execute', 'configure'],
      limits: { maxSpend: 1000 },
      expiresIn: 15 * 60 * 1000,
    },
  },
};

export function fromTemplate(
  templateName: string,
  principal: string,
  agent: string,
  overrides?: Partial<Omit<IssueOptions, 'principal' | 'agent'>>,
): IssueOptions {
  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(`Unknown template "${templateName}". Available: ${Object.keys(TEMPLATES).join(', ')}`);
  }
  return {
    principal,
    agent,
    ...template.options,
    ...overrides,
    permissions: overrides?.permissions ?? template.options.permissions,
    limits: { maxSpend: template.options.limits?.maxSpend ?? 0, ...template.options.limits, ...overrides?.limits },
  };
}
