// v64: "two ads, only one appears" — the three real causes are fixed and pinned here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const cfg = read('next.config.mjs'), ads = read('src/lib/ads.js'), app = read('src/components/GebetaApp.jsx');

t('CSP lets any https ad picture load (a blocked host used to hide its ad silently)', () => {
  assert.match(cfg, /img-src 'self' data: blob: https: /);
});
t('test mode takes turns between ads instead of picking at random', () => {
  assert.match(ads, /testTurn\(\) % ads\.length/); assert.doesNotMatch(ads, /ads\[Math\.floor\(Math\.random\(\) \* ads\.length\)\]/);
  assert.match(ads, /gebeta\.adtest\.n/);
});
t('a picture that fails is remembered, skipped, and the next ad is tried', () => {
  assert.match(ads, /badImages\.add\(ad\.id\)/); assert.match(ads, /!badImages\.has\(a\.id\)/g);
  assert.match(ads, /i\.onerror = \(\) => markBad\(a\)/);
  assert.match(app, /reason === 'failed' && attempt < 2/); assert.match(app, /Ads\.markBad\(ad\)/); assert.match(app, /retry: attempt > 0/);
  assert.match(ads, /!retry\) caps = countStart/);
});
t('simulation: rotation shows both ads, and a broken one never blocks the other', async () => {
  const { smartPick } = await import('../src/lib/adsSmart.js');
  const base = { placements: ['pre_game'], start: '2020-01-01', end: '2099-12-31', category: 'other', weight: 1, t: { langs: [], games: [], hours: null, maxPerUser: 3 }, perf: { i: 0, c: 0 }, pace: 1 };
  const A = { ...base, id: 'aaa' }, B = { ...base, id: 'bbb', category: 'bank' };
  let last = null; const shown = new Set();
  for (let i = 0; i < 6; i++) { const ad = smartPick([A, B], { placement: 'pre_game', avoidId: last, seen: {}, explore: true }); shown.add(ad.id); last = ad.id; }
  assert.deepEqual([...shown].sort(), ['aaa', 'bbb']);
  assert.equal(smartPick([A], { placement: 'pre_game', seen: {} }).id, 'aaa');
});
console.log(`ads-v64 tests passed (${n})`);
