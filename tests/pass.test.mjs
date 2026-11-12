import assert from 'node:assert/strict';
import { register } from 'node:module';
process.env.GEBETA_RATE_MAX = '1000000';
register('./fakes/loader.mjs', import.meta.url);
const C = await import('../src/lib/passCore.js');
const { POST } = await import('../src/app/api/gebeta/route.js');
const confirm = await import('../src/app/api/pay/confirm/route.js');
const { __store } = await import('./fakes/firebaseAdmin.mjs');

// ── pure rules
const t0 = Date.UTC(2026, 10, 12, 9, 0);                   // 12:00 in Addis
assert.equal(C.passDay(Date.UTC(2026, 10, 12, 20, 59)), '2026-11-12');
assert.equal(C.passDay(Date.UTC(2026, 10, 12, 21, 0)), '2026-11-13', 'the day ends at Ethiopian midnight (21:00 UTC)');
assert.equal(C.passView(null, t0).locked, true);
let p = C.grantPass(null, t0, 'REF').pass;
assert.equal(C.passView(p, t0).left, 10);
assert.equal(C.grantPass(p, t0).ok, false, 'a live pass is never replaced by a duplicate payment');
for (let i = 0; i < 10; i++) { const r = C.consumeLevel(p, t0 + i); assert.ok(r.ok); p = r.pass; }
assert.equal(C.consumeLevel(p, t0).reason, 'used-up');
assert.equal(C.grantPass(p, t0).ok, true, 'after the 10 levels a new payment opens a fresh pass');
assert.equal(C.consumeLevel(p, t0 + 86_400_000).reason, 'locked', 'next day: locked again');
assert.equal(C.cleanPhone('+251 912 345 678'), '0912345678');
assert.equal(C.cleanPhone('0712345678'), '0712345678');
assert.equal(C.cleanPhone('12345'), '');
assert.equal(C.ussdLink('*806*0928390022*1#'), 'tel:*806*0928390022*1%23');

// ── API
const call = async (uid, body) => POST({ headers: { get: () => (uid ? `Bearer tok:${uid}` : '') }, json: async () => body });
const ok = async (uid, body) => { const r = await call(uid, body); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
const cfm = (secret, body) => confirm.POST({ headers: { get: (h) => (h === 'x-pay-secret' ? secret : '') }, json: async () => body });

// paywall off (default): free, nothing recorded
delete process.env.PAYWALL;
assert.equal((await ok('amy', { action: 'passStart' })).free, true);
assert.equal((await ok('amy', { action: 'pass' })).pass.paywall, false);

process.env.PAYWALL = '1';
assert.equal((await call(null, { action: 'passStart' })).status, 401);
assert.equal((await call('amy', { action: 'passStart' })).status, 402, 'locked until paid');
assert.equal((await call('amy', { action: 'passClaim', phone: 'abc' })).status, 400);
const c1 = await ok('amy', { action: 'passClaim', phone: '0912345678' });
assert.equal((await call('bob', { action: 'passClaim' })).status, 400, 'a new claim needs the payer number');
const c2 = await ok('amy', { action: 'passClaim' });
assert.equal(c2.claim, c1.claim); assert.equal(c2.reused, true, 'one open claim per day');
assert.equal(__store.get(`payClaims/${c1.claim}`).phone, '0912345678');
assert.equal((await call('amy', { action: 'passStart' })).status, 402, 'claiming is not paying');

// confirmation endpoint: disabled / wrong secret / right secret
delete process.env.PAY_WEBHOOK_SECRET;
assert.equal((await cfm('x', { claim: c1.claim })).status, 503);
process.env.PAY_WEBHOOK_SECRET = 'a'.repeat(24);
assert.equal((await cfm('wrong', { claim: c1.claim })).status, 401);
assert.equal((await call('amy', { action: 'passStart' })).status, 402, 'a wrong secret unlocks nothing');
assert.equal((await cfm('a'.repeat(24), { claim: 'NOPE' })).status, 404);
const pend = await confirm.GET({ headers: { get: (h) => (h === 'x-pay-secret' ? 'a'.repeat(24) : '') } });
assert.equal(pend.body.claims.length, 1); assert.equal(pend.body.claims[0].uid, 'amy');
const paid = await cfm('a'.repeat(24), { claim: c1.claim });
assert.equal(paid.status, 200); assert.equal(paid.body.already, false);
assert.equal((await cfm('a'.repeat(24), { claim: c1.claim })).body.already, true, 'a claim pays once');

// 10 starts, the 11th is refused
assert.equal((await ok('amy', { action: 'pass' })).pass.left, 10);
for (let i = 1; i <= 10; i++) assert.equal((await ok('amy', { action: 'passStart' })).pass.left, 10 - i);
const over = await call('amy', { action: 'passStart' });
assert.equal(over.status, 402); assert.match(over.body.error, /all 10 levels/);
// pays again after using them all
const c3 = await ok('amy', { action: 'passClaim', phone: '0912345678' }); assert.notEqual(c3.claim, c1.claim);
assert.equal((await cfm('a'.repeat(24), { claim: c3.claim })).status, 200);
assert.equal((await ok('amy', { action: 'pass' })).pass.left, 10);
// a pass is personal
assert.equal((await call('bob', { action: 'passStart' })).status, 402);
// yesterday's pass does not carry over
__store.set('passes/amy', { ...__store.get('passes/amy'), day: '2026-01-01' });
assert.equal((await call('amy', { action: 'passStart' })).status, 402);
console.log('pass tests passed');
