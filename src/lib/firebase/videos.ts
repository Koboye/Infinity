import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment,
  limit as fbLimit, onSnapshot, orderBy, query, serverTimestamp,
  setDoc, updateDoc, where, type DocumentData, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { firebaseDb } from './client';
import { snapshotTo } from './converters';
import type { Comment, UserId, VideoId, VideoPost } from '@/types';

export function subscribeToFeed(
  options: { viewerId?: UserId; pageSize?: number },
  onChange: (posts: VideoPost[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const pageSize = options.pageSize ?? 20;
  return onSnapshot(
    query(collection(firebaseDb(), 'videos'), orderBy('createdAt', 'desc'), fbLimit(pageSize)),
    snap => onChange(snap.docs.map(d => snapshotTo<VideoPost>(d))),
    err => onError?.(err),
  );
}

export async function toggleLike(videoId: VideoId, userId: UserId, liked: boolean): Promise<void> {
  const likeRef = doc(firebaseDb(), 'likes', `${videoId}_${userId}`);
  if (liked) {
    await deleteDoc(likeRef);
    await updateDoc(doc(firebaseDb(), 'videos', videoId), { likes: increment(-1) });
  } else {
    await setDoc(likeRef, { videoId, userId, createdAt: serverTimestamp() });
    await updateDoc(doc(firebaseDb(), 'videos', videoId), { likes: increment(1) });
  }
}

export async function isLikedBy(videoId: VideoId, userId: UserId): Promise<boolean> {
  return (await getDoc(doc(firebaseDb(), 'likes', `${videoId}_${userId}`))).exists();
}

export async function toggleSave(videoId: VideoId, userId: UserId, saved: boolean): Promise<void> {
  const ref = doc(firebaseDb(), 'saves', `${videoId}_${userId}`);
  if (saved) await deleteDoc(ref);
  else await setDoc(ref, { videoId, userId, createdAt: serverTimestamp() });
}

export async function registerView(videoId: VideoId): Promise<void> {
  await updateDoc(doc(firebaseDb(), 'videos', videoId), { views: increment(1) });
}

export function subscribeToComments(videoId: VideoId, onChange: (c: Comment[]) => void): () => void {
  return onSnapshot(
    query(collection(firebaseDb(), 'comments'), where('videoId', '==', videoId), orderBy('createdAt', 'asc')),
    snap => onChange(snap.docs.map(d => snapshotTo<Comment>(d))),
  );
}

export async function postComment(input: { videoId: VideoId; userId: UserId; username: string; avatar: string; avatarColor: string; avatarUrl: string | null; text: string }): Promise<void> {
  await addDoc(collection(firebaseDb(), 'comments'), { ...input, likes: 0, pinned: false, createdAt: serverTimestamp() });
  await updateDoc(doc(firebaseDb(), 'videos', input.videoId), { comments: increment(1) });
}

export async function fetchUserVideos(userId: UserId): Promise<VideoPost[]> {
  const snap = await getDocs(query(collection(firebaseDb(), 'videos'), where('userId', '==', userId), orderBy('createdAt', 'desc'), fbLimit(50)));
  return snap.docs.map(d => snapshotTo<VideoPost>(d));
}

export async function publishVideo(input: {
  userId: UserId; username: string; avatar: string; avatarColor: string; avatarUrl: string | null;
  verified: boolean; description: string; hashtags: string[]; mediaUrl: string; mediaType: 'video' | 'image';
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
