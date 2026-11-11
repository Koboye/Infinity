// Public username check for the sign-up form (before the person has an account). It only answers "free or not" and is rate limited per IP.
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { usernameAvailable } from '@/lib/online/accountApi.js';
import { clientIp } from '@/lib/clientIp.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const hits = new Map();
export async function GET(req) {
  try {
    const ip = clientIp(req) || 'x', now = Date.now(), arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
    arr.push(now); hits.set(ip, arr); if (hits.size > 5000) hits.clear();
    if (arr.length > 40) return NextResponse.json({ error: 'Too many checks, wait a moment' }, { status: 429 });
    const u = new URL(req.url).searchParams.get('u') || '';
    const r = await usernameAvailable(adminDb(), u);
    return NextResponse.json({ ok: r.ok, reason: r.reason || null, message: r.message || null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Could not check right now' }, { status: 503 }); }
}
