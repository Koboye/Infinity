'use client';
import { useRef, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { publishStory } from '@/lib/firebase/stories';

interface CreateStoryProps { onClose: () => void; onCreated?: (id: string) => void; }

export function CreateStory({ onClose, onCreated }: CreateStoryProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore(s => s.user);
  const showToast = useUIStore(s => s.showToast);

  const pickFile = (f: File) => {
    if (!f.type.startsWith('video/') && !f.type.startsWith('image/')) {
      showToast('Pick a video or image', 'error'); return;
    }
    if (f.size > 50 * 1024 * 1024) {
      showToast('File too large. Maximum is 50MB', 'error');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!user || !file) { showToast('Pick a photo or video first', 'error'); return; }
    setSubmitting(true);
    try {
      const { id } = await publishStory(file, caption.trim(), setProgress);
      onCreated?.(id);
      showToast('Story posted! 🎉', 'success');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to post story', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 250, background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 999, padding: '6px 16px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
        <span style={{ fontWeight: 800, color: '#fff', fontSize: 16 }}>Add to Story</span>
        <button
          onClick={submit}
          disabled={submitting || !file}
          style={{
            background: submitting || !file ? 'rgba(255,255,255,0.15)' : 'linear-gradient(135deg,#3D6B4F,#5A9A6F)',
            border: 'none',
            color: submitting || !file ? 'rgba(255,255,255,0.4)' : 'white',
            borderRadius: 999,
            padding: '6px 16px',
            fontWeight: 700,
            cursor: submitting || !file ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Posting…' : 'Share'}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {preview ? (
          file?.type.startsWith('image/')
            ? <img src={preview} alt="" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
            : <video src={preview} controls style={{ maxHeight: '100%', maxWidth: '100%' }} />
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1.5px dashed rgba(255,255,255,0.4)', color: '#fff', borderRadius: 20, padding: '40px 32px', cursor: 'pointer', fontSize: 15, fontWeight: 600 }}
          >
            📁 Choose photo or video
          </button>
        )}
      </div>

      {preview && (
        <div style={{ padding: '0 16px 20px' }}>
          <input
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Add a caption…"
            maxLength={200}
            style={{ width: '100%', background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: 14, borderRadius: 12, padding: '10px 14px', outline: 'none' }}
          />
        </div>
      )}

      {submitting && (
        <div style={{ padding: '0 16px 20px' }}>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 3 }}>
            <div style={{ height: '100%', borderRadius: 3, width: `${progress}%`, transition: 'width 0.3s', background: 'linear-gradient(135deg,#3D6B4F,#5A9A6F)' }} />
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*,video/*" onChange={e => e.target.files?.[0] && pickFile(e.target.files[0])} style={{ display: 'none' }} />
    </div>
  );
}
