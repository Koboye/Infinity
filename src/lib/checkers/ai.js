// Checkers computer opponent: iterative-deepening alpha-beta with a time budget.
import { genMoves, genFreeMoves, huffCandidates, applyMoveToBoard, getRules, seatOf, isKing, rowOf, colOf, resolveHuff } from './engine.js';

export const LEVELS = {
  easy: { depth: 6, ms: 150, randomness: 0.07 },
  medium: { depth: 16, ms: 1000, randomness: 0 },
  // "hard": no randomness, iterative deepening with a transposition table (kept between turns) and a long clock.
  // It runs in a Web Worker (aiClient.js) while the computer's thinking pause is on screen, so the UI never freezes.
  hard: { depth: 48, ms: 3000, randomness: 0 },
};

const WIN = 100000;

function evaluate(board, rules) {
  // Score from seat 0's point of view.
  let s = 0;
  const kingVal = rules.flying ? 320 : 180;
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (!p) continue;
    const seat = seatOf(p), sign = seat === 0 ? 1 : -1;
    const r = rowOf(sq), c = colOf(sq);
    let v;
    if (isKing(p)) {
      v = kingVal;
      v += 6 - (Math.abs(3.5 - r) + Math.abs(3.5 - c)) * 1.5; // kings like the centre
    } else {
      const adv = seat === 0 ? 7 - r : r;           // 0 (home) … 7 (about to crown)
      v = 100 + adv * 6 + (adv >= 5 ? 6 : 0);
      if (adv === 0) v += 10;                        // keep a back-row guard
      if (c === 0 || c === 7) v -= 3;                // edges are slightly passive
      else if (c >= 2 && c <= 5 && adv >= 2 && adv <= 5) v += 3; // central men
    }
    s += sign * v;
  }
  return s + structure(board, rules);
}

/** Cheap positional terms: protected men (a friend right behind on a diagonal), and the side ahead is pushed to trade down. */
function structure(board, rules) {
  let s = 0, n = 0, w = 0, b = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (!p) continue;
    n++;
    const seat = seatOf(p), r = rowOf(sq), c = colOf(sq);
    const val = isKing(p) ? (rules.flying ? 320 : 180) : 100;
    if (seat === 0) w += val; else b += val;
    if (isKing(p) || c === 0 || c === 7) continue;
    const br = seat === 0 ? r + 1 : r - 1;                 // the row behind this man
    if (br < 0 || br > 7) continue;
    const back = (board[br * 8 + c - 1] ? seatOf(board[br * 8 + c - 1]) === seat : false) && (board[br * 8 + c + 1] ? seatOf(board[br * 8 + c + 1]) === seat : false);
    if (back) s += seat === 0 ? 4 : -4;
  }
  // the fewer pieces remain, the more a material lead counts (so the leader trades down and converts)
  s += (w - b) * Math.max(0, 16 - n) / 90;
  return s;
}

class Timeout extends Error {}

/**
 * Moves for `seat`. Nothing is compulsory (huff): the computer may leave a capture, but then the opponent may touch the
 * piece that missed it and remove it. Each free move therefore comes with the board AS IT WILL BE after that claim
 * (worst case: the most valuable offender is taken), so skipping a capture is only chosen when it really pays.
 */
function movesWithBoards(board, seat, rules) {
  if (!rules.huff) return genMoves(board, seat, rules).map((m) => ({ m, board: applyMoveToBoard(board, m) }));
  return genFreeMoves(board, seat, rules).map((m) => {
    let nb = applyMoveToBoard(board, m);
    const cand = huffCandidates({ board }, m, seat, rules);
    if (cand.length) {
      let worst = null, worstV = Infinity;
      for (const sq of cand) {
        const b2 = nb.slice(); b2[sq] = 0;
        const v = (seat === 0 ? 1 : -1) * evaluate(b2, rules);
        if (v < worstV) { worstV = v; worst = b2; }
      }
      if (worst) nb = worst;
    }
    return { m, board: nb };
  });
}

const mvKey = (m) => `${m.from}-${m.path.join('-')}`;
const EXACT = 0, LOWER = 1, UPPER = 2;
// Search memory, kept between turns (entries stay valid: the key is the whole position + side to move + rule set).
const SHARED_TT = new Map();

function search(board, seat, depth, alpha, beta, ply, ctx) {
  if ((++ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) throw new Timeout();
  const moves = movesWithBoards(board, seat, ctx.rules);
  if (!moves.length) return seat === 0 ? -WIN + ply : WIN - ply; // side to move is stuck → loses
  const forced = moves[0].m.caps.length > 0;
  if (depth <= 0 && !(forced && ctx.ext < 6 && depth > -4)) return evaluate(board, ctx.rules);
  if (ply > 60) return evaluate(board, ctx.rules);
  const maximizing = seat === 0;
  let hashMove = null, key = null;
  if (depth > 0) {
    key = `${ctx.rk}${seat}${board.join('')}`;
    const hit = ctx.tt.get(key);
    if (hit) {
      hashMove = hit.mv;
      if (hit.d >= depth && Math.abs(hit.v) < WIN / 2) { // never trust a stored mate distance across different plies
        if (hit.f === EXACT) return hit.v;
        if (hit.f === LOWER && hit.v > alpha) alpha = hit.v;
        else if (hit.f === UPPER && hit.v < beta) beta = hit.v;
        if (alpha >= beta) return hit.v;
      }
    }
  }
  const a0 = alpha, b0 = beta;
  let best = maximizing ? -Infinity : Infinity, bestKey = null;
  // Stored best move first, then longer captures, then promotions.
  moves.sort((x, y) => ((mvKey(y.m) === hashMove) - (mvKey(x.m) === hashMove)) || (y.m.caps.length - x.m.caps.length) || (Number(y.m.promote) - Number(x.m.promote)));
  for (const { m, board: nb } of moves) {
    if (forced && depth <= 0) ctx.ext++;
    const v = search(nb, 1 - seat, depth - 1, alpha, beta, ply + 1, ctx);
    if (forced && depth <= 0) ctx.ext--;
    if (maximizing) { if (v > best) { best = v; bestKey = mvKey(m); } if (v > alpha) alpha = v; }
    else { if (v < best) { best = v; bestKey = mvKey(m); } if (v < beta) beta = v; }
    if (beta <= alpha) break;
  }
  if (key) {
    if (ctx.tt.size > 400000) ctx.tt.clear();
    ctx.tt.set(key, { d: depth, v: best, f: best <= a0 ? UPPER : best >= b0 ? LOWER : EXACT, mv: bestKey });
  }
  return best;
}

/** Returns the chosen move object {from, path, ...} for the side to move. `opts.maxMs` caps the clock (in-page fallback). */
export function chooseCheckersMove(state, rulesetId = 'american', level = 'medium', rng = Math.random, opts = {}) {
  const cfg = LEVELS[level] || LEVELS.medium;
  const rules = getRules(rulesetId);
  // Free choice (it may skip a capture and pay the forfeit if that is better).
  const rootList = state.over ? [] : movesWithBoards(state.board, state.turn, rules);
  const moves = rootList.map((x) => x.m);
  const afterOf = new Map(rootList.map((x) => [x.m, x.board]));
  if (moves.length <= 1) return moves[0] || null;
  if (rng() < cfg.randomness) {
    // Easy level may genuinely overlook a capture (then you can claim the piece); stronger levels only slip among captures
    const pool = rules.huff && cfg.randomness < 0.3 ? moves.filter((m) => m.caps.length) : [];
    const pick = pool.length ? pool : moves;
    return pick[Math.floor(rng() * pick.length)];
  }

  const seat = state.turn;
  const ms = Math.min(cfg.ms, opts.maxMs || Infinity);
  const ctx = { rules, nodes: 0, ext: 0, deadline: Date.now() + ms, tt: opts.tt || SHARED_TT, rk: `${rulesetId}|${rules.huff ? 'h' : 'n'}|` };
  let best = moves[0];
  const ordered = moves.slice().sort((a, b) => (b.caps.length - a.caps.length) || (Number(b.promote) - Number(a.promote)));
  for (let depth = 1; depth <= cfg.depth; depth++) {
    let iterBest = null, iterVal = seat === 0 ? -Infinity : Infinity;
    try {
      for (const m of ordered) {
        // alpha-beta window narrowed by the best root move so far
        const v = search(afterOf.get(m), 1 - seat, depth - 1, seat === 0 ? iterVal : -Infinity, seat === 0 ? Infinity : iterVal, 1, ctx) + rng() * 0.01;
        if (seat === 0 ? v > iterVal : v < iterVal) { iterVal = v; iterBest = m; }
      }
    } catch (e) { if (e instanceof Timeout) break; throw e; }
    if (iterBest) {
      best = iterBest;
      // Search the previous best first next time.
      ordered.splice(ordered.indexOf(iterBest), 1); ordered.unshift(iterBest);
      if (Math.abs(iterVal) > WIN / 2) break; // forced win/loss found
    }
    if (Date.now() > ctx.deadline) break;
  }
  return best;
}

/**
 * Huff: the computer is the one removing a piece. It may only choose among `state.pendingHuff.options`
 * (the pieces that forgot to capture) and takes the one whose loss hurts the offender most.
 */
export function chooseHuffPick(state, rulesetId = 'flying') {
  const ph = state.pendingHuff;
  if (!ph || !ph.options.length) return null;
  const rules = getRules(rulesetId);
  const offender = ph.by;
  let best = ph.options[0], bestVal = Infinity;
  for (const sq of ph.options) {
    const r = resolveHuff(state, sq, rulesetId);
    if (!r.ok) continue;
    if (r.state.over) { if (r.state.winner === 1 - offender) return sq; continue; }
    // value from the offender's point of view after losing `sq` (evaluate() scores seat 0 positively)
    const v = (offender === 0 ? 1 : -1) * evaluate(r.state.board, rules);
    if (v < bestVal) { bestVal = v; best = sq; }
  }
  return best;
}
