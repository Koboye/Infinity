// Daily level pass. Pure functions with no storage and no UI: the server (src/lib/online/passApi.js) is the only place
// a pass is stored; the phone only shows what the server says, so editing local storage or the clock unlocks nothing.
//
// A player pays once (mobile-money / USSD transfer, confirmed by the owner's server) and gets PASS_LEVELS level starts
// for the rest of that day. The day is the Ethiopian calendar day (UTC+3), so it ends at local midnight.
export const PASS_LEVELS = 10;
export const PASS_TZ_OFFSET_MS = 3 * 3600_000;   // Africa/Addis_Ababa, no daylight saving

/** The server's Ethiopian calendar day, YYYY-MM-DD. A phone's clock is never consulted. */
export const passDay = (now = Date.now()) => new Date(now + PASS_TZ_OFFSET_MS).toISOString().slice(0, 10);

/** Milliseconds until the pass of `now` runs out (next Ethiopian midnight). */
export const msToExpiry = (now = Date.now()) => 86_400_000 - ((now + PASS_TZ_OFFSET_MS) % 86_400_000);

const live = (p, now) => !!p && p.day === passDay(now);

/** What the client may see. */
export function passView(p, now = Date.now()) {
  const active = live(p, now);
  const total = active ? Number(p.total) || PASS_LEVELS : PASS_LEVELS;
  const used = active ? Math.min(total, Number(p.used) || 0) : 0;
  const left = active ? Math.max(0, total - used) : 0;
  return { active, total, used, left, locked: left <= 0, expiresIn: msToExpiry(now) };
}

/** Give a confirmed payment its pass. Returns { ok, pass } or { ok:false, reason }.
 *  A pass that still has levels is never replaced (a duplicate confirmation cannot waste a payment);
 *  once all levels are used, or the day changed, a new payment opens a fresh pass. */
export function grantPass(p, now = Date.now(), ref = null) {
  if (live(p, now) && passView(p, now).left > 0) return { ok: false, reason: 'already-active' };
  return { ok: true, pass: { day: passDay(now), total: PASS_LEVELS, used: 0, ref: ref ? String(ref).slice(0, 64) : null, paidAt: now } };
}

/** Spend one level start. Returns { ok, pass } or { ok:false, reason: 'locked' | 'used-up' }. */
export function consumeLevel(p, now = Date.now()) {
  if (!live(p, now)) return { ok: false, reason: 'locked' };
  const v = passView(p, now);
  if (v.left <= 0) return { ok: false, reason: 'used-up' };
  return { ok: true, pass: { ...p, used: v.used + 1 } };
}

/** A payer phone number, digits only (Ethiopian formats), or '' when it does not look like one. */
export function cleanPhone(raw) {
  const d = String(raw || '').replace(/[^\d+]/g, '');
  if (/^(\+251|251|0)?[79]\d{8}$/.test(d)) return '0' + d.replace(/^(\+251|251|0)/, '');
  return '';
}

/** The dial string the player pays with, and the tel: link that opens the dialer with it filled in.
 *  A web page cannot dial silently or read the result: the player must press call. '#' has to be %23 in a tel: link. */
export const DEFAULT_USSD = '*806*0928390022*1#';
export const ussdLink = (code = DEFAULT_USSD) => `tel:${String(code).replace(/#/g, '%23')}`;
