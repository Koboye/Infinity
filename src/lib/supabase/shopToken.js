/**
 * Shop access tokens: a shop device authenticates with a long random
 * token instead of email/password (shopkeepers shouldn't have to
 * manage logins). We store only a SHA-256 hash of it — the plaintext
 * is shown once at provisioning time and never persisted server-side.
 * Node-only (uses crypto) — import from API routes, not client code.
 */
import { randomBytes, createHash } from 'crypto';

// Human-typeable: groups of 4 uppercase alphanumerics, e.g. "K7QP-9M2X-4RTS".
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion

export function generateShopToken() {
  const bytes = randomBytes(12);
  let raw = '';
  for (const b of bytes) raw += ALPHABET[b % ALPHABET.length];
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export function hashShopToken(token) {
  return createHash('sha256').update(String(token).trim().toUpperCase()).digest('hex');
}
