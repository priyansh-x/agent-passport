import type { SignedPassport } from './types.js';

function toBase64Url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString('base64url');
}

function fromBase64Url(str: string): Buffer {
  return Buffer.from(str, 'base64url');
}

export function serializePassport(passport: SignedPassport): string {
  const payload = toBase64Url(Buffer.from(JSON.stringify(passport.payload)));
  const sig = toBase64Url(Buffer.from(passport.signature, 'hex'));
  const key = toBase64Url(Buffer.from(passport.publicKey, 'hex'));
  return `ap1.${payload}.${sig}.${key}`;
}

export function deserializePassport(token: string): SignedPassport {
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'ap1') {
    throw new Error('Invalid passport token format');
  }

  const [, payloadPart, sigPart, keyPart] = parts as [string, string, string, string];
  const payload = JSON.parse(fromBase64Url(payloadPart).toString('utf-8'));
  const signature = fromBase64Url(sigPart).toString('hex');
  const publicKey = fromBase64Url(keyPart).toString('hex');

  return { payload, signature, publicKey };
}
