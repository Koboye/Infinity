import { NextResponse } from 'next/server';
import { adminDb, requireAdmin } from '@/lib/firebase-admin';

// Admin-only queue of posts auto-flagged by /api/videos/create's moderation check
// (moderationStatus: 'pending'). Separate from the user-report flow in /reports.
export async function GET(req) {
  try {
    await requireAdmin(req);
    const snap = await adminDb.collection('videos').where('moderationStatus', '==', 'pending').orderBy('createdAt', 'desc').limit(50).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function POST(req) {
  try {
    const decoded = await requireAdmin(req);
    const { videoId, action } = await req.json();
    if (!videoId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'videoId and a valid action are required' }, { status: 400 });
    }

    const ref = adminDb.collection('videos').doc(videoId);
    if (action === 'approve') {
      await ref.update({ moderationStatus: 'approved', moderatedAt: Date.now(), moderatedBy: decoded.uid });
    } else {
      await ref.delete();
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
