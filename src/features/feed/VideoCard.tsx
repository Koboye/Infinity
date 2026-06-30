'use client';
import {
  useEffect, useRef, useState, useCallback, useId, useMemo
} from 'react';
import type { VideoPost } from '@/types';
import { Avatar } from '@/components/Avatar';
import { formatCount, timeAgo, haptic } from '@/lib/utils/cn';
import { isLikedBy, registerView, toggleSave } from '@/lib/firebase/videos';
import { getIdToken } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

// ─── Constants ───────────────────────────────────────────────────────────────
const ACCENT       = '#3D6B4F';
const ACCENT_LIGHT = '#6EE7A0';
const ACCENT_RED   = '#E24B4A';
const DESC_LIMIT   = 120;
const DOUBLE_TAP_MS = 260;
const VIEW_THRESHOLD = 0.6;
const LONG_PRESS_MS  = 600;

// ─── Types ────────────────────────────────────────────────────────────────────
interface VideoCardProps {
  post: VideoPost;
  isActive: boolean;
  currentUserId?: string;
  onComment: (id: string, ownerId: string, ownerUsername: string) => void;
  onShare: (p: VideoPost) => void;
  onViewProfile: (uid: string) => void;
  onFollow: (uid: string) => void;
  isFollowing?: boolean;
  cardStyle?: 'card' | 'fullscreen';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function safeDesc(d: string | undefined | null): string { return d ?? ''; }

function isImagePost(post: VideoPost): boolean {
  return post.media?.kind === 'image' || (Array.isArray(post.images) && post.images.length > 0);
}

function getImages(post: VideoPost): string[] {
  if (Array.isArray(post.images) && post.images.length > 0) return post.images;
  if (post.media?.url) return [post.media.url];
  return [];
}

// ─── useLikeState hook ────────────────────────────────────────────────────────
function useLikeState(postId: string, initialCount: number, currentUserId?: string) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const server = useRef({ liked: false, count: initialCount });

  useEffect(() => {
    if (!currentUserId) return;
    isLikedBy(postId, currentUserId).then(v => {
      setLiked(v);
      server.current.liked = v;
    }).catch(() => {});
  }, [postId, currentUserId]);

  const toggle = useCallback(async (user: unknown) => {
    if (!currentUserId || !user) return;
    const next = !liked;
    setLiked(next);
    setCount(c => c + (next ? 1 : -1));
    haptic('medium');
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/videos/${postId}/like`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      server.current = { liked: next, count: server.current.count + (next ? 1 : -1) };
    } catch {
      setLiked(server.current.liked);
      setCount(server.current.count);
    }
  }, [liked, currentUserId, postId]);

  return { liked, count, toggle };
}

// ─── Component ────────────────────────────────────────────────────────────────
export function VideoCard({
  post, isActive, currentUserId,
  onComment, onShare, onViewProfile, onFollow,
  isFollowing, cardStyle = 'fullscreen',
}: VideoCardProps) {
  const user       = useAuthStore(s => s.user);
  const showToast  = useUIStore(s => s.showToast);

  // Refs
  const videoRef       = useRef<HTMLVideoElement>(null);
  const cardRef        = useRef<HTMLElement>(null);
  const menuRef        = useRef<HTMLDivElement>(null);
  const lastTapRef     = useRef(0);
  const tapTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewRegistered = useRef(false);
  const progressRaf    = useRef<number | null>(null);
  const rippleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Core state
  const { liked, count: likeCount, toggle: toggleLike } = useLikeState(post.id, post.likes, currentUserId);
  const [saved,       setSaved]       = useState(false);
  const [muted,       setMuted]       = useState(true);
  const [showFull,    setShowFull]    = useState(false);
  const [heartAnim,   setHeartAnim]   = useState(false);
  const [paused,      setPaused]      = useState(false);
  const [showMenu,    setShowMenu]    = useState(false);
  const [buffering,   setBuffering]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [duration,    setDuration]    = useState(0);

  // NEW: image carousel index
  const [imgIdx,      setImgIdx]      = useState(0);
  // NEW: ripple tap position
  const [ripple,      setRipple]      = useState<{x:number;y:number;key:number}|null>(null);
  // NEW: share sheet visible
  const [shareSheet,  setShareSheet]  = useState(false);
  // NEW: playback speed
  const [speed,       setSpeed]       = useState(1);
  const [showSpeed,   setShowSpeed]   = useState(false);
  // NEW: saved indicator pulse
  const [savePulse,   setSavePulse]   = useState(false);

  const desc      = safeDesc(post.description);
  const isImage   = isImagePost(post);
  const images    = useMemo(() => getImages(post), [post]);
  const menuId    = useId();

  // Hashtag extraction
  const hashtags  = useMemo(
    () => post.hashtags?.length ? post.hashtags : (desc.match(/#\w+/g) ?? []),
    [post.hashtags, desc]
  );

  // ── Video: play/pause ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el || cardStyle === 'card' || isImage) return;
    if (isActive && !paused) {
      el.muted = muted;
      el.play().catch(() => { el.muted = true; setMuted(true); el.play().catch(() => {}); });
    } else {
      el.pause();
    }
    return () => { if (progressRaf.current) cancelAnimationFrame(progressRaf.current); };
  }, [isActive, paused, cardStyle, isImage]);

  // ── Muted sync (no restart) ───────────────────────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (el) el.muted = muted;
  }, [muted]);

  // ── Speed sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (el) el.playbackRate = speed;
  }, [speed]);

  // ── Progress ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el || isImage || cardStyle === 'card') return;
    const onMeta = () => setDuration(el.duration || 0);
    const tick = () => {
      if (el.duration) setProgress(el.currentTime / el.duration);
      progressRaf.current = requestAnimationFrame(tick);
    };
    const onPlay  = () => { progressRaf.current = requestAnimationFrame(tick); };
    const onPause = () => { if (progressRaf.current) cancelAnimationFrame(progressRaf.current); };
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('play',  onPlay);
    el.addEventListener('pause', onPause);
    return () => {
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('play',  onPlay);
      el.removeEventListener('pause', onPause);
      if (progressRaf.current) cancelAnimationFrame(progressRaf.current);
    };
  }, [isImage, cardStyle]);

  // ── Buffering ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const on  = () => setBuffering(true);
    const off = () => setBuffering(false);
    el.addEventListener('waiting', on);
    el.addEventListener('canplay', off);
    el.addEventListener('playing', off);
    return () => { el.removeEventListener('waiting', on); el.removeEventListener('canplay', off); el.removeEventListener('playing', off); };
  }, []);

  // ── View registration ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId || viewRegistered.current) return;
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.intersectionRatio >= VIEW_THRESHOLD && !viewRegistered.current) {
        viewRegistered.current = true;
        registerView(post.id).catch(() => {});
        obs.disconnect();
      }
    }, { threshold: VIEW_THRESHOLD });
    obs.observe(el);
    return () => obs.disconnect();
  }, [post.id, currentUserId]);

  // ── Card-mode autoplay ────────────────────────────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el || cardStyle !== 'card') return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.muted = true; el.play().catch(() => {}); }
      else el.pause();
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [cardStyle]);

  // ── Outside click → close menu / share sheet ──────────────────────────────
  useEffect(() => {
    if (!showMenu && !shareSheet) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShareSheet(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showMenu, shareSheet]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleLike = useCallback(() => {
    if (!liked) {
      setHeartAnim(true);
      setTimeout(() => setHeartAnim(false), 950);
    }
    toggleLike(user);
  }, [liked, toggleLike, user]);

  // Long-press on save → save + pulse
  const handleSaveStart = useCallback(() => {
    longPressRef.current = setTimeout(async () => {
      if (!currentUserId) return;
      if (!saved) {
        setSaved(true);
        setSavePulse(true);
        haptic('heavy');
        setTimeout(() => setSavePulse(false), 700);
        try { await toggleSave(post.id, currentUserId, false); }
        catch { setSaved(false); }
      }
    }, LONG_PRESS_MS);
  }, [saved, currentUserId, post.id]);

  const handleSaveEnd = useCallback(() => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  }, []);

  const handleSave = useCallback(async () => {
    if (!currentUserId) return;
    const next = !saved;
    setSaved(next);
    haptic();
    if (next) { setSavePulse(true); setTimeout(() => setSavePulse(false), 700); }
    try { await toggleSave(post.id, currentUserId, saved); }
    catch { setSaved(!next); }
  }, [saved, currentUserId, post.id]);

  // Tap: double=like, single=pause — with ripple
  const handleTap = useCallback((e: React.MouseEvent) => {
    if (cardStyle === 'card') return;
    if ((e.target as HTMLElement).closest('[data-no-tap]')) return;

    const now = Date.now();
    const delta = now - lastTapRef.current;

    if (delta < DOUBLE_TAP_MS && delta > 0) {
      lastTapRef.current = 0;
      if (tapTimerRef.current) { clearTimeout(tapTimerRef.current); tapTimerRef.current = null; }
      // Ripple at tap position
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, key: now });
      if (rippleTimerRef.current) clearTimeout(rippleTimerRef.current);
      rippleTimerRef.current = setTimeout(() => setRipple(null), 700);
      handleLike();
    } else {
      lastTapRef.current = now;
      tapTimerRef.current = setTimeout(() => {
        if (lastTapRef.current === now) {
          tapTimerRef.current = null;
          setPaused(p => !p);
        }
      }, DOUBLE_TAP_MS);
    }
  }, [cardStyle, handleLike]);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const el = videoRef.current;
    if (!el || !duration) return;
    el.currentTime = Number(e.target.value) * duration;
    setProgress(Number(e.target.value));
  }, [duration]);

  const handleReport = useCallback(async () => {
    setShowMenu(false);
    if (!currentUserId) return;
    try {
      const token = await getIdToken();
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId: post.id, reason: 'inappropriate' }),
      });
      if (!res.ok) throw new Error();
      showToast('Reported. Thank you.', 'success');
    } catch { showToast('Could not submit report', 'error'); }
  }, [currentUserId, post.id, showToast]);

  const handleBlock = useCallback(async () => {
    setShowMenu(false);
    if (!currentUserId) return;
    try {
      const token = await getIdToken();
      const res = await fetch('/api/users/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: post.userId }),
      });
      if (!res.ok) throw new Error();
      showToast(`@${post.username} blocked.`, 'info');
    } catch { showToast('Could not block user', 'error'); }
  }, [currentUserId, post.userId, post.username, showToast]);

  // Copy link share
  const handleCopyLink = useCallback(() => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}?post=${post.id}`;
    navigator.clipboard?.writeText(url).then(() => showToast('Link copied! 🔗', 'success')).catch(() => showToast('Could not copy', 'error'));
    setShareSheet(false);
    onShare(post);
  }, [post, onShare, showToast]);

  // Native share fallback
  const handleNativeShare = useCallback(async () => {
    setShareSheet(false);
    if (navigator.share) {
      try {
        await navigator.share({ title: `@${post.username} on Infinity`, url: `${window.location.origin}?post=${post.id}` });
        onShare(post);
      } catch { /* user cancelled */ }
    } else {
      handleCopyLink();
    }
  }, [post, onShare, handleCopyLink]);

  // Format duration mm:ss
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ── CARD STYLE ────────────────────────────────────────────────────────────
  if (cardStyle === 'card') {
    return (
      <article ref={cardRef} style={{ background: '#fff', margin: '0 0 10px', borderTop: '1px solid rgba(0,0,0,0.05)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px 10px' }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            onClick={() => onViewProfile(post.userId)}>
            <Avatar name={post.username} color={post.userAvatarColor} src={post.userAvatarUrl} size="sm" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.2 }}>
                {post.username}
                {post.userVerified && <span style={{ marginLeft: 4, color: ACCENT }}>✓</span>}
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>{timeAgo(post.createdAt)}</div>
            </div>
          </button>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button aria-haspopup="true" aria-expanded={showMenu} aria-controls={menuId}
              onClick={() => setShowMenu(m => !m)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 6, borderRadius: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
              </svg>
            </button>
            {showMenu && (
              <div id={menuId} role="menu" style={{ position: 'absolute', right: 0, top: 30, background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid rgba(0,0,0,0.07)', zIndex: 50, minWidth: 170, overflow: 'hidden' }}>
                {currentUserId !== post.userId ? (
                  <>
                    <button role="menuitem" onClick={handleReport} style={menuItemSt('#1A1A1A', true)}>🚩 Report post</button>
                    <button role="menuitem" onClick={handleBlock}  style={menuItemSt('#EF4444', false)}>🚫 Block @{post.username}</button>
                  </>
                ) : (
                  <button role="menuitem" onClick={() => setShowMenu(false)} style={menuItemSt('#9CA3AF', false)}>Close</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {desc && (
          <div style={{ padding: '0 16px 10px', fontSize: 15, color: '#1A1A1A', lineHeight: 1.55 }}>
            {showFull || desc.length <= DESC_LIMIT ? desc : desc.slice(0, DESC_LIMIT) + '…'}
            {desc.length > DESC_LIMIT && (
              <button onClick={() => setShowFull(f => !f)} style={{ background: 'none', border: 'none', color: ACCENT, fontSize: 13, cursor: 'pointer', fontWeight: 600, marginLeft: 4 }}>
                {showFull ? 'less' : 'more'}
              </button>
            )}
          </div>
        )}

        {/* Hashtag pills */}
        {hashtags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 10px' }}>
            {hashtags.slice(0, 5).map(tag => (
              <span key={tag} style={{ fontSize: 12, color: ACCENT, background: 'rgba(61,107,79,0.08)', borderRadius: 20, padding: '3px 10px', fontWeight: 600, cursor: 'pointer' }}>
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}

        {/* Song */}
        {post.song && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px 10px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill={ACCENT} aria-hidden>
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            <span style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              {post.song}
            </span>
          </div>
        )}

        {/* Media — image carousel or video */}
        {images.length > 0 && (
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', background: '#F0EFF4' }}>
            {isImage ? (
              <>
                <img src={images[imgIdx]} alt={desc || 'Post'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                {images.length > 1 && (
                  <>
                    {/* Prev */}
                    {imgIdx > 0 && (
                      <button onClick={() => setImgIdx(i => i - 1)} style={carouselBtnSt('left')} aria-label="Previous image">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                    )}
                    {/* Next */}
                    {imgIdx < images.length - 1 && (
                      <button onClick={() => setImgIdx(i => i + 1)} style={carouselBtnSt('right')} aria-label="Next image">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    )}
                    {/* Dots */}
                    <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
                      {images.map((_, i) => (
                        <div key={i} onClick={() => setImgIdx(i)} style={{ width: i === imgIdx ? 16 : 6, height: 6, borderRadius: 3, background: i === imgIdx ? 'white' : 'rgba(255,255,255,0.5)', transition: 'width 0.2s', cursor: 'pointer' }} />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <video ref={videoRef} src={images[0]} loop playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} preload="metadata" />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 3 }} aria-hidden><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px 12px', gap: 20 }}>
          <ActionBtn onClick={handleLike} active={liked} activeColor={ACCENT_RED} label={formatCount(likeCount)}
            icon={<HeartIcon filled={liked} color={liked ? ACCENT_RED : '#6B7280'} />} />
          <ActionBtn onClick={() => onComment(post.id, post.userId, post.username)} label={formatCount(post.comments)}
            icon={<CommentIcon color="#6B7280" />} />
          <ActionBtn onClick={() => setShareSheet(s => !s)} label={formatCount(post.shares)}
            icon={<ShareIcon color="#6B7280" />} />
          <button onClick={handleSave} onPointerDown={handleSaveStart} onPointerUp={handleSaveEnd} onPointerLeave={handleSaveEnd}
            aria-label={saved ? 'Unsave' : 'Save'}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 4, transform: savePulse ? 'scale(1.35)' : 'scale(1)', transition: 'transform 0.2s' }}>
            <BookmarkIcon filled={saved} color={saved ? ACCENT : '#9CA3AF'} />
          </button>
        </div>

        {/* Share sheet */}
        {shareSheet && (
          <div ref={menuRef} style={{ margin: '0 16px 14px', background: '#F8F7F4', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.07)' }}>
            <button onClick={handleNativeShare} style={shareItemSt}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Share to…
            </button>
            <button onClick={handleCopyLink} style={{ ...shareItemSt, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Copy link
            </button>
          </div>
        )}
      </article>
    );
  }

  // ── FULLSCREEN STYLE ──────────────────────────────────────────────────────
  return (
    <article ref={cardRef} style={{ position: 'absolute', inset: 0, background: '#000', userSelect: 'none' }} onClick={handleTap}>

      {/* Media */}
      {isImage ? (
        <>
          <img src={images[imgIdx] ?? ''} alt={desc || 'Post'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          {images.length > 1 && (
            <>
              {imgIdx > 0 && (
                <button data-no-tap="true" onClick={e => { e.stopPropagation(); setImgIdx(i => i - 1); }} style={{ ...fsCarouselBtn, left: 12 }} aria-label="Previous">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
              )}
              {imgIdx < images.length - 1 && (
                <button data-no-tap="true" onClick={e => { e.stopPropagation(); setImgIdx(i => i + 1); }} style={{ ...fsCarouselBtn, right: 12 }} aria-label="Next">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              )}
              <div style={{ position: 'absolute', top: 52, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, pointerEvents: 'none' }}>
                {images.map((_, i) => (
                  <div key={i} style={{ width: i === imgIdx ? 20 : 6, height: 4, borderRadius: 2, background: i === imgIdx ? 'white' : 'rgba(255,255,255,0.45)', transition: 'width 0.2s' }} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <video ref={videoRef} src={images[0] ?? ''} loop playsInline muted={muted}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} preload="auto" />
      )}

      {/* Gradient scrim */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.3) 100%)', pointerEvents: 'none' }} />

      {/* Ripple on double-tap */}
      {ripple && (
        <div key={ripple.key} style={{
          position: 'absolute', left: ripple.x, top: ripple.y,
          width: 120, height: 120, marginLeft: -60, marginTop: -60,
          borderRadius: '50%', background: 'rgba(255,255,255,0.18)',
          animation: 'vcRipple 0.65s ease-out forwards',
          pointerEvents: 'none',
        }} />
      )}

      {/* Buffering spinner */}
      {buffering && !isImage && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
          <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden>
            <circle cx="23" cy="23" r="19" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3"/>
            <circle cx="23" cy="23" r="19" fill="none" stroke="white" strokeWidth="3"
              strokeDasharray="30 90" strokeLinecap="round"
              style={{ transformOrigin: '50% 50%', animation: 'vcSpin 0.85s linear infinite' }}/>
          </svg>
        </div>
      )}

      {/* Pause indicator */}
      {paused && !isImage && !buffering && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 62, height: 62, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', animation: 'vcFadeIn 0.15s ease' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden>
            <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
          </svg>
        </div>
      )}

      {/* Heart burst */}
      {heartAnim && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', fontSize: 88, pointerEvents: 'none', animation: 'vcHeartPop 0.95s ease-out forwards', filter: 'drop-shadow(0 2px 16px rgba(226,75,74,0.55))' }} aria-hidden>❤️</div>
      )}

      {/* ── Bottom info ── */}
      <div data-no-tap="true" style={{ position: 'absolute', bottom: 86, left: 14, right: 82 }}>
        {/* User row */}
        <button style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); onViewProfile(post.userId); }}>
          <Avatar name={post.username} color={post.userAvatarColor} src={post.userAvatarUrl} size="sm" ring />
          <span style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>
            {post.username}
            {post.userVerified && <span style={{ marginLeft: 4, color: ACCENT_LIGHT }}>✓</span>}
          </span>
          {!isFollowing && (
            <button onClick={e => { e.stopPropagation(); onFollow(post.userId); }}
              style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.35)', color: 'white', borderRadius: 999, padding: '3px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(6px)' }}>
              Follow
            </button>
          )}
        </button>

        {/* Description */}
        {desc && (
          <p style={{ color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 1.55, margin: '0 0 8px' }}>
            {showFull || desc.length <= DESC_LIMIT ? desc : desc.slice(0, DESC_LIMIT) + '…'}
            {desc.length > DESC_LIMIT && (
              <button onClick={e => { e.stopPropagation(); setShowFull(f => !f); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: 13 }}>
                {showFull ? ' less' : ' more'}
              </button>
            )}
          </p>
        )}

        {/* Hashtag pills */}
        {hashtags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {hashtags.slice(0, 4).map(tag => (
              <span key={tag} style={{ fontSize: 11, color: ACCENT_LIGHT, background: 'rgba(110,231,160,0.12)', borderRadius: 20, padding: '2px 9px', fontWeight: 600 }}>
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}

        {/* Song ticker */}
        {post.song && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill={ACCENT_LIGHT} aria-hidden>
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            <div style={{ overflow: 'hidden', maxWidth: 200 }}>
              <span style={{ display: 'inline-block', fontSize: 12, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', whiteSpace: 'nowrap', animation: post.song.length > 28 ? 'vcTicker 8s linear infinite' : 'none' }}>
                {post.song}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Progress + time */}
      {!isImage && (
        <div data-no-tap="true" style={{ position: 'absolute', bottom: 68, left: 0, right: 0, padding: '0 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{fmtTime(progress * duration)}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{fmtTime(duration)}</span>
          </div>
          <div style={{ position: 'relative', height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }}>
            <div style={{ height: '100%', borderRadius: 2, background: 'white', width: `${progress * 100}%`, transition: 'width 0.1s linear' }} />
            <input type="range" min={0} max={1} step={0.001} value={progress} onChange={handleScrub}
              aria-label="Seek video"
              style={{ position: 'absolute', inset: '-8px 0', width: '100%', opacity: 0, cursor: 'pointer' }} />
          </div>
        </div>
      )}

      {/* Side actions */}
      <div data-no-tap="true" style={{ position: 'absolute', right: 10, bottom: 86, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>

        {/* Like */}
        <FSBtn onClick={handleLike} label={formatCount(likeCount)} ariaLabel={liked ? 'Unlike' : 'Like'}>
          <HeartIcon filled={liked} color={liked ? ACCENT_RED : 'white'} size={24} />
        </FSBtn>

        {/* Comment */}
        <FSBtn onClick={() => onComment(post.id, post.userId, post.username)} label={formatCount(post.comments)} ariaLabel="Comments">
          <CommentIcon color="white" size={24} />
        </FSBtn>

        {/* Share */}
        <FSBtn onClick={() => setShareSheet(s => !s)} label={formatCount(post.shares)} ariaLabel="Share">
          <ShareIcon color="white" size={24} />
        </FSBtn>

        {/* Save — long-press support */}
        <FSBtn onClick={handleSave} ariaLabel={saved ? 'Unsave' : 'Save (long-press to save fast)'}
          onPointerDown={handleSaveStart} onPointerUp={handleSaveEnd} onPointerLeave={handleSaveEnd}
          extraStyle={{ transform: savePulse ? 'scale(1.3)' : 'scale(1)', transition: 'transform 0.2s' }}>
          <BookmarkIcon filled={saved} color={saved ? ACCENT_LIGHT : 'white'} size={24} />
        </FSBtn>

        {/* Mute */}
        {!isImage && (
          <FSBtn onClick={() => setMuted(m => !m)} ariaLabel={muted ? 'Unmute' : 'Mute'}>
            {muted ? <MutedIcon /> : <UnmutedIcon />}
          </FSBtn>
        )}

        {/* Speed */}
        {!isImage && (
          <div style={{ position: 'relative' }}>
            <FSBtn onClick={() => setShowSpeed(s => !s)} ariaLabel="Playback speed">
              <span style={{ fontSize: 11, fontWeight: 800, color: speed !== 1 ? ACCENT_LIGHT : 'white', lineHeight: 1 }}>{speed}×</span>
            </FSBtn>
            {showSpeed && (
              <div style={{ position: 'absolute', right: 48, top: 0, background: 'rgba(20,20,20,0.95)', borderRadius: 10, overflow: 'hidden', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {[0.5, 1, 1.5, 2].map(s => (
                  <button key={s} onClick={() => { setSpeed(s); setShowSpeed(false); }}
                    style={{ display: 'block', width: '100%', padding: '9px 18px', background: 'none', border: 'none', cursor: 'pointer', color: speed === s ? ACCENT_LIGHT : 'white', fontSize: 13, fontWeight: speed === s ? 700 : 400, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {s}×
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Share sheet overlay */}
      {shareSheet && (
        <div data-no-tap="true" ref={menuRef} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(18,18,18,0.97)', backdropFilter: 'blur(20px)', borderRadius: '20px 20px 0 0', padding: '16px 0 32px', animation: 'vcSlideUp 0.22s ease', zIndex: 40 }}
          onClick={e => e.stopPropagation()}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Share</p>
          <button onClick={handleNativeShare} style={fsShareItemSt}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT_LIGHT} strokeWidth="1.8" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Share to app
          </button>
          <button onClick={handleCopyLink} style={{ ...fsShareItemSt, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT_LIGHT} strokeWidth="1.8" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Copy link
          </button>
          <button onClick={() => setShareSheet(false)} style={{ ...fsShareItemSt, borderTop: '1px solid rgba(255,255,255,0.07)', color: '#EF4444' }}>
            Cancel
          </button>
        </div>
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes vcHeartPop  { 0%{transform:translate(-50%,-50%) scale(0);opacity:1} 50%{transform:translate(-50%,-50%) scale(1.5);opacity:1} 100%{transform:translate(-50%,-50%) scale(1.1);opacity:0} }
        @keyframes vcSpin      { to{transform:rotate(360deg)} }
        @keyframes vcFadeIn    { from{opacity:0} to{opacity:1} }
        @keyframes vcRipple    { 0%{transform:scale(0);opacity:1} 100%{transform:scale(2.8);opacity:0} }
        @keyframes vcSlideUp   { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes vcTicker    { 0%,20%{transform:translateX(0)} 80%,100%{transform:translateX(-60%)} }
        @media (prefers-reduced-motion: reduce) {
          *{animation:none!important;transition:none!important}
        }
      `}</style>
    </article>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────
function menuItemSt(color: string, border: boolean): React.CSSProperties {
  return { width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: border ? '1px solid rgba(0,0,0,0.05)' : 'none', textAlign: 'left', fontSize: 14, cursor: 'pointer', color };
}
function carouselBtnSt(side: 'left'|'right'): React.CSSProperties {
  return { position: 'absolute', top: '50%', [side]: 8, transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', zIndex: 2 };
}
const fsCarouselBtn: React.CSSProperties = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', zIndex: 5, backdropFilter: 'blur(6px)' };
const shareItemSt: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#1A1A1A', textAlign: 'left' };
const fsShareItemSt: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 22px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'white', textAlign: 'left' };

// ─── Sub-components ───────────────────────────────────────────────────────────
function ActionBtn({ onClick, active, activeColor, label, icon, ariaLabel }: {
  onClick: () => void; active?: boolean; activeColor?: string; label?: string; icon: React.ReactNode; ariaLabel?: string;
}) {
  return (
    <button onClick={onClick} aria-label={ariaLabel}
      style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: active ? activeColor : '#6B7280', fontSize: 13, fontWeight: 500, padding: 4 }}>
      {icon}{label}
    </button>
  );
}

function FSBtn({ onClick, label, ariaLabel, children, onPointerDown, onPointerUp, onPointerLeave, extraStyle }: {
  onClick: () => void; label?: string; ariaLabel?: string; children: React.ReactNode;
  onPointerDown?: () => void; onPointerUp?: () => void; onPointerLeave?: () => void;
  extraStyle?: React.CSSProperties;
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerLeave}
      aria-label={ariaLabel}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'rgba(0,0,0,0.32)', borderRadius: 999, padding: 10, border: 'none', cursor: 'pointer', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', ...extraStyle }}>
      {children}
      {label && <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>{label}</span>}
    </button>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function HeartIcon({ filled, color, size = 18 }: { filled: boolean; color: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
}
function CommentIcon({ color, size = 18 }: { color: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}
function ShareIcon({ color, size = 18 }: { color: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="22 2 11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
}
function BookmarkIcon({ filled, color, size = 18 }: { filled: boolean; color: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>;
}
function MutedIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" aria-hidden><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>;
}
function UnmutedIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" aria-hidden><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>;
}
