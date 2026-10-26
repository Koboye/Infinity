// Client side of the ad system. Rules live in adsCore.js; this file only fetches, caches, schedules and reports.
//
//  • The ad feed (`/api/ads`) is cached on the phone for 10 minutes and its pictures are preloaded, so an ad appears
//    the instant it is due, with no spinner. Offline or failing server = no ad. An ad can NEVER block the app.
//  • Frequency caps (adsCore.CAPS) are kept in local storage: losing them only means one extra ad, never a broken app.
//  • Rewarded ads are different: the server picks them and times them (see Wallet.adStart / adDone).
import { pickAd, shouldShow, countStart, markShown, newCapState, clampSeconds } from './adsCore.js';

const FEED_KEY = 'gebeta.ads.feed', CAP_KEY = 'gebeta.ads.caps', FEED_TTL = 10 * 60 * 1000;
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

let feed = null, inflight = null;
function preload(ads) {
  if (typeof Image === 'undefined') return;
  for (const a of ads) { const i = new Image(); i.decoding = 'async'; i.src = a.image; }
}

/** The ads this phone may show on open / before a game. Cached; never throws. */
export function loadFeed() {
  const now = Date.now();
  if (feed && now - feed.at < FEED_TTL) return Promise.resolve(feed.ads);
  const cached = read(FEED_KEY);
  if (cached && Array.isArray(cached.ads) && now - cached.at < FEED_TTL) { feed = cached; preload(cached.ads); return Promise.resolve(cached.ads); }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 4000);
      const res = await fetch('/api/ads', { signal: ctl.signal }); clearTimeout(to);
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
export async function nextAd(placement, { waitMs = 1500 } = {}) {
  let caps = read(CAP_KEY) || newCapState();
  if (placement === 'pre_game') { caps = countStart(caps); write(CAP_KEY, caps); }
  if (!shouldShow(placement, caps, Date.now())) return null;
  const ads = await Promise.race([loadFeed(), new Promise((r) => setTimeout(() => r([]), waitMs))]);
  const ad = pickAd(ads, placement, { avoidId: caps.lastId });
  return ad ? { ...ad, durationSec: clampSeconds(ad.durationSec, placement) } : null;
}

function track(event, ad) {
  try { fetch('/api/ads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, adId: ad.id }), keepalive: true }).catch(() => {}); } catch { /* best effort */ }
}
/** The ad is on screen. Splash / pre-game ads are counted here; rewarded ones are counted by the server when they pay out. */
export function shown(placement, ad) {
  if (placement === 'rewarded') return;
  write(CAP_KEY, markShown(read(CAP_KEY) || newCapState(), placement, ad.id, Date.now()));
  track('impression', ad);
}
export const clicked = (ad) => track('click', ad);
