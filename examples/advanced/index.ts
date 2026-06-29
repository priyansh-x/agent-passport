import { passport, requirePassport, withBudget, createGuardedProxy } from '@passport-agent/sdk';
import { PassportIssuer, formatPassport, validatePassport, policy, serializePassport, deserializePassport } from '@passport-agent/core';

const issuer = new PassportIssuer();

// === 1. Fluent Builder API ===
console.log('=== Fluent Builder API ===');
const p = passport()
  .for('user:alice@company.com')
  .agent('agent:finance-bot')
  .allow('invoices:read', 'invoices:create', 'payment:charge')
  .budget(1000, 'USD')
  .expiresInHours(8)
  .withIssuer(issuer)
  .build();

console.log(`Passport: ${p.id.slice(0, 8)}… | ${p.agent} ← ${p.principal} | ${p.permissions.join(', ')}`);
console.log();

// === 2. Token Serialization ===
console.log('=== Token Serialization ===');
const token = p.toToken();
console.log('Compact token:', token.slice(0, 60) + '...');
console.log('Token length:', token.length, 'chars');
console.log();

// === 3. Guard Utilities ===
console.log('=== Guard Utilities ===');

const createInvoice = requirePassport(p, 'invoices:create', (customer: string, amount: number) => {
  return { id: 'INV-001', customer, amount };
});

const invoice = createInvoice('Acme Corp', 250);
console.log('Created invoice:', invoice);

withBudget(p, 'payment:charge', 250, () => {
  console.log('Payment of $250 authorized and processed');
});
console.log();

// === 4. Guarded Proxy ===
console.log('=== Guarded Proxy ===');
const invoiceService = {
  list: () => ['INV-001', 'INV-002'],
  create: (customer: string) => ({ id: 'INV-003', customer }),
  delete: (_id: string) => { throw new Error('should not reach here'); },
};

const guarded = createGuardedProxy(invoiceService, p, {
  list: 'invoices:read',
  create: 'invoices:create',
  delete: 'invoices:delete',
});

console.log('list():', guarded.list());
console.log('create():', (guarded as typeof invoiceService).create('Widget Co'));
try {
  (guarded as typeof invoiceService).delete('INV-001');
} catch (e) {
  console.log('delete() blocked:', (e as Error).message.split('\n')[0]);
}
console.log();

// === 5. Custom Policy Builder ===
console.log('=== Custom Policy Builder ===');
const authorize = policy()
  .requirePermission()
  .requireNotExpired()
  .requireBudget()
  .denyActions('invoices:delete')
  .timeWindow(8, 18)
  .build();

const signed = issuer.issue({
  principal: 'user:alice@company.com',
  agent: 'agent:finance-bot',
  permissions: ['invoices:read', 'invoices:create', 'invoices:delete'],
  limits: { maxSpend: 500 },
});

const now = new Date();
now.setUTCHours(12);

console.log('read during business hours:', authorize(signed.payload, 'invoices:read', { timestamp: now.getTime() }).allowed);
console.log('delete (explicitly denied):', authorize(signed.payload, 'invoices:delete', { timestamp: now.getTime() }).allowed);

now.setUTCHours(3);
console.log('read at 3am:', authorize(signed.payload, 'invoices:read', { timestamp: now.getTime() }).allowed);
console.log();

// === 6. Validation ===
console.log('=== Passport Validation ===');
const validation = validatePassport(signed);
console.log('Valid:', validation.valid);
console.log('Errors:', validation.errors.length === 0 ? 'none' : validation.errors.join(', '));
console.log('Warnings:', validation.warnings.length === 0 ? 'none' : validation.warnings.join(', '));
