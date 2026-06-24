/**
 * Video / Post service layer.
 * Replaces the inline addDoc / updateDoc / onSnapshot calls scattered through
 * the original component. Each function is a single, testable unit.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase/client';
import { snapshotTo } from '@/lib/firebase/converters';
import type { Comment, UserId, VideoId, VideoPost } from '@/types';

const COLL_VIDEOS = 'videos';
const COLL_LIKES = 'likes';
const COLL_COMMENTS = 'comments';
const COLL_SAVES = 'saves';

/* ─────────────── Feed ─────────────── */

export interface FeedOptions {
  viewerId?: UserId;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}

export function subscribeToFeed(
  options: FeedOptions,
  onChange: (posts: VideoPost[], nextCursor: QueryDocumentSnapshot<DocumentData> | null) => void,
  onError?: (e: Error) => void,
): () => void {
  const pageSize = options.pageSize ?? 20;
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc'), fbLimit(pageSize)];
  if (options.cursor) constraints.push(startAfter(options.cursor));

  return onSnapshot(
    query(collection(firebaseDb(), COLL_VIDEOS), ...constraints),
    snap => {
      const posts = snap.docs.map(d => snapshotTo<VideoPost>(d));
      const next = snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1]! : null;
      onChange(posts, next);
    },
    err => onError?.(err),
  );
}

export async function fetchVideo(id: VideoId): Promise<VideoPost | null> {
  const snap = await getDoc(doc(firebaseDb(), COLL_VIDEOS, id));
  return snap.exists() ? snapshotTo<VideoPost>(snap) : null;
}

/* ─────────────── Publish / Moderate ─────────────── */

export interface PublishInput {
  userId: UserId;
  username: string;
  avatar: string;
  avatarColor: string;
  avatarUrl: string | null;
  verified: boolean;
  description: string;
  hashtags: string[];
  mediaUrl: string;
  mediaType: 'video' | 'image';
  images?: string[];
  song?: string;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  moderationFlags?: string[];
  trendingScore: number;
}

export async function publishVideo(input: PublishInput): Promise<VideoId> {
  const ref = await addDoc(collection(firebaseDb(), COLL_VIDEOS), {
    userId: input.userId,
    username: input.username,
    userAvatar: input.avatar,
    userAvatarColor: input.avatarColor,
    userAvatarUrl: input.avatarUrl,
    userVerified: input.verified,
    description: input.description,
    hashtags: input.hashtags,
    media: { kind: input.mediaType, url: input.mediaUrl },
    images: input.images ?? null,
    song: input.song ?? null,
    visibility: 'public',
    moderationStatus: input.moderationStatus,
    moderationFlags: input.moderationFlags ?? [],
    likes: 0,
    comments: 0,
    shares: 0,
    views: 0,
    trendingScore: input.trendingScore,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteVideo(id: VideoId): Promise<void> {
  await deleteDoc(doc(firebaseDb(), COLL_VIDEOS, id));
}

/* ─────────────── Like / Save / View ─────────────── */

export async function toggleLike(videoId: VideoId, userId: UserId, liked: boolean): Promise<void> {
  const likeRef = doc(firebaseDb(), COLL_LIKES, `${videoId}_${userId}`);
  if (liked) {
    await deleteDoc(likeRef);
    await updateDoc(doc(firebaseDb(), COLL_VIDEOS, videoId), { likes: increment(-1) });
  } else {
    await setDoc(likeRef, { videoId, userId, createdAt: serverTimestamp() });
    await updateDoc(doc(firebaseDb(), COLL_VIDEOS, videoId), { likes: increment(1) });
  }
}

export async function isLikedBy(videoId: VideoId, userId: UserId): Promise<boolean> {
  const snap = await getDoc(doc(firebaseDb(), COLL_LIKES, `${videoId}_${userId}`));
  return snap.exists();
}

export async function toggleSave(videoId: VideoId, userId: UserId, saved: boolean): Promise<void> {
  const saveRef = doc(firebaseDb(), COLL_SAVES, `${videoId}_${userId}`);
  if (saved) await deleteDoc(saveRef);
  else await setDoc(saveRef, { videoId, userId, createdAt: serverTimestamp() });
}

export async function registerView(videoId: VideoId): Promise<void> {
  await updateDoc(doc(firebaseDb(), COLL_VIDEOS, videoId), { views: increment(1) });
}

/* ─────────────── Comments ─────────────── */

export function subscribeToComments(
  videoId: VideoId,
  onChange: (comments: Comment[]) => void,
): () => void {
  return onSnapshot(
    query(
      collection(firebaseDb(), COLL_COMMENTS),
      where('videoId', '==', videoId),
      orderBy('createdAt', 'asc'),
    ),
    snap => onChange(snap.docs.map(d => snapshotTo<Comment>(d))),
  );
}

export async function postComment(input: {
  videoId: VideoId;
  userId: UserId;
  username: string;
  avatar: string;
  avatarColor: string;
  avatarUrl: string | null;
  text: string;
}): Promise<void> {
  await addDoc(collection(firebaseDb(), COLL_COMMENTS), {
    videoId: input.videoId,
    userId: input.userId,
    username: input.username,
    avatar: input.avatar,
    avatarColor: input.avatarColor,
    avatarUrl: input.avatarUrl,
    text: input.text,
    likes: 0,
    pinned: false,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(firebaseDb(), COLL_VIDEOS, input.videoId), { comments: increment(1) });
}

/* ─────────────── User videos ─────────────── */

export async function fetchUserVideos(userId: UserId): Promise<VideoPost[]> {
  const q = query(
    collection(firebaseDb(), COLL_VIDEOS),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    fbLimit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => snapshotTo<VideoPost>(d));
}
