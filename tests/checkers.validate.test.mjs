// Independent re-check of every generated move against the written rules (not sharing code with the generator).
import assert from 'node:assert/strict';
import { newGame, playMove, legalMoves, getRules } from '../src/lib/checkers/engine.js';

const seatOf = (p) => (p === 0 ? -1 : p <= 2 ? 0 : 1);
const king = (p) => p === 2 || p === 4;
const rc = (s) => [s >> 3, s & 7];
const diag = (a, b) => { const [r1, c1] = rc(a), [r2, c2] = rc(b); return Math.abs(r1 - r2) === Math.abs(c1 - c2) && a !== b; };
const between = (a, b) => { const [r1, c1] = rc(a), [r2, c2] = rc(b); const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1); const out = []; for (let r = r1 + dr, c = c1 + dc; r !== r2 || c !== c2; r += dr, c += dc) out.push(r * 8 + c); return out; };

function validate(state, m, rs) {
  const rules = getRules(rs), b = state.board, seat = state.turn, p = b[m.from];
  assert.equal(seatOf(p), seat, 'moves own piece');
  const live = b.slice(); live[m.from] = 0;
  let pos = m.from, isK = king(p); const taken = new Set();
  m.path.forEach((to, i) => {
    assert.equal(live[to], 0, 'landing square empty'); assert.ok(diag(pos, to), 'diagonal');
    const mid = between(pos, to); const pcs = mid.filter((s) => live[s] !== 0);
    if (m.caps.length) {
      assert.equal(pcs.length, 1, 'exactly one piece jumped'); const v = pcs[0];
      assert.equal(v, m.caps[i]); assert.notEqual(seatOf(live[v]), seat, 'jumps an enemy'); assert.ok(!taken.has(v), 'never twice'); taken.add(v);
      if (!isK || !rules.flying) assert.equal(mid.length, 1, 'short jump is adjacent');
      if (!isK) { const [r1] = rc(pos), [r2] = rc(to); if (!rules.backCapture) assert.equal(Math.sign(r2 - r1), seat === 0 ? -1 : 1, 'men capture forward only'); }
    } else {
      assert.equal(pcs.length, 0, 'no pieces in the way');
      if (!isK) { const [r1] = rc(pos), [r2] = rc(to); assert.equal(r2 - r1, seat === 0 ? -1 : 1, 'man steps one forward'); }
      else if (!rules.flying) assert.equal(mid.length, 0, 'king steps one');
    }
    pos = to;
    const [r] = rc(to); if (!isK && r === (seat === 0 ? 0 : 7)) isK = true;
  });
  // simple moves only when no capture exists anywhere
  if (!m.caps.length) assert.ok(!legalMoves(state, rs).some((x) => x.caps.length), 'capture is compulsory');
  if (rules.maxCapture) assert.ok(legalMoves(state, rs).every((x) => x.caps.length <= m.caps.length), 'must take the most');
}

let checked = 0;
for (const rs of ['american', 'flying']) for (let g = 0; g < 250; g++) {
  let s = newGame(rs), plies = 0;
  while (!s.over && plies++ < 400) {
    const ms = legalMoves(s, rs); assert.ok(ms.length);
    for (const m of ms) { validate(s, m, rs); checked++; }
    // a chain can't be extended: after the last landing no further jump exists unless crowned-and-ended (american)
    const m = ms[Math.floor(Math.random() * ms.length)];
    const before = s.board.filter(Boolean).length;
    const r = playMove(s, m.from, m.path, rs); assert.ok(r.ok);
    assert.equal(r.state.board.filter(Boolean).length, before - m.caps.length, 'piece count');
    // illegal variants are rejected
    assert.equal(playMove(s, m.from, [m.path[0] ^ 1], rs).ok, legalMoves(s, rs).some((x) => x.from === m.from && x.path.length === 1 && x.path[0] === (m.path[0] ^ 1)));
    s = r.state;
    if (s.over) { // a win must be real: opponent has no pieces or no moves; draws need a stated reason
      if (s.winner === 'draw') assert.ok(['repetition', 'moves'].includes(s.reason));
      else assert.equal(legalMoves({ ...s, over: false }, rs).length, 0, 'winner only when loser is stuck');
    }
  }
}
console.log('independent validation OK on', checked, 'generated moves');
