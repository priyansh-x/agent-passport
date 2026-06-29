export function toBase64Url(data: Uint8Array): string {
  const base64 = Buffer.from(data).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(str: string): Uint8Array {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

export function encodePayload(obj: Record<string, unknown>): string {
  const json = JSON.stringify(obj);
  return toBase64Url(new TextEncoder().encode(json));
}

export function decodePayload<T = Record<string, unknown>>(encoded: string): T {
  const bytes = fromBase64Url(encoded);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as T;
}
