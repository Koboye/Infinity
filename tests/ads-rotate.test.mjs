// v67: ads are shown in consecutive order, never one ad again and again.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rotatePick, newestFirst } from '../src/lib/adsSmart.js';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const base = { placements: ['splash', 'pre_game', 'rewarded'], start: '2020-01-01', end: '2099-12-31', category: 'other', weight: 1, t: { langs: [], games: [], hours: null, maxPerUser: 3 }, perf: { i: 0, c: 0 }, pace: 1 };
const mk = (id, extra = {}) => ({ ...base, id, ...extra });
const run = (ads, steps, ctx = {}) => { let last = null; const out = []; for (let i = 0; i < steps; i++) { const a = rotatePick(ads, { placement: 'splash', lastId: last, seen: {}, ...ctx }); out.push(a.id); last = a.id; } return out; };

t('ads rotate from NEW to OLD, then around again', () => assert.deepEqual(run([mk('old', { createdAt: 100 }), mk('new', { createdAt: 300 }), mk('mid', { createdAt: 200 })], 6), ['new', 'mid', 'old', 'new', 'mid', 'old']));
t('without creation time the newer start date comes first, then the id', () => assert.deepEqual(run([mk('a', { start: '2026-01-01' }), mk('b', { start: '2026-10-01' }), mk('c', { start: '2026-10-01' })], 3), ['c', 'b', 'a']));
t('a brand-new ad is the very next one shown to a player mid-rotation only after the current turn; order stays fixed', () => assert.equal([mk('x', { createdAt: 1 }), mk('y', { createdAt: 2 })].sort(newestFirst)[0].id, 'y'));
t('weight and tap rate do not change the order', () => assert.deepEqual(run([mk('a', { weight: 100, perf: { i: 1000, c: 500 } }), mk('b', { weight: 1 })], 4), ['b', 'a', 'b', 'a']));
t('a single ad repeats (nothing else to show); none gives null', () => { assert.deepEqual(run([mk('a')], 3), ['a', 'a', 'a']); assert.equal(rotatePick([], { placement: 'splash' }), null); });
t('an ad that is gone or unknown restarts from the newest', () => assert.equal(rotatePick([mk('a'), mk('b')], { placement: 'splash', lastId: 'zzz', seen: {} }).id, 'b'));
t('placements are respected: a pre_game-only ad is skipped at app open', () => assert.deepEqual(run([mk('a', { placements: ['pre_game'] }), mk('b'), mk('c')], 4), ['c', 'b', 'c', 'b']));
t('an ad this player already saw its daily maximum is skipped, the rotation goes on', () => assert.deepEqual(run([mk('a'), mk('b'), mk('c')], 4, { seen: { b: 3 } }), ['c', 'a', 'c', 'a']));
t('expired or switched-off ads never enter the rotation', () => assert.deepEqual(run([mk('a', { end: '2020-01-02' }), mk('b'), mk('c', { active: false }), mk('d')], 4), ['d', 'b', 'd', 'b']));
t('wiring: client and the rewarded server pick use the rotation', () => {
  assert.match(fs.readFileSync(new URL('../src/lib/ads.js', import.meta.url), 'utf8'), /rotatePick\(ads, \{[^}]*lastId: caps\.lastId/);
  const r = fs.readFileSync(new URL('../src/app/api/gebeta/route.js', import.meta.url), 'utf8');
  assert.match(r, /rotatePick\(/); assert.match(r, /lastId: prev\.exists \? prev\.data\(\)\.adId : null/);
});
console.log(`ads-rotate tests passed (${n})`);
