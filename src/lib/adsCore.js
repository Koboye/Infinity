// Ad rules. Pure functions with no storage, no network and no UI, shared by the server routes, the client and the tests.
//
// How ads work in this app (direct ads, no third-party SDK):
//   • A local advertiser (bank, event organiser, shop) gives us one image + a link. We store it as an `ads/{id}` document.
//   • Three placements: `splash` (app open), `pre_game` (when a game starts) and `rewarded` (optional, watch to earn spins).
//   • Every ad carries its own length, clamped to 2–10 seconds (rewarded ads never go below REWARD_MIN_SEC).
//   • Scheduling is by date range + weight (a bigger weight is shown more often), with frequency caps so players are never spammed.
//   • The ONLY thing ads can pay out is bonus lucky spins, and the server decides that (see grantAdSpins in walletCore.js).

export const PLACEMENTS = ['splash', 'pre_game', 'rewarded'];
export const CATEGORIES = ['event', 'bank', 'shop', 'telecom', 'food', 'other'];

export const MIN_SEC = 2;            // the shortest ad
export const MAX_SEC = 10;           // the longest ad
export const REWARD_MIN_SEC = 5;     // a rewarded ad is never shorter than this, so the reward means something
export const SKIP_AFTER_SEC = 3;     // splash / pre-game ads can be skipped after this long (shorter ads just end)

export const REWARD_SPINS = 2;       // lucky spins earned for one finished rewarded ad
export const REWARD_MAX_PER_DAY = 5; // rewarded ads that pay out per server day (5 × 2 = up to 10 extra spins a day)
export const BONUS_CAP = 20;         // banked bonus spins never exceed this

export const SESSION_TTL_MS = 10 * 60 * 1000; // a rewarded ad must be completed within this long after it started
export const DONE_TOLERANCE_MS = 600;         // network slack when the server checks the ad was watched for its full length

// Frequency caps. `gapMs` = minimum time since the last ad of the same placement; `everyN` = show on every N-th game start.
export const CAPS = {
  splash: { gapMs: 2 * 60 * 1000 },
  pre_game: { gapMs: 60 * 1000, everyN: 3 },
  anyGapMs: 45 * 1000,               // never two ads back to back, whatever the placement
};

const SLUG = /^[a-z0-9][a-z0-9_-]{1,39}$/;
export const isAdId = (id) => SLUG.test(String(id ?? ''));
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);

/** Clamp an ad length to the allowed 2–10 s (rewarded: 5–10 s). */
export function clampSeconds(v, placement) {
  const n = Math.round(Number(v));
  const lo = placement === 'rewarded' ? REWARD_MIN_SEC : MIN_SEC;
  return Math.min(MAX_SEC, Math.max(lo, Number.isFinite(n) ? n : 5));
}

export function isHttps(u) {
  try { const x = new URL(String(u)); return x.protocol === 'https:' && !!x.hostname; } catch { return false; }
}

/** Validate and normalise an ad written by an admin. Returns { ok, ad } or { ok:false, errors }. Never contains `undefined` (Firestore). */
export function sanitizeAd(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const errors = [];
  const id = clean(r.id, 40).toLowerCase();
  if (!SLUG.test(id)) errors.push('id: 2–40 characters, a–z 0–9 _ - only');
  const advertiser = clean(r.advertiser, 40);
  if (!advertiser) errors.push('advertiser is required');
  const placements = [...new Set((Array.isArray(r.placements) ? r.placements : []).filter((p) => PLACEMENTS.includes(p)))];
  if (!placements.length) errors.push('choose at least one placement');
  const image = clean(r.image, 500);
  if (!isHttps(image)) errors.push('image must be an https:// link');
  const clickUrl = clean(r.clickUrl, 500);
  if (clickUrl && !isHttps(clickUrl)) errors.push('clickUrl must be an https:// link');
  const start = clean(r.start, 10), end = clean(r.end, 10);
  if (!DATE.test(start) || !DATE.test(end)) errors.push('start and end must be YYYY-MM-DD');
  else if (end < start) errors.push('end is before start');
  if (errors.length) return { ok: false, errors };
  const category = CATEGORIES.includes(r.category) ? r.category : 'other';
  const w = Math.round(Number(r.weight));
  const ad = {
    id, advertiser, category, placements, image: new URL(image).href, clickUrl: clickUrl ? new URL(clickUrl).href : '', start, end,   // .href percent-encodes quotes, so a link can never break out of CSS url("…")
    title: clean(r.title, 60), titleAm: clean(r.titleAm, 60),
    body: clean(r.body, 140), bodyAm: clean(r.bodyAm, 140),
    cta: clean(r.cta, 24) || 'Learn more', ctaAm: clean(r.ctaAm, 24),
    durationSec: clampSeconds(r.durationSec, placements.includes('rewarded') && placements.length === 1 ? 'rewarded' : 'splash'),
    weight: Math.min(100, Math.max(1, Number.isFinite(w) ? w : 1)),
    active: r.active !== false,
  };
  return { ok: true, ad };
}

/** The server's calendar day (UTC), same rule as the wallet. */
export const todayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

/** Is this ad switched on and inside its date range (both ends inclusive, UTC days)? */
export function isLive(ad, now = Date.now()) {
  if (!ad || ad.active === false) return false;
  const d = todayKey(now);
  return typeof ad.start === 'string' && typeof ad.end === 'string' && ad.start <= d && d <= ad.end;
}

export const forPlacement = (ads, placement, now = Date.now()) => (ads || []).filter((a) => isLive(a, now) && (a.placements || []).includes(placement));

/** Weighted random pick; `avoidId` (the ad shown last) is skipped when there is any other choice. */
export function pickAd(ads, placement, { now = Date.now(), rand = Math.random, avoidId = null } = {}) {
  let list = forPlacement(ads, placement, now);
  if (list.length > 1 && avoidId) list = list.filter((a) => a.id !== avoidId);
  if (!list.length) return null;
  const total = list.reduce((s, a) => s + Math.max(1, a.weight || 1), 0);
  let r = rand() * total;
  for (const a of list) { r -= Math.max(1, a.weight || 1); if (r < 0) return a; }
  return list[list.length - 1];
}

/** What the client is allowed to see of an ad (no admin-only data). */
export const publicAd = (a, placement) => ({
  id: a.id, advertiser: a.advertiser, category: a.category, image: a.image, clickUrl: a.clickUrl || '',
  title: a.title || '', titleAm: a.titleAm || '', body: a.body || '', bodyAm: a.bodyAm || '',
  cta: a.cta || 'Learn more', ctaAm: a.ctaAm || '', durationSec: clampSeconds(a.durationSec, placement),
});

// ── Frequency caps (state is kept by the client in local storage; losing it only means one extra ad) ──
export const newCapState = () => ({ last: {}, lastAny: 0, starts: 0, lastId: null });

/** Should an ad of this placement be shown now? For `pre_game`, call once per game start (the start counter lives in the state). */
export function shouldShow(placement, state, now = Date.now()) {
  const s = state || newCapState(); const cap = CAPS[placement];
  if (!cap) return false;
  if (now - (s.lastAny || 0) < CAPS.anyGapMs) return false;
  if (now - (s.last?.[placement] || 0) < cap.gapMs) return false;
  if (cap.everyN && (s.starts || 0) % cap.everyN !== 0) return false;
  return true;
}
/** Count a game start (pre_game only). Returns the new state. */
export const countStart = (state) => ({ ...(state || newCapState()), starts: ((state || newCapState()).starts || 0) + 1 });
/** Record that an ad was shown. */
export const markShown = (state, placement, adId, now = Date.now()) => {
  const s = state || newCapState();
  return { ...s, last: { ...(s.last || {}), [placement]: now }, lastAny: now, lastId: adId };
};
