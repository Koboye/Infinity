import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, requireUser, AuthError } from '@/lib/firebase/admin';
import { rateLimit } from '@/lib/utils/rateLimit';

interface LikeCommentBody {
  commentId: string;
}

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);

    const { ok } = await rateLimit(`comment-like:${uid}`, 60, 60_000);
    if (!ok) return NextResponse.json({ error: 'Slow down' }, { status: 429 });

    const body = await request.json().catch(() => null) as LikeCommentBody | null;
    if (!body?.commentId) {
      return NextResponse.json({ error: 'Missing commentId' }, { status: 400 });
    }

    const db = adminDb();
    const likeRef = db.collection('commentLikes').doc(`${body.commentId}_${uid}`);
    const commentRef = db.collection('comments').doc(body.commentId);

    const liked = await db.runTransaction(async tx => {
      const [likeSnap, commentSnap] = await Promise.all([
        tx.get(likeRef),
        tx.get(commentRef),
      ]);
      if (!commentSnap.exists) throw new Error('NOT_FOUND');

      const alreadyLiked = likeSnap.exists;
      if (alreadyLiked) {
        tx.delete(likeRef);
        tx.update(commentRef, { likes: FieldValue.increment(-1) });
      } else {
        tx.set(likeRef, { commentId: body.commentId, userId: uid, createdAt: FieldValue.serverTimestamp() });
        tx.update(commentRef, { likes: FieldValue.increment(1) });
      }
      return !alreadyLiked;
    });

    return NextResponse.json({ liked });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }
    console.error('comment like error', err);
    return NextResponse.json({ error: 'Failed to update like' }, { status: 500 });
  }
}
