'use client';
import { useEffect, useRef, useState } from 'react';
import { subscribeToFeed } from '@/lib/firebase/videos';
import type { VideoPost } from '@/types';
import { VideoCard } from './VideoCard';
import { rankVideos } from '@/lib/ai/trends';
import { useUIStore } from '@/stores/uiStore';
import { VideoCardSkeleton } from '@/components/Skeleton';

interface FeedProps {
  currentUserId?: string; followedIds?: string[];
  onComment: (id: string) => void; onShare: (p: VideoPost) => void;
  onViewProfile: (uid: string) => void; onFollow: (uid: string) => void;
}

export function Feed({ currentUserId, followedIds, onComment, onShare, onViewProfile, onFollow }: FeedProps) {
  const [posts, setPosts] = useState<VideoPost[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const showToast = useUIStore(s => s.showToast);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToFeed(
      { viewerId: currentUserId, pageSize: 20 },
      fresh => {
        const ranked = rankVideos(fresh, { id: currentUserId ?? '', following: followedIds ?? [] });
        setPosts(ranked); setLoading(false);
      },
      () => { showToast('Failed to load feed', 'error'); setLoading(false); }
    );
    return () => unsub();
  }, [currentUserId]);

useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll('[data-card]');
    const observer = new IntersectionObserver(entries => {
      let bestIdx = -1;
      let bestRatio = 0;
      entries.forEach(e => {
        const idx = Number((e.target as HTMLElement).dataset.idx);
        if (e.isIntersecting && e.intersectionRatio > bestRatio) {
          bestRatio = e.intersectionRatio;
          bestIdx = idx;
        }
      });
      if (bestIdx >= 0) setActiveIdx(bestIdx);
    }, { threshold: [0.5, 0.8] });
    cards.forEach(c => observer.observe(c));
    return () => observer.disconnect();
  }, [posts.length]);

  return (
    <div ref={containerRef} style={{ height:'100%', width:'100%', overflowY:'scroll', scrollSnapType:'y mandatory', background:'black' }}>
      {loading
        ? [0,1].map(i => <div key={i} style={{ height:'100%', width:'100%', scrollSnapAlign:'start', position:'relative' }}><VideoCardSkeleton /></div>)
        : posts.length === 0
        ? <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, textAlign:'center', padding:24 }}>
            <span style={{ fontSize:64 }}>🎬</span>
            <h3 style={{ fontSize:20, fontWeight:700 }}>No videos yet</h3>
            <p style={{ color:'rgba(255,255,255,0.5)', fontSize:14 }}>Be the first to post!</p>
          </div>
        : posts.map((post, i) => (
            <div key={post.id} data-card data-idx={i} style={{ height:'100%', width:'100%', scrollSnapAlign:'start', position:'relative' }}>
              <VideoCard post={post} isActive={i===activeIdx} currentUserId={currentUserId}
                onComment={onComment} onShare={onShare} onViewProfile={onViewProfile} onFollow={onFollow}
                isFollowing={followedIds?.includes(post.userId)} />
            </div>
          ))}
    </div>
  );
}
