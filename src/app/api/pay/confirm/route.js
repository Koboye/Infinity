// Owner-only: approve or reject a player's payment claim, or list the open ones.
//   POST {"claim":"ABC123DEF456"}                 approve  (opens that player's daily pass)
//   POST {"claim":"ABC123DEF456","reject":true}   reject
//   GET                                            open claims (code, player name, payer phone, age)
// Header: x-pay-secret: $PAY_WEBHOOK_SECRET. The owner screen at /admin/pay uses this endpoint.
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { confirmClaim, rejectClaim, pendingClaims } from '@/lib/online/passApi.js';
import { guard, oops } from '@/lib/payGuard.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req) {
  const denied = guard(req); if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(body.reject ? await rejectClaim(adminDb(), body.claim) : await confirmClaim(adminDb(), body.claim));
  } catch (e) { return oops(e); }
}
export async function GET(req) {
  const denied = guard(req); if (denied) return denied;
  try { return NextResponse.json({ claims: await pendingClaims(adminDb()) }); } catch (e) { return oops(e); }
}
