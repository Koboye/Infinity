// Ads on the real routes against the in-memory Firestore: public feed, counters, rewarded sessions that cannot be
// shortened / replayed / borrowed, daily cap, and the owner's admin API.
import assert from 'node:assert/strict';
import { register } from 'node:module';
process.env.GEBETA_RATE_MAX = '1000000';
process.env.ADS_ADMIN_KEY = 'test-admin-key-123456';
register('./fakes/loader.mjs', import.meta.url);
const game = await import('../src/app/api/gebeta/route.js');
const pub = await import('../src/app/api/ads/route.js');
const admin = await import('../src/app/api/admin/ads/route.js');
const { __store } = await import('./fakes/firebaseAdmin.mjs');
const call = (uid, body) => game.POST({ headers: { get: () => (uid ? `Bearer tok:${uid}` : '') }, json: async () => body });
const ok = async (uid, body) => { const r = await call(uid, body); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
const hdr = (key, ip = '9.9.9.9') => ({ get: (k) => (k === 'x-admin-key' ? key : k === 'x-forwarded-for' ? ip : null) });
const KEY = process.env.ADS_ADMIN_KEY;
const day = new Date().toISOString().slice(0, 10);
const stat = (id) => __store.get(`adStats/${id}_${day}`) || {};
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };

const ad = (id, over = {}) => ({ id, advertiser: id.toUpperCase(), category: 'bank', placements: ['splash', 'pre_game', 'rewarded'], image: 'https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg', clickUrl: 'https://bank.example', title: 'Hello', cta: 'Open', durationSec: 6, weight: 1, active: true, start: '2020-01-01', end: '2099-12-31', ...over });
const age = (uid, ms) => { const s = __store.get(`adSessions/${uid}`); __store.set(`adSessions/${uid}`, { ...s, startedAt: s.startedAt - ms }); };

await t('with no ads: the public feed is empty and a rewarded ad answers "none available" (no free spins)', async () => {
  const f = await pub.GET(); assert.deepEqual(f.body.ads, []);
  assert.equal((await call('alice', { action: 'adStart' })).status, 404);
  assert.equal((await call(null, { action: 'adStart' })).status, 401);
});

__store.set('ads/bank1', ad('bank1'));
__store.set('ads/event1', ad('event1', { placements: ['splash'], durationSec: 3, category: 'event' }));
__store.set('ads/rew1', ad('rew1', { placements: ['rewarded'] }));
__store.set('ads/off', ad('off', { active: false }));
__store.set('ads/expired', ad('expired', { end: '2020-02-01' }));
__store.set('ads/future', ad('future', { start: '2099-01-01' }));

await t('public feed: only live ads for splash / pre-game, rewarded-only ads are never handed out, nothing private leaks', async () => {
  const ids = (await pub.GET()).body.ads.map((a) => a.id).sort(); assert.deepEqual(ids, ['bank1', 'event1']);
  const a = (await pub.GET()).body.ads.find((x) => x.id === 'bank1'); assert.deepEqual(a.placements, ['splash', 'pre_game']); assert.equal('active' in a, false); assert.equal(a.durationSec, 6);
});

await t('impressions and clicks are counted for real ads only, and a flood is cut off', async () => {
  const post = (body, ip = '1.1.1.1') => pub.POST({ headers: { get: (k) => (k === 'x-forwarded-for' ? ip : null) }, json: async () => body });
  await post({ event: 'impression', adId: 'bank1' }); await post({ event: 'impression', adId: 'bank1' }); await post({ event: 'click', adId: 'bank1' });
  assert.equal(stat('bank1').impressions, 2); assert.equal(stat('bank1').clicks, 1);
  await post({ event: 'impression', adId: 'ghost' }); await post({ event: 'hack', adId: 'bank1' }); await post({ event: 'impression', adId: '../x' });
  assert.equal(__store.has(`adStats/ghost_${day}`), false); assert.equal(stat('bank1').impressions, 2);
  for (let i = 0; i < 80; i++) await post({ event: 'impression', adId: 'bank1' }, '2.2.2.2'); assert.equal(stat('bank1').impressions, 2 + 60, 'one address counts at most 60 a minute');
});

await t('rewarded ad: only a rewarded ad is served, with the length the server will enforce', async () => {
  const r = await ok('alice', { action: 'adStart' });
  assert.ok(['bank1', 'rew1'].includes(r.ad.id)); assert.ok(r.session.id); assert.equal(r.session.durationMs, 6000); assert.ok(r.ad.durationSec >= 5);
  assert.equal(r.wallet.adsLeft, 5); assert.equal('weight' in r.ad, false);
  assert.notEqual(r.ad.id, 'event1', 'an ad that is not for the rewarded placement is never served as one');
});
await t('finishing early pays nothing; the session stays open so the player can finish properly', async () => {
  const s = __store.get('adSessions/alice'); const early = await call('alice', { action: 'adDone', session: s.id });
  assert.equal(early.status, 409); assert.match(early.body.error, /not watched/); assert.equal(__store.get('wallets/alice').bonus || 0, 0);
});
await t('a finished ad pays exactly 2 spins, once; replays and wrong sessions pay nothing', async () => {
  const s = __store.get('adSessions/alice'); age('alice', 6000);
  const r = await ok('alice', { action: 'adDone', session: s.id }); assert.equal(r.spins, 2); assert.equal(r.wallet.spins, 12); assert.equal(r.wallet.bonus, 2); assert.equal(r.wallet.adsLeft, 4);
  assert.equal((await call('alice', { action: 'adDone', session: s.id })).status, 409, 'replay');
  assert.equal((await call('alice', { action: 'adDone', session: 'made-up' })).status, 409);
  assert.equal((await call('alice', { action: 'adDone' })).status, 409);
  assert.equal(__store.get('wallets/alice').bonus, 2);
  assert.equal(stat(s.adId).rewarded, 1); assert.ok(stat(s.adId).impressions >= 1);
});
await t('a session cannot be borrowed by another account', async () => {
  const a = await ok('alice', { action: 'adStart' }); await ok('bob', { action: 'adStart' }); age('bob', 7000);
  assert.equal((await call('bob', { action: 'adDone', session: a.session.id })).status, 409);
  const bobSession = __store.get('adSessions/bob').id; assert.equal((await call('alice', { action: 'adDone', session: bobSession })).status, 409);
  await ok('bob', { action: 'adDone', session: bobSession }); assert.equal(__store.get('wallets/bob').bonus, 2);
});
await t('a session that was left open too long expires', async () => {
  const a = await ok('alice', { action: 'adStart' }); age('alice', 11 * 60 * 1000);
  const r = await call('alice', { action: 'adDone', session: a.session.id }); assert.equal(r.status, 409); assert.match(r.body.error, /expired/);
});
await t('starting a new ad replaces the old session (one at a time)', async () => {
  const a = await ok('cara', { action: 'adStart' }); const b = await ok('cara', { action: 'adStart' }); age('cara', 7000);
  assert.equal((await call('cara', { action: 'adDone', session: a.session.id })).status, 409); await ok('cara', { action: 'adDone', session: b.session.id });
});
await t('bonus spins are spent after the 10 daily spins, through the normal server spin', async () => {
  let spins = 0; for (;;) { const r = await call('bob', { action: 'spin' }); if (r.status !== 200) break; spins++; }
  assert.equal(spins, 12); assert.equal(__store.get('wallets/bob').bonus, 0); assert.equal((await call('bob', { action: 'spin' })).status, 409);
});
await t('daily cap: the 6th ad of a day is refused before it even starts, and nothing is paid', async () => {
  for (let i = 0; i < 4; i++) { const a = await ok('dan', { action: 'adStart' }); age('dan', 7000); await ok('dan', { action: 'adDone', session: a.session.id }); }
  const a5 = await ok('dan', { action: 'adStart' }); age('dan', 7000); const last = await ok('dan', { action: 'adDone', session: a5.session.id }); assert.equal(last.wallet.adsLeft, 0);
  assert.equal(__store.get('wallets/dan').bonus, 10);
  const more = await call('dan', { action: 'adStart' }); assert.equal(more.status, 409); assert.match(more.body.error, /come back tomorrow/);
});
await t('the wallet cannot be edited through the ad actions', async () => {
  const before = __store.get('wallets/alice').bonus; await call('alice', { action: 'adDone', session: 'x', bonus: 99, spins: 99 });
  assert.equal(__store.get('wallets/alice').bonus, before);
});

await t('admin API is off without a key, and shut to wrong keys', async () => {
  assert.equal((await admin.GET({ headers: hdr('nope') })).status, 401); assert.equal((await admin.GET({ headers: hdr('') })).status, 401);
  assert.equal((await admin.POST({ headers: hdr('nope'), json: async () => ({ action: 'delete', id: 'bank1' }) })).status, 401); assert.ok(__store.has('ads/bank1'));
  for (let i = 0; i < 12; i++) await admin.GET({ headers: hdr('nope', '5.5.5.5') }); assert.equal((await admin.GET({ headers: hdr(KEY, '5.5.5.5') })).status, 429, 'guessing is throttled');
});
await t('admin: list with 7-day stats, save (validated), toggle, delete', async () => {
  const list = await admin.GET({ headers: hdr(KEY) }); assert.equal(list.status, 200); assert.ok(list.body.ads.length >= 6); assert.equal(list.body.stats.bank1.clicks, 1);
  const save = (a) => admin.POST({ headers: hdr(KEY), json: async () => ({ action: 'save', ad: a }) });
  const bad = await save({ ...ad('x1'), image: 'http://insecure.example/a.jpg' }); assert.equal(bad.status, 400); assert.equal(__store.has('ads/x1'), false);
  const good = await save({ ...ad('new-event'), durationSec: 60, weight: 500 }); assert.equal(good.status, 200); const doc = __store.get('ads/new-event'); assert.equal(doc.durationSec, 10); assert.equal(doc.weight, 100); assert.ok(doc.createdAt);
  const created = doc.createdAt; await save({ ...ad('new-event'), title: 'Changed' }); assert.equal(__store.get('ads/new-event').createdAt, created, 'editing keeps the creation time');
  assert.ok((await pub.GET()).body.ads.some((a) => a.id === 'new-event'));
  await admin.POST({ headers: hdr(KEY), json: async () => ({ action: 'toggle', id: 'new-event', active: false }) }); assert.ok(!(await pub.GET()).body.ads.some((a) => a.id === 'new-event'), 'switched off = gone from the feed');
  await admin.POST({ headers: hdr(KEY), json: async () => ({ action: 'delete', id: 'new-event' }) }); assert.equal(__store.has('ads/new-event'), false);
  assert.equal((await admin.POST({ headers: hdr(KEY), json: async () => ({ action: 'delete', id: '../..' }) })).status, 400);
});
console.log(`ads-server tests passed (${n})`);
