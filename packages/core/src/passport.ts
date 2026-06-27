import type {
  PassportPayload,
  SignedPassport,
  IssueOptions,
  DelegateOptions,
  AuthorizeResult,
  Permission,
} from './types.js';
import {
  generateKeyPair,
  sign,
  verify,
  toHex,
  fromHex,
  encodePayload,
  randomId,
  type KeyPair,
} from './crypto.js';
import { authorize, isSubsetPermissions } from './policy.js';
import { RevocationList } from './revocation.js';
import { AuditLog } from './audit.js';

function parsePermissions(perms: string[]): Permission[] {
  return perms.map((p) => {
    const parts = p.split(':');
    if (parts.length === 1) return { action: p };
    return { action: p, resource: parts[0] };
  });
}

const DEFAULT_EXPIRY = 24 * 60 * 60 * 1000;

export class PassportIssuer {
  private keyPair: KeyPair;
  readonly revocations = new RevocationList();
  readonly audit = new AuditLog();
  private passports = new Map<string, SignedPassport>();
  private spentTracking = new Map<string, number>();

  constructor(keyPair?: KeyPair) {
    this.keyPair = keyPair ?? generateKeyPair();
  }

  get publicKey(): string {
    return toHex(this.keyPair.publicKey);
  }

  issue(options: IssueOptions): SignedPassport {
    const now = Date.now();
    const payload: PassportPayload = {
      id: randomId(),
      iss: options.issuer ?? 'agent-passport:local',
      sub: options.agent,
      principal: options.principal,
      permissions: parsePermissions(options.permissions),
      limits: {
        maxSpend: options.limits?.maxSpend ?? 0,
        currency: options.limits?.currency ?? 'USD',
        spent: 0,
      },
      iat: now,
      exp: now + (options.expiresIn ?? DEFAULT_EXPIRY),
      parentId: null,
      nonce: randomId(),
    };

    const signed = this.signPassport(payload);
    this.passports.set(payload.id, signed);
    return signed;
  }

  delegate(parent: SignedPassport, options: DelegateOptions): SignedPassport {
    const childPerms = parsePermissions(options.permissions);

    if (!isSubsetPermissions(childPerms, parent.payload.permissions)) {
      throw new Error(
        'Delegation denied: child permissions must be a subset of parent permissions',
      );
    }

    const childMaxSpend = options.limits?.maxSpend ?? 0;
    const parentRemaining =
      parent.payload.limits.maxSpend - parent.payload.limits.spent;
    if (childMaxSpend > parentRemaining) {
      throw new Error(
        `Delegation denied: child spend limit $${childMaxSpend} exceeds parent remaining $${parentRemaining}`,
      );
    }

    const now = Date.now();
    const parentExpiry = parent.payload.exp;
    const requestedExpiry = now + (options.expiresIn ?? DEFAULT_EXPIRY);

    const payload: PassportPayload = {
      id: randomId(),
      iss: parent.payload.iss,
      sub: options.agent,
      principal: parent.payload.principal,
      permissions: childPerms,
      limits: {
        maxSpend: childMaxSpend,
        currency: options.limits?.currency ?? parent.payload.limits.currency,
        spent: 0,
      },
      iat: now,
      exp: Math.min(requestedExpiry, parentExpiry),
      parentId: parent.payload.id,
      nonce: randomId(),
    };

    const signed = this.signPassport(payload);
    this.passports.set(payload.id, signed);
    this.revocations.registerChild(parent.payload.id, payload.id);
    return signed;
  }

  authorize(
    passport: SignedPassport,
    action: string,
    spendAmount = 0,
  ): AuthorizeResult {
    if (!this.verifySignature(passport)) {
      const result: AuthorizeResult = {
        allowed: false,
        reason: 'Invalid passport signature',
        passportId: passport.payload.id,
      };
      this.audit.record({
        passportId: passport.payload.id,
        action,
        resource: undefined,
        allowed: false,
        reason: result.reason,
      });
      return result;
    }

    const currentSpent = this.spentTracking.get(passport.payload.id) ?? 0;
    const result = authorize(
      passport.payload,
      action,
      spendAmount,
      (id) => this.revocations.isRevoked(id),
      currentSpent,
    );

    if (result.allowed && spendAmount > 0) {
      const currentSpent = this.spentTracking.get(passport.payload.id) ?? 0;
      this.spentTracking.set(passport.payload.id, currentSpent + spendAmount);
    }

    this.audit.record({
      passportId: passport.payload.id,
      action,
      resource: undefined,
      allowed: result.allowed,
      reason: result.reason,
    });

    return result;
  }

  revoke(passportId: string): string[] {
    return this.revocations.revoke(passportId);
  }

  getPassport(id: string): SignedPassport | undefined {
    return this.passports.get(id);
  }

  private signPassport(payload: PassportPayload): SignedPassport {
    const message = encodePayload(payload);
    const sig = sign(message, this.keyPair.privateKey);
    return {
      payload,
      signature: toHex(sig),
      publicKey: toHex(this.keyPair.publicKey),
    };
  }

  verifySignature(passport: SignedPassport): boolean {
    const message = encodePayload(passport.payload);
    return verify(
      fromHex(passport.signature),
      message,
      fromHex(passport.publicKey),
    );
  }
}
