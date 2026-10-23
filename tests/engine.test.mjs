import assert from 'node:assert/strict';
import { newGame, playMove, legalMoves, applyStep, forfeit } from '../src/lib/gebeta/engine.js';
import { chooseMove } from '../src/lib/gebeta/ai.js';

const total = (s) => s.pits.reduce((a, b) => a + b, 0);
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('initial board', () => {
  const g = newGame(); assert.equal(total(g), 48); assert.equal(g.pits[6], 0);
  assert.deepEqual(legalMoves(g), [0,1,2,3,4,5]);
});
t('pit 2 (4 seeds) ends in store → extra turn', () => {
  const g = newGame('classic'); const r = playMove(g, 2, 'classic');
  assert.equal(r.state.pits[6], 1); assert.equal(r.extraTurn, true); assert.equal(r.state.turn, 0);
});
t('validation', () => {
  const g = newGame(); assert.equal(playMove(g, 8).ok, false); assert.equal(playMove(g, 6).ok, false);
  g.pits[0] = 0; assert.equal(playMove(g, 0).ok, false);
});
t('opponent store skipped', () => {
  const g = newGame('classic'); g.pits[5] = 9; const r = playMove(g, 5, 'classic');
  assert.equal(r.state.pits[13], 0); assert.equal(total(r.state), 48 + 5);
});
t('capture', () => {
  const g = { pits: [1,0,0,0,0,0, 0, 0,0,0,0,5,3, 2], turn: 0, over: false, winner: null };
  g.pits[0] = 1; g.pits[1] = 0; g.pits[11] = 5; // pit0 → pit1 (empty, mine), opposite 11 has 5
  const r = playMove(g, 0, 'classic');
  assert.equal(r.captured, 6); assert.equal(r.state.pits[6], 6); assert.equal(r.state.pits[1], 0); assert.equal(r.state.pits[11], 0);
});
t('relay continues through filled pit', () => {
  const g = { pits: [1,2,0,0,0,0, 0, 1,0,0,0,0,1, 0], turn: 0, over: false, winner: null };
  const r = playMove(g, 0, 'gebeta'); // 1 seed → pit1 (had 2→3) relay 3 → 2,3,4 (4 empty → capture? opp 8 empty)
  assert.ok(r.steps.some((s) => s.t === 'relay'));
  assert.equal(total(r.state), 5);
});
t('game end sweeps and declares winner', () => {
  const g = { pits: [0,0,0,0,0,1, 20, 0,0,0,0,0,3, 10], turn: 0, over: false, winner: null };
  const r = playMove(g, 5, 'classic'); // lands in store 6
  assert.equal(r.state.over, true); assert.equal(r.state.pits[6], 21); assert.equal(r.state.pits[13], 13); assert.equal(r.state.winner, 0);
});
t('steps replay equals final state', () => {
  const g = newGame(); const r = playMove(g, 3, 'gebeta'); const p = g.pits.slice();
  r.steps.forEach((s) => applyStep(p, s)); 
  // relay pick is implicit: apply relay as pick
  const p2 = g.pits.slice(); r.steps.forEach((s) => applyStep(p2, s));
  assert.deepEqual(p2, r.state.pits);
});
t('forfeit', () => { assert.equal(forfeit(newGame(), 0).winner, 1); });
t('random playouts: conserve seeds, always terminate', () => {
  for (const rs of ['gebeta', 'classic']) for (let k = 0; k < 300; k++) {
    let g = newGame(rs), turns = 0;
    while (!g.over) { const m = legalMoves(g); const r = playMove(g, m[Math.floor(Math.random() * m.length)], rs); assert.ok(r.ok); g = r.state; assert.equal(total(g), 48); if (++turns > 2000) assert.fail('no end'); }
  }
});
t('AI beats random most of the time', () => {
  let wins = 0; const N = 20;
  for (let k = 0; k < N; k++) {
    let g = newGame('gebeta'); const ai = k % 2;
    while (!g.over) { const mv = g.turn === ai ? chooseMove(g, 'gebeta', 'medium') : (() => { const m = legalMoves(g); return m[Math.floor(Math.random() * m.length)]; })(); g = playMove(g, mv, 'gebeta').state; }
    if (g.winner === ai) wins++;
  }
  console.log('  AI wins', wins, '/', N); assert.ok(wins >= 15);
});
console.log(n, 'tests passed');
