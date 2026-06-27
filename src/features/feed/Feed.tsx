'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  collection, query, where, orderBy, limit as fbLimit,
  startAfter, getDocs, onSnapshot, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase/client';
import { snapshotTo } from '@/lib/firebase/converters';
import type { VideoPost } from '@/types';
import { VideoCard } from './VideoCard';
import { rankVideos } from '@/lib/ai/trends';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { VideoCardSkeleton } from '@/components/Skeleton';

const PAGE_SIZE = 20;
const TABS = ['For you', 'Following', 'Learn', 'Tech', 'Mindset'];
const ACCENT = '#5B4EE8';

// Fake stories data
const STORIES = [
  { name: 'Aria', color: '#8B7EE8' },
  { name: 'Liam', color: '#1D9E75' },
  { name: 'Maya', color: '#D85A30' },
  { name: 'Noah', color: '#185FA5' },
  { name: 'Zoe', color: '#D4537E' },
];

interface FeedProps {
  currentUserId?: string;
  followedIds?: string[];
  onComment: (id: string, ownerId: string, ownerUsername: string) => void;
  onShare: (p: VideoPost) => void;
  onViewProfile: (uid: string) => void;
  onFollow: (uid: string) => void;
}

export function Feed({ currentUserId, followedIds, onComment, onShare, onViewProfile, onFollow }: FeedProps) {
  const user = useAuthStore(s => s.user);
  const [posts, setPosts] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);
  const showToast = useUIStore(s => s.showToast);

  useEffect(() => {
    setLoading(true);
    setPosts([]);
    lastDocRef.current = null;
    setHasMore(true);

    const q = query(
      collection(firebaseDb(), 'videos'),
      where('moderationStatus', '==', 'approved'),
      orderBy('createdAt', 'desc'),
      fbLimit(PAGE_SIZE),
    );
    const unsub = onSnapshot(q, snap => {
      const fresh = snap.docs.map(d => snapshotTo<VideoPost>(d));
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(snap.docs.length === PAGE_SIZE);
      const ranked = rankVideos(fresh, { id: currentUserId ?? '', following: followedIds ?? [] });
      setPosts(ranked);
      setLoading(false);
      setRefreshing(false);
    }, () => {
      showToast('Failed to load feed', 'error');
      setLoading(false);
      setRefreshing(false);
    });
    return () => unsub();
  }, [currentUserId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDocRef.current) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(firebaseDb(), 'videos'),
        where('moderationStatus', '==', 'approved'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDocRef.current),
        fbLimit(PAGE_SIZE),
      );
      const snap = await getDocs(q);
      const next = snap.docs.map(d => snapshotTo<VideoPost>(d));
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? lastDocRef.current;
      setHasMore(snap.docs.length === PAGE_SIZE);
      setPosts(prev => {
        const ids = new Set(prev.map(p => p.id));
        return [...prev, ...next.filter(p => !ids.has(p.id))];
      });
    } catch {
      showToast('Could not load more posts', 'error');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  const initials = user?.username?.[0]?.toUpperCase() ?? 'Y';

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#F5F5F7' }}>

      {/* Top bar */}
      <div style={{ background: '#FFFFFF', padding: '14px 20px 0', position: 'sticky', top: 0, zIndex: 20, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0D0D12" strokeWidth="1.8" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/>
          </svg>
          <div style={{ position: 'relative' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0D0D12" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, background: ACCENT, borderRadius: '50%', border: '1.5px solid white' }} />
          </div>
        </div>

        {/* Stories row */}
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 14 }}>
          {/* Add story */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F0EFF4', border: '1.5px dashed rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#C3B8F8,#5B4EE8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 15 }}>{initials}</div>
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, background: ACCENT, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
            </div>
            <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>Your story</span>
          </div>

          {STORIES.map(s => (
            <div key={s.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0, cursor: 'pointer' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', border: `2px solid ${ACCENT}`, padding: 2, background: '#fff' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 18 }}>
                  {s.name[0]}
                </div>
              </div>
              <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div style={{ background: '#FFFFFF', margin: '10px 14px', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(0,0,0,0.07)' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#C3B8F8,#5B4EE8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 14, flexShrink: 0 }}>{initials}</div>
        <span style={{ flex: 1, color: '#9CA3AF', fontSize: 14 }}>
          <span style={{ marginRight: 5, color: ACCENT }}>✦</span> What's on your mind?
        </span>
        <div style={{ width: 30, height: 30, background: '#F5F5F7', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
      </div>

      {/* Tab pills */}
      <div style={{ display: 'flex', gap: 8, padding: '0 14px 12px', overflowX: 'auto' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setActiveTab(i)} style={{
            padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500,
            whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0, border: 'none',
            background: i === activeTab ? '#0D0D12' : '#FFFFFF',
            color: i === activeTab ? '#FFFFFF' : '#6B7280',
            boxShadow: i === activeTab ? 'none' : '0 0 0 1px rgba(0,0,0,0.08)',
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Posts */}
      {loading
        ? [0,1].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 16, margin: '0 14px 10px', overflow: 'hidden', height: 320 }}>
              <VideoCardSkeleton />
            </div>
          ))
        : posts.length === 0
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: '60px 24px' }}>
            <span style={{ fontSize: 64 }}>✨</span>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0D0D12' }}>Your feed awaits</h3>
            <p style={{ color: '#9CA3AF', fontSize: 14, maxWidth: 260 }}>Follow people and explore spaces to fill your feed.</p>
          </div>
        )
        : posts.map((post, i) => (
            <VideoCard
              key={post.id}
              post={post}
              isActive={true}
              currentUserId={currentUserId}
              onComment={onComment}
              onShare={onShare}
              onViewProfile={onViewProfile}
              onFollow={onFollow}
              isFollowing={followedIds?.includes(post.userId)}
              cardStyle="card"
            />
          ))
      }

      {posts.length > 0 && (
        <div style={{ padding: '12px 0 8px', textAlign: 'center' }}>
          {loadingMore
            ? <span style={{ color: '#9CA3AF', fontSize: 13 }}>Loading more…</span>
            : hasMore
            ? <button onClick={loadMore} style={{ background: 'none', border: '1px solid rgba(0,0,0,0.1)', color: '#6B7280', borderRadius: 20, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>Load more</button>
            : <span style={{ color: '#9CA3AF', fontSize: 13 }}>You're all caught up ✓</span>
          }
        </div>
      )}
    </div>
  );
}
