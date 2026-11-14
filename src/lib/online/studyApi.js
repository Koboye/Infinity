// Study ledger, server side. studyStats/{uid} = { name, group, day, dayAnswered, streak, best, weekKey, weekXp, bonusGranted, bonusLeft, lastSid }
// Written only with the Admin SDK (rules deny the phone). The phone reports finished sessions; amounts are capped and
// a session id makes retries harmless. The bonus is small (BONUS_LEVELS a day) so a forged report is worth little.
import { applyReport, bonusView, boardRows, groupOf, liveStreakOf, weekKey, BOARD_SIZE } from '../studyCore.js';
import { paywallOn } from './passApi.js';

export const statsRef = (db, uid) => db.collection('studyStats').doc(uid);

async function groupFor(db, uid) {
  try { const s = await db.collection('learners').doc(uid).get(); return s.exists ? groupOf(s.data()) : ''; } catch { return ''; }
}

async function fetchGroup(db, group, kind, now) {
  if (!group) return [];
  let q = db.collection('studyStats').where('group', '==', group);
  q = kind === 'streak' ? q.orderBy('streak', 'desc') : q.where('weekKey', '==', weekKey(now)).orderBy('weekXp', 'desc');
  const snap = await q.limit(BOARD_SIZE).get();
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function studyInfo(db, uid, now = Date.now()) {
  const s = await statsRef(db, uid).get(), r = s.exists ? s.data() : null;
  const group = r?.group || await groupFor(db, uid);
  let rank = null;
  try { rank = boardRows(await fetchGroup(db, group, 'week', now), 'week', uid, now).me?.rank || null; } catch { /* the rank is a nicety */ }
  return { paywall: paywallOn(), bonus: bonusView(r, now), streak: liveStreakOf(r, now), weekXp: r?.weekKey === weekKey(now) ? r.weekXp || 0 : 0, rank, hasGroup: !!group };
}

export async function studyReport(db, uid, report, name, now = Date.now()) {
  const group = await groupFor(db, uid);
  const out = await db.runTransaction(async (tx) => {
    const s = await tx.get(statsRef(db, uid));
    const r = applyReport(s.exists ? s.data() : null, report, now);
    if (r.changed) tx.set(statsRef(db, uid), { ...r.rec, name: String(name || '').slice(0, 40), group });
    return r;
  });
  return { earned: out.earned, ...(await studyInfo(db, uid, now)) };
}

export async function studyBoard(db, uid, kind, now = Date.now()) {
  const k = kind === 'streak' ? 'streak' : 'week';
  const s = await statsRef(db, uid).get();
  const group = s.exists ? s.data().group || '' : await groupFor(db, uid);
  return { kind: k, hasGroup: !!group, ...boardRows(await fetchGroup(db, group, k, now), k, uid, now) };
}
