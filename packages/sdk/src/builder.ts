import { PassportIssuer } from '@passport-agent/core';
import { AgentPassport } from './agent-passport.js';
import { getDefaultAuthority } from './authority.js';

export class PassportBuilder {
  private _principal = '';
  private _agent = '';
  private _permissions: string[] = [];
  private _maxSpend = 0;
  private _currency = 'USD';
  private _expiresIn: number | undefined;
  private _issuer: PassportIssuer | undefined;

  for(principal: string): this {
    this._principal = principal;
    return this;
  }

  agent(agent: string): this {
    this._agent = agent;
    return this;
  }

  allow(...permissions: string[]): this {
    this._permissions.push(...permissions);
    return this;
  }

  budget(amount: number, currency = 'USD'): this {
    this._maxSpend = amount;
    this._currency = currency;
    return this;
  }

  expiresIn(ms: number): this {
    this._expiresIn = ms;
    return this;
  }

  expiresInHours(hours: number): this {
    this._expiresIn = hours * 60 * 60 * 1000;
    return this;
  }

  expiresInDays(days: number): this {
    this._expiresIn = days * 24 * 60 * 60 * 1000;
    return this;
  }

  withIssuer(issuer: PassportIssuer): this {
    this._issuer = issuer;
    return this;
  }

  build(): AgentPassport {
    if (!this._principal) throw new Error('PassportBuilder: principal is required (call .for())');
    if (!this._agent) throw new Error('PassportBuilder: agent is required (call .agent())');
    if (this._permissions.length === 0) throw new Error('PassportBuilder: at least one permission is required (call .allow())');

    return AgentPassport.issue(
      {
        principal: this._principal,
        agent: this._agent,
        permissions: this._permissions,
        limits: { maxSpend: this._maxSpend, currency: this._currency },
        expiresIn: this._expiresIn,
      },
      this._issuer,
    );
  }
}

export function passport(): PassportBuilder {
  return new PassportBuilder();
}
