import assert from 'node:assert';
import { tuzOpening } from '../src/lib/gebeta/tuzOpening.js';
const fresh = () => Array(12).fill(4);
// seat 0, starts h1..h6 (index 0..5): Tuz h7 for odd start holes, h8 for even
const expected = { 0: 6, 1: 7, 2: 6, 3: 7, 4: 6, 5: 7 };
for (let s = 0; s < 6; s++) {
  const r = tuzOpening(fresh(), s, 0);
  assert.equal(r.tuz, expected[s], `start h${s + 1}`);
  assert.equal(r.board[r.tuz], 4);
  assert.equal(r.board.reduce((a, b) => a + b, 0), 48);
}
// worked example from the spec: start h3 -> lap 1 gives 3,5 alternating; Tuz = h7
const r = tuzOpening(fresh(), 2, 0);
assert.deepEqual(r.steps.slice(0, 6).map((x) => [x.from + 1, x.to + 1]),
  [[3,4],[5,6],[7,8],[9,10],[11,12],[1,2]]);
assert.deepEqual(r.steps.slice(6).map((x) => [x.from + 1, x.to + 1]), [[2,3],[4,5],[6,7]]);
// seat 1 mirror: Tuz lands on seat 0's side
for (let s = 6; s < 12; s++) { const t = tuzOpening(fresh(), s, 1).tuz; assert.ok(t < 6); }
assert.throws(() => tuzOpening(fresh(), 7, 0));
console.log('all tuz opening tests pass');
