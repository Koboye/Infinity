import { NextResponse } from 'next/server';
import { adminDb, requireAuth } from '@/lib/firebase-admin';
import { teachLines } from '@/lib/dimts/memory';
import { callWorker, publicMediaUrl } from '@/lib/dimts/worker';
import { fail } from '@/lib/dimts/http';

// "Apply my fixes": only the lines the person changed are re-spoken. Changed lines are
// also remembered (Firestore) so the same sentence is never wrong again.
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { uid } = await requireAuth(req);
    const snap = await adminDb.collection('dimtsJobs').doc(id).get();
    if (!snap.exists || snap.data().uid !== uid) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const { rows, remember = true } = await req.json();
    if (!Array.isArray(rows) || rows.length > 2000) return NextResponse.json({ error: 'rows required' }, { status: 400 });
    const r = await callWorker(`/jobs/${id}/redub`, { json: { rows } });   // r.changed = [[original, newAmharic], ...]
    if (remember && r.changed?.length) await teachLines(uid, r.changed);
    return NextResponse.json({ ok: true, rows: r.rows, fixed: r.changed?.length || 0, videoUrl: publicMediaUrl(r.output) });
  } catch (e) { return fail(e); }
}
