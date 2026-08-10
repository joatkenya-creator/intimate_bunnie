/**
 * Human-facing references: base32-ish, no vowels, so no reference ever spells a
 * word or gets misread over the phone. Web Crypto, available in Node and workerd.
 */
export function reference(prefix: string): string {
  const alphabet = '23456789BCDFGHJKLMNPQRSTVWXZ'
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return `${prefix}-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`
}
