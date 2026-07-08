import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, requireAuth } from '@/lib/firebase-admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const MIN_WITHDRAW_COINS = 5000;

export async function GET(req) {
  try {
    const decoded = await requireAuth(req);
    const snap = await adminDb.collection('users').doc(decoded.uid).get();
    const data = snap.data() || {};
    return NextResponse.json({ coins: data.coins || 0, walletBalance: data.walletBalance || 0 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function POST(req) {
  try {
    const decoded = await requireAuth(req);
    const ip = clientIp(req);
    const rl = await rateLimit(`wallet:${decoded.uid}:${ip}`, 30, 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();
    const { type } = body;

    if (type === 'topup') {
      // Real money now flows through /api/wallet/topup/init + /verify (client)
      // and /api/wallet/topup/webhook (Flutterwave, authoritative), which
      // verify the payment against Flutterwave's server API before crediting
      // anything — see src/lib/coinTopups.js. This route no longer credits
      // coins directly: doing so from a plain authenticated POST had no
      // payment/receipt verification at all, so anyone with a valid login
      // could mint themselves coins for free.
      return NextResponse.json(
        { error: 'Use /api/wallet/topup/init to start a coin purchase.' },
        { status: 410 }
      );
    }

    if (type === 'gift') {
      const { toUserId, amount, streamId } = body;
      const coins = Number(amount);
      if (!toUserId || !Number.isInteger(coins) || coins <= 0) {
        return NextResponse.json({ error: 'Invalid gift request' }, { status: 400 });
      }
      if (toUserId === decoded.uid) {
        return NextResponse.json({ error: 'Cannot gift yourself' }, { status: 400 });
      }

      const fromRef = adminDb.collection('users').doc(decoded.uid);
      const toRef = adminDb.collection('users').doc(toUserId);

      const result = await adminDb.runTransaction(async (tx) => {
        const fromSnap = await tx.get(fromRef);
        const toSnap = await tx.get(toRef);
        if (!toSnap.exists) throw Object.assign(new Error('Recipient not found'), { status: 404 });
        const balance = fromSnap.data()?.coins || 0;
        if (balance < coins) throw Object.assign(new Error('Insufficient coins'), { status: 400 });

        tx.update(fromRef, { coins: FieldValue.increment(-coins) });
        // Streamers accumulate a separate payoutable balance so a gift isn't
        // immediately spendable as "coins" (mirrors typical live-gifting economics).
        tx.update(toRef, { walletBalance: FieldValue.increment(coins) });
        return { fromBalance: balance - coins };
      });

      await adminDb.collection('users').doc(decoded.uid).collection('ledger').add({
        type: 'gift_sent', coins, toUserId, streamId: streamId || null, createdAt: Date.now(),
      });
      await adminDb.collection('users').doc(toUserId).collection('ledger').add({
        type: 'gift_received', coins, fromUserId: decoded.uid, streamId: streamId || null, createdAt: Date.now(),
      });

      return NextResponse.json({ ok: true, coins: result.fromBalance });
    }

    if (type === 'convert') {
      // Cosmetic "coins -> ETH" conversion (no real crypto payout wired up — matches
      // the pre-existing client behavior, just made atomic/server-authoritative so the
      // balance can't go negative or be replayed).
      const n = Number(body.amount);
      if (!Number.isInteger(n) || n <= 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
      }
      const userRef = adminDb.collection('users').doc(decoded.uid);
      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const balance = snap.data()?.coins || 0;
        if (balance < n) throw Object.assign(new Error('Insufficient coins'), { status: 400 });
        tx.update(userRef, { coins: FieldValue.increment(-n) });
        return { coins: balance - n };
      });
      const eth = (n / 10000).toFixed(4);
      await adminDb.collection('users').doc(decoded.uid).collection('ledger').add({
        type: 'convert', coins: n, eth, createdAt: Date.now(),
      });
      return NextResponse.json({ ok: true, coins: result.coins, eth });
    }

    if (type === 'withdraw') {
      const userRef = adminDb.collection('users').doc(decoded.uid);
      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const balance = snap.data()?.walletBalance || 0;
        if (balance < MIN_WITHDRAW_COINS) {
          throw Object.assign(new Error(`Minimum withdrawal is ${MIN_WITHDRAW_COINS} coins`), { status: 400 });
        }
        tx.update(userRef, { walletBalance: 0 });
        return { withdrawn: balance };
      });

      // Creates a pending request for manual/automated payout processing — actually
      // paying out (Stripe Connect, PayPal payouts, etc.) is a separate integration.
      await adminDb.collection('payoutRequests').add({
        userId: decoded.uid,
        coins: result.withdrawn,
        status: 'pending',
        createdAt: Date.now(),
      });

      return NextResponse.json({ ok: true, walletBalance: 0, pendingPayout: result.withdrawn });
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (e) {
    console.error('wallet error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: e.status || 500 });
  }
}
