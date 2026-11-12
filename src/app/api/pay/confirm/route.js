// Owner-only: confirm that a player's USSD payment arrived, which opens their daily pass.
// Called by your payment provider's webhook, an SMS-forwarder app, or by hand:
//   curl -X POST https://YOUR-SITE/api/pay/confirm -H "x-pay-secret: $PAY_WEBHOOK_SECRET" -H "content-type: application/json" -d '{"claim":"ABC123DEF456"}'
//   curl https://YOUR-SITE/api/pay/confirm -H "x-pay-secret: $PAY_WEBHOOK_SECRET"      (lists open claims with the payer's phone)
// Disabled unless PAY_WEBHOOK_SECRET (24+ characters) is set. Wrong secrets are locked out like the ads admin.
import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { adminDb } from '@/lib/firebaseAdmin';
import { confirmClaim, pendingClaims } from '@/lib/online/passApi.js';
import { HttpError } from '@/lib/online/httpError.js';
import { clientIp } from '@/lib/clientIp.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const sha = (v) => createHash('sha256').update(String(v)).digest();
const bad = new Map();
function guard(req) {
  const key = process.env.PAY_WEBHOOK_SECRET;
  if (!key || key.length < 24) return NextResponse.json({ error: 'Payments are not enabled. Set PAY_WEBHOOK_SECRET (24+ characters).' }, { status: 503 });
  const ip = clientIp(req), now = Date.now();
  const recent = (bad.get(ip) || []).filter((t) => now - t < 600_000);
  if (recent.length) bad.set(ip, recent); else bad.delete(ip);
  if (recent.length >= 10) return NextResponse.json({ error: 'Too many wrong secrets. Try again in 10 minutes.' }, { status: 429 });
  if (!timingSafeEqual(sha(req.headers.get('x-pay-secret') || ''), sha(key))) { bad.set(ip, [...recent, now]); return NextResponse.json({ error: 'Wrong secret.' }, { status: 401 }); }
  return null;
}
const oops = (e) => (e instanceof HttpError ? NextResponse.json({ error: e.message }, { status: e.status }) : NextResponse.json({ error: 'Server error' }, { status: 500 }));

export async function POST(req) {
  const denied = guard(req); if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await confirmClaim(adminDb(), body.claim));
  } catch (e) { return oops(e); }
}
export async function GET(req) {
  const denied = guard(req); if (denied) return denied;
  try { return NextResponse.json({ claims: await pendingClaims(adminDb()) }); } catch (e) { return oops(e); }
}
