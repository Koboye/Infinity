'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { subscribeToFeed } from '@/lib/firebase/videos';
import type { VideoPost } from '@/types';
import { VideoCard } from './VideoCard';
import { rankVideos } from '@/lib/ai/trends';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { VideoCardSkeleton } from '@/components/Skeleton';

const TABS = ['For you', 'Following', 'Learn', 'Tech', 'Mindset'];

interface FeedProps {
  currentUserId?: string; followedIds?: string[];
  onComment: (id: string, ownerId: string, ownerUsername: string) => void; onShare: (p: VideoPost) => void;
  onViewProfile: (uid: string) => void; onFollow: (uid: string) => void;
}

export function Feed({ currentUserId, followedIds, onComment, onShare, onViewProfile, onFollow }: FeedProps) {
  const user = useAuthStore(s => s.user);
  const [posts, setPosts] = useState<VideoPost[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const showToast = useUIStore(s => s.showToast);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToFeed(
      { viewerId: currentUserId, pageSize: 20 },
      fresh => {
        const ranked = rankVideos(fresh, { id: currentUserId ?? '', following: followedIds ?? [] });
        setPosts(ranked); setLoading(false); setRefreshing(false);
      },
      () => { showToast('Failed to load feed', 'error'); setLoading(false); setRefreshing(false); }
    );
    return () => unsub();
  }, [currentUserId]);

  // IntersectionObserver for active card (video playback)
  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll('[data-card]');
    const observer = new IntersectionObserver(entries => {
      let bestIdx = -1; let bestRatio = 0;
      entries.forEach(e => {
        const idx = Number((e.target as HTMLElement).dataset.idx);
        if (e.isIntersecting && e.intersectionRatio > bestRatio) { bestRatio = e.intersectionRatio; bestIdx = idx; }
      });
      if (bestIdx >= 0) setActiveIdx(bestIdx);
    }, { threshold: [0.5, 0.8] });
    cards.forEach(c => observer.observe(c));
    return () => observer.disconnect();
  }, [posts.length]);

  // Pull to refresh
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop !== 0) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setPullY(Math.min(delta * 0.4, 80));
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (pullY > 50) {
      setRefreshing(true);
      setLoading(true);
      showToast('Refreshing feed…', 'info');
    }
    setPullY(0);
  }, [pullY]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* Pull to refresh indicator */}
      {(pullY > 0 || refreshing) && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: refreshing ? 48 : pullY,
          background: 'rgba(107,78,255,0.12)',
          transition: pullY === 0 ? 'height 0.3s ease' : 'none',
        }}>
          <span style={{
            fontSize: 20,
            transform: refreshing ? 'none' : `rotate(${pullY * 3}deg)`,
            animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
          }}>
            {refreshing ? '🔄' : '↓'}
          </span>
        </div>
      )}

      {/* Feed tabs — sticky at top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        padding: '10px 12px 8px',
        display: 'flex', gap: 0, overflowX: 'auto',
      }}>
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setActiveTab(i)}
            style={{
              background: i === activeTab ? 'rgba(107,78,255,0.85)' : 'none',
              border: 'none', borderRadius: 999,
              padding: '6px 14px',
              fontSize: 13, fontWeight: 600,
              color: i === activeTab ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* TikTok-style scroll-snap feed */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          height: '100%', width: '100%', overflowY: 'scroll',
          scrollSnapType: 'y mandatory', background: 'black',
          transform: pullY > 0 ? `translateY(${pullY}px)` : 'none',
          transition: pullY === 0 ? 'transform 0.3s ease' : 'none',
        }}
      >
        {loading
          ? [0, 1].map(i => (
              <div key={i} style={{ height: '100%', width: '100%', scrollSnapAlign: 'start', position: 'relative' }}>
                <VideoCardSkeleton />
              </div>
            ))
          : posts.length === 0
          ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: 24 }}>
              <span style={{ fontSize: 64 }}>✨</span>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>Your feed awaits</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, maxWidth: 260 }}>
                Follow people and explore spaces to fill your feed.
              </p>
            </div>
          )
          : posts.map((post, i) => (
            <div key={post.id} data-card data-idx={i} style={{ height: '100%', width: '100%', scrollSnapAlign: 'start', position: 'relative' }}>
              {/* Preload next video */}
              {i === activeIdx + 1 && post.media?.kind === 'video' && (
                <link rel="preload" as="video" href={post.media.url} />
              )}
              <VideoCard
                post={post} isActive={i === activeIdx} currentUserId={currentUserId}
                onComment={onComment}
                onShare={onShare} onViewProfile={onViewProfile} onFollow={onFollow}
                isFollowing={followedIds?.includes(post.userId)}
              />
            </div>
          ))}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
