import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { randomInt } from '../src/lib/fairRandom.js';
import {
  BOARDS, newGame, seatsFor, applyRoll, applyMove, legalMoves, previewMove, absOf, isSafeAbs, finishOf, lastRingRel,
  chooseToken, rollDie, validState, distinctMoves,
} from '../src/lib/ludo/engine.js';

// ── 1. geometry: the 3-player triangle (and the square) is perfectly symmetric = fair ──
for (const [name, B] of Object.entries(BOARDS)) {
  const gap = B.ringLen / B.seatCount;
  assert.ok(Number.isInteger(gap), name + ' ring splits evenly');
  B.seatStart.forEach((st, k) => assert.equal(st, B.seatStart[0] + k * gap, name + ' seats equally spaced'));
  const safe = new Set(B.seatStart.flatMap((st) => B.safeOffsets.map((o) => (st + o) % B.ringLen)));
  for (const sh of [gap]) for (const c of safe) assert.ok(safe.has((c + sh) % B.ringLen), name + ' safe cells repeat every seat');
  // every seat walks the same number of cells to reach home
  const F = finishOf(name); assert.equal(F, B.ringLen + 4);
}
assert.equal(BOARDS.triangle.seatCount, 3); assert.equal(BOARDS.triangle.ringLen, 54);
assert.deepEqual(seatsFor(2).seats, [0, 2]); assert.deepEqual(seatsFor(3).seats, [0, 1, 2]); assert.equal(seatsFor(3).board, 'triangle');
console.log('ok boards are symmetric (fair triangle, classic square)');

// ── 2. the die is uniform ──
{ const c = new Uint32Array(1); const next = () => { webcrypto.getRandomValues(c); return c[0]; };
  const N = 60000, cnt = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < N; i++) { const v = rollDie(next); assert.ok(v >= 1 && v <= 6); cnt[v - 1]++; }
  const exp = N / 6, chi = cnt.reduce((a, x) => a + (x - exp) ** 2 / exp, 0);
  assert.ok(chi < 20.5, 'chi-square ' + chi.toFixed(2) + ' (df 5, p≈0.001)'); // fails by chance ~0.1 %
  // exactness of the rejection sampling: a stream that would be biased under "% 6" is re-drawn
  const lim = 4294967296 - (4294967296 % 6); const seq = [lim, lim + 1, 5]; let k = 0; assert.equal(randomInt(6, () => seq[k++]), 5); assert.equal(k, 3);
  console.log('ok die is fair', cnt.join(',')); }

// ── 3. rules ──
const mk = (o = {}) => ({ ...newGame({ players: o.players || 4, tokens: 4 }), ...o });
{ // needs a 6 to leave base
  let s = mk(); let r = applyRoll(s, 3); assert.equal(r.none, true); assert.equal(r.state.turn, 1);
  r = applyRoll(mk(), 6); assert.deepEqual(r.moves, [0, 1, 2, 3]);
  const m = applyMove(r.state, 0); assert.equal(m.state.pos[0][0], 0); assert.equal(m.state.turn, 0, 'a six gives another roll'); assert.equal(m.bonus, true);
  console.log('ok six to leave base, six = roll again'); }
{ // three sixes forfeit
  let s = mk(); s.pos[0] = [0, -1, -1, -1];
  for (let k = 0; k < 2; k++) { s = applyRoll(s, 6).state; s = applyMove(s, 0).state; assert.equal(s.turn, 0); }
  const r = applyRoll(s, 6); assert.equal(r.forfeited, true); assert.equal(r.state.turn, 1); assert.equal(r.state.pos[0][0], 12, 'the third six is not played');
  console.log('ok three sixes in a row lose the turn'); }
{ // exact roll to reach home
  const s = mk(); s.pos[0] = [54, -1, -1, -1]; s.phase = 'roll';
  assert.equal(applyRoll(s, 3).none, true, '54+3 overshoots 56');
  let r = applyRoll(s, 2); assert.deepEqual(r.moves, [0]); const m = applyMove(r.state, 0); assert.equal(m.state.pos[0][0], 56); assert.equal(m.finishes, true); assert.equal(m.state.turn, 0, 'reaching home = bonus');
  console.log('ok exact roll to finish, home = bonus'); }
{ // capture, bonus; safe cell protects; a block of two protects
  let s = mk(); s.pos[0] = [3, -1, -1, -1]; s.pos[1] = [-1, -1, -1, -1];
  const a = absOf(s, 0, 5); // target ring cell
  // seat 1 start = 13; make player1 token sit on abs a: rel = a-13
  s.pos[1][0] = (a - 13 + 52) % 52; s.phase = 'roll';
  assert.ok(!isSafeAbs(s, a));
  let r = applyRoll(s, 2); let m = applyMove(r.state, 0); assert.equal(m.state.pos[1][0], -1, 'captured'); assert.equal(m.captured.length, 1); assert.equal(m.state.turn, 0, 'capture = bonus');
  s.pos[1][1] = s.pos[1][0]; // a block of two
  r = applyRoll(s, 2); m = applyMove(r.state, 0); assert.equal(m.captured.length, 0, 'a block cannot be captured'); assert.equal(m.state.turn, 1);
  // safe cell (star): seat 0 start+8 = abs 8
  const t = mk(); t.pos[0] = [5, -1, -1, -1]; t.pos[1] = [(8 - 13 + 52) % 52, -1, -1, -1]; assert.ok(isSafeAbs(t, 8));
  r = applyRoll(t, 3); m = applyMove(r.state, 0); assert.equal(m.captured.length, 0, 'no capture on a star'); assert.equal(m.state.pos[1][0], 47);
  console.log('ok capture / block / safe star'); }
{ // home column is untouchable and own start cell safe
  const s = mk(); s.pos[0] = [49, -1, -1, -1]; s.pos[1] = [0, -1, -1, -1]; // p1 on its own start
  const pv = previewMove({ ...s, dice: 4 }, 0, 0, 4); assert.equal(pv.to, 53); assert.equal(pv.captured.length, 0);
  console.log('ok home column'); }
{ // triangle: same rules, 3 seats
  const s = newGame({ players: 3 }); assert.equal(s.board, 'triangle'); assert.equal(finishOf('triangle'), 58); assert.equal(lastRingRel('triangle'), 52);
  const abs = [0, 1, 2].map((p) => absOf(s, p, 0)); assert.deepEqual(abs, [9, 27, 45]);
  console.log('ok triangle 3 players'); }

// ── 4. whole random games, every board, both token counts ──
function play(players, tokens, levels, rng, maxMoves = 20000) {
  let s = newGame({ players, tokens, start: Math.floor(rng() * players) }), steps = 0;
  const seenFinish = new Set();
  while (!s.over && steps++ < maxMoves) {
    const r = applyRoll(s, 1 + Math.floor(rng() * 6)); s = r.state; assert.ok(validState(s));
    if (r.none || r.forfeited) continue;
    const i = chooseToken(s, levels[s.turn % levels.length], rng); assert.ok(legalMoves(s).includes(i));
    const m = applyMove(s, i); assert.ok(m.ok); s = m.state; assert.ok(validState(s));
    // never two different players on one unsafe ring cell unless one side has a block
  }
  assert.ok(s.over, 'game ended'); assert.equal(s.ranks.length, players); assert.equal(new Set(s.ranks).size, players);
  assert.ok(s.pos[s.ranks[0]].every((x) => x === finishOf(s.board)));
  return s;
}
for (const players of [2, 3, 4]) for (const tokens of [2, 4]) for (let g = 0; g < 60; g++) play(players, tokens, ['easy', 'medium', 'hard'], Math.random);
console.log('ok random full games 2/3/4 players × 2/4 tokens finish with valid ranks');

// ── 5. fairness of seats on the triangle (and strength order of the levels) ──
{ const wins = [0, 0, 0], N = 6000; for (let g = 0; g < N; g++) wins[play(3, 4, ['medium'], Math.random).ranks[0]]++;
  wins.forEach((w) => assert.ok(Math.abs(w / N - 1 / 3) < 0.035, 'triangle seat share ' + wins.join('/')));
  console.log('ok triangle seats win evenly', wins.map((w) => Math.round(100 * w / N) + '%').join(' / ')); }
{ let hardWins = 0, N = 1500;
  for (let g = 0; g < N; g++) { const first = g % 2; const s = play(2, 4, first ? ['hard', 'easy'] : ['easy', 'hard'], Math.random); if (s.ranks[0] === (first ? 0 : 1)) hardWins++; }
  assert.ok(hardWins / N > 0.55, 'hard beats easy: ' + hardWins / N); console.log('ok hard beats easy', Math.round(100 * hardWins / N) + '%'); }
console.log('ludo tests passed');

// ── 6. drawing geometry ──
import { ringXY, homeXY, tokenXY, TRI } from '../src/lib/ludo/layout.js';
{ // classic board: ring steps are one square (4 diagonal corner turns)
  let diag = 0;
  for (let i = 0; i < 52; i++) { const a = ringXY('square', i), b = ringXY('square', (i + 1) % 52), d = Math.hypot(a.x - b.x, a.y - b.y);
    if (Math.abs(d - 1) < 1e-9) continue; assert.ok(Math.abs(d - Math.SQRT2) < 1e-9, 'square ring step ' + i); diag++; } // the 4 corners around the centre block turn diagonally, as on a real board
  assert.equal(diag, 4);
  // triangle: rotating any cell by 120° about the centre lands on the cell 18 further on — the board is truly 3-fold symmetric
  for (let i = 0; i < 54; i++) {
    const a = ringXY('triangle', i), b = ringXY('triangle', (i + 18) % 54), th = 2 * Math.PI / 3;
    const dx = a.x - TRI.cx, dy = a.y - TRI.cy, rx = TRI.cx + dx * Math.cos(th) - dy * Math.sin(th), ry = TRI.cy + dx * Math.sin(th) + dy * Math.cos(th);
    assert.ok(Math.hypot(rx - b.x, ry - b.y) < 1e-9, 'triangle rotation ' + i);
  }
  const gaps = Array.from({ length: 54 }, (_, i) => { const a = ringXY('triangle', i), b = ringXY('triangle', (i + 1) % 54); return Math.hypot(a.x - b.x, a.y - b.y); });
  assert.ok(Math.max(...gaps) - Math.min(...gaps) < 1e-9 && Math.min(...gaps) > 4, 'ring spacing is exactly even, corners included');
  // every seat's home column and base are the same distance from the centre
  const dist = (p) => Math.hypot(p.x - TRI.cx, p.y - TRI.cy);
  for (let m = 1; m <= 5; m++) assert.ok(Math.abs(dist(homeXY('triangle', 0, m)) - dist(homeXY('triangle', 1, m))) < 1e-9 && Math.abs(dist(homeXY('triangle', 1, m)) - dist(homeXY('triangle', 2, m))) < 1e-9);
  assert.ok(Math.abs(dist(tokenXY('triangle', 0, -1, 0)) - dist(tokenXY('triangle', 2, -1, 0))) < 1e-9);
  // the square's home column leads into the middle
  assert.deepEqual(homeXY('square', 0, 5), { x: 5.5, y: 7.5 });
  console.log('ok board drawing is exact (square steps = 1, triangle rotates onto itself)'); }
console.log('ludo layout tests passed');

// ── 7. v38 system upgrade: stats, move log, previews, hint, save / restore ──
import { previewAll, hintMove, progressOf, serializeGame, restoreGame } from '../src/lib/ludo/engine.js';
{ // stats count rolls, sixes, captures and losses; the log records every move
  let s = newGame({ players: 4, tokens: 4 });
  s = applyRoll(s, 6).state; assert.equal(s.stats.rolls[0], 1); assert.equal(s.stats.sixes[0], 1);
  s = applyMove(s, 0).state; assert.equal(s.log.length, 1); assert.deepEqual([s.log[0].p, s.log[0].dice, s.log[0].out], [0, 6, true]);
  const t = mk(); t.pos[0] = [3, -1, -1, -1]; t.pos[1] = [(absOf(t, 0, 5) - 13 + 52) % 52, -1, -1, -1]; t.phase = 'roll';
  const m = applyMove(applyRoll(t, 2).state, 0); assert.equal(m.state.stats.captures[0], 1); assert.equal(m.state.stats.lost[1], 1); assert.equal(m.state.log.at(-1).cap, 1);
  assert.equal(newGame({ players: 4 }).stats.rolls.length, 4);
  // the engine never mutates the state it is given
  const frozen = JSON.stringify(t); applyRoll(t, 2); assert.equal(JSON.stringify(t), frozen);
  console.log('ok stats + move log'); }
{ // previewAll describes each legal move
  const s = mk(); s.pos[0] = [3, 10, -1, -1]; s.dice = 4; s.phase = 'move';
  const pv = previewAll(s); assert.deepEqual(pv.map((x) => x.i), [0, 1]); assert.deepEqual(pv.map((x) => x.to), [7, 14]);
  const star = mk(); star.pos[0] = [4, -1, -1, -1]; star.dice = 4; star.phase = 'move'; assert.equal(previewAll(star)[0].safe, true, 'rel 8 is a star');
  const blk = mk(); blk.pos[0] = [3, 7, -1, -1]; blk.dice = 4; blk.phase = 'move'; assert.equal(previewAll(blk).find((x) => x.i === 0).block, true);
  assert.deepEqual(previewAll(mk()), [], 'nothing to preview before a roll');
  console.log('ok move previews'); }
{ // the hint is a legal move, prefers a capture, and is stable
  const t = mk(); t.pos[0] = [3, 20, -1, -1]; t.pos[1] = [(absOf(t, 0, 5) - 13 + 52) % 52, -1, -1, -1]; t.phase = 'move'; t.dice = 2;
  assert.equal(hintMove(t), 0, 'hint takes the capture'); assert.equal(hintMove(t), hintMove(t));
  assert.equal(hintMove(mk()), null);
  for (let g = 0; g < 200; g++) { let s = newGame({ players: 4 }), k = 0; while (!s.over && k++ < 3000) { s = applyRoll(s, 1 + Math.floor(Math.random() * 6)).state; if (s.phase === 'move') { assert.ok(legalMoves(s).includes(hintMove(s))); s = applyMove(s, hintMove(s)).state; } } }
  console.log('ok hint'); }
{ // progress runs 0 → 1
  const s = newGame({ players: 2 }); assert.equal(progressOf(s, 0), 0);
  s.pos[0] = [56, 56, 56, 56]; assert.equal(progressOf(s, 0), 1);
  console.log('ok progress'); }
{ // save / restore round trip and rejection of garbage
  let s = newGame({ players: 3, tokens: 2 }); s = applyRoll(s, 6).state;
  const back = restoreGame(serializeGame(s), { players: 3, tokens: 2 });
  assert.deepEqual(back.pos, s.pos); assert.equal(back.turn, s.turn); assert.equal(back.phase, 'move'); assert.equal(back.dice, 6); assert.deepEqual(back.stats, s.stats);
  assert.ok(applyMove(back, 0).ok, 'a restored game keeps playing');
  assert.equal(restoreGame(serializeGame(s), { players: 4 }), null, 'a different player count is not resumed');
  assert.equal(restoreGame(serializeGame(s), { tokens: 4 }), null, 'a different token count is not resumed');
  for (const bad of ['', 'nope', '{}', '{"v":1}', JSON.stringify({ ...JSON.parse(serializeGame(s)), pos: [[99, 0], [0, 0], [0, 0]] }),
    JSON.stringify({ ...JSON.parse(serializeGame(s)), turn: 9 }), JSON.stringify({ ...JSON.parse(serializeGame(s)), phase: 'move', dice: 0 }),
    JSON.stringify({ ...JSON.parse(serializeGame(s)), board: 'square' }), null, 42]) assert.equal(restoreGame(bad), null, 'rejects ' + String(bad).slice(0, 30));
  const fin = newGame({ players: 2 }); fin.over = true; assert.equal(restoreGame(serializeGame(fin)), null, 'a finished game is not resumed');
  console.log('ok save / restore'); }
console.log('ludo v38 system tests passed');
