import assert from 'node:assert/strict';
import { newGame, playMove, legalMoves, initialBoard, perft, RULESETS, genMoves, counts, findMove, applyMoveToBoard, forfeit, nextSquares, movablePieces } from '../src/lib/checkers/engine.js';
import { chooseCheckersMove } from '../src/lib/checkers/ai.js';

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
t('capture is mandatory', () => {
  const b = empty(); b[sq(5, 2)] = 1; b[sq(4, 3)] = 3; b[sq(7, 0)] = 1;
  const ms = legalMoves(st(b), 'american'); assert.ok(ms.every((m) => m.caps.length === 1)); assert.equal(ms.length, 1);
});
t('multi-jump is a single move', () => {
  const b = empty(); b[sq(6, 1)] = 1; b[sq(5, 2)] = 3; b[sq(3, 4)] = 3;
  const ms = legalMoves(st(b), 'american'); assert.equal(ms.length, 1); assert.deepEqual(ms[0].path, [sq(4, 3), sq(2, 5)]);
  const r = playMove(st(b), sq(6, 1), [sq(4, 3), sq(2, 5)], 'american'); assert.ok(r.ok); assert.equal(r.captured, 2);
  assert.deepEqual(counts(r.state.board), [1, 0]); assert.equal(r.state.over, true); assert.equal(r.state.winner, 0);
});
t('partial multi-jump is illegal', () => {
  const b = empty(); b[sq(6, 1)] = 1; b[sq(5, 2)] = 3; b[sq(3, 4)] = 3; b[sq(0, 7)] = 3;
  assert.equal(playMove(st(b), sq(6, 1), [sq(4, 3)], 'american').ok, false);
});
t('men cannot move or capture backwards (american)', () => {
  const b = empty(); b[sq(4, 3)] = 1; b[sq(5, 4)] = 3; b[sq(0, 1)] = 3;
  const ms = legalMoves(st(b), 'american'); assert.ok(ms.every((m) => m.caps.length === 0));
  assert.ok(ms.every((m) => (m.to >> 3) < 4));
});
t('crowning ends the turn in american rules', () => {
  const b = empty(); b[sq(2, 3)] = 1; b[sq(1, 2)] = 3; b[sq(1, 4)] = 3; b[sq(7, 6)] = 3;
  const ms = legalMoves(st(b), 'american'); const m = ms.find((x) => x.to === sq(0, 1)); assert.ok(m); assert.equal(m.path.length, 1); assert.equal(m.promote, true);
  const r = playMove(st(b), sq(2, 3), [sq(0, 1)], 'american'); assert.equal(r.state.board[sq(0, 1)], 2);
});
t('king steps one square any direction (american) and captures backwards', () => {
  const b = empty(); b[sq(4, 3)] = 2; b[sq(5, 4)] = 3; b[sq(0, 1)] = 3;
  const ms = legalMoves(st(b), 'american'); assert.equal(ms.length, 1); assert.deepEqual(ms[0].path, [sq(6, 5)]);
  const b2 = empty(); b2[sq(4, 3)] = 2; b2[sq(0, 1)] = 3;
  assert.equal(legalMoves(st(b2), 'american').length, 4);
});
t('flying kings glide and capture from a distance', () => {
  const b = empty(); b[sq(7, 0)] = 2; b[sq(3, 4)] = 3; b[sq(0, 7)] = 3;
  const ms = legalMoves(st(b), 'flying'); assert.ok(ms.length >= 1 && ms.every((m) => m.caps[0] === sq(3, 4)));
  assert.deepEqual(ms.map((m) => m.to).sort((a, c) => a - c), [sq(2, 5), sq(1, 6)].sort((a, c) => a - c));
});
t('flying: must take the most pieces', () => {
  const b = empty(); b[sq(7, 0)] = 1; b[sq(5, 2)] = 3; b[sq(3, 4)] = 3; b[sq(7, 6)] = 1; b[sq(6, 5)] = 3; b[sq(3, 0)] = 3; b[sq(0, 7)] = 3;
  const ms = legalMoves(st(b), 'flying'); const most = Math.max(...ms.map((m) => m.caps.length));
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
  for (const rs of ['american', 'flying', 'dama']) for (let k = 0; k < 120; k++) {
    let g = newGame(rs), plies = 0;
    while (!g.over) { const ms = legalMoves(g, rs); assert.ok(ms.length > 0); const m = ms[Math.floor(Math.random() * ms.length)]; const r = playMove(g, m.from, m.path, rs); assert.ok(r.ok); g = r.state; if (++plies > 1500) assert.fail('no end'); }
  }
});
t('AI beats random', () => {
  for (const rs of ['american', 'flying', 'dama']) {
    let wins = 0, N = 8;
    for (let k = 0; k < N; k++) {
      let g = newGame(rs); const ai = k % 2; let plies = 0;
      while (!g.over && plies++ < 400) {
        let m; if (g.turn === ai) m = chooseCheckersMove(g, rs, 'easy'); else { const ms = legalMoves(g, rs); m = ms[Math.floor(Math.random() * ms.length)]; }
        g = playMove(g, m.from, m.path, rs).state;
      }
      if (g.winner === ai) wins++;
    }
    console.log('  AI(easy) wins', wins, '/', N, rs); assert.ok(wins >= 6);
  }
});
t('hard AI answers within its time budget', () => {
  const g = newGame(); const t0 = Date.now(); const m = chooseCheckersMove(g, 'american', 'hard'); const dt = Date.now() - t0;
  assert.ok(m && findMove(g, m.from, m.path)); assert.ok(dt < 1600, `took ${dt}ms`);
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

t('dama: 16 men a side on all 64 squares, orthogonal opening moves only', () => {
  const g = newGame('dama');
  assert.deepEqual(counts(g.board), [16, 16]);
  const ms = legalMoves(g, 'dama');
  assert.equal(ms.length, 8, 'only the front row can step: 8 forward moves');
  assert.ok(ms.every((m) => m.caps.length === 0 && (m.to >> 3) === 4 && (m.to & 7) === (m.from & 7)));
});
t('dama: men step forward or sideways, never backward', () => {
  const b = empty(); b[sq(4, 3)] = 1; b[sq(0, 7)] = 3; // dark man in the middle (dark moves up)
  const to = genMoves(b, 0, RULESETS.dama).map((m) => m.to).sort((a, c) => a - c);
  assert.deepEqual(to, [sq(3, 3), sq(4, 2), sq(4, 4)].sort((a, c) => a - c));
  assert.ok(!to.includes(sq(5, 3)), 'no step back');
});
t('dama: but a man may capture backward, sideways and forward', () => {
  const b = empty(); b[sq(4, 3)] = 1;
  b[sq(5, 3)] = 3; // enemy behind
  let ms = genMoves(b, 0, RULESETS.dama); assert.equal(ms.length, 1); assert.equal(ms[0].to, sq(6, 3)); assert.deepEqual(ms[0].caps, [sq(5, 3)]);
  const c = empty(); c[sq(4, 3)] = 1; c[sq(4, 4)] = 3; // enemy beside
  ms = genMoves(c, 0, RULESETS.dama); assert.equal(ms[0].to, sq(4, 5));
  const d = empty(); d[sq(4, 3)] = 1; d[sq(3, 3)] = 3; // enemy ahead
  ms = genMoves(d, 0, RULESETS.dama); assert.equal(ms[0].to, sq(2, 3));
  // diagonal neighbours are never captured
  const e = empty(); e[sq(4, 3)] = 1; e[sq(3, 4)] = 3; e[sq(0, 0)] = 3;
  assert.ok(genMoves(e, 0, RULESETS.dama).every((m) => m.caps.length === 0));
});
t('dama: king flies over empty squares and kills from far away in a straight line', () => {
  const b = empty(); b[sq(7, 0)] = 2; b[sq(7, 5)] = 3; b[sq(0, 7)] = 3; // dark king, enemy 5 squares along the row
  const ms = genMoves(b, 0, RULESETS.dama);
  assert.ok(ms.length >= 2 && ms.every((m) => m.caps.length === 1 && m.caps[0] === sq(7, 5)));
  assert.deepEqual(ms.map((m) => m.to).sort((a, c) => a - c), [sq(7, 6), sq(7, 7)]);
  // and it just glides when nothing can be taken
  const q = empty(); q[sq(7, 0)] = 2; q[sq(0, 7)] = 3;
  assert.equal(genMoves(q, 0, RULESETS.dama).length, 7 + 7);
});
t('dama: every piece chains kills, turning corners, and must take the most', () => {
  const b = empty(); b[sq(5, 1)] = 1;
  b[sq(5, 2)] = 3; b[sq(4, 3)] = 3; b[sq(3, 4)] = 0; b[sq(2, 3)] = 3; b[sq(0, 7)] = 3; b[sq(7, 7)] = 3;
  // man jumps (5,2)→lands (5,3); then up over (4,3)→(3,3); then up over (2,3)→(1,3)
  const ms = genMoves(b, 0, RULESETS.dama);
  assert.equal(ms.length, 1); assert.equal(ms[0].caps.length, 3); assert.equal(ms[0].to, sq(1, 3));
  assert.deepEqual(ms[0].path, [sq(5, 3), sq(3, 3), sq(1, 3)]);
  // the finished move is accepted by the engine and removes all three
  const r = playMove(st(b), sq(5, 1), ms[0].path, 'dama');
  assert.ok(r.ok); assert.equal(counts(r.state.board)[1], 2);
});
t('dama: a man that reaches the far row becomes a king', () => {
  const b = empty(); b[sq(1, 2)] = 1; b[sq(7, 7)] = 3;
  const m = genMoves(b, 0, RULESETS.dama).find((x) => x.to === sq(0, 2));
  assert.ok(m && m.promote);
  const r = playMove(st(b), sq(1, 2), [sq(0, 2)], 'dama');
  assert.equal(r.state.board[sq(0, 2)], 2);
});
console.log(n, 'checkers tests passed');
