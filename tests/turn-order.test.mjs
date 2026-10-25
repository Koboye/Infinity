// Turn order is sacred: players alternate, nobody skips, nobody moves the other side's pieces/holes, nobody moves twice.
import assert from 'node:assert/strict';
import * as ck from '../src/lib/checkers/engine.js';
import * as gb from '../src/lib/gebeta/engine.js';

// ---- draughts (all three rule sets)
let cMoves = 0;
for (const rs of ['flying', 'american']) for (let g = 0; g < 25; g++) {
  let s = ck.newGame(rs), n = 0;
  while (!s.over && n++ < 250) {
    const mine = ck.legalMoves(s, rs); assert.ok(mine.length);
    // 1. the side NOT to move can never move a piece
    const other = ck.legalMoves({ ...s, turn: 1 - s.turn, pendingHuff: null }, rs);
    for (const m of other.slice(0, 6)) { const bad = ck.playMove(s, m.from, m.path, rs); assert.equal(bad.ok && !mine.some((x) => x.from === m.from && x.path.join() === m.path.join()), false, 'moved the opponent\'s piece'); }
    // 2. a legal move hands the turn to the opponent — exactly once
    const m = mine[Math.floor(Math.random() * mine.length)];
    const r = ck.playMove(s, m.from, m.path, rs); assert.ok(r.ok); cMoves++;
    if (!r.state.over) assert.equal(r.state.turn, 1 - s.turn, 'turn alternates');
    // 3. an unclaimed offer never gives anybody an extra move: the same move cannot be replayed on the new state by the old mover
    if (!r.state.over) assert.equal(ck.playMove(r.state, m.from, m.path, rs).ok && ck.seatOf(r.state.board[m.to]) === s.turn && r.state.turn === s.turn, false);
    // a huff claim is made by the player to move, and does not use up his move
    s = r.state;
    if (s.pendingHuff && Math.random() < 0.5) { const h = ck.resolveHuff(s, s.pendingHuff.options[0], rs); assert.ok(h.ok); assert.equal(h.state.turn, s.turn, 'claiming does not skip his move'); s = h.state; }
  }
}
console.log(`ok draughts: ${cMoves} moves, strict alternation, no moves for the other side`);

// ---- gebeta / አሻግሮ
let gMoves = 0;
for (const rs of ['gebeta', 'ashagro']) for (let g = 0; g < 40; g++) {
  let s = gb.newGame(rs, g & 1), n = 0;
  while (!s.over && n++ < 400) {
    const mine = gb.legalMoves(s);
    for (let i = 0; i < 13; i++) if (!mine.includes(i)) { const bad = gb.playMove(s, i, rs); assert.equal(bad.ok, false, `illegal hole ${i} accepted`); }
    const m = mine[Math.floor(Math.random() * mine.length)];
    const r = gb.playMove(s, m, rs); assert.ok(r.ok); gMoves++;
    if (!r.state.over && !r.newRound) assert.equal(r.state.turn, 1 - s.turn, 'turn alternates');
    s = r.state;
  }
}
console.log(`ok gebeta: ${gMoves} moves, only the mover's own holes are playable`);
console.log('turn-order tests passed');
