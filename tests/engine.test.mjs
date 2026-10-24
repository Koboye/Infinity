import assert from 'node:assert/strict';
import { newGame, playMove, legalMoves, applyStep, applyFlag, forfeit, nextSlot, famText, dealRound, collect, collectAll, collectable } from '../src/lib/gebeta/engine.js';
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
const flagged = (g, flags) => { g.flag = new Array(14).fill(0); Object.entries(flags).forEach(([k, v]) => { g.flag[k] = v; }); return g; };
t('final seed makes four: the hole stays, marked for the mover, turn ends', () => {
  const g = mk([1, 3, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0]);
  const r = playMove(g, 0);
  assert.equal(r.state.pits[1], 4); assert.equal(r.state.pits[6], 0, 'nothing is taken automatically');
  assert.equal(r.state.flag[1], 1); assert.equal(r.state.turn, 1);
  const ripe = r.steps.find((s) => s.t === 'ripe'); assert.equal(ripe.by, 0);
});
t('a ripe hole cannot be lifted, but the owner can tap it to collect', () => {
  const g = flagged(mk([0, 4, 1, 0, 0, 0, 2, 0, 0, 0, 0, 1]), { 1: 1 });
  assert.ok(!legalMoves(g).includes(1)); assert.equal(playMove(g, 1).ok, false);
  assert.deepEqual(collectable(g, 0), [1]);
  const c = collect(g, 1); assert.ok(c.ok); assert.equal(c.state.pits[6], 4); assert.equal(c.state.pits[1], 0); assert.equal(c.state.flag[1], 0);
  assert.equal(c.state.turn, 0, 'collecting is free: still your turn');
  assert.equal(collect(g, 2).ok, false);
  assert.equal(collect({ ...g, turn: 1 }, 1).ok, false, 'only the entitled player may collect');
});
t('moving without collecting turns the family into a shared hole', () => {
  const g = flagged(mk([0, 4, 1, 0, 0, 0, 2, 0, 0, 0, 0, 1]), { 1: 1 });
  const r = playMove(g, 2);
  assert.equal(r.state.flag[1], 3); assert.ok(r.steps.some((s) => s.t === 'share'));
  assert.ok(!legalMoves({ ...r.state, turn: 0 }).includes(1));
  // seeds keep piling into it and nothing is relayed out of it
  const g2 = flagged(mk([1, 4, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1]), { 1: 3 });
  const r2 = playMove(g2, 0);
  assert.equal(r2.state.pits[1], 5); assert.equal(r2.state.flag[1], 3); assert.equal(r2.state.turn, 1, 'landing on a shared hole ends the turn');
});
t('four made mid-sowing in the opponent hole is the opponent\'s to tap; sowing carries on', () => {
  const g = mk([0, 0, 0, 0, 3, 0, 3, 0, 0, 0, 0, 0]);
  g.pits[8] = 0; g.pits[7] = 3;
  const r = playMove(g, 4);
  assert.equal(r.state.pits[7], 4); assert.equal(r.state.flag[7], 2); assert.equal(r.state.pits[13], 0);
  assert.equal(r.state.pits[8], 1, 'sowing carried on to hole 8');
  assert.deepEqual(r.steps.map((s) => s.t).slice(0, 5), ['pick', 'sow', 'sow', 'ripe', 'sow']);
  assert.deepEqual(collectable({ ...r.state, turn: 1 }, 1), [7]);
});
t('at round end a ripe family goes to its owner and a shared hole is split equally (odd seed by lottery)', () => {
  for (const n of [6, 7]) {
    const g = flagged({ pits: new Array(14).fill(0), turn: 0, over: false, winner: null }, { 3: 3 });
    g.pits[3] = n; g.pits[0] = 1; g.pits[6] = 10; g.pits[13] = 10; // A moves hole 0 → hole 1, B has nothing to lift
    const r = playMove(g, 0);
    const a = r.state.over ? r.state.pits[6] : null;
    const split = r.steps.find((s) => s.t === 'split'); assert.ok(split);
    assert.equal(split.n0 + split.n1, n); assert.ok(Math.abs(split.n0 - split.n1) === (n % 2));
    assert.equal(r.state.pits.reduce((x, y) => x + y, 0), 10 + 10 + 1 + n);
    const again = playMove(g, 0); assert.deepEqual(again.steps.find((s) => s.t === 'split'), split, 'same board → same lottery');
  }
});
t('collectAll takes every ripe family of the player to move', () => {
  const g = flagged(mk([0, 4, 0, 4, 0, 0, 2, 0, 0, 0, 0, 0]), { 1: 1, 3: 1 });
  const c = collectAll(g); assert.equal(c.state.pits[6], 8); assert.equal(c.steps.length, 2);
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
  assert.deepEqual(r.state.pits.slice(7, 13), [0, 0, 0, 0, 0, 3]); assert.equal(r.state.pits[13], 0);
  assert.equal(r.state.turn, 0, 'the round winner (6 > 3) opens');
  assert.ok(r.steps.some((s) => s.t === 'deal'));
});
t('winner takes over the holes the loser can no longer fill', () => {
  const d = dealRound([30, 18]);
  assert.equal(d.pits.slice(0, 6).concat(d.pits.slice(7, 13)).reduce((x, y) => x + y, 0), 48);
  assert.equal(d.own[7], 0, 'hole 7 now belongs to the winner (seat 0)');
  assert.deepEqual(d.pits.slice(8, 13).filter((n) => n > 0).length, 5, 'loser keeps 5 holes (18 seeds)');
  assert.equal(d.pits[6], 0); assert.equal(d.pits[13], 0);
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
