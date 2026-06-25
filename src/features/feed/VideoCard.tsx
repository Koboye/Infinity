'use client';
import { useEffect, useRef, useState } from 'react';
import type { VideoPost } from '@/types';
import { Avatar } from '@/components/Avatar';
import { formatCount, timeAgo } from '@/lib/utils/cn';
import { isLikedBy, registerView, toggleLike, toggleSave } from '@/lib/firebase/videos';

interface VideoCardProps {
  post: VideoPost; isActive: boolean; currentUserId?: string;
  onComment: (id: string) => void; onShare: (p: VideoPost) => void;
  onViewProfile: (uid: string) => void; onFollow: (uid: string) => void;
  isFollowing?: boolean;
}

export function VideoCard({ post, isActive, currentUserId, onComment, onShare, onViewProfile, onFollow, isFollowing }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showFull, setShowFull] = useState(false);
  const isImage = post.media.kind === 'image' || !!post.images;

  useEffect(() => {
    if (!currentUserId) return;
    isLikedBy(post.id, currentUserId).then(setLiked).catch(() => {});
  }, [post.id, currentUserId]);

  useEffect(() => {
    const el = videoRef.current; if (!el) return;
    if (isActive) { el.muted = muted; el.play().catch(() => { el.muted = true; el.play().catch(() => {}); }); }
    else el.pause();
  }, [isActive, muted]);

  useEffect(() => {
    if (!isActive || !currentUserId) return;
    const key = `viewed_${post.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    registerView(post.id).catch(() => {});
  }, [isActive, post.id, currentUserId]);

  const handleLike = async () => {
    if (!currentUserId) return;
    const next = !liked; setLiked(next);
    try { await toggleLike(post.id, currentUserId, liked); } catch { setLiked(!next); }
  };

  const handleSave = async () => {
    if (!currentUserId) return;
    const next = !saved; setSaved(next);
    try { await toggleSave(post.id, currentUserId, saved); } catch { setSaved(!next); }
  };

  const desc = post.description;
  const LIMIT = 100;

  return (
    <article style={{ position:'absolute', inset:0, background:'black' }}>
      {isImage
        ? <img src={post.images?.[0] ?? post.media.url} alt={desc} style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy" />
        : <video ref={videoRef} src={post.media.url} loop playsInline muted={muted} style={{ width:'100%', height:'100%', objectFit:'cover' }} preload="metadata" />}

      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.35) 100%)', pointerEvents:'none' }} />

      {/* Action buttons */}
      <div style={{ position:'absolute', right:12, bottom:20, display:'flex', flexDirection:'column', gap:6, alignItems:'center' }}>
        {[
          { label: formatCount(post.likes + (liked ? 0 : 0)), emoji: liked ? '❤️' : '🤍', action: handleLike, color: liked ? '#FF2156' : 'white' },
          { label: formatCount(post.comments), emoji: '💬', action: () => onComment(post.id), color: 'white' },
          { label: formatCount(post.shares), emoji: '↗️', action: () => onShare(post), color: 'white' },
          { label: saved ? 'Saved' : 'Save', emoji: saved ? '🔖' : '📌', action: handleSave, color: saved ? '#FFD60A' : 'white' },
        ].map(btn => (
          <button key={btn.label+btn.emoji} type="button" onClick={btn.action}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'rgba(0,0,0,0.3)', borderRadius:999, padding:'10px 10px', border:'none', cursor:'pointer', backdropFilter:'blur(4px)' }}>
            <span style={{ fontSize:24 }}>{btn.emoji}</span>
            <span style={{ fontSize:11, fontWeight:700, color: btn.color }}>{btn.label}</span>
          </button>
        ))}
        {isActive && !isImage && (
          <button type="button" onClick={() => setMuted(m=>!m)}
            style={{ background:'rgba(0,0,0,0.4)', border:'none', color:'white', borderRadius:'50%', width:36, height:36, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {muted ? '🔇' : '🔊'}
          </button>
        )}
      </div>

      {/* Bottom info */}
      <div style={{ position:'absolute', bottom:16, left:12, right:76 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
          <Avatar name={post.username} color={post.userAvatarColor} src={post.userAvatarUrl} size="md" ring={post.userVerified} onClick={() => onViewProfile(post.userId)} />
          <button type="button" onClick={() => onViewProfile(post.userId)} style={{ background:'none', border:'none', color:'white', fontWeight:700, fontSize:15, cursor:'pointer' }}>@{post.username}</button>
          {currentUserId !== post.userId && (
            <button type="button" onClick={() => onFollow(post.userId)}
              style={{ background: isFollowing ? 'rgba(255,255,255,0.15)' : 'rgba(255,33,86,0.9)', border: isFollowing ? '1px solid rgba(255,255,255,0.4)' : 'none', color:'white', borderRadius:999, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              {isFollowing ? 'Following' : '+ Follow'}
            </button>
          )}
        </div>
        <p style={{ fontSize:13, color:'rgba(255,255,255,0.9)', lineHeight:1.4, margin:0 }}>
          {desc.length > LIMIT && !showFull ? desc.slice(0, LIMIT) + '…' : desc}
          {desc.length > LIMIT && <button type="button" onClick={() => setShowFull(s=>!s)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.55)', fontWeight:700, fontSize:13, cursor:'pointer', marginLeft:4 }}>{showFull?'less':'more'}</button>}
        </p>
        {post.hashtags.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
            {post.hashtags.slice(0,4).map(t => <span key={t} style={{ fontSize:12, fontWeight:700, color:'#FF2156' }}>{t}</span>)}
          </div>
        )}
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:4 }}>🎵 {post.song ?? 'Original sound'} · {timeAgo(post.createdAt)}</div>
      </div>
    </article>
  );
}
