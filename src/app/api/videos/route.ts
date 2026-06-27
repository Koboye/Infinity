import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, requireUser, AuthError } from '@/lib/firebase/admin';
import { moderatePostServer } from '@/lib/ai/moderation';
import { rateLimit } from '@/lib/utils/rateLimit';

interface PublishBody {
  username: string;
  avatar: string;
  avatarColor: string;
  avatarUrl: string | null;
  verified: boolean;
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
    if (!body?.description?.trim() || !body.mediaUrl || !body.username) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (body.description.length > 500) {
      return NextResponse.json({ error: 'Description too long' }, { status: 400 });
    }
    if (!body.mediaUrl.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`)) {
  return NextResponse.json({ error: 'Invalid media URL' }, { status: 400 });
}

    // Moderation runs here, server-side, and its verdict is what actually
    // gets persisted — the client's own moderation preview is informational
    // only and is never trusted for the real decision.
    const verdict = await moderatePostServer({ text: body.description });

    const ref = await adminDb().collection('videos').add({
      userId: uid,
      username: body.username,
      userAvatar: body.avatar,
      userAvatarColor: body.avatarColor,
      userAvatarUrl: body.avatarUrl ?? null,
      userVerified: body.verified,
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

    return NextResponse.json({ id: ref.id, moderationStatus: verdict.safe ? 'approved' : 'flagged', flags: verdict.flags });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('publish video error', err);
    return NextResponse.json({ error: 'Failed to publish' }, { status: 500 });
  }
}
