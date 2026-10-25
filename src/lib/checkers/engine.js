// Checkers (draughts) rules engine — pure functions, no UI, no Firebase.
// Shared by the browser (practice, animation) and the server (authoritative online moves).
//
// Board: 8×8, index = row*8 + col, row 0 at the top. Only dark squares ((row+col) odd) are used.
// Seat 0 ("Dark", moves first) starts on rows 5-7 and moves UP the board (row decreasing).
// Seat 1 ("Light") starts on rows 0-2 and moves DOWN the board.
// Piece codes: 0 empty · 1 seat-0 man · 2 seat-0 king · 3 seat-1 man · 4 seat-1 king.
//
// Rule sets: 'american' (Classic) and 'flying' (Flying kings) are diagonal draughts on the dark squares. In both,
//            capturing is optional (`huff`): the player who skips a capture (or the MAJORITY capture, in 'flying') may be
//            huffed — see below. (The 16-man Ethiopian orthogonal Dama rule set has been removed.)

export const SIZE = 8;

const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

export const RULESETS = {
  // English / American checkers: men move + capture forward, kings step one square, a man that is crowned ends its turn.
  // Capturing is NOT forced (`huff`): play any piece you like — but the opponent may remove a piece that skipped a capture.
  american: { id: 'american', dirs: DIAG, backCapture: false, flying: false, maxCapture: false, huff: true, promoteEnds: true, drawPlies: 80 },
  // Brazilian-style: men also capture backwards, kings fly any distance, the longest chain is the right one (skipping it can be claimed).
  flying: { id: 'flying', dirs: DIAG, backCapture: true, flying: true, maxCapture: true, huff: true, promoteEnds: false, drawPlies: 40 },
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

export const ULTRA_MAX = 3; // consecutive multi-kills by a king that fill the Ultra meter

export function newGame(rulesetId = 'american', opts = {}) {
  const board = initialBoard(rulesetId);
  const first = opts.first === 1 ? 1 : 0; // who moves first (the UI draws lots)
  const g = { board, turn: first, over: false, winner: null, reason: null, noProgress: 0, seen: { [positionKey(board, first)]: 1 } };
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
    if (!king && !rules.backCapture && dr !== fwd(seat)) continue; // men capture forward only (unless back-capture is on)
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
      if (!king && dr !== fwd(seat)) continue; // men never step backward
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
        const endsHere = rules.promoteEnds && !king && crowns(l, king); // English draughts: a man that is crowned stops there
        const more = !endsHere && jumps(b, l, nowKing, seat, taken, rules).length > 0;
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
  if (state.over) return [];
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
  const move = findMove(state, from, path, rulesetId);
  if (!move) return { ok: false, error: 'Illegal move' };
  const seat = state.turn;
  const moving = state.board[from];
  const next = cloneState(state);
  next.board = applyMoveToBoard(state.board, move);
  next.turn = 1 - seat;
  next.pendingHuff = null;

  // HUFF (optional claim): a capture that was available but not taken (or a chain stopped short) puts the piece that
  // missed it "on offer": the opponent may touch it before he moves and remove it. Playing a move instead (or any move
  // at all) cancels the offer — the piece is only lost if the opponent actually touches it.
  let options = [];
  if (rules.huff) options = huffCandidates(state, move, seat, rules);
  const irreversible = move.caps.length > 0 || options.length > 0 || !isKing(moving);
  settle(next, seat, rules, irreversible, state.noProgress);
  if (options.length && !next.over) next.pendingHuff = { by: seat, options, irreversible: true };
  const extraTurn = ultraStep(next, seat, move, isKing(moving), rules);
  if (next.turn === seat) next.pendingHuff = null; // the mover plays again: nobody can claim anything
  return { ok: true, state: next, move, hops: hopsOf(move), captured: move.caps.length, promoted: move.promote, huffed: null, pendingHuff: next.pendingHuff, extraTurn };
}

/**
 * Ultra meter (optional, only when the game was created with `{ ultra: true }`): every consecutive multi-kill made by a
 * king charges the meter; any other move empties it. When full, the player moves again at once.
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
export function suddenDeath(state, rulesetId = 'flying', rng = Math.random) {
  if (state.over) return { ok: false, error: 'Not now' };
  const rules = getRules(rulesetId);
  const next = cloneState(state);
  next.pendingHuff = null;
  const removed = [];
  for (const seat of [0, 1]) {
    const mine = []; next.board.forEach((p, sq) => { if (p && seatOf(p) === seat) mine.push(sq); });
    if (mine.length <= 1) continue;
    const sq = mine[Math.floor(rng() * mine.length)];
    next.board[sq] = 0; removed.push(sq);
  }
  next.noProgress = 0; next.seen = {};
  next.seen[positionKey(next.board, next.turn)] = 1;
  const moves = (rules.huff ? genFreeMoves : genMoves)(next.board, next.turn, rules).length;
  if (!moves) { next.over = true; next.winner = 1 - next.turn; next.reason = 'blocked'; }
  return { ok: true, state: next, removed };
}

/**
 * Squares (after the move) of the pieces that "missed" something this turn:
 *  • a quiet move while any capture existed → every piece that could have captured is offered;
 *  • a capture that took FEWER pieces than the longest chain on the board (the majority rule) → every piece that could
 *    have made that longest chain is offered;
 *  • the capturing piece stopped its chain early, or chose a shorter route than it had → that piece is offered.
 * The opponent decides whether to claim; nothing is ever forced and nothing is shown.
 */
export function huffCandidates(state, move, seat, rules) {
  const able = capturers(state.board, seat, rules);
  if (!able.size) return [];
  const where = (sq) => (sq === move.from ? move.to : sq); // the moving piece is judged where it now stands
  const out = new Set();
  if (!move.caps.length) {
    for (const sq of able.keys()) out.add(where(sq));
  } else {
    const most = Math.max(...able.values());
    if (rules.maxCapture && move.caps.length < most) for (const [sq, n] of able) if (n === most) out.add(where(sq));
    if (move.more || (rules.maxCapture && move.caps.length < (able.get(move.from) || 0))) out.add(move.to);
  }
  return [...out].sort((a, b) => a - b);
}

/** End-of-turn bookkeeping shared by playMove and resolveHuff: repetition, 60-move rule, blocked / captured-out. */
function settle(next, seat, rules, irreversible, prevNoProgress) {
  next.noProgress = irreversible ? 0 : prevNoProgress + 1;
  if (irreversible) next.seen = {};
  const key = positionKey(next.board, next.turn);
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
 * CLAIM (a free action, only for the player to move): he touches a piece of the opponent that missed a capture and
 * removes it. His turn is NOT used up — he still moves afterwards. Only the pieces on offer (`pendingHuff.options`)
 * can be touched; if he plays a move without claiming, the offer is gone (playMove clears it).
 * Returns { ok, state, huffed, error }.
 */
export function resolveHuff(state, square, rulesetId = 'flying') {
  const rules = getRules(rulesetId);
  const ph = state.pendingHuff;
  if (state.over || !ph) return { ok: false, error: 'Nothing to remove' };
  if (ph.by === state.turn) return { ok: false, error: 'Only the opponent may claim' };
  if (!Number.isInteger(square) || !ph.options.includes(square) || seatOf(state.board[square]) !== ph.by) return { ok: false, error: 'That piece did not miss a capture' };
  const next = cloneState(state);
  next.board[square] = 0;
  next.pendingHuff = null;
  next.noProgress = 0; next.seen = {};
  const key = positionKey(next.board, next.turn);
  next.seen[key] = 1;
  const mover = state.turn;
  if (counts(next.board)[ph.by] === 0) { next.over = true; next.winner = mover; next.reason = 'blocked'; }       // his last piece went
  else if (genFreeMoves(next.board, mover, rules).length === 0) { next.over = true; next.winner = ph.by; next.reason = 'blocked'; } // the claimer is boxed in
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
