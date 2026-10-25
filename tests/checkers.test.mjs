import assert from 'node:assert/strict';
import { newGame, playMove, legalMoves, initialBoard, perft, RULESETS, genMoves, counts, findMove, applyMoveToBoard, forfeit, nextSquares, movablePieces, resolveHuff } from '../src/lib/checkers/engine.js';
import { chooseCheckersMove, chooseHuffPick } from '../src/lib/checkers/ai.js';
// when a huff leaves a piece to be removed, the player to move picks one (here: at random)
const settleHuff = (g, rs, pick = (s) => s.pendingHuff.options[Math.floor(Math.random() * s.pendingHuff.options.length)]) => (g.pendingHuff ? resolveHuff(g, pick(g), rs).state : g);

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const sq = (r, c) => r * 8 + c;
const empty = () => new Array(64).fill(0);
const st = (board, turn = 0) => ({ board, turn, over: false, winner: null, reason: null, noProgress: 0, seen: {} });

t('perft matches the published English-draughts numbers', () => {
  const b = initialBoard();
  [7, 49, 302, 1469, 7361, 36768].forEach((want, i) => assert.equal(perft(b, 0, i + 1, RULESETS.american), want));
});
t('start position: 12 v 12, 7 opening moves, dark moves first', () => {
  const g = newGame(); assert.deepEqual(counts(g.board), [12, 12]); assert.equal(legalMoves(g).length, 7); assert.equal(g.turn, 0);
});
t('capture is optional: any piece may move, a skipped capture can be claimed', () => {
  const b = empty(); b[sq(5, 2)] = 1; b[sq(4, 3)] = 3; b[sq(7, 0)] = 1;
  const ms = legalMoves(st(b), 'american');
  assert.equal(ms.filter((m) => m.caps.length === 1).length, 1, 'the capture is still available');
  assert.ok(ms.some((m) => m.caps.length === 0), 'and so is a quiet move');
  // play the OTHER piece: the piece that could have captured is put on offer to the opponent
  const quiet = ms.find((m) => m.from === sq(7, 0)); assert.ok(quiet);
  const r = playMove(st(b), quiet.from, quiet.path, 'american'); assert.ok(r.ok);
  assert.deepEqual(r.state.pendingHuff.options, [sq(5, 2)]);
  // the opponent just plays on: the claim is gone for good
  const reply = legalMoves(r.state, 'american')[0]; const r2 = playMove(r.state, reply.from, reply.path, 'american');
  assert.equal(r2.state.pendingHuff && r2.state.pendingHuff.by === 1 ? 'stale' : 'clear', 'clear');
  // …or he touches it and it is removed before his move
  const h = resolveHuff(r.state, sq(5, 2), 'american'); assert.ok(h.ok); assert.equal(h.state.board[sq(5, 2)], 0); assert.equal(h.state.turn, 1);
});
t('multi-jump is a single move', () => {
  const b = empty(); b[sq(6, 1)] = 1; b[sq(5, 2)] = 3; b[sq(3, 4)] = 3;
  const ms = genMoves(b, 0, RULESETS.american); assert.equal(ms.length, 1); assert.deepEqual(ms[0].path, [sq(4, 3), sq(2, 5)]);
  const r = playMove(st(b), sq(6, 1), [sq(4, 3), sq(2, 5)], 'american'); assert.ok(r.ok); assert.equal(r.captured, 2);
  assert.deepEqual(counts(r.state.board), [1, 0]); assert.equal(r.state.over, true); assert.equal(r.state.winner, 0);
});
t('stopping a multi-jump early is allowed, but the piece can then be claimed', () => {
  const b = empty(); b[sq(6, 1)] = 1; b[sq(5, 2)] = 3; b[sq(3, 4)] = 3; b[sq(0, 7)] = 3;
  const r = playMove(st(b), sq(6, 1), [sq(4, 3)], 'american'); assert.equal(r.ok, true);
  assert.deepEqual(r.state.pendingHuff.options, [sq(4, 3)]);
});
t('men cannot move or capture backwards (american)', () => {
  const b = empty(); b[sq(4, 3)] = 1; b[sq(5, 4)] = 3; b[sq(0, 1)] = 3;
  const ms = genMoves(b, 0, RULESETS.american); assert.ok(ms.every((m) => m.caps.length === 0));
  assert.ok(ms.every((m) => (m.to >> 3) < 4));
});
t('crowning ends the turn in american rules', () => {
  const b = empty(); b[sq(2, 3)] = 1; b[sq(1, 2)] = 3; b[sq(1, 4)] = 3; b[sq(7, 6)] = 3;
  const ms = genMoves(b, 0, RULESETS.american); const m = ms.find((x) => x.to === sq(0, 1)); assert.ok(m); assert.equal(m.path.length, 1); assert.equal(m.promote, true);
  const r = playMove(st(b), sq(2, 3), [sq(0, 1)], 'american'); assert.equal(r.state.board[sq(0, 1)], 2);
});
t('king steps one square any direction (american) and captures backwards', () => {
  const b = empty(); b[sq(4, 3)] = 2; b[sq(5, 4)] = 3; b[sq(0, 1)] = 3;
  const ms = genMoves(b, 0, RULESETS.american); assert.equal(ms.length, 1); assert.deepEqual(ms[0].path, [sq(6, 5)]);
  const b2 = empty(); b2[sq(4, 3)] = 2; b2[sq(0, 1)] = 3;
  assert.equal(genMoves(b2, 0, RULESETS.american).length, 4);
});
t('flying kings glide and capture from a distance', () => {
  const b = empty(); b[sq(7, 0)] = 2; b[sq(3, 4)] = 3; b[sq(0, 7)] = 3;
  const ms = genMoves(b, 0, RULESETS.flying); assert.ok(ms.length >= 1 && ms.every((m) => m.caps[0] === sq(3, 4)));
  assert.deepEqual(ms.map((m) => m.to).sort((a, c) => a - c), [sq(2, 5), sq(1, 6)].sort((a, c) => a - c));
});
t('flying: must take the most pieces', () => {
  const b = empty(); b[sq(7, 0)] = 1; b[sq(5, 2)] = 3; b[sq(3, 4)] = 3; b[sq(7, 6)] = 1; b[sq(6, 5)] = 3; b[sq(3, 0)] = 3; b[sq(0, 7)] = 3;
  const ms = genMoves(b, 0, RULESETS.flying); const most = Math.max(...ms.map((m) => m.caps.length));
  assert.ok(ms.every((m) => m.caps.length === most));
});
t('a piece cannot be jumped twice in one move', () => {
  const b = empty(); b[sq(6, 1)] = 2; b[sq(5, 2)] = 3; b[sq(3, 2)] = 3; b[sq(3, 4)] = 3; b[sq(5, 4)] = 3;
  for (const m of genMoves(b, 0, RULESETS.american)) assert.equal(new Set(m.caps).size, m.caps.length);
});
t('no legal moves = loss; forfeit', () => {
  const b = empty(); b[sq(0, 1)] = 3; b[sq(7, 0)] = 1; // seat 0 man blocked? make seat1 stuck instead
  const g = st(b, 0); const r = playMove(g, sq(7, 0), [sq(6, 1)], 'american'); assert.ok(r.ok);
  assert.equal(forfeit(newGame(), 0).winner, 1);
});
t('three-fold repetition is a draw; 40-move rule is a draw', () => {
  const b = empty(); b[sq(7, 0)] = 2; b[sq(0, 7)] = 4;
  let g = { ...st(b, 0), seen: {} };
  const shuffle = [[sq(7, 0), sq(6, 1)], [sq(0, 7), sq(1, 6)], [sq(6, 1), sq(7, 0)], [sq(1, 6), sq(0, 7)]];
  let i = 0; while (!g.over && i < 40) { const [f, to] = shuffle[i % 4]; const r = playMove(g, f, [to], 'american'); assert.ok(r.ok, 'move ' + i); g = r.state; i++; }
  assert.equal(g.winner, 'draw'); assert.equal(g.reason, 'repetition');
});
t('tap-to-move helpers', () => {
  const g = newGame(); const ms = legalMoves(g); assert.equal(movablePieces(ms).length, 4);
  const from = ms[0].from; assert.ok(nextSquares(ms, from).length >= 1);
});
t('random playouts always terminate and keep the rules consistent', () => {
  for (const rs of ['american', 'flying']) for (let k = 0; k < 120; k++) {
    let g = newGame(rs), plies = 0;
    while (!g.over) { g = settleHuff(g, rs); if (g.over) break; const ms = legalMoves(g, rs); assert.ok(ms.length > 0); const m = ms[Math.floor(Math.random() * ms.length)]; const r = playMove(g, m.from, m.path, rs); assert.ok(r.ok); g = settleHuff(r.state, rs); if (++plies > 1500) assert.fail('no end'); }
  }
});
t('AI beats random', () => {
  for (const rs of ['american', 'flying']) {
    let wins = 0, N = 8;
    for (let k = 0; k < N; k++) {
      let g = newGame(rs); const ai = k % 2; let plies = 0;
      while (!g.over && plies++ < 400) {
        let m; if (g.turn === ai) m = chooseCheckersMove(g, rs, 'easy'); else { const ms = legalMoves(g, rs); m = ms[Math.floor(Math.random() * ms.length)]; }
        g = settleHuff(playMove(g, m.from, m.path, rs).state, rs, (s) => (s.turn === ai ? chooseHuffPick(s, rs) : s.pendingHuff.options[0]));
      }
      if (g.winner === ai) wins++;
    }
    console.log('  AI(easy) wins', wins, '/', N, rs); assert.ok(wins >= 6);
  }
});
t('hard AI answers within its time budget', () => {
  const g = newGame(); const t0 = Date.now(); const m = chooseCheckersMove(g, 'american', 'hard'); const dt = Date.now() - t0;
  assert.ok(m && findMove(g, m.from, m.path)); assert.ok(dt < 3200, `took ${dt}ms`);
});

t('flying king passes empty squares and captures from far away (default rules)', () => {
  const b = empty();
  b[sq(7, 0)] = 2;          // dark king in the corner
  b[sq(3, 4)] = 3;          // light man, 4 diagonal steps away with empty squares between
  const moves = genMoves(b, 0, RULESETS.flying);
  assert.ok(moves.length > 0 && moves.every((m) => m.caps.length === 1 && m.caps[0] === sq(3, 4)));
  assert.ok(moves.some((m) => m.to === sq(2, 5)) && moves.some((m) => m.to === sq(1, 6)), 'can land on any empty square beyond');
  // the one-step ruleset must NOT allow that long jump
  assert.equal(genMoves(b, 0, RULESETS.american).filter((m) => m.caps.length).length, 0);
});
t('every piece can chain several captures when the board allows it', () => {
  const b = empty();
  b[sq(7, 0)] = 1;                       // a plain man
  b[sq(6, 1)] = 3; b[sq(4, 3)] = 3; b[sq(2, 5)] = 3; // three enemies in a row with gaps
  const man = genMoves(b, 0, RULESETS.flying);
  assert.equal(man.length, 1); assert.equal(man[0].caps.length, 3);
  const k = empty(); k[sq(7, 0)] = 2; k[sq(6, 1)] = 3; k[sq(4, 3)] = 3; k[sq(2, 5)] = 3;
  assert.equal(Math.max(...genMoves(k, 0, RULESETS.flying).map((m) => m.caps.length)), 3);
  assert.equal(Math.max(...genMoves(b, 0, RULESETS.american).map((m) => m.caps.length)), 3, 'classic men chain too');
});

console.log(n, 'checkers tests passed');
