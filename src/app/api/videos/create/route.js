import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, requireAuth } from '@/lib/firebase-admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { moderateText, HARD_BLOCK_CATEGORIES } from '@/lib/moderation';

// Fields the client is allowed to set. Everything else (userId, username, verified badge,
// counts, moderation status, timestamps...) is either stripped or overwritten from the
// server's own record of who's calling, so a tampered client can't forge a verified badge,
// pre-seed like/view counts, or mark its own post pre-approved.
const ALLOWED_FIELDS = [
  'description', 'videoUrl', 'images', 'mediaType', 'song', 'hashtags', 'category',
  'filter', 'playbackRate', 'poll', 'feeling', 'location', 'taggedUsers', 'event', 'bgColor',
];

const MAX_TEXT_LEN = 2200;

export async function POST(req) {
  try {
    const decoded = await requireAuth(req);
    const ip = clientIp(req);
    const rl = await rateLimit(`videos-create:${decoded.uid}:${ip}`, 10, 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many posts. Slow down and try again shortly.' }, { status: 429 });
    }

    const body = await req.json();

    const description = typeof body.description === 'string' ? body.description.slice(0, MAX_TEXT_LEN) : '';
    const hasContent = description.trim() || body.videoUrl || (Array.isArray(body.images) && body.images.length)
      || body.poll || body.event || (Array.isArray(body.taggedUsers) && body.taggedUsers.length) || (body.location && body.location.trim());
    if (!hasContent) {
      return NextResponse.json({ error: 'Post has no content' }, { status: 400 });
    }

    const payload = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) payload[key] = body[key];
    }
    payload.description = description;

    // Trusted user fields come from Firestore, never from the request body — the client
    // could otherwise send verified:true or a spoofed name/avatar for a post that isn't theirs.
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }
    const userData = userSnap.data();

    const moderation = await moderateText(description);
    const hardBlocked = moderation.flagged && moderation.categories.some(c => HARD_BLOCK_CATEGORIES.includes(c));
    if (hardBlocked) {
      return NextResponse.json({ error: 'This post violates our content guidelines and cannot be published.' }, { status: 422 });
    }
    // Flagged-but-not-hard-blocked content is published but queued for human review rather
    // than silently live forever or silently dropped; hard-blocked content never reaches Firestore.
    const moderationStatus = moderation.flagged ? 'pending' : 'approved';

    const now = Date.now();
    const doc = {
      ...payload,
      userId: decoded.uid,
      username: userData.username || '',
      fullName: userData.fullName || userData.username || '',
      avatarColor: userData.avatarColor || '#FF2156',
      avatarUrl: userData.avatarUrl || null,
      verified: userData.verified === true,
      likes: 0, comments: 0, shares: 0, saves: 0, views: 0, reposts: 0,
      likedBy: [], savedBy: [], viewedBy: [], repostedBy: [],
      repostsMeta: {}, pinned: false,
      hashtags: (description.match(/#\w+/g) || []),
      moderationStatus,
      moderationCategories: moderation.categories,
      // Use a real Firestore Timestamp (not Date.now()) so it matches the shape every
      // other collection (comments, stories, messages) uses, and so client code calling
      // .toDate()/.seconds on video.createdAt works instead of silently returning undefined.
      createdAt: FieldValue.serverTimestamp(),
    };

    const ref = await adminDb.collection('videos').add(doc);

    if (moderationStatus === 'pending') {
      await adminDb.collection('reports').add({
        type: 'auto-flagged', videoId: ref.id, userId: decoded.uid,
        reason: `Auto-flagged: ${moderation.categories.join(', ') || 'moderation review'}`,
        createdAt: now,
      });
    }

    return NextResponse.json({ ok: true, id: ref.id, moderationStatus });
  } catch (e) {
    console.error('videos/create error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: e.status || 500 });
  }
}
