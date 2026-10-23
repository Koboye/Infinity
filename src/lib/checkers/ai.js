// Checkers computer opponent: iterative-deepening alpha-beta with a time budget.
import { genMoves, applyMoveToBoard, getRules, seatOf, isKing, rowOf, colOf, legalMoves } from './engine.js';

export const LEVELS = {
  easy: { depth: 2, ms: 120, randomness: 0.3 },
  medium: { depth: 6, ms: 450, randomness: 0.04 },
  hard: { depth: 14, ms: 1100, randomness: 0 },
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
  return s;
}

class Timeout extends Error {}

function search(board, seat, depth, alpha, beta, ply, ctx) {
  if ((++ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) throw new Timeout();
  const moves = genMoves(board, seat, ctx.rules);
  if (!moves.length) return seat === 0 ? -WIN + ply : WIN - ply; // side to move is stuck → loses
  const forced = moves[0].caps.length > 0;
  if (depth <= 0 && !(forced && ctx.ext < 6 && depth > -4)) return evaluate(board, ctx.rules);
  if (ctx.seenDepth !== undefined && ply > 60) return evaluate(board, ctx.rules);
  const maximizing = seat === 0;
  let best = maximizing ? -Infinity : Infinity;
  // Captures first, then promotions, then forward moves.
  moves.sort((a, b) => (b.caps.length - a.caps.length) || (Number(b.promote) - Number(a.promote)));
  for (const m of moves) {
    if (forced && depth <= 0) ctx.ext++;
    const v = search(applyMoveToBoard(board, m), 1 - seat, depth - 1, alpha, beta, ply + 1, ctx);
    if (forced && depth <= 0) ctx.ext--;
    if (maximizing) { if (v > best) best = v; if (v > alpha) alpha = v; }
    else { if (v < best) best = v; if (v < beta) beta = v; }
    if (beta <= alpha) break;
  }
  return best;
}

/** Returns the chosen move object {from, path, ...} for the side to move. */
export function chooseCheckersMove(state, rulesetId = 'american', level = 'medium', rng = Math.random) {
  const cfg = LEVELS[level] || LEVELS.medium;
  const rules = getRules(rulesetId);
  const moves = legalMoves(state, rulesetId);
  if (moves.length <= 1) return moves[0] || null;
  if (rng() < cfg.randomness) return moves[Math.floor(rng() * moves.length)];

  const seat = state.turn;
  const ctx = { rules, nodes: 0, ext: 0, deadline: Date.now() + cfg.ms };
  let best = moves[0];
  const ordered = moves.slice().sort((a, b) => (b.caps.length - a.caps.length) || (Number(b.promote) - Number(a.promote)));
  for (let depth = 1; depth <= cfg.depth; depth++) {
    let iterBest = null, iterVal = seat === 0 ? -Infinity : Infinity;
    try {
      for (const m of ordered) {
        const v = search(applyMoveToBoard(state.board, m), 1 - seat, depth - 1, -Infinity, Infinity, 1, ctx) + rng() * 0.01;
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
