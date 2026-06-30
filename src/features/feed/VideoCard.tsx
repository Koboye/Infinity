'use client';
import {
  useEffect, useRef, useState, useCallback, useId
} from 'react';
import type { VideoPost } from '@/types';
import { Avatar } from '@/components/Avatar';
import { formatCount, timeAgo, haptic } from '@/lib/utils/cn';
import { isLikedBy, registerView, toggleSave } from '@/lib/firebase/videos';
import { getIdToken } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

// ─── Constants ──────────────────────────────────────────────────────────────
const ACCENT = '#3D6B4F';
const ACCENT_RED = '#E24B4A';
const DESC_LIMIT = 100;
const DOUBLE_TAP_MS = 280;
const VIEW_THRESHOLD = 0.6; // 60% visibility to count a view

// ─── Types ───────────────────────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function safeDesc(desc: string | undefined | null): string {
  return desc ?? '';
}

function isImagePost(post: VideoPost): boolean {
  return post.media?.kind === 'image' || (Array.isArray(post.images) && post.images.length > 0);
}

function getMediaUrl(post: VideoPost): string {
  return (Array.isArray(post.images) && post.images.length > 0)
    ? post.images[0]
    : post.media?.url ?? '';
}

// Stable server-sync like count: rollback uses a ref to server state
function useLikeState(initialLiked: boolean, initialCount: number, postId: string, currentUserId?: string) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  // Tracks last known-good server state to rollback accurately
  const serverState = useRef({ liked: initialLiked, count: initialCount });

  useEffect(() => {
    if (!currentUserId) return;
    isLikedBy(postId, currentUserId)
      .then(v => {
        setLiked(v);
        serverState.current.liked = v;
      })
      .catch(() => {});
  }, [postId, currentUserId]);

  const toggle = useCallback(async (user: unknown) => {
    if (!currentUserId || !user) return;
    const optimisticLiked = !liked;
    // Optimistic update
    setLiked(optimisticLiked);
    setCount(c => c + (optimisticLiked ? 1 : -1));
    haptic('medium');
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/videos/${postId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Like failed');
      // Commit: update server state ref
      serverState.current = {
        liked: optimisticLiked,
        count: serverState.current.count + (optimisticLiked ? 1 : -1),
      };
    } catch {
      // Rollback to last known-good server state
      setLiked(serverState.current.liked);
      setCount(serverState.current.count);
    }
  }, [liked, currentUserId, postId]);

  return { liked, count, toggle };
}

// ─── Component ───────────────────────────────────────────────────────────────
export function VideoCard({
  post, isActive, currentUserId,
  onComment, onShare, onViewProfile, onFollow,
  isFollowing, cardStyle = 'fullscreen',
}: VideoCardProps) {
  const user = useAuthStore(s => s.user);
  const showToast = useUIStore(s => s.showToast);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewRegistered = useRef(false);

  // ── State ────────────────────────────────────────────────────────────────
  const { liked, count: likeCount, toggle: toggleLike } = useLikeState(
    false, post.likes, post.id, currentUserId
  );
  const [saved, setSaved] = useState(false);
  // Start muted — unmuted autoplay is blocked by browsers; icon reflects reality
  const [muted, setMuted] = useState(true);
  const [showFull, setShowFull] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  // Video buffering state
  const [buffering, setBuffering] = useState(false);
  // Progress bar for fullscreen
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const desc = safeDesc(post.description);
  const isImage = isImagePost(post);
  const mediaUrl = getMediaUrl(post);
  const menuId = useId();

  // ── Video: play/pause based on isActive + paused ─────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el || cardStyle === 'card' || isImage) return;

    if (isActive && !paused) {
      el.muted = muted;
      const play = el.play();
      play?.catch(() => {
        // Browser blocked unmuted autoplay — mute and retry silently
        el.muted = true;
        setMuted(true);
        el.play().catch(() => {});
      });
    } else {
      el.pause();
    }

    return () => {
      // Cancel any pending animation frame on unmount/deactivate
      if (progressRef.current) cancelAnimationFrame(progressRef.current);
    };
  }, [isActive, paused, cardStyle, isImage]); // intentionally omit muted — handled via el.muted directly

  // ── Sync muted state to video element without restarting playback ────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = muted;
  }, [muted]);

  // ── Progress tracking ────────────────────────────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el || isImage || cardStyle === 'card') return;

    const onMeta = () => setDuration(el.duration || 0);
    const tick = () => {
      if (el.duration) setProgress(el.currentTime / el.duration);
      progressRef.current = requestAnimationFrame(tick);
    };

    el.addEventListener('loadedmetadata', onMeta);
    const onPlay = () => { progressRef.current = requestAnimationFrame(tick); };
    const onPause = () => { if (progressRef.current) cancelAnimationFrame(progressRef.current); };
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);

    return () => {
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      if (progressRef.current) cancelAnimationFrame(progressRef.current);
    };
  }, [isImage, cardStyle]);

  // ── View registration via IntersectionObserver ───────────────────────────
  useEffect(() => {
    if (!currentUserId || viewRegistered.current) return;
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= VIEW_THRESHOLD && !viewRegistered.current) {
          viewRegistered.current = true;
          registerView(post.id).catch(() => {});
          observer.disconnect();
        }
      },
      { threshold: VIEW_THRESHOLD }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [post.id, currentUserId]);

  // ── IntersectionObserver for card-mode video autoplay ────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el || cardStyle !== 'card') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.muted = true;
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cardStyle]);

  // ── Close menu on outside click ──────────────────────────────────────────
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  // ── Buffering indicator ──────────────────────────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onWaiting = () => setBuffering(true);
    const onCanPlay = () => setBuffering(false);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('playing', onCanPlay);
    return () => {
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('playing', onCanPlay);
    };
  }, []);

  // ── Like with heart animation ────────────────────────────────────────────
  const handleLike = useCallback(() => {
    if (!liked) {
      setHeartAnim(true);
      setTimeout(() => setHeartAnim(false), 900);
    }
    toggleLike(user);
  }, [liked, toggleLike, user]);

  // ── Double-tap: like / single-tap: pause — no race condition ─────────────
  const handleTap = useCallback((e: React.MouseEvent) => {
    if (cardStyle === 'card') return;
    // Ignore taps that originate from action buttons/overlays
    if ((e.target as HTMLElement).closest('[data-no-tap]')) return;

    const now = Date.now();
    const delta = now - lastTapRef.current;

    if (delta < DOUBLE_TAP_MS && delta > 0) {
      // Double tap → like
      lastTapRef.current = 0;
      if (tapTimerRef.current) { clearTimeout(tapTimerRef.current); tapTimerRef.current = null; }
      handleLike();
    } else {
      lastTapRef.current = now;
      tapTimerRef.current = setTimeout(() => {
        tapTimerRef.current = null;
        if (lastTapRef.current === now) {
          // Single tap → toggle pause
          setPaused(p => !p);
        }
      }, DOUBLE_TAP_MS);
    }
  }, [cardStyle, handleLike]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!currentUserId) return;
    const next = !saved;
    setSaved(next);
    haptic();
    try {
      await toggleSave(post.id, currentUserId, saved);
    } catch {
      setSaved(!next);
    }
  }, [saved, currentUserId, post.id]);

  // ── Report ───────────────────────────────────────────────────────────────
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
    } catch {
      showToast('Could not submit report', 'error');
    }
  }, [currentUserId, post.id, showToast]);

  // ── Block ────────────────────────────────────────────────────────────────
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
    } catch {
      showToast('Could not block user', 'error');
    }
  }, [currentUserId, post.userId, post.username, showToast]);

  // ── Progress bar scrub ────────────────────────────────────────────────────
  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const el = videoRef.current;
    if (!el || !duration) return;
    const t = Number(e.target.value) * duration;
    el.currentTime = t;
    setProgress(Number(e.target.value));
  }, [duration]);

  // ─────────────────────────────────────────────────────────────────────────
  // CARD STYLE
  // ─────────────────────────────────────────────────────────────────────────
  if (cardStyle === 'card') {
    return (
      <article
        ref={cardRef}
        style={{
          background: '#FFFFFF',
          margin: '0 0 10px',
          borderTop: '1px solid rgba(0,0,0,0.05)',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px 10px' }}>
          <button
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
            onClick={() => onViewProfile(post.userId)}
          >
            <Avatar name={post.username} color={post.userAvatarColor} src={post.userAvatarUrl} size="sm" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.2 }}>
                {post.username}
                {post.userVerified && <span style={{ marginLeft: 4, color: ACCENT }}>✓</span>}
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>{timeAgo(post.createdAt)}</div>
            </div>
          </button>

          {/* ── Context menu ── */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              aria-haspopup="true"
              aria-expanded={showMenu}
              aria-controls={menuId}
              onClick={() => setShowMenu(m => !m)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 6, borderRadius: 6 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
              </svg>
            </button>
            {showMenu && (
              <div
                id={menuId}
                role="menu"
                style={{
                  position: 'absolute', right: 0, top: 30,
                  background: '#FFFFFF', borderRadius: 12,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                  border: '1px solid rgba(0,0,0,0.07)',
                  zIndex: 50, minWidth: 170, overflow: 'hidden',
                }}
              >
                {currentUserId !== post.userId ? (
                  <>
                    <button role="menuitem" onClick={handleReport} style={menuItemStyle('#1A1A1A', true)}>
                      🚩 Report post
                    </button>
                    <button role="menuitem" onClick={handleBlock} style={menuItemStyle('#EF4444', false)}>
                      🚫 Block @{post.username}
                    </button>
                  </>
                ) : (
                  <button role="menuitem" onClick={() => setShowMenu(false)} style={menuItemStyle('#9CA3AF', false)}>
                    Close
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Description ── */}
        {desc && (
          <div style={{ padding: '0 16px 10px', fontSize: 15, color: '#1A1A1A', lineHeight: 1.55 }}>
            {showFull || desc.length <= DESC_LIMIT ? desc : desc.slice(0, DESC_LIMIT) + '…'}
            {desc.length > DESC_LIMIT && (
              <button
                onClick={() => setShowFull(f => !f)}
                style={{ background: 'none', border: 'none', color: ACCENT, fontSize: 13, cursor: 'pointer', fontWeight: 600, marginLeft: 4 }}
              >
                {showFull ? 'less' : 'more'}
              </button>
            )}
          </div>
        )}

        {/* ── Media ── */}
        {mediaUrl && (
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', background: '#F0EFF4' }}>
            {isImage ? (
              <img
                src={mediaUrl}
                alt={desc || 'Post image'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loading="lazy"
              />
            ) : (
              <video
                ref={videoRef}
                src={mediaUrl}
                loop
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                preload="metadata"
              />
            )}
          </div>
        )}

        {/* ── Actions ── */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px 12px', gap: 20 }}>
          <ActionBtn
            onClick={handleLike}
            active={liked}
            activeColor={ACCENT_RED}
            label={formatCount(likeCount)}
            icon={<HeartIcon filled={liked} color={liked ? ACCENT_RED : '#6B7280'} />}
          />
          <ActionBtn
            onClick={() => onComment(post.id, post.userId, post.username)}
            label={formatCount(post.comments)}
            icon={<CommentIcon color="#6B7280" />}
          />
          <ActionBtn
            onClick={() => onShare(post)}
            label={formatCount(post.shares)}
            icon={<ShareIcon color="#6B7280" />}
          />
          <button
            onClick={handleSave}
            aria-label={saved ? 'Unsave post' : 'Save post'}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <BookmarkIcon filled={saved} color={saved ? ACCENT : '#9CA3AF'} />
          </button>
        </div>
      </article>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FULLSCREEN STYLE
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <article
      ref={cardRef}
      style={{ position: 'absolute', inset: 0, background: 'black', userSelect: 'none' }}
      onClick={handleTap}
    >
      {/* ── Media ── */}
      {isImage ? (
        <img
          src={mediaUrl}
          alt={desc || 'Post'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
        />
      ) : (
        <video
          ref={videoRef}
          src={mediaUrl}
          loop
          playsInline
          muted={muted}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          preload="auto"
        />
      )}

      {/* ── Gradient scrim ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.28) 100%)',
        pointerEvents: 'none',
      }} />

      {/* ── Buffering spinner ── */}
      {buffering && !isImage && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          pointerEvents: 'none',
        }}>
          <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
            <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3"/>
            <circle
              cx="22" cy="22" r="18"
              fill="none" stroke="white" strokeWidth="3"
              strokeDasharray="28 84"
              strokeLinecap="round"
              style={{ transformOrigin: '50% 50%', animation: 'vcSpin 0.9s linear infinite' }}
            />
          </svg>
        </div>
      )}

      {/* ── Pause indicator ── */}
      {paused && !isImage && !buffering && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 60, height: 60, borderRadius: '50%',
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
          animation: 'vcFadeIn 0.15s ease',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden>
            <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
          </svg>
        </div>
      )}

      {/* ── Heart burst animation ── */}
      {heartAnim && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          fontSize: 80, pointerEvents: 'none',
          animation: 'vcHeartPop 0.9s ease-out forwards',
          filter: 'drop-shadow(0 2px 12px rgba(226,75,74,0.5))',
        }} aria-hidden>
          ❤️
        </div>
      )}

      {/* ── Bottom: user info + description ── */}
      <div
        data-no-tap="true"
        style={{ position: 'absolute', bottom: 90, left: 14, right: 78 }}
      >
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 10, cursor: 'pointer',
            background: 'none', border: 'none', padding: 0,
          }}
          onClick={e => { e.stopPropagation(); onViewProfile(post.userId); }}
        >
          <Avatar name={post.username} color={post.userAvatarColor} src={post.userAvatarUrl} size="sm" ring />
          <span style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>
            {post.username}
            {post.userVerified && <span style={{ marginLeft: 4, color: '#6EE7A0' }}>✓</span>}
          </span>
          {!isFollowing && (
            <button
              onClick={e => { e.stopPropagation(); onFollow(post.userId); }}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.35)',
                color: 'white', borderRadius: 999,
                padding: '3px 14px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', backdropFilter: 'blur(6px)',
                transition: 'background 0.15s',
              }}
            >
              Follow
            </button>
          )}
        </button>

        {desc && (
          <p style={{ color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 1.55, margin: 0 }}>
            {showFull || desc.length <= DESC_LIMIT ? desc : desc.slice(0, DESC_LIMIT) + '…'}
            {desc.length > DESC_LIMIT && (
              <button
                onClick={e => { e.stopPropagation(); setShowFull(f => !f); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: 13 }}
              >
                {showFull ? ' less' : ' more'}
              </button>
            )}
          </p>
        )}
      </div>

      {/* ── Progress bar (video only) ── */}
      {!isImage && (
        <div
          data-no-tap="true"
          style={{ position: 'absolute', bottom: 72, left: 0, right: 0, padding: '0 14px' }}
        >
          <div style={{ position: 'relative', height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: 'white',
              width: `${progress * 100}%`,
              transition: 'width 0.1s linear',
            }} />
            <input
              type="range"
              min={0} max={1} step={0.001}
              value={progress}
              onChange={handleScrub}
              aria-label="Seek video"
              style={{
                position: 'absolute', inset: '-6px 0',
                width: '100%', opacity: 0, cursor: 'pointer',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Side action buttons ── */}
      <div
        data-no-tap="true"
        style={{
          position: 'absolute', right: 10, bottom: 90,
          display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center',
        }}
      >
        {/* Like */}
        <FSBtn onClick={handleLike} label={formatCount(likeCount)} ariaLabel={liked ? 'Unlike' : 'Like'}>
          <HeartIcon filled={liked} color={liked ? ACCENT_RED : 'white'} size={24} />
        </FSBtn>

        {/* Comment */}
        <FSBtn
          onClick={() => onComment(post.id, post.userId, post.username)}
          label={formatCount(post.comments)}
          ariaLabel="Comments"
        >
          <CommentIcon color="white" size={24} />
        </FSBtn>

        {/* Share */}
        <FSBtn onClick={() => onShare(post)} label={formatCount(post.shares)} ariaLabel="Share">
          <ShareIcon color="white" size={24} />
        </FSBtn>

        {/* Save */}
        <FSBtn onClick={handleSave} ariaLabel={saved ? 'Unsave' : 'Save'}>
          <BookmarkIcon filled={saved} color={saved ? ACCENT : 'white'} size={24} />
        </FSBtn>

        {/* Mute toggle (video only) */}
        {!isImage && (
          <FSBtn onClick={() => setMuted(m => !m)} ariaLabel={muted ? 'Unmute' : 'Mute'}>
            {muted ? <MutedIcon /> : <UnmutedIcon />}
          </FSBtn>
        )}
      </div>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes vcHeartPop {
          0%   { transform: translate(-50%,-50%) scale(0); opacity: 1; }
          50%  { transform: translate(-50%,-50%) scale(1.45); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1.1); opacity: 0; }
        }
        @keyframes vcSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes vcFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="vcHeartPop"], [style*="vcSpin"], [style*="vcFadeIn"] {
            animation: none !important;
          }
        }
      `}</style>
    </article>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function menuItemStyle(color: string, withBorder: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '12px 16px', background: 'none', border: 'none',
    borderBottom: withBorder ? '1px solid rgba(0,0,0,0.05)' : 'none',
    textAlign: 'left', fontSize: 14, cursor: 'pointer', color,
  };
}

/** Card-style action button (like, comment, share) */
function ActionBtn({
  onClick, active, activeColor, label, icon, ariaLabel,
}: {
  onClick: () => void;
  active?: boolean;
  activeColor?: string;
  label?: string;
  icon: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'none', border: 'none', cursor: 'pointer',
        color: active ? activeColor : '#6B7280',
        fontSize: 13, fontWeight: 500, padding: 4,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/** Fullscreen pill button */
function FSBtn({
  onClick, label, ariaLabel, children,
}: {
  onClick: () => void;
  label?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      aria-label={ariaLabel}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        background: 'rgba(0,0,0,0.32)', borderRadius: 999,
        padding: 10, border: 'none', cursor: 'pointer',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        transition: 'background 0.15s, transform 0.1s',
      }}
    >
      {children}
      {label && <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>{label}</span>}
    </button>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function HeartIcon({ filled, color, size = 18 }: { filled: boolean; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color} strokeWidth="1.8" strokeLinecap="round" aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}

function CommentIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function ShareIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden
    >
      <polyline points="22 2 11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}

function BookmarkIcon({ filled, color, size = 18 }: { filled: boolean; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24"
      fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" aria-hidden
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  );
}

function UnmutedIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24"
      fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" aria-hidden
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    </svg>
  );
}
