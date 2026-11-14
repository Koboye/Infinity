// Reminder subscription: GET state, POST { action: 'subscribe' | 'unsubscribe', sub, lang }.
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { pushState, pushSubscribe, pushUnsubscribe } from '@/lib/online/pushApi.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const H = { 'Cache-Control': 'no-store' };
async function uidOf(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '');
  if (!m) return null;
  try { return (await adminAuth().verifyIdToken(m[1])).uid; } catch { return null; }
}
export async function GET(req) {
  const uid = await uidOf(req);
  if (!uid) return NextResponse.json({ error: 'Sign in first.' }, { status: 401, headers: H });
  try { return NextResponse.json(await pushState(adminDb(), uid), { headers: H }); } catch { return NextResponse.json({ error: 'Unavailable' }, { status: 503, headers: H }); }
}
export async function POST(req) {
  const uid = await uidOf(req);
  if (!uid) return NextResponse.json({ error: 'Sign in first.' }, { status: 401, headers: H });
  let b = null; try { b = await req.json(); } catch { /* empty */ }
  try {
    const out = b?.action === 'unsubscribe' ? await pushUnsubscribe(adminDb(), uid) : await pushSubscribe(adminDb(), uid, b?.sub, b?.lang);
    return NextResponse.json(out, { headers: H });
  } catch (e) { return NextResponse.json({ error: e.status === 400 ? e.message : 'Could not save the reminder.' }, { status: e.status === 400 ? 400 : 503, headers: H }); }
}
