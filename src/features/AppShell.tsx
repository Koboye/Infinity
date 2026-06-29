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
  doc, onSnapshot, collection, query, where,
} from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase/client';
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

  // Sync user profile + following list in real-time
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(firebaseDb(), 'users', user.id), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      const newFollowing = data.following ?? [];
      const newFollowers = data.followers ?? [];
      if (
        JSON.stringify(newFollowing) !== JSON.stringify(user.following) ||
        JSON.stringify(newFollowers) !== JSON.stringify(user.followers)
      ) {
        setFollowing(newFollowing);
        setUser({ ...user, following: newFollowing, followers: newFollowers });
      }
    });
    return () => unsub();
  }, [user?.id]);

  // Unread notifications badge
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(firebaseDb(), 'notifications'),
      where('userId', '==', user.id),
      where('read', '==', false)
    );
    const unsub = onSnapshot(q, snap => setUnreadNotifs(snap.size));
    return () => unsub();
  }, [user?.id]);

  // Unread messages badge
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(firebaseDb(), 'conversations'),
      where('participants', 'array-contains', user.id)
    );
    const unsub = onSnapshot(q, snap => {
      const total = snap.docs.reduce((sum, d) => {
        const counts = (d.data().unreadCount ?? {}) as Record<string, number>;
        return sum + (counts[user.id] ?? 0);
      }, 0);
      setUnreadMessages(total);
    });
    return () => unsub();
  }, [user?.id]);

  const toggleFollow = async (uid: string) => {
    if (!user || uid === user.id) return;
    const isFollowing = following.includes(uid);
    try {
      const { getIdToken } = await import('@/lib/firebase/auth');
      const token = await getIdToken();
      const res = await fetch('/api/users/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetId: uid }),
      });
      if (!res.ok) throw new Error('failed');
      showToast(isFollowing ? 'Unfollowed' : 'Following! ✨', 'info');
    } catch {
      showToast('Could not update follow', 'error');
    }
  };

  // ✅ ADDED: onStoryTap opens Create Post
  const handleStoryTap = () => {
    setShowCreate(true);
  };

  const feedProps = {
    currentUserId: user?.id,
    followedIds: following,
    blockedIds: user?.blockedUsers ?? [],
    onComment: (id: string, ownerId: string, ownerUsername: string) =>
      setCommentTarget({ id, ownerId, ownerUsername }),
    onShare: async (p: VideoPost) => {
      navigator.clipboard?.writeText(`${window.location.origin}?post=${p.id}`).catch(() => {});
      showToast('Link copied! 🔗', 'success');
      // Increment share count server-side (client cannot write protected fields)
      fetch(`/api/videos/${p.id}/share`, { method: 'POST' }).catch(() => {});
    },
    onViewProfile: (_uid: string) => setPage('profile'),
    onFollow: toggleFollow,
    onStoryTap: handleStoryTap, // ✅ ADDED
  };

  return (
    <div style={{ position: 'relative', height: '100dvh', width: '100%', overflow: 'hidden', background: '#F8F7F4' }}>
      <div style={{ height: 'calc(100dvh - 72px)', overflowY: 'auto', overflowX: 'hidden' }}>
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
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); showToast('Post published! 🎉', 'success'); }}
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
