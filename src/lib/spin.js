// Geometry of the "who starts?" wheel — pure functions, shared by the UI and the tests.
//
// The wheel has SLICES equal slices that ALTERNATE between the two players (seat 0 owns the even slices, seat 1 the
// odd ones). Each player therefore owns exactly half of the wheel, spread evenly around it, so no spot on the wheel
// favours anybody and the wheel looks like what it is: a fair 50 / 50 draw.
//
// The winner itself is decided before the wheel moves (a cryptographic coin offline, the server online). The wheel is
// then turned so that its pointer ends up inside a slice owned by that winner. The landing slice is uniform among the
// winner's slices and the landing point is uniform inside the slice's safe zone (never close to an edge), so
// the pointer never lands on a line that could be read either way, and the picture is exactly as random as the
// result. What the wheel shows and what the game does can never disagree: both come from the same winner.
import { randomFloat } from './fairRandom.js';

export const SLICES = 12;                 // must be even
export const SLICE_DEG = 360 / SLICES;
export const SAFE = 0.2;                  // landings stay ≥ 20 % of a slice away from either edge
export const POINTER_DEG = 90;            // the pointer sits at 3 o'clock (angles run clockwise from 12 o'clock)

const mod360 = (a) => ((a % 360) + 360) % 360;

/** Which seat owns the wheel at a wheel-local angle (0 = start of slice 0, clockwise). */
export const ownerOfAngle = (a) => Math.floor(mod360(a) / SLICE_DEG) % 2;

/** The wheel-local angle under a pointer when the wheel has been turned clockwise by `rotation` degrees. */
export const angleUnderPointer = (rotation, pointerDeg = POINTER_DEG) => mod360(pointerDeg - rotation);

/** A wheel-local landing angle inside a slice owned by `winner` (0 or 1): uniform slice, uniform point in its safe zone. */
export function pickLanding(winner, rand = randomFloat) {
  const mine = SLICES / 2;
  const k = Math.min(mine - 1, Math.floor(rand() * mine));
  const slice = k * 2 + (winner === 1 ? 1 : 0);
  const within = SAFE + rand() * (1 - 2 * SAFE);
  return (slice + within) * SLICE_DEG;
}

/** Total clockwise rotation that leaves `landing` under the pointer after `turns` extra full spins (always forward). */
export const finalRotation = (landing, turns = 5, pointerDeg = POINTER_DEG) => turns * 360 + mod360(pointerDeg - landing);

/** Ease-out used by the animation: fast start, long smooth slow-down, zero speed exactly at the end. */
export const easeOut = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 4);

/** CSS conic-gradient for the alternating slices. */
export function wheelGradient(colorA, colorB) {
  const stops = [];
  for (let i = 0; i < SLICES; i++) stops.push(`${i % 2 ? colorB : colorA} ${i * SLICE_DEG}deg ${(i + 1) * SLICE_DEG}deg`);
  return `conic-gradient(from 0deg, ${stops.join(', ')})`;
}
