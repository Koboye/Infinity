import assert from 'node:assert/strict';
import { register } from 'node:module';
process.env.GEBETA_RATE_MAX = '1000000';
register('./fakes/loader.mjs', import.meta.url);
const T = await import('../src/lib/hcTicket.js');
const HC = await import('../src/app/api/hillclimb/route.js');
const { POST: gebeta } = await import('../src/app/api/gebeta/route.js');
const confirm = await import('../src/app/api/pay/confirm/route.js');
const mw = await import('../src/middleware.js');
const { __store } = await import('./fakes/firebaseAdmin.mjs');

const SECRET = 'a'.repeat(24), now = Date.now();
// ── ticket: signed, personal, expires at midnight
const tk = await T.signTicket('amy', SECRET, now);
assert.equal(await T.verifyTicket(tk, SECRET, now), 'amy');
assert.equal(await T.verifyTicket(tk, 'b'.repeat(24), now), null, 'wrong secret');
assert.equal(await T.verifyTicket(tk.slice(0, -2) + 'xx', SECRET, now), null, 'edited signature');
const [u, , s] = tk.split('.'); const bob = Buffer.from('bob').toString('base64url');
assert.equal(await T.verifyTicket(`${bob}.${tk.split('.')[1]}.${s}`, SECRET, now), null, 'cannot swap in another account');
assert.equal(await T.verifyTicket(tk, SECRET, now + 86_400_000), null, 'expired next day');
assert.equal(await T.verifyTicket('', SECRET, now), null); assert.equal(await T.verifyTicket(tk, '', now), null, 'no secret = nothing verifies');
assert.equal(T.ticketSecret({ PAY_WEBHOOK_SECRET: 'short' }), ''); assert.equal(T.ticketSecret({ PASS_TICKET_SECRET: SECRET }), SECRET);

// ── API
const req = (uid, body, cookie) => ({ headers: { get: (h) => (h === 'authorization' && uid ? `Bearer tok:${uid}` : '') }, cookies: { get: () => (cookie ? { value: cookie } : undefined) }, json: async () => body });
const enter = (uid) => HC.POST(req(uid, { action: 'enter' }));
const start = (cookie) => HC.POST(req(null, { action: 'start' }, cookie));
const cfm = (body) => confirm.POST({ headers: { get: (h) => (h === 'x-pay-secret' ? SECRET : '') }, json: async () => body });
const pay = async (uid) => { const c = await gebeta({ headers: { get: () => `Bearer tok:${uid}` }, json: async () => ({ action: 'passClaim', phone: '0912345678' }) }); assert.equal((await cfm({ claim: c.body.claim })).status, 200); };

delete process.env.PAYWALL;
assert.equal((await HC.GET()).body.paywall, false);
assert.equal((await start(undefined)).body.free, true, 'paywall off: free, nothing required');

process.env.PAYWALL = '1'; delete process.env.PAY_WEBHOOK_SECRET; delete process.env.PASS_TICKET_SECRET;
assert.equal((await enter('amy')).status, 503, 'paywall on but no secret: fails closed');
process.env.PAY_WEBHOOK_SECRET = SECRET;
assert.equal((await HC.GET()).body.paywall, true);
assert.equal((await enter(null)).status, 401, 'sign in first');
assert.equal((await enter('amy')).status, 402, 'locked until paid');
assert.equal((await start(undefined)).status, 401, 'no ticket, no level');
assert.equal((await start('garbage')).status, 401);
const amyTk = await T.signTicket('amy', SECRET);
assert.equal((await start(amyTk)).status, 402, 'a ticket alone does not unlock: the pass decides');

await pay('amy');
assert.equal((await enter('amy')).status, 200); assert.equal((await enter('amy')).body.pass.left, 10, 'entering spends nothing');
for (let i = 1; i <= 10; i++) { const r = await start(amyTk); assert.equal(r.status, 200); assert.equal(r.body.pass.left, 10 - i); }
const over = await start(amyTk); assert.equal(over.status, 402); assert.match(over.body.error, /all 10 levels/);
assert.equal((await enter('amy')).status, 402, 'used up: cannot enter either');
assert.equal((await start(await T.signTicket('bob', SECRET))).status, 402, 'a pass is personal');
// shared with the other games: Hill Climb levels come out of the same 10
await pay('amy');
assert.equal((await gebeta({ headers: { get: () => 'Bearer tok:amy' }, json: async () => ({ action: 'passStart' }) })).body.pass.left, 9);
assert.equal((await start(amyTk)).body.pass.left, 8, 'one pass, one counter across every game');
// next day: locked again
__store.set('passes/amy', { ...__store.get('passes/amy'), day: '2026-01-01' });
assert.equal((await start(amyTk)).status, 402); assert.equal((await enter('amy')).status, 402);

// ── page gate (middleware)
const mreq = (cookie) => ({ cookies: { get: () => (cookie ? { value: cookie } : undefined) }, nextUrl: { clone: () => ({ pathname: '/games/hillclimb-racing/index.html', search: '' }) } });
delete process.env.PAYWALL;
assert.ok(!(await mw.middleware(mreq(undefined)))?.redirected, 'paywall off: page open');
process.env.PAYWALL = '1';
assert.ok((await mw.middleware(mreq(undefined)))?.redirected, 'no ticket: sent home');
assert.ok(!(await mw.middleware(mreq(amyTk)))?.redirected, 'valid ticket: page opens');
console.log('hillclimb gate tests passed');
