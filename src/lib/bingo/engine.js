// Bingo rules engine (75-ball) — pure functions, no UI.
//
// Card: 5×5, columns B I N G O. B 1-15 · I 16-30 · N 31-45 · G 46-60 · O 61-75. The centre square is FREE (stored as 0).
// Cards are generated column by column so every card is unique and obeys the ranges.
// Marking is MANUAL: a number may only be marked once it has been called, and nothing tells the player that a called
// number is on their card — noticing it is the skill. Calling BINGO before the pattern is complete is a false claim:
// the caller is locked out of claiming for the next three calls.
// Seat 0 = the human, seat 1 = the computer.

export const LETTERS = ['B', 'I', 'N', 'G', 'O'];
export const FREE = 12;
export const CALL_SECONDS = 6;       // the standard time between two calls
export const LOCKOUT_CALLS = 3;
export const letterOf = (n) => LETTERS[Math.min(4, Math.floor((n - 1) / 15))];

export const RULESETS = {
  line: { id: 'line', name: 'Any line' },
  corners: { id: 'corners', name: 'Four corners' },
  full: { id: 'full', name: 'Full house' },
};
export const getRules = (id) => RULESETS[id] || RULESETS.line;

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** 25 cells, row-major (index = row*5 + col). 0 is the FREE centre. */
export function makeCard(rng = Math.random) {
  const card = new Array(25).fill(0);
  for (let c = 0; c < 5; c++) {
    const pool = shuffle(Array.from({ length: 15 }, (_, i) => c * 15 + i + 1), rng).slice(0, 5);
    for (let r = 0; r < 5; r++) card[r * 5 + c] = pool[r];
  }
  card[FREE] = 0;
  return card;
}

const LINES = (() => {
  const out = [];
  for (let r = 0; r < 5; r++) out.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
  for (let c = 0; c < 5; c++) out.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
  out.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return out;
})();
export const patterns = (rulesetId) => {
  const id = getRules(rulesetId).id;
  if (id === 'corners') return [[0, 4, 20, 24]];
  if (id === 'full') return [Array.from({ length: 25 }, (_, i) => i)];
  return LINES;
};

export function newGame(rulesetId = 'line', rng = Math.random) {
  const marks = () => { const m = new Array(25).fill(false); m[FREE] = true; return m; };
  return {
    ruleset: getRules(rulesetId).id,
    deck: shuffle(Array.from({ length: 75 }, (_, i) => i + 1), rng),
    called: [],
    cards: [makeCard(rng), makeCard(rng)],
    marks: [marks(), marks()],
    lock: [0, 0], strikes: [0, 0],
    over: false, winner: null, reason: null, winLine: null,
  };
}
export const cloneState = (s) => ({ ...s, deck: s.deck.slice(), called: s.called.slice(), cards: s.cards.map((c) => c.slice()), marks: s.marks.map((m) => m.slice()), lock: s.lock.slice(), strikes: s.strikes.slice() });

/** Call the next ball. Every call also ticks down each player's lock-out. */
export function callNext(state) {
  if (state.over) return state;
  const s = cloneState(state);
  if (!s.deck.length) { s.over = true; s.winner = 'draw'; s.reason = 'exhausted'; return s; }
  s.called.push(s.deck.shift());
  s.lock = s.lock.map((n) => Math.max(0, n - 1));
  return s;
}

export const isCalled = (state, n) => n > 0 && state.called.includes(n);
export const canMark = (state, seat, idx) => {
  const n = state.cards[seat][idx];
  return !state.over && idx !== FREE && !state.marks[seat][idx] && isCalled(state, n);
};
export function mark(state, seat, idx) {
  if (!canMark(state, seat, idx)) return state;
  const s = cloneState(state);
  s.marks[seat][idx] = true;
  return s;
}

/** The completed pattern for a seat (array of cell indices) or null. */
export function completed(state, seat) {
  return patterns(state.ruleset).find((p) => p.every((i) => state.marks[seat][i])) || null;
}
/** How many more cells the best pattern still needs (0 = ready to call BINGO). */
export function toGo(state, seat) {
  let best = 25;
  for (const p of patterns(state.ruleset)) best = Math.min(best, p.filter((i) => !state.marks[seat][i]).length);
  return best;
}

/** Shout BINGO. Valid → the seat wins. Invalid → false claim, locked out for LOCKOUT_CALLS calls. */
export function claim(state, seat) {
  if (state.over) return { ok: false, state, error: 'over' };
  if (state.lock[seat] > 0) return { ok: false, state, error: 'locked' };
  const line = completed(state, seat);
  const s = cloneState(state);
  if (line) { s.over = true; s.winner = seat; s.reason = 'bingo'; s.winLine = line; return { ok: true, state: s }; }
  s.lock[seat] = LOCKOUT_CALLS; s.strikes[seat] += 1;
  return { ok: false, state: s, error: 'false' };
}

/** What a seat could still win with: cells that are one number away, used by the computer to decide what to watch. */
export const needed = (state, seat) => {
  const out = new Set();
  for (const p of patterns(state.ruleset)) {
    const open = p.filter((i) => !state.marks[seat][i]);
    if (open.length && open.length <= 2) open.forEach((i) => out.add(state.cards[seat][i]));
  }
  return out;
};

/** Computer behaviour per level: chance to overlook a called number, reaction time to mark and to shout BINGO (ms). */
export const AI_LEVELS = {
  easy: { miss: 0.22, mark: [1800, 3600], shout: [1700, 3000] },
  medium: { miss: 0.07, mark: [900, 2100], shout: [900, 1700] },
  hard: { miss: 0, mark: [350, 950], shout: [450, 900] },
};
