// Checkers (draughts) rules engine — pure functions, no UI, no Firebase.
// Shared by the browser (practice, animation) and the server (authoritative online moves).
//
// Board: 8×8, index = row*8 + col, row 0 at the top. Only dark squares ((row+col) odd) are used.
// Seat 0 ("Dark", moves first) starts on rows 5-7 and moves UP the board (row decreasing).
// Seat 1 ("Light") starts on rows 0-2 and moves DOWN the board.
// Piece codes: 0 empty · 1 seat-0 man · 2 seat-0 king · 3 seat-1 man · 4 seat-1 king.
//
// Rule sets: 'american' and 'flying' are diagonal draughts on the dark squares.
//            'dama' is Ethiopian Dama: ALL 64 squares are used and everything moves orthogonally
//            (along rows and columns). Men step forward or sideways but never backward; when it is time
//            to capture, any piece may jump backward, sideways or forward. Kings fly over empty squares,
//            capture from a distance, and every piece keeps capturing while it can.

export const SIZE = 8;

const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export const RULESETS = {
  // English / American checkers: men move + capture forward, kings step one square,
  // capturing is mandatory, a man that is crowned ends its turn.
  american: { id: 'american', dirs: DIAG, sideMoves: false, dama: false, backCapture: false, flying: false, maxCapture: false, promoteEnds: true, drawPlies: 80 },
  // Brazilian-style: men also capture backwards, kings fly any distance, you must take the most pieces.
  flying: { id: 'flying', dirs: DIAG, sideMoves: false, dama: false, backCapture: true, flying: true, maxCapture: true, promoteEnds: false, drawPlies: 40 },
  // Ethiopian Dama: orthogonal moves, men never step back but may capture in every direction, flying kings.
  // Capturing is NOT compulsory (`huff`): a player may make any move. Skipping a capture, or stopping a chain
  // early, costs the piece that should have captured (the "huff") — it is simply removed, no warning given.
  dama: { id: 'dama', dirs: ORTHO, sideMoves: true, dama: true, backCapture: true, flying: true, maxCapture: true, huff: true, promoteEnds: false, drawPlies: 60 },
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
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

export function initialBoard(rulesetId = 'american') {
  const b = new Array(64).fill(0);
  if (getRules(rulesetId).dama) { // 16 men each: seat 1 on rows 1-2, seat 0 on rows 5-6
    for (let c = 0; c < 8; c++) { b[8 + c] = 3; b[16 + c] = 3; b[40 + c] = 1; b[48 + c] = 1; }
    return b;
  }
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if ((r + c) % 2 !== 1) continue;
    if (r <= 2) b[r * 8 + c] = 3;
    else if (r >= 5) b[r * 8 + c] = 1;
  }
  return b;
}

export function positionKey(board, turn, allSquares = false) {
  let s = '';
  for (let i = 0; i < 64; i++) {
    if (!allSquares && !isDark(i)) continue;
    const p = board[i];
    s += p === 0 ? '_' : p === 1 ? 'b' : p === 2 ? 'B' : p === 3 ? 'w' : 'W';
  }
  return s + turn;
}

export const ULTRA_MAX = 3; // consecutive multi-kills by a king that fill the Ultra meter

export function newGame(rulesetId = 'american', opts = {}) {
  const board = initialBoard(rulesetId);
  const first = opts.first === 1 ? 1 : 0; // who moves first (the UI draws lots)
  const g = { board, turn: first, over: false, winner: null, reason: null, noProgress: 0, seen: { [positionKey(board, first, getRules(rulesetId).dama)]: 1 } };
  if (opts.ultra) g.ultra = [0, 0]; // optional "Ultra" mode: charge the meter with king multi-kills for an extra turn
  return g;
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
  for (const [dr, dc] of rules.dirs) {
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

/** All legal moves for `seat`. Capturing is mandatory (the huff rule uses genFreeMoves instead). */
export function genMoves(board, seat, rules, quietOnly = false) {
  const caps = [];
  if (!quietOnly) for (let sq = 0; sq < 64; sq++) if (seatOf(board[sq]) === seat) captureSequences(board, sq, rules, caps);
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
    for (const [dr, dc] of rules.dirs) {
      if (!king && dr !== fwd(seat) && !(rules.sideMoves && dr === 0)) continue; // men never step backward
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


/**
 * Every capture "prefix" of every chain a piece could make, so the player may stop early.
 * `more` is true when the piece could have kept jumping from where it stopped.
 */
function captureWalks(board, from, rules, out) {
  const piece = board[from], seat = seatOf(piece), startKing = isKing(piece);
  const b = board.slice(); b[from] = 0;
  const taken = new Set();
  const crowns = (land, king) => !king && rowOf(land) === promoRow(seat);
  const walk = (pos, king, path, caps) => {
    for (const j of jumps(b, pos, king, seat, taken, rules)) {
      for (const l of j.lands) {
        const nPath = [...path, l], nCaps = [...caps, j.victim];
        const nowKing = king || crowns(l, king);
        taken.add(j.victim);
        const more = jumps(b, l, nowKing, seat, taken, rules).length > 0;
        out.push({ from, to: l, path: nPath, caps: nCaps, promote: !startKing && nowKing, more });
        if (more) walk(l, nowKing, nPath, nCaps);
        taken.delete(j.victim);
      }
    }
  };
  walk(from, startKing, [], []);
}

/** Huff rule: all captures (complete or stopped short) plus every quiet move. Nothing is compulsory. */
export function genFreeMoves(board, seat, rules) {
  const caps = [];
  for (let sq = 0; sq < 64; sq++) if (seatOf(board[sq]) === seat) captureWalks(board, sq, rules, caps);
  return caps.concat(genMoves(board, seat, rules, true));
}

/** The pieces that could capture right now, with the longest chain each could take. */
export function capturers(board, seat, rules) {
  const best = new Map();
  const caps = [];
  for (let sq = 0; sq < 64; sq++) if (seatOf(board[sq]) === seat) captureWalks(board, sq, rules, caps);
  for (const m of caps) best.set(m.from, Math.max(best.get(m.from) || 0, m.caps.length));
  return best;
}

export function legalMoves(state, rulesetId = 'american') {
  if (state.over || state.pendingHuff) return [];
  const rules = getRules(rulesetId);
  return rules.huff ? genFreeMoves(state.board, state.turn, rules) : genMoves(state.board, state.turn, rules);
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
  if (state.pendingHuff) return { ok: false, error: 'Pick the piece to remove first' };
  const move = findMove(state, from, path, rulesetId);
  if (!move) return { ok: false, error: 'Illegal move' };
  const seat = state.turn;
  const moving = state.board[from];
  const next = cloneState(state);
  next.board = applyMoveToBoard(state.board, move);
  next.turn = 1 - seat;
  next.pendingHuff = null;

  // HUFF: a capture that was available but not taken (or a chain stopped short) costs a piece. The OPPONENT picks
  // which one — but only among the pieces that had a capture and did not take it.
  let options = [];
  if (rules.huff) options = huffCandidates(state, move, seat, rules);
  const irreversible = move.caps.length > 0 || options.length > 0 || !isKing(moving);
  if (options.length > 1) { // the opponent has to choose; the game goes on once they have
    next.pendingHuff = { by: seat, options, irreversible: true };
    return { ok: true, state: next, move, hops: hopsOf(move), captured: move.caps.length, promoted: move.promote, huffed: null, pendingHuff: next.pendingHuff };
  }
  let huffed = null;
  if (options.length === 1) { huffed = options[0]; next.board[huffed] = 0; }
  settle(next, seat, rules, irreversible, state.noProgress);
  const extraTurn = ultraStep(next, seat, move, isKing(moving), rules);
  return { ok: true, state: next, move, hops: hopsOf(move), captured: move.caps.length, promoted: move.promote, huffed, pendingHuff: null, extraTurn };
}

/**
 * Ultra meter (optional, only when the game was created with `{ ultra: true }`): every consecutive multi-kill made by a
 * king (Dama) charges the meter; any other move empties it. When full, the player moves again at once.
 */
function ultraStep(next, seat, move, wasKing, rules) {
  if (!next.ultra) return false;
  const u = next.ultra.slice();
  u[seat] = wasKing && move.caps.length >= 2 ? u[seat] + 1 : 0;
  let extra = false;
  if (u[seat] >= ULTRA_MAX) { u[seat] = 0; extra = true; }
  next.ultra = u;
  if (extra && !next.over) {
    const has = (rules.huff ? genFreeMoves : genMoves)(next.board, seat, rules).length > 0;
    if (has) next.turn = seat; else extra = false;
  }
  return extra;
}

/**
 * Sudden Death: one random piece of each side is eliminated (a side keeps at least one piece). Used by the 5-minute rule.
 * Returns { ok, state, removed: [squares] }.
 */
export function suddenDeath(state, rulesetId = 'dama', rng = Math.random) {
  if (state.over || state.pendingHuff) return { ok: false, error: 'Not now' };
  const rules = getRules(rulesetId);
  const next = cloneState(state);
  const removed = [];
  for (const seat of [0, 1]) {
    const mine = []; next.board.forEach((p, sq) => { if (p && seatOf(p) === seat) mine.push(sq); });
    if (mine.length <= 1) continue;
    const sq = mine[Math.floor(rng() * mine.length)];
    next.board[sq] = 0; removed.push(sq);
  }
  next.noProgress = 0; next.seen = {};
  next.seen[positionKey(next.board, next.turn, rules.dama)] = 1;
  const moves = (rules.huff ? genFreeMoves : genMoves)(next.board, next.turn, rules).length;
  if (!moves) { next.over = true; next.winner = 1 - next.turn; next.reason = 'blocked'; }
  return { ok: true, state: next, removed };
}

/** Squares (after the move) of the pieces that could have captured this turn but did not. */
export function huffCandidates(state, move, seat, rules) {
  if (move.caps.length) return move.more ? [move.to] : []; // stopped a chain early: the moving piece is to blame
  const able = capturers(state.board, seat, rules);
  if (!able.size) return [];
  const out = new Set();
  for (const sq of able.keys()) out.add(sq === move.from ? move.to : sq); // the moving piece is judged where it now stands
  return [...out].sort((a, b) => a - b);
}

/** End-of-turn bookkeeping shared by playMove and resolveHuff: repetition, 60-move rule, blocked / captured-out. */
function settle(next, seat, rules, irreversible, prevNoProgress) {
  next.noProgress = irreversible ? 0 : prevNoProgress + 1;
  if (irreversible) next.seen = {};
  const key = positionKey(next.board, next.turn, rules.dama);
  next.seen[key] = (next.seen[key] || 0) + 1;
  const moveCount = (rules.huff ? genFreeMoves : genMoves)(next.board, next.turn, rules).length;
  if (counts(next.board)[next.turn] === 0 || moveCount === 0) {
    next.over = true; next.winner = seat; next.reason = 'blocked';
    if (counts(next.board)[seat] === 0) next.winner = 1 - seat; // you huffed your last piece
  } else if (next.seen[key] >= 3) {
    next.over = true; next.winner = 'draw'; next.reason = 'repetition';
  } else if (next.noProgress >= rules.drawPlies) {
    next.over = true; next.winner = 'draw'; next.reason = 'moves';
  }
}

/**
 * The player whose turn it is (the opponent of the offender) removes one of the offender's pieces
 * that forgot to capture. Returns { ok, state, huffed, error }.
 */
export function resolveHuff(state, square, rulesetId = 'dama') {
  const rules = getRules(rulesetId);
  const ph = state.pendingHuff;
  if (state.over || !ph) return { ok: false, error: 'Nothing to remove' };
  if (!Number.isInteger(square) || !ph.options.includes(square)) return { ok: false, error: 'That piece did not miss a capture' };
  const next = cloneState(state);
  next.board[square] = 0;
  next.pendingHuff = null;
  settle(next, ph.by, rules, true, state.noProgress);
  return { ok: true, state: next, huffed: square };
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
