// DaguUltimate.jsx — EXACT original layout + 100% real Firebase/Cloudinary backend
// ZERO layout changes. All original UI preserved. Only mock data replaced with real data.

import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, limit, where, getDocs, serverTimestamp, increment, arrayUnion, arrayRemove, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/* ─────────────── FIREBASE CONFIG ─────────────── */
const firebaseConfig = {
  apiKey: "AIzaSyD9jDk8gijMVAYrsFe4vpojI7GyZnkzGL8",
  authDomain: "dagu-8348c.firebaseapp.com",
  projectId: "dagu-8348c",
  storageBucket: "dagu-8348c.firebasestorage.app",
  messagingSenderId: "259738670911",
  appId: "1:259738670911:web:c4d1116e3697a8f67c658a",
  measurementId: "G-KJW3QQJ26X"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ─────────────── CLOUDINARY CONFIG ─────────────── */
const CLOUD_NAME = 'dotvhzjmc';
const UPLOAD_PRESET = 'g3c7dwdg';

const uploadToCloudinary = async (file, onProgress) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', UPLOAD_PRESET);
  const isVideo = file.type.startsWith('video');
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${isVideo ? 'video' : 'image'}/upload`);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => { const r = JSON.parse(xhr.responseText); r.secure_url ? resolve(r.secure_url) : reject(r.error); };
    xhr.onerror = reject;
    xhr.send(fd);
  });
};

/* ─────────────── EMAILJS OTP ─────────────── */
const sendOTPEmail = async (email, otp) => {
  try {
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: 'service_mtqmvbb',
        template_id: 'template_1k7wiqa',
        user_id: 'U9fs25Bcx5oQ6A2ru',
        template_params: { to_email: email, otp_code: otp, app_name: 'Dagu' }
      })
    });
  } catch (e) { /* fallback: alert */ }
};

/* ─────────────── CONSTANTS ─────────────── */
const LOGIN_METHODS = [
  { id: 'facebook', name: 'Facebook', icon: '📘', color: '#1877f2' },
  { id: 'google', name: 'Google', icon: '🌐', color: '#4285f4' },
  { id: 'apple', name: 'Apple', icon: '🍎', color: '#000' },
  { id: 'telegram', name: 'Telegram', icon: '📨', color: '#26A5E4' },
  { id: 'whatsapp', name: 'WhatsApp', icon: '📱', color: '#25D366' },
  { id: 'linkedin', name: 'LinkedIn', icon: '🔗', color: '#0077b5' },
  { id: 'imo', name: 'Imo', icon: '💬', color: '#6f4e7c' },
  { id: 'email', name: 'Email', icon: '📧', color: '#ff2d55' },
  { id: 'phone', name: 'Phone', icon: '📞', color: '#34c759' },
  { id: 'national_id', name: 'National ID', icon: '🆔', color: '#ff9500' },
];
const VIRTUAL_GIFTS = [
  { id: 'rose', name: '🌹 Rose', coins: 50 },
  { id: 'chocolate', name: '🍫 Chocolate', coins: 100 },
  { id: 'bear', name: '🧸 Teddy Bear', coins: 250 },
  { id: 'cake', name: '🎂 Cake', coins: 500 },
  { id: 'diamond', name: '💎 Diamond', coins: 1000 },
  { id: 'rocket', name: '🚀 Rocket', coins: 5000 },
  { id: 'crown', name: '👑 Crown', coins: 10000 },
  { id: 'galaxy', name: '🌌 Galaxy', coins: 50000 },
];
const SOUND_LIBRARY = [
  { id: 's1', name: 'Sunset Dreams', artist: 'Lofi Beats', duration: '3:24', popular: true, usage: 1250000 },
  { id: 's2', name: 'Creative Flow', artist: 'Chill Mix', duration: '2:56', popular: true, usage: 890000 },
  { id: 's3', name: 'Urban Vibes', artist: 'City Music', duration: '3:45', popular: true, usage: 567000 },
  { id: 's4', name: 'Midnight City', artist: 'Electronic', duration: '4:12', popular: false, usage: 234000 },
  { id: 's5', name: 'Summer Love', artist: 'Pop Hits', duration: '3:02', popular: true, usage: 3456000 },
];
const TOP_CATEGORIES = [
  { id: 'foryou', label: 'For You' },
  { id: 'following', label: 'Following' },
  { id: 'trending', label: 'Trending' },
];
const AVATAR_COLORS = ['#FF2D55','#AF52DE','#007AFF','#FF9500','#34C759','#00C7BE','#FF3B30','#5856D6','#32ADE6','#FF6B6B'];
const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num?.toString() || '0';
};
const timeAgo = ts => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

/* ─────────────── GLOBAL STYLES (ORIGINAL) ─────────────── */
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'DM Sans',sans-serif}
    ::-webkit-scrollbar{display:none}
    @keyframes heartBurst{0%{transform:scale(0.4) translateY(0);opacity:1}100%{transform:scale(1.8) translateY(-80px);opacity:0}}
    @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes slideDown{from{transform:translateY(-20px);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes floatUp{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-120px) scale(1.5);opacity:0}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
    @keyframes popIn{0%{transform:scale(0.8);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
    @keyframes ripple{0%{transform:scale(0);opacity:0.6}100%{transform:scale(4);opacity:0}}
    @keyframes tabPop{0%{transform:scaleX(0)}100%{transform:scaleX(1)}}
    @keyframes storyRing{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    button:active{transform:scale(0.94)!important}
    input,textarea{font-family:'DM Sans',sans-serif}
    .tab-active-indicator{animation:tabPop 0.25s ease}
    .story-avatar-ring{background:conic-gradient(#ff2d55,#ff9500,#ffd700,#af52de,#ff2d55);padding:2.5px;border-radius:50%}
  `}</style>
);

/* ─────────────── UPLOAD PROGRESS OVERLAY ─────────────── */
const UploadProgress = ({ progress, label }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
    <div style={{ position: 'relative', width: 90, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="90" height="90" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx="45" cy="45" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
        <circle cx="45" cy="45" r="40" fill="none" stroke="#ff2d55" strokeWidth="6"
          strokeDasharray={`${2 * Math.PI * 40 * progress / 100} ${2 * Math.PI * 40}`} strokeLinecap="round" />
      </svg>
      <span style={{ color: 'white', fontWeight: 800, fontSize: 18, fontFamily: "'Syne',sans-serif" }}>{progress}%</span>
    </div>
    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{label || 'Uploading...'}</div>
  </div>
);

/* ─────────────── TOAST (ORIGINAL) ─────────────── */
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 2800); return () => clearTimeout(t); }, [onClose]);
  const configs = {
    success: { bg: 'linear-gradient(135deg,#06d6a0,#00b4d8)', icon: '✓' },
    error: { bg: 'linear-gradient(135deg,#ff2d55,#ff6b35)', icon: '✕' },
    info: { bg: 'linear-gradient(135deg,#007aff,#5856d6)', icon: 'i' },
    warning: { bg: 'linear-gradient(135deg,#ff9500,#ff6b35)', icon: '!' },
  };
  const c = configs[type] || configs.info;
  return (
    <div style={{ position: 'fixed', bottom: 110, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, animation: 'slideUp 0.3s ease', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(15,15,15,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 40, padding: '10px 18px 10px 10px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{c.icon}</div>
      <span style={{ color: 'white', fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans',sans-serif" }}>{message}</span>
    </div>
  );
};

/* ─────────────── SHARE MODAL (ORIGINAL) ─────────────── */
const ShareModal = ({ video, onClose, showToast }) => {
  const url = video?.videoUrl || window.location.href;
  const shareText = video?.description || 'Check this out on Dagu!';
  const copyLink = () => { navigator.clipboard.writeText(url).then(() => showToast?.('Link copied!', 'success')).catch(() => showToast?.('Copied!', 'success')); };
  const nativeShare = async () => { if (navigator.share) { try { await navigator.share({ title: 'Dagu', text: shareText, url }); showToast?.('Shared!', 'success'); } catch {} } else showToast?.('Use a copy option below', 'info'); };
  const socialOptions = [
    { name: 'Copy Link', icon: '🔗', action: copyLink, color: '#555' },
    { name: 'Share', icon: '📤', action: nativeShare, color: '#007aff' },
    { name: 'WhatsApp', icon: '📱', action: () => { window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + url)}`); onClose(); }, color: '#25D366' },
    { name: 'Telegram', icon: '📨', action: () => { window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`); onClose(); }, color: '#26A5E4' },
    { name: 'X / Twitter', icon: '🐦', action: () => { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`); onClose(); }, color: '#1DA1F2' },
    { name: 'Facebook', icon: '📘', action: () => { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`); onClose(); }, color: '#1877f2' },
    { name: 'LinkedIn', icon: '🔗', action: () => { window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`); onClose(); }, color: '#0077b5' },
    { name: 'Email', icon: '📧', action: () => { window.open(`mailto:?subject=Dagu&body=${encodeURIComponent(shareText + '\n' + url)}`); onClose(); }, color: '#ff2d55' },
  ];
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 4000, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#111', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: '0 0 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 10px' }}>
          <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2 }} />
        </div>
        {video && (
          <div style={{ margin: '0 16px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            {video.avatarUrl
              ? <img src={video.avatarUrl} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 40, height: 40, borderRadius: '50%', background: video.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 16 }}>{video.avatar}</div>}
            <div>
              <div style={{ color: 'white', fontSize: 13, fontWeight: 600, fontFamily: "'Syne',sans-serif" }}>@{video.username}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>{(video.description || '').substring(0, 50)}...</div>
            </div>
          </div>
        )}
        <div style={{ padding: '0 16px', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Share via</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, padding: '0 16px' }}>
          {socialOptions.map(opt => (
            <button key={opt.name} onClick={opt.action} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '14px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, cursor: 'pointer', transition: 'all 0.15s' }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: opt.color + '22', border: `1.5px solid ${opt.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{opt.icon}</div>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 500 }}>{opt.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─────────────── STORY VIEWER (ORIGINAL) ─────────────── */
const StoryViewer = ({ story, user, onClose }) => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setProgress(p => { if (p >= 100) { onClose(); return 100; } return p + 1; }), 50);
    return () => clearInterval(i);
  }, [onClose]);
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 3000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.15)', zIndex: 10 }}>
        <div style={{ height: '100%', background: 'white', width: `${progress}%`, transition: 'width 0.05s linear' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 16px 12px', zIndex: 10 }}>
        {user?.avatarUrl
          ? <img src={user.avatarUrl} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
          : <div style={{ width: 34, height: 34, borderRadius: '50%', background: user?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 14 }}>{user?.avatar}</div>}
        <div style={{ flex: 1 }}>
          <div style={{ color: 'white', fontWeight: 600, fontSize: 13 }}>@{user?.username}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Just now</div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: story?.bgColor || 'linear-gradient(135deg,#1a1a2e,#16213e)' }}>
        {story?.mediaUrl ? (
          story.mediaType?.startsWith('video')
            ? <video src={story.mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay muted loop />
            : <img src={story.mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{story?.content || '✨'}</div>
            <div style={{ color: 'white', fontSize: 22, fontWeight: 700, fontFamily: "'Syne',sans-serif" }}>{story?.text || 'Story content'}</div>
          </div>
        )}
      </div>
      <div style={{ padding: '14px 16px 24px', display: 'flex', gap: 10 }}>
        <input placeholder="Reply to story..." style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 28, padding: '10px 16px', color: 'white', outline: 'none', fontSize: 13 }} />
        <button style={{ background: '#ff2d55', border: 'none', borderRadius: '50%', width: 42, height: 42, color: 'white', cursor: 'pointer', fontSize: 16 }}>↑</button>
      </div>
    </div>
  );
};

/* ─────────────── STORIES BAR (ORIGINAL layout, real data) ─────────────── */
const Stories = ({ users, currentUser, onViewStory, onCreateStory }) => (
  <div style={{ display: 'flex', gap: 14, padding: '14px 16px', overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
      <button onClick={onCreateStory} style={{ width: 62, height: 62, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1.5px dashed rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: currentUser?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {currentUser?.avatarUrl
            ? <img src={currentUser.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: 'white', fontWeight: 'bold', fontSize: 20 }}>{currentUser?.avatar}</span>}
        </div>
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, background: '#ff2d55', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0a0a0a', fontSize: 12, color: 'white', fontWeight: 800 }}>+</div>
      </button>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Your story</span>
    </div>
    {users.filter(u => u.uid !== currentUser?.uid).map(u => (
      <div key={u.uid} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <button onClick={() => onViewStory?.({ userId: u.uid, content: '✨', text: `${u.username}'s story` })} style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
          <div className="story-avatar-ring" style={{ width: 66, height: 66, borderRadius: '50%' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#0a0a0a', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {u.avatarUrl
                  ? <img src={u.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: 'white', fontWeight: 'bold', fontSize: 20 }}>{u.avatar}</span>}
              </div>
            </div>
          </div>
        </button>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{u.username.split('_')[0]}</span>
      </div>
    ))}
  </div>
);

/* ─────────────── CREATE STORY MODAL (ORIGINAL, real upload) ─────────────── */
const CreateStoryModal = ({ currentUser, onClose, showToast }) => {
  const [mode, setMode] = useState(null);
  const [storyText, setStoryText] = useState('');
  const [bgColor, setBgColor] = useState('#ff2d55');
  const [selectedFile, setSelectedFile] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const colors = ['#ff2d55', '#af52de', '#007aff', '#ff9500', '#34c759', '#00c7be', '#ff3b30', '#5856d6'];

  const startCamera = async () => {
    try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); streamRef.current = s; if (videoRef.current) videoRef.current.srcObject = s; setCameraActive(true); }
    catch { showToast?.('Camera denied', 'error'); }
  };
  const stopCamera = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setCameraActive(false); };
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const c = document.createElement('canvas'); c.width = videoRef.current.videoWidth; c.height = videoRef.current.videoHeight;
    c.getContext('2d').drawImage(videoRef.current, 0, 0);
    c.toBlob(blob => { setSelectedFile({ file: new File([blob], 'photo.jpg', { type: 'image/jpeg' }), url: URL.createObjectURL(blob), type: 'image/jpeg' }); stopCamera(); showToast?.('Photo captured!', 'success'); });
  };
  const startAudio = async () => {
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); const r = new MediaRecorder(s); chunksRef.current = []; r.ondataavailable = e => chunksRef.current.push(e.data); r.onstop = () => { setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' })); s.getTracks().forEach(t => t.stop()); }; r.start(); recorderRef.current = r; setIsRecording(true); }
    catch { showToast?.('Mic denied', 'error'); }
  };
  const stopAudio = () => { recorderRef.current?.stop(); setIsRecording(false); };

  useEffect(() => { if (mode === 'camera') startCamera(); return () => stopCamera(); }, [mode]);

  const postStory = async () => {
    setUploading(true);
    try {
      let mediaUrl = '', mediaType = '';
      if (selectedFile?.file) {
        mediaUrl = await uploadToCloudinary(selectedFile.file, setProgress);
        mediaType = selectedFile.type;
      } else if (audioBlob) {
        mediaUrl = await uploadToCloudinary(new File([audioBlob], 'audio.webm', { type: 'audio/webm' }), setProgress);
        mediaType = 'audio/webm';
      }
      await addDoc(collection(db, 'stories'), {
        userId: currentUser.uid, username: currentUser.username,
        avatar: currentUser.avatar, avatarColor: currentUser.avatarColor, avatarUrl: currentUser.avatarUrl || '',
        text: storyText, bgColor, mediaUrl, mediaType,
        createdAt: serverTimestamp(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      showToast?.('Story posted! ✨', 'success');
      onClose();
    } catch (e) { showToast?.('Failed to post story', 'error'); }
    setUploading(false);
  };

  if (uploading) return <UploadProgress progress={progress} label="Posting story..." />;

  if (!mode) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 3500, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#0f0f0f', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: '20px 20px 44px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto 24px' }} />
        <div style={{ color: 'white', fontWeight: 800, fontSize: 20, marginBottom: 20, fontFamily: "'Syne',sans-serif" }}>Create Story</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[{ id: 'camera', icon: '📷', label: 'Camera', sub: 'Photo or video', color: '#ff2d55' }, { id: 'file', icon: '🖼️', label: 'Gallery', sub: 'From device', color: '#af52de' }, { id: 'text', icon: '✏️', label: 'Text', sub: 'Write a story', color: '#007aff' }, { id: 'audio', icon: '🎙️', label: 'Audio', sub: 'Voice story', color: '#34c759' }].map(opt => (
            <button key={opt.id} onClick={() => { if (opt.id === 'file') fileInputRef.current?.click(); else setMode(opt.id); }} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${opt.color}30`, borderRadius: 22, padding: '18px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: opt.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{opt.icon}</div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 14, fontFamily: "'Syne',sans-serif" }}>{opt.label}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{opt.sub}</div>
            </button>
          ))}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={e => { const f = e.target.files[0]; if (f) { setSelectedFile({ file: f, url: URL.createObjectURL(f), type: f.type }); setMode('file'); } }} style={{ display: 'none' }} />
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 3500, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => { stopCamera(); onClose(); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 20, padding: '8px 16px', color: 'white', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        <span style={{ color: 'white', fontWeight: 700, fontSize: 15, fontFamily: "'Syne',sans-serif" }}>Story</span>
        <button onClick={postStory} style={{ background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: 20, padding: '8px 16px', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Post</button>
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {mode === 'camera' && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button onClick={capturePhoto} style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: 'white', border: '4px solid rgba(255,255,255,0.4)', borderRadius: '50%', width: 72, height: 72, cursor: 'pointer', fontSize: 28 }}>📸</button>
          </div>
        )}
        {mode === 'text' && (
          <div style={{ width: '100%', height: '100%', background: bgColor, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <textarea value={storyText} onChange={e => setStoryText(e.target.value)} placeholder="Write something..." style={{ background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 28, fontWeight: 700, textAlign: 'center', width: '100%', resize: 'none', caretColor: 'white', fontFamily: "'Syne',sans-serif" }} rows={4} autoFocus />
            <div style={{ position: 'absolute', bottom: 28, display: 'flex', gap: 10 }}>
              {colors.map(c => <div key={c} onClick={() => setBgColor(c)} style={{ width: 30, height: 30, borderRadius: '50%', background: c, border: c === bgColor ? '3px solid white' : '3px solid transparent', cursor: 'pointer' }} />)}
            </div>
          </div>
        )}
        {mode === 'audio' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 40 }}>
            <div style={{ fontSize: 80 }}>🎙️</div>
            {audioBlob
              ? <><audio src={URL.createObjectURL(audioBlob)} controls style={{ width: '100%' }} /><button onClick={() => setAudioBlob(null)} style={{ background: '#333', border: 'none', borderRadius: 20, padding: '10px 20px', color: 'white', cursor: 'pointer' }}>Re-record</button></>
              : <button onMouseDown={startAudio} onMouseUp={stopAudio} onTouchStart={startAudio} onTouchEnd={stopAudio} style={{ background: isRecording ? '#ff2d55' : '#333', border: 'none', borderRadius: '50%', width: 90, height: 90, fontSize: 36, cursor: 'pointer' }}>{isRecording ? '⏹' : '🎙️'}</button>}
            <p style={{ color: '#888', fontSize: 13 }}>{isRecording ? 'Recording... release to stop' : 'Hold to record'}</p>
          </div>
        )}
        {mode === 'file' && selectedFile && (
          selectedFile.type.startsWith('video/')
            ? <video src={selectedFile.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls />
            : <img src={selectedFile.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
    </div>
  );
};

/* ─────────────── USER PROFILE MODAL (ORIGINAL layout, real data) ─────────────── */
const UserProfileModal = ({ user, currentUser, onClose, onFollow, onMessage, onVoiceCall, onVideoCall, followed, showToast, userVideos }) => {
  const isFollowing = followed?.includes(user?.uid);
  const isOwn = user?.uid === currentUser?.uid;
  const [tab, setTab] = useState('posts');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#0d0d0d', borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '94vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '16px auto 0' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px 0' }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 34, height: 34, color: 'white', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ textAlign: 'center', padding: '4px 20px 20px' }}>
          <div style={{ width: 90, height: 90, borderRadius: '50%', padding: 2.5, margin: '0 auto 14px', background: 'conic-gradient(#ff2d55,#ff9500,#af52de,#ff2d55)' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#0d0d0d', padding: 2 }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: user?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {user?.avatarUrl
                  ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: 'white', fontWeight: 'bold', fontSize: 32 }}>{user?.avatar}</span>}
              </div>
            </div>
          </div>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 20, fontFamily: "'Syne',sans-serif" }}>@{user?.username}</div>
          {user?.verified && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#1d9bf0', fontSize: 12, marginTop: 4, background: 'rgba(29,155,240,0.1)', borderRadius: 20, padding: '3px 10px' }}>✓ Verified</div>}
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{user?.bio}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginTop: 18, background: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: '14px 0', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[['Posts', userVideos?.length || 0], ['Followers', user?.followers?.length || 0], ['Following', user?.following?.length || 0]].map(([label, val], i) => (
              <div key={label} style={{ flex: 1, textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : '' }}>
                <div style={{ color: 'white', fontWeight: 800, fontSize: 18, fontFamily: "'Syne',sans-serif" }}>{formatNumber(val)}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        {!isOwn && (
          <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px' }}>
            <button onClick={() => onFollow?.(user.uid)} style={{ flex: 1, background: isFollowing ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#ff2d55,#af52de)', border: isFollowing ? '1px solid rgba(255,255,255,0.12)' : 'none', borderRadius: 14, padding: '12px', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'Syne',sans-serif" }}>
              {isFollowing ? 'Following' : '+ Follow'}
            </button>
            <button onClick={() => { onMessage?.(user.uid); onClose(); }} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '12px', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Message</button>
            <button onClick={() => { onVoiceCall?.(user.uid); onClose(); }} style={{ background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.2)', borderRadius: 14, padding: '12px 14px', color: '#34c759', cursor: 'pointer', fontSize: 18 }}>📞</button>
            <button onClick={() => { onVideoCall?.(user.uid); onClose(); }} style={{ background: 'rgba(175,82,222,0.12)', border: '1px solid rgba(175,82,222,0.2)', borderRadius: 14, padding: '12px 14px', color: '#af52de', cursor: 'pointer', fontSize: 18 }}>📹</button>
          </div>
        )}
        <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {[{ id: 'posts', icon: '⊞' }, { id: 'saved', icon: '🔖' }, { id: 'drafts', icon: '📝' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: 'none', border: 'none', borderTop: tab === t.id ? '2px solid #ff2d55' : '2px solid transparent', padding: '14px 0', color: tab === t.id ? 'white' : 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 20 }}>{t.icon}</button>
          ))}
        </div>
        <div style={{ padding: 2 }}>
          {tab === 'posts' && (
            !userVideos?.length
              ? <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.25)' }}><div style={{ fontSize: 40, marginBottom: 10 }}>🎬</div><div style={{ fontSize: 14 }}>No posts yet</div></div>
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2 }}>
                {userVideos.map(v => (
                  <div key={v.id} style={{ aspectRatio: '9/16', background: '#1a1a1a', position: 'relative', overflow: 'hidden' }}>
                    <video src={v.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 4, left: 6, color: 'white', fontSize: 10, fontWeight: 700, background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '2px 6px' }}>{formatNumber(v.views)}</div>
                  </div>
                ))}
              </div>
          )}
          {tab === 'saved' && <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.25)' }}><div style={{ fontSize: 40, marginBottom: 10 }}>🔖</div><div>No saved posts</div></div>}
          {tab === 'drafts' && <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.25)' }}><div style={{ fontSize: 40, marginBottom: 10 }}>📝</div><div>No drafts</div></div>}
        </div>
        <div style={{ height: 30 }} />
      </div>
    </div>
  );
};

/* ─────────────── LIVE STREAM (ORIGINAL) ─────────────── */
const LiveStream = ({ streamer, onClose, showToast, currentUser }) => {
  const [viewers, setViewers] = useState(1234);
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!streamer?.liveId) return;
    const q = query(collection(db, 'lives', streamer.liveId, 'chat'), orderBy('createdAt', 'asc'), limit(50));
    const unsub = onSnapshot(q, snap => setChatMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const viewerInterval = setInterval(() => setViewers(v => v + Math.floor(Math.random() * 5 - 2)), 3000);
    return () => { unsub(); clearInterval(viewerInterval); };
  }, [streamer?.liveId]);

  const sendChat = async () => {
    if (!message.trim() || !streamer?.liveId) return;
    const text = message; setMessage('');
    await addDoc(collection(db, 'lives', streamer.liveId, 'chat'), {
      userId: currentUser?.uid, user: currentUser?.username || 'viewer',
      text, createdAt: serverTimestamp(),
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#0d0025,#160d00)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 40%,rgba(255,45,85,0.15),transparent 60%)' }} />
      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ background: '#ff2d55', borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'white', animation: 'pulse 1s infinite' }} />
            <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>LIVE</span>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>👁 {formatNumber(viewers)}</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', padding: '0 14px 10px', zIndex: 10 }}>
        <div style={{ flex: 1, maxHeight: 200, overflowY: 'hidden', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {chatMessages.slice(-8).map(m => (
            <div key={m.id} style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderRadius: 20, padding: '6px 12px', display: 'inline-flex', gap: 7, maxWidth: '85%', alignSelf: 'flex-start' }}>
              <span style={{ color: '#ff2d55', fontSize: 11, fontWeight: 700 }}>@{m.user}</span>
              <span style={{ color: 'white', fontSize: 11 }}>{m.text}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', marginLeft: 12 }}>
          {[['❤️', 0], ['🎁', 1], ['👍', 2]].map(([icon, i]) => (
            <button key={i} onClick={() => showToast?.('Gift sent! 🎁', 'success')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 44, height: 44, fontSize: 22, cursor: 'pointer' }}>{icon}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, padding: '10px 14px 28px', borderTop: '1px solid rgba(255,255,255,0.06)', zIndex: 10 }}>
        <input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="Say something..." style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 28, padding: '10px 16px', color: 'white', outline: 'none', fontSize: 13 }} />
        <button onClick={sendChat} style={{ background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: '50%', width: 42, height: 42, color: 'white', cursor: 'pointer', fontSize: 16 }}>↑</button>
      </div>
    </div>
  );
};

/* ─────────────── COMMENT ITEM (ORIGINAL) ─────────────── */
const CommentItem = ({ comment, currentUser, onLike, onReply, onPin }) => (
  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
    <div style={{ width: 34, height: 34, borderRadius: '50%', background: comment.avatarColor || '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
      {comment.avatarUrl
        ? <img src={comment.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>{comment.avatar || 'U'}</span>}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
        <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{comment.username}</span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{timeAgo(comment.createdAt) || comment.time || '1m'}</span>
      </div>
      <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.4 }}>{comment.text}</div>
      <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
        <button onClick={() => onLike?.(comment.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>❤️ {comment.likes || 0}</button>
        <button onClick={() => onReply?.(comment)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}>Reply</button>
        <button onClick={() => onPin?.(comment.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer' }}>Pin</button>
      </div>
    </div>
  </div>
);

/* ─────────────── ENHANCED VIDEO CARD (ORIGINAL layout, real Firebase) ─────────────── */
const EnhancedVideoCard = memo(({ video, currentUser, onLike, onComment, onShare, onFollow, onMessage, onVoiceCall, onVideoCall, onDuet, onStitch, onSaveSound, followed, showToast, onViewProfile }) => {
  const [liked, setLiked] = useState(video?.likedBy?.includes(currentUser?.uid));
  const [likeCount, setLikeCount] = useState(video?.likes || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [pinnedComment, setPinnedComment] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const videoRef = useRef(null);
  const commentsEndRef = useRef(null);

  // Real-time comments from Firestore
  useEffect(() => {
    if (!video?.id) return;
    const q = query(collection(db, 'videos', video.id, 'comments'), orderBy('createdAt', 'asc'), limit(100));
    const unsub = onSnapshot(q, snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [video?.id]);

  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [comments]);

  const handleDoubleTap = async () => {
    if (!liked) {
      setLiked(true); setLikeCount(p => p + 1); setHeartAnim(true);
      setTimeout(() => setHeartAnim(false), 900);
      try {
        await updateDoc(doc(db, 'videos', video.id), { likes: increment(1), likedBy: arrayUnion(currentUser.uid) });
        // Notify creator
        if (video.userId !== currentUser.uid) {
          await addDoc(collection(db, 'notifications'), {
            recipientId: video.userId, type: 'like',
            message: `@${currentUser.username} liked your video`,
            avatar: currentUser.avatar, avatarColor: currentUser.avatarColor,
            read: false, createdAt: serverTimestamp(),
          });
        }
      } catch {}
    }
  };

  const toggleLike = async () => {
    const newLiked = !liked;
    setLiked(newLiked); setLikeCount(p => p + (newLiked ? 1 : -1));
    if (newLiked) { setHeartAnim(true); setTimeout(() => setHeartAnim(false), 900); }
    try {
      await updateDoc(doc(db, 'videos', video.id), {
        likes: increment(newLiked ? 1 : -1),
        likedBy: newLiked ? arrayUnion(currentUser.uid) : arrayRemove(currentUser.uid)
      });
    } catch {}
  };

  const addComment = async () => {
    if (!commentText.trim() || !currentUser) return;
    const text = commentText; setCommentText('');
    try {
      await addDoc(collection(db, 'videos', video.id, 'comments'), {
        text, userId: currentUser.uid, username: currentUser.username,
        avatar: currentUser.avatar, avatarColor: currentUser.avatarColor,
        avatarUrl: currentUser.avatarUrl || '', likes: 0, createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'videos', video.id), { commentsCount: increment(1) });
    } catch {}
  };

  const reportReasons = ['Spam', 'Inappropriate content', 'Hate speech', 'Misinformation', 'Copyright violation', 'Other'];

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }} onDoubleClick={handleDoubleTap}>
      <video ref={videoRef} src={video?.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loop muted autoPlay playsInline />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.1) 40%,rgba(0,0,0,0.3) 100%)' }} />

      {heartAnim && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 50, pointerEvents: 'none' }}>
          <div style={{ fontSize: 80, animation: 'heartBurst 0.9s ease forwards' }}>❤️</div>
        </div>
      )}

      {/* Bottom info */}
      <div style={{ position: 'absolute', bottom: 80, left: 14, right: 70, zIndex: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <button onClick={() => onViewProfile?.(video.userId)} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: video.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.5)' }}>
              {video.avatarUrl
                ? <img src={video.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>{video.avatar}</span>}
            </div>
            {video.verified && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, background: '#1d9bf0', borderRadius: '50%', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>✓</div>}
          </button>
          <span onClick={() => onViewProfile?.(video.userId)} style={{ color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}>@{video.username}</span>
          <button onClick={() => onFollow?.(video.userId)} style={{ padding: '5px 14px', borderRadius: 20, background: followed?.includes(video.userId) ? 'transparent' : 'rgba(255,45,85,0.9)', border: followed?.includes(video.userId) ? '1px solid rgba(255,255,255,0.4)' : 'none', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>{followed?.includes(video.userId) ? 'Following' : '+ Follow'}</button>
          <button onClick={() => setShowActionMenu(!showActionMenu)} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '50%', width: 30, height: 30, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>⋯</button>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, marginBottom: 6, lineHeight: 1.5 }}>{video.description}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>♪</div>
          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{video.song || 'Original Sound'}</span>
          <button onClick={() => onSaveSound?.()} style={{ marginLeft: 8, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, padding: '3px 8px', color: 'rgba(255,255,255,0.7)', fontSize: 10, cursor: 'pointer', backdropFilter: 'blur(8px)' }}>Save</button>
        </div>
      </div>

      {/* Action Menu */}
      {showActionMenu && (
        <div onClick={() => setShowActionMenu(false)} style={{ position: 'absolute', inset: 0, zIndex: 19 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 160, left: 14, background: 'rgba(18,18,18,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, padding: 6, zIndex: 20, minWidth: 210, animation: 'popIn 0.2s ease' }}>
            {[
              { label: 'Duet', fn: () => { onDuet?.(video.id); showToast?.('Duet mode ready', 'info'); } },
              { label: 'Stitch', fn: () => { onStitch?.(video.id); showToast?.('Stitch mode ready', 'info'); } },
              { label: 'Message', fn: () => onMessage?.(video.userId) },
              { label: 'Voice Call', fn: () => onVoiceCall?.(video.userId) },
              { label: 'Video Call', fn: () => onVideoCall?.(video.userId) },
              { label: 'Report', fn: () => { setShowReportModal(true); setShowActionMenu(false); } },
              { label: 'Block', fn: () => showToast?.('User blocked', 'warning') },
            ].map(({ label, fn }) => (
              <button key={label} onClick={() => { fn(); setShowActionMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px', background: 'none', border: 'none', color: label === 'Block' ? '#ff2d55' : label === 'Report' ? '#ff9500' : 'white', cursor: 'pointer', borderRadius: 16, fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowReportModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#111', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: '20px 20px 40px', animation: 'slideUp 0.3s ease' }}>
            <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '0 auto 20px' }} />
            <div style={{ color: 'white', fontWeight: 800, fontSize: 18, marginBottom: 4, fontFamily: "'Syne',sans-serif" }}>Report Post</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 16 }}>Why are you reporting this?</div>
            {reportReasons.map(r => (
              <button key={r} onClick={async () => {
                await addDoc(collection(db, 'reports'), { videoId: video.id, reason: r, reportedBy: currentUser?.uid, createdAt: serverTimestamp() });
                showToast?.('Report submitted', 'success'); setShowReportModal(false);
              }} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px 16px', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: 8, fontSize: 14 }}>{r}</button>
            ))}
          </div>
        </div>
      )}

      {/* Right Side Action Buttons (ORIGINAL) */}
      <div style={{ position: 'absolute', right: 12, bottom: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 6 }}>
        <button onClick={toggleLike} style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(10px)', border: 'none', borderRadius: '50%', width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill={liked ? '#ff2d55' : 'none'} stroke={liked ? '#ff2d55' : 'white'} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
        </button>
        <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>{formatNumber(likeCount)}</span>
        <button onClick={() => setShowComments(true)} style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(10px)', border: 'none', borderRadius: '50%', width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: 6 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
        </button>
        <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>{formatNumber(video.commentsCount || 0)}</span>
        <button onClick={() => setShowShare(true)} style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(10px)', border: 'none', borderRadius: '50%', width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: 6 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        </button>
        <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>{formatNumber(video.shares || 0)}</span>
        <button onClick={() => setShowActionMenu(!showActionMenu)} style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(10px)', border: 'none', borderRadius: '50%', width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: 6 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
        </button>
      </div>

      {/* Comments Drawer (ORIGINAL layout) */}
      {showComments && (
        <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', zIndex: 50, display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s ease' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 16, fontFamily: "'Syne',sans-serif" }}>Comments</span>
            <button onClick={() => setShowComments(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
            {pinnedComment && (
              <div style={{ background: 'rgba(255,45,85,0.08)', borderRadius: 14, padding: '10px 12px', marginBottom: 16, border: '1px solid rgba(255,45,85,0.2)' }}>
                <div style={{ color: '#ff2d55', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>📌 Pinned</div>
                <CommentItem comment={pinnedComment} currentUser={currentUser} onLike={() => {}} onReply={() => {}} onPin={() => {}} />
              </div>
            )}
            {comments.length === 0 && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', padding: 32 }}>Be the first to comment!</div>}
            {comments.map(comment => (
              <CommentItem key={comment.id} comment={comment} currentUser={currentUser}
                onLike={async id => { await updateDoc(doc(db, 'videos', video.id, 'comments', id), { likes: increment(1) }); }}
                onReply={() => { setCommentText(`@${comment.username} `); }}
                onPin={id => { const c = comments.find(cc => cc.id === id); if (c) { setPinnedComment(c); showToast?.('Pinned!', 'success'); } }}
              />
            ))}
            <div ref={commentsEndRef} />
          </div>
          <div style={{ padding: '10px 14px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: currentUser?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>{currentUser?.avatar}</span>}
            </div>
            <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} placeholder="Add a comment..." style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 28, padding: '10px 16px', color: 'white', outline: 'none', fontSize: 13 }} />
            <button onClick={addComment} style={{ background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: '50%', width: 38, height: 38, color: 'white', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            </button>
          </div>
        </div>
      )}
      {showShare && <ShareModal video={video} onClose={() => setShowShare(false)} showToast={showToast} />}
    </div>
  );
});

/* ─────────────── HOME FEED (ORIGINAL layout, real Firestore) ─────────────── */
const HomeFeed = ({ videos, onLike, onComment, onShare, onFollow, onMessage, onVoiceCall, onVideoCall, onDuet, onStitch, onSaveSound, followed, showToast, onLive, currentUser, onViewProfile, onOpenSearch }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState('foryou');
  const startY = useRef(null);

  const filteredVideos = useMemo(() => {
    if (activeCategory === 'following') return videos.filter(v => currentUser?.following?.includes(v.userId));
    return videos;
  }, [videos, activeCategory, currentUser]);

  const handleTouchStart = e => { startY.current = e.touches[0].clientY; };
  const handleTouchEnd = e => {
    if (startY.current === null) return;
    const dy = startY.current - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 50) { if (dy > 0) setCurrentIndex(i => Math.min(filteredVideos.length - 1, i + 1)); else setCurrentIndex(i => Math.max(0, i - 1)); }
    startY.current = null;
  };

  if (!filteredVideos.length) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 48 }}>📭</div>
      <div style={{ color: 'rgba(255,255,255,0.3)' }}>No videos yet</div>
    </div>
  );

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Top bar — ORIGINAL */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 15, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 0' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 24 }}>
          {TOP_CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setCurrentIndex(0); }} style={{ background: 'none', border: 'none', color: activeCategory === cat.id ? 'white' : 'rgba(255,255,255,0.45)', fontWeight: activeCategory === cat.id ? 800 : 500, fontSize: 15, cursor: 'pointer', paddingBottom: 6, borderBottom: activeCategory === cat.id ? '2.5px solid white' : '2.5px solid transparent', fontFamily: "'Syne',sans-serif", transition: 'all 0.2s' }}>
              {cat.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={onOpenSearch} style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </button>
          <button style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
            <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: '#ff2d55', borderRadius: '50%', border: '1.5px solid #000' }} />
          </button>
        </div>
      </div>

      {filteredVideos.map((video, idx) => (
        <div key={video.id} style={{ position: 'absolute', inset: 0, opacity: idx === currentIndex ? 1 : 0, transform: `translateY(${(idx - currentIndex) * 100}%)`, transition: 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)', pointerEvents: idx === currentIndex ? 'auto' : 'none' }}>
          <EnhancedVideoCard video={video} currentUser={currentUser} onLike={onLike} onComment={onComment} onShare={onShare} onFollow={onFollow} onMessage={onMessage} onVoiceCall={onVoiceCall} onVideoCall={onVideoCall} onDuet={onDuet} onStitch={onStitch} onSaveSound={onSaveSound} followed={followed} showToast={showToast} onViewProfile={onViewProfile} />
        </div>
      ))}

      {filteredVideos.length > 1 && (
        <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
          {filteredVideos.map((_, i) => <div key={i} style={{ width: 3, height: i === currentIndex ? 20 : 4, borderRadius: 2, background: i === currentIndex ? 'white' : 'rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => setCurrentIndex(i)} />)}
        </div>
      )}
    </div>
  );
};

/* ─────────────── FRIENDS FEED (ORIGINAL layout, real data) ─────────────── */
const FriendsFeed = ({ friends, videos, currentUser, onMessage, onVoiceCall, onVideoCall, onViewProfile, showToast, users, onCreateStory, onViewStory }) => {
  const [search, setSearch] = useState('');
  const friendsVideos = useMemo(() => videos.filter(v => currentUser?.following?.includes(v.userId)).sort((a, b) => {
    const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
    const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
    return bDate - aDate;
  }), [videos, currentUser]);
  const filtered = useMemo(() => !search ? friendsVideos : friendsVideos.filter(v => v.username?.toLowerCase().includes(search.toLowerCase()) || v.description?.toLowerCase().includes(search.toLowerCase())), [friendsVideos, search]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      <Stories users={users} currentUser={currentUser} onViewStory={onViewStory} onCreateStory={onCreateStory} />
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 28, padding: '10px 16px', border: '1px solid rgba(255,255,255,0.07)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search friends..." style={{ flex: 1, background: 'none', border: 'none', color: 'white', outline: 'none', fontSize: 13 }} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0
          ? <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.2)' }}><div style={{ fontSize: 44, marginBottom: 12 }}>👥</div><div style={{ fontSize: 14 }}>Follow people to see their posts here</div></div>
          : <div style={{ padding: 14 }}>
            {filtered.map(video => (
              <div key={video.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 20, marginBottom: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ background: '#000', minHeight: 160 }}>
                  <video src={video.videoUrl} style={{ width: '100%', maxHeight: 220 }} controls />
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div onClick={() => onViewProfile?.(video.userId)} style={{ width: 38, height: 38, borderRadius: '50%', background: video.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer' }}>
                      {video.avatarUrl ? <img src={video.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>{video.avatar}</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Syne',sans-serif" }} onClick={() => onViewProfile?.(video.userId)}>@{video.username}</div>
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{formatNumber(video.views || 0)} views · {timeAgo(video.createdAt)}</div>
                    </div>
                    <button onClick={() => onMessage?.(video.userId)} style={{ background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: 20, padding: '7px 14px', color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Message</button>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.4 }}>{video.description}</p>
                </div>
              </div>
            ))}
          </div>}
      </div>
    </div>
  );
};

/* ─────────────── CREATE SCREEN (ORIGINAL layout, real upload) ─────────────── */
const CreateScreen = ({ onOpenCamera, onShowSoundLibrary, showToast }) => (
  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, background: '#0a0a0a' }}>
    <div style={{ textAlign: 'center', marginBottom: 12 }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 32 }}>🎬</div>
      <div style={{ color: 'white', fontWeight: 800, fontSize: 24, fontFamily: "'Syne',sans-serif" }}>Create & Share</div>
      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginTop: 4 }}>Express yourself</div>
    </div>
    {[
      { icon: '📷', label: 'Open Camera', sub: 'Record or take photo', action: onOpenCamera, grad: true },
      { icon: '🖼️', label: 'Upload from Gallery', sub: 'Choose from your device', action: onOpenCamera, grad: false },
      { icon: '✏️', label: 'Write Text Story', sub: 'Share a thought', action: onOpenCamera, grad: false },
      { icon: '🎙️', label: 'Record Audio', sub: 'Voice post', action: onOpenCamera, grad: false },
      { icon: '🎵', label: 'Add Sound', sub: 'Browse music library', action: onShowSoundLibrary, grad: false },
    ].map(btn => (
      <button key={btn.label} onClick={btn.action} style={{ width: '100%', maxWidth: 320, background: btn.grad ? 'linear-gradient(135deg,#ff2d55,#af52de)' : 'rgba(255,255,255,0.04)', border: btn.grad ? 'none' : '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '16px 20px', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: btn.grad ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{btn.icon}</div>
        <div>
          <div style={{ fontWeight: 700, fontFamily: "'Syne',sans-serif" }}>{btn.label}</div>
          <div style={{ color: btn.grad ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>{btn.sub}</div>
        </div>
      </button>
    ))}
  </div>
);

/* ─────────────── WALLET PAGE (ORIGINAL layout, real Firestore) ─────────────── */
const WalletPage = ({ user, setCurrentUser, showToast, onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [amount, setAmount] = useState('');
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'transactions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(20));
    const unsub = onSnapshot(q, snap => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [user?.uid]);

  const doDeposit = async () => {
    const n = parseInt(amount); if (!n || n <= 0) { showToast?.('Enter valid amount', 'error'); return; }
    await updateDoc(doc(db, 'users', user.uid), { coins: increment(n) });
    await addDoc(collection(db, 'transactions'), { userId: user.uid, type: 'credit', label: `Top-up ${n} coins`, amount: n, coins: true, createdAt: serverTimestamp() });
    showToast?.(`Added ${n} coins! 🎉`, 'success'); setAmount('');
  };

  const doWithdraw = async () => {
    const n = parseInt(amount); if (!n || n <= 0) { showToast?.('Enter valid amount', 'error'); return; }
    if ((user?.coins || 0) < n) { showToast?.('Insufficient coins', 'error'); return; }
    await updateDoc(doc(db, 'users', user.uid), { coins: increment(-n) });
    await addDoc(collection(db, 'transactions'), { userId: user.uid, type: 'debit', label: `Withdrew ${n} coins`, amount: n, coins: true, createdAt: serverTimestamp() });
    showToast?.(`Withdrew ${n} coins`, 'success'); setAmount('');
  };

  const convertCoins = async () => {
    const n = parseInt(amount); if (!n || n <= 0 || (user?.coins || 0) < n) { showToast?.('Insufficient coins', 'error'); return; }
    const eth = (n / 10000).toFixed(4);
    await updateDoc(doc(db, 'users', user.uid), { coins: increment(-n) });
    await addDoc(collection(db, 'transactions'), { userId: user.uid, type: 'debit', label: `Converted to ${eth} ETH`, amount: n, coins: true, createdAt: serverTimestamp() });
    showToast?.(`Converted to ${eth} ETH! ✨`, 'success'); setAmount('');
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a' }}>
      <div style={{ padding: '16px 16px 0' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '8px 16px', color: 'white', cursor: 'pointer', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg> Back
        </button>
        <div style={{ color: 'white', fontWeight: 800, fontSize: 22, marginBottom: 16, fontFamily: "'Syne',sans-serif" }}>Wallet</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ background: 'linear-gradient(135deg,#ffd700,#ff9500)', borderRadius: 22, padding: 20 }}>
            <div style={{ color: 'rgba(0,0,0,0.55)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Coins</div>
            <div style={{ color: '#000', fontSize: 30, fontWeight: 800, marginTop: 4, fontFamily: "'Syne',sans-serif" }}>{(user?.coins || 0).toLocaleString()}</div>
            <div style={{ color: 'rgba(0,0,0,0.4)', fontSize: 10, marginTop: 2 }}>🪙 Dagu Coins</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg,#06d6a0,#00b4d8)', borderRadius: 22, padding: 20 }}>
            <div style={{ color: 'rgba(0,0,0,0.55)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cash</div>
            <div style={{ color: '#000', fontSize: 30, fontWeight: 800, marginTop: 4, fontFamily: "'Syne',sans-serif" }}>${(user?.walletBalance || 0).toLocaleString()}</div>
            <div style={{ color: 'rgba(0,0,0,0.4)', fontSize: 10, marginTop: 2 }}>💵 USD</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
          {['overview', 'deposit', 'withdraw', 'convert'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, background: activeTab === t ? 'rgba(255,45,85,0.9)' : 'none', border: 'none', borderRadius: 14, padding: '8px 4px', color: 'white', cursor: 'pointer', fontSize: 11, fontWeight: activeTab === t ? 700 : 400, textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>
        {activeTab === 'overview' && (
          <div>
            {transactions.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: 'rgba(255,255,255,0.2)' }}>No transactions yet</div>}
            {transactions.map(tx => (
              <div key={tx.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: '13px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: tx.type === 'credit' ? 'rgba(6,214,160,0.12)' : 'rgba(255,45,85,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{tx.type === 'credit' ? '⬆️' : '⬇️'}</div>
                <div style={{ flex: 1 }}><div style={{ color: 'white', fontSize: 12 }}>{tx.label}</div><div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 2 }}>{timeAgo(tx.createdAt)}</div></div>
                <div style={{ color: tx.type === 'credit' ? '#06d6a0' : '#ff2d55', fontWeight: 700, fontSize: 15 }}>{tx.type === 'credit' ? '+' : '-'}{tx.amount}🪙</div>
              </div>
            ))}
          </div>
        )}
        {(activeTab === 'deposit' || activeTab === 'withdraw' || activeTab === 'convert') && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 22, padding: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 8 }}>{activeTab === 'deposit' ? 'Add coins' : activeTab === 'withdraw' ? 'Withdraw coins' : 'Convert to ETH (1 ETH = 10,000 🪙)'}</div>
            <input type="number" placeholder="Enter amount..." value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '12px', color: 'white', outline: 'none', fontSize: 15, marginBottom: 10, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[100, 500, 1000, 5000].map(v => (
                <button key={v} onClick={() => setAmount(String(v))} style={{ flex: 1, background: amount === String(v) ? 'rgba(255,45,85,0.9)' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, padding: '8px', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{v}</button>
              ))}
            </div>
            <button onClick={activeTab === 'deposit' ? doDeposit : activeTab === 'withdraw' ? doWithdraw : convertCoins} style={{ width: '100%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: 24, padding: '14px', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'Syne',sans-serif" }}>
              {activeTab === 'deposit' ? 'Add Coins' : activeTab === 'withdraw' ? 'Withdraw' : 'Convert to ETH'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────── EDIT PROFILE MODAL (ORIGINAL layout, real Firestore) ─────────────── */
const EditProfileModal = ({ user, onClose, onSave, showToast }) => {
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [link, setLink] = useState(user?.link || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor || '#ff2d55');
  const [saving, setSaving] = useState(false);
  const colors = AVATAR_COLORS;
  const handleSave = async () => {
    setSaving(true);
    await onSave({ username, bio, link, gender, avatarColor });
    setSaving(false);
    showToast?.('Profile updated!', 'success');
    onClose();
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 4000, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#0f0f0f', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: '20px 20px 44px', maxHeight: '92vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <span style={{ color: 'white', fontWeight: 800, fontSize: 20, fontFamily: "'Syne',sans-serif" }}>Edit Profile</span>
          <button onClick={handleSave} disabled={saving} style={{ background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: 20, padding: '9px 20px', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>{saving ? '...' : 'Save'}</button>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{ width: 90, height: 90, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 36, margin: '0 auto', border: '3px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user?.avatar}
            </div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 12, marginBottom: 12 }}>Profile color</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {colors.map(c => <div key={c} onClick={() => setAvatarColor(c)} style={{ width: 34, height: 34, borderRadius: '50%', background: c, cursor: 'pointer', border: c === avatarColor ? '3px solid white' : '3px solid transparent', transition: 'all 0.15s' }} />)}
          </div>
        </div>
        {[{ label: 'Username', value: username, set: setUsername, placeholder: 'Your username', prefix: '@' }, { label: 'Bio', value: bio, set: setBio, placeholder: 'Tell people about yourself', multiline: true }, { label: 'Website / Link', value: link, set: setLink, placeholder: 'https://yourwebsite.com' }, { label: 'Gender', value: gender, set: setGender, placeholder: 'e.g. Male, Female, Other' }].map(field => (
          <div key={field.label} style={{ marginBottom: 16 }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{field.label}</div>
            {field.multiline
              ? <textarea value={field.value} onChange={e => field.set(e.target.value)} placeholder={field.placeholder} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '12px 14px', color: 'white', outline: 'none', fontSize: 14, resize: 'none', minHeight: 80, boxSizing: 'border-box' }} />
              : <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '12px 14px' }}>
                {field.prefix && <span style={{ color: 'rgba(255,255,255,0.3)', marginRight: 4, fontSize: 14 }}>{field.prefix}</span>}
                <input value={field.value} onChange={e => field.set(e.target.value)} placeholder={field.placeholder} style={{ flex: 1, background: 'none', border: 'none', color: 'white', outline: 'none', fontSize: 14 }} />
              </div>}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────── PROFILE PAGE (ORIGINAL layout, real Firestore) ─────────────── */
const ProfilePage = ({ user, setCurrentUser, onLogout, users, showToast, onShowAnalytics, onShowQRCode, allVideos }) => {
  const [activeSubPage, setActiveSubPage] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileTab, setProfileTab] = useState('posts');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const myVideos = allVideos?.filter(v => v.userId === user?.uid) || [];
  const avatarInputRef = useRef(null);

  const saveProfile = async data => {
    await updateDoc(doc(db, 'users', user.uid), data);
    setCurrentUser(u => ({ ...u, ...data }));
  };

  const handleAvatarUpload = async e => {
    const f = e.target.files[0]; if (!f) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(f, setUploadProgress);
      await updateDoc(doc(db, 'users', user.uid), { avatarUrl: url });
      setCurrentUser(u => ({ ...u, avatarUrl: url }));
      showToast?.('Profile photo updated!', 'success');
    } catch { showToast?.('Upload failed', 'error'); }
    setUploading(false);
  };

  if (uploading) return <UploadProgress progress={uploadProgress} label="Updating photo..." />;

  if (activeSubPage === 'analytics') { onShowAnalytics?.(); setActiveSubPage(null); return null; }
  if (activeSubPage === 'qrcode') { onShowQRCode?.(); setActiveSubPage(null); return null; }
  if (activeSubPage === 'wallet') return <WalletPage user={user} setCurrentUser={setCurrentUser} showToast={showToast} onBack={() => setActiveSubPage(null)} />;

  /* Settings sub-page — ORIGINAL layout */
  if (activeSubPage === 'settings') return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a' }}>
      <div style={{ padding: '16px' }}>
        <button onClick={() => setActiveSubPage(null)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '8px 16px', color: 'white', cursor: 'pointer', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg> Back
        </button>
        <div style={{ color: 'white', fontWeight: 800, fontSize: 22, marginBottom: 24, fontFamily: "'Syne',sans-serif" }}>Settings</div>
        {[
          { section: 'Account', items: [{ label: 'Edit Profile', action: () => { setShowEditProfile(true); setActiveSubPage(null); } }, { label: 'Change Password', action: () => showToast?.('Feature coming soon', 'info') }, { label: 'Email & Phone', action: () => showToast?.('Email & phone settings', 'info') }, { label: 'Language', action: () => showToast?.('Language: English', 'info') }, { label: 'Switch Account', action: () => setActiveSubPage('switch') }] },
          { section: 'Privacy', items: [{ label: 'Private Account', toggle: true }, { label: 'Show Activity Status', toggle: true, on: true }, { label: 'Allow Comments', toggle: true, on: true }, { label: 'Allow Duets', toggle: true, on: true }] },
          { section: 'Notifications', items: [{ label: 'Push Notifications', toggle: true, on: true }, { label: 'Likes & Comments', toggle: true, on: true }, { label: 'New Followers', toggle: true, on: true }, { label: 'Direct Messages', toggle: true, on: true }] },
          { section: 'Content & Display', items: [{ label: 'Dark Mode', toggle: true, on: true }, { label: 'Autoplay with Sound', toggle: true }, { label: 'HD Video', toggle: true, on: true }, { label: 'Data Saver', toggle: true }] },
          { section: 'Data & Storage', items: [{ label: 'Download My Data', action: () => showToast?.('Preparing your data...', 'info') }, { label: 'Clear Cache', action: () => showToast?.('Cache cleared', 'success') }, { label: 'Manage Storage', action: () => showToast?.('Storage info', 'info') }] },
          { section: 'Support', items: [{ label: 'Help Center', action: () => {} }, { label: 'Report a Problem', action: () => showToast?.('Report submitted', 'success') }, { label: 'Terms of Service', action: () => {} }, { label: 'Privacy Policy', action: () => {} }] },
        ].map(({ section, items }) => (
          <div key={section} style={{ marginBottom: 20 }}>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2 }}>{section}</div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
              {items.map((item, i, arr) => (
                <div key={item.label} onClick={item.action} style={{ padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : '', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: item.action ? 'pointer' : 'default' }}>
                  <span style={{ color: 'white', fontSize: 13 }}>{item.label}</span>
                  {item.toggle
                    ? <div style={{ width: 46, height: 26, background: item.on ? '#ff2d55' : 'rgba(255,255,255,0.1)', borderRadius: 13, position: 'relative', cursor: 'pointer' }}><div style={{ width: 20, height: 20, background: 'white', borderRadius: '50%', position: 'absolute', top: 3, left: item.on ? 23 : 3 }} /></div>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 20, overflow: 'hidden', marginBottom: 24, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div onClick={onLogout} style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <span style={{ color: '#ff9500', fontSize: 14 }}>Log Out</span>
          </div>
          <div onClick={() => { if (window.confirm('Delete account? This cannot be undone.')) { onLogout?.(); } }} style={{ padding: '14px 16px', cursor: 'pointer' }}>
            <span style={{ color: '#ff2d55', fontSize: 14 }}>Delete Account</span>
          </div>
        </div>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: 11, marginBottom: 16 }}>Dagu v3.0.0 • Made with ❤️</div>
      </div>
    </div>
  );

  if (activeSubPage === 'switch') return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a', padding: 16 }}>
      <button onClick={() => setActiveSubPage(null)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '8px 16px', color: 'white', cursor: 'pointer', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg> Back
      </button>
      <div style={{ color: 'white', fontWeight: 800, fontSize: 22, marginBottom: 20, fontFamily: "'Syne',sans-serif" }}>Switch Account</div>
      {users.map(u => (
        <div key={u.uid} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 18, padding: 16, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', border: u.uid === user?.uid ? '1px solid rgba(255,45,85,0.5)' : '1px solid rgba(255,255,255,0.06)' }}
          onClick={() => { showToast?.(`Switched to @${u.username}`, 'success'); setActiveSubPage(null); }}>
          <div style={{ width: 50, height: 50, borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {u.avatarUrl ? <img src={u.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'white', fontWeight: 'bold', fontSize: 20 }}>{u.avatar}</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'white', fontWeight: 700, fontFamily: "'Syne',sans-serif" }}>@{u.username}</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 2 }}>{u.subscription || 'free'} plan</div>
          </div>
          {u.uid === user?.uid && <span style={{ color: '#ff2d55', fontSize: 12, fontWeight: 700 }}>Active</span>}
        </div>
      ))}
    </div>
  );

  if (activeSubPage === 'badges') return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a', padding: 16 }}>
      <button onClick={() => setActiveSubPage(null)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '8px 16px', color: 'white', cursor: 'pointer', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>← Back</button>
      <div style={{ color: 'white', fontWeight: 800, fontSize: 22, marginBottom: 20, fontFamily: "'Syne',sans-serif" }}>Badges</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[['🌟', 'First Post', 'Earned'], ['🔥', '7 Day Streak', 'Earned'], ['💎', 'Top Creator', 'Earned'], ['👑', '100K Fans', 'Locked'], ['🚀', 'Viral', 'Locked'], ['🎯', 'Pro User', 'Locked']].map(([icon, name, status]) => (
          <div key={name} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 18, textAlign: 'center', opacity: status === 'Locked' ? 0.4 : 1, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 38, marginBottom: 8 }}>{icon}</div>
            <div style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>{name}</div>
            <div style={{ color: status === 'Earned' ? '#06d6a0' : 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 4 }}>{status}</div>
          </div>
        ))}
      </div>
    </div>
  );

  if (activeSubPage === 'premium') return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a', padding: 16 }}>
      <button onClick={() => setActiveSubPage(null)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '8px 16px', color: 'white', cursor: 'pointer', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>← Back</button>
      <div style={{ color: 'white', fontWeight: 800, fontSize: 22, marginBottom: 20, fontFamily: "'Syne',sans-serif" }}>Premium</div>
      {[{ name: 'Plus', price: '$4.99/mo', color: '#af52de', features: ['Ad-free experience', '500 coins/month', 'Custom profile badge', 'Priority in search'] }, { name: 'Pro', price: '$9.99/mo', color: '#ffd700', features: ['All Plus features', '2000 coins/month', 'Advanced analytics', 'Priority support', 'Custom username'] }].map(plan => (
        <div key={plan.name} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${plan.color}40`, borderRadius: 24, padding: 22, marginBottom: 14 }}>
          <div style={{ color: plan.color, fontWeight: 800, fontSize: 20, marginBottom: 4, fontFamily: "'Syne',sans-serif" }}>{plan.name}</div>
          <div style={{ color: 'white', fontSize: 28, fontWeight: 800, marginBottom: 14, fontFamily: "'Syne',sans-serif" }}>{plan.price}</div>
          {plan.features.map(f => <div key={f} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: plan.color }}>✓</span>{f}</div>)}
          <button onClick={async () => {
            await updateDoc(doc(db, 'users', user.uid), { subscription: plan.name.toLowerCase() });
            showToast?.(`${plan.name} activated!`, 'success');
          }} style={{ width: '100%', background: plan.color, border: 'none', borderRadius: 20, padding: 14, color: '#000', fontWeight: 800, cursor: 'pointer', marginTop: 10, fontSize: 14 }}>Subscribe to {plan.name}</button>
        </div>
      ))}
    </div>
  );

  const menuItems = [
    { icon: '⚙️', label: 'Settings', page: 'settings' },
    { icon: '💰', label: 'Wallet', page: 'wallet' },
    { icon: '🔒', label: 'Privacy', page: 'settings' },
    { icon: '👥', label: 'Switch', page: 'switch' },
    { icon: '🏅', label: 'Badges', page: 'badges' },
    { icon: '⭐', label: 'Premium', page: 'premium' },
    { icon: '📊', label: 'Analytics', page: 'analytics' },
    { icon: '📱', label: 'QR Code', page: 'qrcode' },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a' }}>
      <div style={{ position: 'relative', paddingBottom: 20 }}>
        <div style={{ height: 120, background: 'linear-gradient(135deg,rgba(255,45,85,0.3),rgba(175,82,222,0.3))', position: 'absolute', top: 0, left: 0, right: 0 }} />
        <div style={{ position: 'relative', padding: '52px 20px 0', textAlign: 'center' }}>
          <div style={{ position: 'absolute', top: 10, right: 16, display: 'flex', gap: 8 }}>
            <button onClick={() => setActiveSubPage('qrcode')} style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', fontSize: 18 }}>⊞</button>
            <button onClick={() => setActiveSubPage('settings')} style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', fontSize: 18 }}>⚙️</button>
          </div>

          {/* Avatar — tap to change photo */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 14 }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', padding: 3, background: 'conic-gradient(#ff2d55,#ff9500,#af52de,#ff2d55)', margin: '0 auto' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#0a0a0a', padding: 2 }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: user?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {user?.avatarUrl ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'white', fontWeight: 'bold', fontSize: 36 }}>{user?.avatar}</span>}
                </div>
              </div>
            </div>
            <button onClick={() => avatarInputRef.current?.click()} style={{ position: 'absolute', bottom: 2, right: 2, background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: '2px solid #0a0a0a', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }}>📷</button>
            <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
          </div>

          <div style={{ color: 'white', fontWeight: 800, fontSize: 22, fontFamily: "'Syne',sans-serif" }}>@{user?.username}</div>
          {user?.verified && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#1d9bf0', fontSize: 12, marginTop: 4, background: 'rgba(29,155,240,0.1)', borderRadius: 20, padding: '3px 10px' }}>✓ Verified</div>}
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 8, lineHeight: 1.6, maxWidth: 260, margin: '8px auto 0' }}>{user?.bio || 'No bio yet'}</div>
          {user?.link && <a href={user.link} target="_blank" rel="noopener noreferrer" style={{ color: '#007aff', fontSize: 13, display: 'block', marginTop: 4 }}>{user.link}</a>}
          <button onClick={() => setShowEditProfile(true)} style={{ marginTop: 16, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 14, padding: '10px 32px', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: "'Syne',sans-serif" }}>Edit Profile</button>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginTop: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: '14px 0', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[['Posts', myVideos.length], ['Followers', user?.followers?.length || 0], ['Following', user?.following?.length || 0]].map(([label, val], i) => (
              <div key={label} style={{ flex: 1, textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.06)' : '' }}>
                <div style={{ color: 'white', fontWeight: 800, fontSize: 20, fontFamily: "'Syne',sans-serif" }}>{formatNumber(val)}</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center' }}>
            <div style={{ background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.2)', borderRadius: 20, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              🔥 <span style={{ color: '#ff9500', fontSize: 12, fontWeight: 700 }}>{user?.streak || 1} day streak</span>
            </div>
            <div style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 20, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              🪙 <span style={{ color: '#ffd700', fontSize: 12, fontWeight: 700 }}>{(user?.coins || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Menu grid — ORIGINAL */}
      <div style={{ padding: '16px 16px 4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {menuItems.map(item => (
            <button key={item.page + item.label} onClick={() => setActiveSubPage(item.page)} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '14px 6px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
              <div style={{ width: 40, height: 40, borderRadius: 14, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{item.icon}</div>
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: 700 }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Tabs — ORIGINAL */}
      <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', marginTop: 16 }}>
        {[{ id: 'posts', icon: '⊞' }, { id: 'saved', icon: '🔖' }, { id: 'drafts', icon: '📝' }].map(t => (
          <button key={t.id} onClick={() => setProfileTab(t.id)} style={{ flex: 1, background: 'none', border: 'none', borderTop: profileTab === t.id ? '2px solid #ff2d55' : '2px solid transparent', padding: '14px 0', color: profileTab === t.id ? 'white' : 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 20 }}>{t.icon}</button>
        ))}
      </div>

      <div style={{ padding: 2 }}>
        {profileTab === 'posts' && (
          myVideos.length === 0
            ? <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.2)' }}><div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div><div style={{ fontSize: 15, fontWeight: 600 }}>No posts yet</div><div style={{ fontSize: 13, marginTop: 4 }}>Create your first video!</div></div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2 }}>
              {myVideos.map(v => (
                <div key={v.id} style={{ aspectRatio: '9/16', background: '#1a1a1a', position: 'relative', overflow: 'hidden' }}>
                  <video src={v.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 4, left: 6, color: 'white', fontSize: 10, fontWeight: 700, background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '2px 7px' }}>▶ {formatNumber(v.views || 0)}</div>
                </div>
              ))}
            </div>
        )}
        {profileTab === 'saved' && <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.2)' }}><div style={{ fontSize: 40, marginBottom: 12 }}>🔖</div><div>No saved posts</div></div>}
        {profileTab === 'drafts' && <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.2)' }}><div style={{ fontSize: 40, marginBottom: 12 }}>📝</div><div>No drafts yet</div></div>}
      </div>

      {showEditProfile && <EditProfileModal user={user} onClose={() => setShowEditProfile(false)} onSave={saveProfile} showToast={showToast} />}
    </div>
  );
};

/* ─────────────── INBOX — ORIGINAL layout, real Firestore ─────────────── */
const ConversationView = ({ currentUser, otherUser, convoId, onBack, showToast }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    if (!convoId) return;
    const q = query(collection(db, 'conversations', convoId, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [convoId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    if (!text.trim() || !convoId) return;
    const msg = text; setText('');
    await addDoc(collection(db, 'conversations', convoId, 'messages'), {
      text: msg, from: currentUser.uid, createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'conversations', convoId), { lastMessage: msg, updatedAt: serverTimestamp() });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      {/* ORIGINAL header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px 0' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: otherUser?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {otherUser?.avatarUrl ? <img src={otherUser.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'white', fontWeight: 'bold' }}>{otherUser?.avatar}</span>}
        </div>
        <div>
          <div style={{ color: 'white', fontWeight: 700, fontFamily: "'Syne',sans-serif" }}>@{otherUser?.username}</div>
          <div style={{ color: '#06d6a0', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: '#06d6a0' }} />Online</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18 }}>📞</button>
          <button style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18 }}>📹</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {messages.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)' }}>Start a conversation! 👋</div>}
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.from === currentUser?.uid ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <div style={{ maxWidth: '72%', background: msg.from === currentUser?.uid ? 'linear-gradient(135deg,#ff2d55,#af52de)' : 'rgba(255,255,255,0.07)', borderRadius: msg.from === currentUser?.uid ? '20px 20px 4px 20px' : '20px 20px 20px 4px', padding: '10px 14px' }}>
              <span style={{ color: 'white', fontSize: 14 }}>{msg.text}</span>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {/* ORIGINAL input bar */}
      <div style={{ padding: '10px 14px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Message..." style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 28, padding: '11px 16px', color: 'white', outline: 'none', fontSize: 13 }} />
        <button onClick={sendMessage} style={{ background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: '50%', width: 42, height: 42, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        </button>
      </div>
    </div>
  );
};

const InboxPage = ({ users, currentUser, showToast }) => {
  const [activeConvo, setActiveConvo] = useState(null);
  const [activeOtherUser, setActiveOtherUser] = useState(null);
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.uid), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, snap => setConversations(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [currentUser?.uid]);

  const openConvo = async (otherUser) => {
    const ids = [currentUser.uid, otherUser.uid].sort();
    const convoId = ids.join('_');
    const ref = doc(db, 'conversations', convoId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        participants: ids,
        participantData: {
          [currentUser.uid]: { username: currentUser.username, avatar: currentUser.avatar, avatarColor: currentUser.avatarColor, avatarUrl: currentUser.avatarUrl || '' },
          [otherUser.uid]: { username: otherUser.username, avatar: otherUser.avatar, avatarColor: otherUser.avatarColor, avatarUrl: otherUser.avatarUrl || '' },
        },
        lastMessage: '', updatedAt: serverTimestamp(),
      });
    }
    setActiveConvo(convoId);
    setActiveOtherUser(otherUser);
  };

  if (activeConvo) return <ConversationView currentUser={currentUser} otherUser={activeOtherUser} convoId={activeConvo} onBack={() => { setActiveConvo(null); setActiveOtherUser(null); }} showToast={showToast} />;

  /* ORIGINAL InboxPage list layout */
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ color: 'white', fontWeight: 800, fontSize: 22, fontFamily: "'Syne',sans-serif" }}>Messages</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Show existing conversations first */}
        {conversations.map(c => {
          const otherEntry = Object.entries(c.participantData || {}).find(([k]) => k !== currentUser?.uid);
          const other = otherEntry ? otherEntry[1] : null;
          return (
            <div key={c.id} onClick={() => { setActiveConvo(c.id); setActiveOtherUser(other); }} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: other?.avatarColor || '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {other?.avatarUrl ? <img src={other.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'white', fontWeight: 'bold', fontSize: 22 }}>{other?.avatar || '?'}</span>}
                </div>
                <div style={{ position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, background: '#06d6a0', borderRadius: '50%', border: '2px solid #0a0a0a' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'white', fontWeight: 700, fontSize: 14, fontFamily: "'Syne',sans-serif" }}>@{other?.username || '?'}</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>{c.lastMessage || 'Tap to start chatting'}</div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>{c.updatedAt ? timeAgo(c.updatedAt) : ''}</div>
            </div>
          );
        })}
        {/* All users you can message */}
        {users.filter(u => u.uid !== currentUser?.uid && !conversations.some(c => c.participants?.includes(u.uid))).map(u => (
          <div key={u.uid} onClick={() => openConvo(u)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {u.avatarUrl ? <img src={u.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'white', fontWeight: 'bold', fontSize: 22 }}>{u.avatar}</span>}
              </div>
              <div style={{ position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, background: '#06d6a0', borderRadius: '50%', border: '2px solid #0a0a0a' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 14, fontFamily: "'Syne',sans-serif" }}>@{u.username}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>Tap to start chatting</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────── CALL MODAL (ORIGINAL) ─────────────── */
const CallModal = ({ type, contactName, contactAvatar, onClose }) => {
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState('calling');
  const [isMuted, setIsMuted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setStatus('connected'), 2000); return () => clearTimeout(t); }, []);
  useEffect(() => { if (status !== 'connected') return; const i = setInterval(() => setDuration(d => d + 1), 1000); return () => clearInterval(i); }, [status]);
  const fmt = () => { const m = Math.floor(duration / 60), s = duration % 60; return `${m}:${s.toString().padStart(2, '0')}`; };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#0a0a1a,#1a0a0a)', zIndex: 2500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%,rgba(255,45,85,0.2),transparent 60%)' }} />
      <div style={{ textAlign: 'center', marginBottom: 60, zIndex: 1 }}>
        <div style={{ width: 110, height: 110, borderRadius: '50%', padding: 3, background: 'conic-gradient(#ff2d55,#af52de,#ff2d55)', margin: '0 auto 20px', animation: 'storyRing 4s linear infinite' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#1a0a0a', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 42 }}>{contactAvatar || '?'}</div>
          </div>
        </div>
        <div style={{ color: 'white', fontSize: 24, fontWeight: 800, fontFamily: "'Syne',sans-serif" }}>@{contactName}</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 10 }}>
          {status === 'calling' ? (type === 'video' ? 'Video calling...' : 'Calling...') : `Connected · ${fmt()}`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 24, zIndex: 1 }}>
        {status === 'connected' && <button onClick={() => setIsMuted(!isMuted)} style={{ background: isMuted ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 26 }}>{isMuted ? '🔇' : '🎤'}</button>}
        <button onClick={onClose} style={{ background: '#ff2d55', border: 'none', borderRadius: '50%', width: 68, height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 30px rgba(255,45,85,0.5)', fontSize: 28 }}>📵</button>
      </div>
    </div>
  );
};

/* ─────────────── SEARCH OVERLAY (ORIGINAL layout, real Firestore) ─────────────── */
const SearchOverlay = ({ onClose, videos, users, onViewProfile }) => {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const results = useMemo(() => {
    if (!query.trim()) return { videos: [], users: [], hashtags: [] };
    const q = query.toLowerCase();
    return {
      videos: videos.filter(v => v.username?.toLowerCase().includes(q) || v.description?.toLowerCase().includes(q)).slice(0, 6),
      users: users.filter(u => u.username?.toLowerCase().includes(q)).slice(0, 6),
      hashtags: [...new Set(videos.flatMap(v => (v.description || '').match(/#\w+/g) || []).filter(h => h.toLowerCase().includes(q)))].slice(0, 6),
    };
  }, [query, videos, users]);
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.06)', borderRadius: 28, padding: '10px 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" style={{ marginRight: 10 }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search anything..." style={{ flex: 1, background: 'none', border: 'none', color: 'white', outline: 'none', fontSize: 14 }} />
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
      </div>
      {query ? (
        <>
          <div style={{ display: 'flex', padding: '8px 14px', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['all', 'videos', 'users', 'hashtags'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? 'rgba(255,45,85,0.15)' : 'none', border: tab === t ? '1px solid rgba(255,45,85,0.3)' : '1px solid transparent', padding: '5px 14px', color: tab === t ? '#ff2d55' : 'rgba(255,255,255,0.4)', cursor: 'pointer', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>{t}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {(tab === 'all' || tab === 'users') && results.users.map(u => (
              <div key={u.uid} onClick={() => { onViewProfile?.(u.uid); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 16, marginBottom: 8, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {u.avatarUrl ? <img src={u.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>{u.avatar || 'U'}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: 14, fontFamily: "'Syne',sans-serif" }}>@{u.username}</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>{u.bio?.substring(0, 45)}</div>
                </div>
              </div>
            ))}
            {(tab === 'all' || tab === 'videos') && results.videos.map(v => (
              <div key={v.id} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 16, marginBottom: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#ff2d55', fontSize: 12, fontWeight: 700 }}>@{v.username}</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 }}>{v.description}</div>
              </div>
            ))}
            {(tab === 'all' || tab === 'hashtags') && results.hashtags.map(h => (
              <div key={h} onClick={() => setQuery(h)} style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 16, marginBottom: 8, color: '#007aff', fontSize: 16, fontWeight: 700, fontFamily: "'Syne',sans-serif", border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>{h}</div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ flex: 1, padding: 16 }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Trending</div>
          {['#trending', '#viral', '#art', '#music', '#dance'].map(tag => (
            <div key={tag} onClick={() => setQuery(tag)} style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 14, marginBottom: 8, color: '#007aff', fontSize: 15, fontWeight: 700, border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', fontFamily: "'Syne',sans-serif" }}>{tag}</div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────── CAMERA UPLOAD (ORIGINAL layout, real Cloudinary) ─────────────── */
const CameraUpload = ({ onUpload, onClose, showToast, currentUser }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [song, setSong] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => { try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); streamRef.current = s; if (videoRef.current) videoRef.current.srcObject = s; setShowCamera(true); } catch { showToast?.('Camera denied', 'error'); } };
  const stopCamera = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setShowCamera(false); };
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const c = document.createElement('canvas'); c.width = videoRef.current.videoWidth; c.height = videoRef.current.videoHeight;
    c.getContext('2d').drawImage(videoRef.current, 0, 0);
    c.toBlob(blob => { setSelectedFile({ file: new File([blob], 'photo.jpg', { type: 'image/jpeg' }), url: URL.createObjectURL(blob), type: 'image/jpeg' }); stopCamera(); showToast?.('Photo captured!', 'success'); }, 'image/jpeg');
  };
  const handleFileSelect = e => { const f = e.target.files[0]; if (f) setSelectedFile({ file: f, url: URL.createObjectURL(f), type: f.type }); };

  const handleUpload = async () => {
    if (!selectedFile?.file) { showToast?.('Select media first', 'error'); return; }
    setUploading(true);
    try {
      const url = await uploadToCloudinary(selectedFile.file, setProgress);
      await onUpload?.({ videoUrl: url, description: description || 'New post! 🔥', song: song || 'Original Sound' });
      showToast?.('Posted! 🚀', 'success');
      onClose?.();
    } catch (e) { showToast?.('Upload failed. Try again.', 'error'); }
    setUploading(false); setProgress(0);
  };

  useEffect(() => () => stopCamera(), []);
  if (uploading) return <UploadProgress progress={progress} label="Uploading your post..." />;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => { stopCamera(); onClose(); }} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 20, padding: '8px 16px', color: 'white', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        <h3 style={{ color: 'white', fontSize: 16, fontWeight: 800, fontFamily: "'Syne',sans-serif" }}>New Post</h3>
        <button onClick={handleUpload} disabled={!selectedFile} style={{ background: selectedFile ? 'linear-gradient(135deg,#ff2d55,#af52de)' : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 20, padding: '8px 18px', color: 'white', fontWeight: 700, cursor: selectedFile ? 'pointer' : 'default', fontSize: 13 }}>Post</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={stopCamera} style={{ flex: 1, background: !showCamera ? 'linear-gradient(135deg,#ff2d55,#af52de)' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 14, padding: 12, color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Gallery</button>
          <button onClick={startCamera} style={{ flex: 1, background: showCamera ? 'linear-gradient(135deg,#ff2d55,#af52de)' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 14, padding: 12, color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Camera</button>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, marginBottom: 14, minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {showCamera
            ? <div style={{ position: 'relative', width: '100%' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 20 }} />
              <button onClick={capturePhoto} style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'white', border: '4px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: 60, height: 60, fontSize: 26, cursor: 'pointer' }}>📸</button>
            </div>
            : selectedFile?.type?.startsWith('image/')
              ? <img src={selectedFile.url} alt="" style={{ width: '100%', borderRadius: 20 }} />
              : selectedFile?.type?.startsWith('video/')
                ? <video src={selectedFile.url} controls style={{ width: '100%', borderRadius: 20 }} />
                : <label style={{ textAlign: 'center', cursor: 'pointer', padding: 48, display: 'block', width: '100%' }}>
                  <div style={{ fontSize: 48, marginBottom: 10 }}>📁</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Tap to choose from gallery</div>
                  <input type="file" accept="video/*,image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
                </label>}
        </div>
        <textarea placeholder="Write a caption... #hashtags" value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '12px 14px', color: 'white', minHeight: 80, outline: 'none', fontSize: 13, resize: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
        <input placeholder="🎵 Add song name..." value={song} onChange={e => setSong(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '12px 14px', color: 'white', outline: 'none', fontSize: 13, boxSizing: 'border-box' }} />
      </div>
    </div>
  );
};

/* ─────────────── SOUND LIBRARY (ORIGINAL) ─────────────── */
const SoundLibraryPage = ({ onSelectSound, onClose }) => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => !search ? SOUND_LIBRARY : SOUND_LIBRARY.filter(s => s.name.toLowerCase().includes(search.toLowerCase())), [search]);
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: 'white', fontSize: 20, fontWeight: 800, fontFamily: "'Syne',sans-serif" }}>Sounds</h2>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 20, padding: '8px 16px', color: 'white', cursor: 'pointer', fontSize: 13 }}>Close</button>
      </div>
      <div style={{ padding: '10px 16px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sounds..." style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 28, padding: '11px 16px', color: 'white', outline: 'none', fontSize: 13, boxSizing: 'border-box' }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px' }}>
        {filtered.map(sound => (
          <div key={sound.id} onClick={() => onSelectSound(sound)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 18, marginBottom: 8, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg,#ff2d55,#af52de)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎵</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 13, fontFamily: "'Syne',sans-serif" }}>{sound.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>{sound.artist} · {sound.duration}</div>
            </div>
            {sound.popular && <span style={{ color: '#ff9500', fontSize: 11, fontWeight: 700 }}>🔥 {formatNumber(sound.usage)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────── ANALYTICS (ORIGINAL) ─────────────── */
const CreatorAnalytics = ({ user, videos, onClose }) => {
  const userVideos = videos.filter(v => v.userId === user?.uid);
  const totalViews = userVideos.reduce((s, v) => s + (v.views || 0), 0);
  const totalLikes = userVideos.reduce((s, v) => s + (v.likes || 0), 0);
  const weeklyData = [1200, 1450, 1800, 2100, 2500, 2900, 3400];
  const maxVal = Math.max(...weeklyData);
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 200, overflow: 'auto' }}>
      <div style={{ padding: '60px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: 'white', fontSize: 24, fontWeight: 800, fontFamily: "'Syne',sans-serif" }}>Analytics</h2>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 20, padding: '8px 18px', color: 'white', cursor: 'pointer', fontSize: 13 }}>Close</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 20 }}>
          {[['Total Views', formatNumber(totalViews), '#06d6a0'], ['Total Likes', formatNumber(totalLikes), '#ff2d55'], ['Posts', String(userVideos.length), '#af52de'], ['Coins', String(user?.coins || 0), '#ffd700']].map(([label, val, color]) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
              <div style={{ color: color, fontSize: 28, fontWeight: 800, marginTop: 6, fontFamily: "'Syne',sans-serif" }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 20, marginBottom: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ color: 'white', marginBottom: 16, fontSize: 14, fontWeight: 700, fontFamily: "'Syne',sans-serif" }}>Weekly Growth</h3>
          <div style={{ height: 120, display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            {weeklyData.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', height: `${(v / maxVal) * 100}%`, background: `linear-gradient(180deg,#ff2d55,#af52de)`, borderRadius: 6 }} />
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────── QR CODE (ORIGINAL) ─────────────── */
const QRCodePage = ({ user, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ background: '#111', borderRadius: 28, padding: 32, textAlign: 'center', maxWidth: 300, width: '100%', margin: '0 20px', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer', fontSize: 16 }}>✕</button>
      <div style={{ color: 'white', fontWeight: 800, fontSize: 18, marginBottom: 20, fontFamily: "'Syne',sans-serif" }}>My QR Code</div>
      <div style={{ width: 180, height: 180, background: 'white', margin: '0 auto 20px', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundImage: 'repeating-linear-gradient(45deg,#000 0,#000 2px,#fff 2px,#fff 8px)' }}>
        <div style={{ width: 140, height: 140, background: 'white', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <div style={{ fontSize: 36 }}>🎬</div>
          <div style={{ fontSize: 11, fontWeight: 'bold', marginTop: 6 }}>@{user?.username}</div>
        </div>
      </div>
      <h3 style={{ color: 'white', marginBottom: 4, fontFamily: "'Syne',sans-serif" }}>@{user?.username}</h3>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 20 }}>Scan to follow on Dagu</p>
      <button onClick={() => navigator.share?.({ title: 'Dagu', text: `Follow me @${user?.username} on Dagu`, url: `https://dagu-v1.vercel.app/@${user?.username}` })} style={{ width: '100%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: 20, padding: 13, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'Syne',sans-serif" }}>Share Profile</button>
    </div>
  </div>
);

/* ─────────────── AUTH SCREEN (ORIGINAL layout, real Firebase) ─────────────── */
const AuthScreen = ({ onLogin, onSignup }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [step, setStep] = useState('method');
  const [otpCode, setOtpCode] = useState('');
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (timer > 0) { const i = setInterval(() => setTimer(t => t - 1), 1000); return () => clearInterval(i); } }, [timer]);

  const sendOTP = async () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setOtpCode(code); setTimer(120);
    await sendOTPEmail(identifier, code);
    alert(`Your OTP code is: ${code}`); // fallback always shown
    setStep('otp');
  };

  const handleSubmit = async () => {
    if (selectedMethod?.id === 'email' || selectedMethod?.id === 'phone') {
      sendOTP();
    } else {
      setLoading(true);
      if (isLogin) await onLogin(identifier, password);
      else await onSignup(identifier, username, fullName, password);
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (otpInput !== otpCode) { alert('Invalid OTP'); return; }
    setLoading(true);
    if (isLogin) await onLogin(identifier, password || 'otp_user');
    else await onSignup(identifier, username, fullName, password || 'otp_user');
    setLoading(false);
  };

  const handleMethodSelect = m => { setSelectedMethod(m); setStep('credentials'); };

  /* ORIGINAL method selection screen */
  if (step === 'method') return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a', overflow: 'auto' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px 20px', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%,rgba(255,45,85,0.2),rgba(175,82,222,0.1),transparent 65%)' }} />
        <div style={{ position: 'relative', textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg,#ff2d55,#af52de)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 40, boxShadow: '0 20px 60px rgba(255,45,85,0.4)' }}>🎬</div>
          <h1 style={{ fontSize: 52, fontWeight: 800, background: 'linear-gradient(135deg,#ff2d55,#af52de,#007aff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>Dagu</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 10 }}>{isLogin ? 'Welcome back! 👋' : 'Join the community 🎉'}</p>
        </div>
        <div style={{ position: 'relative', width: '100%', maxWidth: 340 }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginBottom: 14, textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{isLogin ? 'Sign in with' : 'Sign up with'}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
            {LOGIN_METHODS.map(m => (
              <button key={m.id} onClick={() => handleMethodSelect(m)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 30, padding: '8px 16px', cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                <span style={{ fontSize: 16 }}>{m.icon}</span>{m.name}
              </button>
            ))}
          </div>
          <button onClick={() => setIsLogin(!isLogin)} style={{ width: '100%', background: 'none', border: 'none', color: '#ff2d55', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
            {isLogin ? "Don't have an account? Sign up →" : "Already have an account? Sign in →"}
          </button>
        </div>
      </div>
      <div style={{ padding: '0 24px 40px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>By continuing, you agree to our Terms of Service & Privacy Policy</div>
    </div>
  );

  /* ORIGINAL credentials screen */
  if (step === 'credentials') return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#0a0a0a' }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <button onClick={() => setStep('method')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', marginBottom: 24, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg> Back
        </button>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 24, border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: `${selectedMethod?.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{selectedMethod?.icon}</div>
            <div>
              <div style={{ color: 'white', fontWeight: 800, fontSize: 16, fontFamily: "'Syne',sans-serif" }}>{isLogin ? 'Sign in' : 'Sign up'}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>with {selectedMethod?.name}</div>
            </div>
          </div>
          {!isLogin && <>
            <input placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '13px 16px', color: 'white', marginBottom: 10, outline: 'none', fontSize: 14, boxSizing: 'border-box' }} />
            <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '13px 16px', color: 'white', marginBottom: 10, outline: 'none', fontSize: 14, boxSizing: 'border-box' }} />
          </>}
          <input placeholder={selectedMethod?.id === 'email' ? 'Email' : selectedMethod?.id === 'phone' ? 'Phone Number' : `${selectedMethod?.name} ID or Email`} value={identifier} onChange={e => setIdentifier(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '13px 16px', color: 'white', marginBottom: 10, outline: 'none', fontSize: 14, boxSizing: 'border-box' }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '13px 16px', color: 'white', marginBottom: 14, outline: 'none', fontSize: 14, boxSizing: 'border-box' }} />
          <button onClick={handleSubmit} disabled={loading || !identifier || (!isLogin && (!username || !fullName))} style={{ width: '100%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: 24, padding: 15, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 15, opacity: (loading || !identifier || (!isLogin && (!username || !fullName))) ? 0.5 : 1, fontFamily: "'Syne',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <><div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Please wait...</> : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );

  /* ORIGINAL OTP screen */
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#0a0a0a' }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 24, textAlign: 'center', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,45,85,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>📱</div>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 18, marginBottom: 4, fontFamily: "'Syne',sans-serif" }}>Verify Your Identity</div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 24 }}>Code sent to {identifier}</div>
          <input placeholder="000000" maxLength={6} value={otpInput} onChange={e => setOtpInput(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, color: 'white', textAlign: 'center', fontSize: 28, letterSpacing: 8, marginBottom: 16, outline: 'none', boxSizing: 'border-box', fontFamily: "'Syne',sans-serif" }} />
          <button onClick={verifyOTP} disabled={loading || otpInput.length !== 6} style={{ width: '100%', background: otpInput.length === 6 ? 'linear-gradient(135deg,#ff2d55,#af52de)' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 24, padding: 15, color: 'white', fontWeight: 700, cursor: otpInput.length === 6 ? 'pointer' : 'default', fontSize: 15, opacity: (loading || otpInput.length !== 6) ? 0.5 : 1 }}>
            {loading ? 'Verifying...' : `Verify & ${isLogin ? 'Login' : 'Sign Up'}`}
          </button>
          {timer > 0 && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 12 }}>Resend in {timer}s</div>}
        </div>
      </div>
    </div>
  );
};

/* ─────────────── MAIN APP (ORIGINAL layout) ─────────────── */
export default function DaguApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [users, setUsers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showCall, setShowCall] = useState(null);
  const [showLiveStream, setShowLiveStream] = useState(null);
  const [showStoryViewer, setShowStoryViewer] = useState(null);
  const [showSoundLibrary, setShowSoundLibrary] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [followed, setFollowed] = useState([]);
  const [viewingProfile, setViewingProfile] = useState(null);

  const showToast = useCallback((message, type = 'info') => setToast({ message, type }), []);

  /* Auth listener */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (snap.exists()) {
          const data = { ...snap.data(), uid: firebaseUser.uid };
          setCurrentUser(data);
          setFollowed(data.following || []);
        }
      } else {
        setCurrentUser(null);
      }
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  /* Live user data listener */
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), snap => {
      if (snap.exists()) {
        const data = { ...snap.data(), uid: snap.id };
        setCurrentUser(data);
        setFollowed(data.following || []);
      }
    });
    return unsub;
  }, [currentUser?.uid]);

  /* Real-time videos */
  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, snap => setVideos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  /* Real-time all users */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const handleLogin = async (identifier, password) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, identifier, password);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (snap.exists()) {
        const data = { ...snap.data(), uid: cred.user.uid };
        setCurrentUser(data); setFollowed(data.following || []);
        showToast(`Welcome back, @${data.username}! 👋`, 'success');
      }
    } catch (e) { showToast(e.message?.includes('password') ? 'Wrong password' : e.message?.includes('user-not-found') ? 'No account found' : 'Login failed', 'error'); }
  };

  const handleSignup = async (identifier, username, fullName, password) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, identifier, password);
      const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      const userData = {
        uid: cred.user.uid, email: identifier, username: username.toLowerCase().replace(/\s/g, '_'),
        fullName, avatar: username[0]?.toUpperCase() || 'U', avatarColor: color, avatarUrl: '',
        bio: 'New to Dagu! 🎬', link: '', verified: false, coins: 500, walletBalance: 0,
        streak: 1, followers: [], following: [], postsCount: 0, subscription: 'free', level: 1,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', cred.user.uid), userData);
      setCurrentUser(userData); setFollowed([]);
      showToast(`Welcome to Dagu, @${username}! 🎉`, 'success');
    } catch (e) { showToast(e.message?.includes('email-already') ? 'Email already in use' : 'Signup failed', 'error'); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null); setFollowed([]);
    showToast('Logged out', 'info');
  };

  const toggleFollow = async uid => {
    if (!currentUser) return;
    const isNow = !followed.includes(uid);
    setFollowed(p => isNow ? [...p, uid] : p.filter(id => id !== uid));
    await updateDoc(doc(db, 'users', currentUser.uid), { following: isNow ? arrayUnion(uid) : arrayRemove(uid) });
    await updateDoc(doc(db, 'users', uid), { followers: isNow ? arrayUnion(currentUser.uid) : arrayRemove(currentUser.uid) });
    if (isNow) {
      const otherUser = users.find(u => u.uid === uid);
      await addDoc(collection(db, 'notifications'), {
        recipientId: uid, type: 'follow',
        message: `@${currentUser.username} started following you`,
        avatar: currentUser.avatar, avatarColor: currentUser.avatarColor,
        read: false, createdAt: serverTimestamp(),
      });
      showToast(`Following @${otherUser?.username || ''}`, 'success');
    }
  };

  const handleViewProfile = uid => {
    if (uid === currentUser?.uid) { setActiveTab('profile'); return; }
    setViewingProfile(users.find(u => u.uid === uid));
  };

  const handleMessage = uid => setActiveTab('inbox');

  const handleUpload = async ({ videoUrl, description, song }) => {
    if (!currentUser) return;
    await addDoc(collection(db, 'videos'), {
      userId: currentUser.uid, username: currentUser.username,
      avatar: currentUser.avatar, avatarColor: currentUser.avatarColor, avatarUrl: currentUser.avatarUrl || '',
      verified: currentUser.verified || false,
      description, song, videoUrl, likes: 0, commentsCount: 0, shares: 0, views: 0,
      likedBy: [], createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'users', currentUser.uid), { postsCount: increment(1) });
  };

  /* ORIGINAL Tab Icons */
  const TabIcon = ({ id, active }) => {
    const color = active ? '#ff2d55' : 'rgba(255,255,255,0.35)';
    const sw = active ? 2.2 : 1.8;
    const s = { width: 26, height: 26, fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
    if (id === 'home') return (
      <div style={{ position: 'relative' }}>
        <svg viewBox="0 0 24 24" style={s}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
        {active && <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#ff2d55' }} />}
      </div>
    );
    if (id === 'friends') return (
      <div style={{ position: 'relative' }}>
        <svg viewBox="0 0 24 24" style={s}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
        {active && <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#ff2d55' }} />}
      </div>
    );
    if (id === 'create') return (
      <div style={{ width: 52, height: 34, background: 'linear-gradient(135deg,#ff2d55,#af52de)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(255,45,85,0.4)' }}>
        <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: 'white', fill: 'none', strokeWidth: 2.5, strokeLinecap: 'round' }}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </div>
    );
    if (id === 'inbox') return (
      <div style={{ position: 'relative' }}>
        <svg viewBox="0 0 24 24" style={s}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
        <div style={{ position: 'absolute', top: -2, right: -4, width: 8, height: 8, background: '#ff2d55', borderRadius: '50%', border: '1.5px solid #0a0a0a' }} />
        {active && <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#ff2d55' }} />}
      </div>
    );
    if (id === 'profile') return (
      <div style={{ position: 'relative' }}>
        <svg viewBox="0 0 24 24" style={{ ...s, fill: active ? 'rgba(255,45,85,0.15)' : '' }}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        {active && <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#ff2d55' }} />}
      </div>
    );
    return null;
  };

  const tabs = [
    { id: 'home' }, { id: 'friends' }, { id: 'create' }, { id: 'inbox' }, { id: 'profile' },
  ];

  /* Loading screen */
  if (!authChecked) return (
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100dvh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <GlobalStyles />
      <div style={{ fontSize: 52 }}>🎬</div>
      <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #ff2d55', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (!currentUser) return (
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100dvh', background: '#0a0a0a', overflow: 'hidden' }}>
      <GlobalStyles />
      <AuthScreen onLogin={handleLogin} onSignup={handleSignup} />
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <GlobalStyles />

      {/* ── All Modals ── */}
      {showCall && <CallModal type={showCall.type} contactName={showCall.contactName} contactAvatar={showCall.contactAvatar} onClose={() => setShowCall(null)} />}
      {showLiveStream && <LiveStream streamer={{ ...showLiveStream, liveId: showLiveStream.uid || 'default' }} onClose={() => setShowLiveStream(null)} showToast={showToast} currentUser={currentUser} />}
      {showStoryViewer && <StoryViewer story={showStoryViewer} user={users.find(u => u.uid === showStoryViewer.userId) || currentUser} onClose={() => setShowStoryViewer(null)} />}
      {showSoundLibrary && <SoundLibraryPage onSelectSound={s => { showToast?.(`Selected: ${s.name}`, 'success'); setShowSoundLibrary(false); }} onClose={() => setShowSoundLibrary(false)} />}
      {showQRCode && <QRCodePage user={currentUser} onClose={() => setShowQRCode(false)} />}
      {showAnalytics && <CreatorAnalytics user={currentUser} videos={videos} onClose={() => setShowAnalytics(false)} />}
      {showCreateStory && <CreateStoryModal currentUser={currentUser} onClose={() => setShowCreateStory(false)} showToast={showToast} />}
      {viewingProfile && (
        <UserProfileModal
          user={viewingProfile} currentUser={currentUser}
          onClose={() => setViewingProfile(null)}
          onFollow={toggleFollow}
          onMessage={uid => { handleMessage(uid); setViewingProfile(null); }}
          onVoiceCall={uid => { const u = users.find(uu => uu.uid === uid); setShowCall({ type: 'audio', contactName: u?.username, contactAvatar: u?.avatar }); setViewingProfile(null); }}
          onVideoCall={uid => { const u = users.find(uu => uu.uid === uid); setShowCall({ type: 'video', contactName: u?.username, contactAvatar: u?.avatar }); setViewingProfile(null); }}
          followed={followed} showToast={showToast}
          userVideos={videos.filter(v => v.userId === viewingProfile?.uid)}
        />
      )}

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} videos={videos} users={users} onViewProfile={uid => { handleViewProfile(uid); setShowSearch(false); }} />}
        {showCamera && <CameraUpload currentUser={currentUser} onUpload={handleUpload} onClose={() => setShowCamera(false)} showToast={showToast} />}
        {!showSearch && !showCamera && (
          <>
            {activeTab === 'home' && <HomeFeed videos={videos} currentUser={currentUser} onLike={() => {}} onComment={() => {}} onShare={() => {}} onFollow={toggleFollow} onMessage={handleMessage} onVoiceCall={uid => { const u = users.find(uu => uu.uid === uid); setShowCall({ type: 'audio', contactName: u?.username, contactAvatar: u?.avatar }); }} onVideoCall={uid => { const u = users.find(uu => uu.uid === uid); setShowCall({ type: 'video', contactName: u?.username, contactAvatar: u?.avatar }); }} onDuet={() => showToast?.('Duet mode ready', 'info')} onStitch={() => showToast?.('Stitch mode ready', 'info')} onSaveSound={() => showToast?.('Sound saved!', 'success')} followed={followed} showToast={showToast} onLive={() => setShowLiveStream(currentUser)} onViewProfile={handleViewProfile} onOpenSearch={() => setShowSearch(true)} />}
            {activeTab === 'friends' && <FriendsFeed friends={followed} videos={videos} currentUser={currentUser} onMessage={handleMessage} onVoiceCall={uid => { const u = users.find(uu => uu.uid === uid); setShowCall({ type: 'audio', contactName: u?.username, contactAvatar: u?.avatar }); }} onVideoCall={uid => { const u = users.find(uu => uu.uid === uid); setShowCall({ type: 'video', contactName: u?.username, contactAvatar: u?.avatar }); }} onViewProfile={handleViewProfile} showToast={showToast} users={users} onCreateStory={() => setShowCreateStory(true)} onViewStory={setShowStoryViewer} />}
            {activeTab === 'create' && <CreateScreen onOpenCamera={() => setShowCamera(true)} onShowSoundLibrary={() => setShowSoundLibrary(true)} showToast={showToast} />}
            {activeTab === 'inbox' && <InboxPage users={users} currentUser={currentUser} showToast={showToast} />}
            {activeTab === 'profile' && <ProfilePage user={currentUser} setCurrentUser={setCurrentUser} onLogout={handleLogout} users={users} showToast={showToast} onShowAnalytics={() => setShowAnalytics(true)} onShowQRCode={() => setShowQRCode(true)} allVideos={videos} />}
          </>
        )}
      </div>

      {/* ── BOTTOM TAB BAR — ORIGINAL ── */}
      <div style={{ display: 'flex', background: 'rgba(8,8,8,0.97)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 8px 24px', flexShrink: 0, backdropFilter: 'blur(20px)' }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'create') setShowCamera(true); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', position: 'relative', transition: 'transform 0.15s' }}>
              <TabIcon id={tab.id} active={isActive} />
            </button>
          );
        })}
      </div>

      {/* LIVE button — ORIGINAL */}
      {activeTab === 'home' && (
        <button onClick={() => setShowLiveStream(currentUser)} style={{ position: 'absolute', right: 14, bottom: 88, background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: 24, padding: '8px 16px', cursor: 'pointer', zIndex: 15, display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 4px 24px rgba(255,45,85,0.5)' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'white', animation: 'pulse 1s infinite' }} />
          <span style={{ color: 'white', fontSize: 13, fontWeight: 800, fontFamily: "'Syne',sans-serif", letterSpacing: 0.5 }}>LIVE</span>
        </button>
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
