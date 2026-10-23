// Checkers (draughts) rules engine — pure functions, no UI, no Firebase.
// Shared by the browser (practice, animation) and the server (authoritative online moves).
//
// Board: 8×8, index = row*8 + col, row 0 at the top. Only dark squares ((row+col) odd) are used.
// Seat 0 ("Dark", moves first) starts on rows 5-7 and moves UP the board (row decreasing).
// Seat 1 ("Light") starts on rows 0-2 and moves DOWN the board.
// Piece codes: 0 empty · 1 seat-0 man · 2 seat-0 king · 3 seat-1 man · 4 seat-1 king.

export const SIZE = 8;

export const RULESETS = {
  // English / American checkers: men move + capture forward, kings step one square,
  // capturing is mandatory, a man that is crowned ends its turn.
  american: { id: 'american', backCapture: false, flying: false, maxCapture: false, promoteEnds: true, drawPlies: 80 },
  // Brazilian-style: men also capture backwards, kings fly any distance, you must take the most pieces.
  flying: { id: 'flying', backCapture: true, flying: true, maxCapture: true, promoteEnds: false, drawPlies: 40 },
};
export const getRules = (id) => RULESETS[id] || RULESETS.american;

export const seatOf = (p) => (p === 0 ? -1 : p <= 2 ? 0 : 1);
export const isKing = (p) => p === 2 || p === 4;
export const manOf = (seat) => (seat === 0 ? 1 : 3);
export const kingOf = (seat) => (seat === 0 ? 2 : 4);
export const rowOf = (sq) => sq >> 3;
export const colOf = (sq) => sq & 7;
export const isDark = (sq) => ((sq >> 3) + (sq & 7)) % 2 === 1;
const promoRow = (seat) => (seat === 0 ? 0 : 7);
const fwd = (seat) => (seat === 0 ? -1 : 1);
const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

export function initialBoard() {
  const b = new Array(64).fill(0);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if ((r + c) % 2 !== 1) continue;
    if (r <= 2) b[r * 8 + c] = 3;
    else if (r >= 5) b[r * 8 + c] = 1;
  }
  return b;
}

export function positionKey(board, turn) {
  let s = '';
  for (let i = 0; i < 64; i++) {
    if (!isDark(i)) continue;
    const p = board[i];
    s += p === 0 ? '_' : p === 1 ? 'b' : p === 2 ? 'B' : p === 3 ? 'w' : 'W';
  }
  return s + turn;
}

export function newGame(rulesetId = 'american') {
  const board = initialBoard();
  return { board, turn: 0, over: false, winner: null, reason: null, noProgress: 0, seen: { [positionKey(board, 0)]: 1 } };
}

export const cloneState = (s) => ({ ...s, board: s.board.slice(), seen: { ...(s.seen || {}) } });

export function counts(board) {
  const c = [0, 0];
  for (const p of board) if (p) c[seatOf(p)] += 1;
  return c;
}

/** Jumps available to a piece standing on `pos` (board `b` has the moving piece lifted off). */
function jumps(b, pos, king, seat, taken, rules) {
  const out = [];
  const pr = rowOf(pos), pc = colOf(pos);
  for (const [dr, dc] of DIRS) {
    if (!king && !rules.backCapture && dr !== fwd(seat)) continue;
    let r = pr + dr, c = pc + dc;
    if (king && rules.flying) { while (inside(r, c) && b[r * 8 + c] === 0) { r += dr; c += dc; } }
    if (!inside(r, c)) continue;
    const vsq = r * 8 + c, v = b[vsq];
    if (v === 0 || seatOf(v) === seat || taken.has(vsq)) continue;
    const lands = [];
    let lr = r + dr, lc = c + dc;
    while (inside(lr, lc) && b[lr * 8 + lc] === 0) {
      lands.push(lr * 8 + lc);
      if (!(king && rules.flying)) break;
      lr += dr; lc += dc;
    }
    if (lands.length) out.push({ victim: vsq, lands });
  }
  return out;
}

function captureSequences(board, from, rules, out) {
  const piece = board[from], seat = seatOf(piece), startKing = isKing(piece);
  const b = board.slice(); b[from] = 0;
  const taken = new Set();
  const crowns = (land, king) => !king && rowOf(land) === promoRow(seat);

  // Does a piece landing on `land` (after capturing `victim`) have to / get to keep jumping?
  const continues = (land, king, victim) => {
    const k2 = king || (crowns(land, king) && !rules.promoteEnds);
    if (!king && crowns(land, king) && rules.promoteEnds) return false; // crowning ends the turn
    taken.add(victim);
    const more = jumps(b, land, k2, seat, taken, rules).length > 0;
    taken.delete(victim);
    return more;
  };

  const walk = (pos, king, path, caps) => {
    for (const j of jumps(b, pos, king, seat, taken, rules)) {
      const cont = j.lands.filter((l) => continues(l, king, j.victim));
      const use = cont.length ? cont : j.lands; // if any landing lets you go on, you must pick one of those
      for (const l of use) {
        const nPath = [...path, l], nCaps = [...caps, j.victim];
        const becomesKing = crowns(l, king);
        const nowKing = king || (becomesKing);
        if (cont.length) {
          taken.add(j.victim);
          walk(l, becomesKing && rules.promoteEnds ? false : nowKing, nPath, nCaps);
          taken.delete(j.victim);
        } else {
          out.push({ from, to: l, path: nPath, caps: nCaps, promote: !startKing && nowKing });
        }
      }
    }
  };
  walk(from, startKing, [], []);
}

/** All legal moves for `seat`. Capturing is mandatory. */
export function genMoves(board, seat, rules) {
  const caps = [];
  for (let sq = 0; sq < 64; sq++) if (seatOf(board[sq]) === seat) captureSequences(board, sq, rules, caps);
  if (caps.length) {
    if (rules.maxCapture) {
      const most = Math.max(...caps.map((m) => m.caps.length));
      return caps.filter((m) => m.caps.length === most);
    }
    return caps;
  }
  const moves = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (seatOf(p) !== seat) continue;
    const king = isKing(p);
    const r0 = rowOf(sq), c0 = colOf(sq);
    for (const [dr, dc] of DIRS) {
      if (!king && dr !== fwd(seat)) continue;
      let r = r0 + dr, c = c0 + dc;
      while (inside(r, c) && board[r * 8 + c] === 0) {
        const to = r * 8 + c;
        moves.push({ from: sq, to, path: [to], caps: [], promote: !king && r === promoRow(seat) });
        if (!(king && rules.flying)) break;
        r += dr; c += dc;
      }
    }
  }
  return moves;
}

export function legalMoves(state, rulesetId = 'american') {
  if (state.over) return [];
  return genMoves(state.board, state.turn, getRules(rulesetId));
}

/** Apply a (legal) move to a board, returning the new board. */
export function applyMoveToBoard(board, move) {
  const b = board.slice();
  const p = b[move.from];
  b[move.from] = 0;
  for (const c of move.caps) b[c] = 0;
  b[move.to] = move.promote ? kingOf(seatOf(p)) : p;
  return b;
}

export function findMove(state, from, path, rulesetId = 'american') {
  if (!Number.isInteger(from) || !Array.isArray(path) || !path.length || path.length > 24) return null;
  for (const m of legalMoves(state, rulesetId)) {
    if (m.from === from && m.path.length === path.length && m.path.every((s, i) => s === path[i])) return m;
  }
  return null;
}

/** Hops for the animator: [{from, to, cap}] */
export const hopsOf = (move) => move.path.map((to, i) => ({ from: i ? move.path[i - 1] : move.from, to, cap: move.caps[i] ?? null }));

/**
 * Play a move given as `{from, path}`. Returns { ok, state, move, hops, captured, promoted, error }.
 */
export function playMove(state, from, path, rulesetId = 'american') {
  const rules = getRules(rulesetId);
  if (state.over) return { ok: false, error: 'Game is over' };
  const move = findMove(state, from, path, rulesetId);
  if (!move) return { ok: false, error: 'Illegal move' };
  const seat = state.turn;
  const moving = state.board[from];
  const next = cloneState(state);
  next.board = applyMoveToBoard(state.board, move);
  next.turn = 1 - seat;

  const irreversible = move.caps.length > 0 || !isKing(moving);
  next.noProgress = irreversible ? 0 : state.noProgress + 1;
  if (irreversible) next.seen = {};
  const key = positionKey(next.board, next.turn);
  next.seen[key] = (next.seen[key] || 0) + 1;

  if (genMoves(next.board, next.turn, rules).length === 0) {
    next.over = true; next.winner = seat; next.reason = 'blocked';
  } else if (next.seen[key] >= 3) {
    next.over = true; next.winner = 'draw'; next.reason = 'repetition';
  } else if (next.noProgress >= rules.drawPlies) {
    next.over = true; next.winner = 'draw'; next.reason = 'moves';
  }
  return { ok: true, state: next, move, hops: hopsOf(move), captured: move.caps.length, promoted: move.promote };
}

export function forfeit(state, loserSeat, reason = 'forfeit') {
  const s = cloneState(state);
  s.over = true; s.winner = 1 - loserSeat; s.reason = reason;
  return s;
}

export function drawByAgreement(state) {
  const s = cloneState(state);
  s.over = true; s.winner = 'draw'; s.reason = 'agreed';
  return s;
}

export function validState(s) {
  return !!s && Array.isArray(s.board) && s.board.length === 64 && s.board.every((n) => Number.isInteger(n) && n >= 0 && n <= 4)
    && (s.turn === 0 || s.turn === 1);
}

/** Squares you can start from, and for a chosen start, the next landing squares (for tap-to-move UIs). */
export function movablePieces(moves) { return [...new Set(moves.map((m) => m.from))]; }
export function nextSquares(moves, from, picked = []) {
  const out = new Set();
  for (const m of moves) {
    if (m.from !== from || m.path.length <= picked.length) continue;
    if (picked.every((s, i) => m.path[i] === s)) out.add(m.path[picked.length]);
  }
  return [...out];
}
export function perft(board, seat, depth, rules) {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of genMoves(board, seat, rules)) n += perft(applyMoveToBoard(board, m), 1 - seat, depth - 1, rules);
  return n;
}
