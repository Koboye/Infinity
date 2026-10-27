// ጡዝ opening: alternating 3/5 chain, two laps. Holes are 0..11 (h1..h12).
// Owner's holes: 0..5 (seat 0) or 6..11 (seat 1). `start` must be one of the opener's own holes.
// Returns { board, tuz, steps }. Stone count is conserved (48).
export function tuzOpening(board, start, seat = 0) {
  const N = 12;
  const own = (i) => (seat === 0 ? i < 6 : i >= 6);
  if (!own(start)) throw new Error('Opening must start on the opener\'s own hole');
  if (board.some((v) => v !== 4)) throw new Error('Opening needs a fresh board (all holes = 4)');
  const b = board.slice();
  const steps = [];
  // Lap 1: lift one (4->3), drop on next (4->5), then continue from the hole after the 5.
  let pos = start;
  for (let k = 0; k < N / 2; k++) {
    const next = (pos + 1) % N;
    b[pos] -= 1; b[next] += 1;
    steps.push({ lap: 1, from: pos, to: next });
    pos = (next + 1) % N;
  }
  // Lap 2: start from the last 5-hole of lap 1; lift one (5->4), drop on the 3-hole after it (3->4).
  pos = (start - 1 + N) % N; // last drop of lap 1
  for (let k = 0; k < N / 2; k++) {
    const to = (pos + 1) % N;
    b[pos] -= 1; b[to] += 1;
    steps.push({ lap: 2, from: pos, to });
    if (!own(to)) return { board: b, tuz: to, steps }; // first opponent hole turned 3->4
    pos = (to + 1) % N;
  }
  throw new Error('No Tuz formed');
}
