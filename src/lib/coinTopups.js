// src/lib/coinTopups.js
// Real-money coin purchases. Mirrors src/lib/donations.js on purpose: same
// provider (Flutterwave), same trust model — the client is NEVER trusted for
// the amount, the package, or "did the payment succeed". It only tells us
// which package it wants; everything else is re-derived or re-verified here.
//
//   - TOPUP_PACKAGES     single source of truth for coins-per-dollar. The
//                        client sends a package id ('small'|'medium'|...),
//                        never a coin count or a price.
//   - verifyWithFlutterwave  re-checks a transaction directly against
//                        Flutterwave's server API (never trusts the
//                        browser-side checkout callback payload).
//   - settleCoinTopup    idempotent credit of the buyer's coin balance, safe
//                        to call from both the client-verify route AND the
//                        webhook without double-crediting.
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin';

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY; // server-only, never exposed to the client

export const TOPUP_PACKAGES = {
  small: { coins: 100, usd: 0.99 },
  medium: { coins: 550, usd: 4.99 },
  large: { coins: 1200, usd: 9.99 },
  mega: { coins: 6500, usd: 49.99 },
};

// Re-checks the transaction directly against Flutterwave's server API (not
// the client-supplied payload) before crediting anything, then settles it.
export async function verifyWithFlutterwave(transaction_id, topup) {
  const resp = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
    headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` },
  });
  const body = await resp.json();
  const tx = body?.data;
  const amountMatches = tx?.amount >= topup.usd;
  const currencyMatches = tx?.currency === topup.currency;
  const isSuccessful = tx?.status === 'successful';

  if (isSuccessful && amountMatches && currencyMatches) {
    await settleCoinTopup(topup.tx_ref, topup, tx);
    return true;
  }
  return false;
}

// Idempotent settlement: credits the buyer's coins and marks the topup
// completed. Uses a Firestore transaction so a webhook and a client-verify
// call racing each other can't double-credit the same purchase.
export async function settleCoinTopup(tx_ref, topup, providerData) {
  const ledgerRef = db.collection('users').doc(topup.uid).collection('ledger').doc();
  const txnRef = db.collection('transactions').doc();

  await db.runTransaction(async (t) => {
    const ref = db.collection('coinTopups').doc(tx_ref);
    const snap = await t.get(ref);
    if (!snap.exists || snap.data().status === 'completed') return; // already settled — no-op

    t.update(ref, {
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      providerTransactionId: providerData.id || providerData.transaction_id || null,
    });
    t.update(db.collection('users').doc(topup.uid), {
      coins: FieldValue.increment(topup.coins),
    });
    t.set(ledgerRef, {
      type: 'topup',
      coins: topup.coins,
      usd: topup.usd,
      package: topup.package,
      tx_ref,
      createdAt: Date.now(),
    });
    t.set(txnRef, {
      userId: topup.uid,
      type: 'credit',
      label: `Purchased ${topup.coins.toLocaleString()} coins`,
      amount: topup.usd,
      coins: topup.coins,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}
