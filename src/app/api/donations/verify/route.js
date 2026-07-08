// src/app/api/donations/verify/route.js
// Called by the client right after the inline checkout's callback fires.
// This is a convenience path for instant UI feedback — the webhook is the
// authoritative one in case this never runs (tab closed, network drop).
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';
import { requireUser, verifyWithFlutterwave } from '@/lib/donations';

export async function POST(req) {
  try {
    const donorId = await requireUser(req);
    const { tx_ref, transaction_id } = await req.json();

    const donationRef = db.collection('donations').doc(tx_ref);
    const donationSnap = await donationRef.get();
    if (!donationSnap.exists) return NextResponse.json({ error: 'Unknown transaction' }, { status: 404 });

    const donation = donationSnap.data();
    if (donation.donorId !== donorId) return NextResponse.json({ error: 'Not your transaction' }, { status: 403 });
    if (donation.status === 'completed') return NextResponse.json({ verified: true }); // already settled via webhook

    const result = await verifyWithFlutterwave(transaction_id, donation);
    return NextResponse.json({ verified: result });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Verification failed' }, { status: 400 });
  }
}
