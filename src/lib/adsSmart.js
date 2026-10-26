// Smart ad selection. Pure functions (no storage, network or UI) shared by the client, the server routes and the tests.
//
// What "smart" means here, in plain words:
//   1. TARGET   – an ad may be limited to a language, an hour-of-day window and/or specific games.
//   2. LEARN    – ads that people actually tap are shown more (Bayesian-smoothed tap rate, so a new ad with little data
//                 is neither buried nor over-trusted, and every ad keeps at least half of its normal share).
//   3. PACE     – an ad with a daily budget (`dailyCap`) is spread over the day instead of burning out by 9 am.
//   4. PROTECT  – a player never sees one ad more than `maxPerUser` times a day, prefers ads they have seen less,
//                 does not get the same kind of ad twice in a row, and new players get an ad-free first 10 minutes.
// Hard rules (dates, active flag, placement, frequency caps in adsCore.CAPS) still apply first; this only ranks what is left.
import { forPlacement, todayKey } from './adsCore.js';

export const SMART = {
  priorCtr: 0.02,        // what a typical ad earns (2 % taps); new ads start here
  priorWeight: 200,      // how many "pretend" impressions the prior is worth (an ad needs a few hundred views before its own numbers dominate)
  minQuality: 0.5,       // the worst ad still keeps half its share (so it can recover and we keep learning)
  maxQuality: 2.5,       // the best ad gets at most 2.5× its share
  fatigue: 0.5,          // every time a player already saw this ad today, its chance is multiplied by this
  sameCategory: 0.6,     // chance multiplier when it is the same kind of ad as the one just shown
  targetBoost: 1.3,      // an ad aimed at exactly this language / game is preferred a little
  defaultMaxPerUser: 3,  // views of one ad per player per day, unless the ad says otherwise
  graceMs: 10 * 60 * 1000, // a brand-new player gets no ads for the first 10 minutes
  paceMin: 0.2, paceMax: 1.5,
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Tap rate, pulled toward the prior while an ad has few impressions. */
export const smoothedCtr = (imps = 0, clicks = 0) => (Math.max(0, clicks) + SMART.priorCtr * SMART.priorWeight) / (Math.max(0, imps) + SMART.priorWeight);
/** How much better / worse than a typical ad (0.5 … 2.5). */
export const quality = (perf) => clamp(smoothedCtr(perf?.i, perf?.c) / SMART.priorCtr, SMART.minQuality, SMART.maxQuality);

/** Is `hour` (0–23) inside the window? `from > to` wraps midnight (22 → 6). No window (or from === to) = all day. */
export function inHours(hours, hour) {
  if (!hours || !Number.isInteger(hours.from) || !Number.isInteger(hours.to) || hours.from === hours.to) return true;
  return hours.from < hours.to ? hour >= hours.from && hour < hours.to : hour >= hours.from || hour < hours.to;
}

/**
 * Daily-budget pacing for an ad with a cap. 1 = on schedule; below 1 = ahead of schedule (slow down); above 1 = behind (speed up).
 * Evaluated by the server (it knows today's total) and sent to phones as `pace`.
 */
export function paceFactor(used, cap, now = Date.now()) {
  if (!cap || cap <= 0) return 1;
  const d = new Date(now); const dayFrac = (d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()) / 86400;
  const budgetLeft = 1 - clamp(used / cap, 0, 1), timeLeft = Math.max(0.05, 1 - dayFrac);
  return clamp(budgetLeft / timeLeft, SMART.paceMin, SMART.paceMax);
}

/** Is this ad allowed for this viewer right now? (hard rules only) */
export function eligible(ad, ctx = {}) {
  const t = ad.t || {};
  if (t.langs?.length && ctx.lang && !t.langs.includes(ctx.lang)) return false;
  if (t.hours && Number.isInteger(ctx.hour) && !inHours(t.hours, ctx.hour)) return false;
  if (ctx.placement === 'pre_game' && t.games?.length && ctx.game && !t.games.includes(ctx.game)) return false;
  const seen = ctx.seen?.[ad.id] || 0;
  if (seen >= (t.maxPerUser || SMART.defaultMaxPerUser)) return false;
  return true;
}

/** Relative chance of showing this ad (always > 0 for an eligible ad). */
export function score(ad, ctx = {}) {
  const t = ad.t || {};
  let s = Math.max(1, ad.weight || 1) * quality(ad.perf) * (Number.isFinite(ad.pace) ? clamp(ad.pace, SMART.paceMin, SMART.paceMax) : 1);
  s *= Math.pow(SMART.fatigue, ctx.seen?.[ad.id] || 0);
  if (ctx.lastCategory && ad.category === ctx.lastCategory) s *= SMART.sameCategory;
  if (t.langs?.length && t.langs.includes(ctx.lang)) s *= SMART.targetBoost;
  if (ctx.placement === 'pre_game' && t.games?.length && t.games.includes(ctx.game)) s *= SMART.targetBoost;
  return s;
}

/**
 * The smart pick. ctx = { placement, lang, game, hour, seen:{adId:n}, lastCategory, avoidId, now, rand }.
 * Returns an ad or null (no ad is better than a wrong ad).
 */
export function smartPick(ads, ctx = {}) {
  const { placement, now = Date.now(), rand = Math.random, avoidId = null } = ctx;
  let list = forPlacement(ads, placement, now).filter((a) => eligible(a, ctx));
  if (list.length > 1 && avoidId) list = list.filter((a) => a.id !== avoidId);
  if (!list.length) return null;
  const scores = list.map((a) => score(a, ctx)); const total = scores.reduce((s, v) => s + v, 0);
  let r = rand() * total;
  for (let i = 0; i < list.length; i++) { r -= scores[i]; if (r < 0) return list[i]; }
  return list[list.length - 1];
}

// ── Per-player memory (kept by the client next to the frequency caps) ──
/** How many times this player saw each ad today. */
export function seenToday(state, now = Date.now()) {
  const day = todayKey(now); const out = {};
  for (const [id, v] of Object.entries(state?.seen || {})) if (v?.day === day) out[id] = v.n || 0;
  return out;
}
/** Count one view of an ad (and forget other days). */
export function noteSeen(state, adId, now = Date.now()) {
  const s = state || {}; const day = todayKey(now); const seen = {};
  for (const [id, v] of Object.entries(s.seen || {})) if (v?.day === day) seen[id] = v;
  seen[adId] = { day, n: (seen[adId]?.n || 0) + 1 };
  return { ...s, seen, lastCategory: s.lastCategory };
}
export const noteCategory = (state, category) => ({ ...(state || {}), lastCategory: category || null });
/** First open is remembered; new players get an ad-free start. */
export const stampFirst = (state, now = Date.now()) => (state?.firstAt ? state : { ...(state || {}), firstAt: now });
export const inGrace = (state, now = Date.now()) => !!state?.firstAt && now - state.firstAt < SMART.graceMs;

// ── Advice for the owner page ──
/**
 * Plain-language notes about one ad. perf = last-7-days { i, c, r, today }, avg = average tap rate of all ads (0–1).
 * Returns [{ level: 'good' | 'warn' | 'info', text }].
 */
export function adviseAd(ad, perf = {}, { today = todayKey(), avg = 0 } = {}) {
  const out = []; const i = perf.i || 0, c = perf.c || 0, ctr = i ? c / i : 0;
  const live = ad.active !== false && ad.start <= today && today <= ad.end;
  if (live && i === 0 && ad.start < today) out.push({ level: 'warn', text: 'Live but not shown in 7 days. Check placements, language / hours / games targeting, and the daily cap.' });
  if (i >= 300 && avg > 0 && ctr < avg * 0.5) out.push({ level: 'warn', text: `Taps are ${(ctr * 100).toFixed(1)}% — under half the average (${(avg * 100).toFixed(1)}%). Try a clearer picture or button text.` });
  if (i >= 200 && avg > 0 && ctr > avg * 1.5) out.push({ level: 'good', text: `Taps are ${(ctr * 100).toFixed(1)}% — well above the average. The app already shows it more.` });
  if (ad.dailyCap > 0 && (perf.today || 0) >= ad.dailyCap) out.push({ level: 'info', text: 'Daily limit reached today. It resumes tomorrow.' });
  if (live) { const left = Math.round((Date.parse(`${ad.end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000); if (left <= 3) out.push({ level: 'info', text: left <= 0 ? 'Last day.' : `Ends in ${left} day${left === 1 ? '' : 's'}.` }); }
  if (!ad.clickUrl) out.push({ level: 'info', text: 'No tap link: people can see it but cannot go anywhere.' });
  return out;
}
