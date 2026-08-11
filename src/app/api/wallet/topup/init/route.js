// src/app/api/wallet/topup/init/route.js
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { db } from '@/lib/firebaseAdmin';
import { requireUser } from '@/lib/donations';
import { TOPUP_PACKAGES } from '@/lib/coinTopups';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const FLW_PUBLIC_KEY = process.env.FLW_PUBLIC_KEY; // safe to send to the client

export async function POST(req) {
  try {
    const uid = await requireUser(req);
    const ip = clientIp(req);
    const rl = await rateLimit(`wallet-topup-init:${uid}:${ip}`, 20, 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { package: packageId } = await req.json();
    const pkg = TOPUP_PACKAGES[packageId];
    if (!pkg) return NextResponse.json({ error: 'Invalid package' }, { status: 400 });

    // tx_ref is generated server-side — this is the value that ties the
    // eventual Flutterwave verify/webhook call back to a specific pending
    // record we control, so the client can't alter the coin amount or price
    // between init and settlement (same reasoning as /api/donations/init).
    const tx_ref = `infinity_topup_${crypto.randomUUID()}`;

    await db.collection('coinTopups').doc(tx_ref).set({
      tx_ref,
      uid,
      package: packageId,
      coins: pkg.coins,
      usd: pkg.usd,
      currency: 'USD',
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ tx_ref, public_key: FLW_PUBLIC_KEY, amount: pkg.usd, currency: 'USD' });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Could not start purchase' }, { status: 400 });
  }
}
