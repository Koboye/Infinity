import { NextResponse } from 'next/server';
import { adminDb, requireAuth } from '@/lib/firebase-admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { validateLink } from '@/lib/dimts/safety';
import { loadFixes } from '@/lib/dimts/memory';
import { callWorker } from '@/lib/dimts/worker';
import { fail } from '@/lib/dimts/http';

// Start a dub. The person pastes a link, or uploads a video to Cloudinary first (same flow as
// posts, see /api/cloudinary-sign) and sends that URL here.
// mode: 'auto' (default: the worker picks) | 'best' (dub all, then fix lines) | 'watch' (plays while it dubs)
export async function POST(req) {
  try {
    const { uid } = await requireAuth(req);
    const rl = await rateLimit(`dimts-job:${uid}:${clientIp(req)}`, 10, 60 * 60);
    if (!rl.allowed) return NextResponse.json({ error: 'Too many dubs this hour. Try again later.' }, { status: 429 });

    const { url, mode = 'auto', clone = true, bgVolume = 0.15, rights } = await req.json();
    if (rights !== true) return NextResponse.json({ error: 'Please confirm you have the right to dub this video.' }, { status: 400 });
    if (!['auto', 'best', 'watch'].includes(mode)) return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
    const link = await validateLink(url);

    // one running job per person (port of users.JobLimiter)
    const running = await adminDb.collection('dimtsJobs').where('uid', '==', uid).where('status', '==', 'running').limit(5).get();
    // a job left 'running' by a worker restart must never lock the person out: ignore anything older than 2 hours
    if (running.docs.some((d) => Date.now() - d.data().createdAt < 2 * 3600 * 1000)) return NextResponse.json({ error: 'You already have a dub running. Stop it first.' }, { status: 409 });

    const fixes = await loadFixes(uid);
    const w = await callWorker('/jobs', { json: { url: link, mode, clone: !!clone, bgVolume: Math.min(0.6, Math.max(0, +bgVolume || 0.15)), fixes } });
    await adminDb.collection('dimtsJobs').doc(w.jobId).set({ uid, mode, source: link, status: 'running', createdAt: Date.now() });
    return NextResponse.json({ ok: true, jobId: w.jobId });
  } catch (e) { return fail(e); }
}

export async function GET(req) {
  try {
    const { uid } = await requireAuth(req);
    const snap = await adminDb.collection('dimtsJobs').where('uid', '==', uid).orderBy('createdAt', 'desc').limit(20).get();
    return NextResponse.json({ ok: true, items: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (e) { return fail(e); }
}
