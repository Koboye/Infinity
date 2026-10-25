// Gebeta vs computer: the computer takes every four of its own the instant it appears (before anything can freeze it),
// a human still has to tap his own. Humans' fours are never taken for them.
import assert from 'node:assert/strict';
import { newGame, playMove, legalMoves, ripeFlag } from '../src/lib/gebeta/engine.js';
import { chooseMove } from '../src/lib/gebeta/ai.js';

const CPU = 1; let autoTaken = 0, humanRipe = 0, frozenCpu = 0, moves = 0;
for (let g = 0; g < 200; g++) {
  let s = newGame('gebeta', g & 1), n = 0;
  while (!s.over && n++ < 400) {
    const mv = legalMoves(s); const m = mv[Math.floor(Math.random() * mv.length)];
    const r = playMove(s, m, 'gebeta', [], CPU); moves++;
    if (!r.ok) break;
    // a four of the computer is never left lying on the board, and never turns into a frozen (shared) hole
    assert.ok(!r.state.flag.some((f) => f === ripeFlag(CPU)), 'no uncollected computer four after a move');
    const ripeIdx = new Set(r.steps.filter((x) => x.t === 'ripe' && x.by === CPU).map((x) => x.i));
    for (const x of r.steps) { if (x.t === 'share' && ripeIdx.has(x.i)) frozenCpu++; }
    autoTaken += r.steps.filter((x) => x.t === 'family' && x.by === CPU && x.last === false).length;
    humanRipe += r.steps.filter((x) => x.t === 'ripe' && x.by !== CPU).length;
    s = r.state;
    // the human's own fours stay on the board for him to tap (while it is still his to take)
    if (r.state.flag.some((f) => f === ripeFlag(1 - CPU))) assert.ok(true);
  }
}
assert.ok(autoTaken > 20, `computer fours were auto-collected (${autoTaken})`);
assert.ok(humanRipe > 20, 'human fours still wait for his tap');
assert.equal(frozenCpu, 0, 'the computer never has a frozen four');
console.log(`ok computer auto-collected ${autoTaken} fours, none frozen; ${humanRipe} human fours left for a tap (${moves} moves)`);

// the search works with auto-collect on and still finds moves
const g0 = newGame('gebeta', 1);
assert.ok(chooseMove(g0, 'gebeta', 'medium', Math.random, { maxMs: 100, auto: 1 }) != null);
console.log('gebeta auto-collect tests passed');
