'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { VideoPost } from '@/types';
import { Avatar } from '@/components/Avatar';
import { formatCount, timeAgo, haptic } from '@/lib/utils/cn';
import { isLikedBy, registerView, toggleLike, toggleSave } from '@/lib/firebase/videos';
import { createNotification } from '@/lib/firebase/notifications';
import { useAuthStore } from '@/stores/authStore';

interface VideoCardProps {
  post: VideoPost; isActive: boolean; currentUserId?: string;
  onComment: (id: string, ownerId: string, ownerUsername: string) => void;
  onShare: (p: VideoPost) => void;
  onViewProfile: (uid: string) => void;
  onFollow: (uid: string) => void;
  isFollowing?: boolean;
}

export function VideoCard({ post, isActive, currentUserId, onComment, onShare, onViewProfile, onFollow, isFollowing }: VideoCardProps) {
  const user = useAuthStore(s => s.user);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [saved, setSaved] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showFull, setShowFull] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const lastTap = useRef(0);
  const isImage = post.media?.kind === 'image' || !!post.images;

  useEffect(() => {
    if (!currentUserId) return;
    isLikedBy(post.id, currentUserId).then(setLiked).catch(() => {});
  }, [post.id, currentUserId]);

  useEffect(() => {
    const el = videoRef.current; if (!el) return;
    if (isActive && !paused) { el.muted = muted; el.play().catch(() => { el.muted = true; el.play().catch(() => {}); }); }
    else el.pause();
  }, [isActive, muted, paused]);

  useEffect(() => {
    if (!isActive || !currentUserId) return;
    const key = `viewed_${post.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    registerView(post.id).catch(() => {});
  }, [isActive, post.id, currentUserId]);

  // Progress bar for video
  useEffect(() => {
    const el = videoRef.current; if (!el || isImage) return;
    const update = () => setProgress(el.duration ? el.currentTime / el.duration : 0);
    el.addEventListener('timeupdate', update);
    return () => el.removeEventListener('timeupdate', update);
  }, [isImage]);

  const triggerLike = useCallback(async () => {
    if (!currentUserId || !user) return;
    const next = !liked;
    setLiked(next);
    setLikeCount(c => c + (next ? 1 : -1));
    haptic('medium');
    if (next) {
      setHeartAnim(true);
      setTimeout(() => setHeartAnim(false), 800);
      // Notify post owner
      await createNotification({
        userId: post.userId, fromUserId: user.id,
        fromUsername: user.username, fromAvatar: user.avatar,
        fromAvatarColor: user.avatarColor, fromAvatarUrl: user.avatarUrl,
        type: 'like', message: 'liked your video',
        videoId: post.id, videoUrl: post.media.url,
      }).catch(() => {});
    }
    try { await toggleLike(post.id, currentUserId, liked); }
    catch { setLiked(!next); setLikeCount(c => c + (next ? -1 : 1)); }
  }, [liked, currentUserId, post, user]);

  // Double tap to like
  const handleTap = useCallback((e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      triggerLike();
    } else {
      // Single tap = pause/resume
      setPaused(p => !p);
    }
    lastTap.current = now;
  }, [triggerLike]);

  const handleSave = async () => {
    if (!currentUserId) return;
    const next = !saved; setSaved(next); haptic();
    try { await toggleSave(post.id, currentUserId, saved); } catch { setSaved(!next); }
  };

  const handleShare = () => {
    setShowShareSheet(true);
    haptic('light');
  };

  const shareOptions = [
    { label: 'Copy Link', icon: '🔗', action: () => { navigator.clipboard?.writeText(`${window.location.origin}?v=${post.id}`).catch(() => {}); setShowShareSheet(false); } },
    { label: 'Share to Messages', icon: '💬', action: () => { setShowShareSheet(false); } },
    { label: 'Download', icon: '⬇️', action: () => { window.open(post.media.url, '_blank'); setShowShareSheet(false); } },
  ];

  const desc = post.description;
  const LIMIT = 80;

  return (
    <article style={{ position: 'absolute', inset: 0, background: 'black' }} onClick={handleTap}>
      {/* Media */}
      {isImage
  ? <img src={post.images?.[0] ?? post.media?.url ?? ''} alt={desc} style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy" />
  : <video ref={videoRef} src={post.media?.url ?? ''} loop playsInline muted={muted} style={{ width:'100%', height:'100%', objectFit:'cover' }} preload="metadata" />}

      {/* Gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.3) 100%)', pointerEvents: 'none' }} />

      {/* Paused indicator */}
      {paused && !isImage && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 60, opacity: 0.8, pointerEvents: 'none' }}>⏸️</div>
      )}

      {/* Double-tap heart animation */}
      {heartAnim && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 80, pointerEvents: 'none', animation: 'heartPop 0.8s ease-out forwards' }}>❤️</div>
      )}

      {/* Progress bar */}
      {!isImage && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.2)' }}>
          <div style={{ height: '100%', background: '#FF2156', width: `${progress * 100}%`, transition: 'width 0.1s linear' }} />
        </div>
      )}

      {/* Action buttons */}
      <div style={{ position: 'absolute', right: 10, bottom: 100, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
        {/* Like */}
        <button type="button" onClick={triggerLike}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'rgba(0,0,0,0.35)', borderRadius: 999, padding: '10px', border: 'none', cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
          <span style={{ fontSize: 26, transition: 'transform 0.15s', transform: liked ? 'scale(1.3)' : 'scale(1)' }}>{liked ? '❤️' : '🤍'}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: liked ? '#FF2156' : 'white' }}>{formatCount(likeCount)}</span>
        </button>

        {/* Comment */}
        <button type="button" onClick={() => onComment(post.id, post.userId, post.username)}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'rgba(0,0,0,0.35)', borderRadius: 999, padding: '10px', border: 'none', cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
          <span style={{ fontSize: 26 }}>💬</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>{formatCount(post.comments)}</span>
        </button>

        {/* Share */}
        <button type="button" onClick={handleShare}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'rgba(0,0,0,0.35)', borderRadius: 999, padding: '10px', border: 'none', cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
          <span style={{ fontSize: 26 }}>↗️</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>{formatCount(post.shares)}</span>
        </button>

        {/* Save */}
        <button type="button" onClick={handleSave}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'rgba(0,0,0,0.35)', borderRadius: 999, padding: '10px', border: 'none', cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
          <span style={{ fontSize: 26 }}>{saved ? '🔖' : '📌'}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: saved ? '#FFD60A' : 'white' }}>{saved ? 'Saved' : 'Save'}</span>
        </button>

        {/* Mute */}
        {isActive && !isImage && (
          <button type="button" onClick={() => setMuted(m => !m)}
            style={{ background: 'rgba(0,0,0,0.4)', border: 'none', color: 'white', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
            {muted ? '🔇' : '🔊'}
          </button>
        )}
      </div>

      {/* Bottom info */}
      <div style={{ position: 'absolute', bottom: 16, left: 12, right: 76 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Avatar name={post.username} color={post.userAvatarColor} src={post.userAvatarUrl} size="md" ring={post.userVerified} onClick={() => onViewProfile(post.userId)} />
          <button type="button" onClick={() => onViewProfile(post.userId)} style={{ background: 'none', border: 'none', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            @{post.username}
            {post.userVerified && <span style={{ fontSize: 14 }}>✅</span>}
          </button>
          {currentUserId !== post.userId && (
            <button type="button" onClick={() => onFollow(post.userId)}
              style={{ background: isFollowing ? 'rgba(255,255,255,0.15)' : 'rgba(255,33,86,0.9)', border: isFollowing ? '1px solid rgba(255,255,255,0.4)' : 'none', color: 'white', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              {isFollowing ? '✓ Following' : '+ Follow'}
            </button>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.4, margin: '0 0 4px' }}>
          {desc.length > LIMIT && !showFull ? desc.slice(0, LIMIT) + '…' : desc}
          {desc.length > LIMIT && (
            <button type="button" onClick={() => setShowFull(s => !s)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginLeft: 4 }}>
              {showFull ? 'less' : 'more'}
            </button>
          )}
        </p>
        {post.hashtags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
            {post.hashtags.slice(0, 4).map(t => <span key={t} style={{ fontSize: 12, fontWeight: 700, color: '#FF2156' }}>{t}</span>)}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>🎵 {post.song ?? 'Original sound'} · {timeAgo(post.createdAt)}</div>
      </div>

      {/* Share sheet */}
      {showShareSheet && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50 }} onClick={() => setShowShareSheet(false)}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#1C1C24', borderRadius: '20px 20px 0 0', padding: '16px 0 32px' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', fontWeight: 700, padding: '0 0 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }}>Share</div>
            {shareOptions.map(opt => (
              <button key={opt.label} onClick={opt.action} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: 'none', border: 'none', color: 'white', fontSize: 15, cursor: 'pointer' }}>
                <span style={{ fontSize: 22 }}>{opt.icon}</span>{opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes heartPop {
          0% { transform: translate(-50%,-50%) scale(0); opacity: 1; }
          50% { transform: translate(-50%,-50%) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1); opacity: 0; }
        }
      `}</style>
    </article>
  );
}
