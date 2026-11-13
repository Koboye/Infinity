// Per-device progress: XP, day streak, daily goal, best scores and the mistakes list. Stored in localStorage only (no account needed).
export const DAILY_GOAL = 20;
const KEY = 'examprep.progress.v1';
const DEF = { xp: 0, streak: 0, last: '', day: '', today: 0, best: {}, mistakes: {}, answered: 0, correct: 0 };
const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return ymd(d); };

export function loadProgress() {
  try { const s = { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; if (s.day !== ymd()) s.today = 0; return s; } catch { return { ...DEF }; }
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked: progress is a bonus, not required */ } }

/** Record one answered question. Returns the new state and the XP earned. */
export function recordAnswer(dept, q, correct, combo = 0) {
  const s = loadProgress(), t = ymd();
  if (s.day !== t) { s.streak = s.last === yesterday() ? s.streak + 1 : 1; s.day = t; s.today = 0; s.last = t; }
  else if (!s.streak) s.streak = 1;
  s.last = t; s.today += 1; s.answered += 1;
  const gain = correct ? 10 + Math.min(combo, 5) * 2 : 2;
  s.xp += gain; if (correct) s.correct += 1;
  const m = (s.mistakes[dept] ||= {});
  if (correct) delete m[q.id];
  else if (Object.keys(m).length < 200) m[q.id] = { id: q.id, text: q.text, options: q.options, answer: q.answer, explanation: q.explanation, topic: q.topic || '' };
  save(s);
  return { state: s, gain };
}
export function saveBest(key, pct) { const s = loadProgress(); if (pct > (s.best[key] || 0)) { s.best[key] = pct; save(s); } return s; }
export const mistakesFor = (dept) => Object.values(loadProgress().mistakes[dept] || {});
export const levelOf = (xp) => ({ level: Math.floor(Math.sqrt(xp / 50)) + 1, into: xp - 50 * Math.floor(Math.sqrt(xp / 50)) ** 2, next: 50 * (Math.floor(Math.sqrt(xp / 50)) + 1) ** 2 - 50 * Math.floor(Math.sqrt(xp / 50)) ** 2 });
