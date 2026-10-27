// v78 regression: the feed the SERVER sends must be an ad list the PHONE can actually pick from.
// (Before v78 the feed had no start/end dates, the phone's date check dropped every paid ad, and only the built-in house ad ever showed.)
import assert from 'node:assert/strict';
import { register } from 'node:module';
process.env.GEBETA_RATE_MAX = '1000000';
register('./fakes/loader.mjs', import.meta.url);
const pub = await import('../src/app/api/ads/route.js');
const { __store } = await import('./fakes/firebaseAdmin.mjs');
const { rotatePick } = await import('../src/lib/adsSmart.js');
const { vouched } = await import('../src/lib/ads.js');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };
const ad = (id, over = {}) => ({ id, advertiser: id.toUpperCase(), category: 'bank', placements: ['splash', 'pre_game'], image: 'https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg', clickUrl: 'https://bank.example', title: 'Hi', cta: 'Open', durationSec: 5, weight: 1, active: true, start: '2020-01-01', end: '2099-12-31', createdAt: 1, ...over });
__store.set('ads/one', ad('one', { createdAt: 2 })); __store.set('ads/two', ad('two', { createdAt: 1 }));
const ctx = (over = {}) => ({ placement: 'splash', lang: 'en', game: null, hour: 12, seen: {}, lastId: null, ...over });

await t('a paid ad from the real feed is picked by the phone (not dropped for missing dates)', async () => {
  const feed = (await pub.GET()).body.ads; assert.deepEqual(feed.map((a) => a.id).sort(), ['one', 'two']);
  assert.ok(feed.every((a) => typeof a.start === 'string' && typeof a.end === 'string'), 'feed carries the dates');
  const first = rotatePick(feed, ctx()); assert.equal(first?.id, 'one');
  assert.equal(rotatePick(feed, ctx({ lastId: 'one' }))?.id, 'two', 'rotation continues with the next ad');
  assert.equal(rotatePick(feed, ctx({ placement: 'pre_game', game: 'ludo' }))?.id, 'one');
});
await t('the phone still drops an ad whose end date has passed while the feed was cached', async () => {
  const feed = (await pub.GET()).body.ads.map((a) => (a.id === 'one' ? { ...a, end: '2020-02-01' } : a));
  assert.equal(rotatePick(feed, ctx())?.id, 'two');
});
await t('an older cached feed without dates still works (vouched by the server)', () => {
  const old = [{ id: 'x', placements: ['splash'], weight: 1, t: {}, createdAt: 1 }];
  assert.equal(rotatePick(old, ctx()), null, 'without the fix it was dropped');
  assert.equal(rotatePick(old.map(vouched), ctx())?.id, 'x');
  assert.equal(vouched({ id: 'y', active: false }).active, false, 'an ad switched off stays off');
});
console.log(`ads-feed-live tests passed (${n})`);
