// Computer opponent for Gebeta: iterative-deepening alpha-beta with a bounded transposition table,
// best-move-first ordering, a search that follows the "ripe family" chances, and an opening/endgame-aware evaluation.
// Gebeta has no hidden information, so on "hard" the computer simply looks as far ahead as the clock allows.
import { legalMoves, playMove, holesOf, collectAll, flagOf, getRules, RING } from './engine.js';

export const LEVELS = {
  easy: { depth: 6, ms: 120, randomness: 0.06 },
  medium: { depth: 16, ms: 900, randomness: 0 },
  // "hard" is meant to be very close to unbeatable: no randomness, a long clock (2.3 s, search memory is kept between turns).
  // It runs in a Web Worker (aiClient.js) while the computer's thinking pause is on screen, so the screen never freezes.
  hard: { depth: 64, ms: 3000, randomness: 0 },
};

// ጡዝ has its own strength ladder, calibrated by tests/tuz-calibration.mjs against a fixed reference player
// (an average club player: 3-ply look-ahead, 10 % careless moves). Target win rate of the computer vs that player:
//   easy 60-75 %   medium 76-85 %   hard 86-99 %
// A level is a look-ahead depth, a thinking clock and a share of careless (random) moves.
export const TUZ_LEVELS = {
  easy: { depth: 4, ms: 300, randomness: 0.18 },
  medium: { depth: 4, ms: 600, randomness: 0.10 },
  hard: { depth: 64, ms: 3000, randomness: 0 },
};
export const levelsFor = (rules) => (rules === 'tuz' ? TUZ_LEVELS : LEVELS);

const WIN = 1e6;
class Timeout extends Error {}
const EXACT = 0, LOWER = 1, UPPER = 2;

/** Static score for `me`: bigger is better. */
export function evaluate(state, me, w = WEIGHTS) {
  if (state.over) return state.winner === me ? WIN : state.winner === 'draw' ? 0 : -WIN;
  const op = 1 - me;
  const pile = [state.pits[6], state.pits[13]];
  let mine = 0, theirs = 0, myHoles = 0, opHoles = 0, myLive = 0, opLive = 0, myThree = 0, opThree = 0, myRipe = 0, opRipe = 0;
  for (const i of RING) {
    const f = flagOf(state, i), n = state.pits[i];
    const owner = state.own ? state.own[i] : (i <= 6 ? 0 : 1);
    if (f === 4 || f === 5) { if (f - 4 === me) mine += n; else theirs += n; continue; } // a Tuz is its owner's at the end of the round
    if (f === 3) continue;                                   // shared (frozen): it will be split evenly
    if (f === 1 || f === 2) {                                // a four waiting for whoever may tap it
      if (f - 1 === me) { mine += n; myRipe += 1; } else { theirs += n; opRipe += 1; }
      continue;
    }
    if (owner === me) { mine += n; myHoles++; if (n > 0) myLive++; if (n === 3) myThree++; }
    else { theirs += n; opHoles++; if (n > 0) opLive++; if (n === 3) opThree++; }
  }
  const owned = pile[me] + mine - (pile[op] + theirs);       // who is winning the long game of rounds
  const banked = pile[me] - pile[op];                        // seeds already safe in a pile
  // The round ends when the side to move has nothing to lift, so having lots of liftable holes = tempo / safety.
  const live = myLive - opLive;
  const turnBonus = state.turn === me ? w.turn : -w.turn;
  // A hole holding three seeds is one seed from a four: good on my side (I can make it), a risk when it is theirs.
  // ጡዝ turns this round: a three in an OPPONENT hole is a Tuz waiting to be made by me; a three in MY hole is a Tuz I must not give away.
  const threes = (w.tuz ? (opThree - myThree) : (myThree - opThree)) * w.three;
  const ripe = (myRipe - opRipe) * w.ripe;
  return owned * w.owned + banked * w.banked + (myHoles - opHoles) * w.holes + live * w.live + threes + ripe + turnBonus;
}
export const WEIGHTS = { owned: 12, banked: 5, holes: 10, live: 3, three: 3, ripe: 5, turn: 2 }; // tuned by self-play (8/12 vs the first guess)

const hashKey = (s) => `${s.pits.join(',')}|${s.own ? s.own.join('') : ''}|${s.flag ? s.flag.join('') : ''}|${s.turn}`;

function ordered(state, moves, rules, hashMove) {
  // Best move from the previous (shallower) pass first, then the moves that bank the most seeds immediately.
  const out = moves.map((m) => { const r = playMove(state, m, rules, [], AUTO); return { m, r, k: r.captured + (r.newRound ? 2 : 0) + (m === hashMove ? 1000 : 0) }; });
  out.sort((a, b) => b.k - a.k);
  return out;
}

function search(state0, depth, alpha, beta, me, rules, ctx, ply) {
  if ((++ctx.nodes & 255) === 0 && Date.now() > ctx.deadline) throw new Timeout();
  const state = state0.over ? state0 : collectAll(state0).state; // players always tap their ripe families
  if (depth <= 0 || state.over) return ctx.evalFn ? ctx.evalFn(state, me) : evaluate(state, me, ctx.w);
  const k = `${ctx.rk}|${AUTO}|${hashKey(state)}`; // the rule set is part of the key: a search memory must never leak between Gebeta and አሻግሮ
  const hit = ctx.tt.get(k);
  let hashMove = null;
  if (hit) {
    hashMove = hit.move;
    if (hit.depth >= depth) {
      if (hit.flag === EXACT) return hit.v;
      if (hit.flag === LOWER && hit.v > alpha) alpha = hit.v;
      else if (hit.flag === UPPER && hit.v < beta) beta = hit.v;
      if (alpha >= beta) return hit.v;
    }
  }
  const maximizing = state.turn === me;
  const a0 = alpha, b0 = beta;
  let best = maximizing ? -Infinity : Infinity, bestMove = null;
  for (const { m, r } of ordered(state, legalMoves(state), rules, hashMove)) {
    const v = search(r.state, depth - 1, alpha, beta, me, rules, ctx, ply + 1);
    if (maximizing) { if (v > best) { best = v; bestMove = m; } if (v > alpha) alpha = v; }
    else { if (v < best) { best = v; bestMove = m; } if (v < beta) beta = v; }
    if (beta <= alpha) break;
  }
  const flag = best <= a0 ? UPPER : best >= b0 ? LOWER : EXACT; // fail-low = upper bound, fail-high = lower bound
  if (ctx.tt.size > 600000) ctx.tt.clear();
  ctx.tt.set(k, { v: best, depth, flag, move: bestMove });
  return best;
}

/** Searches `state` for up to `ms` and returns { move, depth, value }. Exposed for tests / tuning. */
let AUTO = -1; // seat of the computer while a search runs (it collects its own fours at once); -1 = nobody
export function think(state0, rules = 'gebeta', opt = {}) {
  AUTO = opt.auto == null ? -1 : opt.auto;
  try { return thinkInner(state0, rules, opt); } finally { AUTO = -1; }
}
function thinkInner(state0, rules = 'gebeta', { auto: _auto, depth = 40, ms = 1000, w = WEIGHTS, tt = new Map(), rng = Math.random, evalFn = null, only = null, evenOnly = rules === 'tuz' } = {}) {
  const state = collectAll(state0).state;
  const moves = only ? legalMoves(state).filter((m) => only.includes(m)) : legalMoves(state);
  if (!moves.length) return { move: undefined, depth: 0, value: 0 };
  if (moves.length <= 1) return { move: moves[0], depth: 0, value: 0 };
  const me = state.turn;
  const isTuz = rules === 'tuz';
  const ctx = { nodes: 0, deadline: Date.now() + ms, tt, w: isTuz ? { ...w, tuz: true, three: Math.max(w.three, 8) } : w, evalFn, rk: typeof rules === 'string' ? rules : 'gebeta' };
  let order = ordered(state, moves, rules, null);
  let bestMove = order[0].m, reached = 0, bestVal = 0;
  for (let d = 1; d <= depth; d++) {
    let iterBest = null, iterVal = -Infinity;
    try {
      for (const { m, r } of order) {
        // full window for the first move, a null-ish window is not worth the complexity here: ordering + TT do the work
        const v = search(r.state, d - 1, Math.max(iterVal, -Infinity), Infinity, me, rules, ctx, 1) + rng() * 0.001;
        if (v > iterVal) { iterVal = v; iterBest = m; }
      }
    } catch (e) { if (e instanceof Timeout) break; throw e; }
    if (iterBest != null) {
      // An odd-depth pass ends on the computer's own move and is over-optimistic (the horizon effect: measured 68% vs 99% for the
      // neighbouring even depth). So once an even pass of depth >= 4 exists, odd passes only warm the search memory; they never choose.
      if (d % 2 === 0 || d < 4 || !evenOnly || Math.abs(iterVal) >= WIN / 2) { bestMove = iterBest; reached = d; bestVal = iterVal; }
      else reached = Math.max(reached, d - 1);
      const i = order.findIndex((o) => o.m === iterBest);
      if (i > 0) order.unshift(order.splice(i, 1)[0]);
      if (Math.abs(iterVal) >= WIN / 2) break; // forced win / loss found
    }
    if (Date.now() > ctx.deadline) break;
  }
  return { move: bestMove, depth: reached, value: bestVal };
}

/** `opts.tt` keeps the search memory between turns (worker); `opts.maxMs` caps the clock (main-thread fallback). */
/**
 * አሻግሮ መብል: moves whose last stone comes to rest in the mover's own empty hole opposite a loaded opponent hole.
 * Those take the whole hole. The computer never lets one of them go: a depth-limited search used to prefer a
 * quiet move now and then (and the easy level plays randomly 35% of the time), which looked like "he forgot to take".
 */
export function captureMoves(state, rules = 'gebeta') {
  if (!getRules(rules).capture) return [];
  const out = [];
  for (const m of legalMoves(state)) {
    const r = playMove(state, m, rules, [], AUTO);
    const cap = r.ok && r.steps.find((x) => x.t === 'capture');
    if (cap) out.push({ m, n: cap.n });
  }
  return out;
}

export function chooseMove(state0, rules = 'gebeta', level = 'medium', rng = Math.random, opts = {}) {
  const state = collectAll(state0).state;
  const table = levelsFor(rules);
  const cfg = table[level] || table.medium;
  const moves = legalMoves(state);
  if (moves.length <= 1) return moves[0];
  const caps = captureMoves(state, rules);
  if (caps.length === 1) return caps[0].m;
  if (caps.length > 1) { // several captures: let the search pick the best one, but only among them (easy: simply the biggest)
    if (level === 'easy') return caps.sort((a, b) => b.n - a.n)[0].m;
    return think(state, rules, { depth: cfg.depth, ms: Math.min(cfg.ms, opts.maxMs || Infinity), rng, auto: opts.auto, only: caps.map((c) => c.m), ...(opts.tt ? { tt: opts.tt } : {}) }).move;
  }
  if (rng() < cfg.randomness) return moves[Math.floor(rng() * moves.length)];
  return think(state, rules, { depth: cfg.depth, ms: Math.min(cfg.ms, opts.maxMs || Infinity), rng, auto: opts.auto, ...(opts.tt ? { tt: opts.tt } : {}) }).move;
}
