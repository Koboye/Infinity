'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, orderBy, query, limit } from 'firebase/firestore';
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

export function DiscoverScreen() {
  const [q, setQ] = useState('');
  const tokens = useMemo(() => q.toLowerCase().trim().split(/\s+/).filter(Boolean), [q]);

  const { data: videos = [] } = useQuery<VideoPost[]>({
    queryKey: ['discover-videos'],
    queryFn: async () => {
      const snap = await getDocs(query(collection(firebaseDb(), 'videos'), orderBy('createdAt','desc'), limit(50)));
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
    <div style={{ height:'100%', overflowY:'auto', background:'#0B0B0F' }}>
      <div style={{ position:'sticky', top:0, zIndex:10, background:'rgba(11,11,15,0.97)', backdropFilter:'blur(20px)', padding:16, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <h1 style={{ fontSize:22, fontWeight:900, marginBottom:12 }}>Discover</h1>
        <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.06)', borderRadius:999, padding:'10px 16px' }}>
          <span>🔍</span>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search videos, people, hashtags…" style={{ flex:1, background:'transparent', border:'none', color:'white', fontSize:15, outline:'none' }} />
          {q && <button onClick={()=>setQ('')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:18 }}>✕</button>}
        </div>
      </div>

      <div style={{ padding:16 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>📈 Trending</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:24 }}>
          {trending.length === 0 ? <span style={{ fontSize:13, color:'rgba(255,255,255,0.3)' }}>No trends yet</span>
            : trending.map(t => <button key={t.tag} onClick={()=>setQ(t.tag.replace('#',''))} style={{ background:'rgba(255,33,86,0.1)', border:'none', color:'#FF2156', borderRadius:999, padding:'8px 14px', fontSize:13, fontWeight:700, cursor:'pointer' }}>{t.tag} <span style={{ color:'rgba(255,33,86,0.6)' }}>{t.posts}</span></button>)}
        </div>

        {!q && (
          <>
            <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>✨ Creators</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {users.slice(0,6).map(u => (
                <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(255,255,255,0.04)', borderRadius:16, padding:12 }}>
                  <Avatar name={u.username} color={u.avatarColor} src={u.avatarUrl} size="md" />
                  <div><div style={{ fontWeight:700, fontSize:14 }}>@{u.username}</div><div style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>{formatCount(u.followers.length)} followers</div></div>
                </div>
              ))}
            </div>
          </>
        )}

        {q && rankedUsers.length > 0 && (
          <>
            <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>People</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:24 }}>
              {rankedUsers.map(u => (
                <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(255,255,255,0.04)', borderRadius:16, padding:12 }}>
                  <Avatar name={u.username} color={u.avatarColor} src={u.avatarUrl} size="md" />
                  <div><div style={{ fontWeight:700, fontSize:14 }}>@{u.username}</div><div style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>{formatCount(u.followers.length)} followers</div></div>
                </div>
              ))}
            </div>
          </>
        )}

        {q && (
          <>
            <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>Videos</div>
            {rankedVideos.length === 0 ? <div style={{ textAlign:'center', color:'rgba(255,255,255,0.4)', padding:40 }}>No results found</div>
              : <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {rankedVideos.map(v => (
                    <div key={v.id} style={{ position:'relative', aspectRatio:'9/16', borderRadius:16, overflow:'hidden', background:'#1C1C24' }}>
                      {v.media.kind==='image'||v.images ? <img src={v.images?.[0]??v.media.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy" /> : <video src={v.media.url} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted />}
                      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', padding:8 }}>
                        <div style={{ fontSize:11, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>@{v.username}</div>
                      </div>
                    </div>
                  ))}
                </div>}
          </>
        )}
      </div>
    </div>
  );
}
