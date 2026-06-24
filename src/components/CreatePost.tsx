'use client';

import { useState, useRef, useCallback } from 'react';
import { m } from 'framer-motion';
import { Camera, Image as ImageIcon, Music2, Sparkles, Send, X, Loader2 } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { generateSmartCaption } from '@/lib/ai/captions';
import { moderatePost } from '@/lib/ai/moderation';
import { uploadFile } from '@/lib/firebase/upload';
import { publishVideo } from '@/lib/firebase/videos';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import { cn } from '@/lib/utils/cn';

type Step = 'pick' | 'compose';

export interface CreatePostProps {
  onClose: () => void;
  onCreated: (postId: string) => void;
}

export function CreatePost({ onClose, onCreated }: CreatePostProps) {
  const [step, setStep] = useState<Step>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [smartBusy, setSmartBusy] = useState(false);
  const [moderationBusy, setModerationBusy] = useState(false);
  const [moderationVerdict, setModerationVerdict] = useState<{ safe: boolean; flags: string[] } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore(s => s.user);
  const showToast = useUIStore(s => s.showToast);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('video/') && !f.type.startsWith('image/')) {
      showToast('Unsupported file type. Please pick a video or image.', 'error');
      return;
    }
    if (f.size > 200 * 1024 * 1024) {
      showToast('File too large (max 200MB).', 'error');
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setStep('compose');
  }, [showToast]);

  const generateAi = async () => {
    if (!description.trim()) {
      showToast('Write something first — I need a draft to work with.', 'info');
      return;
    }
    setSmartBusy(true);
    try {
      const result = await generateSmartCaption(description);
      setDescription(prev => result.caption || prev);
      setHashtags(result.hashtags);
      showToast('Smart caption applied ✨', 'success');
    } finally {
      setSmartBusy(false);
    }
  };

  const checkModeration = async () => {
    setModerationBusy(true);
    try {
      const verdict = await moderatePost({ text: description, imageUrls: previewUrl ? [previewUrl] : [] });
      setModerationVerdict({ safe: verdict.safe, flags: verdict.flags });
      if (verdict.safe) {
        showToast('Looks good — safe to post ✅', 'success');
      } else {
        showToast(`Flagged: ${verdict.flags.join(', ') || 'review needed'}`, 'warning');
      }
    } catch {
      showToast('Moderation service unavailable — proceeding with caution.', 'warning');
    } finally {
      setModerationBusy(false);
    }
  };

  const submit = async () => {
    if (!user || !file || !previewUrl) return;
    if (!description.trim()) {
      showToast('Add a caption before posting.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      // 1. Upload
      const uploaded = await uploadFile(file, { onProgress: setUploadProgress });
      // 2. Moderate
      const verdict = await moderatePost({ text: description, imageUrls: [uploaded.url] });
      // 3. Compute initial trending score (engagement is 0 here, so use freshness bonus)
      const trendingScore = 1.0;
      // 4. Publish
      const postId = await publishVideo({
        userId: user.id,
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
        moderationStatus: verdict.safe ? 'approved' : 'flagged',
        moderationFlags: verdict.flags,
        trendingScore,
      });
      onCreated(postId);
      showToast(verdict.safe ? 'Posted! 🎉' : 'Posted — under review', verdict.safe ? 'success' : 'info');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to post', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'pick') {
    return (
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end justify-center bg-black/85"
      >
        <m.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-md rounded-t-3xl bg-bg-elev1 p-6 pb-12"
        >
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15" />
          <h2 className="mb-4 text-xl font-extrabold">Create Post</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { id: 'camera', icon: Camera, label: 'Camera', desc: 'Record now', color: '#FF2156' },
              { id: 'gallery', icon: ImageIcon, label: 'Gallery', desc: 'Pick from device', color: '#9D4EDD' },
              { id: 'sound', icon: Music2, label: 'Sound', desc: 'Add music', color: '#2ED573' },
              { id: 'spark', icon: Sparkles, label: 'AI Draft', desc: 'Generate idea', color: '#0A84FF' },
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (opt.id === 'camera') cameraInputRef.current?.click();
                  else if (opt.id === 'gallery') fileInputRef.current?.click();
                  else if (opt.id === 'spark') {
                    setStep('compose');
                    setDescription('Tell me what you want to share…');
                  }
                }}
                className="flex flex-col items-center gap-2 rounded-[22px] border bg-white/4 p-4 transition-colors hover:bg-white/6"
                style={{ borderColor: `${opt.color}30` }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${opt.color}22` }}
                >
                  <opt.icon className="h-6 w-6" style={{ color: opt.color }} />
                </div>
                <div className="text-sm font-bold">{opt.label}</div>
                <div className="text-xs text-white/35">{opt.desc}</div>
              </button>
            ))}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="hidden"
          />
          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-full bg-white/8 py-3 text-sm text-white/70"
          >
            Cancel
          </button>
        </m.div>
      </m.div>
    );
  }

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] flex flex-col bg-bg-base"
    >
      <header className="flex items-center justify-between border-b border-white/6 px-4 py-3">
        <button type="button" onClick={onClose} className="rounded-full bg-white/8 px-4 py-1.5 text-sm">
          Cancel
        </button>
        <span className="font-bold">New Post</span>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="gradient-brand flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? 'Posting' : 'Post'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex items-start gap-3">
          <Avatar name={user?.username ?? '?'} color={user?.avatarColor} src={user?.avatarUrl} size="md" />
          <div className="flex-1">
            <div className="font-bold">@{user?.username}</div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's on your mind?"
              className="mt-2 w-full resize-none bg-transparent text-sm leading-relaxed placeholder:text-white/30"
              rows={4}
              maxLength={500}
            />
          </div>
        </div>

        {previewUrl && (
          <div className="relative mb-4 overflow-hidden rounded-2xl border border-white/10">
            {file?.type.startsWith('image/') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="max-h-72 w-full object-cover" />
            ) : (
              <video src={previewUrl} controls className="max-h-72 w-full" />
            )}
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPreviewUrl(null);
                setStep('pick');
              }}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {hashtags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {hashtags.map(tag => (
              <span key={tag} className="rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-2.5">
          <Button
            type="button"
            variant="secondary"
            onClick={generateAi}
            disabled={smartBusy}
            loading={smartBusy}
          >
            <Sparkles className="h-4 w-4" />
            Smart Caption
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={checkModeration}
            disabled={moderationBusy}
            loading={moderationBusy}
          >
            Check Safety
          </Button>
        </div>

        {moderationVerdict && (
          <div
            className={cn(
              'mb-4 rounded-2xl border p-3 text-sm',
              moderationVerdict.safe
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-warning/30 bg-warning/10 text-warning',
            )}
          >
            {moderationVerdict.safe
              ? '✅ Content looks safe to post.'
              : `⚠️ Flagged for: ${moderationVerdict.flags.join(', ')}. You can still post — it will go under review.`}
          </div>
        )}

        {submitting && uploadProgress > 0 && (
          <div className="rounded-2xl border border-white/10 bg-bg-elev1 p-3">
            <div className="mb-1 flex justify-between text-xs text-white/70">
              <span>Uploading…</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full gradient-brand transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/6 bg-bg-elev1 p-3 text-xs text-white/50">
          <strong className="text-white/70">V5 smart features active:</strong>
          <ul className="ml-4 mt-1 list-disc space-y-0.5">
            <li>Captions auto-generated by AI (with hashtags + language detection)</li>
            <li>Posts are scanned for toxicity, NSFW, and scams before going live</li>
            <li>Trending topics influence your reach in the smart feed</li>
          </ul>
        </div>
      </div>
    </m.div>
  );
}
