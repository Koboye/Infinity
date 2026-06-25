'use client';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { signOutCurrent } from '@/lib/firebase/auth';
import { Avatar } from '@/components/Avatar';
import { fetchUserVideos } from '@/lib/firebase/videos';
import { useQuery } from '@tanstack/react-query';
import type { VideoPost } from '@/types';
import { formatCount } from '@/lib/utils/cn';

export function ProfileScreen() {
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);
  const showToast = useUIStore(s => s.showToast);
  const [tab, setTab] = useState<'posts'|'liked'>('posts');

  const { data: posts = [] } = useQuery<VideoPost[]>({
    queryKey: ['userVideos', user?.id],
    queryFn: () => user ? fetchUserVideos(user.id) : [],
    enabled: !!user,
  });

  const handleLogout = async () => {
    try { await signOutCurrent(); signOut(); showToast('Signed out', 'info'); }
    catch { showToast('Sign-out failed', 'error'); }
  };

  if (!user) return null;

  return (
    <div style={{ height:'100%', overflowY:'auto', background:'#0B0B0F' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:16, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <h1 style={{ fontSize:18, fontWeight:900 }}>@{user.username}</h1>
        <button onClick={handleLogout} style={{ background:'rgba(255,69,58,0.15)', border:'none', color:'#FF453A', borderRadius:12, padding:'8px 14px', cursor:'pointer', fontSize:13, fontWeight:600 }}>Sign out</button>
      </div>

      <div style={{ padding:'24px 16px', textAlign:'center' }}>
        <div style={{ margin:'0 auto', width:'fit-content' }}>
  <Avatar name={user.username} color={user.avatarColor} src={user.avatarUrl} size="xl" ring />
</div>
        <h2 style={{ fontSize:20, fontWeight:900, marginTop:12 }}>@{user.username}</h2>
        {user.fullName && <p style={{ color:'rgba(255,255,255,0.7)', marginTop:4 }}>{user.fullName}</p>}
        {user.bio && <p style={{ color:'rgba(255,255,255,0.5)', fontSize:14, marginTop:8 }}>{user.bio}</p>}

        <div style={{ display:'flex', justifyContent:'space-around', background:'rgba(255,255,255,0.04)', borderRadius:16, padding:16, margin:'16px 0', border:'1px solid rgba(255,255,255,0.06)' }}>
          {[['Posts', posts.length], ['Followers', user.followers.length], ['Following', user.following.length]].map(([label, val], i, arr) => (
            <div key={String(label)} style={{ textAlign:'center', flex:1, borderRight: i<arr.length-1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div style={{ fontSize:18, fontWeight:900 }}>{formatCount(Number(val))}</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', borderTop:'1px solid rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        {(['posts','liked'] as const).map(t => (
          <button key={t} onClick={()=>setTab(t)} style={{ flex:1, padding:'14px', background:'none', border:'none', borderBottom: tab===t ? '2px solid #FF2156' : '2px solid transparent', color: tab===t ? 'white' : 'rgba(255,255,255,0.4)', fontWeight:700, fontSize:14, cursor:'pointer', textTransform:'capitalize' }}>{t}</button>
        ))}
      </div>

      {posts.length === 0
        ? <div style={{ textAlign:'center', padding:'48px 24px', color:'rgba(255,255,255,0.4)' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🎬</div>
            <div style={{ fontSize:14 }}>No posts yet. Tap + to create!</div>
          </div>
        : <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:2, padding:2 }}>
            {posts.map(p => (
              <div key={p.id} style={{ position:'relative', aspectRatio:'9/16', background:'#1C1C24', overflow:'hidden' }}>
                {p.media.kind==='image'||p.images ? <img src={p.images?.[0]??p.media.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy" /> : <video src={p.media.url} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted />}
                <div style={{ position:'absolute', bottom:4, left:6, fontSize:10, fontWeight:700, background:'rgba(0,0,0,0.6)', padding:'2px 6px', borderRadius:4 }}>{formatCount(p.views)} 👁</div>
              </div>
            ))}
          </div>}
    </div>
  );
}
