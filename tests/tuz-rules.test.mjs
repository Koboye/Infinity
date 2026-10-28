// ጡዝ rules guarantees (v32). Run: node tests/tuz-rules.test.mjs
//  1. nobody ever makes a Tuz on his own holes (opening included) — checked over many full random games
//  2. the only freeze is the Tuz: no ripe / shared marker ever appears, and a four is an ordinary hole
//  3. touching a four lifts and plays it; there is nothing to "collect" (engine + server)
//  4. both seats open from their OWN holes with the alternating 3/5 two-lap chain; the Tuz forms in an opponent hole
import assert from 'node:assert/strict';
import { cloneState, newGame, playMove, legalMoves, collect, collectable, holesOf, tuzFlag, validState, ownerOf, RING } from '../src/lib/gebeta/engine.js';
import { chooseMove } from '../src/lib/gebeta/ai.js';
import gebetaMod from '../src/lib/online/gebeta.js';

// tiny seeded RNG so a failure can be replayed
const rngOf = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// 4. both seats open from their OWN hole; the Tuz forms in the opponent's hole across (never on the opener's own hole)
for (const first of [0, 1]) {
  const g = newGame('tuz', first);
  const legal = legalMoves(g);
  assert.deepEqual(legal, holesOf(g, first), `seat ${first} opens from his own holes`);
  for (const other of holesOf(g, 1 - first)) assert.equal(playMove(g, other, 'tuz').ok, false, `seat ${first} cannot open from the opponent's hole ${other}`);
  for (const h of legal) {
    const r = playMove(g, h, 'tuz'); assert.ok(r.ok, `opening from ${h}`);
    // expected Tuz from the rule: the 3-holes are every second hole from the start; the first one that is not the opener's
    const k0 = RING.indexOf(h); let tgt = -1;
    for (let k = k0; tgt < 0 && k < k0 + 12; k += 2) if (ownerOf(RING[k % 12], g.own) !== first) tgt = RING[k % 12];
    assert.equal(r.state.flag[tgt], tuzFlag(first)); assert.equal(r.state.pits[tgt], 4);
    assert.equal(r.state.flag.filter((x) => x).length, 1, 'exactly one Tuz after the opening');
    assert.notEqual(ownerOf(tgt, r.state.own), first, 'the Tuz is in the OPPONENT\'s hole');
    assert.equal(r.state.pits[6] + r.state.pits[13], 0, 'no stone goes to a pile: all 48 stay on the board');
    assert.equal(r.state.turn, 1 - first); assert.ok(validState(r.state, true));
    assert.equal(r.steps.filter((x) => x.t === 'tuz').length, 1);
  }
}
console.log('ok both seats open from every own hole; the first opponent 3-hole becomes the Tuz');

// 1 + 2. full random games: a Tuz is never in its maker's own hole, nothing but a Tuz freezes, stones are conserved
let tuzMade = 0, games = 0;
for (let seed = 1; seed <= 60; seed++) {
  const rng = rngOf(seed);
  let s = newGame('tuz', seed % 2), n = 0;
  games++;
  while (!s.over && n++ < 600) {
    const moves = legalMoves(s);
    assert.ok(moves.length > 0, 'a player to move always has a move');
    const m = moves[Math.floor(rng() * moves.length)];
    const r = playMove(s, m, 'tuz', [], -1); assert.ok(r.ok, `legal move ${m} accepted`);
    for (const st of r.steps) {
      if (st.t === 'tuz') {
        tuzMade++;
        assert.notEqual(ownerOf(st.i, s.own), st.by, `seed ${seed}: a Tuz on the maker's own hole ${st.i}`);
      }
      assert.ok(!['ripe', 'share', 'family'].includes(st.t) || st.last, `seed ${seed}: step ${st.t} must not exist in ጡዝ (only the end-of-round payout is a 'family' step)`);
    }
    s = r.state;
    assert.ok(validState(s, true), 'stones conserved');
    for (const i of RING) {
      const f = s.flag[i];
      assert.ok(f === 0 || f >= 4, `seed ${seed}: only a Tuz may freeze (flag ${f} on ${i})`);
      if (f === 4 || f === 5) assert.notEqual(ownerOf(i, s.own), f - 4, `seed ${seed}: Tuz of seat ${f - 4} sits in its own hole ${i}`);
    }
    for (const seat of [0, 1]) assert.deepEqual(collectable(s, seat), [], 'nothing is ever waiting to be collected');
  }
}
assert.ok(tuzMade > 60, `the random games made plenty of Tuz (${tuzMade})`);
console.log(`ok ${games} random games: ${tuzMade} Tuz made, never on the maker's own hole, nothing else ever froze`);

// 2b. a four made mid-sowing, or by the last stone in the mover's OWN hole, is an ordinary liftable hole
{
  const q = newGame('tuz', 0); q.opening = false; q.pits.fill(0);
  q.pits[0] = 2; q.pits[1] = 3;          // sowing hole 0 drops 1 in hole 1 (3 -> 4, mid-sowing) and ends in hole 2
  q.pits[2] = 0; q.pits[12] = 5; q.pits[7] = 5;
  const r = playMove(q, 0, 'tuz'); assert.ok(r.ok);
  assert.equal(r.state.flag[1], 0, 'a four made mid-sowing carries no marker');
  const f = r.state; f.turn = 0;
  assert.equal(f.pits[1], 4);
  assert.ok(legalMoves(f).includes(1), 'the four can be lifted like any other hole');
  const lift = playMove(f, 1, 'tuz'); assert.ok(lift.ok, 'touching the four plays it');
  assert.equal(lift.state.pits[6], 0, 'nothing was collected into the pile');
  assert.ok(!lift.steps.some((x) => x.t === 'family' && !x.last), 'no collect step');
}
{ // my last stone makes a four in MY OWN hole: ordinary
  const q = newGame('tuz', 0); q.opening = false; q.pits.fill(0); q.pits[0] = 1; q.pits[1] = 3; q.pits[12] = 4; q.pits[7] = 4;
  const r = playMove(q, 0, 'tuz'); assert.ok(r.ok);
  assert.equal(r.state.flag[1], 0); assert.equal(r.steps.some((x) => x.t === 'tuz' || x.t === 'ripe'), false);
}
console.log('ok a four outside the Tuz rule is a normal hole');

// 3. nothing to collect: the engine refuses, and the server refuses a collect in a ጡዝ room
{
  const q = newGame('tuz', 0); q.opening = false; q.pits.fill(0); q.pits[1] = 4; q.pits[7] = 4; q.pits[8] = 4;
  assert.equal(collect(q, 1, 0).ok, false, 'collect finds nothing in ጡዝ');
  const room = { ...gebetaMod.create('tuz'), ruleset: 'tuz', players: ['a', 'b'], turn: 0, starter: 0, moveSeq: 0, status: 'playing', options: {} };
  room.opening = false; room.pits = q.pits; room.own = q.own; room.flag = q.flag;
  const res = gebetaMod.actions.collect(room, null, 0, { pit: 1 }, Date.now());
  assert.ok(res.error, 'the server rejects a collect in ጡዝ');
}
console.log('ok nothing is collectable in ጡዝ');

// the computer plays both openings with every level
for (const level of ['easy', 'medium', 'hard']) for (const first of [0, 1]) {
  const g = newGame('tuz', first);
  const mv = chooseMove(g, 'tuz', level, Math.random, { maxMs: 30 });
  assert.ok(holesOf(g, first).includes(mv), `${level}: the computer opens from its own side`);
}
console.log('ok the computer opens on the right side at every level');
