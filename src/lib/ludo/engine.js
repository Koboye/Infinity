// Ludo — pure rules engine (no UI, no timers). Two boards share ONE rule set:
//   square   : the classic 52-cell cross, 2 or 4 players
//   triangle : a 54-cell ring with three identical sides, 3 players. Every seat is the same turn of 120°, so every seat has
//              exactly the same path length, the same safe cells and the same distance to home — nobody has an advantage.
// Token position `pos`:  -1 = in base · 0 … ringLen-2 = on the ring (relative to its own start cell)
//                        ringLen-1 … ringLen+3 = the 5 home-column cells · FINISH = ringLen+4 = home.
import { randomInt } from '../fairRandom.js';

export const BOARDS = {
  square: { ringLen: 52, seatStart: [0, 13, 26, 39], safeOffsets: [0, 8], seatCount: 4 },
  triangle: { ringLen: 54, seatStart: [9, 27, 45], safeOffsets: [0, 9], seatCount: 3 },
};
export const HOME_CELLS = 5;
export const finishOf = (board) => BOARDS[board].ringLen + HOME_CELLS - 1;
export const lastRingRel = (board) => BOARDS[board].ringLen - 2;

/** Which seats play: 2 players sit opposite each other on the square board. */
export function seatsFor(players) {
  if (players === 2) return { board: 'square', seats: [0, 2] };
  if (players === 3) return { board: 'triangle', seats: [0, 1, 2] };
  if (players === 4) return { board: 'square', seats: [0, 1, 2, 3] };
  throw new RangeError('Ludo is for 2, 3 or 4 players');
}

/** A fair die: uniform 1..6 (rejection sampling on a cryptographic source — no modulo bias). */
export const rollDie = (next32) => 1 + randomInt(6, next32);

export function newGame({ players = 4, tokens = 4, start = 0 } = {}) {
  const { board, seats } = seatsFor(players);
  return {
    board, seats, n: players, tokensPer: tokens === 2 ? 2 : 4,
    pos: seats.map(() => Array(tokens === 2 ? 2 : 4).fill(-1)),
    turn: Math.max(0, Math.min(players - 1, start)), dice: null, sixes: 0, phase: 'roll',
    ranks: [], over: false, moves: 0, last: null,
    stats: newStats(players), log: [],
  };
}

/** Per-player counters shown on the result screen. */
const newStats = (n) => ({ rolls: Array(n).fill(0), sixes: Array(n).fill(0), captures: Array(n).fill(0), lost: Array(n).fill(0), best: Array(n).fill(0) });
const LOG_MAX = 400;
const cloneStats = (st) => st && ({ rolls: st.rolls.slice(), sixes: st.sixes.slice(), captures: st.captures.slice(), lost: st.lost.slice(), best: st.best.slice() });
const clone = (s) => ({ ...s, pos: s.pos.map((a) => a.slice()), ranks: s.ranks.slice(), stats: cloneStats(s.stats) || newStats(s.n), log: (s.log || []).slice(-LOG_MAX) });

/** Absolute ring index (0 … ringLen-1) of player p's token at relative position pos (ring part only). */
export const absOf = (s, p, pos) => (BOARDS[s.board].seatStart[s.seats[p]] + pos) % BOARDS[s.board].ringLen;
export const isSafeAbs = (s, a) => {
  const B = BOARDS[s.board];
  return B.seatStart.some((st) => B.safeOffsets.some((o) => (st + o) % B.ringLen === a));
};
const onRing = (s, pos) => pos >= 0 && pos <= lastRingRel(s.board);

/** Opponent tokens standing on ring cell `a`, grouped by player: [{p, idx:[…]}]. */
function occupants(s, a, exceptP) {
  const out = [];
  for (let p = 0; p < s.n; p++) {
    if (p === exceptP) continue;
    const idx = [];
    s.pos[p].forEach((pos, i) => { if (onRing(s, pos) && absOf(s, p, pos) === a) idx.push(i); });
    if (idx.length) out.push({ p, idx });
  }
  return out;
}

/** What would moving token i of player p by `d` do? null if illegal. */
export function previewMove(s, p, i, d) {
  const pos = s.pos[p][i], F = finishOf(s.board);
  let to;
  if (pos === -1) { if (d !== 6) return null; to = 0; }
  else { to = pos + d; if (to > F) return null; } // exact roll needed to reach home
  const captured = [];
  if (onRing(s, to)) {
    const a = absOf(s, p, to);
    if (!isSafeAbs(s, a)) for (const o of occupants(s, a, p)) if (o.idx.length === 1) captured.push({ p: o.p, i: o.idx[0] }); // two of a colour on one cell form a block
  }
  return { to, captured, finishes: to === F, leaves: pos === -1 };
}

export function legalMoves(s) {
  if (s.over || s.phase !== 'move' || s.dice == null) return [];
  const out = [];
  for (let i = 0; i < s.tokensPer; i++) if (previewMove(s, s.turn, i, s.dice)) out.push(i);
  return out;
}

const done = (s, p) => s.pos[p].every((x) => x === finishOf(s.board));
function nextPlayer(s, from) {
  for (let k = 1; k <= s.n; k++) { const q = (from + k) % s.n; if (!s.ranks.includes(q)) return q; }
  return from;
}
function endTurn(s, bonus) {
  const p = s.turn;
  s.dice = null; s.phase = 'roll';
  if (!bonus || s.ranks.includes(p)) { s.sixes = 0; s.turn = nextPlayer(s, p); }
}

/** Apply a die value. Returns { state, moves, forfeited }. With no legal move the turn passes (a 6 that cannot move gives no extra roll). */
export function applyRoll(state, value) {
  if (state.over || state.phase !== 'roll') return { state, error: 'Not time to roll' };
  const s = clone(state);
  s.dice = value; s.last = null;
  s.stats.rolls[s.turn]++; if (value === 6) s.stats.sixes[s.turn]++;
  s.sixes = value === 6 ? s.sixes + 1 : 0;
  if (value === 6 && s.sixes >= 3) { const r = { state: s, forfeited: true, moves: [] }; endTurn(s, false); return r; } // three sixes in a row: turn lost
  s.phase = 'move';
  const moves = legalMoves(s);
  if (!moves.length) { s.phase = 'roll'; const dice = s.dice; endTurn(s, false); s.last = { p: state.turn, dice, none: true }; return { state: s, moves: [], none: true }; }
  return { state: s, moves };
}

/** Play token i with the pending die. Bonus roll on a 6, a capture, or reaching home. */
export function applyMove(state, i) {
  if (state.over || state.phase !== 'move') return { ok: false, error: 'Roll first' };
  const s = clone(state), p = s.turn, d = s.dice;
  const pv = previewMove(s, p, i, d);
  if (!pv) return { ok: false, error: 'Illegal move' };
  const from = s.pos[p][i];
  s.pos[p][i] = pv.to;
  for (const c of pv.captured) s.pos[c.p][c.i] = -1;
  let finishedPlayer = false;
  if (pv.finishes && done(s, p) && !s.ranks.includes(p)) { s.ranks.push(p); finishedPlayer = true; }
  if (s.ranks.length >= s.n - 1) { // everyone but one is home: the last one takes the last place
    for (let q = 0; q < s.n; q++) if (!s.ranks.includes(q)) s.ranks.push(q);
    s.over = true;
  }
  s.moves++;
  s.stats.captures[p] += pv.captured.length; pv.captured.forEach((c) => { s.stats.lost[c.p]++; });
  s.stats.best[p] = Math.max(s.stats.best[p], pv.to);
  s.last = { p, i, from, to: pv.to, dice: d, captured: pv.captured, finishes: pv.finishes, leaves: pv.leaves, finishedPlayer };
  s.log.push({ n: s.moves, p, i, dice: d, from, to: pv.to, cap: pv.captured.length, home: pv.finishes, out: pv.leaves });
  if (s.log.length > LOG_MAX) s.log.shift();
  const bonus = !s.over && !finishedPlayer && (d === 6 || pv.captured.length > 0 || pv.finishes);
  if (s.over) { s.dice = null; s.phase = 'roll'; } else endTurn(s, bonus);
  return { ok: true, state: s, ...s.last, bonus };
}

/** Relative positions the token passes through for its animation (from → to). */
export function pathOf(s, from, to) {
  if (from === -1) return [0];
  const out = []; for (let x = from + 1; x <= to; x++) out.push(x); return out;
}

/* ───────── computer ───────── */
export const AI_LEVELS = {
  easy: { random: 0.55, danger: 0.3 },
  medium: { random: 0.18, danger: 0.9 },
  hard: { random: 0.02, danger: 1.4 },
};

/** Opponent tokens that could hit a token standing on ring cell `a` with a roll of 1…6 (ignores blocks/safe — caller checks those). */
function threats(s, p, a) {
  let n = 0;
  for (let q = 0; q < s.n; q++) {
    if (q === p) continue;
    for (const pos of s.pos[q]) {
      if (!onRing(s, pos)) continue;
      const b = absOf(s, q, pos), dist = (a - b + BOARDS[s.board].ringLen) % BOARDS[s.board].ringLen;
      if (dist >= 1 && dist <= 6 && pos + dist <= lastRingRel(s.board)) n++;
    }
  }
  return n;
}

/** Opponent tokens 1…6 cells ahead of ring cell `a` (where player p's token, at relative `rel`, would stand) that a roll could hit. */
function chase(s, p, a, rel) {
  const B = BOARDS[s.board]; let n = 0;
  for (let q = 0; q < s.n; q++) {
    if (q === p) continue;
    for (const pos of s.pos[q]) {
      if (!onRing(s, pos)) continue;
      const b = absOf(s, q, pos), dist = (b - a + B.ringLen) % B.ringLen;
      if (dist >= 1 && dist <= 6 && rel + dist <= lastRingRel(s.board) && !isSafeAbs(s, b)) n++;
    }
  }
  return n;
}

export function scoreMove(s, i, level = 'hard') {
  const cfg = AI_LEVELS[level] || AI_LEVELS.hard, p = s.turn, d = s.dice, pos = s.pos[p][i];
  const pv = previewMove(s, p, i, d); if (!pv) return -Infinity;
  const L = lastRingRel(s.board);
  let v = 0;
  if (pv.finishes) v += 120;
  if (pv.captured.length) { for (const c of pv.captured) v += 70 + s.pos[c.p][c.i] * 0.9; }
  if (pv.leaves) v += 38 + (s.pos[p].filter((x) => x === -1).length - 1) * 2;
  if (pos > L) v += 2 + d; // inside the home column: nothing can hit it
  if (pv.to > L && pos <= L) v += 24; // entering the home column = safe for good
  v += d * 1.2 + pv.to * 0.15;
  const abs = onRing(s, pv.to) ? absOf(s, p, pv.to) : -1;
  const safeTo = abs >= 0 && isSafeAbs(s, abs);
  if (safeTo) v += 18;
  // a friend already there makes a block
  if (abs >= 0 && s.pos[p].some((x, j) => j !== i && x === pv.to)) v += 12;
  // pressure: finishing a move 1…6 cells behind an unprotected opponent sets up a capture next turn
  if (abs >= 0 && !safeTo) v += chase(s, p, abs, pv.to) * 3.2 * cfg.danger;
  // risk now vs. after the move
  const risk = (cell, safe) => (cell < 0 || safe ? 0 : threats(s, p, cell));
  const here = onRing(s, pos) ? risk(absOf(s, p, pos), isSafeAbs(s, absOf(s, p, pos)) || s.pos[p].filter((x) => x === pos).length > 1) : 0;
  const there = risk(abs, safeTo);
  const worth = 10 + Math.max(0, pos) * 0.9;
  v += (here - there) * worth * 0.55 * cfg.danger;
  // keep the leader moving once things are calm
  if (pos >= 0 && pos <= L && there === 0) v += pos * 0.05;
  return v;
}

export function chooseToken(state, level = 'medium', rng = Math.random) {
  const moves = legalMoves(state); if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  const cfg = AI_LEVELS[level] || AI_LEVELS.medium;
  if (rng() < cfg.random) return moves[Math.floor(rng() * moves.length)];
  let best = moves[0], bv = -Infinity;
  for (const i of moves) { const v = scoreMove(state, i, level) + rng() * 0.3; if (v > bv) { bv = v; best = i; } }
  return best;
}

/** Tokens that are visibly different moves (two tokens on the same cell count once) — used for "auto-move when there is no real choice". */
export function distinctMoves(state) {
  const seen = new Set(), out = [];
  for (const i of legalMoves(state)) { const k = state.pos[state.turn][i]; if (!seen.has(k)) { seen.add(k); out.push(i); } }
  return out;
}

/** Sanity check used by the tests. */
export function validState(s) {
  const F = finishOf(s.board);
  return s.pos.length === s.n && s.pos.every((a) => a.length === s.tokensPer && a.every((x) => Number.isInteger(x) && x >= -1 && x <= F));
}

/* ───────── helpers for the interface ───────── */

/** Every legal move of the player to move, with what it would do: [{ i, from, to, captured, finishes, leaves, safe, block }]. */
export function previewAll(state) {
  const out = [];
  for (const i of legalMoves(state)) {
    const pv = previewMove(state, state.turn, i, state.dice), from = state.pos[state.turn][i];
    const abs = onRing(state, pv.to) ? absOf(state, state.turn, pv.to) : -1;
    out.push({ i, from, ...pv, safe: abs >= 0 && isSafeAbs(state, abs), block: abs >= 0 && state.pos[state.turn].some((x, j) => j !== i && x === pv.to) });
  }
  return out;
}

/** The move the strongest computer would play — used by the Hint button. Deterministic. */
export const hintMove = (state) => chooseToken(state, 'hard', () => 0.5);

/** How far (0…1) a player is from winning: the share of the journey all of their tokens have covered. */
export function progressOf(state, p) {
  const F = finishOf(state.board);
  return state.pos[p].reduce((a, x) => a + (x < 0 ? 0 : x) / F, 0) / state.tokensPer;
}

/** A plain-JSON snapshot that can be stored and later handed to `restoreGame`. */
export const serializeGame = (s) => JSON.stringify({ v: 2, ...s, log: (s.log || []).slice(-60) });

/** Rebuild a game from `serializeGame` output. Returns null for anything that is not a valid, unfinished game of the expected shape. */
export function restoreGame(json, expect = {}) {
  try {
    const o = typeof json === 'string' ? JSON.parse(json) : json;
    if (!o || o.v !== 2 || !BOARDS[o.board] || !Number.isInteger(o.n) || o.n < 2 || o.n > 4) return null;
    const ref = newGame({ players: o.n, tokens: o.tokensPer });
    if (o.board !== ref.board || JSON.stringify(o.seats) !== JSON.stringify(ref.seats)) return null;
    if (expect.players && o.n !== expect.players) return null;
    if (expect.tokens && o.tokensPer !== expect.tokens) return null;
    if (!Number.isInteger(o.turn) || o.turn < 0 || o.turn >= o.n || !['roll', 'move'].includes(o.phase)) return null;
    const s = { ...ref, ...o, stats: o.stats && o.stats.rolls?.length === o.n ? o.stats : ref.stats, log: Array.isArray(o.log) ? o.log : [] };
    delete s.v;
    if (!validState(s) || !Array.isArray(s.ranks) || s.over) return null;
    if (s.phase === 'move' && !(s.dice >= 1 && s.dice <= 6)) return null;
    return s;
  } catch { return null; }
}
