// ጡዝ opening — the alternating 3/5 chain (two laps). Pure; no imports, so the engine, server and tests share it.
//
// Fresh board: all 12 holes hold 4. The opener picks one of HIS OWN holes `pit`.
//   Lap 1: lift ONE stone (4→3) and drop it in the next hole (4→5); lift one from the hole after that, drop it in the
//          next … six pairs until the ring alternates 3,5,3,5 …
//   Lap 2: continuing from the last 5-hole, each step lifts one stone from a 5-hole (5→4) and drops it on the 3-hole
//          just after it (3→4). The FIRST hole that is not the opener's and turns 3→4 is his Tuz; the chain stops there.
// Stones only move between holes, so all 48 stay on the board (nothing goes to a pile).
export const RING = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]; // hole slots in sowing order (slots 6 and 13 are piles)

/**
 * @param pits  14-slot array (piles at 6 and 13)
 * @param own   14-slot owner array (0/1)
 * @param seat  the opener
 * @param pit   the opener's chosen hole (slot)
 * @returns {{pits:number[], tuz:number, steps:object[]}|null}  null when the opening is not possible from `pit`
 */
export function planOpening(pits, own, seat, pit) {
  const N = 12;
  const start = RING.indexOf(pit);
  if (start < 0 || own[pit] !== seat) return null;
  if (RING.some((h) => pits[h] !== 4)) return null; // only a freshly dealt board
  const p = pits.slice();
  const steps = [];
  const move = (a, b) => { p[RING[a]] -= 1; p[RING[b]] += 1; steps.push({ t: 'lift1', i: RING[a] }, { t: 'sow', i: RING[b] }); };
  let k = start;
  for (let j = 0; j < N / 2; j++) { move(k, (k + 1) % N); k = (k + 2) % N; }
  k = (start - 1 + N) % N; // the last hole of lap 1 (a 5)
  for (let j = 0; j < N / 2; j++) {
    const to = (k + 1) % N;
    move(k, to);
    if (own[RING[to]] !== seat) {
      steps.push({ t: 'tuz', i: RING[to], by: seat, opening: true });
      return { pits: p, tuz: RING[to], steps };
    }
    k = (to + 1) % N;
  }
  return null; // every 3-hole is the opener's own: no Tuz can form from this hole
}
