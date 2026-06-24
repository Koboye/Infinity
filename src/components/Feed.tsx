'use client';

import { useEffect, useRef, useState } from 'react';
import { subscribeToFeed } from '@/lib/firebase/videos';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import type { VideoPost } from '@/types';
import { VideoCard } from './VideoCard';
import { rankVideos } from '@/lib/ai/trends';
import { useUIStore } from '@/stores/uiStore';
import { VideoCardSkeleton } from '@/components/Skeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export interface FeedProps {
  currentUserId?: string;
  followedIds?: string[];
  onComment: (postId: string) => void;
  onShare: (post: VideoPost) => void;
  onViewProfile: (userId: string) => void;
  onFollow: (userId: string) => void;
}

const PAGE = 8;

export function Feed({ currentUserId, followedIds, onComment, onShare, onViewProfile, onFollow }: FeedProps) {
  const [posts, setPosts] = useState<VideoPost[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const showToast = useUIStore(s => s.showToast);
  const followedSetRef = useRef(new Set(followedIds ?? []));

  useEffect(() => {
    followedSetRef.current = new Set(followedIds ?? []);
  }, [followedIds]);

  // Subscribe to the first page
  useEffect(() => {
    setLoading(true);
    let unsub: (() => void) | null = null;

    // Defer to next tick so we don't fight with auth init
    const t = setTimeout(() => {
      unsub = subscribeToFeed(
        { viewerId: currentUserId, pageSize: PAGE * 2 },
        fresh => {
          // Smart ranking: blend recency, engagement, and personalization
          const ranked = rankVideos(fresh, { id: currentUserId, following: [...followedSetRef.current] });
          setPosts(ranked);
          setLoading(false);
        },
        err => {
          setError(err.message);
          setLoading(false);
          showToast('Failed to load feed', 'error');
        },
      );
    }, 50);

    return () => {
      clearTimeout(t);
      unsub?.();
    };
  }, [currentUserId, showToast]);

  // IntersectionObserver — mark the most-visible card as "active" so its
  // video starts playing. Replaces the manual index bookkeeping in V3.
  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll('[data-feed-card]');
    const observer = new IntersectionObserver(
      entries => {
        let best: { idx: number; ratio: number } | null = null;
        entries.forEach(e => {
          const idx = Number((e.target as HTMLElement).dataset.feedIdx);
          if (e.isIntersecting && (!best || e.intersectionRatio > best.ratio)) {
            best = { idx, ratio: e.intersectionRatio };
          }
        });
        if (best) setActiveIdx(best.idx);
      },
      { threshold: [0.5, 0.75, 0.9] },
    );
    cards.forEach(c => observer.observe(c));
    return () => observer.disconnect();
  }, [posts.length]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-5xl">😕</div>
        <p className="text-sm text-white/60">{error}</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div ref={containerRef} className="relative h-full w-full snap-y snap-mandatory overflow-y-scroll bg-black">
        {loading
          ? Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="relative h-full w-full snap-start">
                <VideoCardSkeleton />
              </div>
            ))
          : posts.length === 0
            ? <EmptyState />
            : posts.map((post, i) => (
                <div
                  key={post.id}
                  data-feed-card
                  data-feed-idx={i}
                  className="relative h-full w-full snap-start"
                >
                  <VideoCard
                    post={post}
                    isActive={i === activeIdx}
                    currentUserId={currentUserId}
                    onComment={onComment}
                    onShare={onShare}
                    onViewProfile={onViewProfile}
                    onFollow={onFollow}
                    isFollowing={followedIds?.includes(post.userId)}
                  />
                </div>
              ))}
      </div>
    </ErrorBoundary>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-6xl">🎬</div>
      <h3 className="text-lg font-bold">No videos yet</h3>
      <p className="max-w-xs text-sm text-white/50">
        Be the first to post! Tap the create button to share your first video with the community.
      </p>
    </div>
  );
}
