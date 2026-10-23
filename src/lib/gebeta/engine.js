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
export const ownerOf = (i) => (i <= 6 ? 0 : 1);
export const isStore = (i) => i === 6 || i === 13;

export function newGame(rulesetId = 'gebeta') {
  const rules = getRules(rulesetId);
  const pits = new Array(14).fill(rules.seeds);
  pits[6] = 0;
  pits[13] = 0;
  return { pits, turn: 0, over: false, winner: null };
}

export const cloneState = (s) => ({ ...s, pits: s.pits.slice() });

/** Next HOLE on the fixed circular path (both piles are skipped). */
export function nextSlot(pos) {
  let n = (pos + 1) % 14;
  if (isStore(n)) n = (n + 1) % 14;
  return n;
}

export function legalMoves(state, seat = state.turn) {
  if (state.over) return [];
  return PITS[seat].filter((i) => state.pits[i] > 0);
}

/** Seeds captured so far, per seat. */
export function scores(state) {
  return [state.pits[6], state.pits[13]];
}

/** Whole families captured, per seat (what the scoreboard shows). */
export function families(state) {
  return [Math.floor(state.pits[6] / FAMILY), Math.floor(state.pits[13] / FAMILY)];
}

/** New round: every player re-fills their own holes from the seeds they own (pile + holes). */
export function dealRound(totals, perHole = 4) {
  const pits = new Array(14).fill(0);
  for (const s of [0, 1]) {
    let left = totals[s];
    for (const i of PITS[s]) { const k = Math.min(perHole, left); pits[i] = k; left -= k; }
    pits[STORE[s]] = left; // reserve beyond what the six holes can take
  }
  return pits;
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
    case 'deal': for (let k = 0; k < 14; k++) pits[k] = step.pits[k]; break;
    default: break;
  }
  return pits;
}

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
  if (!Number.isInteger(pit) || !PITS[state.turn].includes(pit)) return { ok: false, error: 'Not your pit' };
  if (state.pits[pit] === 0) return { ok: false, error: 'Pit is empty' };

  const seat = state.turn;
  const next = cloneState(state);
  const p = next.pits;
  const steps = [];
  let captured = 0;
  let relays = 0;
  let newRound = false;

  let hand = p[pit];
  p[pit] = 0;
  steps.push({ t: 'pick', i: pit, n: hand });
  let pos = pit;

  const takeFamily = (i, by, last) => {
    const n = p[i];
    steps.push({ t: 'family', i, store: STORE[by], n, by, last });
    p[STORE[by]] += n;
    p[i] = 0;
    captured += n;
  };

  for (;;) {
    let ended = false;
    while (hand > 0) {
      pos = nextSlot(pos);
      p[pos] += 1;
      hand -= 1;
      steps.push({ t: 'sow', i: pos });
      if (p[pos] === rules.family) {
        if (hand > 0) takeFamily(pos, ownerOf(pos), false); // mid-sowing: the hole's owner scores
        else { takeFamily(pos, seat, true); ended = true; } // final seed: the mover scores, turn ends
      }
    }
    if (ended) break;

    if (p[pos] > 1 && rules.relay && relays++ < MAX_RELAYS) { // landed in a hole that already had seeds
      hand = p[pos];
      p[pos] = 0;
      steps.push({ t: 'relay', i: pos, n: hand });
      continue;
    }
    break; // landed in an empty hole
  }

  // End of game: the player who must move next has no seeds → the opponent takes everything left.
  const other = 1 - seat;
  if (PITS[other].every((i) => p[i] === 0)) {
    for (const s of [0, 1]) {
      for (const i of PITS[s]) {
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
      // Next round: the winner of this round (more seeds) opens; a tie lets the player who was stuck open.
      const dealt = dealRound([p[6], p[13]], rules.seeds);
      steps.push({ t: 'deal', pits: dealt });
      next.turn = p[6] > p[13] ? 0 : p[13] > p[6] ? 1 : other; // decided on the seeds owned BEFORE re-dealing
      for (let k = 0; k < 14; k++) p[k] = dealt[k];
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
    && (s.turn === 0 || s.turn === 1);
}
