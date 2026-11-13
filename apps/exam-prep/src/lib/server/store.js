// Firestore side of the rules in core.js. Collections (all server-only; see firestore.rules):
//   subs/{uid}            { until }                          paid or earned access, ms since epoch
//   claims/{ref}          { uid, phone, status, amount }     "I paid 15 birr" claims, confirmed by the owner or a payment webhook
//   contribs/{id}         { uid, dept, q, status }           questions waiting for review (pending | approved | rejected)
//   questions/{id}        { dept, text, options, ... }       approved community questions
//   credits/{uid_dept}    { uid, dept, approved, redeemed }  approved-question count and how many were already traded for a month
import { randomBytes } from 'node:crypto';
import { adminDb } from '@/lib/firebaseAdmin';
import { PRICE_ETB, CREDIT_BATCH, PENDING_CAP, subState, extendUntil, cleanPhone, cleanQuestion, findDuplicate } from '@/lib/core.js';
import { seedFor, seedCounts } from '@/lib/seed.js';
import { HttpError, fail } from '@/lib/http.js';

const db = () => adminDb();

// ── access
export async function getSub(uid, now = Date.now()) {
  const s = await db().collection('subs').doc(uid).get();
  return subState(s.exists ? s.data().until : 0, now);
}

// ── paying
export async function openClaim(uid, rawPhone, now = Date.now()) {
  const open = await db().collection('claims').where('uid', '==', uid).where('status', '==', 'open').limit(1).get();
  if (open.docs.length) { const d = open.docs[0]; return { claim: d.id, phone: d.data().phone, price: PRICE_ETB, reused: true }; }
  const phone = cleanPhone(rawPhone);
  if (!phone) fail(400, 'Enter the mobile number you will pay from (09… or 07…)');
  const claim = randomBytes(4).toString('hex').toUpperCase();
  await db().collection('claims').doc(claim).create({ uid, phone, status: 'open', amount: PRICE_ETB, createdAt: now });
  return { claim, phone, price: PRICE_ETB, reused: false };
}

/** Mark one claim paid and give the owner's student a month. Safe to call twice. */
export async function confirmClaim(claimId, now = Date.now(), paidAmount) {
  if (paidAmount != null && Number(paidAmount) < PRICE_ETB) fail(400, `Payment is under ${PRICE_ETB} birr`);
  return db().runTransaction(async (tx) => {
    const cref = db().collection('claims').doc(String(claimId || '').toUpperCase());
    const c = await tx.get(cref);
    if (!c.exists) fail(404, 'No such claim');
    const cd = c.data();
    if (cd.status === 'paid') return { already: true, uid: cd.uid };
    if (cd.status !== 'open') fail(409, 'This claim was rejected');
    const sref = db().collection('subs').doc(cd.uid);
    const s = await tx.get(sref);
    const until = extendUntil(s.exists ? s.data().until : 0, now, 1, false);
    tx.set(sref, { until, updatedAt: now });
    tx.update(cref, { status: 'paid', paidAt: now });
    return { already: false, uid: cd.uid, until };
  });
}

/** For a payment webhook or SMS forwarder: find the one open claim made from that number and confirm it. */
export async function confirmByPhone(rawPhone, amount, now = Date.now()) {
  const phone = cleanPhone(rawPhone);
  if (!phone) fail(400, 'Unrecognised phone number');
  const found = await db().collection('claims').where('phone', '==', phone).where('status', '==', 'open').limit(5).get();
  if (found.docs.length === 0) return { matched: 0 };
  if (found.docs.length > 1) return { matched: found.docs.length, ambiguous: true };
  return { matched: 1, ...(await confirmClaim(found.docs[0].id, now, amount)) };
}

export async function rejectClaim(claimId) {
  const ref = db().collection('claims').doc(String(claimId || '').toUpperCase());
  const c = await ref.get();
  if (!c.exists) fail(404, 'No such claim');
  if (c.data().status === 'paid') fail(409, 'Already paid');
  await ref.update({ status: 'rejected' });
  return { ok: true };
}

export async function listOpenClaims() {
  const r = await db().collection('claims').where('status', '==', 'open').orderBy('createdAt').limit(200).get();
  return r.docs.map((d) => ({ claim: d.id, ...pick(d.data(), ['uid', 'phone', 'amount', 'createdAt']) }));
}

// ── the question bank
async function approved(dept) {
  const r = await db().collection('questions').where('dept', '==', dept).limit(2000).get();
  return r.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function bankFor(dept) { return [...seedFor(dept), ...(await approved(dept))]; }
export async function bankCounts() {
  const counts = { ...seedCounts() };
  const all = await db().collection('questions').get();
  for (const d of all.docs) { const k = d.data().dept; counts[k] = (counts[k] || 0) + 1; }
  return counts;
}

// ── contributing
/** Accept up to 15 questions for one department. Each is checked, compared with everything already available, and queued for review. */
export async function submitQuestions(uid, dept, items, now = Date.now()) {
  if (!Array.isArray(items) || items.length < 1 || items.length > CREDIT_BATCH) fail(400, `Send 1 to ${CREDIT_BATCH} questions at a time`);
  const pendingNow = await db().collection('contribs').where('uid', '==', uid).where('status', '==', 'pending').limit(PENDING_CAP + 1).get();
  if (pendingNow.docs.length + items.length > PENDING_CAP) fail(429, `You already have ${pendingNow.docs.length} questions waiting for review. Wait for them to be reviewed before sending more.`);
  const waiting = await db().collection('contribs').where('dept', '==', dept).where('status', '==', 'pending').limit(2000).get();
  const pool = [...(await bankFor(dept)), ...waiting.docs.map((d) => ({ id: d.id, ...d.data().q }))];
  const results = [];
  for (let i = 0; i < items.length; i++) {
    const c = cleanQuestion(items[i], dept);
    if (!c.ok) { results.push({ index: i, ok: false, error: c.error }); continue; }
    const dup = findDuplicate(c.q, pool);
    if (dup) { results.push({ index: i, ok: false, error: `Already available (${dup.why}). Send a question that is not in the bank yet.` }); continue; }
    const id = randomBytes(8).toString('hex');
    await db().collection('contribs').doc(id).create({ uid, dept, q: c.q, status: 'pending', createdAt: now });
    pool.push({ id, ...c.q });
    results.push({ index: i, ok: true, id });
  }
  return { results, accepted: results.filter((r) => r.ok).length };
}

export async function myContributions(uid) {
  const [mine, cr] = await Promise.all([
    db().collection('contribs').where('uid', '==', uid).orderBy('createdAt').limit(200).get(),
    db().collection('credits').where('uid', '==', uid).get(),
  ]);
  return {
    contribs: mine.docs.map((d) => ({ id: d.id, dept: d.data().dept, status: d.data().status, reason: d.data().reason || '', text: d.data().q.text })).reverse(),
    credits: cr.docs.map((d) => ({ dept: d.data().dept, approved: d.data().approved || 0, redeemed: d.data().redeemed || 0, toNext: CREDIT_BATCH - (((d.data().approved || 0) - (d.data().redeemed || 0)) % CREDIT_BATCH) })),
  };
}

export async function listPending() {
  const r = await db().collection('contribs').where('status', '==', 'pending').orderBy('createdAt').limit(100).get();
  return r.docs.map((d) => ({ id: d.id, uid: d.data().uid, dept: d.data().dept, createdAt: d.data().createdAt, q: d.data().q }));
}

/** Owner's decision on one queued question. Approving adds it to the bank, counts it toward the contributor's credits, and pays out any month earned. */
export async function reviewContribution(id, decision, reason = '', now = Date.now()) {
  if (!['approve', 'reject'].includes(decision)) fail(400, 'decision must be approve or reject');
  const cref = db().collection('contribs').doc(String(id));
  const pre = await cref.get();
  if (!pre.exists) fail(404, 'No such submission');
  let verdict = decision, why = String(reason || '').slice(0, 200);
  if (verdict === 'approve') { // another reviewer may have approved something equal in the meantime
    const dup = findDuplicate({ ...pre.data().q }, await approved(pre.data().dept));
    if (dup) { verdict = 'reject'; why = `Duplicate of an existing question (${dup.why})`; }
  }
  return db().runTransaction(async (tx) => {
    const c = await tx.get(cref);
    if (c.data().status !== 'pending') fail(409, `Already ${c.data().status}`);
    const d = c.data();
    if (verdict === 'reject') { tx.update(cref, { status: 'rejected', reason: why, reviewedAt: now }); return { status: 'rejected', reason: why }; }
    const crRef = db().collection('credits').doc(`${d.uid}_${d.dept}`);
    const cr = await tx.get(crRef);
    const sRef = db().collection('subs').doc(d.uid);
    const sub = await tx.get(sRef);
    const have = cr.exists ? cr.data() : { approved: 0, redeemed: 0 };
    const approvedN = (have.approved || 0) + 1;
    const months = Math.floor((approvedN - (have.redeemed || 0)) / CREDIT_BATCH);
    const redeemed = (have.redeemed || 0) + months * CREDIT_BATCH;
    tx.set(db().collection('questions').doc(id), { ...d.q, by: d.uid, source: 'contrib', approvedAt: now });
    tx.update(cref, { status: 'approved', reviewedAt: now });
    tx.set(crRef, { uid: d.uid, dept: d.dept, approved: approvedN, redeemed });
    let until = sub.exists ? sub.data().until : 0;
    if (months > 0) { until = extendUntil(until, now, months, true); tx.set(sRef, { until, updatedAt: now }); }
    return { status: 'approved', monthsGranted: months, approvedTotal: approvedN };
  });
}

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
export { HttpError };
