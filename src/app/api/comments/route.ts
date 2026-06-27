import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, requireUser, AuthError } from '@/lib/firebase/admin';
import { moderatePostServer } from '@/lib/ai/moderation';
import { rateLimit } from '@/lib/utils/rateLimit';

interface CommentBody {
  videoId: string;
  username: string;
  avatar: string;
  avatarColor: string;
  avatarUrl: string | null;
  text: string;
}

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);

    const { ok } = await rateLimit(`comment:${uid}`, 20, 60_000);
    if (!ok) return NextResponse.json({ error: 'Slow down — try again shortly.' }, { status: 429 });

    const body = await request.json().catch(() => null) as CommentBody | null;
    const text = body?.text?.trim();
    if (!body?.videoId || !text) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    if (text.length > 300) return NextResponse.json({ error: 'Comment too long' }, { status: 400 });

    const verdict = await moderatePostServer({ text });
    if (!verdict.safe) {
      return NextResponse.json({ error: 'Comment was blocked by moderation', flags: verdict.flags }, { status: 422 });
    }

    const db = adminDb();
    const videoRef = db.collection('videos').doc(body.videoId);
    const commentRef = db.collection('comments').doc();

    await db.runTransaction(async tx => {
      const videoSnap = await tx.get(videoRef);
      if (!videoSnap.exists) throw new Error('NOT_FOUND');
      tx.set(commentRef, {
        videoId: body.videoId,
        userId: uid,
        username: body.username,
        avatar: body.avatar,
        avatarColor: body.avatarColor,
        avatarUrl: body.avatarUrl ?? null,
        text,
        likes: 0,
        pinned: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(videoRef, { comments: FieldValue.increment(1) });
    });

    return NextResponse.json({ id: commentRef.id });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
    console.error('post comment error', err);
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 });
  }
}
