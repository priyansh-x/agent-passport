import { AgentPassport } from '@passport-agent/sdk';
import { PassportIssuer } from '@passport-agent/core';

const issuer = new PassportIssuer();

// 1. Human authorizes an agent with scoped permissions
console.log('=== Issuing Passport ===');
const passport = AgentPassport.issue(
  {
    principal: 'user:alice@company.com',
    agent: 'agent:booking-bot',
    permissions: ['calendar:read', 'calendar:write', 'email:send'],
    limits: { maxSpend: 500, currency: 'USD' },
    expiresIn: 24 * 60 * 60 * 1000, // 24 hours
  },
  issuer,
);

console.log('Passport issued:', passport.toJSON());
console.log();

// 2. Agent checks permission before every action
console.log('=== Authorizing Actions ===');

const readResult = passport.tryAuthorize('calendar:read');
console.log('calendar:read →', readResult.allowed ? 'ALLOWED' : 'DENIED');

const writeResult = passport.tryAuthorize('calendar:write', 50);
console.log('calendar:write ($50) →', writeResult.allowed ? 'ALLOWED' : 'DENIED');

const adminResult = passport.tryAuthorize('admin:delete');
console.log('admin:delete →', adminResult.allowed ? 'DENIED ✓ (correct)' : 'DENIED ✓ (correct)');
console.log();

// 3. Try to overspend
console.log('=== Spend Limits ===');
passport.authorize('calendar:write', 200);
console.log('Spent $200 — OK');
passport.authorize('calendar:write', 200);
console.log('Spent $200 more — OK');

const overSpend = passport.tryAuthorize('calendar:write', 200);
console.log('Try $200 more →', overSpend.allowed ? 'ALLOWED' : `DENIED: ${overSpend.reason}`);
console.log();

// 4. View audit trail
console.log('=== Audit Trail ===');
for (const entry of passport.auditLog) {
  console.log(
    `  ${new Date(entry.timestamp).toISOString()} | ${entry.action} | ${entry.allowed ? 'ALLOWED' : 'DENIED'}${entry.reason ? ` | ${entry.reason}` : ''}`,
  );
}
console.log();

// 5. Revoke the passport
console.log('=== Revocation ===');
const revoked = passport.revoke();
console.log(`Revoked ${revoked.length} passport(s)`);

const afterRevoke = passport.tryAuthorize('calendar:read');
console.log('calendar:read after revoke →', afterRevoke.allowed ? 'ALLOWED' : `DENIED: ${afterRevoke.reason}`);
