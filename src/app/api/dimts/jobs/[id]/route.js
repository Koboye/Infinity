import { NextResponse } from 'next/server';
import { adminDb, requireAuth } from '@/lib/firebase-admin';
import { callWorker, publicMediaUrl } from '@/lib/dimts/worker';
import { fail } from '@/lib/dimts/http';

async function own(req, id) {
  const { uid } = await requireAuth(req);
  const ref = adminDb.collection('dimtsJobs').doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data().uid !== uid) { const e = new Error('Job not found'); e.status = 404; throw e; }
  return { uid, ref, job: snap.data() };
}

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const { ref, job } = await own(req, id);
    const s = await callWorker(`/jobs/${id}`, { method: 'GET', timeoutMs: 15000 });
    const status = s.error ? 'error' : s.finished ? 'done' : 'running';
    if (status !== job.status && job.status !== 'stopped') await ref.update({ status, finishedAt: status === 'running' ? null : Date.now() });
    return NextResponse.json({ ok: true, ...s, status, playlistUrl: publicMediaUrl(s.playlist), videoUrl: publicMediaUrl(s.output) });
  } catch (e) { return fail(e); }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const { ref } = await own(req, id);
    await callWorker(`/jobs/${id}`, { method: 'DELETE', timeoutMs: 15000 });
    await ref.update({ status: 'stopped', finishedAt: Date.now() });
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
