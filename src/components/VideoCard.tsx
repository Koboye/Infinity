'use client';

import { useEffect, useRef, useState } from 'react';
import { m } from 'framer-motion';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Volume2, VolumeX, Music2, Play, Pause } from 'lucide-react';
import type { VideoPost } from '@/types';
import { Avatar } from '@/components/Avatar';
import { cn, formatCount, haptic, timeAgo } from '@/lib/utils/cn';
import { isLikedBy, registerView, toggleLike, toggleSave } from '@/lib/firebase/videos';

export interface VideoCardProps {
  post: VideoPost;
  isActive: boolean;
  currentUserId?: string;
  onComment: (postId: string) => void;
  onShare: (post: VideoPost) => void;
  onViewProfile: (userId: string) => void;
  onFollow: (userId: string) => void;
  isFollowing?: boolean;
}

export function VideoCard({
  post,
  isActive,
  currentUserId,
  onComment,
  onShare,
  onViewProfile,
  onFollow,
  isFollowing,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [heartBurst, setHeartBurst] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const isImage = post.media.kind === 'image' || !!post.images;

  // Initialise like state from Firestore
  useEffect(() => {
    if (!currentUserId) return;
    isLikedBy(post.id, currentUserId).then(setLiked).catch(() => {});
  }, [post.id, currentUserId]);

  // Play / pause based on whether this card is in the viewport
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive && playing) {
      el.muted = muted;
      el.play().catch(() => {
        el.muted = true;
        el.play().catch(() => {});
      });
    } else {
      el.pause();
    }
  }, [isActive, playing, muted]);

  // Register a view once per session per post
  useEffect(() => {
    if (!isActive || !currentUserId) return;
    const key = `viewed_${post.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    registerView(post.id).catch(() => {});
  }, [isActive, post.id, currentUserId]);

  const handleLike = async () => {
    if (!currentUserId) return;
    haptic('medium');
    const next = !liked;
    setLiked(next);
    if (next) {
      setHeartBurst(true);
      setTimeout(() => setHeartBurst(false), 900);
    }
    try {
      await toggleLike(post.id, currentUserId, liked);
    } catch {
      // Optimistic — revert on failure
      setLiked(!next);
    }
  };

  const handleSave = async () => {
    if (!currentUserId) return;
    const next = !saved;
    setSaved(next);
    try {
      await toggleSave(post.id, currentUserId, saved);
    } catch {
      setSaved(!next);
    }
  };

  const handleTap = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    if (isImage) return;
    if (muted) {
      setMuted(false);
      return;
    }
    setPlaying(p => !p);
  };

  return (
    <article
      onClick={handleTap}
      className="absolute inset-0 bg-black"
      aria-label={`Post by @${post.username}`}
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.images?.[0] ?? post.media.url}
          alt={post.description}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <video
          ref={videoRef}
          src={post.media.url}
          loop
          playsInline
          muted={muted}
          className="h-full w-full object-cover"
          preload="metadata"
        />
      )}

      {/* Bottom gradient for text legibility */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40" />

      {/* Heart burst on double-tap */}
      {heartBurst && (
        <m.div
          initial={{ scale: 0.4, opacity: 1 }}
          animate={{ scale: 1.8, opacity: 0, y: -80 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-7xl"
        >
          ❤️
        </m.div>
      )}

      {/* Right-side action rail */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col items-center gap-1.5 pb-2">
        <ActionButton label={formatCount(post.likes + (liked ? 1 : 0))} active={liked} onClick={handleLike} icon={<Heart className={cn('h-6 w-6', liked && 'fill-accent stroke-accent drop-shadow-[0_0_6px_rgba(255,45,85,0.6)]')} />} />
        <ActionButton label={formatCount(post.comments)} onClick={() => onComment(post.id)} icon={<MessageCircle className="h-6 w-6" />} />
        <ActionButton label={formatCount(post.shares)} onClick={() => onShare(post)} icon={<Share2 className="h-6 w-6" />} />
        <ActionButton label={saved ? 'Saved' : 'Save'} active={saved} onClick={handleSave} icon={<Bookmark className={cn('h-6 w-6', saved && 'fill-gold stroke-gold')} />} />
        <ActionButton label="More" onClick={() => {}} icon={<MoreHorizontal className="h-6 w-6" />} />
      </div>

      {/* Bottom info overlay */}
      <div className="absolute bottom-3 left-3.5 right-[68px] z-10">
        <div className="mb-2 flex items-center gap-2.5">
          <Avatar
            name={post.username}
            color={post.userAvatarColor}
            src={post.userAvatarUrl}
            size="md"
            ring={post.userVerified}
            onClick={() => onViewProfile(post.userId)}
          />
          <button
            type="button"
            onClick={() => onViewProfile(post.userId)}
            className="text-[15px] font-bold"
          >
            @{post.username}
          </button>
          {currentUserId !== post.userId && (
            <button
              type="button"
              onClick={() => onFollow(post.userId)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-bold backdrop-blur',
                isFollowing
                  ? 'border border-white/40 bg-white/10 text-white'
                  : 'bg-accent/90 text-white',
              )}
            >
              {isFollowing ? 'Following' : '+ Follow'}
            </button>
          )}
        </div>

        <Description text={post.description} expanded={showFullDesc} onToggle={() => setShowFullDesc(s => !s)} />

        <div className="mt-2 flex items-center gap-1.5">
          <Music2 className="h-3.5 w-3.5 text-white/70" />
          <span className="text-xs text-white/70">{post.song ?? 'Original sound'}</span>
          <span className="text-xs text-white/40">· {timeAgo(post.createdAt)}</span>
        </div>

        {post.hashtags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {post.hashtags.slice(0, 4).map(tag => (
              <span key={tag} className="text-xs font-semibold text-accent">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Mute / play indicator when paused */}
      {!playing && !isImage && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55">
            <Play className="h-7 w-7 fill-white text-white" />
          </div>
        </div>
      )}

      {/* Sound toggle (top-left, only when active) */}
      {isActive && !isImage && (
        <button
          type="button"
          onClick={() => setMuted(m => !m)}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}
    </article>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  active,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-full bg-black/30 p-2.5 backdrop-blur-sm transition-transform active:scale-90"
      aria-label={label}
    >
      <span className={cn('flex h-6 w-6 items-center justify-center text-white/90', active && 'text-accent')}>{icon}</span>
      <span className={cn('text-[11px] font-bold', active ? 'text-accent' : 'text-white/85')}>{label}</span>
    </button>
  );
}

function Description({ text, expanded, onToggle }: { text: string; expanded: boolean; onToggle: () => void }) {
  const LIMIT = 110;
  const isLong = text.length > LIMIT;
  const shown = isLong && !expanded ? `${text.slice(0, LIMIT).trimEnd()}…` : text;
  return (
    <p className="whitespace-pre-wrap break-words text-[13px] leading-snug text-white/90">
      {shown}
      {isLong && (
        <button
          type="button"
          onClick={onToggle}
          className="ml-1 font-bold text-white/55"
        >
          {expanded ? 'less' : 'more'}
        </button>
      )}
    </p>
  );
}
