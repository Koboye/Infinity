import assert from 'node:assert/strict';
import { newGame, playMove, legalMoves, applyStep, forfeit, nextSlot, famText, dealRound } from '../src/lib/gebeta/engine.js';
import { chooseMove } from '../src/lib/gebeta/ai.js';

const total = (s) => s.pits.reduce((a, b) => a + b, 0);
const mk = (holes, turn = 0) => { // holes: 12 numbers (seat0: 0-5, seat1: 7-12)
  const pits = new Array(14).fill(0);
  [0, 1, 2, 3, 4, 5].forEach((i) => { pits[i] = holes[i]; });
  [7, 8, 9, 10, 11, 12].forEach((i, k) => { pits[i] = holes[6 + k]; });
  return { pits, turn, over: false, winner: null };
};
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('initial board: 12 holes x 4 seeds, piles empty', () => {
  const g = newGame(); assert.equal(total(g), 48); assert.equal(g.pits[6], 0); assert.equal(g.pits[13], 0);
  assert.deepEqual(legalMoves(g), [0, 1, 2, 3, 4, 5]);
});
t('path skips both piles and wraps', () => {
  assert.equal(nextSlot(5), 7); assert.equal(nextSlot(12), 0); assert.equal(nextSlot(0), 1);
});
t('validation', () => {
  const g = newGame(); assert.equal(playMove(g, 8).ok, false); assert.equal(playMove(g, 6).ok, false);
  g.pits[0] = 0; assert.equal(playMove(g, 0).ok, false);
});
t('last seed in empty hole ends the turn, no capture', () => {
  const g = mk([1, 0, 0, 0, 0, 2, /*B*/ 2, 0, 0, 0, 0, 0]);
  const r = playMove(g, 0); // 1 seed → hole 1 (empty)
  assert.equal(r.state.pits[1], 1); assert.equal(r.state.turn, 1); assert.equal(r.captured, 0);
  assert.ok(!r.steps.some((s) => s.t === 'relay'));
});
t('last seed in filled hole relays until an empty hole', () => {
  const g = mk([1, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const r = playMove(g, 0); // → hole1 (2→3) relay 3 → holes 2,3,4: 4 was empty → stop
  assert.ok(r.steps.some((s) => s.t === 'relay' && s.i === 1 && s.n === 3));
  assert.deepEqual(r.state.pits.slice(0, 6), [0, 0, 1, 1, 1, 0]);
  assert.equal(total(r.state), 5);
});
t('final seed makes a family: mover captures it and the turn ends', () => {
  const g = mk([1, 3, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0]);
  const r = playMove(g, 0);
  assert.equal(r.state.pits[1], 0); assert.equal(r.state.pits[6], 4); assert.equal(r.captured, 4);
  assert.equal(r.state.turn, 1);
  const fam = r.steps.find((s) => s.t === 'family'); assert.equal(fam.last, true); assert.equal(fam.by, 0);
});
t('final-seed family in an OPPONENT hole is still scored by the mover', () => {
  const g = mk([0, 0, 0, 0, 0, 1, 3, 2, 0, 0, 0, 0]); // hole5 → hole7 (B's, has 3 → 4)
  const r = playMove(g, 5);
  assert.equal(r.state.pits[6], 4); assert.equal(r.state.pits[13], 0); assert.equal(r.state.pits[7], 0);
});
t('mid-sowing family goes to the hole\'s owner and sowing continues', () => {
  // seat 0 sows 3 seeds from hole 4: hole5, hole7 (B's hole with 3 → 4 = B's family), hole8 (last)
  const g = mk([0, 0, 0, 0, 3, 0, 3, 0, 0, 0, 0, 0]);
  g.pits[8] = 0; g.pits[7] = 3;
  const r = playMove(g, 4);
  assert.equal(r.state.pits[13], 4, 'opponent scored the family');
  assert.equal(r.state.pits[6], 0);
  assert.equal(r.state.pits[8], 1, 'sowing carried on to hole 8');
  const steps = r.steps.map((s) => s.t);
  assert.deepEqual(steps.slice(0, 5), ['pick', 'sow', 'sow', 'family', 'sow']);
  assert.equal(r.steps.find((s) => s.t === 'family').last, false);
});
t('mid-sowing family in my own hole is mine', () => {
  const g = mk([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
  g.pits[1] = 3; g.pits[0] = 0; g.pits[2] = 0; // hole0 empty; seed from hole 5? use hole 12 wrap instead
  const h = mk([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2]); // seat1 hole12 has 2: → hole0 (3→4 mid? no, last)
  h.turn = 1; h.pits[12] = 3; h.pits[1] = 0; // 3 seeds: hole0 (3→4 family, mid), hole1, hole2 (last)
  const r = playMove(h, 12);
  assert.equal(r.state.pits[6], 4, 'seat 0 owns hole 0 so it scores');
  assert.equal(r.state.pits[13], 0);
});
t('a seed sowed into the origin hole when going all the way round', () => {
  const g = mk([13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  g.pits[7] = 1;
  const r = playMove(g, 0); // 13 seeds: 12 holes then hole 1 again
  assert.equal(total(r.state), 14);
});
t('game ends when the player to move has no seeds; mover takes the rest', () => {
  const g = mk([0, 0, 0, 0, 1, 2, /*B*/ 1, 0, 0, 0, 0, 0]);
  g.pits[7] = 0; g.pits[8] = 0; g.pits[9] = 0; g.pits[10] = 0; g.pits[11] = 0; g.pits[12] = 0;
  g.pits[7] = 1; // B has one seed in hole 7
  // seat 0 moves hole 4 (1 seed) → hole 5 (2→3) relay 3 → holes 7,8,9 : B hole7 has 1 → 2, 8, 9 empty. B still has seeds.
  const r = playMove(g, 4);
  assert.equal(r.state.over, false);
  // now a position where B ends with nothing:
  const h = mk([0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0]);
  h.pits[0] = 1; h.pits[5] = 0; // seat0 side has hole0 = 1
  h.pits[1] = 2; // B none, seat0 has 3 seeds on board
  const r2 = playMove(h, 0);
  assert.equal(r2.state.over, true);
  assert.equal(r2.state.pits[6], 3 + 0); assert.equal(r2.state.winner, 0);
  assert.equal(r2.state.pits.slice(0, 6).concat(r2.state.pits.slice(7, 13)).every((x) => x === 0), true);
  assert.ok(r2.steps.some((s) => s.t === 'sweep'));
});
t('round end with seeds on both sides of the table: new round is dealt 4 per hole, winner opens', () => {
  // seat 0 has 5 in pile, seat 1 has 3; seat 0 empties seat 1's side by its last move and sweeps its own holes
  const g = { pits: [0, 0, 0, 0, 1, 0, 5, 0, 0, 0, 0, 0, 0, 3], turn: 0, over: false, winner: null };
  const r = playMove(g, 4); // hole4 → hole5 (empty). B has no seeds → round over, seat 0 sweeps its 1 seed
  assert.equal(r.state.over, false); assert.equal(r.newRound, true);
  assert.deepEqual(r.state.pits.slice(0, 6), [4, 2, 0, 0, 0, 0]); assert.equal(r.state.pits[6], 0); // 6 seeds: 4 + 2
  assert.deepEqual(r.state.pits.slice(7, 13), [3, 0, 0, 0, 0, 0]); assert.equal(r.state.pits[13], 0);
  assert.equal(r.state.turn, 0, 'the round winner (6 > 3) opens');
  assert.ok(r.steps.some((s) => s.t === 'deal'));
});
t('surplus beyond 24 seeds waits in the pile', () => {
  const d = dealRound([30, 18]);
  assert.deepEqual(d.slice(0, 6), [4, 4, 4, 4, 4, 4]); assert.equal(d[6], 6);
  assert.deepEqual(d.slice(7, 13), [4, 4, 4, 4, 2, 0]); assert.equal(d[13], 0);
});
t('game ends only when one player has lost every seed', () => {
  const g = { pits: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0], turn: 0, over: false, winner: null };
  const r = playMove(g, 4);
  assert.equal(r.state.over, true); assert.equal(r.state.winner, 0); assert.equal(r.state.pits[6], 1);
});
t('several rounds in a row keep all 48 seeds and always give the opener a move', () => {
  let g = newGame(), deals = 0, turns = 0;
  while (!g.over && turns++ < 4000) {
    const m = legalMoves(g); const r = playMove(g, m[Math.floor(Math.random() * m.length)]);
    if (r.newRound) { deals++; assert.ok(legalMoves(r.state).length > 0); assert.equal(total(r.state), 48); }
    g = r.state;
  }
  assert.ok(deals >= 3, 'rounds do roll over (' + deals + ')');
  console.log('  rounds rolled over in one random game:', deals);
});
t('famText', () => { assert.equal(famText(8), '2'); assert.equal(famText(9), '2+1'); assert.equal(famText(0), '0'); });
t('steps replay equals final state', () => {
  for (let k = 0; k < 60; k++) {
    let g = newGame(), guard = 0;
    while (!g.over) {
      const m = legalMoves(g); const r = playMove(g, m[Math.floor(Math.random() * m.length)]);
      const p = g.pits.slice(); r.steps.forEach((s) => applyStep(p, s));
      assert.deepEqual(p, r.state.pits); g = r.state;
      if (++guard > 400) break;
    }
  }
});
t('forfeit', () => { assert.equal(forfeit(newGame(), 0).winner, 1); });
t('random playouts: conserve 48 seeds and the mover always has a move', () => {
  for (let k = 0; k < 60; k++) {
    let g = newGame(), turns = 0;
    while (!g.over && turns++ < 1500) {
      const m = legalMoves(g); const r = playMove(g, m[Math.floor(Math.random() * m.length)]); assert.ok(r.ok);
      g = r.state; assert.equal(total(g), 48);
      if (!g.over) assert.ok(legalMoves(g).length > 0, 'player to move always has a move');
    }
  }
});
t('AI owns more seeds than a random player after the same number of moves', () => {
  let better = 0; const N = 10;
  const owned = (g, seat) => g.pits[seat === 0 ? 6 : 13] + (seat === 0 ? [0,1,2,3,4,5] : [7,8,9,10,11,12]).reduce((a, i) => a + g.pits[i], 0);
  for (let k = 0; k < N; k++) {
    let g = newGame('gebeta'); const ai = k % 2; let turns = 0;
    while (!g.over && turns++ < 600) { const mv = g.turn === ai ? chooseMove(g, 'gebeta', 'medium') : (() => { const m = legalMoves(g); return m[Math.floor(Math.random() * m.length)]; })(); g = playMove(g, mv, 'gebeta').state; }
    if (g.over ? g.winner === ai : owned(g, ai) > owned(g, 1 - ai)) better++;
  }
  console.log('  AI ahead', better, '/', N); assert.ok(better >= 7);
});
console.log(n, 'tests passed');
