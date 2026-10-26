// Client side of the ad system. Rules live in adsCore.js; this file only fetches, caches, schedules and reports.
//
//  • The ad feed (`/api/ads`) is cached on the phone for 10 minutes and its pictures are preloaded, so an ad appears
//    the instant it is due, with no spinner. Offline or failing server = no ad. An ad can NEVER block the app.
//  • Frequency caps (adsCore.CAPS) are kept in local storage: losing them only means one extra ad, never a broken app.
//  • Rewarded ads are different: the server picks them and times them (see Wallet.adStart / adDone).
//  • Which ad? adsSmart.smartPick: language / hour / game targeting, tap-rate learning, daily-budget pacing and per-player fatigue.
//    New players get an ad-free first 10 minutes.
import { shouldShow, countStart, markShown, newCapState, clampSeconds, houseAd } from './adsCore.js';
import { smartPick, seenToday, noteSeen, noteCategory, stampFirst, inGrace } from './adsSmart.js';

const FEED_KEY = 'gebeta.ads.feed', CAP_KEY = 'gebeta.ads.caps', FEED_TTL = 60 * 1000;   // v57: a minute (was 10) — a new or edited ad reaches phones almost at once
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

let feed = null, inflight = null;

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
function preload(ads) {
  if (typeof Image === 'undefined') return;
  for (const a of ads) { const i = new Image(); i.decoding = 'async'; i.src = a.image; }
}

/** The ads this phone may show on open / before a game. Cached; never throws. */
export function loadFeed() {
  const now = Date.now();
  const fresh = testMode();
  if (!fresh && feed && now - feed.at < FEED_TTL) return Promise.resolve(feed.ads);
  const cached = read(FEED_KEY);
  if (!fresh && cached && Array.isArray(cached.ads) && now - cached.at < FEED_TTL) { feed = cached; preload(cached.ads); return Promise.resolve(cached.ads); }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 4000);
      const res = await fetch(fresh ? `/api/ads?fresh=${Date.now()}` : '/api/ads', { signal: ctl.signal, ...(fresh ? { cache: 'no-store' } : {}) }); clearTimeout(to);
      if (!res.ok) throw new Error('feed');
      const data = await res.json(); const ads = Array.isArray(data.ads) ? data.ads : [];
      feed = { at: Date.now(), ads }; write(FEED_KEY, feed); preload(ads);
      return ads;
    } catch { return Array.isArray(cached?.ads) ? cached.ads : []; } finally { inflight = null; }
  })();
  return inflight;
}

/** Start fetching early (app open) so the first ad is ready when it is due. */
export const warm = () => { loadFeed(); };

/**
 * The next ad for a placement, or null when none is due (frequency caps), none is live, or the network is too slow.
 * `pre_game` counts one game start per call.
 */
export async function nextAd(placement, { waitMs = 1500, lang = 'en', game = null } = {}) {
  const now = Date.now();
  if (testMode()) {                                           // owner test: any live ad for this placement, no caps, no grace
    const ads = (await Promise.race([loadFeed(), new Promise((r) => setTimeout(() => r([]), Math.max(waitMs, 3000)))])).filter((a) => (a.placements || []).includes(placement));
    const ad = ads[Math.floor(Math.random() * ads.length)];
    return ad ? { ...ad, durationSec: clampSeconds(ad.durationSec, placement) } : houseAd(placement);
  }
  let caps = stampFirst(read(CAP_KEY) || newCapState(), now);
  if (placement === 'pre_game') caps = countStart(caps);
  write(CAP_KEY, caps);
  if (inGrace(caps, now)) return null;                       // brand-new player: no ads yet
  if (!shouldShow(placement, caps, now)) return null;
  const ads = await Promise.race([loadFeed(), new Promise((r) => setTimeout(() => r([]), waitMs))]);
  const ad = smartPick(ads, { placement, lang: lang === 'am' ? 'am' : 'en', game, hour: new Date(now).getHours(), seen: seenToday(caps, now), lastCategory: caps.lastCategory, avoidId: caps.lastId, now, explore: true });
  return ad ? { ...ad, durationSec: clampSeconds(ad.durationSec, placement) } : houseAd(placement);   // no paid ad fits: the built-in one, so every open and every game start has an ad
}

function track(event, ad) {
  if (ad.id === 'house') return;                              // the built-in ad has no advertiser stats
  try { fetch('/api/ads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, adId: ad.id }), keepalive: true }).catch(() => {}); } catch { /* best effort */ }
}
/** The ad is on screen. Splash / pre-game ads are counted here; rewarded ones are counted by the server when they pay out. */
export function shown(placement, ad) {
  if (placement === 'rewarded' || testMode()) return;       // test mode never touches caps or stats
  const now = Date.now();
  write(CAP_KEY, noteCategory(noteSeen(markShown(read(CAP_KEY) || newCapState(), placement, ad.id, now), ad.id, now), ad.category));
  track('impression', ad);
}
export const clicked = (ad) => { if (!testMode()) track('click', ad); };
