import type { PassportDB } from './db.js';

export function getPrometheusMetrics(db: PassportDB): string {
  const stats = db.getStats();
  const lines: string[] = [];

  lines.push('# HELP passport_total Total passports issued');
  lines.push('# TYPE passport_total gauge');
  lines.push(`passport_total ${stats.passports.total}`);

  lines.push('# HELP passport_active Currently active passports');
  lines.push('# TYPE passport_active gauge');
  lines.push(`passport_active ${stats.passports.active}`);

  lines.push('# HELP passport_revoked Total revoked passports');
  lines.push('# TYPE passport_revoked gauge');
  lines.push(`passport_revoked ${stats.passports.revoked}`);

  lines.push('# HELP authorization_total Total authorization checks');
  lines.push('# TYPE authorization_total counter');
  lines.push(`authorization_total ${stats.authorizations.total}`);

  lines.push('# HELP authorization_allowed Allowed authorizations');
  lines.push('# TYPE authorization_allowed counter');
  lines.push(`authorization_allowed ${stats.authorizations.allowed}`);

  lines.push('# HELP authorization_denied Denied authorizations');
  lines.push('# TYPE authorization_denied counter');
  lines.push(`authorization_denied ${stats.authorizations.denied}`);

  lines.push('# HELP spend_total Total amount spent across all passports');
  lines.push('# TYPE spend_total gauge');
  lines.push(`spend_total ${stats.spend.total}`);

  lines.push('# HELP delegation_total Total delegation relationships');
  lines.push('# TYPE delegation_total gauge');
  lines.push(`delegation_total ${stats.delegations}`);

  return lines.join('\n') + '\n';
}
