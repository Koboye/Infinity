// Click-fraud guard + advertiser CSV report, on the real routes with the in-memory Firestore.
import assert from 'node:assert/strict';
import { register } from 'node:module';
process.env.ADS_ADMIN_KEY = 'test-admin-key-123456';
process.env.ADS_SIGNING_SECRET = 'signing-secret-for-tests-0123456789';
register('./fakes/loader.mjs', import.meta.url);
const pub = await import('../src/app/api/ads/route.js');
const admin = await import('../src/app/api/admin/ads/route.js');
const trust = await import('../src/lib/adsTrust.js');
const { __store } = await import('./fakes/firebaseAdmin.mjs');
const day = new Date().toISOString().slice(0, 10);
const stat = (id) => __store.get(`adStats/${id}_${day}`) || {};
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };
const post = (body, ip = '1.1.1.1') => pub.POST({ headers: { get: (k) => (k === 'x-forwarded-for' ? ip : null) }, json: async () => body });
const ad = (id) => ({ id, advertiser: id, category: 'bank', placements: ['splash'], image: 'https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg', clickUrl: 'https://b.example', start: '2020-01-01', end: '2099-01-01', active: true, durationSec: 5, weight: 1 });
__store.set('ads/bank1', ad('bank1')); __store.set('ads/bank2', ad('bank2'));
const S = process.env.ADS_SIGNING_SECRET;

await t('token: signed, bound to its ad, tamper-proof, expires', () => {
  const tk = trust.signToken(S, 'bank1', 1000, 'nonce1'); const now = 1000;
  assert.equal(trust.verifyToken(S, tk, 'bank1', now).ok, true);
  assert.equal(trust.verifyToken(S, tk, 'bank2', now).reason, 'ad');
  assert.equal(trust.verifyToken(S, tk.slice(0, -2) + 'xx', 'bank1', now).reason, 'signature');
  assert.equal(trust.verifyToken('another-secret-0123456789', tk, 'bank1', now).reason, 'signature');
  assert.equal(trust.verifyToken(S, tk, 'bank1', now + trust.TOKEN_TTL_MS + 1).reason, 'expired');
  assert.equal(trust.verifyToken(S, 'garbage', 'bank1', now).reason, 'format');
  assert.equal(trust.secretOf({ ADS_SIGNING_SECRET: 'short' }), null);
});
await t('an impression returns a token; a tap with it counts once, a replay does not', async () => {
  const r = await post({ event: 'impression', adId: 'bank1' }); const tk = r.body.token; assert.ok(tk);
  await post({ event: 'click', adId: 'bank1', token: tk }); assert.equal(stat('bank1').clicks, 1);
  await post({ event: 'click', adId: 'bank1', token: tk }); assert.equal(stat('bank1').clicks, 1, 'replay');
});
await t('taps without a token, with a forged token, or on a different ad are ignored', async () => {
  const tk = (await post({ event: 'impression', adId: 'bank1' })).body.token;
  await post({ event: 'click', adId: 'bank1' }); await post({ event: 'click', adId: 'bank1', token: 'a.b.c.d' });
  await post({ event: 'click', adId: 'bank2', token: tk }); assert.equal(stat('bank1').clicks, 1); assert.equal(stat('bank2').clicks || 0, 0);
});
await t('taps can never exceed impressions', async () => {
  for (let i = 0; i < 20; i++) await post({ event: 'click', adId: 'bank1', token: trust.signToken(S, 'bank1', Date.now() - 3 * 3600_000) });
  assert.ok((stat('bank1').clicks || 0) <= (stat('bank1').impressions || 0));
});
await t('CSV report: needs the key, has the right rows, validates ids, neutralises formulas', async () => {
  const H = (k) => ({ get: (h) => (h === 'x-admin-key' ? k : null) });
  const get = (qs, k = process.env.ADS_ADMIN_KEY) => admin.GET({ url: `http://x/api/admin/ads${qs}`, headers: H(k) });
  assert.equal((await get('?report=csv', 'nope')).status, 401);
  const r = await get('?report=csv&ad=bank1'); assert.equal(r.status, 200); assert.match(r.headers.get('Content-Type'), /text\/csv/);
  const lines = (await r.text()).trim().split('\n'); assert.equal(lines[0], 'ad,day,impressions,taps,tap_rate_percent,rewarded_views');
  assert.match(lines[1], new RegExp(`^bank1,${day},2,1,50\\.00,0$`));
  assert.equal((await get('?report=csv&ad=../x')).status, 400);
});
console.log(`ads-trust tests passed (${n})`);
