// Shared by every owner-only payment endpoint: PAY_WEBHOOK_SECRET check with a 10-wrong-secrets-per-10-minutes lockout.
import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { HttpError } from '@/lib/online/httpError.js';
import { clientIp } from '@/lib/clientIp.js';

const sha = (v) => createHash('sha256').update(String(v)).digest();
const bad = new Map();
/** The secret comes in the x-pay-secret header, or (for SMS-forwarder apps that can only call a URL) the ?key= parameter. */
export function guard(req) {
  const key = process.env.PAY_WEBHOOK_SECRET;
  if (!key || key.length < 24) return NextResponse.json({ error: 'Payments are not enabled. Set PAY_WEBHOOK_SECRET (24+ characters).' }, { status: 503 });
  const ip = clientIp(req), now = Date.now();
  const recent = (bad.get(ip) || []).filter((t) => now - t < 600_000);
  if (recent.length) bad.set(ip, recent); else bad.delete(ip);
  if (recent.length >= 10) return NextResponse.json({ error: 'Too many wrong secrets. Try again in 10 minutes.' }, { status: 429 });
  let given = req.headers.get('x-pay-secret') || '';
  if (!given) { try { given = new URL(req.url).searchParams.get('key') || ''; } catch { /* no url */ } }
  if (!timingSafeEqual(sha(given), sha(key))) { bad.set(ip, [...recent, now]); return NextResponse.json({ error: 'Wrong secret.' }, { status: 401 }); }
  return null;
}
export const oops = (e) => (e instanceof HttpError ? NextResponse.json({ error: e.message }, { status: e.status }) : NextResponse.json({ error: 'Server error' }, { status: 500 }));
