import { AgentPassport } from '@passport-agent/sdk';
import { PassportIssuer } from '@passport-agent/core';

const issuer = new PassportIssuer();

// === Multi-Agent Delegation Chain ===
// Root agent gets broad permissions from human
// Each sub-agent gets only what it needs (monotonic narrowing)

console.log('=== Step 1: Human authorizes root agent ===');
const rootPassport = AgentPassport.issue(
  {
    principal: 'user:alice@company.com',
    agent: 'agent:travel-planner',
    permissions: ['flights:search', 'flights:book', 'hotels:search', 'hotels:book', 'email:send', 'payment:charge'],
    limits: { maxSpend: 2000, currency: 'USD' },
  },
  issuer,
);
console.log(`Root agent: ${rootPassport.agent}`);
console.log(`Permissions: ${rootPassport.permissions.join(', ')}`);
console.log();

// === Delegate to flight search agent (read-only, no spend) ===
console.log('=== Step 2: Delegate to flight search agent ===');
const flightAgent = rootPassport.delegate({
  agent: 'agent:flight-searcher',
  permissions: ['flights:search'],
  limits: { maxSpend: 0 },
});
console.log(`Flight agent: ${flightAgent.agent}`);
console.log(`Permissions: ${flightAgent.permissions.join(', ')}`);
console.log(`Parent: ${flightAgent.parentId?.slice(0, 8)}...`);
console.log();

// Flight agent can search but not book
console.log('Flight agent tries flights:search →', flightAgent.tryAuthorize('flights:search').allowed ? 'ALLOWED' : 'DENIED');
console.log('Flight agent tries flights:book →', flightAgent.tryAuthorize('flights:book').allowed ? 'ALLOWED' : 'DENIED');
console.log();

// === Delegate to booking agent (can book + pay, limited budget) ===
console.log('=== Step 3: Delegate to booking agent ===');
const bookingAgent = rootPassport.delegate({
  agent: 'agent:booker',
  permissions: ['flights:book', 'hotels:book', 'payment:charge'],
  limits: { maxSpend: 1000 },
});
console.log(`Booking agent: ${bookingAgent.agent}`);
console.log(`Permissions: ${bookingAgent.permissions.join(', ')}`);
console.log(`Budget: $1000 (half of root's $2000)`);
console.log();

// === Demonstrate escalation prevention ===
console.log('=== Step 4: Try privilege escalation ===');
try {
  flightAgent.delegate({
    agent: 'agent:evil',
    permissions: ['payment:charge'], // flight agent doesn't have this!
  });
  console.log('ERROR: Should have thrown!');
} catch (e) {
  console.log(`Escalation blocked: ${(e as Error).message.split('\n')[0]}`);
}
console.log();

// === Cascade revocation ===
console.log('=== Step 5: Cascade revocation ===');
console.log('Before revoke:');
console.log(`  Root can search: ${rootPassport.tryAuthorize('flights:search').allowed}`);
console.log(`  Flight agent can search: ${flightAgent.tryAuthorize('flights:search').allowed}`);
console.log(`  Booking agent can book: ${bookingAgent.tryAuthorize('flights:book').allowed}`);

const revoked = rootPassport.revoke();
console.log(`\nRevoked ${revoked.length} passports (cascade)`);

console.log('\nAfter revoke:');
console.log(`  Root can search: ${rootPassport.tryAuthorize('flights:search').allowed}`);
console.log(`  Flight agent can search: ${flightAgent.tryAuthorize('flights:search').allowed}`);
console.log(`  Booking agent can book: ${bookingAgent.tryAuthorize('flights:book').allowed}`);
