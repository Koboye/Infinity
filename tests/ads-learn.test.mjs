// Thompson-sampling learning, the smart rewarded pick, and the click/impression guard.
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./fakes/loader.mjs', import.meta.url);
const S = await import('../src/lib/adsSmart.js');
const { makeGuard } = await import('../src/lib/adsGuard.js');
const { withTargeting } = await import('../src/lib/adsServer.js');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };
const T0 = Date.parse('2026-10-26T12:00:00Z');
const mk = (o) => ({ id: 'a', advertiser: 'A', category: 'bank', placements: ['splash', 'rewarded'], image: 'https://x.example/a.jpg', start: '2026-10-01', end: '2026-10-31', weight: 1, active: true, ...o });
// small seeded generator so the statistics are repeatable
let seed = 42; const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

await t('beta draws are in (0,1) and centre on a/(a+b)', () => {
  let sum = 0; const N = 4000; for (let i = 0; i < N; i++) { const x = S.betaSample(4, 196, rng); assert.ok(x > 0 && x < 1); sum += x; }
  assert.ok(Math.abs(sum / N - 0.02) < 0.002, `mean ${sum / N}`);
});
await t('thompsonQuality stays inside 0.5…2.5 and tracks real performance', () => {
  const avg = (perf) => { let s = 0; for (let i = 0; i < 2000; i++) { const q = S.thompsonQuality(perf, rng); assert.ok(q >= 0.5 && q <= 2.5); s += q; } return s / 2000; };
  assert.ok(avg({ i: 5000, c: 500 }) > 2.2, 'a 10% ad is near the maximum');
  assert.ok(avg({ i: 5000, c: 10 }) < 0.7, 'a 0.2% ad is near the minimum');
  assert.ok(Math.abs(avg({ i: 0, c: 0 }) - 1) < 0.25, 'an unknown ad is about average');
  assert.doesNotThrow(() => S.thompsonQuality({ i: 5, c: 99 }, rng), 'bad data (clicks > impressions) cannot break it');
});
await t('exploring: a good ad wins most views, but an unlucky new ad still gets tried', () => {
  const ads = [mk({ id: 'good', perf: { i: 5000, c: 400 } }), mk({ id: 'new', perf: { i: 0, c: 0 } }), mk({ id: 'poor', perf: { i: 5000, c: 20 } })];
  const c = {}; for (let i = 0; i < 4000; i++) { const p = S.smartPick(ads, { placement: 'splash', now: T0, explore: true, rand: rng }); c[p.id] = (c[p.id] || 0) + 1; }
  assert.ok(c.good > c.new && c.new > c.poor, JSON.stringify(c));
  assert.ok(c.poor > 400, 'the poor ad keeps its minimum share so it can recover');
});
await t('explore is opt-in: without it the pick is unchanged', () => {
  const ad = mk({ perf: { i: 100, c: 5 } }); assert.equal(S.score(ad, { placement: 'splash' }), S.score(ad, { placement: 'splash', explore: false }));
});
await t('server feed shape: withTargeting makes rewarded ads respect language, hours and limits', () => {
  const night = withTargeting(mk({ id: 'night', hours: { from: 22, to: 6 }, langs: ['am'] }));
  assert.deepEqual(night.t, { langs: ['am'], games: [], hours: { from: 22, to: 6 }, maxPerUser: 3 });
  assert.equal(S.smartPick([night], { placement: 'rewarded', now: T0, hour: 12 }), null, 'outside its hours: no ad is better than a wrong ad');
  assert.equal(S.smartPick([night], { placement: 'rewarded', now: T0, lang: 'en' }), null, 'wrong language');
  assert.equal(S.smartPick([night], { placement: 'rewarded', now: T0 })?.id, 'night', 'server without lang/hour does not guess');
  const paced = [withTargeting(mk({ id: 'slow', pace: 0.2 })), withTargeting(mk({ id: 'fast', pace: 1.5 }))];
  const c = {}; for (let i = 0; i < 3000; i++) { const p = S.smartPick(paced, { placement: 'rewarded', now: T0, explore: true, rand: rng }); c[p.id] = (c[p.id] || 0) + 1; }
  assert.ok(c.fast > c.slow * 3, 'an ahead-of-budget ad slows down: ' + JSON.stringify(c));
});
await t('guard: caps clicks per address per ad, per hour, and lets the window reopen', () => {
  const g = makeGuard(); const adId = 'x1';
  assert.deepEqual([1, 2, 3, 4, 5].map(() => g('click', '1.2.3.4', adId, T0)), [true, true, true, false, false]);
  assert.equal(g('click', '5.6.7.8', adId, T0), true, 'another address is unaffected');
  assert.equal(g('click', '1.2.3.4', 'other', T0), true, 'another ad is unaffected');
  assert.equal(g('click', '1.2.3.4', adId, T0 + 3_600_001), true, 'a new hour starts clean');
  assert.equal(g('bogus', '1.2.3.4', adId, T0), false, 'unknown event kinds are never recorded');
});
await t('guard: impressions are generous (shared carrier addresses) but not unlimited', () => {
  const g = makeGuard(); let ok = 0; for (let i = 0; i < 100; i++) if (g('impression', '9.9.9.9', 'x1', T0)) ok++;
  assert.equal(ok, 60);
});
console.log(`${n} ads-learn tests passed`);
