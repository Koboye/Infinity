import assert from 'node:assert/strict';
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const W = await import('../src/lib/wallet.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('new user gets exactly 1000 coins, welcome shown once', () => {
  assert.equal(W.balance(), 1000); assert.equal(W.takeWelcome(), true); assert.equal(W.takeWelcome(), false); assert.equal(W.balance(), 1000);
});
t('entry fee is taken up front; cannot start without coins', () => {
  assert.equal(W.startMatch({ fee: 50 }).ok, true); assert.equal(W.balance(), 950);
  assert.equal(W.startMatch({ fee: 77 }).ok, false);
  mem.set('gebeta.wallet.v1', JSON.stringify({ ...JSON.parse(mem.get('gebeta.wallet.v1')), coins: 40, stake: null }));
  assert.equal(W.startMatch({ fee: 50 }).ok, false); assert.equal(W.balance(), 40); assert.equal(W.canAfford(50), false);
});
t('win pays 90% of the pot, draw refunds, loss pays nothing, settle only once', () => {
  mem.clear(); W.load();
  W.startMatch({ fee: 100, seats: 2 }); assert.equal(W.settle('win').paid, 180); assert.equal(W.balance(), 1080); assert.equal(W.settle('win').paid, 0); assert.equal(W.balance(), 1080);
  W.startMatch({ fee: 200, seats: 4 }); assert.equal(W.settle('win').paid, 720); assert.equal(W.balance(), 1080 - 200 + 720);
  const b = W.balance(); W.startMatch({ fee: 100 }); assert.equal(W.settle('draw').paid, 100); assert.equal(W.balance(), b);
  W.startMatch({ fee: 100 }); assert.equal(W.settle('lose').paid, 0); assert.equal(W.balance(), b - 100);
});
t('quitting leaves the fee spent and a later result cannot reuse an old stake', () => {
  mem.clear(); W.load(); W.startMatch({ fee: 300 }); assert.equal(W.balance(), 700);
  W.startMatch({ fee: 50 }); assert.equal(W.balance(), 650); assert.equal(W.settle('win').paid, 90);
});
t('exactly 10 spins a day, each pays a listed prize, resets next day', () => {
  mem.clear(); W.load(); let sum = 0;
  for (let i = 0; i < 10; i++) { const r = W.spin(); assert.ok(r.ok); assert.ok(W.SPIN_PRIZES.some((p) => p.coins === r.coins)); sum += r.coins; }
  assert.equal(W.spin().ok, false); assert.equal(W.balance(), 1000 + sum); assert.equal(W.spinsLeft(), 0);
  const s = JSON.parse(mem.get('gebeta.wallet.v1')); s.spinDate = '2000-01-01'; mem.set('gebeta.wallet.v1', JSON.stringify(s));
  assert.equal(W.spinsLeft(), 10);
});
t('spin odds follow the prize table', () => {
  const total = W.SPIN_PRIZES.reduce((a, p) => a + p.w * 10, 0); const hit = new Array(W.SPIN_PRIZES.length).fill(0);
  for (let r = 0; r < total; r++) { mem.clear(); W.load(); hit[W.spin(() => r).index]++; }
  W.SPIN_PRIZES.forEach((p, i) => assert.equal(hit[i], p.w * 10));
});
console.log(`wallet tests passed (${n})`);
