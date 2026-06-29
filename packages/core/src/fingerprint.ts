import type { SignedPassport } from './types.js';

const WORDS = [
  'alpha', 'bravo', 'cedar', 'delta', 'ember', 'frost', 'grain', 'hydra',
  'ivory', 'jewel', 'karma', 'lunar', 'maple', 'noble', 'orbit', 'prism',
  'quartz', 'raven', 'solar', 'tiger', 'ultra', 'vivid', 'woven', 'xenon',
  'yield', 'zephyr', 'amber', 'blaze', 'coral', 'drift', 'eagle', 'flint',
];

export function fingerprint(passport: SignedPassport): string {
  const input = passport.payload.id + passport.signature.slice(0, 16);
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  const a = Math.abs(hash) % WORDS.length;
  const b = Math.abs((hash >>> 8) ^ (hash << 3)) % WORDS.length;
  const c = Math.abs((hash >>> 16) ^ (hash << 7)) % WORDS.length;
  const num = Math.abs(hash) % 1000;
  return `${WORDS[a]}-${WORDS[b]}-${WORDS[c]}-${num}`;
}

export function shortId(passport: SignedPassport): string {
  return passport.payload.id.slice(0, 8);
}
