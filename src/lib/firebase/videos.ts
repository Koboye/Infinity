// src/lib/firebase/videos.ts
import {
  collection, doc, getDoc, getDocs,
  limit as fbLimit, onSnapshot, orderBy, query,
  where,
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

// toggleLike removed: all like writes go through /api/videos/[id]/like
// (server-side rate limiting, atomic transaction, notification creation).

export async function isLikedBy(videoId: VideoId, userId: UserId): Promise<boolean> {
  const snap = await getDoc(doc(firebaseDb(), 'likes', `${videoId}_${userId}`));
  return snap.exists();
}

/**
 * Toggle save for a video - uses server API instead of direct Firestore write
 * This fixes the "missing permissions (actions=['create'])" error
 */
export async function toggleSave(videoId: VideoId, userId: UserId, currentlySaved: boolean): Promise<void> {
  // Use the API instead of direct Firestore write
  const response = await fetch('/api/saves', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      videoId,
      currentlySaved,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to toggle save' }));
    throw new Error(error.error || 'Failed to toggle save');
  }
}

/**
 * Toggle like for a video - uses server API
 */
export async function toggleLike(videoId: VideoId, currentlyLiked: boolean): Promise<void> {
  const response = await fetch(`/api/videos/${videoId}/like`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      currentlyLiked,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to toggle like' }));
    throw new Error(error.error || 'Failed to toggle like');
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
    err => console.error('subscribeToComments error', err)
  );
}

// publishVideo removed: all video publishing goes through /api/videos
// (server-side moderation, rate limiting, authoritative user fields).

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
