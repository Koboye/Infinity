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
