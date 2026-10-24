// Gebeta rules engine (Ethio Gebeta — Version 1.0) — pure functions, no UI, no Firebase.
// Shared by the browser (practice, animation) and the server (authoritative online moves).
//
// Board: 12 holes, 6 per player, 4 seeds each (48 seeds = 12 families of four).
//   Seat 0 owns holes 0-5 (left→right along the bottom row).
//   Seat 1 owns holes 7-12 (right→left along the top row, seen from seat 0).
// Slots 6 and 13 are NOT holes: they are each player's "captured families" pile.
// Sowing runs counter-clockwise through the 12 holes only:  0→1→…→5→7→8→…→12→0.
//
// Turn:
//   1. Pick up every seed from one of your non-empty holes.
//   2. Drop them one by one into the next holes.
//   3. A hole that reaches exactly four seeds is a family and is captured at once.
//        – mid-sowing: the OWNER of that hole gets the family, sowing carries on;
//        – with the last seed: the player making the move gets it, and the turn ends.
//   4. Last seed in a hole that already had seeds (and did not make a family) → lift that hole and keep sowing.
//   5. Last seed in an empty hole → turn ends.
// MANUAL FAMILIES: a hole that reaches four is NOT taken automatically. It is marked "ripe" for the player
//   entitled to it (the hole's owner when the four was made mid-sowing, the mover when his last seed made it).
//   Ripe holes cannot be lifted. The entitled player taps a ripe hole to collect it (a free action, allowed at any moment
//   between moves — not only on his own turn). A stone that lands in a ripe hole before it is collected freezes it (SHARED).
//   If he makes a sowing move without collecting, the hole becomes SHARED (locked): nobody can lift it, seeds keep
//   piling into it, and when the round ends its content is split equally; an odd seed goes to a lottery.
// A ROUND ends when the player to move has no seeds on their side: the opponent takes what is left.
// Then a new round is dealt: each player re-fills their own six holes from the seeds they now own
// (4 per hole, first hole first; seeds beyond 24 wait in the pile as a reserve). The player who won
// the round (more seeds) moves first. Rounds go on without limit until one player owns no seeds at all —
// that player has lost the game.

export const STORE = [6, 13];
export const PITS = [[0, 1, 2, 3, 4, 5], [7, 8, 9, 10, 11, 12]];
export const TOTAL_SLOTS = 14;
export const FAMILY = 4;
export const MAX_RELAYS = 300; // safety cap so relay chains can never loop forever

export const RULESETS = {
  gebeta: { id: 'gebeta', seeds: 4, relay: true, family: FAMILY, extraTurn: false },
};

export const getRules = (id) => RULESETS[id] || RULESETS.gebeta;
export const ownerOf = (i, own) => (own ? own[i] : (i <= 6 ? 0 : 1));
export const isStore = (i) => i === 6 || i === 13;
/** Holes in sowing order (ring positions 0..11). */
export const RING = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12];
export const defaultOwn = () => { const o = new Array(14).fill(0); for (const i of PITS[1]) o[i] = 1; o[13] = 1; return o; };
/** Holes a seat owns right now (they change hands between rounds). */
export const FLAG = { NONE: 0, RIPE0: 1, RIPE1: 2, SHARED: 3 };
export const ripeFlag = (seat) => (seat === 0 ? 1 : 2);
export const emptyFlag = () => new Array(14).fill(0);
export const flagOf = (state, i) => (state.flag ? state.flag[i] : 0) || 0;
/** Deterministic "lottery" so the browser and the server always agree: 0 or 1 from the board itself. */
export function lottery(pits, i) {
  let h = 2166136261;
  for (const v of pits) h = Math.imul(h ^ (v + 1), 16777619);
  h = Math.imul(h ^ (i + 7), 16777619);
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return h & 1;
}
export const holesOf = (state, seat) => RING.filter((i) => (state.own ? state.own[i] : (i <= 6 ? 0 : 1)) === seat);

export function newGame(rulesetId = 'gebeta') {
  const rules = getRules(rulesetId);
  const pits = new Array(14).fill(rules.seeds);
  pits[6] = 0;
  pits[13] = 0;
  return { pits, own: defaultOwn(), flag: emptyFlag(), turn: 0, over: false, winner: null };
}

export const cloneState = (s) => ({ ...s, pits: s.pits.slice(), own: (s.own || defaultOwn()).slice(), flag: (s.flag || emptyFlag()).slice() });

/** Next HOLE on the fixed circular path (both piles are skipped). */
export function nextSlot(pos) {
  let n = (pos + 1) % 14;
  if (isStore(n)) n = (n + 1) % 14;
  return n;
}

export function legalMoves(state, seat = state.turn) {
  if (state.over) return [];
  return holesOf(state, seat).filter((i) => state.pits[i] > 0 && flagOf(state, i) === 0);
}

/** Seeds captured so far, per seat. */
export function scores(state) {
  return [state.pits[6], state.pits[13]];
}

/** Whole families captured, per seat (what the scoreboard shows). */
export function families(state) {
  return [Math.floor(state.pits[6] / FAMILY), Math.floor(state.pits[13] / FAMILY)];
}

/**
 * New round. Each player keeps as many holes as they need for the seeds they own (4 per hole);
 * every hole the loser can no longer fill is now OWNED by the winner and filled with the winner's seeds.
 * The winner's holes start at the winner's own side and run on round the ring; the loser keeps the tail.
 * Returns { pits, own }. A tie leaves both sides as they were.
 */
export function dealRound(totals, perHole = 4, firstSeat = 0) {
  const pits = new Array(14).fill(0);
  const own = defaultOwn();
  const [a, b] = totals;
  const win = a > b ? 0 : b > a ? 1 : -1;
  const count = [6, 6];
  if (win >= 0) {
    const lose = 1 - win;
    const lc = totals[lose] > 0 ? Math.min(11, Math.max(1, Math.ceil(totals[lose] / perHole))) : 0;
    count[lose] = lc; count[win] = 12 - lc;
  }
  // ring start of each seat's arc: seat 0 begins at ring 0, seat 1 at ring 6; the winner extends forward.
  const startRing = win === 1 ? 6 : 0;
  const first = win >= 0 ? win : 0;
  const order = [first, 1 - first];
  let pos = win >= 0 ? startRing : 0;
  for (const s of order) {
    const n = count[s]; let left = totals[s];
    const holes = [];
    for (let k = 0; k < n; k++) holes.push(RING[(pos + k) % 12]);
    pos += n;
    const full = left <= perHole * n;
    holes.forEach((h, k) => {
      own[h] = s;
      let v;
      if (full) { v = Math.min(perHole, left); }
      else { const base = Math.floor(totals[s] / n), extra = totals[s] % n; v = base + (k < extra ? 1 : 0); }
      pits[h] = v; left -= v;
    });
  }
  pits[6] = 0; pits[13] = 0;
  return { pits, own };
}

/** Scoreboard text for a pile of seeds: "3" families, or "3+2" when 2 leftover seeds were swept in at the end. */
export function famText(n) {
  const f = Math.floor(n / FAMILY), r = n % FAMILY;
  return r ? `${f}+${r}` : `${f}`;
}

/** Apply one step produced by playMove to a pits array (used by the animator). */
export function applyStep(pits, step) {
  switch (step.t) {
    case 'pick':
    case 'relay': pits[step.i] = 0; break;
    case 'sow': pits[step.i] += 1; break;
    case 'family': pits[step.i] = 0; pits[step.store] += step.n; break;
    case 'sweep': pits[step.i] = 0; pits[step.store] += step.n; break;
    case 'split': pits[step.i] = 0; pits[6] += step.n0; pits[13] += step.n1; break;
    case 'deal': for (let k = 0; k < 14; k++) pits[k] = step.pits[k]; break; // step.own carries the new hole owners
    default: break;
  }
  return pits;
}

/** Mirror of applyStep for the ripe / shared markers (used by the animator). */
export function applyFlag(flag, step) {
  switch (step.t) {
    case 'ripe': flag[step.i] = ripeFlag(step.by); break;
    case 'share': flag[step.i] = 3; break;
    case 'family': case 'split': case 'pick': case 'relay': flag[step.i] = 0; break;
    case 'deal': for (let k = 0; k < 14; k++) flag[k] = 0; break;
    default: break;
  }
  return flag;
}

/**
 * Collect a ripe family: a free action. The player entitled to the four may take it at ANY moment between moves —
 * it is not tied to whose turn it is — so a four made by your own last stone can be tapped the instant it appears.
 * `seat` defaults to the player to move. Returns { ok, state, steps }.
 */
export function collect(state, hole, seat = state.turn) {
  if (state.over) return { ok: false, error: 'Game is over' };
  if (seat !== 0 && seat !== 1) return { ok: false, error: 'Not a player' };
  if (!Number.isInteger(hole) || flagOf(state, hole) !== ripeFlag(seat) || state.pits[hole] === 0) return { ok: false, error: 'Nothing to collect there' };
  const next = cloneState(state);
  const n = next.pits[hole];
  next.pits[STORE[seat]] += n; next.pits[hole] = 0; next.flag[hole] = 0;
  return { ok: true, state: next, steps: [{ t: 'family', i: hole, store: STORE[seat], n, by: seat, last: false }] };
}
/** Collect every ripe family the player to move is entitled to (what the computer always does). */
export function collectAll(state, seat = state.turn) {
  let cur = state; const steps = [];
  if (cur.over || cur.turn !== seat) return { state: cur, steps };
  for (const i of RING) {
    if (flagOf(cur, i) === ripeFlag(seat) && cur.pits[i] > 0) { const r = collect(cur, i); cur = r.state; steps.push(...r.steps); }
  }
  return { state: cur, steps };
}
export const collectable = (state, seat) => (state.over ? [] : RING.filter((i) => flagOf(state, i) === ripeFlag(seat) && state.pits[i] > 0));

/**
 * Play a move. Returns { ok, state, steps, extraTurn, captured, error }.
 * `steps` is an ordered event list the UI replays to animate the move:
 *   {t:'pick', i, n}                lift n seeds out of hole i
 *   {t:'sow', i}                    drop one seed into hole i
 *   {t:'family', i, store, n, by, last}  hole i reached four: n seeds go to pile `store` (seat `by` scores)
 *   {t:'relay', i, n}               last seed hit a filled hole — its seeds are lifted and sowing continues
 *   {t:'sweep', i, store, n}        end of round: leftover seeds go to their new owner's pile
 *   {t:'deal', pits}                new round: the whole board is re-dealt (pits = the 14 slots)
 */
export function playMove(state, pit, rulesetId = 'gebeta') {
  const rules = getRules(rulesetId);
  if (state.over) return { ok: false, error: 'Game is over' };
  if (!Number.isInteger(pit) || !holesOf(state, state.turn).includes(pit)) return { ok: false, error: 'Not your pit' };
  if (state.pits[pit] === 0) return { ok: false, error: 'Pit is empty' };
  if (flagOf(state, pit) !== 0) return { ok: false, error: 'This hole is waiting to be collected' };

  const seat = state.turn;
  const next = cloneState(state);
  const p = next.pits, fl = next.flag;
  const before = state.pits.slice();
  const steps = [];
  let captured = 0;
  let relays = 0;
  let newRound = false;

  // Families the mover did not collect before sowing become shared (locked) holes.
  for (const i of RING) if (fl[i] === ripeFlag(seat)) { fl[i] = 3; steps.push({ t: 'share', i }); }

  let hand = p[pit];
  p[pit] = 0;
  steps.push({ t: 'pick', i: pit, n: hand });
  let pos = pit;

  for (;;) {
    let ended = false;
    while (hand > 0) {
      pos = nextSlot(pos);
      p[pos] += 1;
      hand -= 1;
      steps.push({ t: 'sow', i: pos });
      // A stone landing in a four nobody collected in time freezes it: a four never silently grows into a five.
      if (fl[pos] === 1 || fl[pos] === 2) { fl[pos] = 3; steps.push({ t: 'share', i: pos }); }
      if (p[pos] === rules.family && fl[pos] === 0) {
        // Four! The hole stays on the board, marked for whoever is entitled to tap it.
        const by = hand > 0 ? ownerOf(pos, next.own) : seat; // mid-sowing: the hole's owner; last seed: the mover
        fl[pos] = ripeFlag(by);
        steps.push({ t: 'ripe', i: pos, by });
        captured += by === seat ? rules.family : -rules.family;
        if (hand === 0) ended = true;
      }
    }
    if (ended) break;
    // landed in a hole that already had seeds (and is not waiting / shared) → lift it and keep sowing
    if (p[pos] > 1 && fl[pos] === 0 && rules.relay && relays++ < MAX_RELAYS) {
      hand = p[pos];
      p[pos] = 0;
      steps.push({ t: 'relay', i: pos, n: hand });
      continue;
    }
    break;
  }

  // End of round: the player who must move next has nothing left he can lift.
  const other = 1 - seat;
  if (holesOf(next, other).every((i) => p[i] === 0 || fl[i] !== 0)) {
    // 1. families nobody collected in time go to whoever was entitled to them
    for (const i of RING) {
      if ((fl[i] === 1 || fl[i] === 2) && p[i] > 0) {
        const by = fl[i] - 1;
        steps.push({ t: 'family', i, store: STORE[by], n: p[i], by, last: true });
        p[STORE[by]] += p[i]; p[i] = 0; fl[i] = 0;
      }
    }
    // 2. shared holes are divided equally; an odd seed is decided by lottery
    for (const i of RING) {
      if (fl[i] === 3) {
        const n = p[i], half = n >> 1, odd = n & 1;
        const luck = odd ? lottery(before, i) : 0;
        const n0 = half + (odd && luck === 0 ? 1 : 0), n1 = half + (odd && luck === 1 ? 1 : 0);
        steps.push({ t: 'split', i, n0, n1 });
        p[6] += n0; p[13] += n1; p[i] = 0; fl[i] = 0;
      }
    }
    // 3. everything else left on the board goes to the player who made the last move
    for (const s of [0, 1]) {
      for (const i of holesOf(next, s)) {
        if (p[i] > 0) {
          steps.push({ t: 'sweep', i, store: STORE[seat], n: p[i] });
          p[STORE[seat]] += p[i];
          p[i] = 0;
        }
      }
    }
    if (p[6] === 0 || p[13] === 0) {
      next.over = true; // one player owns nothing any more
      next.winner = p[6] > 0 ? 0 : 1;
    } else {
      const dealt = dealRound([p[6], p[13]], rules.seeds);
      steps.push({ t: 'deal', pits: dealt.pits, own: dealt.own });
      next.turn = p[6] > p[13] ? 0 : p[13] > p[6] ? 1 : other;
      for (let k = 0; k < 14; k++) { p[k] = dealt.pits[k]; fl[k] = 0; }
      next.own = dealt.own;
      newRound = true;
    }
  } else {
    next.turn = other;
  }
  return { ok: true, state: next, steps, extraTurn: false, captured, newRound };
}

/** End the game early (resign / timeout). Remaining seeds are NOT swept; the loser forfeits. */
export function forfeit(state, loserSeat) {
  const s = cloneState(state);
  s.over = true;
  s.winner = 1 - loserSeat;
  return s;
}

export function validState(s) {
  return s && Array.isArray(s.pits) && s.pits.length === 14 && s.pits.every((n) => Number.isInteger(n) && n >= 0)
    && (s.turn === 0 || s.turn === 1) && (!s.own || (Array.isArray(s.own) && s.own.length === 14));
}
