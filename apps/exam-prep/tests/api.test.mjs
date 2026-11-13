import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./fakes/loader.mjs', import.meta.url);
const ADMIN = 'A'.repeat(24), HOOK = 'W'.repeat(24);
process.env.ADMIN_SECRET = ADMIN; process.env.WEBHOOK_SECRET = HOOK;
const C = await import('../src/lib/core.js');
const bank = await import('../src/app/api/bank/route.js');
const exam = await import('../src/app/api/exam/route.js');
const pay = await import('../src/app/api/pay/confirm/route.js');
const review = await import('../src/app/api/admin/review/route.js');
const { __store } = await import('./fakes/firebaseAdmin.mjs');

const hdr = (o) => ({ get: (k) => o[k.toLowerCase()] || '' });
const as = (uid) => (uid ? { authorization: `Bearer tok:${uid}` } : {});
const POST = (route, uid, body, extra = {}) => route.POST({ headers: hdr({ ...as(uid), ...extra }), json: async () => body });
const GET = (route, uid, url = 'http://x/api', extra = {}) => route.GET({ url, headers: hdr({ ...as(uid), ...extra }) });
const me = async (uid) => (await POST(exam, uid, { action: 'me' })).body;
const asAdmin = { 'x-admin-secret': ADMIN };

// ── bank: counts public, preview for non-payers
const counts = (await GET(bank, null, 'http://x/api/bank')).body.counts;
assert.equal(counts['computer-science'], 8); assert.equal(counts.geology ?? 0, 0);
let r = await GET(bank, null, 'http://x/api/bank?dept=computer-science');
assert.equal(r.status, 200); assert.equal(r.body.questions.length, C.PREVIEW_COUNT, 'visitors see a preview only');
assert.equal(r.body.locked, true); assert.equal(r.body.total, 8);
assert.ok(r.body.questions[0].explanation, 'answers come with explanations');
assert.equal((await GET(bank, null, 'http://x/api/bank?dept=nope')).status, 404);
assert.equal((await GET(bank, 'amy', 'http://x/api/bank?dept=computer-science')).body.questions.length, C.PREVIEW_COUNT, 'signed in but unpaid: still a preview');

// ── auth
assert.equal((await POST(exam, null, { action: 'me' })).status, 401);
assert.equal((await POST(exam, 'amy', { action: 'nope' })).status, 400);

// ── paying: claim -> confirm
assert.equal((await POST(exam, 'amy', { action: 'claim', phone: 'abc' })).status, 400);
const c1 = (await POST(exam, 'amy', { action: 'claim', phone: '0911234567' })).body;
assert.equal(c1.price, 15); assert.equal(c1.reused, false);
assert.equal((await POST(exam, 'amy', { action: 'claim' })).body.claim, c1.claim, 'one open claim per student');
assert.equal((await GET(bank, 'amy', 'http://x/api/bank?dept=computer-science')).body.locked, true, 'claiming is not paying');
assert.equal((await POST(pay, null, { claim: c1.claim })).status, 401);
assert.equal((await POST(pay, null, { claim: c1.claim }, { 'x-admin-secret': 'wrong' })).status, 401);
assert.equal((await POST(pay, null, { claim: 'NOPE' }, asAdmin)).status, 404);
assert.equal((await POST(pay, null, { claim: c1.claim, amount: 10 }, { 'x-admin-secret': HOOK })).status, 400, 'too little paid');
assert.equal((await GET(pay, null, 'http://x', { 'x-admin-secret': HOOK })).body.claims.length, 1);
const paid = await POST(pay, null, { claim: c1.claim }, asAdmin);
assert.equal(paid.status, 200); assert.equal(paid.body.already, false);
assert.equal((await POST(pay, null, { claim: c1.claim }, asAdmin)).body.already, true, 'a claim pays once');
assert.equal((await me('amy')).sub.subscribed, true);
r = await GET(bank, 'amy', 'http://x/api/bank?dept=computer-science');
assert.equal(r.body.questions.length, 8); assert.equal(r.body.locked, false, 'a month unlocks every department');
const until1 = __store.get('subs/amy').until;
// second payment stacks
const c2 = (await POST(exam, 'amy', { action: 'claim', phone: '0911234567' })).body;
await POST(pay, null, { claim: c2.claim }, asAdmin);
assert.equal(__store.get('subs/amy').until, until1 + C.MONTH_MS, 'a second month is added after the first');
// webhook by phone + amount
await POST(exam, 'bob', { action: 'claim', phone: '+251922222222' });
assert.equal((await POST(pay, null, { phone: '0922222222', amount: 14 }, { 'x-admin-secret': HOOK })).status, 400);
assert.equal((await POST(pay, null, { phone: '0933333333', amount: 15 }, { 'x-admin-secret': HOOK })).body.matched, 0, 'no claim from that number');
assert.equal((await POST(pay, null, { phone: '0922222222', amount: 15 }, { 'x-admin-secret': HOOK })).body.matched, 1);
assert.equal((await me('bob')).sub.subscribed, true);
// webhook secret cannot reject; admin can
await POST(exam, 'cat', { action: 'claim', phone: '0944444444' });
const catClaim = (await me('cat')).openClaim.claim;
assert.equal((await POST(pay, null, { claim: catClaim, reject: true }, { 'x-admin-secret': HOOK })).status, 403);
assert.equal((await POST(pay, null, { claim: catClaim, reject: true }, asAdmin)).status, 200);
assert.equal((await POST(pay, null, { claim: catClaim }, asAdmin)).status, 409, 'a rejected claim cannot be paid');
assert.equal((await me('cat')).sub.subscribed, false);
assert.equal(((await POST(pay, null, {}, asAdmin))).status, 400);

// ── contributing
const q = (n, extra = {}) => ({ dept: 'computer-science', text: `Unique contributed question number ${n}: which of these is a Linux distribution code ${n}${'xyz'.repeat(n % 3)}?`, options: [`Ubuntu ${n}`, `Windows ${n}`, `macOS ${n}`, `Solaris ${n}`], answer: 0, explanation: `Ubuntu is a Linux distribution; the others are different operating systems (${n}).`, ...extra });
const items = Array.from({ length: 15 }, (_, i) => q(i + 100));
assert.equal((await POST(exam, 'dan', { action: 'contribute', dept: 'computer-science', items: [] })).status, 400);
assert.equal((await POST(exam, 'dan', { action: 'contribute', dept: 'zzz', items })).status, 400);
assert.equal((await POST(exam, 'dan', { action: 'contribute', dept: 'computer-science', items: Array(16).fill(items[0]) })).status, 400);
// bad, duplicate-of-bank, duplicate-in-batch, good
const mixed = [
  { ...items[0], explanation: 'no' },
  { text: 'What is the worst-case time complexity of binary search on a sorted array of n elements?', options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], answer: 1, explanation: 'Halving the range each step gives log n steps in total.' },
  items[1], items[1], items[2],
];
const m = (await POST(exam, 'dan', { action: 'contribute', dept: 'computer-science', items: mixed })).body;
assert.deepEqual(m.results.map((x) => x.ok), [false, false, true, false, true]);
assert.match(m.results[0].error, /Explain/); assert.match(m.results[1].error, /Already available/); assert.match(m.results[3].error, /Already available/);
assert.equal(m.accepted, 2);
assert.equal((await GET(review, null)).status, 401, 'queue is owner-only');
assert.equal((await GET(review, null, 'http://x', { 'x-admin-secret': HOOK })).status, 401, 'webhook secret cannot review');
let pending = (await GET(review, null, 'http://x', asAdmin)).body.pending; assert.equal(pending.length, 2);
// someone else cannot submit the same thing while it waits
assert.equal((await POST(exam, 'eve', { action: 'contribute', dept: 'computer-science', items: [items[1]] })).body.results[0].ok, false, 'a question already in the review queue counts as taken');
// approve 1, reject 1
const a1 = await POST(review, null, { id: pending[0].id, decision: 'approve' }, asAdmin); assert.equal(a1.body.status, 'approved'); assert.equal(a1.body.monthsGranted, 0);
assert.equal((await POST(review, null, { id: pending[0].id, decision: 'approve' }, asAdmin)).status, 409, 'decide once');
assert.equal((await POST(review, null, { id: pending[1].id, decision: 'reject', reason: 'unclear' }, asAdmin)).body.status, 'rejected');
assert.equal((await POST(review, null, { id: 'nope', decision: 'approve' }, asAdmin)).status, 404);
assert.equal((await POST(review, null, { id: pending[1].id, decision: 'maybe' }, asAdmin)).status, 400);
assert.equal((await GET(bank, null, 'http://x/api/bank')).body.counts['computer-science'], 9, 'approved question joins the bank');
// the approved question is now "available": a copy is refused
assert.equal((await POST(exam, 'eve', { action: 'contribute', dept: 'computer-science', items: [items[1]] })).body.results[0].ok, false);
// 15 approved = one free month
const dan = await me('dan'); assert.equal(dan.credits[0].approved, 1); assert.equal(dan.sub.subscribed, false);
const more = Array.from({ length: 15 }, (_, i) => q(i + 300));
const sub2 = (await POST(exam, 'dan', { action: 'contribute', dept: 'computer-science', items: more })).body; assert.equal(sub2.accepted, 15);
pending = (await GET(review, null, 'http://x', asAdmin)).body.pending;
let last; for (const p of pending.filter((x) => x.uid === 'dan').slice(0, 14)) last = await POST(review, null, { id: p.id, decision: 'approve' }, asAdmin);
assert.equal(last.body.approvedTotal, 15); assert.equal(last.body.monthsGranted, 1, 'the 15th approved question earns a month');
const dan2 = await me('dan'); assert.equal(dan2.sub.subscribed, true); assert.equal(dan2.credits[0].redeemed, 15);
assert.ok(Math.abs(__store.get('subs/dan').until - (Date.now() + C.MONTH_MS)) < 5000);
// pending cap
const spam = Array.from({ length: 15 }, (_, i) => q(i + 500)); const spam2 = Array.from({ length: 15 }, (_, i) => q(i + 700)); const spam3 = Array.from({ length: 15 }, (_, i) => q(i + 900));
assert.equal((await POST(exam, 'fay', { action: 'contribute', dept: 'computer-science', items: spam })).status, 200);
assert.equal((await POST(exam, 'fay', { action: 'contribute', dept: 'computer-science', items: spam2 })).status, 200);
assert.equal((await POST(exam, 'fay', { action: 'contribute', dept: 'computer-science', items: spam3 })).status, 429, 'at most 30 questions waiting per student');
const mine = await me('fay'); assert.equal(mine.contribs.length, 30); assert.equal(mine.contribs[0].status, 'pending');
console.log('api tests passed');
