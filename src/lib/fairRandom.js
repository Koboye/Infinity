// Unbiased randomness for "who starts" draws — works in the browser and on the server.
//
// Every value comes from the platform's cryptographic generator (crypto.getRandomValues). Integers are drawn with
// rejection sampling, so there is NO modulo bias: for any n, every value in [0, n) has exactly probability 1/n.
// If no cryptographic source exists (very old runtime) it falls back to Math.random, which is still uniform.

const TWO32 = 4294967296;

function u32(source) {
  try {
    const c = source || (typeof globalThis !== 'undefined' ? globalThis.crypto : null);
    if (c && typeof c.getRandomValues === 'function') {
      const a = new Uint32Array(1);
      c.getRandomValues(a);
      return a[0];
    }
  } catch { /* fall through */ }
  return Math.floor(Math.random() * TWO32) >>> 0;
}

/** Uniform integer in [0, n), n ≥ 1, by rejection sampling (no modulo bias). `next32` is injectable for tests. */
export function randomInt(n, next32 = u32) {
  if (!Number.isInteger(n) || n < 1 || n > TWO32) throw new RangeError('randomInt needs an integer 1 ≤ n ≤ 2^32');
  if (n === 1) return 0;
  const limit = TWO32 - (TWO32 % n); // largest multiple of n that fits; values ≥ limit are re-drawn
  let x = next32();
  while (x >= limit) x = next32();
  return x % n;
}

/** A fair coin: 0 or 1, each with probability exactly 1/2. */
export const fairCoin = (next32 = u32) => randomInt(2, next32);

/** Uniform float in [0, 1) with 53 random bits (same resolution as a double). */
export function randomFloat(next32 = u32) {
  const hi = next32() >>> 5, lo = next32() >>> 6; // 27 + 26 bits
  return (hi * 67108864 + lo) / 9007199254740992;
}
