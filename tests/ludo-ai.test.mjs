import assert from 'node:assert/strict';
import { newGame, applyRoll, applyMove, legalMoves, chooseToken, absOf, previewMove } from '../src/lib/ludo/engine.js';
import { chooseSmart, bestMove, rankMoves, evaluate, tokenValue, SEARCH } from '../src/lib/ludo/ai.js';

// helper: a 2-player game (seat 0 on ring cell 0, seat 1 on ring cell 26) with chosen pawn positions
const two = (a, b, dice) => ({ ...newGame({ players: 2, tokens: 4 }), pos: [a, b], dice, phase: 'move', turn: 0 });
const abs1 = (rel1) => absOf(two([-1, -1, -1, -1], [-1, -1, -1, -1], 1), 1, rel1);
const rel1At = (abs) => (abs - 26 + 52) % 52;   // opponent relative position that stands on ring cell `abs`

// ── 1. it takes a capture — even over a tempting safe star ──
{ const s = two([10, 30, -1, -1], [rel1At(14), -1, -1, -1], 4);
  assert.ok(previewMove(s, 0, 0, 4).captured.length === 1 && previewMove(s, 0, 1, 4).to === 34);   // pawn 0 hits, pawn 1 reaches a star
  for (const lvl of ['medium', 'hard']) assert.equal(chooseSmart(s, lvl, () => 0.99), 0, lvl + ' captures');
  assert.equal(bestMove(s), 0);
  console.log('ok captures the opponent pawn instead of a safe star'); }

// ── 2. it runs from a hunter to a star ──
{ const s = two([19, 3, -1, -1], [rel1At(16), -1, -1, -1], 2);   // hunter 3 cells behind pawn 0; a 2 puts pawn 0 on the star at 21
  assert.equal(previewMove(s, 0, 0, 2).to, 21);
  assert.equal(chooseSmart(s, 'hard'), 0, 'hard saves the pawn that is under attack');
  const r = rankMoves(s); assert.ok(r[0].v > r[1].v, 'and it scores that move higher');
  console.log('ok moves a threatened pawn to safety'); }

// ── 3. finishing beats everything else ──
{ const s = two([54, 12, -1, -1], [30, -1, -1, -1], 2);
  assert.equal(chooseSmart(s, 'hard'), 0); console.log('ok brings a pawn home when it can'); }

// ── 4. leaving base with a six is preferred when the board is empty ──
{ const s = two([-1, -1, -1, -1], [-1, -1, -1, -1], 6); assert.equal(chooseSmart(s, 'hard'), 0); console.log('ok opens with a six'); }

// ── 5. it hits the pawn that matters most (the one furthest along) when both hits are equally safe ──
{ const t = two([25, 41, -1, -1], [rel1At(29), rel1At(45), -1, -1], 4);   // pawn 0 → ring cell 29 hits a pawn that went 3 cells; pawn 1 → cell 45 hits one that went 19
  const hits = legalMoves(t).map((i) => previewMove(t, 0, i, 4).captured.length); assert.deepEqual(hits, [1, 1]);
  assert.equal(chooseSmart(t, 'hard'), 1, 'sends the bigger pawn back');
  console.log('ok hunts the opponent\'s most advanced pawn'); }
// ...and it does not make a hit that walks straight into a counter-hit when the other hit is safe
{ const t = two([5, 11, -1, -1], [rel1At(9), rel1At(15), -1, -1], 4);   // hitting on 15 would leave my pawn 6 cells in front of the pawn on 9
  assert.equal(chooseSmart(t, 'hard'), 0, 'takes the hit that leaves nothing behind it'); console.log('ok avoids a hit that invites a counter-hit'); }

// ── 6. static score sanity ──
{ const s = two([20, -1, -1, -1], [-1, -1, -1, -1], null); s.phase = 'roll';
  const safe = two([21, -1, -1, -1], [rel1At(16), -1, -1, -1], null); safe.phase = 'roll';     // on the star 21
  const hit = two([20, -1, -1, -1], [rel1At(17), -1, -1, -1], null); hit.phase = 'roll';       // hunter 3 behind, no star
  assert.ok(evaluate(safe, 0) > evaluate(hit, 0), 'a pawn on a star is worth more than one in the line of fire');
  assert.ok(evaluate(s, 0) > 0 && tokenValue(s, 56) > tokenValue(s, 55) && tokenValue(s, 0) > tokenValue(s, -1));
  console.log('ok evaluation prefers safety'); }

// ── 7. always legal, fast, and the engine state is never touched ──
{ let worst = 0, moves = 0;
  for (const players of [2, 4]) for (let g = 0; g < 25; g++) {
    let s = newGame({ players, tokens: g % 2 ? 2 : 4, start: g % players }), k = 0;
    while (!s.over && k++ < 20000) {
      const r = applyRoll(s, 1 + Math.floor(Math.random() * 6)); s = r.state; if (r.none || r.forfeited) continue;
      const frozen = JSON.stringify(s), t = performance.now();
      const i = chooseSmart(s, ['easy', 'medium', 'hard'][(s.turn + g) % 3]); worst = Math.max(worst, performance.now() - t); moves++;
      assert.ok(legalMoves(s).includes(i), 'legal'); assert.equal(JSON.stringify(s), frozen, 'search did not mutate the game');
      s = applyMove(s, i).state;
    }
    assert.ok(s.over);
  }
  assert.ok(worst < 400, 'slowest decision ' + worst.toFixed(0) + ' ms');
  console.log('ok full games: always legal, never mutates, slowest move', worst.toFixed(0) + ' ms over', moves, 'moves'); }

// ── 8. strength: the search beats the old picker and the easy level ──
function duel(newLvl, oldLvl, N) {
  let wins = 0;
  for (let g = 0; g < N; g++) {
    const seat = g % 2; let s = newGame({ players: 2, tokens: 4, start: g % 2 }), k = 0;
    while (!s.over && k++ < 30000) {
      const r = applyRoll(s, 1 + Math.floor(Math.random() * 6)); s = r.state; if (r.none || r.forfeited) continue;
      s = applyMove(s, s.turn === seat ? chooseSmart(s, newLvl) : chooseToken(s, oldLvl)).state;
    }
    if (s.ranks[0] === seat) wins++;
  }
  return wins / N;
}
{ const a = duel('medium', 'medium', 500); assert.ok(a > 0.52, 'smart medium vs old medium ' + a); console.log('ok smart medium beats the old medium', Math.round(100 * a) + '%');
  const b = duel('hard', 'easy', 300); assert.ok(b > 0.8, 'smart hard vs easy ' + b); console.log('ok smart hard beats easy', Math.round(100 * b) + '%'); }
assert.ok(SEARCH.hard.depth > SEARCH.medium.depth && SEARCH.medium.depth > SEARCH.easy.depth);
console.log('ludo ai tests passed');
