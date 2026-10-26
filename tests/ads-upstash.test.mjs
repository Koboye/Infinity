// Upstash-backed global guard: counts across instances, fails over to memory, never throws.
import assert from 'node:assert/strict';
const { upstashAllow, makeGlobalGuard, upstashConfigured } = await import('../src/lib/upstashGuard.js');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };
const env = { UPSTASH_REDIS_REST_URL: 'https://x.upstash.io/', UPSTASH_REDIS_REST_TOKEN: 'tok' };
// fake Redis shared by "two server instances"; records the requests it receives
const fakeRedis = () => { const db = new Map(), calls = []; return { calls, fetchImpl: async (url, init) => {
  calls.push({ url, init }); const cmds = JSON.parse(init.body); const v = (db.get(cmds[0][1]) || 0) + 1; db.set(cmds[0][1], v);
  return { ok: true, json: async () => [{ result: v }, { result: 1 }] }; } }; };

await t('not configured: answers null (caller uses memory)', async () => {
  assert.equal(upstashConfigured({}), false); assert.equal(await upstashAllow('k', 3, 60, { env: {} }), null);
});
await t('talks to the REST pipeline with a bearer token, INCR + EXPIRE NX', async () => {
  const r = fakeRedis(); await upstashAllow('k1', 3, 3600, { env, fetchImpl: r.fetchImpl });
  assert.equal(r.calls[0].url, 'https://x.upstash.io/pipeline'); assert.equal(r.calls[0].init.headers.Authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(r.calls[0].init.body), [['INCR', 'k1'], ['EXPIRE', 'k1', '3600', 'NX']]);
});
await t('limit is global: two guards (two instances) share one count', async () => {
  const r = fakeRedis(); const a = makeGlobalGuard({ env, fetchImpl: r.fetchImpl }), b = makeGlobalGuard({ env, fetchImpl: r.fetchImpl });
  const res = []; for (let i = 0; i < 5; i++) res.push(await (i % 2 ? a : b)('click', '1.2.3.4', 'ad1'));
  assert.deepEqual(res, [true, true, true, false, false]);
  assert.equal(await a('click', '5.6.7.8', 'ad1'), true, 'another address is unaffected');
});
await t('Upstash down (error, bad status, timeout, junk): falls back to the memory guard, never throws', async () => {
  const bad = [async () => { throw new Error('net'); }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => ({}) }),
    (u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('abort'))))];
  for (const fetchImpl of bad) {
    const g = makeGlobalGuard({ env, fetchImpl, timeoutMs: 20 });
    const res = []; for (let i = 0; i < 5; i++) res.push(await g('click', '9.9.9.9', 'ad2'));
    assert.deepEqual(res, [true, true, true, false, false], 'local limit still applies');
  }
});
await t('unknown event kinds are refused; odd addresses cannot inject into the key', async () => {
  const r = fakeRedis(); const g = makeGlobalGuard({ env, fetchImpl: r.fetchImpl });
  assert.equal(await g('bogus', '1.1.1.1', 'a'), false); assert.equal(r.calls.length, 0);
  await g('click', '1.1.1.1\r\nFLUSHALL', 'a'); assert.ok(!JSON.parse(r.calls[0].init.body)[0][1].match(/[\r\n ]/));
});
console.log(`${n} ads-upstash tests passed`);
