// Daily level pass, server side. Everything is written with the Admin SDK; the phone can only read its own pass.
//   passes/{uid}      = { day, total, used, ref, paidAt, pending: { id, day, at } }
//   payClaims/{id}    = { uid, day, phone, status: 'pending' | 'confirmed', createdAt, confirmedAt }
// Flow: player taps "Pay" -> claim (pending) -> player pays by USSD -> the owner's server confirms the claim
// (provider webhook, SMS forwarder or the owner by hand) -> the pass opens -> each level start spends one.
import { randomUUID, createHash } from 'node:crypto';
import { fail } from './httpError.js';
import { passView, grantPass, consumeLevel, passDay, cleanPhone } from '../passCore.js';

const passRef = (db, uid) => db.collection('passes').doc(uid);
const claimRef = (db, id) => db.collection('payClaims').doc(id);

/** The master switch. Off (default) = every level is free, exactly as before this feature. */
export const paywallOn = (env = process.env) => env.PAYWALL === '1' || env.PAYWALL === 'true';

export async function passInfo(db, uid, now = Date.now()) {
  const s = await passRef(db, uid).get();
  const p = s.exists ? s.data() : null;
  let pending = !!(p?.pending && p.pending.day === passDay(now));
  if (pending && passView(p, now).left <= 0) {   // a payment SMS may already be waiting for this player's number
    const c = await claimRef(db, p.pending.id).get();
    if (c.exists && c.data().status === 'pending' && c.data().phone && await takeSms(db, c.data().phone, now)) {
      try { await confirmClaim(db, p.pending.id, now); pending = false; const s2 = await passRef(db, uid).get(); return { pass: { ...passView(s2.data(), now), paywall: paywallOn(), pending } }; } catch { /* stays pending for the owner */ }
    }
  }
  return { pass: { ...passView(p, now), paywall: paywallOn(), pending } };
}

/** The player says "I am paying now". One open claim per day is reused, so tapping twice never spams the owner. */
export async function passClaim(db, uid, phoneRaw, now = Date.now()) {
  const phone = cleanPhone(phoneRaw);
  if (phoneRaw && !phone) fail(400, 'Enter the phone number you pay from, like 0912345678');
  return db.runTransaction(async (tx) => {
    const s = await tx.get(passRef(db, uid));
    const p = s.exists ? s.data() : {};
    const v = passView(p, now);
    if (v.active && v.left > 0) fail(409, 'Your pass is already active today');
    const day = passDay(now);
    if (p.pending && p.pending.day === day) {
      const open = await tx.get(claimRef(db, p.pending.id));
      if (open.exists && open.data().status === 'pending') {
        if (phone && open.data().phone !== phone) tx.set(claimRef(db, p.pending.id), { ...open.data(), phone });
        return { claim: p.pending.id, reused: true, ...(await viewAfter(p, now)) };
      }
    }
    if (!phone) fail(400, 'Enter the phone number you pay from, like 0912345678');
    const id = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
    tx.set(claimRef(db, id), { uid, day, phone, status: 'pending', createdAt: now });
    tx.set(passRef(db, uid), { ...p, pending: { id, day, at: now } });
    return { claim: id, reused: false, ...(await viewAfter(p, now)) };
  });
}
const viewAfter = async (p, now) => ({ pass: { ...passView(p, now), paywall: paywallOn(), pending: true } });

/** Spend one level start. This is the only gate: the client asks, the server decides. */
export async function passStart(db, uid, now = Date.now()) {
  if (!paywallOn()) return { pass: { ...passView(null, now), paywall: false, pending: false }, free: true };
  return db.runTransaction(async (tx) => {
    const s = await tx.get(passRef(db, uid));
    const p = s.exists ? s.data() : null;
    const r = consumeLevel(p, now);
    if (!r.ok) fail(402, r.reason === 'used-up' ? 'You used all 10 levels today. Pay again to unlock 10 more.' : 'Pay to unlock today\'s 10 levels');
    tx.set(passRef(db, uid), { ...p, ...r.pass });
    return { pass: { ...passView(r.pass, now), paywall: true, pending: false } };
  });
}

/** Called by the owner's trusted channel only (see /api/pay/confirm). Idempotent: a claim pays once. */
export async function confirmClaim(db, claimId, now = Date.now()) {
  const id = String(claimId || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!id) fail(400, 'claim is required');
  return db.runTransaction(async (tx) => {
    const c = await tx.get(claimRef(db, id));
    if (!c.exists) fail(404, 'Unknown claim');
    const claim = c.data();
    if (claim.status === 'confirmed') return { ok: true, uid: claim.uid, already: true };
    const s = await tx.get(passRef(db, claim.uid));
    const p = s.exists ? s.data() : {};
    const g = grantPass(p, now, id);
    if (!g.ok) fail(409, 'That player already has an active pass');
    tx.set(passRef(db, claim.uid), { ...g.pass });   // a fresh pass; the pending marker is cleared
    tx.set(claimRef(db, id), { ...claim, status: 'confirmed', confirmedAt: now });
    return { ok: true, uid: claim.uid, already: false };
  });
}

/** Open claims for the owner to match against payment SMS (newest last). */
export async function pendingClaims(db) {
  const q = await db.collection('payClaims').where('status', '==', 'pending').limit(200).get();
  const rows = q.docs.map((d) => ({ claim: d.id, ...d.data() })).sort((a, b) => a.createdAt - b.createdAt);
  for (const r of rows) { try { const u = await db.collection('users').doc(r.uid).get(); if (u.exists) r.name = u.data().displayName; } catch { /* name is a nicety */ } }
  return rows;
}

/** The owner says no (the payment never arrived). The player may claim again. */
export async function rejectClaim(db, claimId, now = Date.now()) {
  const id = String(claimId || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!id) fail(400, 'claim is required');
  return db.runTransaction(async (tx) => {
    const c = await tx.get(claimRef(db, id));
    if (!c.exists) fail(404, 'Unknown claim');
    const claim = c.data();
    if (claim.status !== 'pending') fail(409, `That claim is already ${claim.status}`);
    const s = await tx.get(passRef(db, claim.uid));
    const p = s.exists ? s.data() : {};
    tx.set(claimRef(db, id), { ...claim, status: 'rejected', rejectedAt: now });
    if (p.pending?.id === id) { const { pending, ...rest } = p; tx.set(passRef(db, claim.uid), rest); }
    return { ok: true, uid: claim.uid, rejected: true };
  });
}

// ── Automatic approval from the payment SMS (see /api/pay/sms).
//   smsInbox/{hash} = { phones: [...], amount, at, used }   one document per distinct SMS text, so an SMS pays at most once
const PHONE_RE = /(?:\+?251|0)?[79]\d{8}/g;
export function parseSms(text) {
  const raw = String(text || '').slice(0, 1000);
  const phones = [...new Set((raw.match(PHONE_RE) || []).map(cleanPhone).filter(Boolean))];
  const m = raw.match(/(?:ETB|Birr|ብር)\s*([\d,]+(?:\.\d+)?)/i) || raw.match(/([\d,]+(?:\.\d+)?)\s*(?:ETB|Birr|ብር)/i);
  return { raw, phones, amount: m ? Number(m[1].replace(/,/g, '')) : null };
}
const smsRef = (db, raw) => db.collection('smsInbox').doc(createHash('sha256').update(raw.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 40));

/** Use up a waiting SMS that names this phone (looked up by number, then filtered here: no composite index needed). */
async function takeSms(db, phone, now) {
  return db.runTransaction(async (tx) => {   // read and spend in one transaction: two parallel requests cannot both take the same SMS
    const q = await tx.get(db.collection('smsInbox').where('phones', 'array-contains', phone).limit(20));
    const hit = q.docs.find((d) => !d.data().used && now - d.data().at < 36 * 3600_000);
    if (!hit) return false;
    tx.set(hit.ref, { ...hit.data(), used: true, usedAt: now });
    return true;
  });
}

export async function approveFromSms(db, text, now = Date.now()) {
  const { raw, phones, amount } = parseSms(text);
  if (!raw.trim()) fail(400, 'text is required');
  const min = Number(process.env.PASS_MIN_AMOUNT) || 0;
  if (min && !(amount >= min)) return { matched: false, reason: 'amount' };
  const ref = smsRef(db, raw);
  if ((await ref.get()).exists) return { matched: false, reason: 'duplicate' };
  await ref.set({ phones, amount, at: now, used: false });   // kept even when nothing matches yet: the player may claim a moment later
  const open = (await pendingClaims(db)).filter((c) => c.day === passDay(now) && c.phone && phones.includes(c.phone));
  if (open.length !== 1) return { matched: false, reason: open.length ? 'ambiguous' : 'no-claim' };   // two claims with one number: the owner decides
  try { await confirmClaim(db, open[0].claim, now); } catch { return { matched: false, reason: 'not-confirmable' }; }
  await ref.set({ phones, amount, at: now, used: true, usedAt: now, claim: open[0].claim });
  return { matched: true, claim: open[0].claim, uid: open[0].uid };
}
