import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment,
  limit as fbLimit, onSnapshot, orderBy, query, serverTimestamp,
  setDoc, updateDoc, where,
} from 'firebase/firestore';
import { firebaseDb } from './client';
import type { VideoId, UserId, VideoPost, Comment } from '@/types';
import { snapshotTo } from './converters';

export function subscribeToFeed(
  { viewerId, pageSize = 20 }: { viewerId?: string; pageSize?: number },
  onData: (posts: VideoPost[]) => void,
  onError: (e: Error) => void
): () => void {
  return onSnapshot(
    query(
      collection(firebaseDb(), 'videos'),
      where('moderationStatus', '==', 'approved'),
      orderBy('createdAt', 'desc'),
      fbLimit(pageSize),
    ),
    snap => onData(snap.docs.map(d => snapshotTo<VideoPost>(d))),
    onError
  );
}

export async function toggleLike(videoId: VideoId, userId: UserId): Promise<void> {
  const likeRef = doc(firebaseDb(), 'likes', `${videoId}_${userId}`);
  const existing = await getDoc(likeRef);
  const liked = existing.exists();
  if (liked) {
    await deleteDoc(likeRef);
    await updateDoc(doc(firebaseDb(), 'videos', videoId), { likes: increment(-1) });
  } else {
    await setDoc(likeRef, { videoId, userId, createdAt: serverTimestamp() });
    await updateDoc(doc(firebaseDb(), 'videos', videoId), { likes: increment(1) });
  }
}

export async function isLikedBy(videoId: VideoId, userId: UserId): Promise<boolean> {
  const snap = await getDoc(doc(firebaseDb(), 'likes', `${videoId}_${userId}`));
  return snap.exists();
}

export async function toggleSave(videoId: VideoId, userId: UserId, currentlySaved: boolean): Promise<void> {
  const ref = doc(firebaseDb(), 'saves', `${videoId}_${userId}`);
  if (currentlySaved) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, { videoId, userId, createdAt: serverTimestamp() });
  }
}

/** Best-effort view registration; throttled per-viewer on the server so
 * refreshing/looping a feed can't be used to inflate view counts. */
export async function registerView(videoId: VideoId): Promise<void> {
  try {
    await fetch(`/api/videos/${videoId}/view`, { method: 'POST' });
  } catch {
    // Non-critical — never block playback on a view-count failure.
  }
}

export function subscribeToComments(videoId: VideoId, onData: (c: Comment[]) => void): () => void {
  return onSnapshot(
    query(collection(firebaseDb(), 'comments'), where('videoId', '==', videoId), orderBy('createdAt', 'asc')),
    snap => onData(snap.docs.map(d => snapshotTo<Comment>(d))),
    () => {}
  );
}


/** Publishing goes through /api/videos for server-side moderation. */
export async function publishVideo(input: {
  userId: UserId; username: string; avatar: string; avatarColor: string; avatarUrl: string | null;
  verified: boolean; description: string; hashtags: string[];
  mediaUrl: string; mediaType: 'image' | 'video';
  song?: string; moderationStatus: string; moderationFlags?: string[]; trendingScore: number;
}): Promise<VideoId> {
  const ref = await addDoc(collection(firebaseDb(), 'videos'), {
    userId: input.userId, username: input.username, userAvatar: input.avatar,
    userAvatarColor: input.avatarColor, userAvatarUrl: input.avatarUrl, userVerified: input.verified,
    description: input.description, hashtags: input.hashtags,
    media: { kind: input.mediaType, url: input.mediaUrl },
    song: input.song ?? 'Original sound', visibility: 'public',
    moderationStatus: input.moderationStatus, moderationFlags: input.moderationFlags ?? [],
    likes: 0, comments: 0, shares: 0, views: 0, trendingScore: input.trendingScore,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getUserVideos(userId: UserId): Promise<VideoPost[]> {
  const snap = await getDocs(query(
    collection(firebaseDb(), 'videos'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  ));
  return snap.docs.map(d => snapshotTo<VideoPost>(d));
}

/** Alias for backwards compatibility */
export const fetchUserVideos = getUserVideos;
