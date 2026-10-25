// አሻግሮ መብል computer: whenever a move ends with the last stone in the mover's own empty hole opposite a loaded
// opponent hole, the computer MUST take it (all levels), and its search memory never leaks between rule sets.
import assert from 'node:assert/strict';
import { newGame, playMove, legalMoves } from '../src/lib/gebeta/engine.js';
import { chooseMove, captureMoves, think } from '../src/lib/gebeta/ai.js';

const R = 'ashagro';
const takes = (s, m) => playMove(s, m, R).steps.some((x) => x.t === 'capture');

// 1. a hand-made position: hole 0 (1 stone) → hole 1 is empty, hole 11 across holds 5 → capture available for seat 0
{
  const s = { ...newGame(R, 0), pits: [1, 0, 3, 3, 3, 3, 0, 3, 3, 3, 3, 5, 3, 0] };
  const caps = captureMoves(s, R);
  assert.ok(caps.length >= 1, 'a capture exists');
  for (const lv of ['easy', 'medium', 'hard']) for (let k = 0; k < 15; k++) {
    const m = chooseMove(s, R, lv, Math.random, { maxMs: 40 });
    assert.ok(takes(s, m), `${lv}: the computer takes the capture`);
  }
}
console.log('ok computer takes an available capture on every level');

// 2. random games: whenever any capture exists the computer plays one (500+ positions per level)
{
  let seen = 0;
  for (let g = 0; g < 40; g++) {
    let s = newGame(R, g & 1), n = 0;
    while (!s.over && n++ < 300) {
      const mv = legalMoves(s);
      if (captureMoves(s, R).length) {
        seen++;
        for (const lv of ['easy', 'medium']) assert.ok(takes(s, chooseMove(s, R, lv, Math.random, { maxMs: 25 })), `${lv} missed a capture`);
      }
      s = playMove(s, mv[Math.floor(Math.random() * mv.length)], R).state;
    }
  }
  assert.ok(seen > 100, 'enough capture positions were tested');
  console.log(`ok never missed a capture in ${seen} positions`);
}

// 3. plain Gebeta has no capture rule, so nothing is forced there
assert.deepEqual(captureMoves(newGame('gebeta', 0), 'gebeta'), []);

// 4. one shared search memory used for two rule sets never mixes their results
{
  const tt = new Map();
  const s = newGame('gebeta', 0);
  const a = think(s, 'gebeta', { depth: 4, ms: 200, tt });
  const keys = [...tt.keys()];
  assert.ok(keys.every((k) => k.startsWith('gebeta|')), 'entries are tagged with the rule set');
  think({ ...newGame(R, 0) }, R, { depth: 3, ms: 200, tt });
  assert.ok([...tt.keys()].some((k) => k.startsWith('ashagro|')));
  assert.ok(a.move != null);
}
console.log('ashagro AI tests passed');
