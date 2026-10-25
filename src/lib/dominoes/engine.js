// Dominoes rules engine (double-six, two players) — pure functions, no UI, no Firebase.
// Shared by the browser (practice) and the server (authoritative online play).
//
// Tiles are [a, b] with a <= b when in a hand; tiles in the chain are stored as placed,
// so neighbours always touch: chain[i][1] === chain[i+1][0].
//
// Rules:
//  • 7 tiles each. Round 1: the highest double leads (else the heaviest tile) and that tile must open. Later rounds: the last winner leads any tile.
//  • Play a tile whose half matches an open end of the line.
//  • "draw" game: if you cannot play you must draw from the boneyard (one tile per tap) until you can.
//    "block" game: no drawing — you simply pass.
//  • A round ends when a player plays their last tile (they score the pips left in the other hand)
//    or when neither player can move (lower hand wins and scores the difference).
//  • First to the target score wins the match.

export const RULESETS = {
  draw: { id: 'draw', drawing: true, hand: 7 },
  block: { id: 'block', drawing: false, hand: 7 },
};
export const getRules = (id) => RULESETS[id] || RULESETS.draw;
export const TARGETS = [50, 100];
export const DEFAULT_TARGET = 50;

export const pips = (t) => t[0] + t[1];
export const handPips = (h) => h.reduce((a, t) => a + pips(t), 0);
export const canon = (t) => (t[0] <= t[1] ? [t[0], t[1]] : [t[1], t[0]]);
export const sameTile = (a, b) => (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
export const isDouble = (t) => t[0] === t[1];

export function fullSet() {
  const s = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) s.push([a, b]);
  return s;
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const ends = (chain) => (chain.length ? [chain[0][0], chain[chain.length - 1][1]] : null);

/** Every legal placement for a hand: [{tile, end:'L'|'R', placed:[a,b]}] */
export function playsFor(hand, chain, mustLead = null) {
  const plays = [];
  if (!chain.length) {
    for (const t of hand) {
      if (mustLead && !sameTile(t, mustLead)) continue;
      plays.push({ tile: t, end: 'R', placed: [t[0], t[1]] });
    }
    return plays;
  }
  const [L, R] = ends(chain);
  for (const t of hand) {
    if (t[0] === L || t[1] === L) plays.push({ tile: t, end: 'L', placed: t[1] === L ? [t[0], t[1]] : [t[1], t[0]] });
    if (t[0] === R || t[1] === R) plays.push({ tile: t, end: 'R', placed: t[0] === R ? [t[0], t[1]] : [t[1], t[0]] });
  }
  return plays;
}

export function newMatch(rulesetId = 'draw', target = DEFAULT_TARGET, rng = Math.random) {
  const rules = getRules(rulesetId);
  const s = {
    rules: rules.id, target: TARGETS.includes(target) ? target : DEFAULT_TARGET,
    round: 0, scores: [0, 0], phase: 'play', winner: null, lastWinner: null, lastStarter: 1,
    hands: [[], []], boneyard: [], chain: [], turn: 0, passes: 0, mustLead: null,
    voids: [[], []], roundResult: null,
  };
  return dealRound(s, rng);
}

function startingPlayer(hands) {
  let best = null;
  for (const seat of [0, 1]) for (const t of hands[seat]) {
    const score = isDouble(t) ? 100 + t[0] : pips(t) + t[1] / 10;
    if (!best || score > best.score) best = { score, seat, tile: t };
  }
  return best;
}

/** Deal a fresh round, keeping the match scores. */
export function dealRound(state, rng = Math.random) {
  const rules = getRules(state.rules);
  const deck = shuffle(fullSet(), rng);
  const hands = [deck.slice(0, rules.hand).map(canon), deck.slice(rules.hand, rules.hand * 2).map(canon)];
  const boneyard = deck.slice(rules.hand * 2);
  const next = {
    ...state, round: state.round + 1, phase: 'play', roundResult: null,
    hands, boneyard, chain: [], passes: 0, voids: [[], []],
  };
  if (state.round === 0) {
    // STRICT opening: the highest double (else the heaviest tile) in either hand leads, and that tile MUST be the first one played.
    const first = startingPlayer(hands);
    next.turn = first.seat; next.mustLead = first.tile.slice();
  } else {
    next.turn = state.lastWinner === 0 || state.lastWinner === 1 ? state.lastWinner : 1 - state.lastStarter;
    next.mustLead = null;
  }
  next.lastStarter = next.turn;
  return normalize(next).state;
}

export const cloneState = (s) => ({
  ...s, scores: s.scores.slice(), hands: s.hands.map((h) => h.map((t) => t.slice())), boneyard: s.boneyard.map((t) => t.slice()),
  chain: s.chain.map((t) => t.slice()), voids: s.voids.map((v) => v.slice()),
});

export const hasPlay = (state, seat = state.turn) => playsFor(state.hands[seat], state.chain, state.mustLead).length > 0;
export const mustDraw = (state) => state.phase === 'play' && getRules(state.rules).drawing && !hasPlay(state) && state.boneyard.length > 0;

function addVoids(state, seat) {
  const e = ends(state.chain);
  if (!e) return;
  for (const v of e) if (!state.voids[seat].includes(v)) state.voids[seat].push(v);
}

function endRound(state, winner, reason, points) {
  state.roundResult = { winner, reason, points, hands: state.hands.map((h) => h.map((t) => t.slice())), pipsLeft: state.hands.map(handPips) };
  if (winner === 0 || winner === 1) {
    state.scores[winner] += points;
    state.lastWinner = winner;
  } else state.lastWinner = null;
  if (winner === 0 || winner === 1) {
    if (state.scores[winner] >= state.target) { state.phase = 'over'; state.winner = winner; return; }
  }
  state.phase = 'roundOver';
}

/**
 * Settle whose move it is: auto-pass a player who cannot move (and cannot draw),
 * detect a blocked table, and detect a played-out hand. Returns { state, autoPasses:[seat…] }.
 */
export function normalize(state) {
  const s = cloneState(state);
  const autoPasses = [];
  if (s.phase !== 'play') return { state: s, autoPasses };
  for (let guard = 0; guard < 4; guard++) {
    if (s.hands[s.turn].length === 0) break;
    if (mustDraw(s) || hasPlay(s)) break;
    // cannot play and cannot draw → pass
    addVoids(s, s.turn);
    autoPasses.push(s.turn);
    s.passes += 1;
    if (s.passes >= 2) {
      const p = s.hands.map(handPips);
      if (p[0] === p[1]) endRound(s, 'tie', 'blocked', 0);
      else { const w = p[0] < p[1] ? 0 : 1; endRound(s, w, 'blocked', Math.abs(p[0] - p[1])); }
      return { state: s, autoPasses };
    }
    s.turn = 1 - s.turn;
  }
  return { state: s, autoPasses };
}

/** Play a tile. `tile` is any orientation of a tile in the current hand. */
export function playTile(state, tile, end) {
  if (state.phase !== 'play') return { ok: false, error: 'Round is not in progress' };
  if (!Array.isArray(tile) || tile.length !== 2 || !tile.every((n) => Number.isInteger(n) && n >= 0 && n <= 6)) return { ok: false, error: 'Bad tile' };
  const seat = state.turn;
  const play = playsFor(state.hands[seat], state.chain, state.mustLead).find((p) => sameTile(p.tile, tile) && (state.chain.length ? p.end === end : true));
  if (!play) return { ok: false, error: 'That tile does not fit' };
  const s = cloneState(state);
  s.hands[seat] = s.hands[seat].filter((t) => !sameTile(t, tile));
  if (play.end === 'L' && s.chain.length) s.chain.unshift(play.placed); else s.chain.push(play.placed);
  s.passes = 0; s.mustLead = null;
  let result = { ok: true, tile: play.placed, end: s.chain.length === 1 ? 'R' : play.end, by: seat, autoPasses: [] };
  if (s.hands[seat].length === 0) {
    endRound(s, seat, 'domino', handPips(s.hands[1 - seat]));
    return { ...result, state: s, domino: true };
  }
  s.turn = 1 - seat;
  const n = normalize(s);
  result.autoPasses = n.autoPasses;
  return { ...result, state: n.state };
}

/** Draw one tile from the boneyard (only when you cannot play). */
export function drawTile(state) {
  if (state.phase !== 'play') return { ok: false, error: 'Round is not in progress' };
  if (!mustDraw(state)) return { ok: false, error: 'You cannot draw now' };
  const s = cloneState(state);
  addVoids(s, s.turn);
  const t = s.boneyard.pop();
  s.hands[s.turn].push(canon(t));
  const n = normalize(s);
  return { ok: true, state: n.state, by: state.turn, tile: canon(t), autoPasses: n.autoPasses };
}

export function forfeit(state, loserSeat, reason = 'forfeit') {
  const s = cloneState(state);
  s.phase = 'over'; s.winner = 1 - loserSeat; s.reason = reason;
  return s;
}

export function validHand(h) {
  return Array.isArray(h) && h.every((t) => Array.isArray(t) && t.length === 2 && t.every((n) => Number.isInteger(n) && n >= 0 && n <= 6));
}

/** STRICT integrity check: the 28 tiles of a double-six set exist exactly once across hands, boneyard and line. */
export function validMatch(s) {
  if (!s || !Array.isArray(s.hands) || s.hands.length !== 2 || !s.hands.every(validHand)) return false;
  if (!validHand(s.boneyard || []) || !validHand(s.chain || [])) return false;
  const all = [...s.hands[0], ...s.hands[1], ...(s.boneyard || []), ...(s.chain || [])];
  if (all.length !== 28) return false;
  const seen = new Set(all.map((t) => canon(t).join('-')));
  if (seen.size !== 28) return false;
  for (let i = 0; i + 1 < (s.chain || []).length; i++) if (s.chain[i][1] !== s.chain[i + 1][0]) return false; // neighbours must touch
  return true;
}
