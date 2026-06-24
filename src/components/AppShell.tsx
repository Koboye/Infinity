'use client';

import { useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
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

  const toggleFollow = (userId: string) => {
    setFollowing(prev => (prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]));
    showToast(following.includes(userId) ? 'Unfollowed' : 'Following!', 'info');
  };

  const handleCreateTap = () => {
    if (page === 'create') return;
    setShowCreate(true);
  };

  // Map store page → component. Feed/Drawer are full-screen, others slide in.
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-bg-base">
      <div className="absolute inset-0 bottom-16">
        <AnimatePresence mode="wait">
          {page === 'feed' && (
            <m.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
              <Feed
                currentUserId={user?.id}
                followedIds={following}
                onComment={() => showToast('Comments — pluggable module', 'info')}
                onShare={p => showToast(`Share sheet for "${p.description.slice(0, 20)}…"`, 'info')}
                onViewProfile={() => setPage('profile')}
                onFollow={toggleFollow}
              />
            </m.div>
          )}
          {page === 'discover' && (
            <m.div key="discover" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} className="absolute inset-0 overflow-y-auto">
              <DiscoverScreen />
            </m.div>
          )}
          {page === 'inbox' && (
            <m.div key="inbox" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} className="absolute inset-0">
              <InboxScreen />
            </m.div>
          )}
          {page === 'profile' && (
            <m.div key="profile" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} className="absolute inset-0 overflow-y-auto">
              <ProfileScreen />
            </m.div>
          )}
          {page === 'create' && (
            <m.div key="create-placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
              <Feed currentUserId={user?.id} followedIds={following} onComment={() => {}} onShare={() => {}} onViewProfile={() => {}} onFollow={toggleFollow} />
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />

      <AnimatePresence>
        {showCreate && (
          <CreatePost
            onClose={() => {
              setShowCreate(false);
              setPage('feed');
            }}
            onCreated={() => {
              setShowCreate(false);
              setPage('feed');
            }}
          />
        )}
      </AnimatePresence>

      {/* Intercept the Create tap to open the modal instead of switching tabs */}
      <button
        type="button"
        onClick={handleCreateTap}
        className="fixed bottom-16 left-1/2 z-40 hidden h-12 w-12 -translate-x-1/2"
        aria-hidden
        tabIndex={-1}
      />
    </div>
  );
}

// Suppress unused — re-export so it's not tree-shaken when imported elsewhere
export type { VideoPost };
