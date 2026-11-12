import assert from 'node:assert/strict';
import { register } from 'node:module';
process.env.GEBETA_RATE_MAX = '1000000';
register('./fakes/loader.mjs', import.meta.url);
const { POST } = await import('../src/app/api/gebeta/route.js');
const sms = await import('../src/app/api/pay/sms/route.js');
const confirm = await import('../src/app/api/pay/confirm/route.js');
const A = await import('../src/lib/online/passApi.js');
const { __store } = await import('./fakes/firebaseAdmin.mjs');
process.env.PAYWALL = '1'; process.env.PAY_WEBHOOK_SECRET = 's'.repeat(24);

const call = async (uid, body) => POST({ headers: { get: () => `Bearer tok:${uid}` }, json: async () => body });
const ok = async (uid, body) => { const r = await call(uid, body); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
const S = 's'.repeat(24);
const post = (route, body, secret = S) => route.POST({ headers: { get: (h) => (h === 'x-pay-secret' ? secret : '') }, url: 'http://x/api/pay', json: async () => body });
__store.set('users/amy', { displayName: 'Amy' }); __store.set('users/bob', { displayName: 'Bob' });

// parser
const p = A.parseSms('You received ETB 25.00 from 0912345678 (ABEBE) on 12/11. Balance 0928390022');
assert.deepEqual(p.phones.sort(), ['0912345678', '0928390022']); assert.equal(p.amount, 25);
assert.equal(A.parseSms('Dear customer 1,500 Birr from +251 91 234 5678').amount, 1500);

// auth + secret in the URL for forwarder apps
assert.equal((await post(sms, { text: 'x' }, 'bad')).status, 401);
const viaUrl = await sms.POST({ headers: { get: () => '' }, url: `http://x/api/pay/sms?key=${S}`, json: async () => ({ message: 'Received ETB 5 from 0900000001' }) });
assert.equal(viaUrl.status, 200); assert.equal(viaUrl.body.reason, 'no-claim');

// claim first, SMS second -> auto-approved
const c = await ok('amy', { action: 'passClaim', phone: '0911111111' });
const r1 = await post(sms, { text: 'You received ETB 10 from 0911111111' });
assert.equal(r1.body.matched, true); assert.equal(r1.body.uid, 'amy');
assert.equal((await ok('amy', { action: 'pass' })).pass.left, 10);
assert.equal((await post(sms, { text: 'You received ETB 10 from 0911111111' })).body.reason, 'duplicate', 'the same SMS cannot pay twice');

// SMS first, claim second -> approved when the player checks
await post(sms, { text: 'You received ETB 10 from 0922222222 ref77' });
await ok('bob', { action: 'passClaim', phone: '0922222222' });
assert.equal((await ok('bob', { action: 'pass' })).pass.left, 10, 'a payment that arrived before the claim is found');
assert.equal((await ok('bob', { action: 'pass' })).pass.left, 10);

// amount too small is ignored
process.env.PASS_MIN_AMOUNT = '10';
__store.set('users/cy', { displayName: 'Cy' });
await ok('cy', { action: 'passClaim', phone: '0933333333' });
assert.equal((await post(sms, { text: 'You received ETB 2 from 0933333333' })).body.reason, 'amount');
assert.equal((await ok('cy', { action: 'pass' })).pass.left, 0);
delete process.env.PASS_MIN_AMOUNT;

// two claims, one number -> owner decides; owner list shows the name; reject frees the player
__store.set('users/di', { displayName: 'Di' }); __store.set('users/ed', { displayName: 'Ed' });
await ok('di', { action: 'passClaim', phone: '0944444444' }); await ok('ed', { action: 'passClaim', phone: '0944444444' });
assert.equal((await post(sms, { text: 'Received ETB 10 from 0944444444' })).body.reason, 'ambiguous');
const list = await confirm.GET({ headers: { get: (h) => (h === 'x-pay-secret' ? S : '') }, url: 'http://x' });
const names = list.body.claims.map((x) => x.name); assert.ok(names.includes('Di') && names.includes('Ed'));
const di = list.body.claims.find((x) => x.name === 'Di');
assert.equal((await post(confirm, { claim: di.claim })).status, 200);
const ed = list.body.claims.find((x) => x.name === 'Ed');
assert.equal((await post(confirm, { claim: ed.claim, reject: true })).body.rejected, true);
assert.equal((await post(confirm, { claim: ed.claim, reject: true })).status, 409);
assert.equal((await ok('ed', { action: 'pass' })).pass.pending, false);
console.log('pass-sms tests passed');
