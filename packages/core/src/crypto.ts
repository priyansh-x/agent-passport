import { generateKeyPairSync, sign as cryptoSign, verify as cryptoVerify, createPrivateKey, createPublicKey, randomBytes } from 'node:crypto';

export interface KeyPair {
  privateKey: Buffer;
  publicKey: Buffer;
}

export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    privateKey: Buffer.from(privateKey.export({ type: 'pkcs8', format: 'der' })),
    publicKey: Buffer.from(publicKey.export({ type: 'spki', format: 'der' })),
  };
}

export function sign(message: Uint8Array, privateKeyDer: Buffer): Buffer {
  const key = createPrivateKey({ key: privateKeyDer, format: 'der', type: 'pkcs8' });
  return cryptoSign(null, Buffer.from(message), key);
}

export function verify(
  signature: Uint8Array,
  message: Uint8Array,
  publicKeyDer: Buffer,
): boolean {
  const key = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
  return cryptoVerify(null, Buffer.from(message), key, Buffer.from(signature));
}

export function toHex(bytes: Uint8Array | Buffer): string {
  return Buffer.from(bytes).toString('hex');
}

export function fromHex(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

export function encodePayload(payload: unknown): Buffer {
  return Buffer.from(JSON.stringify(payload));
}

export function randomId(): string {
  return randomBytes(16).toString('hex');
}
