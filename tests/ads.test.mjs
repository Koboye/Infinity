// Ad rules: validation, scheduling, weights, frequency caps, and the bonus-spin economy they feed.
import assert from 'node:assert/strict';
const A = await import('../src/lib/adsCore.js');
const W = await import('../src/lib/walletCore.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const T0 = Date.parse('2026-10-26T12:00:00Z');
const base = { id: 'abay-bank', advertiser: 'Abay Bank', placements: ['splash', 'pre_game'], image: 'https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg', clickUrl: 'https://abay.example/offer', start: '2026-10-01', end: '2026-10-31', durationSec: 6, weight: 3 };

t('ad length is always 2–10 seconds; rewarded ads never under 5', () => {
  assert.equal(A.clampSeconds(0, 'splash'), 2); assert.equal(A.clampSeconds(1, 'pre_game'), 2); assert.equal(A.clampSeconds(99, 'splash'), 10);
  assert.equal(A.clampSeconds(3, 'rewarded'), 5); assert.equal(A.clampSeconds(8, 'rewarded'), 8); assert.equal(A.clampSeconds('x', 'splash'), 5); assert.equal(A.clampSeconds(2.4, 'splash'), 2);
});
t('sanitizeAd accepts a good ad and returns clean, Firestore-safe data', () => {
  const r = A.sanitizeAd(base); assert.ok(r.ok); assert.equal(r.ad.id, 'abay-bank'); assert.equal(r.ad.cta, 'Learn more'); assert.equal(r.ad.active, true);
  for (const v of Object.values(r.ad)) assert.notEqual(v, undefined);
});
t('sanitizeAd refuses unsafe or broken ads', () => {
  const bad = (patch) => assert.equal(A.sanitizeAd({ ...base, ...patch }).ok, false, JSON.stringify(patch));
  bad({ id: 'A B' }); bad({ id: '' }); bad({ advertiser: '  ' }); bad({ placements: [] }); bad({ placements: ['popup'] });
  bad({ image: 'http://insecure.example/a.jpg' }); bad({ image: 'javascript:alert(1)' }); bad({ image: 'data:image/png;base64,AAAA' });
  bad({ clickUrl: 'javascript:alert(1)' }); bad({ clickUrl: 'http://x.example' }); bad({ start: '2026-11-01', end: '2026-10-01' }); bad({ start: 'soon' });
});
t('sanitizeAd strips markup, clamps weight and length, defaults sensibly', () => {
  const r = A.sanitizeAd({ ...base, title: '<b>Hi</b>\n', durationSec: 60, weight: 9999, category: 'weird', clickUrl: '' }).ad;
  assert.equal(r.title, 'bHi/b'); assert.equal(r.durationSec, 10); assert.equal(r.weight, 100); assert.equal(r.category, 'other'); assert.equal(r.clickUrl, '');
  assert.equal(A.sanitizeAd({ ...base, placements: ['rewarded'], durationSec: 2 }).ad.durationSec, 5);
});
t('links are normalised so a quote in a link cannot break out of the CSS url("…") that draws the ad', () => {
  const r = A.sanitizeAd({ ...base, image: 'https://cdn.example/a".jpg?x=");background:red' }).ad;
  assert.ok(!r.image.includes('"')); assert.ok(r.image.startsWith('https://cdn.example/')); assert.ok(!A.sanitizeAd({ ...base, clickUrl: 'https://ok.example/a b"c' }).ad.clickUrl.includes('"'));
});
t('an ad is live only on its dates (both ends inclusive, UTC) and only while switched on', () => {
  const d = (s) => Date.parse(s);
  assert.equal(A.isLive(base, d('2026-10-01T00:00:00Z')), true); assert.equal(A.isLive(base, d('2026-10-31T23:59:59Z')), true);
  assert.equal(A.isLive(base, d('2026-09-30T23:59:59Z')), false); assert.equal(A.isLive(base, d('2026-11-01T00:00:00Z')), false);
  assert.equal(A.isLive({ ...base, active: false }, T0), false); assert.equal(A.isLive(null, T0), false);
});
t('pickAd: placement filter, weights, and never the same ad twice in a row when there is a choice', () => {
  const a = { ...base, id: 'a', weight: 3 }, b = { ...base, id: 'b', weight: 1 }, c = { ...base, id: 'c', placements: ['rewarded'] }, old = { ...base, id: 'old', end: '2026-10-02' };
  const ads = [a, b, c, old];
  assert.equal(A.pickAd(ads, 'splash', { now: T0, rand: () => 0 }).id, 'a');
  assert.equal(A.pickAd(ads, 'splash', { now: T0, rand: () => 0.74 }).id, 'a'); assert.equal(A.pickAd(ads, 'splash', { now: T0, rand: () => 0.76 }).id, 'b');
  assert.equal(A.pickAd(ads, 'rewarded', { now: T0 }).id, 'c'); assert.equal(A.pickAd(ads, 'pre_game', { now: T0, avoidId: 'a', rand: () => 0 }).id, 'b');
  assert.equal(A.pickAd([a], 'splash', { now: T0, avoidId: 'a' }).id, 'a', 'a single ad may repeat'); assert.equal(A.pickAd([old, c], 'splash', { now: T0 }), null); assert.equal(A.pickAd([], 'splash'), null);
  let hitsA = 0; for (let i = 0; i < 4000; i++) if (A.pickAd([a, b], 'splash', { now: T0 }).id === 'a') hitsA++; assert.ok(hitsA > 2800 && hitsA < 3200, `weight 3:1 gave ${hitsA}/4000`);
});
t('publicAd leaks no admin data and respects the placement length', () => {
  const p = A.publicAd({ ...base, active: true, weight: 9, createdAt: 1 }, 'rewarded'); assert.equal(p.durationSec, 6);
  for (const k of ['weight', 'active', 'start', 'end', 'createdAt', 'placements']) assert.equal(k in p, false, k);
});
t('frequency caps: an ad on every app open and every game start, only a 3 s double-fire guard, rewarded has no schedule', () => {
  let s = A.newCapState();
  assert.equal(A.shouldShow('splash', s, T0), true); s = A.markShown(s, 'splash', 'a', T0);
  assert.equal(A.shouldShow('pre_game', s, T0 + 1000), false, 'same tap cannot show two ads');
  s = A.countStart(s); assert.equal(A.shouldShow('pre_game', s, T0 + 4000), true, '1st game start: ad');
  s = A.markShown(s, 'pre_game', 'b', T0 + 4000); assert.equal(s.lastId, 'b');
  s = A.countStart(s); assert.equal(A.shouldShow('pre_game', s, T0 + 8000), true, '2nd game start: ad');
  assert.equal(A.shouldShow('splash', s, T0 + 8000), true, 'next app open: ad');
  assert.equal(A.shouldShow('rewarded', s, T0), false, 'rewarded ads are the player\'s choice and have no schedule');
});
t('house ad: always valid for every placement, no link, rewarded length respected', () => {
  for (const p of ['splash', 'pre_game', 'rewarded']) { const h = A.houseAd(p); assert.equal(h.id, 'house'); assert.equal(h.clickUrl, ''); assert.ok(h.durationSec >= (p === 'rewarded' ? A.REWARD_MIN_SEC : A.MIN_SEC)); assert.ok(h.image.startsWith('/')); }
});

t('bonus spins: daily spins go first, bonus spins after, never more than banked', () => {
  let w = W.newWallet(T0); const g = W.grantAdSpins(w, T0); assert.ok(g.ok); assert.equal(g.spins, 2); w = g.wallet;
  assert.equal(W.view(w, T0).spins, 12); assert.equal(W.view(w, T0).daily, 10); assert.equal(W.view(w, T0).bonus, 2);
  for (let i = 0; i < 10; i++) { const r = W.spinOnce(w, T0); assert.ok(r.ok); w = r.wallet; assert.equal(w.bonus, 2, 'daily spins are used first'); }
  for (let i = 0; i < 2; i++) { const r = W.spinOnce(w, T0); assert.ok(r.ok); w = r.wallet; }
  assert.equal(w.bonus, 0); assert.equal(W.spinOnce(w, T0).ok, false); assert.equal(W.view(w, T0).spins, 0);
});
t('bonus spins survive the day change; the 10 daily spins refresh', () => {
  let w = W.grantAdSpins(W.newWallet(T0), T0).wallet; const tomorrow = Date.parse('2026-10-27T08:00:00Z');
  assert.equal(W.view(w, tomorrow).spins, 12);
});
t('at most 5 rewarded ads pay per server day; the counter resets the next day', () => {
  let w = W.newWallet(T0);
  for (let i = 0; i < 20; i++) { const g = W.grantAdSpins(w, T0); assert.ok(g.ok, `ad ${i + 1}`); w = g.wallet; }
  assert.equal(W.view(w, T0).adsLeft, 0); const no = W.grantAdSpins(w, T0); assert.equal(no.ok, false); assert.equal(no.reason, 'ad-cap');
  assert.equal(W.view(w, Date.parse('2026-10-27T00:00:01Z')).adsLeft, 20); assert.ok(W.grantAdSpins(w, Date.parse('2026-10-27T00:00:01Z')).ok);
});
t('the bonus spin bank is capped at 20, but a full bank still pays the coins', () => {
  const full = { ...W.newWallet(T0), bonus: 19 }; const g = W.grantAdSpins(full, T0); assert.equal(g.spins, 1); assert.equal(g.wallet.bonus, 20);
  const r = W.grantAdSpins(g.wallet, T0); assert.equal(r.ok, true); assert.equal(r.spins, 0); assert.equal(r.coins, 50); assert.equal(r.wallet.bonus, 20); assert.equal(r.wallet.coins, g.wallet.coins + 50);
});
t('an old wallet with no ad fields still works', () => {
  const old = { coins: 500, spinDay: '2026-10-26', spins: 3, log: [] }; const v = W.view(old, T0); assert.equal(v.spins, 7); assert.equal(v.adsLeft, 20);
  assert.ok(W.grantAdSpins(old, T0).ok); assert.ok(W.spinOnce(old, T0).ok);
});
console.log(`ads tests passed (${n})`);
