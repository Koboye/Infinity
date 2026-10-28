// Ludo computer player — a real look-ahead search, not a rule-of-thumb picker.
//
//   Expectimax over the dice:  my move → opponent rolls (1/6 each) → opponent's best reply → I roll (1/6 each) → my best move → score.
//   • Chance nodes average the six die faces, so a pawn that can only be hit by a 4 is judged 1/6 risky, one that sits in front of two
//     hunters is judged 2/6 risky, and a capture that sets up another capture is seen two moves ahead.
//   • Opponents are assumed to play the reply that is worst for me ("paranoid" search), so the computer never relies on a mistake.
//   • The score counts progress, pawns out of base, safe stars, blocks, pawns about to be hit, and pawns that can hit an opponent next turn.
//     Sending an opponent's pawn back to base is worth exactly what that pawn had travelled, so it hunts the pawns that matter most.
//
// Levels: easy = the old rule-of-thumb picker with plenty of slips · medium = 3-ply search with the odd slip · hard = 5-ply search, never slips.
// Pure functions (no UI, no timers); the engine is never mutated.
import { BOARDS, finishOf, lastRingRel, legalMoves, previewMove, applyRoll, applyMove, absOf, isSafeAbs, distinctMoves, chooseToken as basicChoose } from './engine.js';

export const SEARCH = {
  easy: { depth: 0, slip: 0.55 },
  medium: { depth: 3, slip: 0.08 },
  hard: { depth: 5, slip: 0 },
};

const WIN = 1e4;
const onRing = (s, pos) => pos >= 0 && pos <= lastRingRel(s.board);

/** How much one pawn is "worth" (what it would cost to lose it, or what it is worth to send it back). */
export function tokenValue(s, pos) {
  const F = finishOf(s.board);
  if (pos < 0) return 0;
  if (pos === F) return F + 14;                       // home: safe for good
  if (pos > lastRingRel(s.board)) return pos + 12;    // inside the home column: nobody can touch it
  return pos + 6;                                     // on the ring: distance travelled + the six it took to get out
}

/** Chance (0…1) that a pawn standing on ring cell `a` is hit by the next roll of the opponents of `p`. Distinct die faces count once each. */
function hitChance(s, p, a) {
  const B = BOARDS[s.board], faces = new Set();
  for (let q = 0; q < s.n; q++) {
    if (q === p) continue;
    for (const pos of s.pos[q]) {
      if (!onRing(s, pos)) continue;
      const dist = (a - absOf(s, q, pos) + B.ringLen) % B.ringLen;
      if (dist >= 1 && dist <= 6 && pos + dist <= lastRingRel(s.board)) faces.add(dist);
    }
  }
  return faces.size / 6;
}

/** Chance that player p, on the move, can hit an unprotected opponent pawn that stands 1…6 cells ahead of ring cell `a` — and what it would win. */
function huntValue(s, p, a, rel) {
  const B = BOARDS[s.board], best = new Map();
  for (let q = 0; q < s.n; q++) {
    if (q === p) continue;
    const counts = new Map(); s.pos[q].forEach((pos) => { if (onRing(s, pos)) counts.set(pos, (counts.get(pos) || 0) + 1); });
    for (const [pos, n] of counts) {
      if (n > 1) continue;                            // a block cannot be hit
      const b = absOf(s, q, pos), dist = (b - a + B.ringLen) % B.ringLen;
      if (dist < 1 || dist > 6 || isSafeAbs(s, b) || rel + dist > lastRingRel(s.board)) continue;
      const w = tokenValue(s, pos) + 8;               // a hit also costs them a six to get out again
      if (!best.has(dist) || best.get(dist) < w) best.set(dist, w);
    }
  }
  let v = 0; for (const w of best.values()) v += w / 6;
  return v;
}

/** Static score of a position from the point of view of player `me` (higher = better for me). */
export function evaluate(s, me) {
  if (s.over) return s.ranks[0] === me ? WIN : -WIN + (s.ranks.indexOf(me) === 1 ? 2000 : 0);
  const side = (p) => {
    let v = 0; const seen = new Map(); s.pos[p].forEach((pos) => seen.set(pos, (seen.get(pos) || 0) + 1));
    s.pos[p].forEach((pos) => {
      v += tokenValue(s, pos);
      if (!onRing(s, pos)) return;
      const a = absOf(s, p, pos), safe = isSafeAbs(s, a), block = seen.get(pos) > 1;
      if (safe) v += 2.5; else if (block) v += 2;
      if (!safe && !block) v -= hitChance(s, p, a) * (tokenValue(s, pos) + 6) * 0.95;   // pawn in the line of fire
      v += huntValue(s, p, a, pos) * 0.55;                                              // pawn that threatens a hit next turn
    });
    return v;
  };
  let opp = 0, n = 0;
  for (let q = 0; q < s.n; q++) if (q !== me && !s.ranks.includes(q)) { opp += side(q); n++; }
  return side(me) - (n ? opp / n : 0) * (s.n > 2 ? 1.15 : 1);
}

/** Expectimax value of `s` for player `me`; `d` = how many more nodes (chance or choice) may be expanded. */
function value(s, me, d) {
  if (s.over || d <= 0) return evaluate(s, me);
  if (s.phase === 'roll') {
    let sum = 0;
    for (let face = 1; face <= 6; face++) sum += value(applyRoll(s, face).state, me, d - 1);
    return sum / 6;
  }
  const moves = distinctMoves(s);
  if (!moves.length) return evaluate(s, me);
  const mine = s.turn === me; let best = mine ? -Infinity : Infinity;
  for (const i of moves) {
    const v = value(applyMove(s, i).state, me, d - 1);
    if (mine ? v > best : v < best) best = v;
  }
  return best;
}

/** Score of every legal move of the player to move: [{ i, v }] best first. Deterministic. */
export function rankMoves(state, depth = SEARCH.hard.depth) {
  const s = { ...state, log: [] };                    // the move log is not needed inside the search
  const me = s.turn, out = [], seen = new Map();
  for (const i of legalMoves(s)) {
    const key = s.pos[me][i];
    if (seen.has(key)) { out.push({ i, v: seen.get(key) }); continue; }   // two pawns on one cell play the same move
    const m = applyMove(s, i);
    let v = value(m.state, me, depth - 1);
    const pv = previewMove(s, me, i, s.dice);
    // a kill is the computer's favourite move: sending a pawn home costs the opponent everything it travelled plus a six to get out again
    if (pv.captured.length) v += pv.captured.reduce((n, c) => n + tokenValue(s, s.pos[c.p][c.i]) + 8, 0) * 0.9;
    v += pv.captured.length * 0.01 + (pv.finishes ? 0.02 : 0) + pv.to * 1e-4;          // tie-breakers: hit, finish, then the pawn furthest along
    seen.set(key, v); out.push({ i, v });
  }
  return out.sort((a, b) => b.v - a.v || a.i - b.i);
}

/** The computer's move. level: easy | medium | hard. Returns a token index (or null when there is no legal move). */
export function chooseSmart(state, level = 'medium', rng = Math.random) {
  const moves = legalMoves(state); if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  const cfg = SEARCH[level] || SEARCH.medium;
  if (cfg.depth === 0) {
    const k = moves.filter((i) => { const pv = previewMove(state, state.turn, i, state.dice); return pv && pv.captured.length > 0; });
    if (k.length && rng() < 0.7) return k[0];                                              // even the easy computer usually takes a kill
    return basicChoose(state, 'easy', rng);
  }
  const kills = moves.filter((i) => { const pv = previewMove(state, state.turn, i, state.dice); return pv && pv.captured.length > 0; });
  if (!kills.length && rng() < cfg.slip) return moves[Math.floor(rng() * moves.length)];   // never slips when a kill is on the table
  return rankMoves(state, cfg.depth)[0].i;
}

/** What the Hint button shows: the best move the strongest computer finds. Deterministic. */
export const bestMove = (state) => { const m = legalMoves(state); return m.length ? (m.length === 1 ? m[0] : rankMoves(state, SEARCH.hard.depth)[0].i) : null; };
