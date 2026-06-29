import { Timestamp, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';

export function snapshotTo<T>(snap: QueryDocumentSnapshot<DocumentData>): T {
  const data = snap.data();
  const converted: Record<string, unknown> = { id: snap.id };
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) converted[key] = value.toDate().toISOString();
    else converted[key] = value;
  }

  // ── Backward-compatibility: old app stored media as flat `videoUrl` field ──
  // New app expects `media: { kind: 'video'|'image', url: string }`.
  // If the document has no `media` object but has a `videoUrl`, synthesize it.
  if (!converted.media && converted.videoUrl) {
    const url = converted.videoUrl as string;
    const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url) ||
      (converted.mediaType as string | undefined)?.startsWith('image');
    converted.media = { kind: isImage ? 'image' : 'video', url };
  }

  // Old app used `avatar` / `avatarColor` / `avatarUrl` directly on the post;
  // new schema uses `userAvatar` / `userAvatarColor` / `userAvatarUrl`.
  if (!converted.userAvatar && converted.avatar)           converted.userAvatar      = converted.avatar;
  if (!converted.userAvatarColor && converted.avatarColor) converted.userAvatarColor = converted.avatarColor;
  if (!converted.userAvatarUrl   && converted.avatarUrl)   converted.userAvatarUrl   = converted.avatarUrl;
  if (!converted.userVerified    && converted.verified)    converted.userVerified    = converted.verified;

  // Old app stored likes/comments/views as numbers directly — new schema same, no change needed.
  // Ensure trendingScore exists so rankVideos() doesn't break on old docs.
  if (converted.trendingScore === undefined) {
    const likes    = Number(converted.likes    ?? 0);
    const comments = Number(converted.comments ?? 0);
    const views    = Number(converted.views    ?? 0);
    converted.trendingScore = likes + comments * 2 + views * 0.1;
  }

  // Ensure moderationStatus exists — old posts don't have it.
  // We default to 'approved' so old content still appears in the feed.
  if (!converted.moderationStatus) {
    converted.moderationStatus = 'approved';
  }

  return converted as T;
}
