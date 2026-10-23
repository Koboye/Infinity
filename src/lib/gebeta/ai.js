// Computer opponent: alpha-beta minimax over the shared engine.
import { legalMoves, playMove, scores } from './engine.js';

export const LEVELS = {
  easy: { depth: 1, randomness: 0.45 },
  medium: { depth: 4, randomness: 0.08 },
  hard: { depth: 8, randomness: 0 },
};

function evaluate(state, me) {
  if (state.over) return state.winner === me ? 100000 : state.winner === 'draw' ? 0 : -100000;
  // Seeds you own (pile + your own holes) decide who wins the long game of rounds.
  const [a, b] = scores(state);
  const diff = me === 0 ? a - b : b - a;
  let mine = 0, theirs = 0;
  for (let i = 0; i < 6; i++) { mine += state.pits[me === 0 ? i : i + 7]; theirs += state.pits[me === 0 ? i + 7 : i]; }
  return diff * 10 + (mine - theirs) * 6;
}

function search(state, depth, alpha, beta, me, rules) {
  if (depth === 0 || state.over) return evaluate(state, me);
  const moves = legalMoves(state);
  const maximizing = state.turn === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const m of moves) {
    const r = playMove(state, m, rules);
    const v = search(r.state, depth - 1, alpha, beta, me, rules);
    if (maximizing) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
    else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseMove(state, rules = 'gebeta', level = 'medium', rng = Math.random) {
  const cfg = LEVELS[level] || LEVELS.medium;
  const moves = legalMoves(state);
  if (moves.length <= 1) return moves[0];
  if (rng() < cfg.randomness) return moves[Math.floor(rng() * moves.length)];
  const me = state.turn;
  let bestMove = moves[0], bestVal = -Infinity;
  for (const m of moves) {
    const r = playMove(state, m, rules);
    const v = search(r.state, cfg.depth - 1, -Infinity, Infinity, me, rules) + rng() * 0.01;
    if (v > bestVal) { bestVal = v; bestMove = m; }
  }
  return bestMove;
}
