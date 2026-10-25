import assert from 'node:assert/strict';
import { newRoomDoc, seatSecondPlayer, applyRoomAction } from '../src/lib/online/rooms.js';

const prof = (n) => ({ displayName: n, avatar: 'lion' });
const mkRoom = (ruleset, options) => {
  const doc = newRoomDoc({ game: 'gebeta', uid: 'A', profile: prof('A'), ruleset, options, isPublic: false, now: 0 });
  return seatSecondPlayer(doc, { uid: 'B', profile: prof('B') }, () => 0.9, 1000).room;
};
// the mode is accepted online and kept
const r = mkRoom('ashagro');
assert.equal(r.ruleset, 'ashagro'); assert.equal(r.status, 'playing'); assert.equal(r.turn, r.starter);
assert.equal(r.opener, r.players[r.starter]);
// a stone-capture happens on the server too
const room = { ...r, pits: [1, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0], flag: new Array(14).fill(0), turn: 0, starter: 0 };
const res = applyRoomAction(room, null, room.players[0], 'move', { pit: 0 }, 2000);
assert.ok(!res.error, res.error);
assert.equal(res.room.lastMove.steps.some((s) => s.t === 'capture'), true);
assert.equal(res.room.pits[6], 4);
// first game: the coin decides; rematch: the player who did NOT open the previous game opens (X, Y, X, Y …)
const mkWith = (coin, options = {}) => { const d = newRoomDoc({ game: 'gebeta', uid: 'A', profile: prof('A'), ruleset: 'ashagro', options, isPublic: false, now: 0 }); return seatSecondPlayer(d, { uid: 'B', profile: prof('B') }, () => coin, 1000).room; };
assert.equal(mkWith(0.9).turn, 0); assert.equal(mkWith(0.1).turn, 1);
const again = mkRoom('ashagro', { avoid: r.opener });
assert.equal(again.players[again.turn] === r.opener, false, 'the other player opens the rematch');
const third = mkRoom('ashagro', { avoid: again.opener });
assert.equal(third.players[third.turn] === again.opener, false, 'and it keeps alternating');
// checkers alternates the same way
{
  const mkC = (options) => { const d = newRoomDoc({ game: 'checkers', uid: 'A', profile: prof('A'), ruleset: 'flying', options, isPublic: false, now: 0 }); return seatSecondPlayer(d, { uid: 'B', profile: prof('B') }, () => 0.9, 1000).room; };
  const g1 = mkC({}), g2 = mkC({ avoid: g1.opener });
  assert.equal(g2.players[g2.turn] === g1.opener, false, 'Checkers: the other player opens game two');
  assert.equal(g2.opener, g2.players[g2.turn]);
}
assert.equal(mkRoom('gebeta', { avoid: 'nobody' }).turn, 0);
console.log('ashagro online tests passed');

// ── no freezing, capture only by stopping in your own hole ──
import { newGame, playMove, legalMoves } from '../src/lib/gebeta/engine.js';
const mk = (pits, turn = 0) => ({ ...newGame('ashagro', turn), pits });
{
  // stop in my own empty hole (2), the hole across (10) is the opponent's and has 5 → take 5 + my last stone
  const r = playMove(mk([2, 0, 0, 0, 0, 0, 0, 0, 3, 0, 5, 0, 0, 0]), 0, 'ashagro');
  const cap = r.steps.find((x) => x.t === 'capture');
  assert.ok(cap && cap.i === 2 && cap.j === 10 && cap.n === 6, 'captures the opposite hole plus the last stone');
  assert.equal(r.state.pits[6], 6); assert.equal(r.state.pits[2], 0); assert.equal(r.state.pits[10], 0); assert.equal(r.state.turn, 1);
}
{
  // my last stone stops in the OPPONENT'S hole: nothing is collected
  const r = playMove(mk([0, 1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0]), 5, 'ashagro'); assert.ok(r.ok, r.error);
  assert.ok(!r.steps.some((x) => x.t === 'capture')); assert.equal(r.state.pits[6], 0); assert.equal(r.state.pits[8], 1);
}
{
  // a hole that reaches four is just a hole: no ripe, no shared, no family — it is lifted and sowing carries on
  const r = playMove(mk([1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0]), 0, 'ashagro');
  assert.ok(r.steps.some((x) => x.t === 'relay')); assert.ok(!r.steps.some((x) => ['ripe', 'share', 'family'].includes(x.t)));
  assert.ok(r.state.flag.every((f) => f === 0));
}
{
  // whole random games never create a ripe / shared (frozen) hole or a family
  for (let k = 0; k < 30; k++) {
    let g = newGame('ashagro', k & 1), n = 0;
    while (!g.over && n++ < 4000) {
      const m = legalMoves(g); const r = playMove(g, m[Math.floor(Math.random() * m.length)], 'ashagro');
      assert.ok(!r.steps.some((x) => ['ripe', 'share'].includes(x.t) || (x.t === 'family' && !x.last)));
      assert.ok(r.state.flag.every((f) => f === 0)); g = r.state;
    }
  }
}
console.log('ashagro rules tests passed (no freezing, capture only by stopping in your own hole)');

{
  // last stone in my own empty hole 2, hole across (10) is empty → I keep my own single stone
  const r = playMove(mk([2, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0]), 0, 'ashagro'); assert.ok(r.ok, r.error);
  const b = r.steps.find((x) => x.t === 'bank');
  assert.ok(b && b.i === 2 && b.n === 1, 'own stone is picked up'); assert.equal(r.state.pits[6], 1); assert.equal(r.state.pits[2], 0); assert.equal(r.state.turn, 1);
}
console.log('ashagro bank rule passed');
