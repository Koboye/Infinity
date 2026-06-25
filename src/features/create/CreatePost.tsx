'use client';
import { useState, useRef } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { generateSmartCaption } from '@/lib/ai/captions';
import { moderatePost } from '@/lib/ai/moderation';
import { uploadFile } from '@/lib/firebase/upload';
import { publishVideo } from '@/lib/firebase/videos';
import { Avatar } from '@/components/Avatar';

interface CreatePostProps { onClose: () => void; onCreated: (id: string) => void; }

export function CreatePost({ onClose, onCreated }: CreatePostProps) {
  const [file, setFile] = useState<File|null>(null);
  const [preview, setPreview] = useState<string|null>(null);
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [modResult, setModResult] = useState<{safe:boolean;flags:string[]}|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore(s => s.user);
  const showToast = useUIStore(s => s.showToast);

  const getVideoDuration = (file: File): Promise<number> => new Promise((resolve) => {
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.onloadedmetadata = () => { URL.revokeObjectURL(video.src); resolve(video.duration); };
  video.src = URL.createObjectURL(file);
});

const getVideoDuration = (file: File): Promise<number> => new Promise((resolve) => {
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.onloadedmetadata = () => { URL.revokeObjectURL(video.src); resolve(video.duration); };
  video.src = URL.createObjectURL(file);
});

const pickFile = async (f: File) => {
  if (!f.type.startsWith('video/') && !f.type.startsWith('image/')) { showToast('Pick a video or image', 'error'); return; }
  if (f.size > 50 * 1024 * 1024) { showToast('File too large. Maximum is 50MB', 'error'); return; }
  if (f.type.startsWith('video/')) {
    const duration = await getVideoDuration(f);
    if (duration > 180) { showToast('Video too long. Maximum is 3 minutes', 'error'); return; }
  }
  setFile(f); setPreview(URL.createObjectURL(f));
};
    setFile(f); setPreview(URL.createObjectURL(f));
  };

  const smartCaption = async () => {
    if (!description.trim()) { showToast('Write a draft caption first', 'info'); return; }
    setAiLoading(true);
    try { const r = await generateSmartCaption(description); setDescription(r.caption); setHashtags(r.hashtags); showToast('Smart caption applied ✨', 'success'); }
    finally { setAiLoading(false); }
  };

  const checkSafety = async () => {
    const v = await moderatePost({ text: description }); setModResult({ safe: v.safe, flags: v.flags });
    showToast(v.safe ? 'Content looks safe ✅' : `Flagged: ${v.flags.join(', ')}`, v.safe ? 'success' : 'warning');
  };

  const submit = async () => {
    if (!user || !file) { showToast('Pick a file first', 'error'); return; }
    if (!description.trim()) { showToast('Add a caption', 'error'); return; }
    setSubmitting(true);
    try {
      const uploaded = await uploadFile(file, { onProgress: setProgress });
      const verdict = await moderatePost({ text: description, imageUrls: [uploaded.url] });
      const id = await publishVideo({ userId: user.id, username: user.username, avatar: user.avatar, avatarColor: user.avatarColor, avatarUrl: user.avatarUrl, verified: user.verified, description, hashtags, mediaUrl: uploaded.url, mediaType: file.type.startsWith('image/') ? 'image' : 'video', song: 'Original sound', moderationStatus: verdict.safe ? 'approved' : 'flagged', moderationFlags: verdict.flags, trendingScore: 1 });
      onCreated(id); showToast(verdict.safe ? 'Posted! 🎉' : 'Posted — under review', verdict.safe ? 'success' : 'info'); onClose();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Failed to post', 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'#0B0B0F', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.08)', border:'none', color:'white', borderRadius:999, padding:'6px 16px', cursor:'pointer' }}>Cancel</button>
        <span style={{ fontWeight:700 }}>New Post</span>
        <button onClick={submit} disabled={submitting||!file} className="gradient-brand" style={{ border:'none', color:'white', borderRadius:999, padding:'6px 16px', fontWeight:700, cursor:'pointer', opacity:submitting||!file?0.5:1 }}>
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:16 }}>
        <div style={{ display:'flex', gap:12, marginBottom:16 }}>
          <Avatar name={user?.username??'?'} color={user?.avatarColor} src={user?.avatarUrl} size="md" />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, marginBottom:8 }}>@{user?.username}</div>
            <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="What's on your mind?" rows={4}
              style={{ width:'100%', background:'transparent', border:'none', color:'white', fontSize:15, resize:'none', outline:'none', lineHeight:1.5 }} maxLength={500} />
          </div>
        </div>

        {preview && (
          <div style={{ position:'relative', marginBottom:16, borderRadius:16, overflow:'hidden', border:'1px solid rgba(255,255,255,0.1)' }}>
            {file?.type.startsWith('image/') ? <img src={preview} alt="" style={{ maxHeight:280, width:'100%', objectFit:'cover' }} /> : <video src={preview} controls style={{ maxHeight:280, width:'100%' }} />}
            <button onClick={()=>{setFile(null);setPreview(null);}} style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.6)', border:'none', color:'white', borderRadius:'50%', width:32, height:32, cursor:'pointer', fontSize:16 }}>✕</button>
          </div>
        )}

        {hashtags.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
            {hashtags.map(t=><span key={t} style={{ background:'rgba(255,33,86,0.15)', color:'#FF2156', borderRadius:999, padding:'4px 12px', fontSize:13, fontWeight:700 }}>{t}</span>)}
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
          <button onClick={()=>fileRef.current?.click()} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'white', borderRadius:14, padding:'12px', cursor:'pointer', fontSize:13, fontWeight:600 }}>📁 Pick File</button>
          <button onClick={()=>camRef.current?.click()} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'white', borderRadius:14, padding:'12px', cursor:'pointer', fontSize:13, fontWeight:600 }}>📷 Camera</button>
          <button onClick={smartCaption} disabled={aiLoading} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'white', borderRadius:14, padding:'12px', cursor:'pointer', fontSize:13, fontWeight:600, opacity:aiLoading?0.5:1 }}>✨ {aiLoading?'Generating…':'Smart Caption'}</button>
          <button onClick={checkSafety} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'white', borderRadius:14, padding:'12px', cursor:'pointer', fontSize:13, fontWeight:600 }}>🛡️ Check Safety</button>
        </div>

        {modResult && (
          <div style={{ padding:12, borderRadius:14, marginBottom:16, background: modResult.safe ? 'rgba(46,213,115,0.1)' : 'rgba(255,177,0,0.1)', border: `1px solid ${modResult.safe?'rgba(46,213,115,0.3)':'rgba(255,177,0,0.3)'}`, color: modResult.safe ? '#2ED573' : '#FFB100', fontSize:13 }}>
            {modResult.safe ? '✅ Content looks safe to post.' : `⚠️ Flagged: ${modResult.flags.join(', ')}. You can still post — it will go under review.`}
          </div>
        )}

        {submitting && progress > 0 && (
          <div style={{ padding:12, borderRadius:14, background:'rgba(255,255,255,0.04)', marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'rgba(255,255,255,0.7)', marginBottom:8 }}>
              <span>Uploading…</span><span>{progress}%</span>
            </div>
            <div style={{ height:6, background:'rgba(255,255,255,0.1)', borderRadius:3 }}>
              <div className="gradient-brand" style={{ height:'100%', borderRadius:3, width:`${progress}%`, transition:'width 0.3s' }} />
            </div>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*,video/*" onChange={e=>e.target.files?.[0]&&pickFile(e.target.files[0])} style={{ display:'none' }} />
      <input ref={camRef} type="file" accept="image/*,video/*" capture="environment" onChange={e=>e.target.files?.[0]&&pickFile(e.target.files[0])} style={{ display:'none' }} />
    </div>
  );
}
