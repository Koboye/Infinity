// src/app/api/wallet/topup/verify/route.js
// Called by the client right after the inline checkout's callback fires.
// This is a convenience path for instant UI feedback — the webhook is the
// authoritative one in case this never runs (tab closed, network drop).
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';
import { requireUser } from '@/lib/donations';
import { verifyWithFlutterwave } from '@/lib/coinTopups';

export async function POST(req) {
  try {
    const uid = await requireUser(req);
    const { tx_ref, transaction_id } = await req.json();

    const topupRef = db.collection('coinTopups').doc(tx_ref);
    const topupSnap = await topupRef.get();
    if (!topupSnap.exists) return NextResponse.json({ error: 'Unknown transaction' }, { status: 404 });

    const topup = topupSnap.data();
    if (topup.uid !== uid) return NextResponse.json({ error: 'Not your transaction' }, { status: 403 });

    if (topup.status === 'completed') {
      const userSnap = await db.collection('users').doc(uid).get();
      return NextResponse.json({ verified: true, coins: userSnap.data()?.coins || 0 }); // already settled via webhook
    }

    const result = await verifyWithFlutterwave(transaction_id, topup);
    const userSnap = await db.collection('users').doc(uid).get();
    return NextResponse.json({ verified: result, coins: userSnap.data()?.coins || 0 });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Verification failed' }, { status: 400 });
  }
}
