// ጡዝ — "a Tuz stays its owner's until the round ends" (strict). Run: node tests/tuz-sticky.test.mjs
// Over hundreds of full random games (moves chosen at random, so raids, empty Tuz holes and passing stones all happen):
//  1. a Tuz (flag 4 = seat 0, 5 = seat 1) is NEVER cleared, moved, re-owned or lifted during a round — only a new deal clears it
//  2. that holds even when the Tuz has been raided EMPTY, and when stones pass through or land in it
//  3. no step ever picks / relays from a Tuz hole
//  4. replaying the steps with the animator's applyStep / applyFlag gives exactly the engine's flags and pits (what the screen shows)
//  5. when the round ends, every Tuz stone is paid to its owner
import assert from 'node:assert/strict';
import { newGame, playMove, legalMoves, applyStep, applyFlag, validState, RING } from '../src/lib/gebeta/engine.js';

const rngOf = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const isTuz = (f) => f === 4 || f === 5;

let games = 0, moves = 0, raidedEmpty = 0, passedEmpty = 0, landedEmpty = 0, rounds = 0, paid = 0;
for (let seed = 1; seed <= 400; seed++) {
  const rng = rngOf(seed * 7919);
  let s = newGame('tuz', seed % 2), n = 0; games++;
  while (!s.over && n++ < 700) {
    const legal = legalMoves(s); assert.ok(legal.length > 0, 'a player to move always has a move');
    const m = legal[Math.floor(rng() * legal.length)];
    const r = playMove(s, m, 'tuz', [], -1); assert.ok(r.ok); moves++;
    const ns = r.state;

    // (3) nothing is ever lifted out of a Tuz hole
    for (const st of r.steps) if ((st.t === 'pick' || st.t === 'relay') && isTuz(s.flag[st.i])) assert.fail(`seed ${seed}: a Tuz hole ${st.i} was lifted`);

    // (4) the animator's replay equals the engine
    const pits = s.pits.slice(), flag = s.flag.slice();
    for (const st of r.steps) { applyStep(pits, st); applyFlag(flag, st); }
    assert.deepEqual(flag, ns.flag, `seed ${seed}: animator flags differ from the engine's`);
    assert.deepEqual(pits, ns.pits, `seed ${seed}: animator pits differ from the engine's`);

    if (r.newRound || ns.over) {
      // (5) the round ended: every stone that sat in a Tuz went to its owner's pile, the board is dealt fresh
      rounds++;
      for (const i of RING) if (isTuz(s.flag[i])) {
        const by = s.flag[i] - 4;
        for (const st of r.steps.filter((x) => x.t === 'family' && x.i === i && x.last)) { assert.equal(st.by, by, `seed ${seed}: a Tuz was paid to the wrong player`); assert.equal(st.store, by === 0 ? 6 : 13); paid++; }
      }
    }
    if (!(r.newRound || ns.over)) {
      // (1) + (2) every Tuz that existed before the move is still there, same hole, same owner — empty or not
      for (const i of RING) if (isTuz(s.flag[i])) {
        assert.equal(ns.flag[i], s.flag[i], `seed ${seed} move ${n}: Tuz on hole ${i} changed (${s.flag[i]} → ${ns.flag[i]}, stones ${s.pits[i]} → ${ns.pits[i]})`);
        if (ns.pits[i] === 0) raidedEmpty++;
        if (s.pits[i] === 0 && r.steps.some((x) => x.t === 'sow' && x.i === i)) { if (r.steps.filter((x) => x.t === 'sow' && x.i === i).length) passedEmpty++; if (ns.pits[i] > 0) landedEmpty++; }
      }
      // a Tuz hole always stays unliftable
      for (const i of RING) if (isTuz(ns.flag[i])) assert.equal(legalMoves(ns, 0).includes(i) || legalMoves(ns, 1).includes(i), false, 'a Tuz is never a legal move');
    }
    assert.ok(validState(ns, true), 'stones conserved');
    s = ns;
  }
}
assert.ok(raidedEmpty > 0, 'the random games must exercise EMPTY Tuz holes');
assert.ok(landedEmpty > 0, 'the random games must exercise stones dropping into an EMPTY Tuz');
console.log(`ok a Tuz is never cleared, moved or lifted mid-round — ${games} games, ${moves} moves, ${rounds} rounds, ${paid} Tuz paid to owners`);
console.log(`ok emptied Tuz holes stayed theirs: seen empty after ${raidedEmpty} moves, stones dropped into an empty Tuz ${landedEmpty}×, passing/landing ${passedEmpty}×`);
