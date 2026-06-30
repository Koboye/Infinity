'use client';
import { useEffect, useRef, useState } from 'react';
import type { Story } from '@/types';
import { markStoryViewed } from '@/lib/firebase/stories';

const ACCENT = '#3D6B4F';
const DURATION_MS = 5000;

interface StoryViewerProps {
  stories: Story[];
  startIndex?: number;
  onClose: () => void;
}

export function StoryViewer({ stories, startIndex = 0, onClose }: StoryViewerProps) {
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  const current = stories[index];

  const goTo = (next: number) => {
    if (next < 0) { onClose(); return; }
    if (next >= stories.length) { onClose(); return; }
    elapsedRef.current = 0;
    setProgress(0);
    setIndex(next);
  };

  useEffect(() => {
    if (!current) return;
    markStoryViewed(current.id);
  }, [current?.id]);

  useEffect(() => {
    if (paused || !current) return;
    startRef.current = performance.now() - elapsedRef.current;

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      elapsedRef.current = elapsed;
      const pct = Math.min(100, (elapsed / DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        goTo(index + 1);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [index, paused, current?.id]);

  if (!current) return null;

  const initials = current.username?.[0]?.toUpperCase() ?? '?';
  const timeAgo = (() => {
    const mins = Math.max(1, Math.round((Date.now() - new Date(current.createdAt).getTime()) / 60000));
    if (mins < 60) return `${mins}m`;
    return `${Math.round(mins / 60)}h`;
  })();

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#000', display: 'flex', flexDirection: 'column' }}
      onMouseDown={() => setPaused(true)}
      onMouseUp={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {/* Progress bars */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 10px 0' }}>
        {stories.map((s, i) => (
          <div key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                borderRadius: 2,
                background: '#fff',
                width: i < index ? '100%' : i === index ? `${progress}%` : '0%',
                transition: i === index ? 'none' : 'width 0.15s linear',
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: current.userAvatarColor ?? ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 13 }}>
            {current.userAvatarUrl
              ? <img src={current.userAvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{current.username}</span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{timeAgo}</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'rgba(0,0,0,0.35)', border: 'none', color: '#fff', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}
        >
          ✕
        </button>
      </div>

      {/* Media */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {current.media.kind === 'image'
          ? <img src={current.media.url} alt="" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
          : (
            <video
              src={current.media.url}
              autoPlay
              playsInline
              muted={false}
              style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
              onEnded={() => goTo(index + 1)}
            />
          )}

        {/* Tap zones */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
          <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => goTo(index - 1)} />
          <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => goTo(index + 1)} />
        </div>
      </div>

      {current.caption && (
        <div style={{ padding: '14px 18px 28px', color: '#fff', fontSize: 14 }}>{current.caption}</div>
      )}
    </div>
  );
}
