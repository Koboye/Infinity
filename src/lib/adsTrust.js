// Click-fraud protection for ad statistics. Pure helpers + one Firestore claim; no UI.
//
// Problem: anybody could POST "click" for any ad, inflating the numbers an advertiser is shown and skewing the learning
// layer (adsSmart.quality trains on taps). Fix: every counted impression hands the phone a signed, short-lived token.
// A tap only counts when it carries a valid token FOR THAT AD, and each token can be spent exactly once (an atomic
// Firestore create). So taps can never exceed impressions, can't be replayed, can't be moved to another ad, and a script
// that never loaded the ad has nothing to tap with.
//
// Switched on by setting ADS_SIGNING_SECRET (16+ random characters). Without it the old behaviour stays (taps counted
// unsigned) so nothing breaks on an existing deployment.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const TOKEN_TTL_MS = 30 * 60 * 1000;   // a tap must follow its impression within 30 minutes
export const TOKEN_KEEP_MS = 2 * 3600 * 1000; // claimed-token records are kept 2 h (set a Firestore TTL on `expireAt`)

export const secretOf = (env = process.env) => { const s = env.ADS_SIGNING_SECRET; return typeof s === 'string' && s.length >= 16 ? s : null; };
const mac = (secret, body) => createHmac('sha256', secret).update(body).digest('base64url');

/** token = adId.timeBase36.nonce.signature  (ad ids never contain a dot) */
export function signToken(secret, adId, now = Date.now(), nonce = randomBytes(9).toString('base64url')) {
  const body = `${adId}.${now.toString(36)}.${nonce}`;
  return `${body}.${mac(secret, body)}`;
}

/** Returns { ok:true, nonce } or { ok:false, reason }. Checks signature, ad, age. Does NOT spend the token. */
export function verifyToken(secret, token, adId, now = Date.now()) {
  const parts = String(token || '').split('.');
  if (parts.length !== 4) return { ok: false, reason: 'format' };
  const [id, ts, nonce, sig] = parts;
  const want = Buffer.from(mac(secret, `${id}.${ts}.${nonce}`)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { ok: false, reason: 'signature' };
  if (id !== adId) return { ok: false, reason: 'ad' };
  const at = parseInt(ts, 36);
  if (!Number.isFinite(at) || at > now + 60_000 || now - at > TOKEN_TTL_MS) return { ok: false, reason: 'expired' };
  return { ok: true, nonce };
}

/** Spend a token once. Firestore create() fails if the document exists, which is the atomic "only once". */
export async function claimToken(db, nonce, adId, now = Date.now()) {
  try {
    await db.collection('adTokens').doc(nonce).create({ adId, at: now, expireAt: new Date(now + TOKEN_KEEP_MS) });
    return true;
  } catch { return false; }
}
