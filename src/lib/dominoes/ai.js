// Dominoes computer opponent. It only ever uses information a real player would have:
// its own hand, the line, the boneyard SIZE, and which numbers the opponent has shown it lacks.
import { playsFor, ends, pips, handPips, fullSet, sameTile, shuffle, playTile, drawTile, mustDraw, cloneState, canon } from './engine.js';

export const LEVELS = {
  easy: { randomness: 0.5, samples: 0 },
  medium: { randomness: 0.05, samples: 0 },
  hard: { randomness: 0, samples: 70 },
};

const countValue = (hand, v) => hand.reduce((n, t) => n + (t[0] === v) + (t[1] === v), 0);

/** Cheap heuristic: dump heavy tiles + doubles, keep a balanced hand, leave ends the opponent lacks. */
function heuristic(hand, chain, play, oppVoids) {
  const rest = hand.filter((t) => !sameTile(t, play.tile));
  const newEnds = (() => {
    const c = play.end === 'L' && chain.length ? [play.placed, ...chain] : [...chain, play.placed];
    return ends(c);
  })();
  let s = pips(play.tile) * 1.0 + (play.tile[0] === play.tile[1] ? 3 : 0);
  // Prefer ends I can follow up on, and ends the opponent cannot answer.
  for (const e of newEnds) { s += countValue(rest, e) * 1.6; if (oppVoids.includes(e)) s += 3.5; }
  // Keep variety: penalise leaving a hand heavy in a single number.
  for (let v = 0; v <= 6; v++) { const n = countValue(rest, v); if (n >= 4) s -= (n - 3) * 1.2; }
  return s;
}

function greedy(state, seat, rng) {
  const plays = playsFor(state.hands[seat], state.chain, state.mustLead);
  if (!plays.length) return null;
  let best = plays[0], bv = -Infinity;
  for (const p of plays) { const v = heuristic(state.hands[seat], state.chain, p, state.voids[1 - seat]) + rng() * 0.3; if (v > bv) { bv = v; best = p; } }
  return best;
}

/** Imagine the opponent's hand + boneyard consistent with what we know. */
function determinize(state, seat, rng) {
  const mine = state.hands[seat];
  const seen = [...mine, ...state.chain];
  const unseen = fullSet().filter((t) => !seen.some((x) => sameTile(x, t)));
  const oppN = state.hands[1 - seat].length;
  const voids = state.voids[1 - seat];
  const ok = shuffle(unseen.filter((t) => !voids.includes(t[0]) && !voids.includes(t[1])), rng);
  const hand = ok.slice(0, oppN);
  if (hand.length < oppN) { for (const t of shuffle(unseen, rng)) if (hand.length < oppN && !hand.some((x) => sameTile(x, t))) hand.push(t); }
  const boneyard = shuffle(unseen.filter((t) => !hand.some((x) => sameTile(x, t))), rng);
  const hands = [[], []]; hands[seat] = mine.map((t) => t.slice()); hands[1 - seat] = hand.map(canon);
  return { ...cloneState(state), hands, boneyard };
}

function rollout(state, me, rng) {
  let s = state, guard = 0;
  while (s.phase === 'play' && guard++ < 60) {
    if (mustDraw(s)) { s = drawTile(s).state; continue; }
    const p = greedy(s, s.turn, rng);
    if (!p) break;
    s = playTile(s, p.tile, p.end).state;
  }
  if (s.phase === 'play') return 0;
  const r = s.roundResult;
  if (!r || r.winner === 'tie') return 0;
  return (r.winner === me ? 1 : -1) * (r.points + 8); // winning matters more than the margin
}

/** Pick a play for `seat`. Returns {tile, end} or null if the AI has to draw/pass. */
export function chooseDominoPlay(state, level = 'medium', rng = Math.random) {
  const cfg = LEVELS[level] || LEVELS.medium;
  const seat = state.turn;
  const plays = playsFor(state.hands[seat], state.chain, state.mustLead);
  if (!plays.length) return null;
  if (plays.length === 1) return plays[0];
  if (rng() < cfg.randomness) return plays[Math.floor(rng() * plays.length)];
  if (!cfg.samples) return greedy(state, seat, rng);

  const totals = plays.map(() => 0);
  for (let k = 0; k < cfg.samples; k++) {
    const world = determinize(state, seat, rng);
    plays.forEach((p, i) => {
      const after = playTile(world, p.tile, p.end);
      if (!after.ok) return;
      let v;
      if (after.state.phase !== 'play') {
        const r = after.state.roundResult;
        v = r.winner === seat ? r.points + 8 : r.winner === 'tie' ? 0 : -(r.points + 8);
      } else v = rollout(after.state, seat, rng);
      totals[i] += v + heuristic(state.hands[seat], state.chain, p, state.voids[1 - seat]) * 0.05;
    });
  }
  let bi = 0;
  totals.forEach((v, i) => { if (v > totals[bi]) bi = i; });
  return plays[bi];
}
