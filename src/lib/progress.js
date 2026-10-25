// Local (on-device) progress: daily streak, per-game record, match history, achievements.
const KEY = 'gebeta.progress.v1';
let currentGame = 'gebeta';
export const setCurrentGame = (g) => { currentGame = g || 'gebeta'; };
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

const DAILY = ['gebeta', 'checkers']; // released games only (Dominoes is "coming soon")
/** One game is the daily challenge; it rotates every day. */
export const dailyGame = () => DAILY[Math.floor(new Date(today()).getTime() / 86400000) % DAILY.length];
export const dailyDone = (p = load()) => p.daily?.date === today() && p.daily.done;
const blank = () => ({ streak: 0, best: 0, last: null, rec: {}, hist: [], ach: {}, flags: {}, daily: null, dailyCount: 0 });
export function load() {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return blank(); }
}
const save = (p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable */ } };

export const ACHIEVEMENTS = [
  { id: 'first_win', icon: '🏆', en: 'First victory', am: 'የመጀመሪያ ድል', test: (p) => total(p, 'w') >= 1 },
  { id: 'wins_10', icon: '🥈', en: '10 wins', am: '10 ድሎች', test: (p) => total(p, 'w') >= 10 },
  { id: 'wins_50', icon: '🥇', en: '50 wins', am: '50 ድሎች', test: (p) => total(p, 'w') >= 50 },
  { id: 'streak_3', icon: '🔥', en: '3-day streak', am: 'የ3 ቀን ተከታታይ', test: (p) => p.best >= 3 },
  { id: 'streak_7', icon: '🌟', en: '7-day streak', am: 'የ7 ቀን ተከታታይ', test: (p) => p.best >= 7 },
  { id: 'king', icon: '👑', en: 'Crowned a king', am: 'ንጉሥ ሠራህ', test: (p) => !!p.flags.king },
  { id: 'all_games', icon: '🎯', en: 'Win every game', am: 'ሁሉንም ጨዋታ አሸንፍ', test: (p) => ['gebeta', 'checkers'].every((g) => (p.rec[g]?.w || 0) > 0) },
  { id: 'draw', icon: '🤝', en: 'A hard-fought draw', am: 'አቻ ወጣህ', test: (p) => total(p, 'd') >= 1 },
  { id: 'daily_3', icon: '📅', en: '3 daily challenges', am: '3 የዕለት ፈተናዎች', test: (p) => (p.dailyCount || 0) >= 3 },
  { id: 'games_25', icon: '🎲', en: '25 games played', am: '25 ጨዋታዎች', test: (p) => total(p, 'w') + total(p, 'l') + total(p, 'd') >= 25 },
];
export const total = (p, k) => Object.values(p.rec).reduce((n, r) => n + (r[k] || 0), 0);

function evaluate(p) {
  const fresh = [];
  for (const a of ACHIEVEMENTS) if (!p.ach[a.id] && a.test(p)) { p.ach[a.id] = today(); fresh.push(a); }
  return fresh;
}
function touchStreak(p) {
  const d = today();
  if (p.last === d) return;
  p.streak = p.last && dayDiff(p.last, d) === 1 ? p.streak + 1 : 1;
  p.best = Math.max(p.best, p.streak); p.last = d;
}
/** Call once when a match ends. tone: 'win' | 'lose' | 'draw'. Returns newly unlocked achievements. */
export function recordResult(tone) {
  const p = load(); const g = currentGame;
  touchStreak(p);
  const r = p.rec[g] || { w: 0, l: 0, d: 0 };
  r[tone === 'win' ? 'w' : tone === 'lose' ? 'l' : 'd']++; p.rec[g] = r;
  p.hist = [{ g, r: tone, at: Date.now() }, ...p.hist].slice(0, 30);
  if (tone === 'win' && g === dailyGame() && !dailyDone(p)) { p.daily = { date: today(), done: true }; p.dailyCount = (p.dailyCount || 0) + 1; }
  const fresh = evaluate(p); save(p); notify(fresh); return fresh;
}
export function mark(flag) {
  const p = load(); if (p.flags[flag]) return;
  p.flags[flag] = true; touchStreak(p); const fresh = evaluate(p); save(p); notify(fresh);
}
export function visit() { const p = load(); touchStreak(p); save(p); }

const listeners = new Set();
export const onUnlock = (f) => { listeners.add(f); return () => listeners.delete(f); };
const notify = (fresh) => { if (fresh.length) listeners.forEach((f) => f(fresh)); };

/** Merge two progress records (device + cloud) without losing anything either side has earned. */
export function mergeProgress(a, b) {
  const A = { ...blank(), ...a }, B = { ...blank(), ...b };
  const rec = {};
  for (const g of ['gebeta', 'checkers', 'dominoes', 'bingo', 'ludo']) { const x = A.rec[g] || {}, y = B.rec[g] || {}; rec[g] = { w: Math.max(x.w || 0, y.w || 0), l: Math.max(x.l || 0, y.l || 0), d: Math.max(x.d || 0, y.d || 0) }; }
  const latest = (A.last || '') >= (B.last || '') ? A : B;
  const ach = { ...B.ach, ...A.ach };
  for (const k of Object.keys(B.ach)) if (A.ach[k] && B.ach[k] < A.ach[k]) ach[k] = B.ach[k];
  const seen = new Set();
  const hist = [...A.hist, ...B.hist].sort((x, y) => y.at - x.at).filter((h) => (seen.has(h.at) ? false : seen.add(h.at))).slice(0, 30);
  const daily = (A.daily?.date || '') >= (B.daily?.date || '') ? A.daily : B.daily;
  return { streak: latest.streak, best: Math.max(A.best, B.best), last: latest.last, rec, hist, ach, flags: { ...B.flags, ...A.flags }, daily, dailyCount: Math.max(A.dailyCount || 0, B.dailyCount || 0) };
}
export const saveMerged = (p) => save(p);
