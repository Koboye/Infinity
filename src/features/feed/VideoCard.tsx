'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { VideoPost } from '@/types';
import { Avatar } from '@/components/Avatar';
import { formatCount, timeAgo, haptic } from '@/lib/utils/cn';
import { isLikedBy, registerView, toggleSave } from '@/lib/firebase/videos';
import { getIdToken } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

const ACCENT = '#3D6B4F';

interface VideoCardProps {
  post: VideoPost; isActive: boolean; currentUserId?: string;
  onComment: (id: string, ownerId: string, ownerUsername: string) => void;
  onShare: (p: VideoPost) => void;
  onViewProfile: (uid: string) => void;
  onFollow: (uid: string) => void;
  isFollowing?: boolean;
  cardStyle?: 'card' | 'fullscreen';
}

export function VideoCard({ post, isActive, currentUserId, onComment, onShare, onViewProfile, onFollow, isFollowing, cardStyle = 'fullscreen' }: VideoCardProps) {
  const user = useAuthStore(s => s.user);
  const showToast = useUIStore(s => s.showToast);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [saved, setSaved] = useState(false);
  const [muted, setMuted] = useState(false); // Start with sound ON
  const [showFull, setShowFull] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const lastTap = useRef(0);
  const isImage = post.media?.kind === 'image' || !!post.images;

  useEffect(() => {
    if (!currentUserId) return;
    isLikedBy(post.id, currentUserId).then(setLiked).catch(() => {});
  }, [post.id, currentUserId]);

  // Auto-play with sound when active
  useEffect(() => {
    const el = videoRef.current;
    if (!el || cardStyle === 'card') return;
    
    if (isActive && !paused) {
      el.muted = muted;
      el.play().catch(() => {
        el.muted = true;
        el.play().catch(() => {});
      });
    } else {
      el.pause();
    }
  }, [isActive, muted, paused, cardStyle]);

  useEffect(() => {
    if (!isActive || !currentUserId) return;
    const key = `viewed_${post.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    registerView(post.id).catch(() => {});
  }, [isActive, post.id, currentUserId]);

  const triggerLike = useCallback(async () => {
    if (!currentUserId || !user) return;
    const next = !liked;
    setLiked(next); setLikeCount(c => c + (next ? 1 : -1)); haptic('medium');
    if (next) { setHeartAnim(true); setTimeout(() => setHeartAnim(false), 800); }
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/videos/${post.id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Like failed');
    }
    catch { setLiked(!next); setLikeCount(c => c + (next ? -1 : 1)); }
  }, [liked, currentUserId, post, user]);

  const handleDoubleTap = useCallback((e: React.MouseEvent) => {
    if (cardStyle === 'card') return;
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      triggerLike();
    } else {
      lastTap.current = now;
      setTimeout(() => {
        if (lastTap.current === now) {
          lastTap.current = 0;
          setPaused(p => !p);
        }
      }, 300);
    }
  }, [triggerLike, cardStyle]);

  const handleSave = async () => {
    if (!currentUserId) return;
    const next = !saved; setSaved(next); haptic();
    try { await toggleSave(post.id, currentUserId, saved); } catch { setSaved(!next); }
  };

  const desc = post.description;
  const LIMIT = 100;

  // ── CARD STYLE (light feed) ─────────────────────────────────────────────
  if (cardStyle === 'card') {
    return (
      <article style={{ background: '#FFFFFF', margin: '0 0 10px', borderTop: '1px solid rgba(0,0,0,0.05)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => onViewProfile(post.userId)}>
            <Avatar name={post.username} color={post.userAvatarColor} src={post.userAvatarUrl} size="sm" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.2 }}>
                {post.username}
                {post.userVerified && <span style={{ marginLeft: 4, color: ACCENT }}>✓</span>}
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>{timeAgo(post.createdAt)}</div>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(m => !m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>
            {showMenu && (
              <div style={{ position: 'absolute', right: 0, top: 24, background: '#FFFFFF', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.08)', zIndex: 50, minWidth: 160, overflow: 'hidden' }}>
                {currentUserId !== post.userId ? (
                  <>
                    {/* ✅ FIXED: Report uses API */}
                    <button onClick={async () => { 
                      setShowMenu(false); 
                      if (!currentUserId) return; 
                      try { 
                        const token = await getIdToken();
                        const res = await fetch('/api/reports', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({
                            postId: post.id,
                            reason: 'inappropriate',
                          }),
                        });
                        if (!res.ok) throw new Error('Report failed');
                        showToast('Reported. Thank you. 🚩', 'success'); 
                      } catch { 
                        showToast('Could not submit report', 'error'); 
                      } 
                    }} style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 14, cursor: 'pointer', color: '#1A1A1A', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      🚩 Report post
                    </button>
                    {/* ✅ FIXED: Block uses API */}
                    <button onClick={async () => { 
                      setShowMenu(false); 
                      if (!currentUserId) return; 
                      try { 
                        const token = await getIdToken();
                        const res = await fetch('/api/users/block', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({
                            userId: post.userId,
                          }),
                        });
                        if (!res.ok) throw new Error('Block failed');
                        showToast(`@${post.username} has been blocked. 🚫`, 'info'); 
                      } catch { 
                        showToast('Could not block user', 'error'); 
                      } 
                    }} style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 14, cursor: 'pointer', color: '#EF4444' }}>
                      🚫 Block @{post.username}
                    </button>
                  </>
                ) : (
                  <button onClick={() => setShowMenu(false)} style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 14, cursor: 'pointer', color: '#9CA3AF' }}>Close</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Text */}
        {desc && (
          <div style={{ padding: '0 16px 10px', fontSize: 15, color: '#1A1A1A', lineHeight: 1.55 }}>
            {showFull || desc.length <= LIMIT ? desc : desc.slice(0, LIMIT) + '…'}
            {desc.length > LIMIT && (
              <button onClick={() => setShowFull(f => !f)} style={{ background: 'none', border: 'none', color: ACCENT, fontSize: 13, cursor: 'pointer', fontWeight: 600, marginLeft: 4 }}>
                {showFull ? 'less' : 'more'}
              </button>
            )}
          </div>
        )}

        {/* Media */}
        {(post.media?.url || post.images?.[0]) && (
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', background: '#F0EFF4' }}>
            {isImage
              ? <img src={post.images?.[0] ?? post.media?.url ?? ''} alt={desc} style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy" />
              : (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <video 
                    ref={videoRef} 
                    src={post.media?.url ?? ''} 
                    loop 
                    playsInline 
                    muted={muted} 
                    autoPlay
                    style={{ width:'100%', height:'100%', objectFit:'cover' }} 
                    preload="auto"
                  />
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                    <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 3 }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px 12px', gap: 20 }}>
          <button onClick={triggerLike} style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none', cursor:'pointer', color: liked ? '#E24B4A' : '#6B7280', fontSize:13, fontWeight:500 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? '#E24B4A' : 'none'} stroke={liked ? '#E24B4A' : '#6B7280'} strokeWidth="1.8" strokeLinecap="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {formatCount(likeCount)}
          </button>

          <button onClick={() => onComment(post.id, post.userId, post.username)} style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none', cursor:'pointer', color:'#6B7280', fontSize:13, fontWeight:500 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {formatCount(post.comments)}
          </button>

          <button onClick={() => onShare(post)} style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none', cursor:'pointer', color:'#6B7280', fontSize:13, fontWeight:500 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 2 11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            {formatCount(post.shares)}
          </button>

          <button onClick={handleSave} style={{ marginLeft: 'auto', background:'none', border:'none', cursor:'pointer', color: saved ? ACCENT : '#9CA3AF' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? ACCENT : 'none'} stroke={saved ? ACCENT : '#9CA3AF'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </div>
      </article>
    );
  }

  // ── FULLSCREEN STYLE ─────────────────────────────────────────────────────
  return (
    <article style={{ position: 'absolute', inset: 0, background: 'black' }} onClick={handleDoubleTap}>
      {isImage
        ? <img src={post.images?.[0] ?? post.media?.url ?? ''} alt={desc} style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy" />
        : <video 
            ref={videoRef} 
            src={post.media?.url ?? ''} 
            loop 
            playsInline 
            muted={muted} 
            autoPlay
            style={{ width:'100%', height:'100%', objectFit:'cover' }} 
            preload="auto"
          />}
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.02) 45%, rgba(0,0,0,0.25) 100%)', pointerEvents:'none' }} />
      {paused && !isImage && (
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:60, height:60, borderRadius:'50%', background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        </div>
      )}
      {heartAnim && (
        <div style={{ position:'absolute', top:'50%', left:'50%', fontSize:80, pointerEvents:'none', animation:'heartPop 0.8s ease-out forwards' }}>❤️</div>
      )}
      <div style={{ position:'absolute', bottom:80, left:14, right:70 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, cursor:'pointer' }} onClick={e => { e.stopPropagation(); onViewProfile(post.userId); }}>
          <Avatar name={post.username} color={post.userAvatarColor} src={post.userAvatarUrl} size="sm" ring />
          <span style={{ color:'white', fontSize:14, fontWeight:700 }}>{post.username}</span>
          {!isFollowing && <button onClick={e => { e.stopPropagation(); onFollow(post.userId); }} style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', color:'white', borderRadius:999, padding:'3px 12px', fontSize:12, fontWeight:600, cursor:'pointer' }}>Follow</button>}
        </div>
        <p style={{ color:'rgba(255,255,255,0.9)', fontSize:14, lineHeight:1.5, margin:0 }}>
          {showFull || desc.length <= LIMIT ? desc : desc.slice(0, LIMIT) + '…'}
          {desc.length > LIMIT && (
            <button onClick={e => { e.stopPropagation(); setShowFull(f => !f); }} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:13 }}>
              {showFull ? ' less' : ' more'}
            </button>
          )}
        </p>
      </div>
      <div style={{ position:'absolute', right:10, bottom:90, display:'flex', flexDirection:'column', gap:6, alignItems:'center' }} onClick={e => e.stopPropagation()}>
        <button onClick={triggerLike} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'rgba(0,0,0,0.3)', borderRadius:999, padding:'10px', border:'none', cursor:'pointer', backdropFilter:'blur(8px)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill={liked ? '#E24B4A' : 'none'} stroke={liked ? '#E24B4A' : 'white'} strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span style={{ fontSize:11, fontWeight:700, color:'white' }}>{formatCount(likeCount)}</span>
        </button>
        <button onClick={() => onComment(post.id, post.userId, post.username)} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'rgba(0,0,0,0.3)', borderRadius:999, padding:'10px', border:'none', cursor:'pointer', backdropFilter:'blur(8px)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span style={{ fontSize:11, fontWeight:700, color:'white' }}>{formatCount(post.comments)}</span>
        </button>
        <button onClick={() => onShare(post)} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'rgba(0,0,0,0.3)', borderRadius:999, padding:'10px', border:'none', cursor:'pointer', backdropFilter:'blur(8px)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><polyline points="22 2 11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          <span style={{ fontSize:11, fontWeight:700, color:'white' }}>{formatCount(post.shares)}</span>
        </button>
        <button onClick={handleSave} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'rgba(0,0,0,0.3)', borderRadius:999, padding:'10px', border:'none', cursor:'pointer', backdropFilter:'blur(8px)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill={saved ? ACCENT : 'none'} stroke={saved ? ACCENT : 'white'} strokeWidth="1.8"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </button>
        {!isImage && (
          <button onClick={e => { e.stopPropagation(); setMuted(m => !m); }} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'rgba(0,0,0,0.3)', borderRadius:999, padding:'10px', border:'none', cursor:'pointer', backdropFilter:'blur(8px)' }}>
            {muted
              ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
            }
          </button>
        )}
      </div>
      <style>{`@keyframes heartPop { 0%{transform:translate(-50%,-50%) scale(0);opacity:1} 50%{transform:translate(-50%,-50%) scale(1.4);opacity:1} 100%{transform:translate(-50%,-50%) scale(1.1);opacity:0} }`}</style>
    </article>
  );
}
