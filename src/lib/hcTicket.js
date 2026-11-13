// Hill Climb ticket: a signed, HttpOnly cookie that says "this account had an open pass when it opened Hill Climb".
// Hill Climb is a stand-alone page with no sign-in of its own, so this cookie is how the page's level starts reach the player's pass.
// The ticket carries no pass state (the server still decides on every level start); it only names the account and dies at Ethiopian midnight.
// Web Crypto only, so it runs in the Edge middleware and in Node.
import { msToExpiry } from './passCore.js';

const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const hmac = async (secret, text) => b64u(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode(text)));

export const TICKET_COOKIE = 'hc_t';
/** The signing secret: PASS_TICKET_SECRET, or PAY_WEBHOOK_SECRET when that is the only one set. Under 24 characters = not configured. */
export const ticketSecret = (env = process.env) => { const s = env.PASS_TICKET_SECRET || env.PAY_WEBHOOK_SECRET || ''; return s.length >= 24 ? s : ''; };

export async function signTicket(uid, secret, now = Date.now()) {
  const body = `${b64u(enc.encode(String(uid)))}.${now + msToExpiry(now)}`;
  return `${body}.${await hmac(secret, body)}`;
}

/** The account the ticket names, or null (missing, forged, edited, expired, or no secret configured). */
export async function verifyTicket(token, secret, now = Date.now()) {
  if (!secret || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !(Number(parts[1]) > now)) return null;
  const good = await hmac(secret, `${parts[0]}.${parts[1]}`);
  if (good.length !== parts[2].length) return null;
  let diff = 0; for (let i = 0; i < good.length; i++) diff |= good.charCodeAt(i) ^ parts[2].charCodeAt(i);
  if (diff) return null;
  try { return new TextDecoder().decode(unb64u(parts[0])) || null; } catch { return null; }
}
