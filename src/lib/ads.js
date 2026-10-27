// Client side of the ad system. Rules live in adsCore.js; this file only fetches, caches, schedules and reports.
//
//  • The ad feed (`/api/ads`) is cached on the phone for 10 minutes and its pictures are preloaded, so an ad appears
//    the instant it is due, with no spinner. Offline or failing server = no ad. An ad can NEVER block the app.
//  • Frequency caps (adsCore.CAPS) are kept in local storage: losing them only means one extra ad, never a broken app.
//  • Rewarded ads are different: the server picks them and times them (see Wallet.adStart / adDone).
//  • Which ad? adsSmart.rotatePick (v67): every eligible ad in consecutive order A, B, C, A…; targeting and per-player daily limits still apply.
//    New players get an ad-free first 10 minutes.
import { shouldShow, countStart, markShown, newCapState, clampSeconds, houseAd, CAPS } from './adsCore.js';
import { rotatePick, newestFirst, seenToday, noteSeen, noteCategory, stampFirst, inGrace } from './adsSmart.js';

const FEED_KEY = 'gebeta.ads.feed', CAP_KEY = 'gebeta.ads.caps', FEED_TTL = 60 * 1000;   // v57: a minute (was 10) — a new or edited ad reaches phones almost at once
/** v78: the server only sends ads that are live right now, so an ad without dates (an older cached feed) counts as live instead of being dropped. */
export const vouched = (a) => ({ ...a, start: typeof a?.start === 'string' ? a.start : '1970-01-01', end: typeof a?.end === 'string' ? a.end : '9999-12-31', active: a?.active !== false });
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

let feed = null, inflight = null;
const badImages = new Set();   // v64: ads whose picture failed to load in this session. They are skipped so the next ad shows instead of a silent gap; a reload tries them again.
export const markBad = (ad) => { if (ad && ad.id && ad.id !== 'house') { badImages.add(ad.id); try { console.warn(`[ads] picture of "${ad.id}" failed to load (${ad.image}); showing another ad`); } catch { /* no console */ } } };

/**
 * Owner test mode: open the app as  https://YOUR-DOMAIN/?adtest=1  (and  ?adtest=0  to leave it).
 * While on, the ad list is always fetched fresh, the new-player grace and every frequency cap are skipped, and nothing is counted
 * in the stats — so a brand-new ad shows on every app open and every game start. Lives only in this browser tab (sessionStorage).
 */
export function testMode() {
  try {
    if (typeof window === 'undefined') return false;
    const q = new URLSearchParams(window.location.search).get('adtest');
    if (q === '1') sessionStorage.setItem('gebeta.adtest', '1');
    else if (q === '0') sessionStorage.removeItem('gebeta.adtest');
    return sessionStorage.getItem('gebeta.adtest') === '1';
  } catch { return false; }
}
/** Owner test mode: which ad is next. Lives in this tab only. */
function testTurn() {
  try { const n = Number(sessionStorage.getItem('gebeta.adtest.n') || 0); sessionStorage.setItem('gebeta.adtest.n', String(n + 1)); return n; } catch { return Math.floor(Math.random() * 1000); }
}
function preload(ads) {
  if (typeof Image === 'undefined') return;
  for (const a of ads) { const i = new Image(); i.decoding = 'async'; i.referrerPolicy = 'no-referrer'; i.onerror = () => markBad(a); i.onload = () => badImages.delete(a.id); i.src = a.image; }
}

/** The ads this phone may show on open / before a game. Cached; never throws. */
export function loadFeed() {
  const now = Date.now();
  const fresh = testMode();
  if (!fresh && feed && now - feed.at < FEED_TTL) return Promise.resolve(feed.ads);
  const cached = read(FEED_KEY);
  if (!fresh && cached && Array.isArray(cached.ads) && now - cached.at < FEED_TTL) { cached.ads = cached.ads.map(vouched); feed = cached; preload(cached.ads); return Promise.resolve(cached.ads); }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 4000);
      const res = await fetch(fresh ? `/api/ads?fresh=${Date.now()}` : '/api/ads', { signal: ctl.signal, ...(fresh ? { cache: 'no-store' } : {}) }); clearTimeout(to);
      if (!res.ok) throw new Error('feed');
      const data = await res.json(); const ads = (Array.isArray(data.ads) ? data.ads : []).map(vouched);
      feed = { at: Date.now(), ads }; write(FEED_KEY, feed); preload(ads);
      return ads;
    } catch { return Array.isArray(cached?.ads) ? cached.ads.map(vouched) : []; } finally { inflight = null; }
  })();
  return inflight;
}

/** Start fetching early (app open) so the first ad is ready when it is due. */
export const warm = () => { loadFeed(); };

/**
 * The next ad for a placement, or null when none is due (frequency caps), none is live, or the network is too slow.
 * `pre_game` counts one game start per call.
 */
export async function nextAd(placement, { waitMs = 1500, lang = 'en', game = null, retry = false } = {}) {
  const now = Date.now();
  if (testMode()) {                                           // owner test: any live ad for this placement, no caps, no grace
    const ads = (await Promise.race([loadFeed(), new Promise((r) => setTimeout(() => r([]), Math.max(waitMs, 3000)))])).filter((a) => (a.placements || []).includes(placement) && !badImages.has(a.id)).sort(newestFirst);
    const ad = ads[testTurn() % ads.length];   // v64: take turns (A, B, A, B…). A random pick showed the same ad again half the time, so two test ads looked like one
    return ad ? { ...ad, durationSec: clampSeconds(ad.durationSec, placement) } : houseAd(placement);
  }
  let caps = stampFirst(read(CAP_KEY) || newCapState(), now);
  if (placement === 'pre_game' && !retry) caps = countStart(caps);   // a retry after a broken picture is the same game start
  write(CAP_KEY, caps);
  if (inGrace(caps, now)) return null;                       // brand-new player: no ads yet
  if (!shouldShow(placement, caps, now)) return null;
  const ads = (await Promise.race([loadFeed(), new Promise((r) => setTimeout(() => r([]), waitMs))])).filter((a) => !badImages.has(a.id));
  const ad = rotatePick(ads, { placement, lang: lang === 'am' ? 'am' : 'en', game, hour: new Date(now).getHours(), seen: seenToday(caps, now), lastId: caps.lastId, now });   // v67: consecutive order, one after the other
  return ad ? { ...ad, durationSec: clampSeconds(ad.durationSec, placement) } : houseAd(placement);   // no paid ad fits: the built-in one, so every open and every game start has an ad
}

const tokens = new Map();   // v65: adId -> signed one-use token from the impression (server proof that this tap follows a real view)
function track(event, ad) {
  if (ad.id === 'house') return;                              // the built-in ad has no advertiser stats
  try {
    const body = { event, adId: ad.id };
    if (event === 'click') { const tk = tokens.get(ad.id); if (tk) { body.token = tk; tokens.delete(ad.id); } }
    fetch('/api/ads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true })
      .then((r) => r.json()).then((d) => { if (event === 'impression' && d?.token) tokens.set(ad.id, d.token); }).catch(() => {});
  } catch { /* best effort */ }
}
/** The ad is on screen. Splash / pre-game ads are counted here; rewarded ones are counted by the server when they pay out. */
export function shown(placement, ad) {
  if (placement === 'rewarded' || testMode()) return;       // test mode never touches caps or stats
  const now = Date.now();
  write(CAP_KEY, noteCategory(noteSeen(markShown(read(CAP_KEY) || newCapState(), placement, ad.id, now), ad.id, now), ad.category));
  track('impression', ad);
}
export const clicked = (ad) => { if (!testMode()) track('click', ad); };

// ── v66: the ad between rounds ("Play again" / "Rematch") ──────────────────────────────────────────────────────────
// The app shell registers how to run a full-screen ad; every game calls `gate()` before it restarts. The gate never throws and never
// waits for anything but the ad itself. A quick second rematch is not spammed: the gap since the last game-start ad must exceed CAPS.rematchGapMs.
let gateRunner = null;
export const setGate = (fn) => { gateRunner = typeof fn === 'function' ? fn : null; };
export const rematchDue = (caps, now = Date.now()) => now - (caps?.last?.pre_game || 0) >= CAPS.rematchGapMs;
export async function gate(game = null) {
  try {
    game = game || (typeof document !== 'undefined' ? document.documentElement.dataset.game : null) || null;
    if (!gateRunner) return;
    if (!testMode() && !rematchDue(read(CAP_KEY), Date.now())) return;
    await gateRunner(game);
  } catch { /* an ad problem never stops a game */ }
}
