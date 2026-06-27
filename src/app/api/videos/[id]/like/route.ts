import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, requireUser, AuthError } from '@/lib/firebase/admin';
import { rateLimit } from '@/lib/utils/rateLimit';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireUser(request);
    const { id: videoId } = await params;

    const { ok } = await rateLimit(`like:${uid}`, 60, 60_000);
    if (!ok) return NextResponse.json({ error: 'Slow down' }, { status: 429 });

    const db = adminDb();
    const likeRef = db.collection('likes').doc(`${videoId}_${uid}`);
    const videoRef = db.collection('videos').doc(videoId);

    const result = await db.runTransaction(async tx => {
      const [likeSnap, videoSnap] = await Promise.all([tx.get(likeRef), tx.get(videoRef)]);
      if (!videoSnap.exists) throw new Error('NOT_FOUND');

      const alreadyLiked = likeSnap.exists;
      if (alreadyLiked) {
        tx.delete(likeRef);
        tx.update(videoRef, { likes: FieldValue.increment(-1) });
      } else {
        tx.set(likeRef, { videoId, userId: uid, createdAt: FieldValue.serverTimestamp() });
        tx.update(videoRef, { likes: FieldValue.increment(1) });
      }
      return { liked: !alreadyLiked };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
    console.error('toggle like error', err);
    return NextResponse.json({ error: 'Failed to update like' }, { status: 500 });
  }
}
