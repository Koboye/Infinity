// src/app/api/donations/init/route.js
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { db } from '@/lib/firebaseAdmin';
import { requireUser } from '@/lib/donations';

const FLW_PUBLIC_KEY = process.env.FLW_PUBLIC_KEY; // safe to send to the client

export async function POST(req) {
  try {
    const donorId = await requireUser(req);
    const { amount, currency, recipientId } = await req.json();

    if (!amount || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    if (!recipientId) return NextResponse.json({ error: 'Missing recipient' }, { status: 400 });
    if (recipientId === donorId) return NextResponse.json({ error: "Can't donate to yourself" }, { status: 400 });

    const recipientDoc = await db.collection('users').doc(recipientId).get();
    if (!recipientDoc.exists) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });

    // tx_ref is generated server-side — this is the value that ties the
    // eventual Flutterwave verify/webhook call back to a specific pending
    // record we control, so nothing about the amount or recipient can be
    // tampered with between init and verify.
    const tx_ref = `infinity_don_${crypto.randomUUID()}`;

    await db.collection('donations').doc(tx_ref).set({
      tx_ref, donorId, recipientId, amount, currency: currency || 'NGN',
      status: 'pending', createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ tx_ref, public_key: FLW_PUBLIC_KEY });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Could not start donation' }, { status: 400 });
  }
}
