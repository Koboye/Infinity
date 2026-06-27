'use client';
// src/features/create/CreatePost.tsx
// Fixed: publish goes through /api/videos (server-side moderation) instead of
// the client-side publishVideo() function which bypassed moderation entirely.
import { useState, useRef } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { moderatePost } from '@/lib/ai/moderation';
import { uploadFile } from '@/lib/firebase/upload';
import { getIdToken } from '@/lib/firebase/auth';
import { Avatar } from '@/components/Avatar';

interface CreatePostProps { onClose: () => void; onCreated: (id: string) => void; }

export function CreatePost({ onClose, onCreated }: CreatePostProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [modResult, setModResult] = useState<{ safe: boolean; flags: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore(s => s.user);
  const showToast = useUIStore(s => s.showToast);

  const getVideoDuration = (f: File): Promise<number> => new Promise(resolve => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => { URL.revokeObjectURL(video.src); resolve(video.duration); };
    video.src = URL.createObjectURL(f);
  });

  const pickFile = async (f: File) => {
    if (!f.type.startsWith('video/') && !f.type.startsWith('image/')) {
      showToast('Pick a video or image', 'error'); return;
    }
    if (f.size > 50 * 1024 * 1024) { showToast('File too large. Maximum is 50MB', 'error'); return; }
    if (f.type.startsWith('video/')) {
      const duration = await getVideoDuration(f);
      if (duration > 180) { showToast('Video too long. Maximum is 3 minutes', 'error'); return; }
    }
    setFile(f); setPreview(URL.createObjectURL(f));
  };

  const smartCaption = async () => {
  if (!description.trim()) { showToast('Write a draft caption first', 'info'); return; }
  setAiLoading(true);
  try {
    const token = await getIdToken();
    const res = await fetch('/api/smart-caption', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ input: description }),
    });
    if (!res.ok) throw new Error('Smart caption request failed');
    const r = await res.json() as { caption: string; hashtags: string[] };
    setDescription(r.caption); setHashtags(r.hashtags);
    showToast('Smart caption applied ✨', 'success');
  } catch { showToast('Could not generate a caption right now', 'error'); }
  finally { setAiLoading(false); }
};

  const checkSafety = async () => {
    const v = await moderatePost({ text: description });
    setModResult({ safe: v.safe, flags: v.flags });
    showToast(v.safe ? 'Content looks safe ✅' : `Flagged: ${v.flags.join(', ')}`, v.safe ? 'success' : 'warning');
  };

  const submit = async () => {
    if (!user || !file) { showToast('Pick a file first', 'error'); return; }
    if (!description.trim()) { showToast('Add a caption', 'error'); return; }
    setSubmitting(true);
    try {
      // 1. Upload media (now signed — see upload.ts)
      const uploaded = await uploadFile(file, { onProgress: setProgress });

      // 2. Publish via server route — this is where real moderation happens.
      //    The client moderatePost() above is preview-only and is NEVER trusted
      //    for the actual decision. The server runs its own moderation check.
      const token = await getIdToken();
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: user.username,
          avatar: user.avatar,
          avatarColor: user.avatarColor,
          avatarUrl: user.avatarUrl,
          verified: user.verified,
          description,
          hashtags,
          mediaUrl: uploaded.url,
          mediaType: file.type.startsWith('image/') ? 'image' : 'video',
          song: 'Original sound',
        }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Failed to post' }));
        throw new Error(error ?? 'Failed to post');
      }

      const { id, moderationStatus } = await res.json() as { id: string; moderationStatus: string };
      onCreated(id);
      showToast(
        moderationStatus === 'approved' ? 'Posted! 🎉' : 'Posted — under review',
        moderationStatus === 'approved' ? 'success' : 'info'
      );
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to post', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(245,245,247,0.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.06)', position: 'sticky', top: 0 }}>
        <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', color: '#0D0D12', borderRadius: 999, padding: '6px 16px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
        <span style={{ fontWeight: 800, color: '#0D0D12', fontSize: 16 }}>New Post</span>
        <button onClick={submit} disabled={submitting || !file} style={{ background: submitting || !file ? 'rgba(0,0,0,0.08)' : 'linear-gradient(135deg,#6B4EFF,#9D4EDD)', border: 'none', color: submitting || !file ? '#9CA3AF' : 'white', borderRadius: 999, padding: '6px 16px', fontWeight: 700, cursor: 'pointer' }}>
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#F5F5F7' }}>
        {/* Composer */}
        <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 12, border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Avatar name={user?.username ?? '?'} color={user?.avatarColor} src={user?.avatarUrl} size="md" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#0D0D12' }}>@{user?.username}</div>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="What's on your mind?" rows={4}
                style={{ width: '100%', background: 'transparent', border: 'none', color: '#0D0D12', fontSize: 15, resize: 'none', outline: 'none', lineHeight: 1.5 }}
                maxLength={500}
              />
            </div>
          </div>
        </div>

        {preview && (
          <div style={{ position: 'relative', marginBottom: 12, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)', background: '#F5F5F7' }}>
            {file?.type.startsWith('image/')
              ? <img src={preview} alt="" style={{ maxHeight: 280, width: '100%', objectFit: 'cover' }} />
              : <video src={preview} controls style={{ maxHeight: 280, width: '100%' }} />}
            <button onClick={() => { setFile(null); setPreview(null); }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        )}

        {hashtags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {hashtags.map(t => <span key={t} style={{ background: 'rgba(107,78,255,0.1)', color: '#6B4EFF', borderRadius: 999, padding: '4px 12px', fontSize: 13, fontWeight: 700 }}>{t}</span>)}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <button onClick={() => fileRef.current?.click()} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', color: '#0D0D12', borderRadius: 14, padding: '12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>📁 Pick File</button>
          <button onClick={() => camRef.current?.click()} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', color: '#0D0D12', borderRadius: 14, padding: '12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>📷 Camera</button>
          <button onClick={smartCaption} disabled={aiLoading} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', color: '#6B4EFF', borderRadius: 14, padding: '12px', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: aiLoading ? 0.5 : 1 }}>✨ {aiLoading ? 'Generating…' : 'Smart Caption'}</button>
          <button onClick={checkSafety} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', color: '#0D0D12', borderRadius: 14, padding: '12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>🛡️ Check Safety</button>
        </div>

        {modResult && (
          <div style={{ padding: 12, borderRadius: 14, marginBottom: 12, background: modResult.safe ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${modResult.safe ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`, color: modResult.safe ? '#059669' : '#D97706', fontSize: 13 }}>
            {modResult.safe ? '✅ Content looks safe to post.' : `⚠️ Flagged: ${modResult.flags.join(', ')}. You can still post — it will go under review.`}
          </div>
        )}

        {submitting && progress > 0 && (
          <div style={{ padding: 12, borderRadius: 14, background: '#FFFFFF', marginBottom: 12, border: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6B7280', marginBottom: 8 }}>
              <span>Uploading…</span><span>{progress}%</span>
            </div>
            <div style={{ height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3 }}>
              <div style={{ height: '100%', borderRadius: 3, width: `${progress}%`, transition: 'width 0.3s', background: 'linear-gradient(135deg,#6B4EFF,#9D4EDD)' }} />
            </div>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*,video/*" onChange={e => e.target.files?.[0] && pickFile(e.target.files[0])} style={{ display: 'none' }} />
      <input ref={camRef} type="file" accept="image/*,video/*" capture="environment" onChange={e => e.target.files?.[0] && pickFile(e.target.files[0])} style={{ display: 'none' }} />
    </div>
  );
}
