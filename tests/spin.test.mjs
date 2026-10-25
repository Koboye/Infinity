// The "who starts" draw and the wheel: unbiased, independent, and the wheel can never disagree with the result.
import assert from 'node:assert/strict';
import { randomInt, fairCoin, randomFloat } from '../src/lib/fairRandom.js';
import { drawStarter } from '../src/lib/starter.js';
import { SLICES, SLICE_DEG, SAFE, ownerOfAngle, angleUnderPointer, pickLanding, finalRotation, easeOut, wheelGradient } from '../src/lib/spin.js';
import { newRoomDoc, seatSecondPlayer } from '../src/lib/online/rooms.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const chi2 = (counts) => { const tot = counts.reduce((a, b) => a + b, 0), e = tot / counts.length; return counts.reduce((s, c) => s + (c - e) ** 2 / e, 0); };

t('randomInt rejects the biased tail (no modulo bias)', () => {
  // for n = 3 the largest multiple of 3 below 2^32 is 4294967295, so that value must be re-drawn
  const seq = [4294967295, 4294967295, 7]; let i = 0;
  assert.equal(randomInt(3, () => seq[i++]), 7 % 3); assert.equal(i, 3);
  assert.equal(randomInt(1, () => { throw new Error('no draw needed'); }), 0);
  assert.throws(() => randomInt(0)); assert.throws(() => randomInt(2.5));
});
t('randomInt(2) over every residue class is exactly balanced', () => {
  // feed all 8 residues of a 3-bit word repeated: exact 50 / 50
  let a = 0, b = 0; for (let x = 0; x < 4096; x++) { if (randomInt(2, () => x) === 0) a++; else b++; }
  assert.equal(a, b);
});
t('the cryptographic coin is balanced (200 000 draws)', () => {
  let ones = 0; const N = 200000; for (let i = 0; i < N; i++) ones += fairCoin();
  assert.ok(Math.abs(ones - N / 2) < 5 * Math.sqrt(N) / 2, `ones=${ones}`); // 5 sigma
});
t('randomInt(6) is uniform (chi-square)', () => {
  const c = new Array(6).fill(0); for (let i = 0; i < 120000; i++) c[randomInt(6)]++;
  assert.ok(chi2(c) < 30, `chi2=${chi2(c)}`); // df = 5, p ≈ 1e-5
});
t('randomFloat stays in [0, 1) and is uniform over ten bins', () => {
  const c = new Array(10).fill(0);
  for (let i = 0; i < 100000; i++) { const x = randomFloat(); assert.ok(x >= 0 && x < 1); c[Math.floor(x * 10)]++; }
  assert.ok(chi2(c) < 35, `chi2=${chi2(c)}`); // df = 9
});
t('drawStarter is a plain independent coin: balanced, and streaks of three DO happen (no hidden correction)', () => {
  const N = 20000; let ones = 0, same = 0, prev = -1, run = 1, maxRun = 1, triples = 0, last3 = [];
  for (let i = 0; i < N; i++) {
    const p = drawStarter('game'); assert.ok(p === 0 || p === 1);
    ones += p; if (p === prev) { same++; run++; } else run = 1; maxRun = Math.max(maxRun, run); prev = p;
    last3.push(p); if (last3.length > 3) last3.shift(); if (last3.length === 3 && last3[0] === last3[1] && last3[1] === last3[2]) triples++;
  }
  assert.ok(Math.abs(ones - N / 2) < 5 * Math.sqrt(N) / 2, `ones=${ones}`);
  assert.ok(Math.abs(same / (N - 1) - 0.5) < 0.03, `P(same as previous)=${same / (N - 1)}`);      // independence
  assert.ok(Math.abs(triples / (N - 2) - 0.25) < 0.03, `P(three alike)=${triples / (N - 2)}`);   // 1/4 for a fair coin
  assert.ok(maxRun >= 5, `max run ${maxRun}`);
});
t('drawStarter uses the injected coin as it is (nothing flips it)', () => {
  for (let i = 0; i < 10; i++) assert.equal(drawStarter('x', () => 0), 0);
  for (let i = 0; i < 10; i++) assert.equal(drawStarter('x', () => 1), 1);
});

t('the wheel gives each player exactly half of it, alternating', () => {
  assert.equal(SLICES % 2, 0);
  const own = [0, 0]; for (let i = 0; i < 36000; i++) own[ownerOfAngle((i + 0.5) / 100)]++; // sample mid-step: exact slice counts
  assert.equal(own[0], own[1], `${own}`);
  for (let i = 0; i < SLICES; i++) assert.equal(ownerOfAngle((i + 0.5) * SLICE_DEG), i % 2);
  assert.equal(ownerOfAngle(-10), ownerOfAngle(350)); assert.equal(ownerOfAngle(720 + 10), ownerOfAngle(10));
  assert.ok(wheelGradient('#111', '#222').split('deg').length > SLICES);
});
t('the pointer ALWAYS ends in a slice of the winner, away from every edge (both winners, 100 000 spins each)', () => {
  for (const w of [0, 1]) for (let i = 0; i < 100000; i++) {
    const landing = pickLanding(w);
    assert.equal(ownerOfAngle(landing), w);
    const within = (landing / SLICE_DEG) % 1; assert.ok(within >= SAFE - 1e-9 && within <= 1 - SAFE + 1e-9, `within=${within}`);
    const turns = 5 + (i & 1), rot = finalRotation(landing, turns);
    assert.ok(rot >= turns * 360 && rot < (turns + 1) * 360, 'always forward, always at least `turns` full turns');
    assert.equal(ownerOfAngle(angleUnderPointer(rot)), w, 'what the pointer shows is the winner');
    assert.ok(Math.abs(angleUnderPointer(rot) - landing) < 1e-6 || Math.abs(Math.abs(angleUnderPointer(rot) - landing) - 360) < 1e-6);
  }
});
t('landing slice is uniform among the winner\'s slices, and the spot inside it is uniform', () => {
  for (const w of [0, 1]) {
    const c = new Array(SLICES / 2).fill(0), pos = new Array(8).fill(0); const N = 60000;
    for (let i = 0; i < N; i++) { const a = pickLanding(w); c[Math.floor(a / SLICE_DEG / 2)]++; pos[Math.floor((((a / SLICE_DEG) % 1) - SAFE) / (1 - 2 * SAFE) * 8)]++; }
    assert.ok(chi2(c) < 28, `slices chi2=${chi2(c)}`);   // df = 5
    assert.ok(chi2(pos) < 30, `position chi2=${chi2(pos)}`); // df = 7
  }
});
t('the picture is as unbiased as the draw: seen from outside, the landing angle is uniform around the wheel', () => {
  // coin + conditional landing ⇒ the angle under the pointer is uniform over the safe zones of all slices
  const bins = new Array(SLICES).fill(0); const N = 120000;
  for (let i = 0; i < N; i++) bins[Math.floor(pickLanding(fairCoin()) / SLICE_DEG)]++;
  assert.ok(chi2(bins) < 35, `chi2=${chi2(bins)}`); // df = 11
});
t('the ease-out is smooth: starts at 0, ends at 1, never goes backwards, stops dead at the end', () => {
  assert.equal(easeOut(0), 0); assert.equal(easeOut(1), 1); assert.equal(easeOut(2), 1); assert.equal(easeOut(-1), 0);
  let prev = -1; for (let i = 0; i <= 1000; i++) { const v = easeOut(i / 1000); assert.ok(v >= prev); prev = v; }
  assert.ok(easeOut(1) - easeOut(0.999) < 0.0001, 'zero speed at the end: no jump when the wheel stops');
});

t('online: who sits first and who opens are drawn by an unbiased default source', () => {
  const prof = (nm) => ({ displayName: nm, avatar: 'lion' });
  for (const game of ['gebeta', 'checkers']) {
    let seatSwap = 0, opens = 0; const N = 6000;
    for (let i = 0; i < N; i++) {
      const d = newRoomDoc({ game, uid: 'A', profile: prof('A'), ruleset: game === 'gebeta' ? 'gebeta' : 'flying', options: {}, isPublic: false, now: 0 });
      const r = seatSecondPlayer(d, { uid: 'B', profile: prof('B') }).room;
      seatSwap += r.players[0] === 'B' ? 1 : 0; opens += r.turn;
    }
    assert.ok(Math.abs(seatSwap - N / 2) < 5 * Math.sqrt(N) / 2, `${game} seats ${seatSwap}`);
    assert.ok(Math.abs(opens - N / 2) < 5 * Math.sqrt(N) / 2, `${game} opener ${opens}`);
  }
});
console.log(`${n} spin / fairness tests passed`);
