// Computer opponent: iterative-deepening alpha-beta with a time budget, move ordering and a transposition table.
// Same style as the Dama engine, tuned for Gebeta where relay chains make every move long.
import { legalMoves, playMove, holesOf, collectAll, flagOf, RING } from './engine.js';

export const LEVELS = {
  easy: { depth: 2, ms: 60, randomness: 0.35 },
  medium: { depth: 6, ms: 450, randomness: 0.04 },
  hard: { depth: 16, ms: 1400, randomness: 0 },
};

const WIN = 1e6;
class Timeout extends Error {}

function evaluate(state, me) {
  if (state.over) return state.winner === me ? WIN : state.winner === 'draw' ? 0 : -WIN;
  const op = 1 - me;
  const pile = [state.pits[6], state.pits[13]];
  let mine = 0, theirs = 0;
  const mh = holesOf(state, me), oh = holesOf(state, op);
  for (const i of RING) {
    const f = flagOf(state, i), n = state.pits[i];
    if (f === 3) continue;                       // shared: splits evenly
    if (f === 1 || f === 2) { if (f - 1 === me) mine += n; else theirs += n; continue; } // waiting family belongs to whoever may tap it
    if (mh.includes(i)) mine += n; else theirs += n;
  }
  const owned = pile[me] + mine - (pile[op] + theirs); // who is winning the long game of rounds
  const secured = pile[me] - pile[op];                  // seeds already banked
  let shape = 0;
  for (const i of mh) { const n = state.pits[i]; if (flagOf(state, i)) continue; if (n === 3) shape += 2; else if (n === 0) shape -= 1; }
  for (const i of oh) { const n = state.pits[i]; if (!flagOf(state, i) && n === 3) shape -= 2; }
  return owned * 12 + secured * 5 + (mh.length - oh.length) * 6 + shape;
}

const key = (s) => `${s.pits.join(',')}|${s.own ? s.own.join('') : ''}|${s.turn}`;

function orderMoves(state, moves, rules) {
  // Moves that bank the most seeds immediately are searched first (better alpha-beta cut-offs).
  return moves
    .map((m) => { const r = playMove(state, m, rules); return { m, r, k: r.captured + (r.newRound ? 2 : 0) }; })
    .sort((a, b) => b.k - a.k);
}

function search(state0, depth, alpha, beta, me, rules, ctx) {
  if ((++ctx.nodes & 255) === 0 && Date.now() > ctx.deadline) throw new Timeout();
  const state = state0.over ? state0 : collectAll(state0).state; // players always tap their ripe families
  if (depth === 0 || state.over) return evaluate(state, me);
  const k = `${key(state)}|${depth}`;
  const hit = ctx.tt.get(k);
  if (hit !== undefined) return hit;
  const maximizing = state.turn === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const { r } of orderMoves(state, legalMoves(state), rules)) {
    const v = search(r.state, depth - 1, alpha, beta, me, rules, ctx);
    if (maximizing) { if (v > best) best = v; if (v > alpha) alpha = v; }
    else { if (v < best) best = v; if (v < beta) beta = v; }
    if (beta <= alpha) { return best; } // cut-off values are bounds, so they are not cached
  }
  if (ctx.tt.size < 200000) ctx.tt.set(k, best);
  return best;
}

export function chooseMove(state0, rules = 'gebeta', level = 'medium', rng = Math.random) {
  const state = collectAll(state0).state;
  const cfg = LEVELS[level] || LEVELS.medium;
  const moves = legalMoves(state);
  if (moves.length <= 1) return moves[0];
  if (rng() < cfg.randomness) return moves[Math.floor(rng() * moves.length)];
  const me = state.turn;
  const ctx = { nodes: 0, deadline: Date.now() + cfg.ms, tt: new Map() };
  const ordered = orderMoves(state, moves, rules);
  let bestMove = ordered[0].m; // always have an answer, even if time runs out at depth 1
  for (let d = 1; d <= cfg.depth; d++) {
    let iterBest = null, iterVal = -Infinity;
    try {
      for (const { m, r } of ordered) {
        const v = search(r.state, d - 1, -Infinity, Infinity, me, rules, ctx) + rng() * 0.01;
        if (v > iterVal) { iterVal = v; iterBest = m; }
      }
    } catch (e) { if (e instanceof Timeout) break; throw e; }
    if (iterBest != null) {
      bestMove = iterBest;
      const i = ordered.findIndex((o) => o.m === iterBest); // best move first in the next, deeper pass
      if (i > 0) ordered.unshift(ordered.splice(i, 1)[0]);
      if (Math.abs(iterVal) >= WIN / 2) break; // forced win/loss found
    }
    if (Date.now() > ctx.deadline) break;
  }
  return bestMove;
}
