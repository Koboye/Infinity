// src/lib/donations.js
// Money-related logic never trusts the client. This module owns the pieces
// shared by all three /api/donations/* routes:
//   - requireUser        verifies the Firebase ID token the frontend attaches
//   - verifyWithFlutterwave  re-checks a transaction directly against
//                         Flutterwave's server API (never the browser SDK's
//                         callback payload)
//   - settleDonation      idempotent credit of the recipient's wallet, safe
//                         to call from both the client-verify route AND the
//                         webhook without double-crediting
import { FieldValue } from 'firebase-admin/firestore';
import { db, auth } from './firebaseAdmin';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY; // server-only, never exposed to the client

export async function requireUser(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) throw new Error('Not authenticated');
  const decoded = await auth.verifyIdToken(token);
  return decoded.uid;
}

// Re-checks the transaction directly against Flutterwave's server API (not
// the client-supplied payload) before crediting anything, then settles it.
export async function verifyWithFlutterwave(transaction_id, donation) {
  const resp = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
    headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` },
  });
  const body = await resp.json();
  const tx = body?.data;
  const amountMatches = tx?.amount >= donation.amount;
  const currencyMatches = tx?.currency === donation.currency;
  const isSuccessful = tx?.status === 'successful';

  if (isSuccessful && amountMatches && currencyMatches) {
    await settleDonation(donation.tx_ref, donation, tx);
    return true;
  }
  return false;
}

// Idempotent settlement: credits the recipient's wallet and marks the
// donation completed. Uses a Firestore transaction so a webhook and a
// client-verify call racing each other can't double-credit the same donation.
export async function settleDonation(tx_ref, donation, providerData) {
  await db.runTransaction(async (t) => {
    const ref = db.collection('donations').doc(tx_ref);
    const snap = await t.get(ref);
    if (snap.data().status === 'completed') return; // already settled — no-op
    t.update(ref, {
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      providerTransactionId: providerData.id || providerData.transaction_id || null,
    });
    t.update(db.collection('users').doc(donation.recipientId), {
      walletBalance: FieldValue.increment(donation.amount),
    });
  });
}
