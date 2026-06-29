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
      return { liked: !alreadyLiked, videoOwnerId: videoSnap.data()!.userId as string, videoUrl: (videoSnap.data()!.media as any)?.url ?? '' };
    });

    // Create like notification server-side (Admin SDK bypasses Firestore security rules)
    if (result.liked && result.videoOwnerId !== uid) {
      const userSnap = await db.collection('users').doc(uid).get();
      if (userSnap.exists) {
        const u = userSnap.data()!;
        await db.collection('notifications').add({
          userId: result.videoOwnerId,
          fromUserId: uid,
          fromUsername: u.username ?? '',
          fromAvatar: u.avatar ?? '',
          fromAvatarColor: u.avatarColor ?? '#3D6B4F',
          fromAvatarUrl: u.avatarUrl ?? null,
          type: 'like',
          message: 'liked your post',
          videoId,
          videoUrl: result.videoUrl,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return NextResponse.json({ liked: result.liked });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
    console.error('toggle like error', err);
    return NextResponse.json({ error: 'Failed to update like' }, { status: 500 });
  }
}
