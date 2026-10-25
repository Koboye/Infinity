// One test per rule of the ጡዝ rulebook. Run: node tests/tuz-rulebook.test.mjs
import assert from 'node:assert/strict';
import { cloneState, newGame, playMove, legalMoves, tuzFlag, validState } from '../src/lib/gebeta/engine.js';
const base = (turn = 0) => { const q = newGame('tuz', turn); q.opening = false; q.pits.fill(0); q.flag.fill(0); q.turn = turn; return q; };
const total = (s) => s.pits.reduce((a, b) => a + b, 0);

// 1. Landing on your OWN Tuz: no capture, frozen stones stay, turn ends, opponent moves
{ const q = base(0); q.pits[8] = 4; q.flag[8] = tuzFlag(0); q.pits[5] = 2; q.pits[0] = 2; q.pits[12] = 5;
  const r = playMove(q, 5, 'tuz'); assert.ok(r.ok);
  assert.ok(!r.steps.some((x) => x.t === 'tuztake'), 'nothing captured'); assert.equal(r.state.pits[6], 0);
  assert.equal(r.state.pits[8], 5, 'frozen stones remain (my stone is simply dropped in)'); assert.equal(r.state.flag[8], tuzFlag(0));
  assert.equal(r.state.turn, 1, 'turn ends'); assert.equal(total(r.state), total(q)); }
console.log('ok 1 landing on your own Tuz');

// 3. Capture: last stone on the OPPONENT's Tuz -> exactly two stones, rest stays frozen, play again
{ const q = base(0); q.pits[3] = 4; q.flag[3] = tuzFlag(1); q.pits[1] = 2; q.pits[0] = 2; q.pits[12] = 5; // seat 1's Tuz sits in seat 0's hole 3
  const r = playMove(q, 1, 'tuz'); assert.ok(r.ok);
  assert.equal(r.state.pits[6], 2, 'exactly two stones captured'); assert.equal(r.state.pits[3], 3, 'remaining stones stay frozen (4 + my stone - 2)');
  assert.equal(r.state.flag[3], tuzFlag(1)); assert.equal(r.state.turn, 0, 'another turn'); assert.equal(total(r.state), total(q)); }
console.log('ok 3 capturing two from the opponent\'s Tuz');

// 2. Emptied Tuz: becomes available, receives stones, a LAST stone there is captured (single stone); no 4 or more
{ let q = base(0); q.pits[3] = 1; q.flag[3] = tuzFlag(1); q.pits[1] = 2; q.pits[0] = 2; q.pits[12] = 5; // a Tuz of 1 (after earlier attacks)
  let r = playMove(q, 1, 'tuz'); assert.ok(r.ok); assert.equal(r.state.pits[3], 0, 'emptied'); assert.equal(r.state.pits[6], 2); assert.equal(r.state.flag[3], 6, 'remembered as an emptied Tuz');
  assert.equal(legalMoves(r.state).includes(3), false);
  // later: a last stone in that empty hole captures just the stone placed there, turn ends
  const a = cloneState(r.state); a.pits.fill(0); a.pits[2] = 1; a.pits[0] = 3; a.pits[12] = 5; a.turn = 0; a.pits[6] = 0; a.flag[3] = 6;
  const c = playMove(a, 2, 'tuz'); assert.ok(c.ok); assert.equal(c.state.pits[3], 0); assert.equal(c.state.pits[6], 1, 'only the single placed stone'); assert.equal(c.state.turn, 1);
  // …but a stone merely passing through makes it an ordinary hole that receives stones
  const b = cloneState(a); b.pits[2] = 0; b.pits[1] = 3; b.flag[3] = 6; const d = playMove(b, 1, 'tuz'); assert.ok(d.ok);
  assert.equal(d.state.flag[3], 0); assert.equal(d.state.pits[3], 1, 'it received a stone'); }
console.log('ok 2 emptied Tuz');

// 4. Ownership: nobody can lift a frozen Tuz (owner or opponent); each Tuz has an owner
{ const q = base(0); q.pits[9] = 4; q.flag[9] = tuzFlag(0); q.pits[3] = 4; q.flag[3] = tuzFlag(1); q.pits[0] = 1; q.pits[11] = 1;
  assert.deepEqual(legalMoves(q, 0), [0]); assert.deepEqual(legalMoves(q, 1), [11]);
  assert.equal(playMove(q, 3, 'tuz').ok, false, 'the opponent\'s Tuz in my hole cannot be lifted by me');
  const q2 = cloneState(q); q2.turn = 1; assert.equal(playMove(q2, 9, 'tuz').ok, false, 'a Tuz cannot be lifted by the player whose hole it is in'); }
console.log('ok 4 frozen Tuz cannot be moved');

// 5/7. Making a Tuz: last stone in an OPPONENT hole holding exactly three -> frozen, mine, turn ends; again and again
{ let q = base(0); q.pits[5] = 2; q.pits[8] = 3; q.pits[0] = 2; q.pits[12] = 5;
  let r = playMove(q, 5, 'tuz'); assert.ok(r.ok); assert.equal(r.state.pits[8], 4); assert.equal(r.state.flag[8], tuzFlag(0)); assert.equal(r.state.turn, 1);
  let s2 = cloneState(r.state); s2.turn = 0; s2.pits[4] = 3; s2.pits[10] = 3; s2.pits[11] = 0; // 3 stones: 5,7,8 would pass the Tuz; use 2 stones to reach hole 10? build: hole 3 with 2 stones lands on 4 — keep simple below
  const w = base(0); w.pits[5] = 1; w.pits[7] = 3; w.pits[9] = 3; w.pits[4] = 3; w.pits[0] = 2; w.pits[12] = 5;
  const a = playMove(w, 5, 'tuz'); assert.equal(a.state.flag[7], tuzFlag(0)); const w2 = cloneState(a.state); w2.turn = 0; w2.pits[4] = 5; // hole 4: 5 stones -> 5,7(Tuz),8,9,10: last on 10
  w2.pits[9] = 2; w2.pits[10] = 3; w2.pits[8] = 0; w2.pits[4] = 5; const b = playMove(w2, 4, 'tuz'); assert.ok(b.ok);
  assert.equal(b.state.flag[10], tuzFlag(0), 'a second Tuz'); assert.equal(b.state.flag[7], tuzFlag(0), 'the first one is still mine'); assert.ok(validState(b.state)); }
// …exactly three only: a hole with 2 or 4 is not a Tuz; my OWN hole holding three is never a Tuz
{ const q = base(0); q.pits[5] = 2; q.pits[8] = 2; q.pits[0] = 2; q.pits[12] = 5; assert.equal(playMove(q, 5, 'tuz').state.flag[8], 0);
  const o = base(0); o.pits[0] = 1; o.pits[1] = 3; o.pits[12] = 5; o.pits[7] = 4; const ro = playMove(o, 0, 'tuz'); assert.equal(ro.state.flag[1], 0, 'own hole 3 -> 4 is a normal hole'); }
console.log('ok 5/7 creating (multiple) Tuz');

// 6. Turn ends when the last stone lands in an empty hole: nothing captured, opponent moves
{ const q = base(0); q.pits[0] = 1; q.pits[3] = 0; q.pits[1] = 0; q.pits[12] = 5; q.pits[2] = 3; // 0 -> hole 1 (empty)
  const r = playMove(q, 0, 'tuz'); assert.ok(r.ok); assert.equal(r.state.turn, 1); assert.equal(r.state.pits[6], 0); assert.equal(r.state.pits[1], 1); assert.ok(!r.steps.some((x) => x.t === 'tuz' || x.t === 'tuztake')); }
console.log('ok 6 last stone in an empty hole ends the turn');
