// Daily goal + streak, kept in the learner's local stats. Pure, so it is easy to test.
export const DAILY_GOAL = 10;
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
export function recordSession(stats, answered, correct, now = new Date()) {
  const p = stats || {};
  const today = dayKey(now);
  const sameDay = p.day === today;
  const streak = sameDay ? Math.max(1, p.streak || 1) : p.day === yesterdayKey(now) ? (p.streak || 0) + 1 : 1;
  return {
    ...p,
    answered: (p.answered || 0) + answered,
    correct: (p.correct || 0) + correct,
    xp: (p.xp || 0) + correct * 10,
    day: today,
    dayCount: (sameDay ? p.dayCount || 0 : 0) + answered,
    streak,
    best: Math.max(p.best || 0, streak),
  };
}
