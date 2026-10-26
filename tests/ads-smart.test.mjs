// Smart ad layer: targeting, tap-rate learning, daily pacing, per-player fatigue, new-player grace, owner advice, and the server feed.
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./fakes/loader.mjs', import.meta.url);
const A = await import('../src/lib/adsCore.js');
const S = await import('../src/lib/adsSmart.js');
const pub = await import('../src/app/api/ads/route.js');
const { __store } = await import('./fakes/firebaseAdmin.mjs');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };
const T0 = Date.parse('2026-10-26T12:00:00Z');
const base = { id: 'a', advertiser: 'A', category: 'bank', placements: ['splash', 'pre_game'], image: 'https://x.example/a.jpg', start: '2026-10-01', end: '2026-10-31', weight: 1, active: true };
const mk = (o) => ({ ...base, ...o });
const share = (ads, ctx, N = 6000) => { const c = {}; for (let i = 0; i < N; i++) { const p = S.smartPick(ads, { placement: 'splash', now: T0, ...ctx }); const k = p ? p.id : 'none'; c[k] = (c[k] || 0) + 1; } return c; };

await t('sanitizeAd keeps targeting clean and Firestore-safe', () => {
  const r = A.sanitizeAd({ ...base, id: 'ab', langs: ['am', 'fr', 'am'], games: ['Ludo', 'bad id!', 'checkers'], hourFrom: '22', hourTo: 6, maxPerUser: 99, dailyCap: '500' }).ad;
  assert.deepEqual(r.langs, ['am']); assert.deepEqual(r.games, ['ludo', 'checkers']); assert.deepEqual(r.hours, { from: 22, to: 6 }); assert.equal(r.maxPerUser, 20); assert.equal(r.dailyCap, 500);
  const d = A.sanitizeAd({ ...base, id: 'ab', hourFrom: '', hourTo: '5', hours: undefined }).ad; assert.equal(d.hours, null); assert.equal(d.maxPerUser, 3); assert.equal(d.dailyCap, 0);
  assert.equal(A.sanitizeAd({ ...base, id: 'ab', hourFrom: 7, hourTo: 7 }).ad.hours, null, 'same hour = no window');
  for (const v of Object.values(r)) assert.notEqual(v, undefined);
});
await t('hour windows, including ones that cross midnight', () => {
  assert.equal(S.inHours({ from: 9, to: 17 }, 9), true); assert.equal(S.inHours({ from: 9, to: 17 }, 17), false); assert.equal(S.inHours({ from: 22, to: 6 }, 23), true);
  assert.equal(S.inHours({ from: 22, to: 6 }, 3), true); assert.equal(S.inHours({ from: 22, to: 6 }, 12), false); assert.equal(S.inHours(null, 3), true);
});
await t('targeting is a hard filter: language, hour and game', () => {
  const am = mk({ id: 'am', t: { langs: ['am'] } }), night = mk({ id: 'night', t: { hours: { from: 22, to: 6 } } }), ludo = mk({ id: 'ludo', t: { games: ['ludo'] } });
  assert.equal(S.smartPick([am], { placement: 'splash', now: T0, lang: 'en' }), null, 'wrong language = no ad');
  assert.equal(S.smartPick([am], { placement: 'splash', now: T0, lang: 'am' }).id, 'am');
  assert.equal(S.smartPick([night], { placement: 'splash', now: T0, hour: 14 }), null); assert.equal(S.smartPick([night], { placement: 'splash', now: T0, hour: 23 }).id, 'night');
  assert.equal(S.smartPick([ludo], { placement: 'pre_game', now: T0, game: 'checkers' }), null); assert.equal(S.smartPick([ludo], { placement: 'pre_game', now: T0, game: 'ludo' }).id, 'ludo');
  assert.equal(S.smartPick([ludo], { placement: 'splash', now: T0 }).id, 'ludo', 'game targeting only applies to pre-game ads');
});
await t('learning: a better tap rate earns more share, a poor one keeps at least half, new ads are neutral', () => {
  assert.ok(Math.abs(S.quality({ i: 0, c: 0 }) - 1) < 1e-9);
  assert.equal(S.quality({ i: 100000, c: 0 }), 0.5); assert.equal(S.quality({ i: 100000, c: 30000 }), 2.5);
  assert.ok(S.quality({ i: 10, c: 3 }) < 2, 'a handful of lucky taps does not max out the score');
  const good = mk({ id: 'good', perf: { i: 2000, c: 100 } }), bad = mk({ id: 'bad', perf: { i: 2000, c: 4 } });
  const c = share([good, bad], {}); assert.ok(c.good > c.bad * 2.5, JSON.stringify(c)); assert.ok(c.bad > 600, 'the weaker ad still gets shown');
});
await t('weight still matters on top of learning', () => {
  const c = share([mk({ id: 'x', weight: 3 }), mk({ id: 'y', weight: 1 })], {}); assert.ok(c.x > 4200 && c.x < 4800, JSON.stringify(c));
});
await t('pacing: ahead of budget slows down, behind speeds up, no cap = neutral', () => {
  const noon = Date.parse('2026-10-26T12:00:00Z');
  assert.equal(S.paceFactor(0, 0, noon), 1); assert.ok(Math.abs(S.paceFactor(500, 1000, noon) - 1) < 1e-9, 'half spent at half day = on schedule');
  assert.equal(S.paceFactor(900, 1000, noon), 0.2); assert.equal(S.paceFactor(0, 1000, noon), 1.5); assert.equal(S.paceFactor(1000, 1000, noon), 0.2);
  const c = share([mk({ id: 'slow', pace: 0.2 }), mk({ id: 'fast', pace: 1.5 })], {}); assert.ok(c.fast > c.slow * 4, JSON.stringify(c));
});
await t('fatigue: a player never sees one ad more than the limit, and prefers ads they have seen less', () => {
  const a = mk({ id: 'a', t: { maxPerUser: 2 } }), b = mk({ id: 'b' });
  assert.equal(S.smartPick([a], { placement: 'splash', now: T0, seen: { a: 2 } }), null); assert.equal(S.smartPick([a], { placement: 'splash', now: T0, seen: { a: 1 } }).id, 'a');
  const c = share([a, b], { seen: { a: 1, b: 0 } }); assert.ok(c.b > c.a * 1.7, JSON.stringify(c));
  assert.equal(S.smartPick([mk({ id: 'z' })], { placement: 'splash', now: T0, seen: { z: 3 } }), null, 'default limit is 3 a day');
});
await t('variety: same kind of ad twice in a row is less likely; the last ad is skipped when there is a choice', () => {
  const c = share([mk({ id: 'bk', category: 'bank' }), mk({ id: 'ev', category: 'event' })], { lastCategory: 'bank' }); assert.ok(c.ev > c.bk * 1.4, JSON.stringify(c));
  assert.equal(S.smartPick([mk({ id: 'p' }), mk({ id: 'q' })], { placement: 'splash', now: T0, avoidId: 'p' }).id, 'q');
});
await t('player memory: counts per day, forgets yesterday, no ad-free window any more', () => {
  let s = S.noteSeen({}, 'a', T0); s = S.noteSeen(s, 'a', T0 + 1000); s = S.noteSeen(s, 'b', T0); assert.deepEqual(S.seenToday(s, T0), { a: 2, b: 1 });
  assert.deepEqual(S.seenToday(s, T0 + 86_400_000), {}); s = S.noteSeen(s, 'c', T0 + 86_400_000); assert.deepEqual(Object.keys(s.seen), ['c']);
  const f = S.stampFirst({}, T0); assert.equal(S.stampFirst(f, T0 + 5000).firstAt, T0); assert.equal(S.inGrace(f, T0 + 9 * 60_000), false, 'ads on every open, even for new players'); assert.equal(S.inGrace({}, T0), false);
  const keep = A.markShown(S.noteSeen({}, 'a', T0), 'splash', 'a', T0); assert.equal(keep.seen.a.n, 1, 'frequency-cap updates keep the memory');
});
await t('advice for the owner', () => {
  const ad = mk({ end: '2026-10-27', dailyCap: 100 }); const has = (list, re) => list.some((x) => re.test(x.text));
  assert.ok(has(S.adviseAd(ad, { i: 0, c: 0 }, { today: '2026-10-26' }), /not shown in 7 days/));
  assert.ok(has(S.adviseAd(ad, { i: 1000, c: 5 }, { today: '2026-10-26', avg: 0.03 }), /under half/));
  assert.ok(has(S.adviseAd(ad, { i: 1000, c: 90 }, { today: '2026-10-26', avg: 0.03 }), /above the average/));
  assert.ok(has(S.adviseAd(ad, { i: 1000, c: 30, today: 100 }, { today: '2026-10-26', avg: 0.03 }), /Daily limit reached/));
  assert.ok(has(S.adviseAd(ad, { i: 1000, c: 30 }, { today: '2026-10-26', avg: 0.03 }), /Ends in 1 day/)); assert.ok(has(S.adviseAd({ ...ad, clickUrl: '' }, { i: 5, c: 0 }, { today: '2026-10-26' }), /No tap link/));
});
await t('server feed carries targeting, learning and pacing; an ad at its daily cap leaves the feed', async () => {
  const day = new Date().toISOString().slice(0, 10);
  const live = (id, o = {}) => ({ id, advertiser: id, category: 'bank', placements: ['splash'], image: 'https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg', durationSec: 5, weight: 1, active: true, start: '2020-01-01', end: '2099-12-31', ...o });
  __store.set('ads/open', live('open', { langs: ['am'], hours: { from: 8, to: 20 }, games: ['ludo'], maxPerUser: 2, dailyCap: 1000 }));
  __store.set('ads/capped', live('capped', { dailyCap: 10 }));
  __store.set(`adStats/open_${day}`, { adId: 'open', day, impressions: 40, clicks: 4 }); __store.set(`adStats/capped_${day}`, { adId: 'capped', day, impressions: 9, rewarded: 1 });
  const ads = (await pub.GET()).body.ads; assert.deepEqual(ads.map((a) => a.id), ['open'], 'capped ad is gone');
  const o = ads[0]; assert.deepEqual(o.t, { langs: ['am'], games: ['ludo'], hours: { from: 8, to: 20 }, maxPerUser: 2 }); assert.deepEqual(o.perf, { i: 40, c: 4 }); assert.ok(o.pace >= 0.2 && o.pace <= 1.5);
  for (const k of ['dailyCap', 'used', 'active']) assert.equal(k in o, false, `${k} stays private`);
});
console.log(`ads-smart tests passed (${n})`);
