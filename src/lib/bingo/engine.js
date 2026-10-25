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
export const LOCKOUT_CALLS = 1;     // a false BINGO also blocks another claim for the next call…
export const FREEZE_MS = 5000;      // …and freezes the board (no daubing) for five seconds
export const MAX_CARDS = 4;
export const PERFECT_MS = 1000;     // tap a called number within a second = Perfect Daub
export const POWER_MAX = 5;         // perfect daubs needed to fill the power-up meter
export const letterOf = (n) => LETTERS[Math.min(4, Math.floor((n - 1) / 15))];

export const RULESETS = {
  line: { id: 'line', name: 'Any line' },
  corners: { id: 'corners', name: 'Four corners' },
  full: { id: 'full', name: 'Blackout (full house)' },
  stamp: { id: 'stamp', name: 'Postage stamp' },
  xshape: { id: 'xshape', name: 'X shape' },
  plus: { id: 'plus', name: 'Plus shape' },
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
  if (id === 'stamp') return [[0, 1, 5, 6], [3, 4, 8, 9], [15, 16, 20, 21], [18, 19, 23, 24]]; // a 2×2 block in any corner
  if (id === 'xshape') return [[0, 4, 6, 8, 12, 16, 18, 20, 24]];                                 // both diagonals
  if (id === 'plus') return [[2, 7, 10, 11, 12, 13, 14, 17, 22]];                                  // centre row + column
  if (id === 'full') return [Array.from({ length: 25 }, (_, i) => i)];
  return LINES;
};

const freshMarks = () => { const m = new Array(25).fill(false); m[FREE] = true; return m; };

/** `numCards` (1-4) is how many cards seat 0 plays at once; the computer always plays one. */
export function newGame(rulesetId = 'line', rng = Math.random, numCards = 1) {
  const n = Math.max(1, Math.min(MAX_CARDS, numCards | 0 || 1));
  // three treasure chests hide behind random numbers: daub one and the loot is yours
  const chests = {};
  for (const num of shuffle(Array.from({ length: 75 }, (_, i) => i + 1), rng).slice(0, 3)) chests[num] = 10 + Math.floor(rng() * 4) * 5;
  return {
    ruleset: getRules(rulesetId).id,
    deck: shuffle(Array.from({ length: 75 }, (_, i) => i + 1), rng),
    called: [],
    cards: [makeCard(rng), makeCard(rng)],
    marks: [freshMarks(), freshMarks()],
    extra: Array.from({ length: n - 1 }, () => ({ card: makeCard(rng), marks: freshMarks() })), // seat 0's 2nd-4th cards
    chests, shield: [0, 0],
    lock: [0, 0], strikes: [0, 0],
    over: false, winner: null, reason: null, winLine: null, winCard: 0,
  };
}
export const cloneState = (s) => ({
  ...s, deck: s.deck.slice(), called: s.called.slice(), cards: s.cards.map((c) => c.slice()), marks: s.marks.map((m) => m.slice()),
  extra: (s.extra || []).map((e) => ({ card: e.card.slice(), marks: e.marks.slice() })),
  shield: (s.shield || [0, 0]).slice(), lock: s.lock.slice(), strikes: s.strikes.slice(),
});

/** Every card a seat plays: [{ card, marks, k }] — k = 0 is the main card. */
export function cardsOf(state, seat) {
  const out = [{ card: state.cards[seat], marks: state.marks[seat], k: 0 }];
  if (seat === 0) (state.extra || []).forEach((e, i) => out.push({ card: e.card, marks: e.marks, k: i + 1 }));
  return out;
}

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
const slot = (state, seat, k) => cardsOf(state, seat)[k] || null;
export const canMark = (state, seat, idx, k = 0) => {
  const c = slot(state, seat, k);
  if (!c) return false;
  return !state.over && idx !== FREE && !c.marks[idx] && isCalled(state, c.card[idx]);
};
export function mark(state, seat, idx, k = 0) {
  if (!canMark(state, seat, idx, k)) return state;
  const s = cloneState(state);
  slot(s, seat, k).marks[idx] = true;
  return s;
}
/** Treasure behind a number (0 = none). */
export const chestAt = (state, n) => (state.chests && state.chests[n]) || 0;

/** Power-up: Instant Daub — marks a random called number you have not marked yet (any of your cards). */
export function instantDaub(state, seat, rng = Math.random) {
  const options = [];
  for (const c of cardsOf(state, seat)) c.card.forEach((n, i) => { if (i !== FREE && !c.marks[i] && isCalled(state, n)) options.push([c.k, i]); });
  if (!options.length) return { state, picked: [] };
  const [k, i] = options[Math.floor(rng() * options.length)];
  const s = cloneState(state); slot(s, seat, k).marks[i] = true;
  return { state: s, picked: [[k, i]] };
}
/** Power-up: Double Daub — reveals and marks two numbers that have NOT been called yet. */
export function doubleDaub(state, seat, rng = Math.random) {
  const options = [];
  for (const c of cardsOf(state, seat)) c.card.forEach((n, i) => { if (i !== FREE && !c.marks[i] && !isCalled(state, n)) options.push([c.k, i]); });
  const s = cloneState(state); const picked = [];
  for (let n = 0; n < 2 && options.length; n++) {
    const [k, i] = options.splice(Math.floor(rng() * options.length), 1)[0];
    slot(s, seat, k).marks[i] = true; picked.push([k, i]);
  }
  return { state: s, picked };
}
/** Power-up: Shield — the next false BINGO costs nothing. */
export function grantShield(state, seat) { const s = cloneState(state); s.shield[seat] += 1; return s; }

/** The completed pattern for a seat (array of cell indices) or null. */
export function completed(state, seat) {
  return completedOn(state, seat)?.line || null;
}
/** Like completed, but also says which card finished: { k, line } or null. */
export function completedOn(state, seat) {
  for (const c of cardsOf(state, seat)) {
    const line = patterns(state.ruleset).find((p) => p.every((i) => c.marks[i]));
    if (line) return { k: c.k, line };
  }
  return null;
}
/** How many more cells the best pattern still needs (0 = ready to call BINGO). */
export function toGo(state, seat) {
  let best = 25;
  for (const c of cardsOf(state, seat)) for (const p of patterns(state.ruleset)) best = Math.min(best, p.filter((i) => !c.marks[i]).length);
  return best;
}

/** Shout BINGO. Valid → the seat wins. Invalid → false claim, locked out for LOCKOUT_CALLS calls. */
export function claim(state, seat) {
  if (state.over) return { ok: false, state, error: 'over' };
  if (state.lock[seat] > 0) return { ok: false, state, error: 'locked' };
  const done = completedOn(state, seat);
  const s = cloneState(state);
  if (done) { s.over = true; s.winner = seat; s.reason = 'bingo'; s.winLine = done.line; s.winCard = done.k; return { ok: true, state: s }; }
  if (s.shield[seat] > 0) { s.shield[seat] -= 1; return { ok: false, state: s, error: 'shielded' }; } // the Shield absorbs the mistake
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
  easy: { miss: 0.05, mark: [900, 1900], shout: [900, 1700] },
  medium: { miss: 0.01, mark: [500, 1200], shout: [450, 1000] },
  hard: { miss: 0, mark: [150, 450], shout: [180, 420] },
};
