// src/lib/firebase/stories.ts
'use client';
import {
  collection, query, where, orderBy, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { firebaseDb } from './client';
import { snapshotTo } from './converters';
import { getIdToken } from './auth';
import { uploadFile } from './upload';
import type { Story } from '@/types';

export interface StoryGroup {
  userId: string;
  username: string;
  userAvatarColor: string;
  userAvatarUrl: string | null;
  stories: Story[];
}

/** Subscribe to all non-expired, approved stories, grouped by author. */
export function subscribeActiveStories(
  onChange: (groups: StoryGroup[]) => void,
  onError?: () => void,
) {
  const q = query(
    collection(firebaseDb(), 'stories'),
    where('expiresAt', '>', Timestamp.now()),
    orderBy('expiresAt', 'asc'),
  );

  return onSnapshot(q, snap => {
    const stories = snap.docs
      .map(d => snapshotTo<Story>(d))
      .filter(s => s.moderationStatus !== 'rejected')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const byUser = new Map<string, StoryGroup>();
    for (const s of stories) {
      const existing = byUser.get(s.userId);
      if (existing) {
        existing.stories.push(s);
      } else {
        byUser.set(s.userId, {
          userId: s.userId,
          username: s.username,
          userAvatarColor: s.userAvatarColor,
          userAvatarUrl: s.userAvatarUrl,
          stories: [s],
        });
      }
    }
    onChange(Array.from(byUser.values()));
  }, () => onError?.());
}

/** Upload media + publish a new story (24h lifetime, set server-side). */
export async function publishStory(
  file: File,
  caption: string,
  onProgress?: (pct: number) => void,
): Promise<{ id: string }> {
  const uploaded = await uploadFile(file, { onProgress });
  const token = await getIdToken();
  const res = await fetch('/api/stories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      caption,
      mediaUrl: uploaded.url,
      mediaType: file.type.startsWith('image/') ? 'image' : 'video',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Failed to publish story');
  return data;
}

/** Mark a story as viewed by the current user (best-effort, fire-and-forget). */
export async function markStoryViewed(storyId: string) {
  try {
    const token = await getIdToken();
    await fetch(`/api/stories/${storyId}/view`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // best-effort — ignore failures
  }
}
