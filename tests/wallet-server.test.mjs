// The server owns every coin: gift, spins, entry fees and prizes. Runs the real route against an in-memory Firestore.
import assert from 'node:assert/strict';
import { register } from 'node:module';
process.env.GEBETA_RATE_MAX = '1000000';
register('./fakes/loader.mjs', import.meta.url);
const { POST } = await import('../src/app/api/gebeta/route.js');
const { __store } = await import('./fakes/firebaseAdmin.mjs');
const call = (uid, body) => POST({ headers: { get: () => (uid ? `Bearer tok:${uid}` : '') }, json: async () => body });
const ok = async (uid, body) => { const r = await call(uid, body); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
const coins = (u) => __store.get(`wallets/${u}`).coins;
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };
for (const u of ['alice', 'bob', 'cara']) __store.set(`users/${u}`, { displayName: u, avatar: 'lion', rating: 1000, wins: 0, losses: 0, draws: 0, games: 0 });

await t('wallet needs sign-in; first read creates the account wallet with the 1000 gift, once', async () => {
  assert.equal((await call(null, { action: 'wallet' })).status, 401);
  const a = await ok('alice', { action: 'wallet' }); assert.equal(a.gift, true); assert.equal(a.wallet.coins, 1000); assert.equal(a.wallet.spins, 10);
  const b = await ok('alice', { action: 'wallet' }); assert.equal(b.gift, false); assert.equal(coins('alice'), 1000);
});
await t('spins are server-checked: 10 a day, then refused; balance only changes by the prize', async () => {
  let sum = 0;
  for (let i = 0; i < 10; i++) { const r = await ok('bob', { action: 'spin' }); sum += r.coins; assert.equal(r.wallet.spins, 9 - i); }
  assert.equal((await call('bob', { action: 'spin' })).status, 409); assert.equal(coins('bob'), 1000 + sum);
  __store.set('wallets/bob', { ...__store.get('wallets/bob'), coins: 1000 }); // reset for the match tests
});
await t('a client cannot write a wallet through the API (no such action, no body field is trusted)', async () => {
  assert.equal((await call('alice', { action: 'setCoins', coins: 99999 })).status, 400);
  await ok('alice', { action: 'wallet', coins: 99999 }); assert.equal(coins('alice'), 1000);
});
await t('entry fee: charged to both at the moment the second player joins, not before', async () => {
  const c = await ok('alice', { action: 'quick', ruleset: 'gebeta', fee: 200 });
  assert.equal(coins('alice'), 1000, 'waiting for an opponent costs nothing');
  const j = await ok('bob', { action: 'quick', ruleset: 'gebeta', fee: 200 }); assert.equal(j.code, c.code);
  assert.equal(coins('alice'), 800); assert.equal(coins('bob'), 800);
  const r = __store.get(`gebetaRooms/${c.code}`); assert.equal(r.fee, 200); assert.equal(r.paid, true);
  // winner takes 90% of the 400 pot; the loser's fee is gone; both done in the finishing transaction
  const loser = r.players[0]; await ok(loser, { action: 'resign', code: c.code });
  const w = r.players[1]; assert.equal(coins(w), 800 + 360); assert.equal(coins(loser), 800);
  const done = __store.get(`gebetaRooms/${c.code}`); assert.deepEqual(done.coinChange[done.players.indexOf(w)], 160); assert.equal(done.coinChange[done.players.indexOf(loser)], -200);
  assert.equal(done.paid, false);
  await ok(loser, { action: 'resign', code: c.code }).catch(() => {}); assert.equal(coins(w), 1160, 'a finished match can never pay twice');
});
await t('different fee tiers never pair; a player with too few coins cannot open or enter a match', async () => {
  const x = await ok('cara', { action: 'quick', ruleset: 'gebeta', fee: 100 });
  const y = await ok('alice', { action: 'quick', ruleset: 'gebeta', fee: 300 }); assert.notEqual(x.code, y.code); assert.equal(y.status, 'waiting');
  __store.set('wallets/cara', { ...__store.get('wallets/cara'), coins: 30 });
  assert.equal((await call('cara', { action: 'create', game: 'gebeta', fee: 50 })).status, 402);
  assert.equal((await call('cara', { action: 'join', code: y.code })).status, 402);
  assert.equal(coins('cara'), 30, 'a refused join takes nothing');
  __store.set('wallets/cara', { ...__store.get('wallets/cara'), coins: 1000 });
});
await t('host who can no longer pay blocks the match instead of going negative', async () => {
  const h = await ok('bob', { action: 'create', game: 'gebeta', fee: 500 });
  __store.set('wallets/bob', { ...__store.get('wallets/bob'), coins: 100 });
  assert.equal((await call('cara', { action: 'join', code: h.code })).status, 409);
  assert.equal(coins('bob'), 100); assert.equal(coins('cara'), 1000);
  __store.set('wallets/bob', { ...__store.get('wallets/bob'), coins: 1000 });
});
await t('rematch keeps the same fee and charges again when it starts', async () => {
  const c = await ok('alice', { action: 'create', game: 'gebeta', fee: 100 }); await ok('cara', { action: 'join', code: c.code });
  const before = [coins('alice'), coins('cara')];
  const r = __store.get(`gebetaRooms/${c.code}`); await ok(r.players[0], { action: 'resign', code: c.code });
  const re = await ok('alice', { action: 'rematch', code: c.code }); await ok('cara', { action: 'rematch', code: c.code });
  assert.equal(__store.get(`gebetaRooms/${re.code}`).fee, 100); assert.equal(__store.get(`gebetaRooms/${re.code}`).paid, true);
  const loser = r.players[0], winner = r.players[1];
  assert.equal(coins(winner), before[winner === 'alice' ? 0 : 1] + 180 - 100); assert.equal(coins(loser), before[loser === 'alice' ? 0 : 1] - 100);
});
console.log(`wallet-server tests passed (${n})`);
