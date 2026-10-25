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
// Then a new round is dealt and EVERY hole gets exactly four stones. Each player gets one hole per four stones he owns;
// the leftovers (1+3 → the player with 3 gets the extra hole, 2+2 → lottery) make one more. The opener alternates
// every round (the first opener is a lottery). Rounds go on until one player owns no hole at all — he has lost.
// አሻግሮ መብል (ruleset 'ashagro'): same sowing and relay, but no families and no freezing — only the capture described in RULESETS.
//   Plus: if the last stone rests in your own empty hole and the hole across is EMPTY too, you pick up that one stone for your pile.

export const STORE = [6, 13];
export const PITS = [[0, 1, 2, 3, 4, 5], [7, 8, 9, 10, 11, 12]];
export const TOTAL_SLOTS = 14;
export const FAMILY = 4;
export const MAX_RELAYS = 300; // safety cap so relay chains can never loop forever

export const RULESETS = {
  gebeta: { id: 'gebeta', seeds: 4, relay: true, family: FAMILY, families: true, extraTurn: false, capture: false },
  // አሻግሮ መብል: NO families of four and NO freezing — no hole is ever locked, ripe or shared. The only way to take stones is
  // the capture: your LAST stone comes to rest in one of YOUR OWN holes (it was empty, so the turn stops there) and the hole
  // straight across belongs to your opponent and holds stones → you take everything in that hole plus your last stone.
  // If the hole across is empty, you may pick up your own single stone (a 'bank' step).
  ashagro: { id: 'ashagro', seeds: 4, relay: true, family: FAMILY, families: false, extraTurn: false, capture: true },
};
/** The hole straight across the board (0↔12, 1↔11, … 5↔7). */
export const oppositeOf = (i) => 12 - i;

// ጡዝ (Tuz): normal Gebeta (lift the whole hole, relay) PLUS the Tuz rule:
//   - NOBODY CAN MAKE A TUZ ON HIS OWN HOLES. A Tuz always sits in an OPPONENT's hole and belongs to the player who made it.
//   - the game starter OPENS from one of HIS OWN holes: he lifts one stone (the hole keeps three), walks it round the ring to the
//     OPPONENT's hole straight across (12 − i), which becomes his first Tuz (four stones, his property). The carried stone is
//     captured into his pile, so all 48 stones stay accounted for (see playMove, `opening`).
//   - later, whenever a player's LAST stone lands in an OPPONENT's hole holding exactly three (making four), that hole is
//     frozen as the mover's Tuz and his turn ends. Nobody can lift a Tuz; stones may still pass through or land on it.
//   - THE ONLY FREEZE IS THE TUZ. A hole that reaches four any other way (mid-sowing, or by your own last stone in your own
//     hole) is a perfectly normal hole: no marker, nothing to collect, no waiting, no freezing — it is lifted / relayed like any other.
//   - attacking a Tuz: your LAST stone resting on the opponent's Tuz takes exactly two stones from it and you
//     play again; the rest stays frozen. A Tuz emptied this way is remembered (flag 6): the next LAST stone to land there is captured.
//   - when a round ends, each Tuz is paid to its owner's pile. A player may own any number of Tuz holes.
export const tuzFlag = (seat) => (seat === 0 ? 4 : 5);
RULESETS.tuz = { id: 'tuz', seeds: 4, relay: true, family: FAMILY, families: false, extraTurn: false, capture: false, tuz: true };
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

export function newGame(rulesetId = 'gebeta', first = 0) {
  const rules = getRules(rulesetId);
  const pits = new Array(14).fill(rules.seeds);
  pits[6] = 0;
  pits[13] = 0;
  const turn = first === 1 ? 1 : 0;
  // `starter` = who opened the current round; the opener alternates every round (and every new game).
  return { pits, own: defaultOwn(), flag: emptyFlag(), turn, starter: turn, over: false, winner: null, ...(rules.tuz ? { opening: true } : {}) };
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
  // Tuz opening: the starter taps one of HIS OWN holes whose opposite hole is the opponent's (the Tuz forms there, never on his own holes)
  if (state.opening && seat === state.turn) return holesOf(state, seat).filter((i) => state.pits[i] > 0 && flagOf(state, i) === 0 && (state.own ? state.own[oppositeOf(i)] : (oppositeOf(i) <= 6 ? 0 : 1)) !== seat);
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
 * New round. EVERY hole is dealt exactly four stones — always.
 * Each player gets one hole per four stones he owns. The stones left over (0-3 each; together always 0 or 4, because
 * 48 stones never get lost) make one more hole of four: 1+3 → it goes to the player holding 3, 2+2 → lottery.
 * The player with more holes takes the arc that starts at his own side; the other keeps the tail.
 * Returns { pits, own, holes:[n0,n1] }. `luck` (0 or 1) decides a 2+2 draw.
 */
export function dealRound(totals, perHole = 4, luck = 0) {
  const pits = new Array(14).fill(0);
  const own = defaultOwn();
  const cnt = [Math.floor(totals[0] / perHole), Math.floor(totals[1] / perHole)];
  const rem = [totals[0] % perHole, totals[1] % perHole];
  const spare = 12 - cnt[0] - cnt[1]; // holes still to hand out (leftover stones making up a whole hole)
  const tie = spare > 0 && rem[0] === rem[1] && rem[0] > 0; // 2 + 2: both hold two → a spin of the wheel decides
  for (let k = 0; k < spare; k++) {
    const to = rem[0] > rem[1] ? 0 : rem[1] > rem[0] ? 1 : luck; // 3 beats 1, 2 vs 2 is a lottery
    cnt[to] += 1; rem[to] = 0; rem[1 - to] = 0;
  }
  // winner (more holes) starts at his own side and runs on round the ring; the loser keeps the tail
  const win = cnt[0] > cnt[1] ? 0 : cnt[1] > cnt[0] ? 1 : -1;
  let pos = win === 1 ? 6 : 0;
  const order = win === 1 ? [1, 0] : [0, 1];
  for (const sd of order) {
    for (let k = 0; k < cnt[sd]; k++) { const h = RING[(pos + k) % 12]; own[h] = sd; pits[h] = perHole; }
    pos += cnt[sd];
  }
  if (win < 0) { for (const h of RING) own[h] = h <= 5 ? 0 : 1; }
  return { pits, own, holes: cnt, spin: tie ? { winner: luck } : null };
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
    case 'lift1': pits[step.i] -= 1; break;
    case 'tuztake': pits[step.i] -= step.n; pits[step.store] += step.n; break;
    case 'family': pits[step.i] = 0; pits[step.store] += step.n; break;
    case 'sweep': pits[step.i] = 0; pits[step.store] += step.n; break;
    case 'capture': pits[step.i] = 0; pits[step.j] = 0; pits[step.store] += step.n; break;
    case 'bank': pits[step.i] = 0; pits[step.store] += step.n; break;
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
    case 'capture': flag[step.i] = 0; flag[step.j] = 0; break;
    case 'tuz': flag[step.i] = tuzFlag(step.by); break;
    case 'tuztake': if (step.empty) flag[step.i] = step.single ? 0 : 6; break; // an emptied Tuz is remembered (6) until a stone lands there
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
 *   {t:'bank', i, store, n}         አሻግሮ: last stone in my own empty hole, hole across empty → I keep that one stone
 *   {t:'sweep', i, store, n}        end of round: leftover seeds go to their new owner's pile
 *   {t:'deal', pits}                new round: the whole board is re-dealt (pits = the 14 slots)
 */
export function playMove(state, pit, rulesetId = 'gebeta', schedule = [], autoSeat = -1) {
  const rules = getRules(rulesetId);
  if (state.over) return { ok: false, error: 'Game is over' };
  if (state.opening && rules.tuz) { // the starter's opening: from one of HIS OWN holes; the Tuz forms in the opponent's hole across
    if (!Number.isInteger(pit) || !legalMoves(state, state.turn).includes(pit)) return { ok: false, error: 'Open from one of your own holes' };
    const seat0 = state.turn, tgt = oppositeOf(pit);
    const o = cloneState(state); o.opening = false; o.turn = 1 - seat0;
    o.pits[pit] -= 1; o.pits[STORE[seat0]] += 1; o.flag[tgt] = tuzFlag(seat0); // the hole keeps three; the carried stone is captured; the hole across becomes the Tuz
    // shown stone by stone: lift ONE stone, drop it in the next hole, lift ONE from there, … until it reaches the hole across
    const w = [{ t: 'lift1', i: pit }]; const k0 = RING.indexOf(pit), d = (RING.indexOf(tgt) - k0 + 12) % 12;
    for (let j = 1; j <= d; j++) { const h = RING[(k0 + j) % 12]; w.push({ t: 'sow', i: h }); if (j < d) w.push({ t: 'lift1', i: h }); }
    w.push({ t: 'tuztake', i: tgt, store: STORE[seat0], n: 1, by: seat0, empty: false, opening: true }); // the carried stone goes to the pile
    w.push({ t: 'tuz', i: tgt, by: seat0, opening: true });
    return { ok: true, state: o, steps: w, extraTurn: false, captured: FAMILY, newRound: false };
  }
  if (!Number.isInteger(pit) || !holesOf(state, state.turn).includes(pit)) return { ok: false, error: 'Not your pit' };
  if (state.pits[pit] === 0) return { ok: false, error: 'Pit is empty' };
  if (flagOf(state, pit) !== 0) return { ok: false, error: 'This hole is waiting to be collected' };

  const seat = state.turn;
  const next = cloneState(state);
  if (next.opening) next.opening = false;
  const p = next.pits, fl = next.flag;
  const before = state.pits.slice();
  const steps = [];
  let captured = 0;
  let relays = 0;
  let newRound = false;
  let extra = false; // ጡዝ: landing on the OPPONENT's Tuz pays two stones and the mover plays again

  // Timed collects: [{ at, hole, seat }] — the entitled player tapped `hole` once `at` steps of this move were on screen.
  // The collect lands exactly there, so what happens next (a stone dropping into the now-empty hole, a relay, …) is real.
  const sched = schedule.slice().sort((a, b) => a.at - b.at);
  const applySched = () => {
    while (sched.length && sched[0].at <= steps.length) {
      const c = sched.shift();
      if (fl[c.hole] === ripeFlag(c.seat) && p[c.hole] > 0) {
        const n = p[c.hole];
        steps.push({ t: 'family', i: c.hole, store: STORE[c.seat], n, by: c.seat, last: false });
        p[STORE[c.seat]] += n; p[c.hole] = 0; fl[c.hole] = 0;
      }
    }
  };

  // Families the mover did not collect before sowing become shared (locked) holes.
  for (const i of RING) if (fl[i] === ripeFlag(seat)) { fl[i] = 3; steps.push({ t: 'share', i }); }

  let hand = p[pit];
  p[pit] = 0;
  steps.push({ t: 'pick', i: pit, n: hand });
  let pos = pit;

  for (;;) {
    let ended = false;
    while (hand > 0) {
      applySched();
      pos = nextSlot(pos);
      p[pos] += 1;
      hand -= 1;
      steps.push({ t: 'sow', i: pos });
      // A stone landing in a four nobody collected in time freezes it: a four never silently grows into a five.
      if (fl[pos] === 1 || fl[pos] === 2) { fl[pos] = 3; steps.push({ t: 'share', i: pos }); }
      // ጡዝ: a hole that WAS a Tuz and has been emptied (flag 6). A stone passing through makes it an ordinary hole again;
      // the LAST stone captures itself — the single stone placed there goes to the mover's pile and the turn ends.
      if (rules.tuz && fl[pos] === 6) {
        if (hand === 0) {
          steps.push({ t: 'tuztake', i: pos, store: STORE[seat], n: 1, by: seat, empty: true, single: true });
          p[pos] -= 1; p[STORE[seat]] += 1; fl[pos] = 0; captured += 1; ended = true;
          continue;
        }
        fl[pos] = 0;
      }
      // ጡዝ: the LAST stone comes to rest on the OPPONENT's frozen Tuz → capture exactly TWO stones from it, the rest stays
      // frozen (a Tuz of 4 plus my landing stone is left with 3), and play again.
      // (Resting on your OWN Tuz just ends the turn: a frozen hole is never lifted, so there is no relay.)
      if (rules.tuz && hand === 0 && (fl[pos] === 4 || fl[pos] === 5) && fl[pos] - 4 !== seat) {
        const take = Math.min(2, p[pos]); // exactly two stones are captured; my landing stone stays in the hole like any stone dropped there
        steps.push({ t: 'tuztake', i: pos, store: STORE[seat], n: take, by: seat, empty: p[pos] - take === 0 });
        p[pos] -= take; p[STORE[seat]] += take; if (p[pos] === 0) fl[pos] = 6;
        captured += take; extra = true; ended = true;
        continue;
      }
      // ጡዝ: the LAST stone makes a four in an opponent's hole → it freezes as the mover's Tuz and his turn ends.
      if (rules.tuz && hand === 0 && p[pos] === rules.family && fl[pos] === 0 && ownerOf(pos, next.own) !== seat) {
        fl[pos] = tuzFlag(seat);
        steps.push({ t: 'tuz', i: pos, by: seat });
        captured += rules.family;
        ended = true;
        continue;
      }
      if (rules.families && p[pos] === rules.family && fl[pos] === 0) {
        // Four! The hole stays on the board, marked for whoever is entitled to tap it.
        const by = hand > 0 ? ownerOf(pos, next.own) : seat; // mid-sowing: the hole's owner; last seed: the mover
        fl[pos] = ripeFlag(by);
        steps.push({ t: 'ripe', i: pos, by });
        captured += by === seat ? rules.family : -rules.family;
        // The computer (`autoSeat`) never lets a four of its own sit there: it takes it the instant it appears, so no stone
        // can ever land in it and freeze it — even in the middle of the human's move. A human must tap his own fours.
        if (by === autoSeat) {
          steps.push({ t: 'family', i: pos, store: STORE[by], n: p[pos], by, last: false });
          p[STORE[by]] += p[pos]; p[pos] = 0; fl[pos] = 0;
        }
        if (hand === 0) ended = true;
      }
    }
    applySched();
    if (ended) break;
    // አሻግሮ መብል: the last stone stopped in MY OWN hole (it was empty) and the hole across is my opponent's and not empty
    // → I take that hole's stones plus my last stone. Otherwise the turn simply ends (nothing is ever frozen).
    if (rules.capture && p[pos] === 1 && fl[pos] === 0 && ownerOf(pos, next.own) === seat) {
      const opp = oppositeOf(pos);
      if (ownerOf(opp, next.own) !== seat && p[opp] > 0 && fl[opp] === 0) {
        const n = p[opp] + 1;
        steps.push({ t: 'capture', i: pos, j: opp, store: STORE[seat], n, by: seat });
        p[STORE[seat]] += n; p[pos] = 0; p[opp] = 0;
        captured += n;
        break;
      }
      // …and if the hole across is EMPTY, the stopper may still pick up his own single stone and keep it in his pile.
      if (p[opp] === 0 && fl[opp] === 0) {
        steps.push({ t: 'bank', i: pos, store: STORE[seat], n: 1, by: seat });
        p[STORE[seat]] += 1; p[pos] = 0;
        captured += 1;
        break;
      }
    }
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
  const canPlay = (s) => holesOf(next, s).some((i) => p[i] > 0 && fl[i] === 0);
  // ጡዝ: a player with nothing to lift is skipped — the other keeps playing his stones; the round ends only when NEITHER
  // can lift anything (only frozen Tuz holes / ripe fours remain). Plain Gebeta ends the round as soon as the next player is empty.
  let keep = false, roundOver = !canPlay(other);
  if (rules.tuz) {
    if (extra && canPlay(seat)) keep = true;
    else if (!canPlay(other) && canPlay(seat)) keep = true;
    roundOver = !canPlay(other) && !canPlay(seat);
  }
  if (roundOver) {
    // 0. ጡዝ holes are paid to their owners
    for (const i of RING) {
      if ((fl[i] === 4 || fl[i] === 5) && p[i] > 0) {
        const by = fl[i] - 4;
        steps.push({ t: 'family', i, store: STORE[by], n: p[i], by, last: true });
        p[STORE[by]] += p[i]; p[i] = 0; fl[i] = 0;
      }
    }
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
    // a player left with fewer than four stones and no leftover-lottery luck owns no hole any more: he has lost
    const holesAfter = dealRound([p[6], p[13]], rules.seeds, lottery(before, 99)).holes;
    if (p[6] === 0 || p[13] === 0 || holesAfter[0] === 0 || holesAfter[1] === 0) {
      next.over = true;
      next.winner = holesAfter[0] === 0 || p[6] === 0 ? 1 : 0;
    } else {
      // leftover stones (1+3, 2+2): the lottery is drawn from the board itself so browser and server always agree
      const dealt = dealRound([p[6], p[13]], rules.seeds, lottery(before, 99));
      steps.push({ t: 'deal', pits: dealt.pits, own: dealt.own, spin: dealt.spin });
      // the opener alternates: whoever did not open this round opens the next one
      next.turn = 1 - (state.starter === 0 || state.starter === 1 ? state.starter : seat);
      next.starter = next.turn;
      for (let k = 0; k < 14; k++) { p[k] = dealt.pits[k]; fl[k] = 0; }
      next.own = dealt.own;
      newRound = true;
    }
  } else {
    next.turn = keep ? seat : other;
  }
  return { ok: true, state: next, steps, extraTurn: keep, captured, newRound };
}

/** End the game early (resign / timeout). Remaining seeds are NOT swept; the loser forfeits. */
export function forfeit(state, loserSeat) {
  const s = cloneState(state);
  s.over = true;
  s.winner = 1 - loserSeat;
  return s;
}

export function validState(s, strict = false) {
  if (!(s && Array.isArray(s.pits) && s.pits.length === 14 && s.pits.every((n) => Number.isInteger(n) && n >= 0)
    && (s.turn === 0 || s.turn === 1))) return false;
  if (s.own && !(Array.isArray(s.own) && s.own.length === 14 && s.own.every((o) => o === 0 || o === 1))) return false;
  if (s.flag && !(Array.isArray(s.flag) && s.flag.length === 14 && s.flag.every((f, i) => Number.isInteger(f) && f >= 0 && f <= 6 && (f === 0 || !isStore(i))))) return false;
  // strict: stones are never created or destroyed — 12 families of four, always 48 in total (holes + both piles).
  return !strict || s.pits.reduce((a, b) => a + b, 0) === 48;
}
