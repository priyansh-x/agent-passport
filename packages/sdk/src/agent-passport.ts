import type { SignedPassport, AuthorizeResult, AuditEntry } from '@agent-passport/core';
import { PassportIssuer } from '@agent-passport/core';
import { getDefaultAuthority } from './authority.js';

export interface IssueConfig {
  principal: string;
  agent: string;
  permissions: string[];
  limits?: { maxSpend: number; currency?: string };
  expiresIn?: number;
}

export interface DelegateConfig {
  agent: string;
  permissions: string[];
  limits?: { maxSpend: number; currency?: string };
  expiresIn?: number;
}

export class AgentPassport {
  private signed: SignedPassport;
  private issuer: PassportIssuer;

  private constructor(signed: SignedPassport, issuer: PassportIssuer) {
    this.signed = signed;
    this.issuer = issuer;
  }

  static issue(config: IssueConfig, issuer?: PassportIssuer): AgentPassport {
    const authority = issuer ?? getDefaultAuthority();
    const signed = authority.issue({
      principal: config.principal,
      agent: config.agent,
      permissions: config.permissions,
      limits: config.limits,
      expiresIn: config.expiresIn,
    });
    return new AgentPassport(signed, authority);
  }

  authorize(action: string, spendAmount = 0): AuthorizeResult {
    const result = this.issuer.authorize(this.signed, action, spendAmount);
    if (!result.allowed) {
      const err = new PassportDeniedError(action, result.reason ?? 'Unknown reason', this.id);
      throw err;
    }
    return result;
  }

  tryAuthorize(action: string, spendAmount = 0): AuthorizeResult {
    return this.issuer.authorize(this.signed, action, spendAmount);
  }

  delegate(config: DelegateConfig): AgentPassport {
    try {
      const childSigned = this.issuer.delegate(this.signed, {
        agent: config.agent,
        permissions: config.permissions,
        limits: config.limits,
        expiresIn: config.expiresIn,
      });
      return new AgentPassport(childSigned, this.issuer);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new PassportDelegationError(config.agent, msg, this.id);
    }
  }

  revoke(): string[] {
    return this.issuer.revoke(this.id);
  }

  get id(): string {
    return this.signed.payload.id;
  }

  get principal(): string {
    return this.signed.payload.principal;
  }

  get agent(): string {
    return this.signed.payload.sub;
  }

  get permissions(): string[] {
    return this.signed.payload.permissions.map((p) => p.action);
  }

  get expiresAt(): Date {
    return new Date(this.signed.payload.exp);
  }

  get parentId(): string | null {
    return this.signed.payload.parentId;
  }

  get auditLog(): AuditEntry[] {
    return this.issuer.audit.getByPassport(this.id);
  }

  toJSON() {
    return {
      id: this.id,
      principal: this.principal,
      agent: this.agent,
      permissions: this.permissions,
      expiresAt: this.expiresAt.toISOString(),
      parentId: this.parentId,
    };
  }
}

export class PassportDeniedError extends Error {
  readonly action: string;
  readonly passportId: string;

  constructor(action: string, reason: string, passportId: string) {
    super(
      `Action "${action}" denied for passport ${passportId.slice(0, 8)}...: ${reason}\n` +
      `  Fix: Check that the passport includes permission for "${action}".`,
    );
    this.name = 'PassportDeniedError';
    this.action = action;
    this.passportId = passportId;
  }
}

export class PassportDelegationError extends Error {
  readonly targetAgent: string;
  readonly passportId: string;

  constructor(targetAgent: string, reason: string, passportId: string) {
    super(
      `Cannot delegate to "${targetAgent}" from passport ${passportId.slice(0, 8)}...: ${reason}\n` +
      `  Fix: Ensure child permissions are a subset of parent, and spend limits don't exceed parent's remaining budget.`,
    );
    this.name = 'PassportDelegationError';
    this.targetAgent = targetAgent;
    this.passportId = passportId;
  }
}
