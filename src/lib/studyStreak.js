// Daily goal + streak, kept in the learner's local stats. Pure, so it is easy to test.
export const DAILY_GOAL = 10;
// The learner can choose 5, 10, 20 or 30 questions a day; anything else falls back to 10.
export const goalOf = (stats) => ([5, 10, 20, 30].includes(Number(stats?.goal)) ? Number(stats.goal) : DAILY_GOAL);
const dayKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const yesterdayKey = (d) => { const y = new Date(d); y.setDate(y.getDate() - 1); return dayKey(y); };

export function todayCount(stats, now = new Date()) {
  return stats && stats.day === dayKey(now) ? Number(stats.dayCount) || 0 : 0;
}
// A streak that was not extended yesterday or today is over, even though the number is still stored.
export function liveStreak(stats, now = new Date()) {
  const day = stats?.day;
  if (!day || !stats.streak) return 0;
  return day === dayKey(now) || day === yesterdayKey(now) ? stats.streak : 0;
}
export function recordSession(stats, answered, correct, now = new Date(), subject = '', mode = '') {
  const p = stats || {};
  const today = dayKey(now);
  const sameDay = p.day === today;
  const streak = sameDay ? Math.max(1, p.streak || 1) : p.day === yesterdayKey(now) ? (p.streak || 0) + 1 : 1;
  return {
    ...p,
    answered: (p.answered || 0) + answered,
    correct: (p.correct || 0) + correct,
    xp: (p.xp || 0) + correct * 10,
    days: pruneDays({...(p.days || {}), [today]: ((p.days || {})[today] || 0) + answered}, now),
    subjects: subject ? {...(p.subjects || {}), [subject]: {a: ((p.subjects || {})[subject]?.a || 0) + answered, c: ((p.subjects || {})[subject]?.c || 0) + correct}} : (p.subjects || {}),
    last: subject || p.last || '',
    history: subject ? [{s: subject, m: mode || 'practice', p: answered ? Math.round((correct / answered) * 100) : 0, n: answered, t: now.getTime()}, ...(p.history || [])].slice(0, 12) : (p.history || []),
    day: today,
    dayCount: (sameDay ? p.dayCount || 0 : 0) + answered,
    streak,
    best: Math.max(p.best || 0, streak),
  };
}

const daysAgo = (now, n) => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };
// Keep only the last 30 days of activity so the saved stats stay small.
function pruneDays(days, now) {
  const keep = new Set(Array.from({length: 30}, (_, i) => dayKey(daysAgo(now, i))));
  return Object.fromEntries(Object.entries(days).filter(([k]) => keep.has(k)));
}
/** Questions answered on each of the last 7 days, oldest first. */
export function weekActivity(stats, now = new Date(), locale = 'en') {
  return Array.from({length: 7}, (_, i) => {
    const d = daysAgo(now, 6 - i), key = dayKey(d);
    return {key, label: d.toLocaleDateString(locale, {weekday: 'short'}), count: Number(stats?.days?.[key]) || 0, today: i === 6};
  });
}
/** Level 1 starts at 0 XP; every 100 XP is a new level. */
export function levelFor(xp) {
  const x = Math.max(0, Number(xp) || 0);
  return {level: Math.floor(x / 100) + 1, into: x % 100, size: 100};
}
/** Accuracy per subject the learner has practised, most answered first. */
export function subjectStats(stats) {
  return Object.entries(stats?.subjects || {})
    .map(([name, v]) => ({name, answered: v.a || 0, correct: v.c || 0, pct: v.a ? Math.round((v.c / v.a) * 100) : 0}))
    .filter((x) => x.answered > 0).sort((a, b) => b.answered - a.answered);
}
/** Achievements are worked out from the learner's own numbers. */
export function achievements(stats) {
  const a = stats?.answered || 0, xp = stats?.xp || 0, best = stats?.best || 0;
  const acc = a ? (stats.correct || 0) / a : 0;
  return [
    {id: 'first', title: 'First steps', desc: 'Answer your first question', done: a >= 1},
    {id: 'a50', title: 'Warming up', desc: 'Answer 50 questions', done: a >= 50},
    {id: 'a250', title: 'Dedicated', desc: 'Answer 250 questions', done: a >= 250},
    {id: 's3', title: 'On a roll', desc: 'Reach a 3-day streak', done: best >= 3},
    {id: 's7', title: 'Unstoppable', desc: 'Reach a 7-day streak', done: best >= 7},
    {id: 'xp500', title: 'XP collector', desc: 'Earn 500 XP', done: xp >= 500},
    {id: 'acc', title: 'Sharp mind', desc: '80% accuracy over 50+ answers', done: a >= 50 && acc >= 0.8},
  ];
}

/** What to study next: the subject the learner touched last, else their weakest, else the first one. Pure. */
export function nextUp(stats, subjects) {
  if (!subjects?.length) return null;
  const by = (n) => subjects.find((d) => d.name === n);
  const weak = subjectStats(stats).filter((x) => x.answered >= 5 && x.pct < 70 && by(x.name)).sort((a, b) => a.pct - b.pct)[0];
  if (weak) return {subject: by(weak.name), why: 'weak', pct: weak.pct};
  const last = by(stats?.last);
  if (last) return {subject: last, why: 'last'};
  const fresh = subjects.find((d) => !stats?.subjects?.[d.name]);
  return {subject: fresh || subjects[0], why: 'new'};
}

/** Scheduled exams: {id, subject, date:'YYYY-MM-DD'}. Upcoming ones, soonest first, with whole days left. */
export function upcomingExams(stats, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return (stats?.exams || [])
    .map((e) => { const [y, m, d] = String(e.date).split('-').map(Number); return {...e, days: Math.round((new Date(y, (m || 1) - 1, d || 1).getTime() - today) / 86400000)}; })
    .filter((e) => Number.isFinite(e.days) && e.days >= 0)
    .sort((a, b) => a.days - b.days);
}
