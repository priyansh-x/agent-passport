import {
  Biscuit,
  AuthorizerBuilder,
  KeyPair as BiscuitKeyPair,
  Fact,
  Check,
  Policy,
  SignatureAlgorithm,
} from '@biscuit-auth/biscuit-wasm';
import type { PassportPayload, AuthorizeResult } from './types.js';

export interface BiscuitPassport {
  token: Uint8Array;
  payload: PassportPayload;
}

export class BiscuitIssuer {
  private keyPair: BiscuitKeyPair;

  constructor() {
    this.keyPair = new BiscuitKeyPair(SignatureAlgorithm.Ed25519);
  }

  get publicKey(): string {
    return this.keyPair.getPublicKey().toString();
  }

  issue(payload: PassportPayload): BiscuitPassport {
    const builder = Biscuit.builder();

    builder.addFact(
      Fact.fromString(`passport("${payload.id}", "${payload.principal}", "${payload.sub}")`),
    );
    builder.addFact(Fact.fromString(`issuer("${payload.iss}")`));
    builder.addFact(Fact.fromString(`issued_at(${payload.iat})`));
    builder.addFact(Fact.fromString(`expires_at(${payload.exp})`));
    builder.addFact(
      Fact.fromString(`spend_limit(${payload.limits.maxSpend}, "${payload.limits.currency}")`),
    );

    if (payload.parentId) {
      builder.addFact(Fact.fromString(`parent("${payload.parentId}")`));
    }

    for (const perm of payload.permissions) {
      builder.addFact(Fact.fromString(`permission("${perm.action}")`));
    }

    const biscuit = builder.build(this.keyPair.getPrivateKey());
    return { token: biscuit.toBytes(), payload };
  }

  attenuate(parentToken: Uint8Array, childPayload: PassportPayload): BiscuitPassport {
    const parent = Biscuit.fromBytes(parentToken, this.keyPair.getPublicKey());
    const block = Biscuit.block_builder();

    // Add allowed facts for child's permissions and a check that
    // the requested action matches one of them
    for (const perm of childPayload.permissions) {
      block.addFact(Fact.fromString(`allowed("${perm.action}")`));
    }
    block.addCheck(Check.fromString('check if requested($action), allowed($action)'));

    if (childPayload.limits.maxSpend > 0) {
      block.addCheck(
        Check.fromString(`check if spend_limit($max, $currency), $max >= ${childPayload.limits.maxSpend}`),
      );
    }

    block.addFact(
      Fact.fromString(`delegated_to("${childPayload.sub}", "${childPayload.id}")`),
    );

    const attenuated = parent.appendBlock(block);
    return { token: attenuated.toBytes(), payload: childPayload };
  }

  authorize(token: Uint8Array, action: string): AuthorizeResult {
    let biscuit: Biscuit;
    try {
      biscuit = Biscuit.fromBytes(token, this.keyPair.getPublicKey());
    } catch {
      return { allowed: false, reason: 'Invalid biscuit token', passportId: '' };
    }

    const ab = new AuthorizerBuilder();

    // Provide the requested action as an ambient fact
    ab.addFact(Fact.fromString(`requested("${action}")`));

    // Policies check authority-level permissions
    ab.addPolicy(Policy.fromString(`allow if permission("${action}")`));
    ab.addPolicy(Policy.fromString('allow if permission("*")'));

    if (action.includes(':')) {
      const prefix = action.split(':')[0];
      ab.addPolicy(Policy.fromString(`allow if permission("${prefix}:*")`));
    }

    ab.addPolicy(Policy.fromString('deny if true'));

    try {
      const authorizer = ab.buildAuthenticated(biscuit);
      authorizer.authorize();
      return { allowed: true, passportId: '' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        allowed: false,
        reason: `Authorization failed: ${msg}`,
        passportId: '',
      };
    }
  }

  verify(token: Uint8Array): boolean {
    try {
      Biscuit.fromBytes(token, this.keyPair.getPublicKey());
      return true;
    } catch {
      return false;
    }
  }

  inspect(token: Uint8Array): string {
    try {
      const biscuit = Biscuit.fromBytes(token, this.keyPair.getPublicKey());
      return biscuit.toString();
    } catch {
      return 'Invalid token';
    }
  }
}
