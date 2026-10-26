import assert from 'node:assert/strict';
const W = await import('../src/lib/walletCore.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const T0 = Date.parse('2026-10-26T12:00:00Z');

t('a new wallet holds exactly the 1000 welcome gift and a full set of spins', () => {
  const w = W.newWallet(T0); assert.equal(w.coins, 1000); assert.equal(W.view(w, T0).spins, 10);
});
t('entry fee is taken up front; no coins, no match', () => {
  const w = W.newWallet(T0);
  const a = W.charge(w, 50, T0); assert.equal(a.ok, true); assert.equal(a.wallet.coins, 950);
  assert.equal(W.charge(w, 77, T0).ok, false);
  assert.equal(W.charge({ ...w, coins: 40 }, 50, T0).ok, false);
  assert.equal(W.canAfford({ ...w, coins: 40 }, 50), false);
});
t('payouts: winner takes 90% of the pot, a draw refunds both, a loser gets nothing', () => {
  assert.deepEqual(W.payouts(100, 0), [180, 0]); assert.deepEqual(W.payouts(100, 1), [0, 180]);
  assert.deepEqual(W.payouts(100, 'draw'), [100, 100]); assert.deepEqual(W.payouts(1000, 1), [0, 1800]);
});
t('the house keeps exactly 10% of every decided pot and coins are never created by a draw', () => {
  for (const f of W.FEES) { const [a, b] = W.payouts(f, 0); assert.equal(f * 2 - (a + b), f * 2 * 0.1); const d = W.payouts(f, 'draw'); assert.equal(d[0] + d[1], f * 2); }
});
t('exactly 10 spins a server-day, every prize is listed, and the next UTC day resets them', () => {
  let w = W.newWallet(T0); let sum = 0;
  for (let i = 0; i < 10; i++) { const r = W.spinOnce(w, T0); assert.ok(r.ok); assert.ok(W.SPIN_PRIZES.some((p) => p.coins === r.coins)); sum += r.coins; w = r.wallet; }
  assert.equal(W.spinOnce(w, T0).ok, false); assert.equal(w.coins, 1000 + sum); assert.equal(W.view(w, T0).spins, 0);
  const next = Date.parse('2026-10-27T00:00:01Z');
  assert.equal(W.view(w, next).spins, 10); assert.equal(W.spinOnce(w, next).ok, true);
});
t('a phone clock cannot matter: the day comes from the `now` the server passes in', () => {
  assert.equal(W.dayKey(Date.parse('2026-10-26T23:59:59Z')), '2026-10-26'); assert.equal(W.dayKey(Date.parse('2026-10-27T00:00:00Z')), '2026-10-27');
});
t('spin odds follow the prize table exactly', () => {
  const hit = new Array(W.SPIN_PRIZES.length).fill(0);
  for (let r = 0; r < W.SPIN_WSUM; r++) hit[W.spinOnce(W.newWallet(T0), T0, () => r).index]++;
  W.SPIN_PRIZES.forEach((p, i) => assert.equal(hit[i], p.w * 10));
});
t('fee is always one of the listed tiers', () => { assert.equal(W.normalizeFee(200), 200); assert.equal(W.normalizeFee(7), 50); assert.equal(W.normalizeFee(undefined), 50); });
console.log(`wallet tests passed (${n})`);
