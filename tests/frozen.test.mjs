// Gebeta: an uncollected four freezes; a sowing that ends on a frozen hole ends the turn (no relay).
import assert from 'node:assert/strict';
import { newGame, playMove, legalMoves, collectable } from '../src/lib/gebeta/engine.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('frozen hole: cannot be lifted and ends a turn that lands on it', () => {
  const g = newGame();
  g.pits = [2, 0, 4, 3, 1, 0, 0, 4, 4, 4, 4, 4, 4, 0];
  g.flag[2] = 3; // frozen (a four nobody collected)
  assert.ok(!legalMoves(g).includes(2));
  // hole 0 has 2 stones: lands on hole 2 with the last one -> frozen hole -> turn ends, no relay
  const r = playMove(g, 0);
  assert.ok(r.ok); assert.equal(r.state.turn, 1);
  assert.ok(!r.steps.some((s) => s.t === 'relay'));
  assert.equal(r.state.pits[2], 5);
});
t('a four made by your last stone is yours to tap; moving on without tapping freezes it', () => {
  const g = newGame(); g.pits = [0, 0, 1, 3, 2, 1, 0, 4, 4, 4, 4, 4, 4, 0];
  const r = playMove(g, 2); // one stone into hole 3 -> four, ripe for the mover, turn ends
  assert.ok(r.ok); assert.deepEqual(collectable(r.state, 0), [3]);
  const mid = { ...r.state, turn: 0 }; // pretend the opponent passed the turn back
  const r2 = playMove(mid, 5); // seat 0 plays elsewhere without collecting
  assert.equal(r2.state.flag[3], 3, 'the uncollected four is frozen');
  assert.ok(!legalMoves({ ...r2.state, turn: 0 }).includes(3));
});
console.log(n, 'frozen tests passed');

// ── v13: one-tap collecting and no silent fives ──
import { collect } from '../src/lib/gebeta/engine.js';
t('the entitled player can collect a four on the OPPONENT\'s turn (his own last stone made it)', () => {
  const g = newGame(); g.pits = [0, 0, 1, 3, 2, 1, 0, 4, 4, 4, 4, 4, 4, 0];
  const r = playMove(g, 2); // seat 0 makes a four in hole 3; turn passes to seat 1
  assert.equal(r.state.turn, 1);
  assert.ok(!collect(r.state, 3).ok, 'defaults to the player to move');
  const c = collect(r.state, 3, 0);
  assert.ok(c.ok); assert.equal(c.state.pits[6], 4); assert.equal(c.state.pits[3], 0); assert.equal(c.state.turn, 1, 'the turn does not change');
  assert.ok(!collect(r.state, 3, 1).ok, 'the other player may not take it');
});
t('a stone dropped into an uncollected four freezes it: it never becomes a collectable five', () => {
  const g = newGame(); g.pits = [0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 0, 3, 0];
  g.flag[3] = 1; g.turn = 1; // a ripe four for seat 0, seat 1 to move
  g.own = g.own.slice();
  const r = playMove(g, 12); // 3 seeds: 0, 1, 2 -> not reaching 3; use a hand that ends in hole 3
  assert.ok(r.ok);
  const g2 = newGame(); g2.pits = [0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0]; g2.flag[3] = 1; g2.turn = 1;
  const r2 = playMove(g2, 12); // 4 seeds: 0,1,2,3 -> last one lands in the ripe hole
  assert.equal(r2.state.pits[3], 5); assert.equal(r2.state.flag[3], 3, 'frozen, not ripe');
  assert.deepEqual(collectable(r2.state, 0), []);
  assert.ok(!collect(r2.state, 3, 0).ok);
  assert.ok(r2.steps.some((s) => s.t === 'share' && s.i === 3));
});
console.log('v13 one-tap tests passed');
