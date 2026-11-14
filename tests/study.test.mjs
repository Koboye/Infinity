// Study ledger: streak, weekly XP, the study-to-play bonus (spent by the level pass), leaderboard, reminders.
import assert from 'node:assert/strict';
process.env.PAYWALL = '1';
const { generateVAPIDKeys } = await import('web-push');
const keys = generateVAPIDKeys(); process.env.VAPID_PUBLIC_KEY = keys.publicKey; process.env.VAPID_PRIVATE_KEY = keys.privateKey;
const C = await import('../src/lib/studyCore.js');
const S = await import('../src/lib/online/studyApi.js');
const P = await import('../src/lib/online/passApi.js');
const R = await import('../src/lib/online/pushApi.js');
const { adminDb, __store } = await import('./fakes/firebaseAdmin.mjs');
const db = adminDb();
const t0 = Date.UTC(2026, 10, 12, 9, 0);      // Thu 12 Nov 2026, noon in Addis
const DAY = 86_400_000;

// ── pure rules
assert.equal(C.weekKey(t0), '2026-11-09', 'week starts on Monday');
assert.equal(C.weekKey(Date.UTC(2026, 10, 15, 20, 0)), '2026-11-09', 'Sunday evening is still that week');
assert.equal(C.weekKey(Date.UTC(2026, 10, 15, 21, 0)), '2026-11-16', 'Monday 00:00 Addis starts a new week');
assert.equal(C.groupOf({ grade: 'g12' }), 'g12'); assert.equal(C.groupOf({ grade: 'uni', dept: 'cs' }), 'uni:cs'); assert.equal(C.groupOf({ grade: 'uni' }), '');
let r = C.applyReport(null, { sid: 'a', answered: 6, correct: 4 }, t0);
assert.equal(r.earned, 0); assert.equal(r.rec.streak, 1); assert.equal(r.rec.weekXp, 40);
assert.equal(C.applyReport(r.rec, { sid: 'a', answered: 6, correct: 4 }, t0).changed, false, 'a retried session counts once');
r = C.applyReport(r.rec, { sid: 'b', answered: 5, correct: 5 }, t0);
assert.equal(r.earned, 2, 'crossing 10 answers earns the bonus'); assert.equal(r.rec.bonusLeft, 2); assert.equal(r.rec.weekXp, 90);
r = C.applyReport(r.rec, { sid: 'c', answered: 20, correct: 20 }, t0);
assert.equal(r.earned, 0, 'the bonus is once a day'); assert.equal(r.rec.streak, 1);
const big = C.applyReport(null, { sid: 'x', answered: 99999, correct: 99999 }, t0);
assert.ok(big.rec.dayAnswered <= C.MAX_DAY && big.rec.weekXp <= C.MAX_SESSION * 10, 'a forged report is capped');
let d2 = C.applyReport(r.rec, { sid: 'd', answered: 3, correct: 1 }, t0 + DAY);
assert.equal(d2.rec.streak, 2); assert.equal(d2.rec.bonusLeft, 0, 'unspent bonus expires at midnight'); assert.equal(d2.rec.weekXp, r.rec.weekXp + 10, 'XP keeps adding inside the same week');
assert.equal(C.liveStreakOf(d2.rec, t0 + 3 * DAY), 0, 'a missed day ends the streak');
assert.equal(C.consumeBonus(r.rec, t0).ok, true); assert.equal(C.consumeBonus({ ...r.rec, bonusLeft: 0 }, t0).ok, false);

// ── server: report → bonus pays level starts when there is no pass
const info = await S.studyReport(db, 'u1', { sid: 's1', answered: 10, correct: 8 }, 'Abebe Kebede', t0);
assert.equal(info.earned, 2); assert.equal(info.bonus.left, 2); assert.equal(info.paywall, true);
const s1 = await P.passStart(db, 'u1', t0);
assert.equal(s1.bonus, true); assert.equal(s1.bonusLeft, 1);
assert.equal((await P.passStart(db, 'u1', t0)).bonusLeft, 0);
await assert.rejects(() => P.passStart(db, 'u1', t0), (e) => e.status === 402, 'bonus used up and no pass: locked again');
await assert.rejects(() => P.passStart(db, 'nobody', t0), (e) => e.status === 402, 'no study, no bonus');
// a paid pass is spent before the bonus
__store.set('passes/u2', { day: '2026-11-12', total: 10, used: 0 });
await S.studyReport(db, 'u2', { sid: 's', answered: 10, correct: 10 }, 'Sara', t0);
const paid = await P.passStart(db, 'u2', t0);
assert.equal(paid.bonus, undefined); assert.equal(paid.pass.left, 9);

// ── leaderboard: own group only, first names only
__store.set('learners/u1', { grade: 'g12' }); __store.set('learners/u2', { grade: 'g12' }); __store.set('learners/u3', { grade: 'g9' });
await S.studyReport(db, 'u1', { sid: 's2', answered: 5, correct: 5 }, 'Abebe Kebede', t0 + 1000);
await S.studyReport(db, 'u2', { sid: 's3', answered: 5, correct: 1 }, 'Sara Tesfaye', t0 + 1000);
await S.studyReport(db, 'u3', { sid: 's4', answered: 5, correct: 5 }, 'Other Grade', t0 + 1000);
const b = await S.studyBoard(db, 'u1', 'week', t0 + 2000);
assert.deepEqual(b.rows.map((x) => [x.rank, x.name]), [[1, 'Abebe'], [2, 'Sara']], 'grade 9 does not appear; last names never leave the server');
assert.equal(b.me.rank, 1); assert.ok(!JSON.stringify(b).includes('Kebede'));
assert.equal((await S.studyBoard(db, 'u1', 'streak', t0 + 2000)).rows.length, 2);

// ── reminders: only configured, enabled, not yet studied today, once a day; dead subscriptions are dropped
const sub = (n) => ({ endpoint: 'https://push.example/' + n, keys: { p256dh: 'k', auth: 'a' } });
await assert.rejects(() => R.pushSubscribe(db, 'u9', { endpoint: 'http://bad' }, 'en'), (e) => e.status === 400);
await R.pushSubscribe(db, 'u1', sub(1), 'en');      // u1 already studied 10+ today
await R.pushSubscribe(db, 'u4', sub(4), 'am');      // never studied
await R.pushSubscribe(db, 'u5', sub(5), 'en');      // dead subscription
const sent = [];
const send = async (s, payload) => { if (s.endpoint.endsWith('/5')) { const e = new Error('gone'); e.statusCode = 410; throw e; } sent.push([s.endpoint, JSON.parse(payload)]); };
const out = await R.sendReminders(db, t0 + 3_600_000, send);
assert.equal(out.sent, 1); assert.equal(out.dropped, 1); assert.equal(out.skipped, 1);
assert.match(sent[0][1].body, /ተከታታይ|ጥያቄ/);
assert.equal((await R.sendReminders(db, t0 + 3_700_000, send)).sent, 0, 'once a day');
assert.equal((await R.pushState(db, 'u5')).enabled, false);
delete process.env.VAPID_PRIVATE_KEY;
assert.equal((await R.sendReminders(db, t0, send)).skipped, 'not-configured');
console.log('study tests passed');
