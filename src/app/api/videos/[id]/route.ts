import { NextResponse } from 'next/server';
import { adminDb, requireUser, AuthError } from '@/lib/firebase/admin';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireUser(request);
    const { id: videoId } = await params;

    const db = adminDb();
    const videoRef = db.collection('videos').doc(videoId);
    const snap = await videoRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (snap.data()!.userId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the video and its comments in a batch
    const batch = db.batch();
    batch.delete(videoRef);

    // Also clean up comments for this video
    const commentsSnap = await db.collection('comments').where('videoId', '==', videoId).get();
    commentsSnap.docs.forEach(d => batch.delete(d.ref));

    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('delete video error', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
