// Hill Climb and the daily pass. The game page has no sign-in, so the home screen opens it with a signed ticket cookie.
//   POST {"action":"enter"}  + Authorization: Bearer <token>   needs an open pass (does not spend a level); sets the ticket cookie
//   POST {"action":"start"}  (ticket cookie)                   spends one level start; 402 when the pass is locked or used up
//   GET                                                        { paywall } so the page knows whether levels cost anything
// Paywall off (default): everything answers free and nothing is required.
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { HttpError, fail } from '@/lib/online/httpError.js';
import * as Pass from '@/lib/online/passApi.js';
import { msToExpiry } from '@/lib/passCore.js';
import { TICKET_COOKIE, signTicket, verifyTicket, ticketSecret } from '@/lib/hcTicket.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() { return NextResponse.json({ paywall: Pass.paywallOn() }); }

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!Pass.paywallOn()) return NextResponse.json({ ok: true, free: true, paywall: false });
    const secret = ticketSecret();
    if (!secret) fail(503, 'Payments are not set up yet. Try again later.');
    if (body.action === 'enter') {
      const header = req.headers.get('authorization') || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) fail(401, 'Sign in to play');
      let uid;
      try { uid = (await adminAuth().verifyIdToken(token, true)).uid; } catch { fail(401, 'Session expired, sign in again'); }
      const { pass } = await Pass.passInfo(adminDb(), uid);
      if (pass.left <= 0) fail(402, pass.active ? 'You used all 10 levels today. Pay again to unlock 10 more.' : 'Pay to unlock today\'s 10 levels');
      const res = NextResponse.json({ ok: true, pass });
      res.cookies?.set(TICKET_COOKIE, await signTicket(uid, secret), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: Math.max(60, Math.floor(msToExpiry() / 1000)) });
      return res;
    }
    if (body.action === 'start') {
      const uid = await verifyTicket(req.cookies?.get(TICKET_COOKIE)?.value, secret);
      if (!uid) fail(401, 'Open Hill Climb from the home screen');
      return NextResponse.json(await Pass.passStart(adminDb(), uid));
    }
    fail(400, 'Unknown action');
  } catch (e) {
    return e instanceof HttpError ? NextResponse.json({ error: e.message }, { status: e.status }) : NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
