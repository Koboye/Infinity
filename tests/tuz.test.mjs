import assert from 'node:assert/strict';
import { newGame, playMove, legalMoves, validState, tuzFlag, holesOf, cloneState } from '../src/lib/gebeta/engine.js';
import { chooseMove, evaluate } from '../src/lib/gebeta/ai.js';
const sum = (s) => s.pits.reduce((a, b) => a + b, 0);

// 1. the starter opens FROM one of HIS OWN holes (it keeps 3); the opponent's hole straight across becomes his Tuz; the carried stone goes to his pile
let g = newGame('tuz', 0);
assert.equal(g.opening, true);
assert.deepEqual(legalMoves(g), holesOf(g, 0));
assert.equal(playMove(g, 9, 'tuz').ok, false, 'cannot open from the opponent\'s hole');
let r = playMove(g, 2, 'tuz');
assert.ok(r.ok); g = r.state;
assert.equal(g.pits[2], 3, 'the tapped hole keeps three'); assert.equal(g.flag[10], tuzFlag(0), 'the hole across is the opener\'s Tuz'); assert.equal(g.pits[10], 4);
assert.equal(g.pits[6], 1, 'the carried stone is in the pile'); assert.equal(g.flag[2], 0, 'nothing is frozen on his own hole');
assert.equal(g.turn, 1); assert.ok(!g.opening); assert.ok(validState(g, true));
assert.ok(!legalMoves(g).includes(10), 'a Tuz cannot be lifted');
{ const c = newGame('tuz', 1); assert.deepEqual(legalMoves(c), holesOf(c, 1), 'the computer opens from ITS OWN holes');
  assert.equal(playMove(c, 3, 'tuz').ok, false, 'the computer cannot open from the human\'s hole');
  const rc = playMove(c, 9, 'tuz'); assert.ok(rc.ok); assert.equal(rc.state.flag[3], tuzFlag(1), 'the Tuz is on the HUMAN\'s hole 3 (across from 9) and belongs to the computer'); assert.equal(rc.state.pits[9], 3); assert.equal(rc.state.turn, 0); }
console.log('ok opening: own hole -> Tuz in the opponent hole across');

// 2. later: last stone makes an opponent's 3 a 4 -> second Tuz, turn ends, owner is the mover; Tuz count is unlimited
let s = newGame('tuz', 0); s.opening = false;
s.pits = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0].map((n, i) => n); s.pits[0] = 1; s.pits[11] = 0; s.pits[1] = 3; // seat0 hole 0 has 1 -> lands in hole 1 (own) ... build a clean case below
s = newGame('tuz', 0); s.opening = false; s.pits.fill(0); s.pits[5] = 1; s.pits[7] = 3; s.pits[12] = 5; s.pits[0] = 5; // 48-stone rule not needed here
r = playMove(s, 5, 'tuz'); assert.ok(r.ok);
assert.equal(r.state.flag[7], tuzFlag(0)); assert.equal(r.state.pits[7], 4); assert.equal(r.state.turn, 1);
assert.ok(r.steps.some((x) => x.t === 'tuz' && x.i === 7 && x.by === 0));
// own hole going 3->4 is a NORMAL hole: no Tuz, no ripe marker, no freeze of any kind
let own = newGame('tuz', 0); own.opening = false; own.pits.fill(0); own.pits[0] = 1; own.pits[1] = 3; own.pits[12] = 4;
const ro = playMove(own, 0, 'tuz'); assert.ok(ro.ok); assert.equal(ro.state.flag[1], 0, 'a four in my own hole is an ordinary hole');
// a four made in the MIDDLE of a sowing (not by the last stone) is an ordinary hole too — and the opponent's too
{ const q = newGame('tuz', 0); q.opening = false; q.pits.fill(0); q.pits[5] = 3; q.pits[7] = 3; q.pits[8] = 0; q.pits[9] = 0; q.pits[12] = 4; q.pits[0] = 2;
  const rq = playMove(q, 5, 'tuz'); assert.ok(rq.ok);
  assert.ok(rq.state.flag.every((f) => f === 0 || f >= 4), 'only a Tuz ever freezes');
  assert.ok(!rq.steps.some((x) => x.t === 'ripe' || x.t === 'share' || x.t === 'family')); }
console.log('ok last stone 3->4 on an opponent hole freezes a Tuz');

// 3. several Tuz at once; one side empty -> the other keeps playing alone; round ends only when nobody can lift
let m = newGame('tuz', 0); m.opening = false; m.pits.fill(0);
m.flag[8] = tuzFlag(0); m.flag[9] = tuzFlag(1); m.flag[10] = tuzFlag(0); m.pits[8] = 4; m.pits[9] = 4; m.pits[10] = 4; m.pits[0] = 1; m.pits[13] = 35; m.turn = 0;
let rr = playMove(m, 0, 'tuz'); assert.ok(rr.ok); assert.equal(rr.state.turn, 0, 'opponent has nothing to lift: I keep playing'); assert.ok(!rr.steps.some((x) => x.t === 'family' && x.last));
{ const q = cloneState(m); q.pits.fill(0); q.pits[7] = 4; q.flag[7] = tuzFlag(1); q.pits[9] = 4; q.flag[9] = tuzFlag(1); q.pits[10] = 4; q.flag[10] = tuzFlag(0); q.pits[8] = 0; q.flag[8] = 0; q.pits[5] = 1; q.pits[13] = 30; q.turn = 0;
  rr = playMove(q, 5, 'tuz'); assert.ok(rr.ok); }
assert.ok(rr.steps.filter((x) => x.t === 'family' && x.last).length >= 3, 'every Tuz is paid to its owner when only Tuz remain');
console.log('ok solo play continues, then every Tuz is paid');

// 3b. landing on the OPPONENT's Tuz: +2 stones and play again; landing on your OWN Tuz: turn simply ends
let x0 = newGame('tuz', 0); x0.opening = false; x0.pits.fill(0); x0.pits[5] = 2; x0.pits[7] = 1; x0.pits[8] = 4; x0.flag[8] = tuzFlag(1); x0.pits[1] = 2; x0.pits[10] = 3; x0.pits[13] = 0;
const t0 = x0.pits.reduce((a, b) => a + b, 0);
const rx = playMove(x0, 5, 'tuz'); assert.ok(rx.ok);
assert.ok(rx.steps.some((q) => q.t === 'tuztake' && q.n === 3 && q.by === 0));
assert.equal(rx.state.pits[6], 3, 'two stones from the Tuz + my landing stone go to my pile'); assert.equal(rx.state.pits[8], 2, 'a Tuz of 4 is left with 2'); assert.equal(rx.state.flag[8], tuzFlag(1));
assert.equal(rx.state.turn, 0, 'I play again'); assert.equal(rx.state.pits.reduce((a, b) => a + b, 0), t0);
let y0 = newGame('tuz', 0); y0.opening = false; y0.pits.fill(0); y0.pits[11] = 1; y0.pits[0] = 3; y0.pits[12] = 0; y0.pits[7] = 3; y0.pits[8] = 4; y0.flag[8] = tuzFlag(1); y0.pits[10] = 2; y0.turn = 1; y0.pits[9] = 2;
y0.pits[7] = 0; y0.pits[10] = 0; y0.pits[9] = 0; y0.pits[11] = 0; y0.pits[12] = 0; y0.pits[0] = 3; y0.pits[1] = 3; y0.pits[2] = 1;
y0.pits[12] = 1; y0.pits[7] = 0; // seat1: hole 12 has 1 stone -> lands on hole 0 (not a Tuz); build the own-Tuz case below
let z = newGame('tuz', 0); z.opening = false; z.pits.fill(0); z.pits[12] = 0; z.pits[11] = 0; z.pits[7] = 1; z.pits[8] = 4; z.flag[8] = tuzFlag(1); z.pits[0] = 2; z.turn = 1;
const rz = playMove(z, 7, 'tuz'); assert.ok(rz.ok); assert.ok(!rz.steps.some((q) => q.t === 'tuztake'), 'own Tuz: nothing is taken');
assert.equal(rz.state.pits[8], 5); assert.equal(rz.state.turn, 0);
console.log('ok landing on opponent Tuz pays two and replays; own Tuz just ends the turn');

// 4. the computer plays Tuz: opening + a short game never throws and keeps 48 stones
let a = newGame('tuz', 1); let n = 0;
while (!a.over && n++ < 40) {
  const mv = chooseMove(a, 'tuz', 'easy', Math.random, { maxMs: 20 }); assert.ok(legalMoves(a).includes(mv));
  const x = playMove(a, mv, 'tuz', [], a.turn); assert.ok(x.ok); a = x.state; assert.ok(validState(a, true), 'stones conserved');
}
assert.ok(Number.isFinite(evaluate(a, 0)));
console.log('ok computer plays Tuz');

// 5. the opening is animated stone by stone and its steps reproduce the final board exactly
import { applyStep, applyFlag } from '../src/lib/gebeta/engine.js';
{ const g0 = newGame('tuz', 1); const r0 = playMove(g0, 9, 'tuz'); assert.ok(r0.ok);
  const p = g0.pits.slice(), f = g0.flag.slice(); r0.steps.forEach((st) => { applyStep(p, st); applyFlag(f, st); });
  assert.deepEqual(p, r0.state.pits); assert.deepEqual(f, r0.state.flag); assert.equal(r0.steps.filter((x) => x.t === 'sow').length, 7, 'the stone walks 7 holes from hole 9 to hole 3');
  assert.equal(g0.opening, true); assert.equal(r0.state.opening, false);
  console.log('ok the opening walk replays to the real board'); }
// 6. online: the room keeps `opening` so the server asks for the opening move
import gebetaMod from '../src/lib/online/gebeta.js';
{ const c = gebetaMod.create('tuz'); assert.equal(c.opening, true); assert.equal(gebetaMod.create('gebeta').opening, false);
  console.log('ok online rooms remember the Tuz opening'); }
// 7. online end to end: the server accepts the opening on an opponent hole, rejects one on an own hole, then play continues
{ const room0 = { ...gebetaMod.create('tuz'), ruleset: 'tuz', players: ['a', 'b'], turn: 0, starter: 0, moveSeq: 0, options: {} };
  const bad = gebetaMod.actions.move(room0, null, 0, { pit: 9 }, Date.now()); assert.ok(bad.error, 'an opponent hole is refused at the opening');
  const ok = gebetaMod.actions.move(room0, null, 0, { pit: 2 }, Date.now()); assert.ok(!ok.error, ok.error);
  assert.equal(ok.room.flag[10], tuzFlag(0)); assert.equal(ok.room.opening, false); assert.equal(ok.room.turn, 1);
  const nxt = gebetaMod.actions.move(ok.room, null, 1, { pit: 7 }, Date.now()); assert.ok(!nxt.error, nxt.error);
  console.log('ok online opening accepted by the server'); }

// 9. whole games: computer vs computer, both seats opening, never an illegal state, stones conserved, and only Tuz flags ever appear
{ for (const first of [0, 1]) for (let k = 0; k < 6; k++) {
    let q = newGame('tuz', first); let moves = 0;
    while (!q.over && moves++ < 400) {
      const mv = chooseMove(q, 'tuz', 'easy', Math.random, { maxMs: 8 }); assert.ok(legalMoves(q).includes(mv), 'AI plays a legal move');
      if (moves === 1) assert.ok(holesOf(q, q.turn).includes(mv), 'the opening is from the opener\'s OWN hole');
      const x = playMove(q, mv, 'tuz', [], -1); assert.ok(x.ok); q = x.state;
      assert.ok(validState(q, true)); assert.ok(q.flag.every((f) => f === 0 || f >= 4), 'nothing but a Tuz freezes');
    }
  }
  console.log('ok full computer games: legal, conserved, only Tuz freezes'); }
// 8. colours: the second seat sees their own stones in the player's chosen colour (side a); the opponent gets side b
import fs from 'node:fs';
{ const src = fs.readFileSync(new URL('../src/components/Board.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('viewSeat === 1 ? 1 - owner : owner'), 'Board swaps stone colours for seat 1'); console.log('ok own stones keep the chosen colour online'); }
