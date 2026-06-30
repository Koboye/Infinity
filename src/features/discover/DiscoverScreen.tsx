'use client';
import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase/client';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { getIdToken } from '@/lib/firebase/auth';
import type { TrendingTopic } from '@/types';
import { trendingTags } from '@/lib/ai/trends';

const ACCENT = '#3D6B4F';
const ACCENT_LIGHT = '#EBF3EE';

const POPULAR_PLACES = [
  { name: 'Simen Mountains', gradient: 'linear-gradient(135deg, #3D6B4F, #5A9A6F)' },
  { name: 'Lalibela', gradient: 'linear-gradient(135deg, #8B6B4F, #B8956A)' },
  { name: 'Tana Lake', gradient: 'linear-gradient(135deg, #4F6B8B, #6B8BB8)' },
];

interface UserResult {
  id: string; username: string; avatarColor: string;
  avatarUrl: string | null; bio: string; verified: boolean;
  fullName?: string;
}

interface DiscoverScreenProps {
  onViewProfile?: (uid: string) => void;
}

export function DiscoverScreen({ onViewProfile }: DiscoverScreenProps) {
  const user = useAuthStore(s => s.user);
  const showToast = useUIStore(s => s.showToast);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserResult[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set(user?.following ?? []));
  const [searching, setSearching] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Sync followedIds with user store
  useEffect(() => {
    setFollowedIds(new Set(user?.following ?? []));
  }, [user?.following]);

  // Load suggested users (not already followed)
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(firebaseDb(), 'users'), limit(20)));
        const users = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as UserResult))
          .filter(u => u.id !== user?.id)
          .slice(0, 8);
        setSuggestedUsers(users);
      } catch {} finally { setLoadingUsers(false); }
    };
    load();
  }, [user?.id]);

  // Load trending topics from recent videos
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(firebaseDb(), 'videos'), where('moderationStatus', '==', 'approved'), orderBy('createdAt', 'desc'), limit(200)));
        const posts = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setTrendingTopics(trendingTags(posts, 5));
      } catch {}
    };
    load();
  }, []);

  const doSearch = async () => {
    const q = search.trim();
    if (!q) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Search failed');
      const { users } = await res.json() as { users: UserResult[] };
      setSearchResults(users);
    } catch { showToast('Search failed', 'error'); }
    finally { setSearching(false); }
  };

  const toggleFollow = async (target: UserResult) => {
    if (!user) return;
    const isFollowing = followedIds.has(target.id);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/users/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetId: target.id }),
      });
      if (!res.ok) throw new Error('follow failed');
      setFollowedIds(prev => {
        const next = new Set(prev);
        if (isFollowing) next.delete(target.id); else next.add(target.id);
        return next;
      });
      showToast(isFollowing ? 'Unfollowed' : 'Following! ✨', 'info');
    } catch { showToast('Could not update follow', 'error'); }
  };

  const displayUsers = search.trim() ? searchResults : suggestedUsers;

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#F8F7F4' }}>

      {/* Header */}
      <div style={{ background: '#FFFFFF', padding: '16px 18px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', margin: '0 0 12px' }}>Explore</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: '#F8F7F4', borderRadius: 12, padding: '10px 14px', border: '1px solid rgba(0,0,0,0.07)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search people, topics..."
              style={{ background: 'none', border: 'none', outline: 'none', flex: 1, fontSize: 14, color: '#1A1A1A' }}
            />
          </div>
          <button onClick={doSearch} style={{ background: ACCENT, border: 'none', color: '#fff', borderRadius: 12, padding: '0 16px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
            {searching ? '…' : 'Go'}
          </button>
        </div>
      </div>

      {/* Popular Places */}
      {!search.trim() && (
        <div style={{ padding: '18px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px 12px' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>Popular Places</span>
          </div>
          <div style={{ display: 'flex', gap: 10, padding: '0 18px', overflowX: 'auto' }}>
            {POPULAR_PLACES.map(p => (
              <div key={p.name} style={{
                width: 130, height: 90, borderRadius: 14, background: p.gradient,
                flexShrink: 0, display: 'flex', alignItems: 'flex-end', padding: '10px',
                cursor: 'pointer', position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', position: 'relative', zIndex: 1 }}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trending Now */}
      {!search.trim() && trendingTopics.length > 0 && (
        <div style={{ padding: '18px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px 12px' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>Trending Now</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 18px' }}>
            {trendingTopics.map(t => (
              <div key={t.tag} style={{
                background: '#FFFFFF', borderRadius: 12, padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
                border: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer', marginBottom: 6,
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🔥</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{t.tag}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{t.posts} posts · +{t.growth}% today</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* People Section */}
      <div style={{ padding: '18px 0 100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px 12px' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>
            {search.trim() ? `Results for "${search}"` : 'Suggested People'}
          </span>
        </div>

        {searching && (
          <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF' }}>Searching…</div>
        )}
        {!searching && search.trim() && searchResults.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF' }}>No users found for "{search}"</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 18px' }}>
          {displayUsers.map(u => (
            <div key={u.id} style={{
              background: '#FFFFFF', borderRadius: 14, padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              border: '1px solid rgba(0,0,0,0.06)',
              cursor: 'pointer',
            }}>
              {/* ✅ Click on avatar/name goes to profile */}
              <div 
                onClick={() => onViewProfile?.(u.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: u.avatarColor || ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                  {u.avatarUrl
                    ? <img src={u.avatarUrl} alt={u.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : u.username?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
                    {u.username}
                    {u.verified && <span style={{ marginLeft: 4, color: ACCENT }}>✓</span>}
                  </div>
                  {u.bio && <div style={{ fontSize: 12, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.bio}</div>}
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); toggleFollow(u); }} 
                style={{
                  padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  border: followedIds.has(u.id) ? `1.5px solid ${ACCENT}` : 'none',
                  background: followedIds.has(u.id) ? 'transparent' : ACCENT,
                  color: followedIds.has(u.id) ? ACCENT : '#fff',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                {followedIds.has(u.id) ? 'Following' : 'Follow'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
