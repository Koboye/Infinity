// "Free spins" offers: WHEN to invite a player to watch an optional rewarded ad. Pure functions (no storage, network or UI),
// shared by the UI and the tests. The ad itself is always the server's business (adStart / adDone); this only decides
// whether an invitation is worth showing right now.
//
// Smart rules, in plain words:
//   1. NEED    – offer when the player is out of spins or low on coins (that is when a reward is actually useful).
//   2. MOMENT  – a loss is the best moment (the offer cheers the player up); a win only when there is a need.
//   3. RESPECT – a gap between offers, a daily limit, and two ignored offers in a row means silence for a day.
//   4. BLOCKED – a player who cannot afford an online match always sees the offer: it is the way out.
//   5. NEVER   – nothing when the player is signed out, has no ads left today, or already holds a full bonus bank.
import { BONUS_CAP } from './adsCore.js';
import { MIN_FEE } from './walletCore.js';

export const OFFER = {
  lowCoins: 200,                  // below this many coins the player counts as "low"
  maxPerDay: 6,                   // offers shown per day (all places together)
  gapMs: { open: 30 * 60_000, result: 8 * 60_000 },   // minimum time since the last offer shown at that kind of moment
  ignoredBeforeMute: 2,           // this many ignored offers in a row ...
  muteMs: 24 * 3600_000,          // ... and offers stay quiet for a day
  autoHideMs: 14_000,             // an untouched banner goes away by itself (counts as ignored)
};

export const newOfferState = () => ({ day: '', shown: 0, last: { open: 0, result: 0 }, ignored: 0, mutedUntil: 0 });
const dayKey = (now) => new Date(now).toISOString().slice(0, 10);
const fresh = (s, now) => { const b = s && typeof s === 'object' ? s : newOfferState(); return b.day === dayKey(now) ? b : { ...b, day: dayKey(now), shown: 0 }; };

/** Is this player in need of a reward right now? */
export const inNeed = (w) => !!w && (w.spins <= 0 || w.coins < OFFER.lowCoins);

/**
 * ctx = { context: 'open' | 'result' | 'lowcoins', ready, adsLeft, spins, coins, bonus, tone }, state from `newOfferState`.
 * Returns true when an invitation should be shown now.
 */
export function shouldOffer(ctx = {}, state = null, now = Date.now()) {
  if (!ctx.ready || !(ctx.adsLeft > 0)) return false;                 // signed out / daily limit reached
  if ((ctx.bonus || 0) >= BONUS_CAP) return false;                    // the bonus bank is full: another reward would be wasted
  if (ctx.context === 'lowcoins') return ctx.coins < MIN_FEE;         // blocked from a match: always offer the way out
  const s = fresh(state, now);
  if (s.mutedUntil > now) return false;
  if (s.shown >= OFFER.maxPerDay) return false;
  const kind = ctx.context === 'result' ? 'result' : 'open';
  if (now - (s.last?.[kind] || 0) < OFFER.gapMs[kind]) return false;
  if (inNeed(ctx)) return true;
  return kind === 'result' && ctx.tone === 'lose';                    // a loss is a kind moment for a bonus; a win needs a real need
}

/** An offer is on screen. */
export const noteShown = (state, context, now = Date.now()) => {
  const s = fresh(state, now); const kind = context === 'result' ? 'result' : 'open';
  return { ...s, shown: s.shown + 1, last: { ...s.last, [kind]: now } };
};
/** The player watched (or tried to watch): the streak of ignored offers ends. */
export const noteAccepted = (state, now = Date.now()) => ({ ...fresh(state, now), ignored: 0, mutedUntil: 0 });
/** The player closed it or ignored it. Two in a row = a quiet day. */
export const noteIgnored = (state, now = Date.now()) => {
  const s = fresh(state, now); const ignored = s.ignored + 1;
  return { ...s, ignored, mutedUntil: ignored >= OFFER.ignoredBeforeMute ? now + OFFER.muteMs : s.mutedUntil };
};
