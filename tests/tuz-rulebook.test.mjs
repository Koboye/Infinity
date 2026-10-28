// One test per rule of the ጡዝ rulebook. Run: node tests/tuz-rulebook.test.mjs
import assert from 'node:assert/strict';
import { cloneState, newGame, playMove, legalMoves, tuzFlag, validState } from '../src/lib/gebeta/engine.js';
const base = (turn = 0) => { const q = newGame('tuz', turn); q.opening = false; q.pits.fill(0); q.flag.fill(0); q.turn = turn; return q; };
const total = (s) => s.pits.reduce((a, b) => a + b, 0);

// 1. Landing on your OWN Tuz: no capture, frozen stones stay, turn ends, opponent moves
{ const q = base(0); q.pits[8] = 4; q.flag[8] = tuzFlag(0); q.pits[5] = 2; q.pits[0] = 2; q.pits[12] = 5;
  const r = playMove(q, 5, 'tuz'); assert.ok(r.ok);
  assert.ok(!r.steps.some((x) => x.t === 'tuztake'), 'nothing captured'); assert.equal(r.state.pits[6], 0);
  assert.equal(r.state.pits[8], 5, 'frozen stones remain (my stone is simply dropped in)'); assert.equal(r.state.flag[8], tuzFlag(0));
  assert.equal(r.state.turn, 1, 'turn ends'); assert.equal(total(r.state), total(q)); }
console.log('ok 1 landing on your own Tuz');

// 3. Capture: last stone on the OPPONENT's Tuz -> exactly two stones, rest stays frozen, play again
{ const q = base(0); q.pits[3] = 4; q.flag[3] = tuzFlag(1); q.pits[1] = 2; q.pits[0] = 2; q.pits[12] = 5; // seat 1's Tuz sits in seat 0's hole 3
  const r = playMove(q, 1, 'tuz'); assert.ok(r.ok);
  assert.equal(r.state.pits[6], 2, 'exactly two stones captured'); assert.equal(r.state.pits[3], 3, 'remaining stones stay frozen (4 + my stone - 2)');
  assert.equal(r.state.flag[3], tuzFlag(1)); assert.equal(r.state.turn, 0, 'another turn'); assert.equal(total(r.state), total(q)); }
console.log('ok 3 capturing two from the opponent\'s Tuz');

// 2. Emptied Tuz: it STAYS its owner's until the round ends, however it was emptied
{ let q = base(0); q.pits[3] = 1; q.flag[3] = tuzFlag(1); q.pits[1] = 2; q.pits[0] = 2; q.pits[12] = 5; // a Tuz of 1 (after earlier attacks)
  let r = playMove(q, 1, 'tuz'); assert.ok(r.ok); assert.equal(r.state.pits[3], 0, 'emptied'); assert.equal(r.state.pits[6], 2); assert.equal(r.state.flag[3], tuzFlag(1), 'still its owner\'s Tuz');
  assert.equal(legalMoves(r.state).includes(3), false, 'an empty Tuz cannot be lifted');
  // a stone merely passing through does NOT turn it into an ordinary hole
  const a = cloneState(r.state); a.pits.fill(0); a.pits[1] = 3; a.pits[12] = 5; a.turn = 0; a.pits[6] = 0;
  const d = playMove(a, 1, 'tuz'); assert.ok(d.ok);
  assert.equal(d.state.flag[3], tuzFlag(1), 'the passing stone did not cancel the Tuz'); assert.equal(d.state.pits[3], 1, 'it received the stone');
  // the opponent's LAST stone on it raids it again; it is still the owner's afterwards
  const g = cloneState(r.state); g.pits.fill(0); g.pits[2] = 1; g.pits[0] = 3; g.pits[12] = 5; g.turn = 0; g.pits[6] = 0;
  const h = playMove(g, 2, 'tuz'); assert.ok(h.ok); assert.equal(h.state.pits[3], 0); assert.equal(h.state.pits[6], 1); assert.equal(h.state.flag[3], tuzFlag(1), 'raided empty again, still the owner\'s'); }
console.log('ok 2 emptied Tuz');

// 4. Ownership: nobody can lift a frozen Tuz (owner or opponent); each Tuz has an owner
{ const q = base(0); q.pits[9] = 4; q.flag[9] = tuzFlag(0); q.pits[3] = 4; q.flag[3] = tuzFlag(1); q.pits[0] = 1; q.pits[11] = 1;
  assert.deepEqual(legalMoves(q, 0), [0]); assert.deepEqual(legalMoves(q, 1), [11]);
  assert.equal(playMove(q, 3, 'tuz').ok, false, 'the opponent\'s Tuz in my hole cannot be lifted by me');
  const q2 = cloneState(q); q2.turn = 1; assert.equal(playMove(q2, 9, 'tuz').ok, false, 'a Tuz cannot be lifted by the player whose hole it is in'); }
console.log('ok 4 frozen Tuz cannot be moved');

// 5/7. Making a Tuz: last stone in an OPPONENT hole holding exactly three -> frozen, mine, turn ends; again and again
{ let q = base(0); q.pits[5] = 2; q.pits[8] = 3; q.pits[0] = 2; q.pits[12] = 5;
  let r = playMove(q, 5, 'tuz'); assert.ok(r.ok); assert.equal(r.state.pits[8], 4); assert.equal(r.state.flag[8], tuzFlag(0)); assert.equal(r.state.turn, 1);
  let s2 = cloneState(r.state); s2.turn = 0; s2.pits[4] = 3; s2.pits[10] = 3; s2.pits[11] = 0; // 3 stones: 5,7,8 would pass the Tuz; use 2 stones to reach hole 10? build: hole 3 with 2 stones lands on 4 — keep simple below
  const w = base(0); w.pits[5] = 1; w.pits[7] = 3; w.pits[9] = 3; w.pits[4] = 3; w.pits[0] = 2; w.pits[12] = 5;
  const a = playMove(w, 5, 'tuz'); assert.equal(a.state.flag[7], tuzFlag(0)); const w2 = cloneState(a.state); w2.turn = 0; w2.pits[4] = 5; // hole 4: 5 stones -> 5,7(Tuz),8,9,10: last on 10
  w2.pits[9] = 2; w2.pits[10] = 3; w2.pits[8] = 0; w2.pits[4] = 5; const b = playMove(w2, 4, 'tuz'); assert.ok(b.ok);
  assert.equal(b.state.flag[10], tuzFlag(0), 'a second Tuz'); assert.equal(b.state.flag[7], tuzFlag(0), 'the first one is still mine'); assert.ok(validState(b.state)); }
// …exactly three only: a hole with 2 or 4 is not a Tuz; my OWN hole holding three is never a Tuz
{ const q = base(0); q.pits[5] = 2; q.pits[8] = 2; q.pits[0] = 2; q.pits[12] = 5; assert.equal(playMove(q, 5, 'tuz').state.flag[8], 0);
  const o = base(0); o.pits[0] = 1; o.pits[1] = 3; o.pits[12] = 5; o.pits[7] = 4; const ro = playMove(o, 0, 'tuz'); assert.equal(ro.state.flag[1], 0, 'own hole 3 -> 4 is a normal hole'); }
console.log('ok 5/7 creating (multiple) Tuz');

// 6. Turn ends when the last stone lands in an empty hole: nothing captured, opponent moves
{ const q = base(0); q.pits[0] = 1; q.pits[3] = 0; q.pits[1] = 0; q.pits[12] = 5; q.pits[2] = 3; // 0 -> hole 1 (empty)
  const r = playMove(q, 0, 'tuz'); assert.ok(r.ok); assert.equal(r.state.turn, 1); assert.equal(r.state.pits[6], 0); assert.equal(r.state.pits[1], 1); assert.ok(!r.steps.some((x) => x.t === 'tuz' || x.t === 'tuztake')); }
console.log('ok 6 last stone in an empty hole ends the turn');

// 8. Every round starts like the game: after a deal the new opener must play the Tuz opening from one of HIS OWN holes
{ import('../src/lib/gebeta/engine.js').then((G) => {
    let rounds = 0;
    for (let g = 0; g < 30; g++) {
      let s = G.newGame('tuz', g % 2), n = 0;
      while (!s.over && n++ < 1500) {
        const m = G.legalMoves(s); assert.ok(m.length, 'a player to move always has a legal move');
        const pick = m[Math.floor(Math.random() * m.length)];
        if (s.opening) assert.ok(m.every((i) => G.ownerOf(i, s.own) === s.turn), 'opening only from the opener\'s own holes');
        const r = G.playMove(s, pick, 'tuz'); assert.ok(r.ok, r.error);
        if (r.newRound) { rounds++; assert.equal(r.state.opening, G.legalMoves({ ...r.state, opening: true }).length > 0, 'a new round starts with the opening whenever one is possible'); assert.ok(r.state.flag.every((f) => f === 0)); }
        assert.ok(G.validState(r.state, true)); s = r.state;
      }
    }
    assert.ok(rounds > 50, 'enough rounds were exercised');
    console.log(`ok 8 every round opens (${rounds} new rounds over 30 random games, a legal move at every turn, 48 stones kept)`);
  }); }

// 9. Regression (v36): an opening may never leave the opponent with nothing to lift (that dead-locked the game).
//    Lopsided deal: seat 0 owns ONE hole (5). Seat 1 would Tuz exactly that hole by opening from 7 — so that opening is illegal.
{ import('../src/lib/gebeta/engine.js').then((G) => {
    const s = { pits: [4,4,4,4,4,4,0,4,4,4,4,4,4,0], own: [1,1,1,1,1,0,0,1,1,1,1,1,1,1], flag: new Array(14).fill(0), turn: 1, starter: 1, over: false, winner: null, opening: true };
    assert.deepEqual(G.legalMoves(s), [], 'no opening that freezes the opponent\'s only hole');
    const t = { ...s, own: [1,1,1,1,0,0,0,1,1,1,1,1,1,1], turn: 1 }; // seat 0 owns holes 4 and 5: opening from 7 (Tuz on 5) leaves hole 4 playable
    assert.ok(G.legalMoves(t).length > 0, 'an opening that leaves the opponent a move stays legal');
    for (const m of G.legalMoves(t)) { const r = G.playMove(t, m, 'tuz'); assert.ok(r.ok); assert.ok(r.extraTurn === false && G.legalMoves(r.state).length > 0, 'the opponent can always move after a legal opening'); }
    console.log('ok 9 an opening never leaves the opponent without a move');
  }); }
