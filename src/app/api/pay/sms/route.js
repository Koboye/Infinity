// Automatic approval. Put an SMS-forwarder app on the phone that receives the payments (the number players dial to) and point it here:
//   POST https://YOUR-SITE/api/pay/sms   header x-pay-secret: $PAY_WEBHOOK_SECRET   body {"text":"<the SMS text>"}
// (If the app can only call a URL, use ?key=$PAY_WEBHOOK_SECRET.) The server reads the payer's number and amount from the SMS and
// opens the pass of the player who claimed with that number. Anything it cannot match stays for you to approve at /admin/pay.
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { approveFromSms } from '@/lib/online/passApi.js';
import { guard, oops } from '@/lib/payGuard.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req) {
  const denied = guard(req); if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const text = body.text ?? body.message ?? body.body ?? body.content ?? '';
    return NextResponse.json(await approveFromSms(adminDb(), text));
  } catch (e) { return oops(e); }
}
