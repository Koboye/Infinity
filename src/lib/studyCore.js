// Server-side study ledger, pure functions only (storage lives in src/lib/online/studyApi.js).
// The phone reports a finished practice session; the server keeps the daily count, streak, weekly XP and the
// study-to-play bonus. Same Ethiopian calendar day as the level pass (passCore.passDay).
import { passDay, PASS_TZ_OFFSET_MS } from './passCore.js';

export const BONUS_GOAL = 10;       // questions answered in a day that earn the bonus
export const BONUS_LEVELS = 2;      // free game level starts the bonus gives, once per day
export const MAX_SESSION = 200;     // one report can never claim more than this many answers
export const MAX_DAY = 500;         // nor can one day
export const BOARD_SIZE = 50;

const DAY_MS = 86_400_000;
const prevDay = (day) => new Date(Date.parse(day + 'T00:00:00Z') - DAY_MS).toISOString().slice(0, 10);
const int = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v)) || 0));

/** Monday of the Ethiopian week containing `now`, as YYYY-MM-DD. The weekly board resets at Monday 00:00 Addis. */
export function weekKey(now = Date.now()) {
  const dayNum = Math.floor((now + PASS_TZ_OFFSET_MS) / DAY_MS);   // 1970-01-01 was a Thursday
  const sinceMonday = (dayNum + 3) % 7;
  return new Date((dayNum - sinceMonday) * DAY_MS).toISOString().slice(0, 10);
}

/** The leaderboard group of a learner: their grade, or their department for university students. */
export const groupOf = (l) => (!l?.grade ? '' : l.grade === 'uni' ? (l.dept ? 'uni:' + l.dept : '') : l.grade);

/** A streak that was not extended today or yesterday is over. */
export const liveStreakOf = (r, now = Date.now()) => (r && (r.day === passDay(now) || r.day === prevDay(passDay(now))) ? r.streak || 0 : 0);

/** What the phone may see about today's bonus. */
export function bonusView(r, now = Date.now()) {
  const today = r?.day === passDay(now);
  return { goal: BONUS_GOAL, levels: BONUS_LEVELS, answered: today ? Number(r.dayAnswered) || 0 : 0, granted: today && !!r.bonusGranted, left: today ? Number(r.bonusLeft) || 0 : 0 };
}

/** Apply one finished session. Returns { rec, earned } where earned = bonus levels newly granted by this report.
 *  A repeated `sid` (a retry of the same session) changes nothing. */
export function applyReport(rec, report, now = Date.now()) {
  const r = rec || {};
  const answered = int(report?.answered, MAX_SESSION), correct = Math.min(answered, int(report?.correct, MAX_SESSION));
  const sid = String(report?.sid || '').slice(0, 40);
  if (!answered || (sid && r.lastSid === sid)) return { rec: r, earned: 0, changed: false };
  const day = passDay(now), wk = weekKey(now), same = r.day === day;
  const dayAnswered = Math.min(MAX_DAY, (same ? Number(r.dayAnswered) || 0 : 0) + answered);
  const streak = same ? Math.max(1, r.streak || 1) : r.day === prevDay(day) ? (r.streak || 0) + 1 : 1;
  const weekXp = (r.weekKey === wk ? Number(r.weekXp) || 0 : 0) + correct * 10;
  const grant = dayAnswered >= BONUS_GOAL && !(same && r.bonusGranted);
  return {
    changed: true, earned: grant ? BONUS_LEVELS : 0,
    rec: { ...r, day, dayAnswered, streak, best: Math.max(r.best || 0, streak), weekKey: wk, weekXp, lastSid: sid || r.lastSid || '',
      bonusGranted: grant || (same && !!r.bonusGranted), bonusLeft: grant ? BONUS_LEVELS : same ? Number(r.bonusLeft) || 0 : 0 },
  };
}

/** Spend one bonus level (used by the level pass when the player has no paid pass). */
export function consumeBonus(r, now = Date.now()) {
  const v = bonusView(r, now);
  if (v.left <= 0) return { ok: false };
  return { ok: true, rec: { ...r, bonusLeft: v.left - 1 } };
}

const first = (n) => String(n || '').trim().split(/\s+/)[0].slice(0, 14) || 'Learner';
/** Board rows for one kind ('week' | 'streak'), best first, with the caller's own rank.
 *  `docs` = [{ uid, ...record }] already limited to one group. Only first names leave the server. */
export function boardRows(docs, kind, uid, now = Date.now()) {
  const wk = weekKey(now);
  const score = (d) => (kind === 'streak' ? liveStreakOf(d, now) : d.weekKey === wk ? Number(d.weekXp) || 0 : 0);
  const rows = docs.map((d) => ({ uid: d.uid, name: first(d.name), score: score(d), streak: liveStreakOf(d, now) })).filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const ranked = rows.map((x, i) => ({ rank: i + 1, name: x.name, score: x.score, streak: x.streak, me: x.uid === uid }));
  return { rows: ranked.slice(0, 20), me: ranked.find((x) => x.me) || null };
}
