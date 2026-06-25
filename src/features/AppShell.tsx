'use client';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { Feed } from '@/features/feed/Feed';
import { DiscoverScreen } from '@/features/discover/DiscoverScreen';
import { InboxScreen } from '@/features/inbox/InboxScreen';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { CreatePost } from '@/features/create/CreatePost';
import { BottomNav } from '@/components/BottomNav';
import type { VideoPost } from '@/types';

export function AppShell() {
  const user = useAuthStore(s => s.user);
  const page = useUIStore(s => s.page);
  const setPage = useUIStore(s => s.setPage);
  const showToast = useUIStore(s => s.showToast);
  const [showCreate, setShowCreate] = useState(false);
  const [following, setFollowing] = useState<string[]>(user?.following ?? []);

  const toggleFollow = (uid: string) => {
    setFollowing(prev => prev.includes(uid) ? prev.filter(id=>id!==uid) : [...prev, uid]);
    showToast(following.includes(uid) ? 'Unfollowed' : 'Following! ✨', 'info');
  };

  const feedProps = {
    currentUserId: user?.id, followedIds: following,
    onComment: (id: string) => showToast('Comments coming soon 💬', 'info'),
    onShare: (p: VideoPost) => { navigator.clipboard?.writeText(window.location.href).catch(()=>{}); showToast('Link copied! 🔗', 'success'); },
    onViewProfile: () => setPage('profile'),
    onFollow: toggleFollow,
  };

  return (
    <div style={{ position:'relative', height:'100dvh', width:'100%', overflow:'hidden', background:'#0B0B0F' }}>
      <div style={{ position:'absolute', inset:0, bottom:64 }}>
        {page === 'feed' && <Feed {...feedProps} />}
        {page === 'discover' && <DiscoverScreen />}
        {page === 'inbox' && <InboxScreen />}
        {page === 'profile' && <ProfileScreen />}
        {page === 'create' && <Feed {...feedProps} />}
      </div>

      <BottomNav onCreateTap={() => setShowCreate(true)} />

      {showCreate && (
        <CreatePost
          onClose={() => { setShowCreate(false); setPage('feed'); }}
          onCreated={() => { setShowCreate(false); setPage('feed'); }}
        />
      )}
    </div>
  );
}
