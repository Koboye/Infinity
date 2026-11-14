// Account-level learning level. GET returns it; POST sets it once (a second POST just returns the saved level).
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { cleanLevel } from '@/lib/learnerLevel.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const H = { 'Cache-Control': 'no-store' };

async function uidOf(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '');
  if (!m) return null;
  try { return (await adminAuth().verifyIdToken(m[1])).uid; } catch { return null; }
}
const shape = (d) => ({ grade: d?.grade || '', dept: d?.dept || '' });

export async function GET(req) {
  const uid = await uidOf(req);
  if (!uid) return NextResponse.json({ error: 'Sign in first.' }, { status: 401, headers: H });
  try {
    const s = await adminDb().collection('learners').doc(uid).get();
    return NextResponse.json(shape(s.exists ? s.data() : null), { headers: H });
  } catch { return NextResponse.json({ error: 'Could not load your level.' }, { status: 503, headers: H }); }
}

export async function POST(req) {
  const uid = await uidOf(req);
  if (!uid) return NextResponse.json({ error: 'Sign in first.' }, { status: 401, headers: H });
  let body = null;
  try { body = await req.json(); } catch { /* empty */ }
  const v = cleanLevel(body);
  if (v.error) return NextResponse.json({ error: v.error }, { status: 400, headers: H });
  try {
    const db = adminDb(), ref = db.collection('learners').doc(uid);
    const out = await db.runTransaction(async (tx) => {
      const s = await tx.get(ref);
      if (s.exists && s.data().grade) return { ...shape(s.data()), locked: true };
      tx.set(ref, { grade: v.grade, dept: v.dept, at: Date.now() });
      return { grade: v.grade, dept: v.dept, locked: false };
    });
    return NextResponse.json(out, { headers: H });
  } catch { return NextResponse.json({ error: 'Could not save your level.' }, { status: 503, headers: H }); }
}
