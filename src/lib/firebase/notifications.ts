import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { firebaseDb } from './client';

interface NotifInput {
  userId: string;         // who receives it
  fromUserId: string;     // who triggered it
  fromUsername: string;
  fromAvatar: string;
  fromAvatarColor: string;
  fromAvatarUrl: string | null;
  type: 'like' | 'comment' | 'follow' | 'mention';
  message: string;
  videoId?: string;
  videoUrl?: string;
}

export async function createNotification(input: NotifInput): Promise<void> {
  // Don't notify yourself
  if (input.userId === input.fromUserId) return;
  await addDoc(collection(firebaseDb(), 'notifications'), {
    ...input,
    read: false,
    createdAt: serverTimestamp(),
  });
}
