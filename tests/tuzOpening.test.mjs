// Pure planner for the ጡዝ opening (alternating 3/5 chain, two laps). Run: node tests/tuzOpening.test.mjs
import assert from 'node:assert/strict';
import { planOpening, RING } from '../src/lib/gebeta/tuzOpening.js';
const fresh = () => { const p = new Array(14).fill(4); p[6] = 0; p[13] = 0; return p; };
const own0 = () => [0,0,0,0,0,0,0,1,1,1,1,1,1,1];
const sum = (p) => p.reduce((a, b) => a + b, 0);

// seat 0, holes h1..h6 = slots 0..5: Tuz = h7 (slot 7) from h1/h3/h5, h8 (slot 8) from h2/h4/h6
const want0 = { 0: 7, 1: 8, 2: 7, 3: 8, 4: 7, 5: 8 };
for (let s = 0; s < 6; s++) {
  const r = planOpening(fresh(), own0(), 0, s);
  assert.equal(r.tuz, want0[s], `start h${s + 1}`); assert.equal(r.pits[r.tuz], 4); assert.equal(sum(r.pits), 48);
  assert.equal(r.steps.at(-1).t, 'tuz');
}
// seat 1 (slots 7..12) mirrors: Tuz lands on seat 0's first or second hole
for (const s of [7, 8, 9, 10, 11, 12]) { const t = planOpening(fresh(), own0(), 1, s).tuz; assert.ok(t === 0 || t === 1, `seat 1 from ${s}`); }
// the worked example: start h3 -> pairs 3-4, 5-6, 7-8, 9-10, 11-12, 1-2 then 2-3, 4-5, 6-7
{ const r = planOpening(fresh(), own0(), 0, 2);
  const idx = (i) => RING.indexOf(i) + 1;
  const mv = []; for (let k = 0; k < r.steps.length; k += 2) if (r.steps[k].t === 'lift1') mv.push([idx(r.steps[k].i), idx(r.steps[k + 1].i)]);
  assert.deepEqual(mv, [[3,4],[5,6],[7,8],[9,10],[11,12],[1,2],[2,3],[4,5],[6,7]]);
  assert.deepEqual(r.pits, [3, 4, 4, 4, 4, 4, 0, 4, 5, 3, 5, 3, 5, 0]);
  // after lap 1 alone the ring alternates 3,5,3,5 ...
  const lap1 = fresh(); for (let k = 0; k < 12; k += 2) { lap1[RING[(2 + k) % 12]] -= 1; lap1[RING[(3 + k) % 12]] += 1; }
  assert.deepEqual(RING.map((h) => lap1[h]).slice(2, 6), [3, 5, 3, 5]); }
// refusals: opponent's hole, a board that is not freshly dealt, a hole that can never reach an opponent 3-hole
assert.equal(planOpening(fresh(), own0(), 0, 9), null);
{ const p = fresh(); p[3] = 5; assert.equal(planOpening(p, own0(), 0, 0), null); }
{ const own = [1,1,1,1,1,0,0,1,1,1,1,1,1,1]; // seat 0 owns only hole 5: seat 1 reaches it from odd ring positions only
  assert.equal(planOpening(fresh(), own, 1, 0) === null, true, 'even start never reaches the lone opponent hole');
  assert.equal(planOpening(fresh(), own, 1, 1).tuz, 5); }
console.log('ok tuzOpening planner');
