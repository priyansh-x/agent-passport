/**
 * Agent Passport — 60 second demo
 * Run: npx tsx example.ts
 */
import { AgentPassport, passport } from '@passport-agent/sdk';

// 1. Issue a passport for a booking agent
const bookingBot = AgentPassport.issue({
  principal: 'user:alice@company.com',
  agent: 'agent:booking-bot',
  permissions: ['flights:search', 'flights:book', 'email:send'],
  limits: { maxSpend: 500, currency: 'USD' },
});

console.log('✅ Passport issued:', bookingBot.id);
console.log('   Agent:', bookingBot.payload.agent);
console.log('   Budget: $500 USD');
console.log('   Permissions:', bookingBot.payload.permissions.join(', '));
console.log();

// 2. Authorize actions
console.log('🔐 Authorization checks:');
const search = bookingBot.authorize('flights:search');
console.log('   flights:search →', search.allowed ? '✓ allowed' : '✗ denied');

const book = bookingBot.authorize('flights:book');
console.log('   flights:book   →', book.allowed ? '✓ allowed' : '✗ denied');

const drop = bookingBot.authorize('database:drop');
console.log('   database:drop  →', drop.allowed ? '✗ denied' : '✓ allowed');
console.log();

// 3. Delegate to a sub-agent (permissions only narrow, never escalate)
console.log('🔗 Delegation (monotonic narrowing):');
const emailDrafter = bookingBot.delegate({
  agent: 'agent:email-drafter',
  permissions: ['email:send'],
  limits: { maxSpend: 0 },
});
console.log('   Delegated to:', emailDrafter.payload.agent);
console.log('   Permissions:', emailDrafter.payload.permissions.join(', '));
console.log('   Budget: $0 (no spending allowed)');
console.log();

// Sub-agent can send email...
const emailCheck = emailDrafter.authorize('email:send');
console.log('   email:send     →', emailCheck.allowed ? '✓ allowed' : '✗ denied');

// ...but can't book flights (narrowed out)
const flightCheck = emailDrafter.authorize('flights:book');
console.log('   flights:book   →', flightCheck.allowed ? '✓ allowed' : '✗ denied (not in scope)');
console.log();

// 4. Escalation attempt fails
console.log('🛡️  Escalation prevention:');
try {
  bookingBot.delegate({
    agent: 'agent:rogue',
    permissions: ['admin:*'],
    limits: { maxSpend: 999999 },
  });
} catch (e: any) {
  console.log('   Tried to delegate admin:* → ✗', e.message);
}
console.log();

// 5. Cascade revocation
console.log('💀 Cascade revocation:');
bookingBot.revoke();
console.log('   Revoked root passport');

const afterRevoke = emailDrafter.authorize('email:send');
console.log('   Child email:send →', afterRevoke.allowed ? '✓ allowed' : '✗ denied (parent revoked)');
console.log();

// 6. Builder API
console.log('🏗️  Builder API:');
const p = passport()
  .for('user:bob@startup.io')
  .agent('agent:finance-bot')
  .allow('invoices:read', 'invoices:create', 'payment:charge')
  .budget(1000, 'USD')
  .build();

console.log('   Built passport for:', p.payload.agent);
console.log('   Permissions:', p.payload.permissions.join(', '));
console.log('   Budget: $1000 USD');
console.log();

// 7. Token serialization
const token = p.toToken();
console.log('🎫 Token format:');
console.log('  ', token.slice(0, 50) + '...');
console.log('   Length:', token.length, 'chars');
console.log();
console.log('Done. Learn more: https://github.com/priyansh-x/agent-passport');
