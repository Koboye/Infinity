'use client';

import { useState } from 'react';
import { Settings, LogOut, Edit3, MessageCircle, UserPlus, Check } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { signOutCurrent } from '@/lib/firebase/auth';
import { Avatar } from '@/components/Avatar';
import { fetchUserVideos } from '@/lib/firebase/videos';
import { useQuery } from '@tanstack/react-query';
import type { VideoPost } from '@/types';
import { cn, formatCount } from '@/lib/utils/cn';

export function ProfileScreen() {
  const user = useAuthStore(s => s.user);
  const showToast = useUIStore(s => s.showToast);
  const [tab, setTab] = useState<'posts' | 'liked'>('posts');

  const { data: posts = [] } = useQuery<VideoPost[]>({
    queryKey: ['userVideos', user?.id],
    queryFn: () => (user ? fetchUserVideos(user.id) : []),
    enabled: !!user,
  });

  const handleLogout = async () => {
    try {
      await signOutCurrent();
      showToast('Signed out', 'info');
    } catch {
      showToast('Sign-out failed', 'error');
    }
  };

  if (!user) return null;

  return (
    <div className="h-full overflow-y-auto bg-bg-base">
      <header className="flex items-center justify-between border-b border-white/6 p-4">
        <h1 className="text-lg font-extrabold">@{user.username}</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </header>

      <div className="px-5 py-6 text-center">
        <Avatar
          name={user.username}
          color={user.avatarColor}
          src={user.avatarUrl}
          size="xl"
          ring
          className="mx-auto"
        />
        <h2 className="mt-3 text-xl font-extrabold">@{user.username}</h2>
        {user.bio && <p className="mt-2 text-sm text-white/60">{user.bio}</p>}

        <div className="mx-auto mt-5 flex max-w-sm justify-around rounded-2xl border border-white/6 bg-bg-elev1 p-4">
          <Stat label="Posts" value={formatCount(posts.length)} />
          <Divider />
          <Stat label="Followers" value={formatCount(user.followers.length)} />
          <Divider />
          <Stat label="Following" value={formatCount(user.following.length)} />
        </div>

        <div className="mt-5 flex justify-center gap-2.5">
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white/8 py-2.5 text-sm font-bold"
          >
            <Edit3 className="h-4 w-4" />
            Edit profile
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-danger/15 px-4 py-2.5 text-sm font-bold text-danger"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex border-t border-white/6">
        {(['posts', 'liked'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 border-t-2 py-3.5 text-sm font-bold transition-colors',
              tab === t ? 'border-accent text-white' : 'border-transparent text-white/40',
            )}
          >
            {t === 'posts' ? 'Posts' : 'Liked'}
          </button>
        ))}
      </div>

      <div className="p-0.5">
        {posts.length === 0 ? (
          <div className="px-6 py-16 text-center text-white/40">
            <div className="mb-3 text-5xl">🎬</div>
            <div className="text-sm">No posts yet</div>
            <div className="mt-1 text-xs">Tap the create button to share your first video.</div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {posts.map(p => (
              <PostTile key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-extrabold">{value}</div>
      <div className="mt-0.5 text-xs text-white/40">{label}</div>
    </div>
  );
}

function Divider() {
  return <div className="w-px self-stretch bg-white/6" />;
}

function PostTile({ post }: { post: VideoPost }) {
  const isImage = post.media.kind === 'image' || !!post.images;
  return (
    <div className="relative aspect-[9/16] overflow-hidden bg-bg-elev2">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.images?.[0] ?? post.media.url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <video src={post.media.url} className="h-full w-full object-cover" muted />
      )}
      <div className="absolute bottom-1 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold">
        {formatCount(post.views)} 👁
      </div>
    </div>
  );
}
