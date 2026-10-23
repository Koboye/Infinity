// Gebeta rules engine — pure functions, no UI, no Firebase.
// Shared by the browser (practice, animation) and the server (authoritative online moves).
//
// Board: 14 slots. Seat 0 owns pits 0-5 (left→right) and store 6 (right end).
//        Seat 1 owns pits 7-12 (right→left from seat 0's view) and store 13 (left end).
// Sowing runs counter-clockwise: 0→1→…→5→6→7→…→12→13→0. A player skips the opponent's store.
// Opposite of pit i is 12 - i.

export const STORE = [6, 13];
export const PITS = [[0, 1, 2, 3, 4, 5], [7, 8, 9, 10, 11, 12]];
export const TOTAL_SLOTS = 14;
export const MAX_SOW_STEPS = 400; // safety cap so relay chains can never loop forever

export const RULESETS = {
  // Traditional feel: relay sowing + capture + extra turn from your store.
  gebeta: { id: 'gebeta', seeds: 4, relay: true, capture: true, extraTurn: true },
  // Simpler mancala (Kalah-style): no relay.
  classic: { id: 'classic', seeds: 4, relay: false, capture: true, extraTurn: true },
};

export const getRules = (id) => RULESETS[id] || RULESETS.gebeta;
export const ownerOf = (i) => (i <= 6 ? 0 : 1);
export const isStore = (i) => i === 6 || i === 13;
export const opposite = (i) => 12 - i;

export function newGame(rulesetId = 'gebeta') {
  const rules = getRules(rulesetId);
  const pits = new Array(14).fill(rules.seeds);
  pits[6] = 0;
  pits[13] = 0;
  return { pits, turn: 0, over: false, winner: null };
}

export const cloneState = (s) => ({ ...s, pits: s.pits.slice() });

function nextSlot(pos, seat) {
  let n = (pos + 1) % 14;
  if (n === STORE[1 - seat]) n = (n + 1) % 14; // skip opponent's store
  return n;
}

export function legalMoves(state, seat = state.turn) {
  if (state.over) return [];
  return PITS[seat].filter((i) => state.pits[i] > 0);
}

export function scores(state) {
  return [state.pits[6], state.pits[13]];
}

/** Apply one step produced by playMove to a pits array (used by the animator). */
export function applyStep(pits, step) {
  switch (step.t) {
    case 'pick':
    case 'relay': pits[step.i] = 0; break;
    case 'sow': pits[step.i] += 1; break;
    case 'cap':
      pits[step.from] = 0; pits[step.to] = 0; pits[step.store] += step.n; break;
    case 'sweep':
      pits[step.i] = 0; pits[step.store] += step.n; break;
    default: break;
  }
  return pits;
}

/**
 * Play a move. Returns { ok, state, steps, extraTurn, captured, error }.
 * `steps` is an ordered event list the UI replays to animate the move:
 *   {t:'pick', i, n}     lift n seeds out of pit i
 *   {t:'sow', i}         drop one seed into slot i
 *   {t:'relay', i}       last seed hit a filled pit — its seeds are lifted and sowing continues
 *   {t:'cap', from, to, store, n}   capture: pits `from` and `to` emptied into `store`
 *   {t:'sweep', i, store, n}        end of game: leftover seeds move to their owner's store
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
  let extraTurn = false;
  let budget = MAX_SOW_STEPS;

  let hand = p[pit];
  p[pit] = 0;
  steps.push({ t: 'pick', i: pit, n: hand });
  let pos = pit;

  for (;;) {
    while (hand > 0 && budget-- > 0) {
      pos = nextSlot(pos, seat);
      p[pos] += 1;
      hand -= 1;
      steps.push({ t: 'sow', i: pos });
    }
    if (budget <= 0) break;

    if (pos === STORE[seat]) { extraTurn = rules.extraTurn; break; }

    if (p[pos] > 1) {
      // Landed in a filled pit.
      if (rules.relay) {
        hand = p[pos];
        p[pos] = 0;
        steps.push({ t: 'relay', i: pos, n: hand });
        continue;
      }
      break;
    }

    // Landed in an empty pit: capture if it is on my side and the opposite pit has seeds.
    if (rules.capture && ownerOf(pos) === seat && !isStore(pos) && p[opposite(pos)] > 0) {
      const n = p[pos] + p[opposite(pos)];
      steps.push({ t: 'cap', from: pos, to: opposite(pos), store: STORE[seat], n });
      p[STORE[seat]] += n;
      p[pos] = 0;
      p[opposite(pos)] = 0;
      captured = n;
    }
    break;
  }

  // End of game: one side has no seeds left → the other side's seeds go to its owner.
  const sideEmpty = [0, 1].map((s) => PITS[s].every((i) => p[i] === 0));
  if (sideEmpty[0] || sideEmpty[1]) {
    for (const s of [0, 1]) {
      for (const i of PITS[s]) {
        if (p[i] > 0) {
          steps.push({ t: 'sweep', i, store: STORE[s], n: p[i] });
          p[STORE[s]] += p[i];
          p[i] = 0;
        }
      }
    }
    next.over = true;
    next.winner = p[6] > p[13] ? 0 : p[13] > p[6] ? 1 : 'draw';
    extraTurn = false;
  } else {
    next.turn = extraTurn ? seat : 1 - seat;
  }
  return { ok: true, state: next, steps, extraTurn, captured };
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
