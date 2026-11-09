import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
process.env.NEXT_PUBLIC_APP_VERSION = '3.1.3';
register('./fakes/loader.mjs', import.meta.url);
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };
const health = await import('../src/app/api/health/route.js');
await t('health: GET returns ok + version, never cached', async () => {
  const r = await health.GET(); const b = r.body;
  assert.equal(r.status, 200); assert.equal(b.ok, true); assert.ok(b.version); assert.match(fs.readFileSync('src/app/api/health/route.js', 'utf8'), /no-store/);
});
await t('health: HEAD is 200', async () => assert.equal((await health.HEAD()).status, 200));
const sw = fs.readFileSync('public/sw.js', 'utf8');
await t('service worker only caches good responses and bounds the cache', () => {
  assert.match(sw, /res\.ok \|\| res\.type === 'opaque'/); assert.match(sw, /MAX_RUNTIME/);
  assert.equal((sw.match(/keep\(r, res\)/g) || []).length, 2, 'both fetch paths use keep()');
  assert.ok(!/x\.put\(r, c\)\); return res/.test(sw), 'no unconditional cache put left');
});
await t('error boundaries exist', () => { for (const f of ['error', 'global-error', 'not-found']) assert.ok(fs.existsSync(`src/app/${f}.tsx`), f); });
console.log(n, 'tests passed');
