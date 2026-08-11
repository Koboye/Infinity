// src/app/api/donations/webhook/route.js
// Flutterwave calls this directly, server-to-server — no user session involved.
// Verify the signature header before trusting anything in the body. This is
// the authoritative settlement path in case the client-side /verify call
// never fires (user closed the tab right after paying).
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';
import { settleDonation } from '@/lib/donations';

const FLW_WEBHOOK_SECRET_HASH = process.env.FLW_WEBHOOK_SECRET_HASH; // set in Flutterwave dashboard

export async function POST(req) {
  const signature = req.headers.get('verif-hash');
  if (!signature || signature !== FLW_WEBHOOK_SECRET_HASH) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const event = await req.json();
  if (event.event === 'charge.completed' && event.data.status === 'successful') {
    const tx_ref = event.data.tx_ref;
    const donationSnap = await db.collection('donations').doc(tx_ref).get();
    if (donationSnap.exists) {
      await settleDonation(tx_ref, donationSnap.data(), event.data);
    }
  }
  return new NextResponse('ok', { status: 200 });
}
