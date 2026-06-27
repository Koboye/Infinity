'use client';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { Feed } from '@/features/feed/Feed';
import { DiscoverScreen } from '@/features/discover/DiscoverScreen';
import { InboxScreen } from '@/features/inbox/InboxScreen';
import { NotificationsScreen } from '@/features/notifications/NotificationsScreen';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { CreatePost } from '@/features/create/CreatePost';
import { CommentsSheet } from '@/features/feed/CommentsSheet';
import { BottomNav } from '@/components/BottomNav';
import { ToastHost } from '@/components/Toast';
import {
  doc, updateDoc, arrayUnion, arrayRemove,
  onSnapshot, collection, query, where,
} from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase/client';
import { createNotification } from '@/lib/firebase/notifications';
import type { VideoPost } from '@/types';

export function AppShell() {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const page = useUIStore(s => s.page);
  const setPage = useUIStore(s => s.setPage);
  const showToast = useUIStore(s => s.showToast);
  const [showCreate, setShowCreate] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ id: string; ownerId: string; ownerUsername: string } | null>(null);
  const [following, setFollowing] = useState<string[]>(user?.following ?? []);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(firebaseDb(), 'users', user.id), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setFollowing(data.following ?? []);
        setUser({ ...user, following: data.following ?? [], followers: data.followers ?? [] });
      }
    });
    return () => unsub();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(firebaseDb(), 'notifications'), where('userId', '==', user.id), where('read', '==', false));
    const unsub = onSnapshot(q, snap => setUnreadNotifs(snap.size));
    return () => unsub();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    // Listen to conversations where user is a participant and there are unread messages
    const q = query(
      collection(firebaseDb(), 'conversations'),
      where('participants', 'array-contains', user.id)
    );
    const unsub = onSnapshot(q, snap => {
      const total = snap.docs.reduce((sum, d) => sum + ((d.data().unreadCount as number) ?? 0), 0);
      setUnreadMessages(total);
    });
    return () => unsub();
  }, [user?.id]);

  const toggleFollow = async (uid: string) => {
    if (!user) return;
    const isFollowing = following.includes(uid);
    try {
      await updateDoc(doc(firebaseDb(), 'users', user.id), {
        following: isFollowing ? arrayRemove(uid) : arrayUnion(uid),
      });
      await updateDoc(doc(firebaseDb(), 'users', uid), {
        followers: isFollowing ? arrayRemove(user.id) : arrayUnion(user.id),
      });
      if (!isFollowing) {
        await createNotification({
          userId: uid,
          fromUserId: user.id,
          fromUsername: user.username,
          fromAvatar: user.avatar,
          fromAvatarColor: user.avatarColor,
          fromAvatarUrl: user.avatarUrl,
          type: 'follow',
          message: 'started following you',
        });
      }
      showToast(isFollowing ? 'Unfollowed' : 'Following! ✨', 'info');
    } catch {
      showToast('Could not update follow', 'error');
    }
  };

  const feedProps = {
    currentUserId: user?.id,
    followedIds: following,
    onComment: (id: string, ownerId: string, ownerUsername: string) => setCommentTarget({ id, ownerId, ownerUsername }),
    onShare: (p: VideoPost) => {
      navigator.clipboard?.writeText(window.location.href).catch(() => {});
      showToast('Link copied! 🔗', 'success');
    },
    onViewProfile: () => setPage('profile'),
    onFollow: toggleFollow,
  };

  return (
    <div style={{ position: 'relative', height: '100dvh', width: '100%', overflow: 'hidden', background: '#F5F5F7' }}>
      <div style={{ position: 'absolute', inset: 0, bottom: 64 }}>
        {page === 'feed'          && <Feed {...feedProps} />}
        {page === 'discover'      && <DiscoverScreen />}
        {page === 'inbox'         && <InboxScreen />}
        {page === 'notifications' && <NotificationsScreen />}
        {page === 'profile'       && <ProfileScreen />}
      </div>

      <BottomNav
        onCreateTap={() => setShowCreate(true)}
        unreadNotifs={unreadNotifs}
        unreadMessages={unreadMessages}
      />

      {showCreate && (
        <CreatePost
          onClose={() => { setShowCreate(false); setPage('feed'); }}
          onCreated={() => { setShowCreate(false); setPage('feed'); }}
        />
      )}

      {commentTarget && (
        <CommentsSheet
          videoId={commentTarget.id}
          videoOwnerId={commentTarget.ownerId}
          videoOwnerUsername={commentTarget.ownerUsername}
          onClose={() => setCommentTarget(null)}
        />
      )}

      <ToastHost />
    </div>
  );
}
