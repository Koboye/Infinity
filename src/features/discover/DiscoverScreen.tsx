'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, orderBy, query, limit, where } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase/client';
import { snapshotTo } from '@/lib/firebase/converters';
import { trendingTags } from '@/lib/ai/trends';
import { Avatar } from '@/components/Avatar';
import { formatCount } from '@/lib/utils/cn';
import type { UserProfile, VideoPost } from '@/types';

function score(text: string, tokens: string[]): number {
  const lower = (text ?? '').toLowerCase();
  return tokens.filter(t => lower.includes(t)).length;
}

const TRENDING_TOPICS = [
  { icon: '🧠', name: 'Mindset', posts: '12.5K posts', color: '#EEE9FF' },
  { icon: '⚡', name: 'Productivity', posts: '8.7K posts', color: '#FEF3C7' },
  { icon: '💻', name: 'Tech', posts: '15.2K posts', color: '#ECFDF5' },
];

export function DiscoverScreen() {
  const [q, setQ] = useState('');
  const tokens = useMemo(() => q.toLowerCase().trim().split(/\s+/).filter(Boolean), [q]);

  const { data: videos = [] } = useQuery<VideoPost[]>({
    queryKey: ['discover-videos'],
    queryFn: async () => {
      const snap = await getDocs(query(collection(firebaseDb(), 'videos'), where('moderationStatus', '==', 'approved'), orderBy('createdAt','desc'), limit(50)));
      return snap.docs.map(d => snapshotTo<VideoPost>(d));
    },
  });

  const { data: users = [] } = useQuery<UserProfile[]>({
    queryKey: ['discover-users'],
    queryFn: async () => {
      const snap = await getDocs(query(collection(firebaseDb(), 'users'), limit(30)));
      return snap.docs.map(d => ({ ...(d.data() as UserProfile), id: d.id }));
    },
  });

  const trending = useMemo(() => trendingTags(videos, 8), [videos]);
  const rankedVideos = useMemo(() => !tokens.length ? videos.slice(0,12) : videos.map(v => ({ v, s: score(v.description,tokens)*2 + score(v.hashtags.join(' '),tokens)*3 })).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.v).slice(0,24), [videos, tokens]);
  const rankedUsers = useMemo(() => !tokens.length ? [] : users.map(u => ({ u, s: score(u.username,tokens) + score(u.bio??'',tokens) })).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.u).slice(0,10), [users, tokens]);

  return (
    <div style={{ height:'100%', overflowY:'auto', background:'#F5F5F7' }}>
      {/* Header */}
      <div style={{
        position:'sticky', top:0, zIndex:10,
        background:'rgba(245,245,247,0.97)', backdropFilter:'blur(20px)',
        padding:'16px 16px 12px',
        borderBottom:'1px solid rgba(0,0,0,0.05)',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <h1 style={{ fontSize:24, fontWeight:900, color:'#0D0D12', margin:0 }}>Explore</h1>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, background:'#FFFFFF', borderRadius:14, padding:'10px 14px', border:'1px solid rgba(0,0,0,0.06)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search videos, people, hashtags…" style={{ flex:1, background:'transparent', border:'none', color:'#0D0D12', fontSize:14, outline:'none' }} />
          {q && <button onClick={()=>setQ('')} style={{ background:'none', border:'none', color:'#9CA3AF', cursor:'pointer', fontSize:16, padding:0 }}>✕</button>}
        </div>
      </div>

      <div style={{ padding:'16px 12px 80px' }}>
        {/* Trending tags */}
        <div style={{ background:'#FFFFFF', borderRadius:20, padding:16, marginBottom:12, border:'1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight:700, fontSize:15, color:'#0D0D12', marginBottom:12 }}>📈 Trending</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {trending.length === 0
              ? TRENDING_TOPICS.map(t => (
                  <button key={t.name} onClick={()=>setQ(t.name.toLowerCase())}
                    style={{ background:t.color, border:'none', color:'#0D0D12', borderRadius:999, padding:'8px 14px', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                    {t.icon} {t.name} <span style={{ color:'#6B7280', fontWeight:500 }}>{t.posts}</span>
                  </button>
                ))
              : trending.map(t => (
                  <button key={t.tag} onClick={()=>setQ(t.tag.replace('#',''))}
                    style={{ background:'rgba(107,78,255,0.1)', border:'none', color:'#6B4EFF', borderRadius:999, padding:'8px 14px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                    {t.tag} <span style={{ color:'rgba(107,78,255,0.5)' }}>{t.posts}</span>
                  </button>
                ))
            }
          </div>
        </div>

        {/* Creators */}
        {!q && (
          <div style={{ background:'#FFFFFF', borderRadius:20, padding:16, marginBottom:12, border:'1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <span style={{ fontWeight:700, fontSize:15, color:'#0D0D12' }}>✨ Creators to follow</span>
              <button style={{ background:'none', border:'none', color:'#6B4EFF', fontSize:13, fontWeight:600, cursor:'pointer' }}>See all</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {users.slice(0,6).map(u => (
                <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <Avatar name={u.username} color={u.avatarColor} src={u.avatarUrl} size="md" />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:'#0D0D12' }}>@{u.username}</div>
                    <div style={{ fontSize:12, color:'#9CA3AF' }}>{formatCount(u.followers?.length ?? 0)} followers</div>
                  </div>
                  <button style={{ background:'rgba(107,78,255,0.1)', border:'none', color:'#6B4EFF', borderRadius:999, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>Follow</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search results: people */}
        {q && rankedUsers.length > 0 && (
          <div style={{ background:'#FFFFFF', borderRadius:20, padding:16, marginBottom:12, border:'1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#6B7280', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>People</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {rankedUsers.map(u => (
                <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <Avatar name={u.username} color={u.avatarColor} src={u.avatarUrl} size="md" />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:'#0D0D12' }}>@{u.username}</div>
                    <div style={{ fontSize:12, color:'#9CA3AF' }}>{formatCount(u.followers?.length ?? 0)} followers</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search results: videos grid */}
        {q && (
          <div style={{ background:'#FFFFFF', borderRadius:20, padding:16, border:'1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#6B7280', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Videos</div>
            {rankedVideos.length === 0
              ? <div style={{ textAlign:'center', color:'#9CA3AF', padding:40 }}>No results found</div>
              : <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {rankedVideos.map(v => (
                    <div key={v.id} style={{ position:'relative', aspectRatio:'9/16', borderRadius:16, overflow:'hidden', background:'#F5F5F7' }}>
                      {v.media.kind==='image'||v.images ? <img src={v.images?.[0]??v.media.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy" /> : <video src={v.media.url} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted />}
                      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', padding:8 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>@{v.username}</div>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}
      </div>
    </div>
  );
}
