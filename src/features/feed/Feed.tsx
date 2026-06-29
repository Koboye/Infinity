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
const TABS = ['For you', 'Following', 'Trending'];
const ACCENT = '#3D6B4F';




function LeafLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill={ACCENT}>
        <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-8 2S13 2 17 8z"/>
      </svg>
      <span style={{ fontSize: 16, fontWeight: 800, color: '#1A1A1A' }}>infinity</span>
      <span style={{ fontSize: 12, color: '#9CA3AF' }}>/ የተደዳኢ</span>
    </div>
  );
}

interface FeedProps {
  currentUserId?: string;
  followedIds?: string[];
  blockedIds?: string[];
  onComment: (id: string, ownerId: string, ownerUsername: string) => void;
  onShare: (p: VideoPost) => void;
  onViewProfile: (uid: string) => void;
  onFollow: (uid: string) => void;
}

export function Feed({ currentUserId, followedIds, blockedIds = [], onComment, onShare, onViewProfile, onFollow }: FeedProps) {
  const user = useAuthStore(s => s.user);
  const [posts, setPosts] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);
  const showToast = useUIStore(s => s.showToast);

  useEffect(() => {
    setLoading(true);
    setPosts([]);
    lastDocRef.current = null;
    setHasMore(true);

    // Try fetching with moderationStatus filter first (new posts).
    // If that returns 0 results, also fetch without the filter (old posts).
    const q = query(
      collection(firebaseDb(), 'videos'),
      where('moderationStatus', '==', 'approved'),
      orderBy('createdAt', 'desc'),
      fbLimit(PAGE_SIZE),
    );

    const qFallback = query(
      collection(firebaseDb(), 'videos'),
      orderBy('createdAt', 'desc'),
      fbLimit(PAGE_SIZE),
    );

    const unsub = onSnapshot(q, snap => {
      if (snap.docs.length === 0) {
        // No approved posts — fetch ALL posts (includes old-format ones;
        // the converter will default moderationStatus to 'approved').
        getDocs(qFallback).then(fallbackSnap => {
          const fresh = fallbackSnap.docs.map(d => snapshotTo<VideoPost>(d));
          lastDocRef.current = fallbackSnap.docs[fallbackSnap.docs.length - 1] ?? null;
          setHasMore(fallbackSnap.docs.length === PAGE_SIZE);
          setPosts(rankVideos(fresh, { id: currentUserId ?? '', following: followedIds ?? [] }));
          setLoading(false);
        }).catch(() => setLoading(false));
      } else {
        const fresh = snap.docs.map(d => snapshotTo<VideoPost>(d));
        lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
        setHasMore(snap.docs.length === PAGE_SIZE);
        setPosts(rankVideos(fresh, { id: currentUserId ?? '', following: followedIds ?? [] }));
        setLoading(false);
      }
    }, () => {
      showToast('Failed to load feed', 'error');
      setLoading(false);
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
  const avatarColor = user?.avatarColor ?? ACCENT;

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#F8F7F4' }}>
      {/* Top bar */}
      <div style={{ background: '#FFFFFF', padding: '14px 18px 0', position: 'sticky', top: 0, zIndex: 20, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <LeafLogo />
          <div style={{ position: 'relative' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
        </div>

        {/* Stories row — shows followed users who have recent posts */}
        {(() => {
          const followed = new Set(followedIds ?? []);
          const seen = new Set<string>();
          const storyUsers = posts
            .filter(p => followed.has(p.userId) && !seen.has(p.userId) && !!seen.add(p.userId))
            .slice(0, 8)
            .map(p => ({ id: p.userId, name: p.username, color: p.userAvatarColor, src: p.userAvatarUrl }));
          if (storyUsers.length === 0) return null;
          return (
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0, cursor: 'pointer' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#F0EDE8', border: '1.5px dashed rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 15 }}>{initials}</div>
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, background: ACCENT, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </div>
                </div>
                <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>Your story</span>
              </div>
              {storyUsers.map(s => (
                <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0, cursor: 'pointer' }}>
                  <div style={{ width: 54, height: 54, borderRadius: '50%', border: `2.5px solid ${ACCENT}`, padding: 2, background: '#fff' }}>
                    {s.src
                      ? <img src={s.src} alt={s.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 18 }}>{s.name[0]?.toUpperCase()}</div>
                    }
                  </div>
                  <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 500, maxWidth: 54, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Tab pills */}
        <div style={{ display: 'flex', gap: 6, paddingBottom: 12, overflowX: 'auto' }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setActiveTab(i)} style={{
              padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0, border: 'none',
              background: i === activeTab ? ACCENT : 'transparent',
              color: i === activeTab ? '#FFFFFF' : '#6B7280',
            }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      {loading
        ? [0,1].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 16, margin: '10px 14px', overflow: 'hidden', height: 320, position: 'relative' }}>
              <VideoCardSkeleton />
            </div>
          ))
        : posts.length === 0
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: '60px 24px' }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill={ACCENT} opacity="0.3">
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-8 2S13 2 17 8z"/>
            </svg>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A' }}>Your feed awaits</h3>
            <p style={{ color: '#9CA3AF', fontSize: 14, maxWidth: 260 }}>Follow people and explore to fill your feed.</p>
          </div>
        )
        : (() => {
          const visiblePosts = posts.filter(p => !blockedIds.includes(p.userId));
          const displayPosts = activeTab === 1
            ? visiblePosts.filter(p => followedIds?.includes(p.userId))
            : activeTab === 2
            ? [...visiblePosts].sort((a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0))
            : visiblePosts;
          if (displayPosts.length === 0 && activeTab === 1) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: '60px 24px' }}>
                <div style={{ fontSize: 36 }}>👥</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>Follow people to see their posts</h3>
                <p style={{ color: '#9CA3AF', fontSize: 14 }}>Head to Explore to find people to follow.</p>
              </div>
            );
          }
          return displayPosts.map(post => (
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
          ));
        })()
      }

      {posts.length > 0 && (
        <div style={{ padding: '12px 0 8px', textAlign: 'center' }}>
          {loadingMore
            ? <span style={{ color: '#9CA3AF', fontSize: 13 }}>Loading more…</span>
            : hasMore
            ? <button onClick={loadMore} style={{ background: 'none', border: `1px solid ${ACCENT}`, color: ACCENT, borderRadius: 20, padding: '8px 20px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Load more</button>
            : <span style={{ color: '#9CA3AF', fontSize: 13 }}>You're all caught up ✓</span>
          }
        </div>
      )}
    </div>
  );
}
