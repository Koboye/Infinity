// Leftover-stone rule: multiples of four are perfect; a lone 1 goes to the player holding 3; 2+2 is decided by the spin.
import assert from 'node:assert/strict';
import { dealRound, newGame, playMove, legalMoves, validState } from '../src/lib/gebeta/engine.js';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
t('divisible by four: nothing to settle, no spin', () => {
  for (const [a, b] of [[24, 24], [28, 20], [36, 12], [44, 4]]) for (const luck of [0, 1]) {
    const r = dealRound([a, b], 4, luck); assert.deepEqual(r.holes, [a / 4, b / 4]); assert.equal(r.spin, null);
  }
});
t('remainder 1 + 3: the player with three takes the extra hole (luck never matters)', () => {
  for (const luck of [0, 1]) {
    let r = dealRound([25, 23], 4, luck); assert.deepEqual(r.holes, [6, 6]);   // 23 = 5 holes + 3 → seat 1 gets the 6th
    r = dealRound([27, 21], 4, luck); assert.deepEqual(r.holes, [7, 5]);       // 27 = 6 + 3 → seat 0 gets the 7th
    r = dealRound([21, 27], 4, luck); assert.deepEqual(r.holes, [5, 7]);
    assert.equal(r.spin, null);
  }
});
t('remainder 2 + 2: a spin decides, and the spin winner collects the extra hole', () => {
  for (const luck of [0, 1]) {
    const r = dealRound([26, 22], 4, luck);
    assert.deepEqual(r.spin, { winner: luck });
    assert.deepEqual(r.holes, luck === 0 ? [7, 5] : [6, 6]);
    assert.equal(r.pits.reduce((a, b) => a + b, 0), 48);
  }
});
t('every deal always hands out exactly 12 holes of four', () => {
  for (let a = 0; a <= 48; a += 1) for (const luck of [0, 1]) {
    const r = dealRound([a, 48 - a], 4, luck);
    assert.equal(r.holes[0] + r.holes[1], 12); assert.ok(r.pits.every((v, i) => v === 0 || v === 4 || i === 6 || i === 13));
  }
});
t('a played round that ends in 2+2 carries the spin in its deal step', () => {
  let seen = 0;
  for (let k = 0; k < 400 && !seen; k++) {
    let s = newGame('gebeta', k & 1);
    for (let ply = 0; ply < 500 && !s.over; ply++) {
      const ms = legalMoves(s); if (!ms.length) break;
      const r = playMove(s, ms[Math.floor(Math.random() * ms.length)], 'gebeta'); s = r.state;
      const d = r.steps.find((x) => x.t === 'deal'); if (d && d.spin) { seen++; assert.ok(validState(s, true)); break; }
    }
  }
  console.log('   (spin rounds seen in random play:', seen, ')');
});
console.log(`${n} leftover tests passed`);
