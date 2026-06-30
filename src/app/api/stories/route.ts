// src/app/api/stories/route.ts
import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { requireUser, AuthError } from '@/lib/firebase/server-auth';
import { moderatePostServer } from '@/lib/ai/moderation';
import { rateLimit } from '@/lib/utils/rateLimit';

interface PublishBody {
  caption?: string;
  mediaUrl: string;
  mediaType: 'video' | 'image';
}

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);

    const { ok, retryAfterMs } = await rateLimit(`story:${uid}`, 20, 10 * 60_000);
    if (!ok) {
      return NextResponse.json(
        { error: `Too many stories. Try again in ${Math.ceil(retryAfterMs / 60_000)} min.` },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null) as PublishBody | null;
    if (!body?.mediaUrl) {
      return NextResponse.json({ error: 'Missing media' }, { status: 400 });
    }
    if ((body.caption ?? '').length > 200) {
      return NextResponse.json({ error: 'Caption too long' }, { status: 400 });
    }
    if (!body.mediaUrl.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`)) {
      return NextResponse.json({ error: 'Invalid media URL' }, { status: 400 });
    }

    const userSnap = await adminDb().collection('users').doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const profile = userSnap.data()!;

    const verdict = await moderatePostServer({ text: body.caption ?? '' });

    const ref = await adminDb().collection('stories').add({
      userId: uid,
      username: profile.username,
      userAvatar: profile.avatar,
      userAvatarColor: profile.avatarColor,
      userAvatarUrl: profile.avatarUrl ?? null,
      userVerified: profile.verified ?? false,
      media: { kind: body.mediaType, url: body.mediaUrl },
      caption: (body.caption ?? '').trim(),
      moderationStatus: verdict.safe ? 'approved' : 'flagged',
      moderationFlags: verdict.flags,
      views: [],
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + STORY_TTL_MS),
    });

    return NextResponse.json({
      id: ref.id,
      moderationStatus: verdict.safe ? 'approved' : 'flagged',
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('publish story error', err);
    return NextResponse.json({ error: 'Failed to publish story' }, { status: 500 });
  }
}
