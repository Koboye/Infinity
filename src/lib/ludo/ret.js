// The "way home" of a captured pawn: it walks back along the cells it came by, so everybody SEES where it is sent.
import { trailXY } from './layout.js';

/** Pawns that stood on the ring in `s0` and are back in base in `ns` (the mover itself excluded). */
export function capturedDiff(s0, ns, by, idx) {
  const out = [];
  s0.pos.forEach((arr, p) => arr.forEach((pos, i) => { if (pos >= 0 && ns.pos[p][i] === -1 && !(p === by && i === idx)) out.push({ p, i, from: pos, seat: s0.seats[p] }); }));
  return out;
}
export const retInit = (caps) => Object.fromEntries(caps.map((c) => [`${c.p}:${c.i}`, c.from]));

/** Walk every captured pawn back, cell by cell, then into its base. Resolves when all are home. */
export async function animateReturn(s0, caps, { setRet, setRetTrail, wait, alive }) {
  if (!caps.length) return;
  setRetTrail(caps.map((c) => ({ seat: c.seat, pts: trailXY(s0.board, c.seat, -1, c.from).reverse() })));
  await wait(300);                                        // let the hit be seen first
  const len = Math.max(...caps.map((c) => c.from + 1));
  const step = Math.max(18, Math.min(45, 900 / len));
  for (let k = 1; k <= len; k++) {
    if (!alive()) return;
    setRet(Object.fromEntries(caps.map((c) => [`${c.p}:${c.i}`, k <= c.from ? c.from - k : -1])));
    await wait(step);
  }
  await wait(120);
  setRet(null); setRetTrail(null);
}
