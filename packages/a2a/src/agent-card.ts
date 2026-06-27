import type { SignedPassport } from '@agent-passport/core';
import { matchesPermission } from '@agent-passport/core';

export interface PassportRequirements {
  requiredPermissions: string[];
  minSpendLimit?: number;
  currency?: string;
}

export interface AgentCard {
  name: string;
  description: string;
  url: string;
  capabilities: string[];
  passport?: PassportRequirements;
}

export function createAgentCard(config: {
  name: string;
  description: string;
  url: string;
  capabilities: string[];
  passportRequirements?: PassportRequirements;
}): AgentCard {
  return {
    name: config.name,
    description: config.description,
    url: config.url,
    capabilities: config.capabilities,
    passport: config.passportRequirements,
  };
}

export interface ValidationResult {
  valid: boolean;
  missingPermissions: string[];
  insufficientSpend: boolean;
}

export function validatePassportForCard(
  passport: SignedPassport,
  card: AgentCard,
): ValidationResult {
  if (!card.passport) {
    return { valid: true, missingPermissions: [], insufficientSpend: false };
  }

  const missing: string[] = [];
  for (const required of card.passport.requiredPermissions) {
    if (!matchesPermission(required, passport.payload.permissions)) {
      missing.push(required);
    }
  }

  const remaining = passport.payload.limits.maxSpend - passport.payload.limits.spent;
  const insufficientSpend =
    card.passport.minSpendLimit !== undefined && remaining < card.passport.minSpendLimit;

  return {
    valid: missing.length === 0 && !insufficientSpend,
    missingPermissions: missing,
    insufficientSpend,
  };
}
