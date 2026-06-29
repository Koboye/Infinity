// src/app/api/videos/route.ts
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { requireUser, AuthError } from '@/lib/firebase/server-auth';
import { moderatePostServer } from '@/lib/ai/moderation';
import { rateLimit } from '@/lib/utils/rateLimit';

interface PublishBody {
  description: string;
  hashtags: string[];
  mediaUrl: string;
  mediaType: 'video' | 'image';
  song?: string;
}

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);

    const { ok, retryAfterMs } = await rateLimit(`publish:${uid}`, 10, 10 * 60_000);
    if (!ok) {
      return NextResponse.json(
        { error: `Too many posts. Try again in ${Math.ceil(retryAfterMs / 60_000)} min.` },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null) as PublishBody | null;
    if (!body?.description?.trim() || !body.mediaUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (body.description.length > 500) {
      return NextResponse.json({ error: 'Description too long' }, { status: 400 });
    }
    if (!body.mediaUrl.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`)) {
      return NextResponse.json({ error: 'Invalid media URL' }, { status: 400 });
    }

    // Look up the user's profile server-side — never trust identity fields
    // (username, verified, avatar) sent in the request body.
    const userSnap = await adminDb().collection('users').doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const profile = userSnap.data()!;

    const verdict = await moderatePostServer({ text: body.description });

    const ref = await adminDb().collection('videos').add({
      userId: uid,
      username:       profile.username,
      userAvatar:     profile.avatar,
      userAvatarColor: profile.avatarColor,
      userAvatarUrl:  profile.avatarUrl ?? null,
      userVerified:   profile.verified ?? false,
      description: body.description.trim(),
      hashtags: (body.hashtags ?? []).slice(0, 10),
      media: { kind: body.mediaType, url: body.mediaUrl },
      song: body.song ?? 'Original sound',
      visibility: 'public',
      moderationStatus: verdict.safe ? 'approved' : 'flagged',
      moderationFlags: verdict.flags,
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
      trendingScore: 1,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ 
      id: ref.id, 
      moderationStatus: verdict.safe ? 'approved' : 'flagged', 
      flags: verdict.flags 
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('publish video error', err);
    return NextResponse.json({ error: 'Failed to publish' }, { status: 500 });
  }
}
