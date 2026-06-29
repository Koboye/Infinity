import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, requireUser, AuthError } from '@/lib/firebase/admin';
import { rateLimit } from '@/lib/utils/rateLimit';

interface FollowBody {
  targetId: string;
}

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);

    const { ok } = await rateLimit(`follow:${uid}`, 60, 60_000);
    if (!ok) return NextResponse.json({ error: 'Slow down' }, { status: 429 });

    const body = await request.json().catch(() => null) as FollowBody | null;
    const targetId = body?.targetId;
    if (!targetId) return NextResponse.json({ error: 'Missing targetId' }, { status: 400 });
    if (targetId === uid) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });

    const db = adminDb();
    const myRef = db.collection('users').doc(uid);
    const targetRef = db.collection('users').doc(targetId);

    const result = await db.runTransaction(async tx => {
      const [mySnap, targetSnap] = await Promise.all([tx.get(myRef), tx.get(targetRef)]);
      if (!mySnap.exists || !targetSnap.exists) throw new Error('NOT_FOUND');

      const targetData = targetSnap.data()!;
      if ((targetData.blockedUsers ?? []).includes(uid)) throw new Error('BLOCKED');

      const myData = mySnap.data()!;
      const alreadyFollowing: string[] = myData.following ?? [];
      const isFollowing = alreadyFollowing.includes(targetId);

      if (isFollowing) {
        tx.update(myRef, { following: FieldValue.arrayRemove(targetId) });
        tx.update(targetRef, { followers: FieldValue.arrayRemove(uid) });
      } else {
        tx.update(myRef, { following: FieldValue.arrayUnion(targetId) });
        tx.update(targetRef, { followers: FieldValue.arrayUnion(uid) });
      }
      return { following: !isFollowing, myProfile: myData };
    });

    if (result.following) {
      await db.collection('notifications').add({
        userId: targetId,
        fromUserId: uid,
        fromUsername: result.myProfile.username,
        fromAvatar: result.myProfile.avatar,
        fromAvatarColor: result.myProfile.avatarColor,
        fromAvatarUrl: result.myProfile.avatarUrl ?? null,
        type: 'follow',
        message: 'started following you',
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ following: result.following });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (err instanceof Error && err.message === 'BLOCKED') {
      return NextResponse.json({ error: 'Unable to follow this user' }, { status: 403 });
    }
    console.error('toggle follow error', err);
    return NextResponse.json({ error: 'Failed to update follow' }, { status: 500 });
  }
}
