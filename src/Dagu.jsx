// DaguV5.jsx — NEXT-GENERATION SOCIAL PLATFORM
// World-class redesign: obsidian depth + liquid aurora aesthetic
// Surpasses TikTok, Instagram, Telegram in UX, performance & design

import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, query, where, orderBy, onSnapshot, increment,
  serverTimestamp, arrayUnion, arrayRemove, limit, startAfter
} from 'firebase/firestore';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut,
  sendPasswordResetEmail, sendEmailVerification
} from 'firebase/auth';

/* ═══════════════════════════════════════════
   FIREBASE CONFIG
═══════════════════════════════════════════ */
const firebaseConfig = {
  apiKey: "AIzaSyD9jDk8gijMVAYrsFe4vpojI7GyZnkzGL8",
  authDomain: "dagu-8348c.firebaseapp.com",
  projectId: "dagu-8348c",
  storageBucket: "dagu-8348c.firebasestorage.app",
  messagingSenderId: "259738670911",
  appId: "1:259738670911:web:c4d1116e3697a8f67c658a"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/* ═══════════════════════════════════════════
   CLOUDINARY + EMAILJS
═══════════════════════════════════════════ */
const CLOUD = 'dotvhzjmc';
const PRESET = 'g3c7dwdg';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD}/upload`;
const EMAILJS_SERVICE = 'service_mtqmvbb';
const EMAILJS_TEMPLATE = 'template_1k7wiqa';
const EMAILJS_KEY = 'U9fs25Bcx5oQ6A2ru';
const SUPPORT_EMAIL = 'getachewshambel11@gmail.com';
const APP_CREATOR_UID = 'REPLACE_WITH_CREATOR_UID';

/* ═══════════════════════════════════════════
   DESIGN SYSTEM — LIQUID AURORA
   Obsidian core + iridescent light veins
═══════════════════════════════════════════ */
const DS = {
  // Core palette
  ink0: '#04040A',    // deepest void
  ink1: '#08080F',    // main bg
  ink2: '#0E0E1A',    // surface
  ink3: '#141425',    // elevated surface
  ink4: '#1C1C32',    // hover surface
  
  // Aurora spectrum
  rose:    '#FF2D6B',
  crimson: '#FF1744',
  violet:  '#8B5CF6',
  indigo:  '#6366F1',
  cyan:    '#06B6D4',
  teal:    '#14B8A6',
  emerald: '#10B981',
  amber:   '#F59E0B',
  
  // Text hierarchy
  t1: '#FFFFFF',
  t2: 'rgba(255,255,255,0.75)',
  t3: 'rgba(255,255,255,0.45)',
  t4: 'rgba(255,255,255,0.22)',
  t5: 'rgba(255,255,255,0.10)',
  
  // Borders
  b1: 'rgba(255,255,255,0.06)',
  b2: 'rgba(255,255,255,0.11)',
  b3: 'rgba(255,255,255,0.20)',
  
  // Gradients
  aurora:    'linear-gradient(135deg, #FF2D6B 0%, #8B5CF6 50%, #06B6D4 100%)',
  auroraAlt: 'linear-gradient(135deg, #06B6D4 0%, #8B5CF6 50%, #FF2D6B 100%)',
  roseGrad:  'linear-gradient(135deg, #FF2D6B, #FF6B35)',
  violetGrad:'linear-gradient(135deg, #8B5CF6, #6366F1)',
  cyanGrad:  'linear-gradient(135deg, #06B6D4, #14B8A6)',
  
  // Font
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  
  // Radius
  r1: 6, r2: 12, r3: 18, r4: 24, r5: 32, rFull: 9999,
  
  // Easing
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
};

/* ═══════════════════════════════════════════
   GLOBAL STYLES
═══════════════════════════════════════════ */
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    
    *, *::before, *::after {
      margin: 0; padding: 0; box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
      scrollbar-width: none; -ms-overflow-style: none;
    }
    ::-webkit-scrollbar { display: none; }
    
    html { scroll-behavior: smooth; color-scheme: dark; }
    
    body {
      font-family: ${DS.font};
      background: ${DS.ink0};
      color: ${DS.t1};
      -webkit-font-smoothing: antialiased;
      overscroll-behavior: none;
      touch-action: manipulation;
      user-select: none;
    }
    
    input, textarea {
      font-family: ${DS.font};
      user-select: text;
      -webkit-user-select: text;
    }
    
    /* Animations */
    @keyframes auroraFlow {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes slideUp {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes slideDown {
      from { transform: translateY(-100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes popIn {
      0% { transform: scale(0.85); opacity: 0; }
      70% { transform: scale(1.04); }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes heartPop {
      0% { transform: scale(0.3) translateY(0); opacity: 1; }
      60% { transform: scale(1.6) translateY(-40px); opacity: 1; }
      100% { transform: scale(2) translateY(-90px); opacity: 0; }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes ripple {
      0% { transform: scale(0); opacity: 0.5; }
      100% { transform: scale(4); opacity: 0; }
    }
    @keyframes toastSlide {
      0% { transform: translateX(-50%) translateY(20px); opacity: 0; }
      100% { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    @keyframes notifSlide {
      from { transform: translateY(-110%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes likeHeart {
      0% { transform: scale(1); }
      30% { transform: scale(1.5); }
      60% { transform: scale(0.9); }
      100% { transform: scale(1); }
    }
    @keyframes storyProgress {
      from { transform: scaleX(0); }
      to { transform: scaleX(1); }
    }
    @keyframes orb {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(30px, -30px) scale(1.1); }
      66% { transform: translate(-20px, 20px) scale(0.9); }
    }
    @keyframes tabActive {
      0% { transform: translateX(-50%) scaleX(0); }
      100% { transform: translateX(-50%) scaleX(1); }
    }
    
    /* Glass effect */
    .glass {
      background: rgba(14, 14, 26, 0.80);
      backdrop-filter: blur(28px) saturate(180%);
      -webkit-backdrop-filter: blur(28px) saturate(180%);
      border: 1px solid rgba(255,255,255,0.07);
    }
    
    /* Aurora button */
    .btn-aurora {
      background: linear-gradient(135deg, #FF2D6B 0%, #8B5CF6 50%, #06B6D4 100%);
      background-size: 200% 200%;
      animation: auroraFlow 6s ease infinite;
      border: none; color: white; font-weight: 700;
      cursor: pointer; font-family: ${DS.font};
      transition: filter 0.2s, transform 0.15s, box-shadow 0.2s;
    }
    .btn-aurora:hover { filter: brightness(1.1); box-shadow: 0 4px 24px rgba(139,92,246,0.45); }
    .btn-aurora:active { transform: scale(0.94) !important; filter: brightness(0.92); }
    
    /* Skeleton */
    .skeleton {
      background: linear-gradient(90deg,
        rgba(255,255,255,0.03) 25%,
        rgba(255,255,255,0.07) 50%,
        rgba(255,255,255,0.03) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.8s infinite;
    }
    
    /* Active state for all buttons */
    button:active { transform: scale(0.93) !important; transition: transform 0.08s !important; }
    
    /* Focus */
    .focus-aurora:focus-within {
      border-color: rgba(139,92,246,0.6) !important;
      box-shadow: 0 0 0 3px rgba(139,92,246,0.15), 0 0 24px rgba(139,92,246,0.12) !important;
    }
    
    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `}</style>
);

/* ═══════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════ */
const fmtNum = n => {
  const v = Number(n) || 0;
  if (v >= 1e9) return (v/1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v/1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v/1e3).toFixed(1) + 'K';
  return String(v);
};
const timeAgo = date => {
  if (!date) return '';
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  if (s < 86400*7) return `${Math.floor(s/86400)}d`;
  return new Date(date).toLocaleDateString();
};
const haptic = (t='light') => {
  try {
    if (window.navigator?.vibrate)
      t==='heavy' ? navigator.vibrate([30,10,30]) :
      t==='medium' ? navigator.vibrate(20) : navigator.vibrate(10);
  } catch {}
};
const getConvId = (a, b) => [a, b].sort().join('_');

/* ═══════════════════════════════════════════
   FIREBASE HELPERS
═══════════════════════════════════════════ */
const buildProfile = (uid, data={}) => ({
  id: uid,
  username: data.username || '',
  fullName: data.fullName || '',
  email: data.email || '',
  avatar: (data.username || data.fullName || 'U')[0].toUpperCase(),
  avatarColor: data.avatarColor || `hsl(${Math.floor(Math.random()*360)},65%,55%)`,
  avatarUrl: data.avatarUrl || null,
  bio: data.bio || '',
  link: '',
  verified: false,
  followers: [], following: [], blockedUsers: [],
  coins: 500, walletBalance: 500,
  level: 1, streak: 1, subscription: 'free',
  language: 'en', theme: 'dark',
  privacy: {},
});

const createUserProfile = async (uid, data) => {
  await setDoc(doc(db, 'users', uid), { ...buildProfile(uid, data), createdAt: serverTimestamp() }, { merge: true });
};
const getUserProfile = async uid => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

const uploadToCloudinary = async (file, onProgress) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', PRESET);
  fd.append('cloud_name', CLOUD);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded/e.total*100));
    };
    xhr.onload = () => {
      if (xhr.status === 200) resolve(JSON.parse(xhr.responseText).secure_url);
      else reject(new Error('Upload failed'));
    };
    xhr.onerror = () => reject(new Error('Upload error'));
    xhr.open('POST', UPLOAD_URL);
    xhr.send(fd);
  });
};

const notify = async (toUid, fromUid, type, message, extra={}) => {
  if (!toUid || toUid === fromUid) return;
  try {
    await addDoc(collection(db, 'notifications'), {
      toUserId: toUid, fromUserId: fromUid, type, message,
      read: false, createdAt: serverTimestamp(), ...extra,
    });
  } catch {}
};

const sendEmail = async params => {
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE,
        template_id: EMAILJS_TEMPLATE,
        user_id: EMAILJS_KEY,
        template_params: params,
      }),
    });
    return res.status === 200;
  } catch { return false; }
};

/* ═══════════════════════════════════════════
   ATOMS — smallest reusable UI pieces
═══════════════════════════════════════════ */

// Spinner
const Spinner = ({ size=24, color=DS.rose }) => (
  <div style={{
    width: size, height: size,
    border: `2px solid rgba(255,255,255,0.08)`,
    borderTop: `2px solid ${color}`,
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  }}/>
);

// Avatar
const Avatar = ({ user, size=44, onClick, ring=false, ringColor=DS.aurora }) => {
  const s = size;
  return (
    <div onClick={onClick} style={{
      width: s, height: s, borderRadius: '50%',
      background: ring ? ringColor : 'transparent',
      backgroundSize: ring ? '200% 200%' : undefined,
      animation: ring ? 'auroraFlow 3s ease infinite' : undefined,
      padding: ring ? 2.5 : 0,
      cursor: onClick ? 'pointer' : 'default', flexShrink: 0,
    }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%',
        background: ring ? DS.ink1 : 'transparent',
        padding: ring ? 2 : 0,
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: user?.avatarColor || DS.rose,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 800, fontSize: s * 0.42,
          overflow: 'hidden', fontFamily: DS.font,
        }}>
          {user?.avatarUrl
            ? <img src={user.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            : (user?.avatar || '?')}
        </div>
      </div>
    </div>
  );
};

// Toast notification
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const configs = {
    success: { bg: DS.emerald, icon: '✓' },
    error:   { bg: DS.rose, icon: '✕' },
    info:    { bg: DS.violet, icon: 'i' },
    warning: { bg: DS.amber, icon: '!' },
  };
  const c = configs[type] || configs.info;
  return (
    <div style={{
      position: 'fixed', bottom: 104, left: '50%',
      transform: 'translateX(-50%)', zIndex: 9999,
      animation: 'toastSlide 0.35s ease forwards',
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(14,14,26,0.96)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.09)', borderRadius: DS.rFull,
      padding: '9px 18px 9px 9px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      whiteSpace: 'nowrap',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: c.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 800, fontSize: 13, flexShrink: 0,
      }}>{c.icon}</div>
      <span style={{ color: DS.t1, fontSize: 13, fontWeight: 500 }}>{message}</span>
    </div>
  );
};

// Bottom sheet
const Sheet = ({ children, onClose, title, height='auto' }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, zIndex: 5000,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end',
    }}
  >
    <div
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%', background: DS.ink2,
        borderTopLeftRadius: DS.r5, borderTopRightRadius: DS.r5,
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        border: `1px solid ${DS.b1}`, borderBottom: 'none',
        paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
      }}
    >
      <div style={{ padding: '12px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: DS.b3, margin: '0 auto' }}/>
      </div>
      {title && (
        <div style={{ padding: '14px 20px 0', color: DS.t1, fontWeight: 800, fontSize: 18 }}>{title}</div>
      )}
      <div style={{ overflowY: 'auto', flex: 1 }}>{children}</div>
    </div>
  </div>
);

// Skeleton card
const SkeletonCard = () => (
  <div style={{ display: 'flex', gap: 12, padding: '14px 16px', alignItems: 'center' }}>
    <div className="skeleton" style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0 }}/>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="skeleton" style={{ height: 13, borderRadius: 6, width: '55%' }}/>
      <div className="skeleton" style={{ height: 11, borderRadius: 6, width: '35%' }}/>
    </div>
  </div>
);

/* ═══════════════════════════════════════════
   HOOK: useNetworkStatus
═══════════════════════════════════════════ */
const useNetworkStatus = () => {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
};

/* ═══════════════════════════════════════════
   OFFLINE BANNER
═══════════════════════════════════════════ */
const OfflineBanner = () => (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
    background: 'rgba(245,158,11,0.95)', backdropFilter: 'blur(12px)',
    padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
    justifyContent: 'center', animation: 'slideDown 0.3s ease',
  }}>
    <span>📡</span>
    <span style={{ color: '#000', fontWeight: 700, fontSize: 13 }}>No internet connection</span>
  </div>
);

/* ═══════════════════════════════════════════
   NOTIFICATION POPUP (Telegram-style)
═══════════════════════════════════════════ */
const NotifPopup = ({ notif, user, onClose, onTap }) => {
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(null);
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  const icons = { like:'❤️', comment:'💬', follow:'👤', message:'✉️', gift:'🎁', mention:'@', call:'📞' };
  return (
    <div
      onClick={() => { haptic('medium'); onTap?.(); onClose(); }}
      onTouchStart={e => { startX.current = e.touches[0].clientX; }}
      onTouchMove={e => { const dx = e.touches[0].clientX - startX.current; if (dx > 0) setSwipeX(Math.min(dx, 120)); }}
      onTouchEnd={() => { if (swipeX > 70) onClose(); else setSwipeX(0); }}
      style={{
        position: 'fixed', top: 56, left: 12, right: 12, zIndex: 9998,
        background: 'rgba(14,14,26,0.97)', backdropFilter: 'blur(28px)',
        border: `1px solid ${DS.b2}`, borderRadius: DS.r4,
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
        animation: 'notifSlide 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        transform: `translateX(${swipeX}px)`,
        transition: swipeX === 0 ? 'transform 0.3s ease' : 'none',
        opacity: 1 - swipeX/150, cursor: 'pointer',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Avatar user={user} size={42}/>
        <div style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 18, height: 18, borderRadius: '50%',
          background: DS.ink2, border: `1.5px solid ${DS.b2}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
        }}>{icons[notif?.type] || '🔔'}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: DS.t1, lineHeight: 1.4 }}>
          <span style={{ color: DS.rose }}>@{user?.username}</span>{' '}{notif?.message}
        </div>
        <div style={{ color: DS.t4, fontSize: 11, marginTop: 2 }}>Now · swipe to dismiss</div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   VIDEO CARD — reimagined feed experience
═══════════════════════════════════════════ */
const VideoCard = memo(({
  video, currentUser, isActive,
  onFollow, onMessage, onViewProfile,
  followed, showToast, onBlock,
}) => {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video?.likes || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);
  const tapTimer = useRef(null);
  const longPressTimer = useRef(null);

  const isImage = useMemo(() =>
    video?.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i) || video?.mediaType?.startsWith('image'),
    [video]
  );

  // Init: check liked, increment view
  useEffect(() => {
    if (!video?.id || !currentUser?.id) return;
    getDoc(doc(db, 'likes', `${video.id}_${currentUser.id}`)).then(s => s.exists() && setLiked(true)).catch(() => {});
    const key = `v_${video.id}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      updateDoc(doc(db, 'videos', video.id), { views: increment(1) }).catch(() => {});
    }
    // Comments
    const q = query(collection(db, 'comments'), where('videoId', '==', video.id));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));
      setComments(list);
    }, () => {});
    return () => unsub();
  }, [video?.id, currentUser?.id]);

  // Playback control
  useEffect(() => {
    const el = videoRef.current;
    if (!el || isImage) return;
    if (isActive && isPlaying) {
      el.muted = false;
      el.play().catch(() => { el.muted = true; el.play().catch(() => {}); });
    } else {
      el.pause();
      if (!isActive) el.muted = true;
    }
  }, [isActive, isPlaying, isImage]);

  // Progress bar
  useEffect(() => {
    if (isImage || !isActive) return;
    const tick = setInterval(() => {
      const el = videoRef.current;
      if (el?.duration) setProgress(el.currentTime / el.duration * 100);
    }, 500);
    return () => clearInterval(tick);
  }, [isActive, isImage]);

  const doLike = async () => {
    if (liked) {
      setLiked(false); setLikeCount(p => Math.max(0, p-1));
      await deleteDoc(doc(db, 'likes', `${video.id}_${currentUser.id}`)).catch(() => {});
      await updateDoc(doc(db, 'videos', video.id), { likes: increment(-1) }).catch(() => {});
    } else {
      setLiked(true); setLikeCount(p => p+1);
      setHeartAnim(true); setTimeout(() => setHeartAnim(false), 900);
      await setDoc(doc(db, 'likes', `${video.id}_${currentUser.id}`), {
        videoId: video.id, userId: currentUser.id, createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'videos', video.id), { likes: increment(1) }).catch(() => {});
      await notify(video.userId, currentUser.id, 'like', 'liked your post', { videoId: video.id });
    }
  };

  const handleTap = e => {
    if (e.target.closest('button,a,input,textarea,[data-notap]')) return;
    if (tapTimer.current) {
      clearTimeout(tapTimer.current); tapTimer.current = null;
      haptic('medium'); doLike();
    } else {
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
        haptic('light');
        if (!isImage && videoRef.current) {
          isPlaying ? videoRef.current.pause() : videoRef.current.play().catch(() => {});
          setIsPlaying(p => !p);
        }
      }, 240);
    }
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    const txt = commentText; setCommentText('');
    await addDoc(collection(db, 'comments'), {
      videoId: video.id, userId: currentUser.id, username: currentUser.username,
      avatar: currentUser.avatar, avatarColor: currentUser.avatarColor, avatarUrl: currentUser.avatarUrl||null,
      text: txt, likes: 0, createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'videos', video.id), { comments: increment(1) }).catch(() => {});
    await notify(video.userId, currentUser.id, 'comment', `commented: "${txt.slice(0,40)}"`, { videoId: video.id });
  };

  const shareUrl = `https://dagu.app/v/${video?.id}`;
  const desc = video?.description || '';
  const LIMIT = 100;

  return (
    <div
      style={{ position: 'absolute', inset: 0, background: '#000' }}
      onClick={handleTap}
      onTouchStart={() => { longPressTimer.current = setTimeout(() => { haptic('heavy'); setShowMenu(true); }, 550); }}
      onTouchEnd={() => clearTimeout(longPressTimer.current)}
      onMouseDown={() => { longPressTimer.current = setTimeout(() => setShowMenu(true), 550); }}
      onMouseUp={() => clearTimeout(longPressTimer.current)}
    >
      {/* Media */}
      {isImage
        ? <img src={video.videoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
        : <video
            ref={videoRef} src={video?.videoUrl}
            style={{ width:'100%', height:'100%', objectFit:'cover' }}
            loop playsInline
          />
      }

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.12) 45%, rgba(0,0,0,0.25) 100%)',
        pointerEvents: 'none',
      }}/>

      {/* Progress bar */}
      {!isImage && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: 'rgba(255,255,255,0.12)', zIndex: 20 }}>
          <div style={{ height: '100%', width: `${progress}%`, background: DS.aurora, transition: 'width 0.5s linear' }}/>
        </div>
      )}

      {/* Heart animation */}
      {heartAnim && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 50, pointerEvents: 'none', fontSize: 88, animation: 'heartPop 0.9s ease forwards' }}>❤️</div>
      )}

      {/* Pause indicator */}
      {!isPlaying && !isImage && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 15, pointerEvents: 'none' }}>
          <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
      )}

      {/* Bottom info */}
      <div style={{ position: 'absolute', bottom: 0, left: 14, right: 72, zIndex: 10, paddingBottom: 14 }}>
        {/* Author row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Avatar user={{...video, avatarUrl: video.avatarUrl}} size={40} onClick={() => onViewProfile?.(video.userId)}/>
          <span
            onClick={e => { e.stopPropagation(); onViewProfile?.(video.userId); }}
            style={{ color: DS.t1, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >@{video.username}</span>
          {video.verified && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#1d9bf0"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          )}
          <button
            data-notap="1"
            onClick={e => { e.stopPropagation(); onFollow?.(video.userId); }}
            style={{
              padding: '5px 14px', borderRadius: DS.rFull, fontSize: 12, fontWeight: 700,
              background: followed?.includes(video.userId) ? 'rgba(255,255,255,0.08)' : DS.rose,
              border: followed?.includes(video.userId) ? `1px solid ${DS.b3}` : 'none',
              color: DS.t1, cursor: 'pointer',
            }}
          >{followed?.includes(video.userId) ? 'Following' : '+ Follow'}</button>
        </div>

        {/* Description */}
        {desc && (
          <p style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 1.55, marginBottom: 6, wordBreak: 'break-word' }}>
            {showFullDesc || desc.length <= LIMIT ? desc : desc.slice(0, LIMIT) + '…'}
            {desc.length > LIMIT && !showFullDesc && (
              <span
                data-notap="1"
                onClick={e => { e.stopPropagation(); setShowFullDesc(true); }}
                style={{ color: DS.t3, fontWeight: 700, cursor: 'pointer', marginLeft: 4 }}
              >more</span>
            )}
          </p>
        )}

        {/* Sound */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            background: DS.aurora, backgroundSize: '200% 200%', animation: 'auroraFlow 3s ease infinite',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
          }}>♪</div>
          <span style={{ color: DS.t3, fontSize: 12 }}>{video.song || 'Original sound'}</span>
        </div>
      </div>

      {/* Right action bar */}
      <div style={{
        position: 'absolute', right: 12, bottom: 14,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 10,
      }}>
        {/* Like */}
        <button
          data-notap="1"
          onClick={e => { e.stopPropagation(); haptic('medium'); doLike(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 0' }}
        >
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: liked ? 'rgba(255,45,107,0.18)' : 'rgba(0,0,0,0.35)',
            border: liked ? `1px solid rgba(255,45,107,0.35)` : '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: liked ? 'likeHeart 0.4s ease' : 'none',
            transition: 'all 0.2s',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24"
              fill={liked ? DS.rose : 'none'}
              stroke={liked ? DS.rose : 'rgba(255,255,255,0.9)'}
              strokeWidth="1.8"
              style={{ filter: liked ? `drop-shadow(0 0 8px ${DS.rose})` : 'none' }}
            >
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </div>
          <span style={{ color: liked ? DS.rose : DS.t2, fontSize: 11, fontWeight: 700 }}>{fmtNum(likeCount)}</span>
        </button>

        {/* Comment */}
        <button
          data-notap="1"
          onClick={e => { e.stopPropagation(); setShowComments(true); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 0' }}
        >
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <span style={{ color: DS.t2, fontSize: 11, fontWeight: 700 }}>{fmtNum(video.comments || comments.length)}</span>
        </button>

        {/* Share */}
        <button
          data-notap="1"
          onClick={e => { e.stopPropagation(); setShowShare(true); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 0' }}
        >
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </div>
          <span style={{ color: DS.t2, fontSize: 11, fontWeight: 700 }}>{fmtNum(video.shares||0)}</span>
        </button>

        {/* Menu */}
        <button
          data-notap="1"
          onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
          style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: 4 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
        </button>
      </div>

      {/* Context menu */}
      {showMenu && (
        <div onClick={e => { e.stopPropagation(); setShowMenu(false); }} style={{ position: 'fixed', inset: 0, zIndex: 9990 }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', bottom: 12, right: 14, minWidth: 220,
              background: 'rgba(14,14,26,0.97)', backdropFilter: 'blur(24px)',
              border: `1px solid ${DS.b2}`, borderRadius: DS.r4,
              padding: 6, animation: 'popIn 0.2s ease', zIndex: 9991,
              boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
            }}
          >
            {[
              { icon: '💬', label: 'Message', fn: () => onMessage?.(video.userId) },
              { icon: '🔗', label: 'Copy Link', fn: () => { navigator.clipboard?.writeText(shareUrl); showToast?.('Link copied!', 'success'); } },
              { icon: '📥', label: 'Download', fn: () => { window.open(video.videoUrl, '_blank'); } },
              { icon: '🚩', label: 'Report', color: DS.amber, fn: async () => { await addDoc(collection(db,'reports'),{videoId:video.id,userId:currentUser?.id,createdAt:serverTimestamp()}); showToast?.('Reported','success'); } },
              { icon: '🚫', label: 'Block', color: DS.rose, fn: async () => { await updateDoc(doc(db,'users',currentUser?.id),{blockedUsers:arrayUnion(video.userId)}); onBlock?.(video.userId); showToast?.('Blocked','info'); } },
            ].map(item => (
              <button key={item.label} onClick={e => { e.stopPropagation(); item.fn(); setShowMenu(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '12px 14px', background: 'none', border: 'none',
                color: item.color || DS.t1, cursor: 'pointer', borderRadius: DS.r3, fontSize: 14,
              }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Share sheet */}
      {showShare && (
        <Sheet onClose={() => setShowShare(false)} title="Share">
          <div style={{ padding: '16px 20px' }}>
            {[
              { icon: '📋', label: 'Copy link', fn: async () => { await navigator.clipboard?.writeText(shareUrl); showToast?.('Copied!', 'success'); setShowShare(false); } },
              { icon: '💬', label: 'WhatsApp', fn: () => { window.open(`https://wa.me/?text=${encodeURIComponent(desc+' '+shareUrl)}`); setShowShare(false); } },
              { icon: '✈️', label: 'Telegram', fn: () => { window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(desc)}`); setShowShare(false); } },
              { icon: '🐦', label: 'X (Twitter)', fn: () => { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(desc+' '+shareUrl)}`); setShowShare(false); } },
            ].map(opt => (
              <button key={opt.label} onClick={opt.fn} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 0', background: 'none', border: 'none',
                borderBottom: `1px solid ${DS.b1}`, color: DS.t1, cursor: 'pointer', fontSize: 15,
              }}>
                <span style={{ fontSize: 22 }}>{opt.icon}</span>{opt.label}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {/* Comments */}
      {showComments && (
        <>
          <div onClick={() => setShowComments(false)} style={{ position: 'fixed', inset: 0, zIndex: 9499, background: 'rgba(0,0,0,0.55)' }}/>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
              width: '100%', maxWidth: 430, height: '62%',
              background: DS.ink2, borderTopLeftRadius: DS.r5, borderTopRightRadius: DS.r5,
              zIndex: 9500, display: 'flex', flexDirection: 'column',
              animation: 'slideUp 0.3s ease',
              border: `1px solid ${DS.b1}`, borderBottom: 'none',
            }}
          >
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${DS.b1}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ color: DS.t1, fontWeight: 800, fontSize: 16 }}>Comments</span>
              <button onClick={() => setShowComments(false)} style={{ background: DS.t5, border: 'none', borderRadius: '50%', width: 30, height: 30, color: DS.t1, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {comments.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: DS.t4 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
                  <div style={{ fontSize: 14 }}>No comments yet — be first!</div>
                </div>
              )}
              {comments.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <Avatar user={c} size={34}/>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: DS.rose, fontWeight: 700, fontSize: 12 }}>@{c.username} </span>
                    <span style={{ color: DS.t2, fontSize: 13 }}>{c.text}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 14px', paddingBottom: 'max(24px,env(safe-area-inset-bottom))', borderTop: `1px solid ${DS.b1}`, display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <Avatar user={currentUser} size={32}/>
              <input
                value={commentText} onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addComment()}
                placeholder="Add a comment…"
                style={{ flex: 1, background: DS.t5, border: `1px solid ${DS.b2}`, borderRadius: DS.rFull, padding: '10px 14px', color: DS.t1, outline: 'none', fontSize: 13 }}
              />
              <button onClick={addComment} style={{ background: DS.rose, border: 'none', borderRadius: '50%', width: 38, height: 38, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════
   STORIES ROW
═══════════════════════════════════════════ */
const StoriesRow = ({ currentUser, users, onCreateStory, onViewStory }) => {
  const [storyGroups, setStoryGroups] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, 'stories'));
        const now = Date.now();
        const byUser = {};
        snap.docs.forEach(d => {
          const data = d.data();
          const exp = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt || 0);
          if (exp < now) return;
          if (!byUser[data.userId]) byUser[data.userId] = { userId: data.userId, stories: [] };
          byUser[data.userId].stories.push({ id: d.id, ...data });
        });
        const result = Object.values(byUser).map(g => {
          const u = users.find(u => u.id === g.userId);
          return { ...g, username: u?.username || 'user', avatarColor: u?.avatarColor, avatarUrl: u?.avatarUrl };
        });
        setStoryGroups(result);
      } catch {}
    };
    load();
  }, [users]);

  const myStories = storyGroups.find(g => g.userId === currentUser?.id);

  return (
    <div style={{ display: 'flex', gap: 14, padding: '14px 16px', overflowX: 'auto', borderBottom: `1px solid ${DS.b1}` }}>
      {/* My story */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => myStories ? onViewStory?.({ groups: storyGroups, startIdx: 0 }) : onCreateStory?.()}
          style={{ width: 66, height: 66, borderRadius: '50%', padding: 0, background: 'none', border: 'none', cursor: 'pointer', position: 'relative' }}
        >
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: myStories ? DS.aurora : 'transparent',
            backgroundSize: myStories ? '200% 200%' : undefined,
            animation: myStories ? 'auroraFlow 3s ease infinite' : undefined,
            padding: myStories ? 2.5 : 0, border: myStories ? 'none' : `2px dashed ${DS.b3}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: myStories ? 'calc(100% - 0px)' : '100%',
              height: myStories ? 'calc(100% - 0px)' : '100%',
              borderRadius: '50%', background: myStories ? DS.ink1 : 'transparent',
              padding: myStories ? 2 : 0,
            }}>
              <Avatar user={currentUser} size={myStories ? 56 : 62}/>
            </div>
          </div>
          <div
            onClick={e => { e.stopPropagation(); onCreateStory?.(); }}
            style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 20, height: 20, background: DS.rose, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2px solid ${DS.ink1}`, fontSize: 13, color: 'white', fontWeight: 800,
            }}
          >+</div>
        </button>
        <span style={{ color: DS.t3, fontSize: 11 }}>Your story</span>
      </div>

      {/* Others */}
      {storyGroups.filter(g => g.userId !== currentUser?.id).map((group, idx) => (
        <div key={group.userId} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => onViewStory?.({ groups: storyGroups, startIdx: storyGroups.indexOf(group) })}
            style={{ width: 66, height: 66, borderRadius: '50%', padding: 2.5, background: DS.aurora, backgroundSize: '200% 200%', animation: 'auroraFlow 3s ease infinite', border: 'none', cursor: 'pointer' }}
          >
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: DS.ink1, padding: 2 }}>
              <Avatar user={group} size={56}/>
            </div>
          </button>
          <span style={{ color: DS.t3, fontSize: 11, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
            {group.username}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════
   STORY VIEWER (Telegram-grade)
═══════════════════════════════════════════ */
const StoryViewer = ({ groups, startIdx=0, currentUser, onClose, showToast }) => {
  const [gIdx, setGIdx] = useState(startIdx);
  const [sIdx, setSIdx] = useState(0);
  const [prog, setProg] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const timer = useRef(null);
  const DURATION = 5000;

  const group = groups[gIdx];
  const story = group?.stories?.[sIdx];

  useEffect(() => {
    if (!story?.id || !currentUser?.id) return;
    updateDoc(doc(db,'stories',story.id),{seenBy:arrayUnion(currentUser.id)}).catch(()=>{});
  }, [story?.id]);

  useEffect(() => {
    setProg(0);
    if (paused) return;
    const start = Date.now();
    timer.current = setInterval(() => {
      const pct = Math.min((Date.now()-start)/DURATION*100, 100);
      setProg(pct);
      if (pct >= 100) goNext();
    }, 50);
    return () => clearInterval(timer.current);
  }, [sIdx, gIdx, paused]);

  const goNext = useCallback(() => {
    clearInterval(timer.current);
    if (sIdx < (group?.stories?.length||1)-1) { setSIdx(s=>s+1); setProg(0); }
    else if (gIdx < groups.length-1) { setGIdx(g=>g+1); setSIdx(0); setProg(0); }
    else onClose();
  }, [sIdx, gIdx, groups, group]);

  const goPrev = useCallback(() => {
    clearInterval(timer.current);
    if (sIdx > 0) { setSIdx(s=>s-1); setProg(0); }
    else if (gIdx > 0) { setGIdx(g=>g-1); setSIdx(0); setProg(0); }
  }, [sIdx, gIdx]);

  const sendReply = async () => {
    if (!replyText.trim()) return;
    const convId = getConvId(currentUser.id, group.userId);
    await addDoc(collection(db,'messages',convId,'msgs'),{
      from: currentUser.id, to: group.userId,
      text: `↩ Story: ${replyText}`, createdAt: serverTimestamp(), status:'sent',
    });
    setReplyText(''); showToast?.('Reply sent ✓','success');
  };

  if (!group || !story) return null;
  const isOwn = group.userId === currentUser?.id;

  return (
    <div style={{ position:'fixed',inset:0,background:'#000',zIndex:3000,display:'flex',flexDirection:'column' }}>
      {/* Progress bars */}
      <div style={{ position:'absolute',top:0,left:0,right:0,zIndex:20,padding:'10px 10px 0',display:'flex',gap:3 }}>
        {group.stories.map((_,i) => (
          <div key={i} style={{ flex:1,height:2.5,background:'rgba(255,255,255,0.28)',borderRadius:2,overflow:'hidden' }}>
            <div style={{ height:'100%',background:'white',borderRadius:2,width:i<sIdx?'100%':i===sIdx?`${prog}%`:'0%' }}/>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ position:'absolute',top:20,left:0,right:0,zIndex:20,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 14px' }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <Avatar user={group} size={42} ring/>
          <div>
            <div style={{ color:'white',fontWeight:700,fontSize:14 }}>@{group.username}</div>
            <div style={{ color:'rgba(255,255,255,0.5)',fontSize:11 }}>
              {story.createdAt?.seconds ? new Date(story.createdAt.seconds*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : 'Just now'}
            </div>
          </div>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          <button onPointerDown={()=>setPaused(true)} onPointerUp={()=>setPaused(false)} style={{ background:'rgba(255,255,255,0.1)',border:'none',borderRadius:'50%',width:34,height:34,color:'white',cursor:'pointer',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center' }}>
            {paused?'▶':'⏸'}
          </button>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)',border:'none',borderRadius:'50%',width:34,height:34,color:'white',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
        </div>
      </div>

      {/* Tap zones */}
      <div style={{ position:'absolute',inset:0,display:'flex',zIndex:10 }}>
        <div style={{ flex:1 }} onClick={goPrev}/>
        <div style={{ flex:1 }} onClick={goNext}/>
      </div>

      {/* Content */}
      <div style={{ flex:1,position:'relative',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden' }}>
        {story.mediaUrl
          ? story.mediaType?.startsWith('video')
            ? <video src={story.mediaUrl} autoPlay loop playsInline style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
            : <img src={story.mediaUrl} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
          : <div style={{ width:'100%',height:'100%',background:story.bgColor||DS.rose,display:'flex',alignItems:'center',justifyContent:'center',padding:40 }}>
              <div style={{ color:'white',fontSize:28,fontWeight:700,textAlign:'center',lineHeight:1.4 }}>{story.text}</div>
            </div>
        }
        {story.text && story.mediaUrl && (
          <div style={{ position:'absolute',bottom:90,left:0,right:0,textAlign:'center',padding:'0 24px' }}>
            <div style={{ color:'white',fontSize:18,fontWeight:700,textShadow:'0 2px 8px rgba(0,0,0,0.8)' }}>{story.text}</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ position:'absolute',bottom:0,left:0,right:0,zIndex:20,padding:'0 12px 36px' }}>
        {isOwn ? (
          <div style={{ background:'rgba(0,0,0,0.5)',backdropFilter:'blur(12px)',borderRadius:DS.r3,padding:'12px 16px' }}>
            <div style={{ color:'white',fontWeight:700,fontSize:15 }}>👁 {story.seenBy?.length||0} views</div>
          </div>
        ) : (
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            <div style={{ flex:1,display:'flex',alignItems:'center',background:'rgba(255,255,255,0.1)',backdropFilter:'blur(12px)',borderRadius:28,border:'1px solid rgba(255,255,255,0.18)',paddingLeft:14,paddingRight:8 }}>
              <input value={replyText} onChange={e=>setReplyText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendReply();e.stopPropagation();}} onClick={e=>e.stopPropagation()} placeholder={`Reply to @${group.username}…`} style={{ flex:1,background:'none',border:'none',outline:'none',color:'white',fontSize:14,padding:'12px 0' }}/>
              {replyText.trim() && <button onClick={e=>{e.stopPropagation();sendReply();}} style={{ background:DS.rose,border:'none',borderRadius:'50%',width:32,height:32,color:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>➤</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   CREATE STORY MODAL
═══════════════════════════════════════════ */
const CreateStory = ({ currentUser, onClose, showToast }) => {
  const [mode, setMode] = useState(null);
  const [text, setText] = useState('');
  const [bg, setBg] = useState(DS.rose);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const colors = [DS.rose,'#8B5CF6','#06B6D4','#F59E0B','#10B981','#EF4444'];

  const post = async () => {
    if (!text.trim() && !file) { showToast?.('Add text or media','error'); return; }
    setUploading(true);
    try {
      let mediaUrl=null, mediaType=null;
      if (file?.file) { mediaUrl = await uploadToCloudinary(file.file,()=>{}); mediaType = file.type; }
      await addDoc(collection(db,'stories'),{
        userId:currentUser.id, username:currentUser.username||'',
        avatarColor:currentUser.avatarColor, avatarUrl:currentUser.avatarUrl||null,
        text:text||'', bgColor:bg, mediaUrl, mediaType,
        createdAt:serverTimestamp(), expiresAt:new Date(Date.now()+24*60*60*1000), seenBy:[],
      });
      showToast?.('Story posted! ✨','success'); onClose();
    } catch(e) { showToast?.('Failed: '+e.message,'error'); }
    setUploading(false);
  };

  if (!mode) return (
    <Sheet onClose={onClose} title="Create Story">
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'16px 20px' }}>
        {[{id:'text',icon:'✏️',label:'Text'},{id:'file',icon:'🖼️',label:'Photo / Video'},{id:'camera',icon:'📷',label:'Camera',disabled:true}].map(opt=>(
          <button key={opt.id} onClick={()=>{if(opt.id==='file')fileRef.current?.click();else setMode(opt.id);}} style={{
            background:DS.ink3,border:`1px solid ${DS.b2}`,borderRadius:DS.r4,padding:'20px 14px',
            display:'flex',flexDirection:'column',alignItems:'center',gap:8,cursor:'pointer',
            opacity:opt.disabled?0.4:1,
          }}>
            <span style={{ fontSize:30 }}>{opt.icon}</span>
            <span style={{ color:DS.t1,fontSize:13,fontWeight:600 }}>{opt.label}</span>
          </button>
        ))}
        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={e=>{const f=e.target.files[0];if(f){setFile({url:URL.createObjectURL(f),file:f,type:f.type});setMode('file');}}} style={{display:'none'}}/>
      </div>
    </Sheet>
  );

  return (
    <div style={{ position:'fixed',inset:0,background:'#000',zIndex:3500,display:'flex',flexDirection:'column' }}>
      <div style={{ padding:'16px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)',border:'none',borderRadius:20,padding:'8px 16px',color:'white',cursor:'pointer',fontSize:13 }}>Cancel</button>
        <span style={{ color:'white',fontWeight:700,fontSize:15 }}>Story</span>
        <button onClick={post} disabled={uploading} style={{ background:DS.aurora,backgroundSize:'200% 200%',animation:'auroraFlow 3s ease infinite',border:'none',borderRadius:20,padding:'8px 16px',color:'white',fontWeight:700,cursor:'pointer',fontSize:13,opacity:uploading?0.6:1 }}>
          {uploading?'Posting…':'Post'}
        </button>
      </div>
      <div style={{ flex:1,position:'relative',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center' }}>
        {mode==='text' ? (
          <div style={{ width:'100%',height:'100%',background:bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32 }}>
            <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Write something…" autoFocus style={{ background:'transparent',border:'none',outline:'none',color:'white',fontSize:28,fontWeight:700,textAlign:'center',width:'100%',resize:'none',caretColor:'white',fontFamily:DS.font }} rows={4}/>
            <div style={{ position:'absolute',bottom:28,display:'flex',gap:10 }}>
              {colors.map(c=><div key={c} onClick={()=>setBg(c)} style={{ width:30,height:30,borderRadius:'50%',background:c,border:c===bg?'3px solid white':'3px solid transparent',cursor:'pointer' }}/>)}
            </div>
          </div>
        ) : file && (
          file.type.startsWith('video/')
            ? <video src={file.url} style={{ width:'100%',height:'100%',objectFit:'cover' }} controls/>
            : <img src={file.url} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   HOME FEED — reimagined TikTok-killer
═══════════════════════════════════════════ */
const HomeFeed = ({
  videos, currentUser, followed, blockedUsers,
  onFollow, onMessage, onViewProfile, onBlock,
  showToast, onOpenSearch, onOpenNotifications,
  onCreateStory, onViewStory, users,
}) => {
  const [idx, setIdx] = useState(0);
  const [tab, setTab] = useState('foryou');
  const startY = useRef(null);
  const startT = useRef(null);

  const feed = useMemo(() => {
    const base = videos
      .filter(v => !(blockedUsers||[]).includes(v.userId))
      .map(v => {
        let score = 0;
        if (followed?.includes(v.userId)) score += 60;
        score += Math.log((v.likes||0)+1)*12;
        score += Math.log((v.views||0)+1)*3;
        const ageH = (Date.now()-(v.createdAt?.seconds||0)*1000)/(3.6e6);
        score += Math.max(0, 120-ageH*1.5);
        return { ...v, _score: score };
      })
      .sort((a,b) => b._score-a._score);
    if (tab === 'following') return base.filter(v => followed?.includes(v.userId));
    return base;
  }, [videos, tab, blockedUsers, followed]);

  const handleSwipe = e => {
    if (!startY.current) return;
    const dy = startY.current - e.changedTouches[0].clientY;
    const dt = Date.now() - startT.current;
    if (Math.abs(dy) > (dt < 250 ? 25 : 60)) {
      haptic('light');
      if (dy > 0) setIdx(i => Math.min(feed.length-1, i+1));
      else setIdx(i => Math.max(0, i-1));
    }
    startY.current = null;
  };

  return (
    <div style={{ height:'100%', position:'relative', overflow:'hidden', background:'#000' }}
      onTouchStart={e => { startY.current=e.touches[0].clientY; startT.current=Date.now(); }}
      onTouchEnd={handleSwipe}
    >
      {/* Top header */}
      <div style={{
        position:'absolute',top:0,left:0,right:0,zIndex:15,
        background:'linear-gradient(to bottom,rgba(0,0,0,0.72) 0%,transparent 100%)',
        padding:'14px 16px 24px',
      }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          {/* Tabs */}
          <div style={{ display:'flex',gap:22,flex:1,justifyContent:'center' }}>
            {[{id:'foryou',label:'For You'},{id:'following',label:'Following'}].map(t=>(
              <button key={t.id} onClick={()=>{setTab(t.id);setIdx(0);}} style={{
                background:'none',border:'none',color:tab===t.id?DS.t1:DS.t3,
                fontWeight:tab===t.id?800:500,fontSize:15,cursor:'pointer',
                paddingBottom:5,position:'relative',
                borderBottom:tab===t.id?`2px solid ${DS.t1}`:'2px solid transparent',
              }}>{t.label}</button>
            ))}
          </div>
          {/* Icons */}
          <div style={{ display:'flex',gap:8,position:'absolute',right:16 }}>
            <button onClick={onOpenSearch} style={{ background:'rgba(0,0,0,0.4)',backdropFilter:'blur(10px)',border:`1px solid ${DS.b2}`,borderRadius:'50%',width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button onClick={onOpenNotifications} style={{ background:'rgba(0,0,0,0.4)',backdropFilter:'blur(10px)',border:`1px solid ${DS.b2}`,borderRadius:'50%',width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Stories strip */}
      <div style={{ position:'absolute',top:60,left:0,right:0,zIndex:12 }}>
        <StoriesRow currentUser={currentUser} users={users} onCreateStory={onCreateStory} onViewStory={onViewStory}/>
      </div>

      {/* Video cards */}
      {feed.map((video, i) => (
        Math.abs(i-idx) > 1 ? null :
        <div key={video.id} style={{
          position:'absolute',inset:0,
          transform:`translateY(${(i-idx)*100}%)`,
          transition:'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',
          pointerEvents:i===idx?'auto':'none',
        }}>
          <VideoCard
            video={video} currentUser={currentUser} isActive={i===idx}
            onFollow={onFollow} onMessage={onMessage} onViewProfile={onViewProfile}
            followed={followed} showToast={showToast} onBlock={onBlock}
          />
        </div>
      ))}

      {feed.length === 0 && (
        <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,color:DS.t4 }}>
          <div style={{ fontSize:48 }}>📭</div>
          <div style={{ fontSize:14 }}>No posts yet</div>
        </div>
      )}

      {/* Scroll indicator */}
      {feed.length > 1 && (
        <div style={{ position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',display:'flex',flexDirection:'column',gap:4,zIndex:10 }}>
          {feed.slice(0,Math.min(feed.length,20)).map((_,i) => (
            <div key={i} onClick={()=>setIdx(i)} style={{ width:3,height:i===idx?18:4,borderRadius:2,background:i===idx?DS.t1:'rgba(255,255,255,0.2)',cursor:'pointer',transition:'all 0.2s' }}/>
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   FRIENDS FEED (social graph)
═══════════════════════════════════════════ */
const FriendsFeed = ({
  videos, currentUser, followed, blockedUsers,
  onFollow, onMessage, onVoiceCall, onVideoCall,
  onViewProfile, onBlock, showToast,
  users, onCreateStory, onViewStory,
}) => {
  const [idx, setIdx] = useState(0);
  const startY = useRef(null);

  const feed = useMemo(() =>
    videos
      .filter(v => followed?.includes(v.userId) || v.userId===currentUser?.id)
      .filter(v => !(blockedUsers||[]).includes(v.userId))
      .sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)),
    [videos, followed, currentUser?.id, blockedUsers]
  );

  const handleSwipe = e => {
    if (!startY.current) return;
    const dy = startY.current - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 50) {
      haptic('light');
      if (dy>0) setIdx(i=>Math.min(feed.length-1,i+1));
      else setIdx(i=>Math.max(0,i-1));
    }
    startY.current=null;
  };

  return (
    <div style={{ height:'100%',position:'relative',overflow:'hidden',background:'#000' }}
      onTouchStart={e=>{startY.current=e.touches[0].clientY;}}
      onTouchEnd={handleSwipe}
    >
      {/* Header */}
      <div style={{ position:'absolute',top:0,left:0,right:0,zIndex:15,background:'linear-gradient(to bottom,rgba(0,0,0,0.72) 0%,transparent 100%)',padding:'14px 16px 24px' }}>
        <div style={{ color:DS.t1,fontWeight:800,fontSize:18,textAlign:'center' }}>Friends</div>
      </div>

      {/* Stories */}
      <div style={{ position:'absolute',top:56,left:0,right:0,zIndex:12 }}>
        <StoriesRow currentUser={currentUser} users={users} onCreateStory={onCreateStory} onViewStory={onViewStory}/>
      </div>

      {feed.length === 0 ? (
        <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,color:DS.t4,paddingTop:180 }}>
          <div style={{ fontSize:48 }}>👥</div>
          <div style={{ fontSize:14 }}>Follow people to see their posts here</div>
        </div>
      ) : feed.map((video,i) => (
        Math.abs(i-idx)>1?null:
        <div key={video.id} style={{ position:'absolute',inset:0,transform:`translateY(${(i-idx)*100}%)`,transition:'transform 0.3s ease',pointerEvents:i===idx?'auto':'none' }}>
          <VideoCard video={video} currentUser={currentUser} isActive={i===idx} onFollow={onFollow} onMessage={onMessage} onViewProfile={onViewProfile} followed={followed} showToast={showToast} onBlock={onBlock}/>
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════
   CREATE SCREEN
═══════════════════════════════════════════ */
const CreateScreen = ({ onOpenCamera, showToast }) => (
  <div style={{ height:'100%',background:DS.ink1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:28,gap:14,position:'relative',overflow:'hidden' }}>
    {/* Ambient orbs */}
    <div style={{ position:'absolute',width:300,height:300,borderRadius:'50%',background:'radial-gradient(ellipse,rgba(255,45,107,0.12),transparent 70%)',top:-80,left:-80,animation:'orb 8s ease-in-out infinite' }}/>
    <div style={{ position:'absolute',width:250,height:250,borderRadius:'50%',background:'radial-gradient(ellipse,rgba(139,92,246,0.10),transparent 70%)',bottom:-60,right:-60,animation:'orb 10s ease-in-out 2s infinite' }}/>

    <div style={{ textAlign:'center',marginBottom:16,position:'relative' }}>
      <div style={{ width:80,height:80,borderRadius:DS.r4,background:DS.aurora,backgroundSize:'200% 200%',animation:'auroraFlow 4s ease infinite',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px',fontSize:36 }}>🎬</div>
      <div style={{ color:DS.t1,fontWeight:900,fontSize:26 }}>Create</div>
      <div style={{ color:DS.t3,fontSize:14,marginTop:4 }}>Share your moment with the world</div>
    </div>

    {[
      { icon:'📷', label:'Open Camera', sub:'Photo or video', action:onOpenCamera, primary:true },
      { icon:'🖼️', label:'Upload from Gallery', sub:'Choose from device', action:onOpenCamera, primary:false },
      { icon:'✏️', label:'Text Post', sub:'Write a thought', action:onOpenCamera, primary:false },
      { icon:'🎙️', label:'Voice Note', sub:'Record your voice', action:onOpenCamera, primary:false },
    ].map(btn => (
      <button key={btn.label} onClick={btn.action} style={{
        width:'100%',maxWidth:340,background:btn.primary?DS.aurora:'rgba(255,255,255,0.04)',
        backgroundSize:'200% 200%',animation:btn.primary?'auroraFlow 4s ease infinite':undefined,
        border:btn.primary?'none':`1px solid ${DS.b2}`,borderRadius:DS.r4,
        padding:'16px 20px',color:DS.t1,display:'flex',alignItems:'center',gap:14,cursor:'pointer',
        position:'relative',
      }}>
        <div style={{ width:46,height:46,borderRadius:DS.r3,background:btn.primary?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24 }}>{btn.icon}</div>
        <div style={{ textAlign:'left' }}>
          <div style={{ fontWeight:700,fontSize:14 }}>{btn.label}</div>
          <div style={{ color:btn.primary?'rgba(255,255,255,0.6)':DS.t3,fontSize:12,marginTop:2 }}>{btn.sub}</div>
        </div>
      </button>
    ))}
  </div>
);

/* ═══════════════════════════════════════════
   CAMERA UPLOAD
═══════════════════════════════════════════ */
const CameraUpload = ({ currentUser, onUpload, onClose, showToast }) => {
  const [file, setFile] = useState(null);
  const [desc, setDesc] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [mode, setMode] = useState(null); // null | 'camera' | 'preview'

  const startCam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video:true,audio:true });
      streamRef.current=s;
      if(videoRef.current) videoRef.current.srcObject=s;
      setMode('camera');
    } catch { showToast?.('Camera denied','error'); setMode(null); }
  };

  useEffect(() => () => streamRef.current?.getTracks().forEach(t=>t.stop()), []);

  const capture = () => {
    if(!videoRef.current) return;
    const c=document.createElement('canvas');
    c.width=videoRef.current.videoWidth; c.height=videoRef.current.videoHeight;
    c.getContext('2d').drawImage(videoRef.current,0,0);
    c.toBlob(blob=>{
      setFile({url:URL.createObjectURL(blob),file:new File([blob],'photo.jpg',{type:'image/jpeg'}),type:'image/jpeg'});
      streamRef.current?.getTracks().forEach(t=>t.stop());
      setMode('preview');
    },'image/jpeg');
  };

  const handleFile = e => {
    const f=e.target.files[0];
    if(f){setFile({url:URL.createObjectURL(f),file:f,type:f.type}); setMode('preview');}
  };

  const upload = async () => {
    if(!file) return;
    setUploading(true); setProgress(0);
    try {
      const url = await uploadToCloudinary(file.file, setProgress);
      const vData = {
        userId:currentUser.id, username:currentUser.username||'',
        avatar:currentUser.avatar, avatarColor:currentUser.avatarColor,
        avatarUrl:currentUser.avatarUrl||null, verified:currentUser.verified||false,
        description:desc, videoUrl:url, mediaType:file.type,
        song:'Original sound', likes:0, comments:0, shares:0, views:0,
        hashtags:(desc||'').match(/#\w+/g)||[], category:'foryou',
        createdAt:serverTimestamp(),
      };
      const ref = await addDoc(collection(db,'videos'),vData);
      onUpload?.({id:ref.id,...vData,createdAt:{toDate:()=>new Date()}});
      showToast?.('Posted! 🚀','success'); onClose?.();
    } catch(e) { showToast?.('Upload failed','error'); }
    setUploading(false);
  };

  // Initial picker
  if (!mode) return (
    <div style={{ position:'fixed',inset:0,background:DS.ink0,zIndex:100,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:28 }}>
      <button onClick={onClose} style={{ position:'absolute',top:16,left:16,background:'rgba(255,255,255,0.1)',border:'none',borderRadius:'50%',width:40,height:40,color:'white',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
      <div style={{ color:DS.t1,fontWeight:800,fontSize:22,marginBottom:8 }}>New Post</div>
      <button onClick={startCam} style={{ width:'100%',maxWidth:300,background:DS.aurora,backgroundSize:'200% 200%',animation:'auroraFlow 4s ease infinite',border:'none',borderRadius:DS.r4,padding:18,color:'white',fontWeight:700,fontSize:15,cursor:'pointer' }}>📷 Open Camera</button>
      <button onClick={()=>fileRef.current?.click()} style={{ width:'100%',maxWidth:300,background:DS.ink3,border:`1px solid ${DS.b2}`,borderRadius:DS.r4,padding:18,color:DS.t1,fontWeight:700,fontSize:15,cursor:'pointer' }}>🖼️ Choose from Gallery</button>
      <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFile} style={{display:'none'}}/>
    </div>
  );

  // Camera view
  if (mode === 'camera') return (
    <div style={{ position:'fixed',inset:0,background:'#000',zIndex:100,display:'flex',flexDirection:'column' }}>
      <div style={{ position:'absolute',top:0,left:0,right:0,zIndex:10,padding:'50px 16px 16px',display:'flex',justifyContent:'space-between' }}>
        <button onClick={onClose} style={{ background:'rgba(0,0,0,0.5)',border:'none',borderRadius:'50%',width:40,height:40,color:'white',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
      </div>
      <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
      <div style={{ position:'absolute',bottom:60,left:'50%',transform:'translateX(-50%)' }}>
        <button onClick={capture} style={{ width:76,height:76,borderRadius:'50%',background:'white',border:'5px solid rgba(255,255,255,0.4)',cursor:'pointer' }}/>
      </div>
    </div>
  );

  // Preview
  return (
    <div style={{ position:'fixed',inset:0,background:'#000',zIndex:100,display:'flex',flexDirection:'column' }}>
      <div style={{ padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
        <button onClick={()=>{setFile(null);setMode(null);}} style={{ background:'rgba(255,255,255,0.1)',border:'none',borderRadius:20,padding:'8px 16px',color:'white',cursor:'pointer',fontSize:13 }}>Retake</button>
        <span style={{ color:'white',fontWeight:700,fontSize:16 }}>New Post</span>
        <button onClick={upload} disabled={uploading} className="btn-aurora" style={{ borderRadius:20,padding:'8px 18px',fontSize:13,opacity:uploading?0.7:1 }}>
          {uploading?`${progress}%`:'Post ✓'}
        </button>
      </div>
      {uploading && <div style={{ height:3,background:'rgba(255,255,255,0.1)' }}><div style={{ height:'100%',width:`${progress}%`,background:DS.aurora,backgroundSize:'200% 200%',animation:'auroraFlow 2s ease infinite',transition:'width 0.3s' }}/></div>}
      <div style={{ flex:1,position:'relative',overflow:'hidden' }}>
        {file?.type.startsWith('image/')
          ? <img src={file.url} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
          : <video src={file?.url} style={{ width:'100%',height:'100%',objectFit:'cover' }} controls autoPlay loop/>
        }
      </div>
      <div style={{ padding:'12px 16px 32px',background:'rgba(0,0,0,0.9)' }}>
        <textarea
          placeholder="Write a caption… #hashtags"
          value={desc} onChange={e=>setDesc(e.target.value)}
          style={{ width:'100%',background:'rgba(255,255,255,0.06)',border:`1px solid ${DS.b2}`,borderRadius:DS.r3,padding:'12px 14px',color:'white',minHeight:72,outline:'none',fontSize:13,resize:'none',boxSizing:'border-box',fontFamily:DS.font }}
        />
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   CONVERSATION VIEW (Telegram-grade DM)
═══════════════════════════════════════════ */
const ConversationView = ({
  currentUser, otherUser, conversationId,
  onBack, showToast, onViewProfile, onVoiceCall, onVideoCall,
}) => {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [presence, setPresence] = useState(null);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);

  const convId = conversationId || (currentUser?.id && otherUser?.id ? getConvId(currentUser.id, otherUser.id) : null);

  useEffect(() => {
    if (!convId || !currentUser?.id || !otherUser?.id) return;
    setDoc(doc(db,'conversations',convId),{participants:[currentUser.id,otherUser.id],lastMessageAt:serverTimestamp()},{merge:true}).catch(()=>{});
    const q = query(collection(db,'messages',convId,'msgs'),orderBy('createdAt','asc'));
    const unsub = onSnapshot(q, snap=>{
      setMessages(snap.docs.map(d=>({id:d.id,...d.data(),ts:d.data().createdAt?.toDate?.()})));
      setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),80);
    },()=>{
      const q2=query(collection(db,'messages',convId,'msgs'));
      onSnapshot(q2,snap2=>{
        const sorted=snap2.docs.map(d=>({id:d.id,...d.data(),ts:d.data().createdAt?.toDate?.()})).sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
        setMessages(sorted);
        setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),80);
      });
    });
    const pUnsub = onSnapshot(doc(db,'presence',otherUser.id),snap=>setPresence(snap.data()),()=>{});
    const tUnsub = onSnapshot(doc(db,'typing',convId),snap=>{
      const d=snap.data();
      setTyping(!!(d?.[otherUser.id]?.toMillis?.() && Date.now()-d[otherUser.id].toMillis()<4000));
    },()=>{});
    return ()=>{unsub();pUnsub();tUnsub();};
  },[convId,currentUser?.id,otherUser?.id]);

  const send = async () => {
    if (!text.trim() || !convId) return;
    const msg=text; setText('');
    try {
      await addDoc(collection(db,'messages',convId,'msgs'),{from:currentUser.id,to:otherUser.id,text:msg,createdAt:serverTimestamp(),status:'sent'});
      await setDoc(doc(db,'conversations',convId),{participants:[currentUser.id,otherUser.id],lastMessage:msg,lastMessageAt:serverTimestamp()},{merge:true});
      await notify(otherUser.id,currentUser.id,'message','sent you a message');
    } catch(e){showToast?.('Failed to send','error');setText(msg);}
  };

  const handleTyping = val => {
    setText(val);
    if (convId) setDoc(doc(db,'typing',convId),{[currentUser.id]:serverTimestamp()},{merge:true}).catch(()=>{});
    clearTimeout(typingTimer.current);
    typingTimer.current=setTimeout(()=>{if(convId)setDoc(doc(db,'typing',convId),{[currentUser.id]:null},{merge:true}).catch(()=>{});},3000);
  };

  if (!otherUser?.id) return (
    <div style={{ height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:DS.ink1,flexDirection:'column',gap:12 }}>
      <Spinner/>
      <div style={{ color:DS.t3 }}>Loading…</div>
      <button onClick={onBack} style={{ background:DS.t5,border:'none',borderRadius:20,padding:'8px 20px',color:DS.t3,cursor:'pointer' }}>← Back</button>
    </div>
  );

  return (
    <div style={{ height:'100%',display:'flex',flexDirection:'column',background:DS.ink1 }}>
      {/* Header */}
      <div style={{ padding:'12px 16px',borderBottom:`1px solid ${DS.b1}`,display:'flex',alignItems:'center',gap:12,background:DS.ink2,flexShrink:0 }}>
        <button onClick={onBack} style={{ background:'none',border:'none',color:DS.t1,cursor:'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center',width:32,height:32 }}>←</button>
        <Avatar user={otherUser} size={40} onClick={()=>onViewProfile?.(otherUser.id)}/>
        <div style={{ flex:1,cursor:'pointer' }} onClick={()=>onViewProfile?.(otherUser.id)}>
          <div style={{ color:DS.t1,fontWeight:700,fontSize:15 }}>@{otherUser.username}</div>
          <div style={{ color:presence?.online?DS.emerald:DS.t4,fontSize:11,display:'flex',alignItems:'center',gap:4 }}>
            <div style={{ width:6,height:6,borderRadius:'50%',background:presence?.online?DS.emerald:'rgba(255,255,255,0.2)' }}/>
            {presence?.online?'Online':'Offline'}
          </div>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          <button onClick={()=>onVoiceCall?.(otherUser.id)} style={{ background:'rgba(52,199,89,0.12)',border:`1px solid rgba(52,199,89,0.25)`,borderRadius:'50%',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
          </button>
          <button onClick={()=>onVideoCall?.(otherUser.id)} style={{ background:'rgba(175,82,222,0.12)',border:`1px solid rgba(175,82,222,0.25)`,borderRadius:'50%',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#af52de" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1,overflowY:'auto',padding:'14px 14px 8px' }}>
        {messages.length===0&&<div style={{ textAlign:'center',padding:'40px 0',color:DS.t4 }}>Start a conversation! 👋</div>}
        {messages.map(msg=>{
          const mine=msg.from===currentUser.id;
          return (
            <div key={msg.id} style={{ display:'flex',justifyContent:mine?'flex-end':'flex-start',marginBottom:10,alignItems:'flex-end',gap:8 }}>
              {!mine&&<Avatar user={otherUser} size={26}/>}
              <div style={{ maxWidth:'72%' }}>
                {msg.text&&<div style={{ background:mine?DS.aurora:'rgba(255,255,255,0.09)',backgroundSize:'200% 200%',animation:mine?'auroraFlow 4s ease infinite':undefined,borderRadius:mine?'18px 18px 4px 18px':'18px 18px 18px 4px',padding:'10px 14px',color:DS.t1,fontSize:14,lineHeight:1.4 }}>{msg.text}</div>}
                <div style={{ color:DS.t4,fontSize:10,marginTop:3,textAlign:mine?'right':'left' }}>
                  {msg.ts?msg.ts.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''}
                  {mine&&<span style={{ marginLeft:4,color:msg.status==='seen'?'#4fc3f7':DS.t4 }}>{msg.status==='sent'?'✓':'✓✓'}</span>}
                </div>
              </div>
            </div>
          );
        })}
        {typing&&(
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8 }}>
            <Avatar user={otherUser} size={26}/>
            <div style={{ background:'rgba(255,255,255,0.09)',borderRadius:'18px 18px 18px 4px',padding:'12px 16px',display:'flex',gap:4 }}>
              {[0,1,2].map(i=><div key={i} style={{ width:6,height:6,borderRadius:'50%',background:DS.t3,animation:`pulse 1.4s ease ${i*0.22}s infinite` }}/>)}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{ padding:'10px 14px',paddingBottom:'max(28px,env(safe-area-inset-bottom))',borderTop:`1px solid ${DS.b1}`,display:'flex',gap:8,alignItems:'center',flexShrink:0,background:DS.ink2 }}>
        <input
          value={text} onChange={e=>handleTyping(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&send()}
          placeholder="Message…"
          style={{ flex:1,background:DS.t5,border:`1px solid ${DS.b2}`,borderRadius:DS.rFull,padding:'11px 16px',color:DS.t1,outline:'none',fontSize:13 }}
        />
        <button onClick={send} style={{ background:DS.aurora,backgroundSize:'200% 200%',animation:'auroraFlow 4s ease infinite',border:'none',borderRadius:'50%',width:42,height:42,color:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   INBOX PAGE
═══════════════════════════════════════════ */
const InboxPage = ({
  currentUser, users, showToast,
  onViewProfile, initialTargetId, onClearTarget,
  onVoiceCall, onVideoCall,
}) => {
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!currentUser?.id) return;
    if (initialTargetId) {
      const convId = getConvId(currentUser.id, initialTargetId);
      const u = users.find(u=>u.id===initialTargetId)||{id:initialTargetId};
      setActive({id:convId,otherUser:u});
      onClearTarget?.();
    }
  }, [initialTargetId, currentUser?.id, users]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const q = query(collection(db,'conversations'),where('participants','array-contains',currentUser.id),orderBy('lastMessageAt','desc'));
    const unsub = onSnapshot(q,snap=>{
      setConversations(snap.docs.map(d=>({id:d.id,...d.data()})));
    },()=>{
      const q2=query(collection(db,'conversations'),where('participants','array-contains',currentUser.id));
      onSnapshot(q2,snap2=>{
        setConversations(snap2.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.lastMessageAt?.seconds||0)-(a.lastMessageAt?.seconds||0)));
      });
    });
    return ()=>unsub();
  },[currentUser?.id]);

  const convUsers = useMemo(()=>{
    if (!currentUser?.id) return [];
    const res=[];
    conversations.forEach(conv=>{
      const otherId=(conv.participants||[]).find(p=>p!==currentUser.id);
      if (!otherId) return;
      const u=users.find(u=>u.id===otherId)||{id:otherId,username:'User',avatar:'?',avatarColor:DS.rose};
      res.push({...conv,otherUser:u});
    });
    return search?res.filter(r=>r.otherUser?.username?.toLowerCase().includes(search.toLowerCase())):res;
  },[conversations,users,currentUser?.id,search]);

  if (active) return (
    <ConversationView
      currentUser={currentUser} otherUser={active.otherUser}
      conversationId={active.id}
      onBack={()=>setActive(null)} showToast={showToast}
      onViewProfile={onViewProfile} onVoiceCall={onVoiceCall} onVideoCall={onVideoCall}
    />
  );

  return (
    <div style={{ height:'100%',display:'flex',flexDirection:'column',background:DS.ink1 }}>
      <div style={{ padding:'16px 16px 10px',borderBottom:`1px solid ${DS.b1}`,flexShrink:0 }}>
        <div style={{ color:DS.t1,fontWeight:800,fontSize:22,marginBottom:12 }}>Messages</div>
        <div className="focus-aurora" style={{ display:'flex',alignItems:'center',background:DS.t5,border:`1px solid ${DS.b1}`,borderRadius:DS.r3,padding:'10px 14px',gap:8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={DS.t4} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search messages…" style={{ flex:1,background:'none',border:'none',color:DS.t1,outline:'none',fontSize:14 }}/>
        </div>
      </div>
      <div style={{ flex:1,overflowY:'auto' }}>
        {convUsers.length===0&&(
          <div style={{ textAlign:'center',padding:'60px 20px',color:DS.t4 }}>
            <div style={{ fontSize:44,marginBottom:12 }}>💬</div>
            <div style={{ fontSize:14 }}>No messages yet</div>
            <div style={{ fontSize:12,marginTop:6,color:DS.t5 }}>Go to a profile and tap Message</div>
          </div>
        )}
        {convUsers.map(conv=>(
          <div key={conv.id} onClick={()=>setActive({id:conv.id,otherUser:conv.otherUser})} style={{ display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderBottom:`1px solid ${DS.b1}`,cursor:'pointer' }}>
            <div style={{ position:'relative' }}>
              <Avatar user={conv.otherUser} size={52}/>
              <div style={{ position:'absolute',bottom:1,right:1,width:13,height:13,background:DS.emerald,borderRadius:'50%',border:`2px solid ${DS.ink1}` }}/>
            </div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ color:DS.t1,fontWeight:700,fontSize:14 }}>@{conv.otherUser?.username}</div>
              <div style={{ color:DS.t3,fontSize:12,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{conv.lastMessage||'Tap to chat'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   SEARCH OVERLAY
═══════════════════════════════════════════ */
const SearchOverlay = ({ onClose, videos, users, onViewProfile }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    if (!query.trim()) return { users:[], videos:[] };
    const q = query.toLowerCase();
    return {
      users: users.filter(u=>u.username?.toLowerCase().includes(q)||u.fullName?.toLowerCase().includes(q)).slice(0,8),
      videos: videos.filter(v=>v.description?.toLowerCase().includes(q)||v.username?.toLowerCase().includes(q)).slice(0,6),
    };
  }, [query, users, videos]);

  return (
    <div style={{ position:'absolute',inset:0,background:DS.ink1,zIndex:200,display:'flex',flexDirection:'column' }}>
      <div style={{ padding:'12px 16px',borderBottom:`1px solid ${DS.b1}`,display:'flex',gap:10,alignItems:'center',flexShrink:0 }}>
        <div className="focus-aurora" style={{ flex:1,display:'flex',alignItems:'center',background:DS.t5,border:`1px solid ${DS.b2}`,borderRadius:DS.r3,padding:'11px 14px',gap:10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DS.t3} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search people, videos…" style={{ flex:1,background:'none',border:'none',color:DS.t1,outline:'none',fontSize:15 }}/>
          {query&&<button onClick={()=>setQuery('')} style={{ background:DS.b2,border:'none',borderRadius:'50%',width:20,height:20,color:DS.t2,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>}
        </div>
        <button onClick={onClose} style={{ background:'none',border:'none',color:DS.t2,fontSize:14,cursor:'pointer',fontWeight:600,padding:'4px 8px' }}>Cancel</button>
      </div>

      <div style={{ flex:1,overflowY:'auto',padding:'8px 14px' }}>
        {!query && (
          <div style={{ paddingTop:20 }}>
            <div style={{ color:DS.t4,fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:14 }}>Trending</div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
              {['#dagu','#ethiopia','#viral','#music','#dance','#comedy','#travel','#food'].map(tag=>(
                <button key={tag} onClick={()=>setQuery(tag)} style={{ background:DS.ink3,border:`1px solid ${DS.b2}`,borderRadius:DS.rFull,padding:'7px 14px',color:DS.rose,fontSize:13,fontWeight:700,cursor:'pointer' }}>{tag}</button>
              ))}
            </div>
            <div style={{ color:DS.t4,fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,margin:'24px 0 14px' }}>People to Follow</div>
            {users.slice(0,5).map(u=>(
              <div key={u.id} onClick={()=>{onViewProfile?.(u.id);onClose();}} style={{ display:'flex',alignItems:'center',gap:12,padding:'11px 0',borderBottom:`1px solid ${DS.b1}`,cursor:'pointer' }}>
                <Avatar user={u} size={44}/>
                <div style={{ flex:1 }}>
                  <div style={{ color:DS.t1,fontWeight:700,fontSize:14 }}>@{u.username}</div>
                  <div style={{ color:DS.t3,fontSize:12,marginTop:1 }}>{u.bio?.slice(0,40)||'No bio'}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {query && (
          <>
            {results.users.length>0&&(
              <>
                <div style={{ color:DS.t4,fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,margin:'16px 0 12px' }}>People</div>
                {results.users.map(u=>(
                  <div key={u.id} onClick={()=>{onViewProfile?.(u.id);onClose();}} style={{ display:'flex',alignItems:'center',gap:12,padding:'11px 12px',background:DS.ink3,borderRadius:DS.r3,marginBottom:8,cursor:'pointer',border:`1px solid ${DS.b1}` }}>
                    <Avatar user={u} size={46}/>
                    <div style={{ flex:1 }}>
                      <div style={{ color:DS.t1,fontWeight:700,fontSize:14 }}>@{u.username}</div>
                      <div style={{ color:DS.t3,fontSize:12,marginTop:1 }}>{(u.followers?.length||0).toLocaleString()} followers</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DS.t4} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                ))}
              </>
            )}
            {results.videos.length>0&&(
              <>
                <div style={{ color:DS.t4,fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,margin:'16px 0 12px' }}>Videos</div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
                  {results.videos.map(v=>(
                    <div key={v.id} style={{ aspectRatio:'9/16',borderRadius:DS.r3,overflow:'hidden',background:DS.ink3,position:'relative' }}>
                      {v.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i)||v.mediaType?.startsWith('image')
                        ?<img src={v.videoUrl} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
                        :<video src={v.videoUrl} style={{ width:'100%',height:'100%',objectFit:'cover' }} muted/>
                      }
                      <div style={{ position:'absolute',bottom:6,left:8,color:'white',fontSize:11,fontWeight:700,textShadow:'0 1px 4px rgba(0,0,0,0.8)' }}>@{v.username}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {results.users.length===0&&results.videos.length===0&&(
              <div style={{ textAlign:'center',padding:'60px 0',color:DS.t4 }}>
                <div style={{ fontSize:40,marginBottom:12 }}>🔍</div>
                <div style={{ fontSize:14 }}>No results for "{query}"</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   NOTIFICATIONS PAGE
═══════════════════════════════════════════ */
const NotificationsPage = ({ currentUser, users, onClose, onViewProfile }) => {
  const [notifs, setNotifs] = useState([]);
  const icons = { like:'❤️',comment:'💬',follow:'👤',message:'✉️',gift:'🎁',call:'📞',mention:'@' };

  useEffect(() => {
    if (!currentUser?.id) return;
    const q = query(collection(db,'notifications'),where('toUserId','==',currentUser.id),orderBy('createdAt','desc'),limit(80));
    const unsub = onSnapshot(q,snap=>{
      setNotifs(snap.docs.map(d=>({id:d.id,...d.data(),date:d.data().createdAt?.toDate?.()})));
    });
    return ()=>unsub();
  },[currentUser?.id]);

  const markRead = () => {
    notifs.filter(n=>!n.read).forEach(n=>updateDoc(doc(db,'notifications',n.id),{read:true}).catch(()=>{}));
  };

  const handleTap = async n => {
    if (!n.read) await updateDoc(doc(db,'notifications',n.id),{read:true}).catch(()=>{});
    if (n.fromUserId) onViewProfile?.(n.fromUserId);
    onClose?.();
  };

  return (
    <div style={{ position:'fixed',inset:0,background:DS.ink1,zIndex:300,display:'flex',flexDirection:'column' }}>
      <div style={{ padding:'16px 16px 12px',borderBottom:`1px solid ${DS.b1}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0 }}>
        <div style={{ color:DS.t1,fontWeight:800,fontSize:22 }}>Activity</div>
        <div style={{ display:'flex',gap:8 }}>
          <button onClick={markRead} style={{ background:DS.ink3,border:`1px solid ${DS.b2}`,borderRadius:DS.rFull,padding:'6px 12px',color:DS.t2,fontSize:11,fontWeight:700,cursor:'pointer' }}>Mark all read</button>
          <button onClick={onClose} style={{ background:DS.t5,border:'none',borderRadius:'50%',width:32,height:32,color:DS.t1,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
        </div>
      </div>
      <div style={{ flex:1,overflowY:'auto' }}>
        {notifs.length===0&&(
          <div style={{ textAlign:'center',padding:'60px 20px',color:DS.t4 }}>
            <div style={{ fontSize:44,marginBottom:12 }}>🔔</div>
            <div>No activity yet</div>
          </div>
        )}
        {notifs.map(n=>{
          const from=users.find(u=>u.id===n.fromUserId);
          return (
            <div key={n.id} onClick={()=>handleTap(n)} style={{ display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderBottom:`1px solid ${DS.b1}`,cursor:'pointer',background:n.read?'transparent':'rgba(255,45,107,0.03)' }}>
              <div style={{ position:'relative',flexShrink:0 }}>
                <Avatar user={from} size={46}/>
                <div style={{ position:'absolute',bottom:-2,right:-2,width:20,height:20,borderRadius:'50%',background:DS.ink2,border:`1.5px solid ${DS.b2}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11 }}>{icons[n.type]||'🔔'}</div>
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ color:DS.t1,fontSize:13.5,lineHeight:1.5 }}>
                  {from&&<span style={{ fontWeight:700 }}>@{from.username} </span>}
                  <span style={{ color:DS.t2 }}>{n.message}</span>
                </div>
                <div style={{ color:DS.t4,fontSize:11,marginTop:2 }}>{timeAgo(n.date)}</div>
              </div>
              {!n.read&&<div style={{ width:9,height:9,borderRadius:'50%',background:DS.rose,flexShrink:0 }}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   PROFILE PAGE (complete)
═══════════════════════════════════════════ */
const ProfilePage = ({
  user, setCurrentUser, onLogout, users,
  showToast, allVideos, setBlockedUsers,
  onViewProfile,
}) => {
  const [sub, setSub] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [tab, setTab] = useState('posts');
  const [username, setUsername] = useState(user?.username||'');
  const [bio, setBio] = useState(user?.bio||'');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl||null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const myVideos = allVideos?.filter(v=>v.userId===user?.id)||[];

  const saveProfile = async () => {
    setSaving(true);
    try {
      let avatarUrl=user?.avatarUrl||null;
      if (avatarFile) avatarUrl=await uploadToCloudinary(avatarFile);
      const updates={username,bio,avatarUrl,avatar:username[0]?.toUpperCase()||'U'};
      await updateDoc(doc(db,'users',user.id),updates);
      setCurrentUser(u=>({...u,...updates}));
      showToast?.('Profile updated!','success'); setEditMode(false);
    } catch(e){showToast?.('Update failed','error');}
    setSaving(false);
  };

  if (sub==='settings') return (
    <div style={{ height:'100%',overflow:'auto',background:DS.ink1 }}>
      <div style={{ padding:'16px' }}>
        <button onClick={()=>setSub(null)} style={{ background:DS.t5,border:'none',borderRadius:20,padding:'8px 16px',color:DS.t2,cursor:'pointer',fontSize:13,marginBottom:20,display:'flex',alignItems:'center',gap:6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>Back
        </button>
        <div style={{ color:DS.t1,fontWeight:800,fontSize:22,marginBottom:24 }}>Settings</div>
        {[
          {label:'Change Password',fn:async()=>{if(user?.email){await sendPasswordResetEmail(auth,user.email);showToast?.('Reset email sent','success');}}},
          {label:'Language',fn:()=>showToast?.('Coming soon','info')},
          {label:'Privacy & Safety',fn:()=>showToast?.('Coming soon','info')},
          {label:'Help Center',fn:()=>showToast?.('Coming soon','info')},
          {label:'Report a Problem',fn:async()=>{await sendEmail({to_email:SUPPORT_EMAIL,from_name:user?.username,message:`Report from @${user?.username}`});showToast?.('Report sent','success');}},
          {label:'Terms of Service',fn:()=>window.open('https://dagu.app/terms','_blank')},
          {label:'Privacy Policy',fn:()=>window.open('https://dagu.app/privacy','_blank')},
        ].map((item,i,arr)=>(
          <div key={item.label} onClick={item.fn} style={{ padding:'14px 0',borderBottom:i<arr.length-1?`1px solid ${DS.b1}`:'',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer' }}>
            <span style={{ color:DS.t1,fontSize:14 }}>{item.label}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DS.t4} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        ))}
        <div style={{ marginTop:24 }}>
          <button onClick={onLogout} style={{ width:'100%',background:'rgba(255,45,107,0.1)',border:`1px solid rgba(255,45,107,0.25)`,borderRadius:DS.r3,padding:14,color:DS.rose,fontWeight:700,cursor:'pointer',fontSize:14 }}>Log Out</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ height:'100%',overflow:'auto',background:DS.ink1 }}>
      {/* Cover / avatar area */}
      <div style={{ position:'relative',paddingBottom:20 }}>
        <div style={{ height:160,background:user?.avatarUrl?'transparent':DS.aurora,backgroundSize:'200% 200%',animation:user?.avatarUrl?undefined:'auroraFlow 5s ease infinite',overflow:'hidden',position:'relative' }}>
          {user?.avatarUrl&&<img src={user.avatarUrl} alt="" style={{ width:'100%',height:'100%',objectFit:'cover',filter:'blur(20px) brightness(0.5) saturate(1.8)',transform:'scale(1.15)' }}/>}
          <div style={{ position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(0,0,0,0.1),rgba(8,8,15,0.85))' }}/>
        </div>

        <div style={{ position:'relative',padding:'0 20px',marginTop:-50 }}>
          {/* Hamburger */}
          <div style={{ position:'absolute',top:-100,right:16,display:'flex',gap:8 }}>
            <button onClick={()=>setSub('settings')} style={{ background:'rgba(0,0,0,0.5)',backdropFilter:'blur(10px)',border:`1px solid ${DS.b2}`,borderRadius:'50%',width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
          </div>

          {/* Avatar */}
          <div style={{ width:90,height:90,borderRadius:'50%',padding:3,background:DS.aurora,backgroundSize:'200% 200%',animation:'auroraFlow 4s ease infinite',marginBottom:14,position:'relative' }}>
            <div style={{ width:'100%',height:'100%',borderRadius:'50%',background:DS.ink1,padding:2 }}>
              <div style={{ width:'100%',height:'100%',borderRadius:'50%',background:user?.avatarColor||DS.rose,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:800,fontSize:34,overflow:'hidden' }}>
                {(avatarPreview||user?.avatarUrl)?<img src={avatarPreview||user.avatarUrl} style={{ width:'100%',height:'100%',objectFit:'cover' }} alt=""/>:(user?.avatar)}
              </div>
            </div>
            {editMode&&(
              <button onClick={()=>fileRef.current?.click()} style={{ position:'absolute',bottom:2,right:2,background:DS.aurora,backgroundSize:'200% 200%',animation:'auroraFlow 4s ease infinite',border:`2px solid ${DS.ink1}`,borderRadius:'50%',width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:13 }}>✏️</button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];if(f){setAvatarFile(f);setAvatarPreview(URL.createObjectURL(f));}}} style={{display:'none'}}/>
          </div>

          {!editMode ? (
            <>
              <div style={{ color:DS.t1,fontWeight:800,fontSize:22 }}>@{user?.username}</div>
              {user?.verified&&<div style={{ display:'inline-flex',alignItems:'center',gap:4,color:'#1d9bf0',fontSize:12,marginTop:4,background:'rgba(29,155,240,0.1)',borderRadius:DS.rFull,padding:'2px 10px' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="#1d9bf0"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Verified</div>}
              {user?.bio&&<div style={{ color:DS.t2,fontSize:13,marginTop:8,lineHeight:1.6 }}>{user.bio}</div>}
              <button onClick={()=>setEditMode(true)} style={{ marginTop:14,background:DS.t5,border:`1px solid ${DS.b2}`,borderRadius:DS.r2,padding:'9px 28px',color:DS.t1,fontWeight:700,cursor:'pointer',fontSize:13 }}>Edit Profile</button>
            </>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:10,marginTop:4 }}>
              <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" style={{ background:DS.t5,border:`1px solid ${DS.b2}`,borderRadius:DS.r2,padding:'11px 14px',color:DS.t1,outline:'none',fontSize:14,fontFamily:DS.font }}/>
              <textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="Bio" rows={3} style={{ background:DS.t5,border:`1px solid ${DS.b2}`,borderRadius:DS.r2,padding:'11px 14px',color:DS.t1,outline:'none',fontSize:14,resize:'none',fontFamily:DS.font }}/>
              <div style={{ display:'flex',gap:8 }}>
                <button onClick={()=>setEditMode(false)} style={{ flex:1,background:DS.t5,border:`1px solid ${DS.b2}`,borderRadius:DS.r2,padding:11,color:DS.t2,cursor:'pointer',fontSize:13,fontWeight:600 }}>Cancel</button>
                <button onClick={saveProfile} disabled={saving} className="btn-aurora" style={{ flex:1,borderRadius:DS.r2,padding:11,fontSize:13,opacity:saving?0.7:1 }}>{saving?'Saving…':'Save'}</button>
              </div>
            </div>
          )}

          {/* Stats */}
          <div style={{ display:'flex',gap:0,marginTop:18,background:DS.t5,borderRadius:DS.r3,overflow:'hidden',border:`1px solid ${DS.b1}` }}>
            {[['Posts',myVideos.length],['Followers',user?.followers?.length||0],['Following',user?.following?.length||0]].map(([label,val],i,arr)=>(
              <div key={label} style={{ flex:1,textAlign:'center',padding:'14px 0',borderRight:i<arr.length-1?`1px solid ${DS.b1}`:'none' }}>
                <div style={{ color:DS.t1,fontWeight:800,fontSize:20 }}>{fmtNum(val)}</div>
                <div style={{ color:DS.t3,fontSize:11,marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Badges row */}
          <div style={{ display:'flex',gap:8,marginTop:12,flexWrap:'wrap' }}>
            <div style={{ background:'rgba(255,149,0,0.12)',border:'1px solid rgba(255,149,0,0.25)',borderRadius:DS.rFull,padding:'6px 14px',display:'flex',alignItems:'center',gap:6 }}>
              <span>🔥</span><span style={{ color:'#ff9500',fontSize:12,fontWeight:700 }}>{user?.streak||1}d streak</span>
            </div>
            <div style={{ background:'rgba(255,215,0,0.1)',border:'1px solid rgba(255,215,0,0.2)',borderRadius:DS.rFull,padding:'6px 14px',display:'flex',alignItems:'center',gap:6 }}>
              <span>🪙</span><span style={{ color:'#ffd700',fontSize:12,fontWeight:700 }}>{(user?.coins||0).toLocaleString()}</span>
            </div>
            {user?.subscription!=='free'&&<div style={{ background:DS.aurora,backgroundSize:'200% 200%',animation:'auroraFlow 4s ease infinite',borderRadius:DS.rFull,padding:'6px 14px',display:'flex',alignItems:'center',gap:6 }}>
              <span>👑</span><span style={{ color:'white',fontSize:12,fontWeight:700,textTransform:'capitalize' }}>{user.subscription}</span>
            </div>}
          </div>
        </div>
      </div>

      {/* Content tabs */}
      <div style={{ display:'flex',borderTop:`1px solid ${DS.b1}`,borderBottom:`1px solid ${DS.b1}`,background:DS.ink1,position:'sticky',top:0,zIndex:10 }}>
        {[{id:'posts',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>},{id:'liked',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1,background:'none',border:'none',borderTop:tab===t.id?`2px solid ${DS.rose}`:`2px solid transparent`,padding:'14px 0',color:tab===t.id?DS.t1:DS.t4,cursor:'pointer',display:'flex',justifyContent:'center' }}>{t.icon}</button>
        ))}
      </div>

      <div style={{ padding:2 }}>
        {tab==='posts'&&(
          myVideos.length===0?(
            <div style={{ textAlign:'center',padding:'48px 20px',color:DS.t4 }}>
              <div style={{ fontSize:48,marginBottom:12 }}>🎬</div>
              <div style={{ fontSize:15,fontWeight:600 }}>No posts yet</div>
              <div style={{ fontSize:13,marginTop:4 }}>Create your first post!</div>
            </div>
          ):(
            <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:2 }}>
              {myVideos.map(v=>(
                <div key={v.id} style={{ aspectRatio:'9/16',background:DS.ink3,position:'relative',overflow:'hidden' }}>
                  {v.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i)||v.mediaType?.startsWith('image')
                    ?<img src={v.videoUrl} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
                    :<video src={v.videoUrl} style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
                  }
                  <div style={{ position:'absolute',bottom:4,left:6,color:'white',fontSize:10,fontWeight:700,background:'rgba(0,0,0,0.6)',borderRadius:6,padding:'2px 6px' }}>{fmtNum(v.views)} ▶</div>
                  <button onClick={async(e)=>{e.stopPropagation();if(window.confirm('Delete this post?')){await deleteDoc(doc(db,'videos',v.id));showToast?.('Deleted','success');}}} style={{ position:'absolute',top:4,right:4,background:'rgba(255,45,107,0.8)',border:'none',borderRadius:'50%',width:22,height:22,color:'white',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
                </div>
              ))}
            </div>
          )
        )}
        {tab==='liked'&&<div style={{ textAlign:'center',padding:'48px 20px',color:DS.t4 }}><div style={{ fontSize:40,marginBottom:12 }}>❤️</div><div>Liked posts appear here</div></div>}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   USER PROFILE MODAL
═══════════════════════════════════════════ */
const UserProfileModal = ({
  user, currentUser, onClose, onFollow,
  onMessage, onVoiceCall, onVideoCall,
  followed, showToast, userVideos,
}) => {
  const isFollowing = followed?.includes(user?.id);
  const isOwn = user?.id===currentUser?.id;

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:3000,display:'flex',alignItems:'flex-end' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%',background:DS.ink2,borderTopLeftRadius:DS.r5,borderTopRightRadius:DS.r5,maxHeight:'88vh',overflowY:'auto',border:`1px solid ${DS.b1}`,borderBottom:'none' }}>
        <div style={{ width:36,height:4,background:DS.b3,borderRadius:2,margin:'14px auto 0' }}/>
        <div style={{ display:'flex',justifyContent:'flex-end',padding:'10px 16px 0' }}>
          <button onClick={onClose} style={{ background:DS.t5,border:'none',borderRadius:'50%',width:32,height:32,color:DS.t1,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
        </div>
        <div style={{ textAlign:'center',padding:'4px 20px 20px' }}>
          <div style={{ width:90,height:90,borderRadius:'50%',padding:3,background:DS.aurora,backgroundSize:'200% 200%',animation:'auroraFlow 4s ease infinite',margin:'0 auto 14px' }}>
            <div style={{ width:'100%',height:'100%',borderRadius:'50%',background:DS.ink1,padding:2 }}>
              <Avatar user={user} size={82}/>
            </div>
          </div>
          <div style={{ color:DS.t1,fontWeight:800,fontSize:20 }}>@{user?.username}</div>
          {user?.verified&&<div style={{ display:'inline-flex',alignItems:'center',gap:4,color:'#1d9bf0',fontSize:12,marginTop:4 }}>✓ Verified</div>}
          {user?.bio&&<div style={{ color:DS.t2,fontSize:13,marginTop:8,lineHeight:1.6 }}>{user.bio}</div>}
          <div style={{ display:'flex',gap:0,marginTop:18,background:DS.t5,borderRadius:DS.r3,overflow:'hidden',border:`1px solid ${DS.b1}` }}>
            {[['Posts',(userVideos||[]).length],['Followers',user?.followers?.length||0],['Following',user?.following?.length||0]].map(([l,v],i,arr)=>(
              <div key={l} style={{ flex:1,textAlign:'center',padding:'12px 0',borderRight:i<arr.length-1?`1px solid ${DS.b1}`:'none' }}>
                <div style={{ color:DS.t1,fontWeight:800,fontSize:18 }}>{fmtNum(v)}</div>
                <div style={{ color:DS.t3,fontSize:11,marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        {!isOwn&&(
          <div style={{ display:'flex',gap:8,padding:'0 16px 16px' }}>
            <button onClick={()=>{onFollow?.(user.id);onClose();}} style={{ flex:1,background:isFollowing?DS.t5:DS.aurora,backgroundSize:'200% 200%',animation:isFollowing?undefined:'auroraFlow 4s ease infinite',border:isFollowing?`1px solid ${DS.b3}`:'none',borderRadius:DS.r3,padding:12,color:DS.t1,fontWeight:700,cursor:'pointer',fontSize:14 }}>
              {isFollowing?'Following':'+ Follow'}
            </button>
            <button onClick={()=>{onMessage?.(user.id);onClose();}} style={{ flex:1,background:DS.t5,border:`1px solid ${DS.b2}`,borderRadius:DS.r3,padding:12,color:DS.t1,fontWeight:600,cursor:'pointer',fontSize:14 }}>Message</button>
            <button onClick={()=>{onVoiceCall?.(user.id);onClose();}} style={{ background:'rgba(52,199,89,0.12)',border:'1px solid rgba(52,199,89,0.25)',borderRadius:DS.r3,padding:'12px 14px',cursor:'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
            </button>
            <button onClick={()=>{onVideoCall?.(user.id);onClose();}} style={{ background:'rgba(175,82,222,0.12)',border:'1px solid rgba(175,82,222,0.25)',borderRadius:DS.r3,padding:'12px 14px',cursor:'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#af52de" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
            </button>
          </div>
        )}
        {(userVideos||[]).length>0&&(
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:2,padding:'0 0 2px' }}>
            {(userVideos||[]).map(v=>(
              <div key={v.id} style={{ aspectRatio:'9/16',background:DS.ink3,overflow:'hidden' }}>
                {v.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i)||v.mediaType?.startsWith('image')
                  ?<img src={v.videoUrl} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
                  :<video src={v.videoUrl} style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
                }
              </div>
            ))}
          </div>
        )}
        <div style={{ height:20 }}/>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   CALL MODAL (WebRTC)
═══════════════════════════════════════════ */
const CallModal = ({ type, contactName, contactAvatar, contactId, currentUser, onClose, isCallee, callDocId: callDocIdProp }) => {
  const [status, setStatus] = useState('calling');
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const pcRef = useRef(null);
  const localStream = useRef(null);
  const callDocId = useRef(callDocIdProp || getConvId(currentUser?.id||'', contactId||''));
  const unsubA = useRef(()=>{});
  const unsubC = useRef(()=>{});

  useEffect(() => {
    const start = async () => {
      try {
        const constraints = type==='video'?{audio:true,video:{facingMode:'user'}}:{audio:true,video:false};
        const stream = await navigator.mediaDevices.getUserMedia(constraints).catch(()=>navigator.mediaDevices.getUserMedia({audio:true,video:false}));
        localStream.current=stream;
        if(localRef.current){localRef.current.srcObject=stream;localRef.current.play().catch(()=>{});}
        const pc = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'turn:global.relay.metered.ca:80',username:'f5e29fd91b8ea2fc485c24ac',credential:'FZlzkJ5GJJUyYocD'}]});
        pcRef.current=pc;
        stream.getTracks().forEach(t=>pc.addTrack(t,stream));
        pc.ontrack=e=>{if(remoteRef.current){remoteRef.current.srcObject=e.streams[0];remoteRef.current.play().catch(()=>{});}setStatus('connected');};
        pc.onconnectionstatechange=()=>{if(['disconnected','failed'].includes(pc.connectionState)){setStatus('failed');setTimeout(onClose,2000);}};
        const callSnap=await getDoc(doc(db,'calls',callDocId.current)).catch(()=>null);
        const isCallee2=isCallee!=null?isCallee:(callSnap?.data()?.calleeId===currentUser?.id);
        if(isCallee2){
          if(!callSnap?.data()?.offer){setStatus('failed');setTimeout(onClose,2000);return;}
          await pc.setRemoteDescription(new RTCSessionDescription(callSnap.data().offer));
          const ans=await pc.createAnswer();await pc.setLocalDescription(ans);
          await updateDoc(doc(db,'calls',callDocId.current),{answer:{type:ans.type,sdp:ans.sdp},status:'answered'});
          pc.onicecandidate=e=>{if(e.candidate)addDoc(collection(db,'calls',callDocId.current,'calleeCandidates'),e.candidate.toJSON()).catch(()=>{});};
          unsubC.current=onSnapshot(collection(db,'calls',callDocId.current,'callerCandidates'),snap=>{snap.docChanges().forEach(async ch=>{if(ch.type==='added')try{await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data()));}catch{}});});
        } else {
          pc.onicecandidate=e=>{if(e.candidate)addDoc(collection(db,'calls',callDocId.current,'callerCandidates'),e.candidate.toJSON()).catch(()=>{});};
          const offer=await pc.createOffer();await pc.setLocalDescription(offer);
          await setDoc(doc(db,'calls',callDocId.current),{offer:{type:offer.type,sdp:offer.sdp},callType:type,callerId:currentUser?.id,callerName:currentUser?.username,callerAvatar:currentUser?.avatar,callerColor:currentUser?.avatarColor,calleeId:contactId,status:'ringing',createdAt:serverTimestamp()});
          unsubA.current=onSnapshot(doc(db,'calls',callDocId.current),async snap=>{const d=snap.data();if(d?.answer&&pc.signalingState==='have-local-offer')try{await pc.setRemoteDescription(new RTCSessionDescription(d.answer));setStatus('connected');}catch{}if(d?.status==='declined'){setStatus('declined');setTimeout(onClose,1500);}});
          unsubC.current=onSnapshot(collection(db,'calls',callDocId.current,'calleeCandidates'),snap=>{snap.docChanges().forEach(async ch=>{if(ch.type==='added')try{await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data()));}catch{}});});
        }
        setTimeout(()=>setStatus(s=>s==='calling'?'connected':s),8000);
      } catch(e){setStatus('failed');setTimeout(onClose,2500);}
    };
    start();
    return ()=>{
      unsubA.current();unsubC.current();
      localStream.current?.getTracks().forEach(t=>t.stop());
      pcRef.current?.close();
      deleteDoc(doc(db,'calls',callDocId.current)).catch(()=>{});
    };
  },[]);

  useEffect(()=>{
    if(status!=='connected')return;
    const i=setInterval(()=>setDuration(d=>d+1),1000);
    return()=>clearInterval(i);
  },[status]);

  const fmt=()=>{const m=Math.floor(duration/60),s=duration%60;return`${m}:${s.toString().padStart(2,'0')}`;};
  const toggleMute=()=>{localStream.current?.getAudioTracks().forEach(t=>{t.enabled=!t.enabled;});setMuted(v=>!v);};
  const toggleCam=()=>{localStream.current?.getVideoTracks().forEach(t=>{t.enabled=!t.enabled;});setCamOff(v=>!v);};

  const labels={calling:`${type==='video'?'Video calling':'Calling'}…`,connected:`${fmt()}`,declined:'Call declined',failed:'Call failed'};

  return (
    <div style={{ position:'fixed',inset:0,background:DS.ink0,zIndex:2500,display:'flex',flexDirection:'column' }}>
      {type==='video'?<video ref={remoteRef} autoPlay playsInline style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',background:DS.ink3 }}/>:<audio ref={remoteRef} autoPlay playsInline style={{ display:'none' }}/>}
      <div style={{ position:'absolute',inset:0,background:'linear-gradient(160deg,rgba(8,8,15,0.9),rgba(20,4,30,0.8))',pointerEvents:'none' }}/>
      {type==='video'&&<video ref={localRef} autoPlay playsInline muted style={{ position:'absolute',top:60,right:16,width:100,height:140,objectFit:'cover',borderRadius:DS.r3,border:`2px solid rgba(255,255,255,0.2)`,zIndex:10 }}/>}
      <div style={{ position:'absolute',top:0,left:0,right:0,zIndex:20,padding:'56px 20px 20px',textAlign:'center' }}>
        {type!=='video'&&(
          <div style={{ width:110,height:110,borderRadius:'50%',padding:3,background:DS.aurora,backgroundSize:'200% 200%',animation:'auroraFlow 4s ease infinite',margin:'0 auto 20px' }}>
            <div style={{ width:'100%',height:'100%',borderRadius:'50%',background:DS.ink0,padding:2 }}>
              <div style={{ width:'100%',height:'100%',borderRadius:'50%',background:DS.rose,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'bold',fontSize:42 }}>{contactAvatar||'?'}</div>
            </div>
          </div>
        )}
        <div style={{ color:'white',fontSize:22,fontWeight:800 }}>@{contactName}</div>
        <div style={{ color:'rgba(255,255,255,0.5)',fontSize:13,marginTop:6,animation:status==='calling'?'pulse 1.5s infinite':undefined }}>{labels[status]||'Connecting…'}</div>
      </div>
      <div style={{ position:'absolute',bottom:60,left:0,right:0,zIndex:20,display:'flex',justifyContent:'center',gap:20 }}>
        <button onClick={toggleMute} style={{ background:muted?DS.rose:'rgba(255,255,255,0.12)',border:'none',borderRadius:'50%',width:60,height:60,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">{muted?<><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>:<><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>}</svg>
        </button>
        <button onClick={onClose} style={{ background:DS.rose,border:'none',borderRadius:'50%',width:70,height:70,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:`0 0 30px rgba(255,45,107,0.5)` }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg>
        </button>
        {type==='video'&&<button onClick={toggleCam} style={{ background:camOff?DS.rose:'rgba(255,255,255,0.12)',border:'none',borderRadius:'50%',width:60,height:60,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">{camOff?<><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3m3-3h6l2 3h4a2 2 0 012 2v9.34m-7.72-2.06a4 4 0 11-5.56-5.56"/></>:<><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>}</svg>
        </button>}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   AUTH SCREEN — premium onboarding
═══════════════════════════════════════════ */
const AuthScreen = ({ onLogin }) => {
  const [mode, setMode] = useState('welcome'); // welcome | login | signup | otp | resetpw
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingOtp, setPendingOtp] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [pendingCreds, setPendingCreds] = useState(null);

  const googleLogin = async () => {
    setLoading(true); setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const uid = result.user.uid;
      let profile = await getUserProfile(uid);
      if (!profile) {
        const base=(result.user.displayName||result.user.email||'user').split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g,'');
        await createUserProfile(uid,{username:base+uid.slice(-4),fullName:result.user.displayName||'',email:result.user.email||'',avatarUrl:result.user.photoURL||null});
        profile=await getUserProfile(uid);
      }
      if(profile) onLogin({...profile,id:uid});
    } catch(e) {
      if(e.code==='auth/popup-closed-by-user') setError('');
      else setError(e.message?.replace('Firebase: ','').replace(/\(auth\/[^)]+\)\.?/g,'').trim()||'Google sign-in failed');
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    setLoading(true); setError('');
    try {
      const result = await signInWithEmailAndPassword(auth,email,password);
      let profile = await getUserProfile(result.user.uid);
      if(!profile){await createUserProfile(result.user.uid,{email,username:email.split('@')[0]});profile=await getUserProfile(result.user.uid);}
      if(profile) onLogin({...profile,id:result.user.uid});
    } catch(e){
      if(e.code==='auth/user-not-found'||e.code==='auth/wrong-password'||e.code==='auth/invalid-credential') setError('Incorrect email or password');
      else setError(e.message?.replace('Firebase: ','').replace(/\(auth\/[^)]+\)\.?/g,'').trim()||'Login failed');
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    setLoading(true); setError('');
    if(!username){setError('Username required');setLoading(false);return;}
    if(!fullName){setError('Full name required');setLoading(false);return;}
    try {
      const taken=await getDocs(query(collection(db,'users'),where('username','==',username)));
      if(!taken.empty){setError('Username taken');setLoading(false);return;}
      const otp=String(Math.floor(100000+Math.random()*900000));
      await sendEmail({to_email:email,from_name:'Dagu',message:`Your Dagu code: ${otp}`,code:otp});
      setPendingOtp(otp);setPendingCreds({email,password,username,fullName});
      setMode('otp');
    } catch(e){setError('Failed to send code');}
    setLoading(false);
  };

  const verifyOtp = async () => {
    if(otpInput.trim()!==pendingOtp.trim()){setError('Wrong code');return;}
    setLoading(true); setError('');
    try {
      const result=await createUserWithEmailAndPassword(auth,pendingCreds.email,pendingCreds.password);
      await sendEmailVerification(result.user).catch(()=>{});
      await createUserProfile(result.user.uid,{username:pendingCreds.username,fullName:pendingCreds.fullName,email:pendingCreds.email});
      await new Promise(r=>setTimeout(r,1500));
      const profile=await getUserProfile(result.user.uid)||buildProfile(result.user.uid,pendingCreds);
      onLogin({...profile,id:result.user.uid});
    } catch(e){
      if(e.code==='auth/email-already-in-use') setError('Email already registered — sign in instead');
      else setError(e.message?.replace('Firebase: ','').replace(/\(auth\/[^)]+\)\.?/g,'').trim()||'Account creation failed');
    }
    setLoading(false);
  };

  const Field = ({ label, value, onChange, type='text', placeholder }) => (
    <div style={{ marginBottom:12 }}>
      {label&&<div style={{ color:DS.t3,fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:6 }}>{label}</div>}
      <div className="focus-aurora" style={{ background:DS.ink3,border:`1px solid ${DS.b2}`,borderRadius:DS.r3,display:'flex',alignItems:'center',overflow:'hidden' }}>
        <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ flex:1,background:'none',border:'none',color:DS.t1,outline:'none',fontSize:15,padding:'13px 14px',fontFamily:DS.font }}/>
      </div>
    </div>
  );

  // Welcome screen
  if(mode==='welcome') return (
    <div style={{ height:'100%',display:'flex',flexDirection:'column',background:DS.ink0,overflow:'hidden',position:'relative' }}>
      {/* Ambient */}
      <div style={{ position:'absolute',inset:0,pointerEvents:'none' }}>
        <div style={{ position:'absolute',top:'-15%',left:'-10%',width:'65%',height:'65%',borderRadius:'50%',background:'radial-gradient(ellipse,rgba(255,45,107,0.18) 0%,transparent 70%)',animation:'orb 10s ease-in-out infinite' }}/>
        <div style={{ position:'absolute',top:'20%',right:'-10%',width:'55%',height:'55%',borderRadius:'50%',background:'radial-gradient(ellipse,rgba(139,92,246,0.14) 0%,transparent 70%)',animation:'orb 12s ease-in-out 3s infinite' }}/>
        <div style={{ position:'absolute',bottom:'5%',left:'15%',width:'45%',height:'45%',borderRadius:'50%',background:'radial-gradient(ellipse,rgba(6,182,212,0.11) 0%,transparent 70%)',animation:'orb 9s ease-in-out 5s infinite' }}/>
      </div>

      <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'48px 28px 24px',position:'relative' }}>
        {/* Logo */}
        <div style={{ marginBottom:48,textAlign:'center' }}>
          <div style={{ position:'relative',display:'inline-block',marginBottom:20 }}>
            <div style={{ position:'absolute',inset:-3,borderRadius:30,background:DS.aurora,backgroundSize:'200% 200%',animation:'auroraFlow 4s ease infinite' }}/>
            <img src="https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png" style={{ width:90,height:90,borderRadius:28,objectFit:'cover',display:'block',position:'relative',border:'2px solid rgba(0,0,0,0.4)' }} alt="Dagu"/>
          </div>
          <div style={{ color:DS.t1,fontWeight:900,fontSize:38,letterSpacing:-1.5,lineHeight:1 }}>Dagu</div>
          <div style={{ color:DS.t3,fontSize:15,marginTop:8,fontWeight:400 }}>Your world, your voice</div>
        </div>

        <div style={{ width:'100%',maxWidth:340 }}>
          {error&&<div style={{ background:'rgba(255,45,107,0.1)',border:'1px solid rgba(255,45,107,0.3)',borderRadius:DS.r3,padding:'11px 14px',color:DS.rose,fontSize:13,marginBottom:14,textAlign:'center' }}>{error}</div>}

          <button onClick={googleLogin} disabled={loading} style={{ width:'100%',background:DS.ink3,border:`1px solid ${DS.b2}`,borderRadius:DS.r3,padding:'15px 20px',color:DS.t1,display:'flex',alignItems:'center',justifyContent:'center',gap:10,cursor:'pointer',fontSize:15,fontWeight:600,marginBottom:10,opacity:loading?0.6:1,fontFamily:DS.font }}>
            <span style={{ fontSize:20 }}>🌐</span>Continue with Google
          </button>

          <button onClick={()=>{setMode('login');setError('');}} style={{ width:'100%',background:DS.ink3,border:`1px solid ${DS.b2}`,borderRadius:DS.r3,padding:'15px 20px',color:DS.t1,display:'flex',alignItems:'center',justifyContent:'center',gap:10,cursor:'pointer',fontSize:15,fontWeight:600,marginBottom:16,fontFamily:DS.font }}>
            <span style={{ fontSize:20 }}>📧</span>Continue with Email
          </button>

          <div style={{ textAlign:'center',color:DS.t3,fontSize:13,marginBottom:16 }}>— or —</div>

          <button onClick={()=>{setMode('signup');setError('');}} className="btn-aurora" style={{ width:'100%',borderRadius:DS.r3,padding:'15px 20px',fontSize:15 }}>
            Create Account →
          </button>
        </div>
      </div>
      <div style={{ padding:'0 24px 36px',textAlign:'center',color:DS.t5,fontSize:11,position:'relative' }}>
        By continuing you agree to our Terms & Privacy Policy
      </div>
    </div>
  );

  // Login
  if(mode==='login') return (
    <div style={{ height:'100%',display:'flex',alignItems:'center',justifyContent:'center',padding:24,background:DS.ink0 }}>
      <div style={{ width:'100%',maxWidth:340 }}>
        <button onClick={()=>{setMode('welcome');setError('');}} style={{ background:'none',border:'none',color:DS.t3,marginBottom:24,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',gap:6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>Back
        </button>
        <div style={{ color:DS.t1,fontWeight:800,fontSize:26,marginBottom:24 }}>Sign in</div>
        {error&&<div style={{ background:'rgba(255,45,107,0.1)',border:'1px solid rgba(255,45,107,0.3)',borderRadius:DS.r3,padding:'11px 14px',color:DS.rose,fontSize:13,marginBottom:14 }}>{error}</div>}
        <Field value={email} onChange={setEmail} placeholder="Email" type="email"/>
        <Field value={password} onChange={setPassword} placeholder="Password" type="password"/>
        <button onClick={handleLogin} disabled={loading||!email||!password} className="btn-aurora" style={{ width:'100%',borderRadius:DS.r3,padding:15,fontSize:15,marginTop:8,opacity:(loading||!email||!password)?0.5:1 }}>
          {loading?'Signing in…':'Sign In →'}
        </button>
        <button onClick={()=>{setMode('resetpw');setError('');}} style={{ width:'100%',background:'none',border:'none',color:DS.t3,fontSize:13,cursor:'pointer',marginTop:14,textDecoration:'underline' }}>Forgot password?</button>
      </div>
    </div>
  );

  // Signup
  if(mode==='signup') return (
    <div style={{ height:'100%',display:'flex',alignItems:'center',justifyContent:'center',padding:24,background:DS.ink0,overflow:'auto' }}>
      <div style={{ width:'100%',maxWidth:340 }}>
        <button onClick={()=>{setMode('welcome');setError('');}} style={{ background:'none',border:'none',color:DS.t3,marginBottom:24,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',gap:6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>Back
        </button>
        <div style={{ color:DS.t1,fontWeight:800,fontSize:26,marginBottom:24 }}>Create account</div>
        {error&&<div style={{ background:'rgba(255,45,107,0.1)',border:'1px solid rgba(255,45,107,0.3)',borderRadius:DS.r3,padding:'11px 14px',color:DS.rose,fontSize:13,marginBottom:14 }}>{error}</div>}
        <Field value={fullName} onChange={setFullName} placeholder="Full name"/>
        <Field value={username} onChange={setUsername} placeholder="Username"/>
        <Field value={email} onChange={setEmail} placeholder="Email" type="email"/>
        <Field value={password} onChange={setPassword} placeholder="Password (6+ chars)" type="password"/>
        <button onClick={handleSignup} disabled={loading||!email||!password||!username||!fullName} className="btn-aurora" style={{ width:'100%',borderRadius:DS.r3,padding:15,fontSize:15,marginTop:8,opacity:(loading||!email||!password||!username||!fullName)?0.5:1 }}>
          {loading?'Sending code…':'Get Verification Code →'}
        </button>
        <button onClick={()=>{setMode('login');setError('');}} style={{ width:'100%',background:'none',border:'none',color:DS.t3,fontSize:13,cursor:'pointer',marginTop:14 }}>Already have an account? Sign in</button>
      </div>
    </div>
  );

  // OTP
  if(mode==='otp') return (
    <div style={{ height:'100%',display:'flex',alignItems:'center',justifyContent:'center',padding:24,background:DS.ink0 }}>
      <div style={{ width:'100%',maxWidth:340,textAlign:'center' }}>
        <div style={{ fontSize:64,marginBottom:16 }}>📲</div>
        <div style={{ color:DS.t1,fontWeight:800,fontSize:24,marginBottom:8 }}>Check your email</div>
        <div style={{ color:DS.t3,fontSize:14,lineHeight:1.6,marginBottom:20 }}>We sent a code to <strong style={{ color:DS.t1 }}>{pendingCreds?.email}</strong></div>
        {error&&<div style={{ background:'rgba(255,45,107,0.1)',border:'1px solid rgba(255,45,107,0.3)',borderRadius:DS.r3,padding:'11px 14px',color:DS.rose,fontSize:13,marginBottom:14 }}>{error}</div>}
        <input value={otpInput} onChange={e=>setOtpInput(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" maxLength={6} style={{ width:'100%',background:DS.ink3,border:`1px solid ${DS.b2}`,borderRadius:DS.r3,padding:16,color:DS.t1,outline:'none',fontSize:30,textAlign:'center',letterSpacing:10,fontWeight:800,marginBottom:14,boxSizing:'border-box' }}/>
        <button onClick={verifyOtp} disabled={loading||otpInput.length!==6} className="btn-aurora" style={{ width:'100%',borderRadius:DS.r3,padding:15,fontSize:15,opacity:(loading||otpInput.length!==6)?0.5:1 }}>
          {loading?'Verifying…':'Verify & Create Account'}
        </button>
        <button onClick={()=>{setMode('signup');setError('');}} style={{ background:'none',border:'none',color:DS.t3,fontSize:13,cursor:'pointer',marginTop:14 }}>Back</button>
      </div>
    </div>
  );

  // Reset password
  if(mode==='resetpw') return (
    <div style={{ height:'100%',display:'flex',alignItems:'center',justifyContent:'center',padding:24,background:DS.ink0 }}>
      <div style={{ width:'100%',maxWidth:340,textAlign:'center' }}>
        <div style={{ fontSize:56,marginBottom:16 }}>🔑</div>
        <div style={{ color:DS.t1,fontWeight:800,fontSize:24,marginBottom:8 }}>Reset password</div>
        <div style={{ color:DS.t3,fontSize:14,marginBottom:20 }}>Enter your email for a reset link</div>
        {error&&<div style={{ background:'rgba(255,45,107,0.1)',border:'1px solid rgba(255,45,107,0.3)',borderRadius:DS.r3,padding:'11px 14px',color:DS.rose,fontSize:13,marginBottom:14 }}>{error}</div>}
        <div className="focus-aurora" style={{ background:DS.ink3,border:`1px solid ${DS.b2}`,borderRadius:DS.r3,marginBottom:14 }}>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={{ width:'100%',background:'none',border:'none',color:DS.t1,outline:'none',fontSize:15,padding:'13px 14px',fontFamily:DS.font,boxSizing:'border-box' }}/>
        </div>
        <button onClick={async()=>{setLoading(true);setError('');try{await sendPasswordResetEmail(auth,email);setMode('welcome');setError('');}catch(e){setError('Could not send reset email');}setLoading(false);}} disabled={loading||!email} className="btn-aurora" style={{ width:'100%',borderRadius:DS.r3,padding:15,fontSize:15,opacity:(loading||!email)?0.5:1 }}>
          {loading?'Sending…':'Send Reset Link'}
        </button>
        <button onClick={()=>{setMode('login');setError('');}} style={{ background:'none',border:'none',color:DS.t3,fontSize:13,cursor:'pointer',marginTop:14 }}>Back to sign in</button>
      </div>
    </div>
  );

  return null;
};

/* ═══════════════════════════════════════════
   TAB BAR (5-tab navigation)
═══════════════════════════════════════════ */
const TabBar = ({ active, onChange, currentUser }) => {
  const [inboxBadge, setInboxBadge] = useState(0);
  const [notifBadge, setNotifBadge] = useState(0);

  useEffect(() => {
    if (!currentUser?.id) return;
    const q1 = query(collection(db,'conversations'),where('participants','array-contains',currentUser.id));
    const u1 = onSnapshot(q1,snap=>{
      const total=snap.docs.reduce((s,d)=>s+(d.data()[`unread_${currentUser.id}`]||0),0);
      setInboxBadge(total);
    },()=>{});
    const q2 = query(collection(db,'notifications'),where('toUserId','==',currentUser.id),where('read','==',false));
    const u2 = onSnapshot(q2,snap=>setNotifBadge(snap.size),()=>{});
    return ()=>{u1();u2();};
  },[currentUser?.id]);

  const tabs = [
    { id:'home', icon:(a)=><svg width="24" height="24" viewBox="0 0 24 24" fill={a?'white':'none'} stroke="currentColor" strokeWidth={a?0:1.8}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, label:'Home' },
    { id:'friends', icon:(a)=><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.2:1.8}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>, label:'Friends' },
    { id:'create', icon:()=>null, label:'' },
    { id:'inbox', icon:(a)=><svg width="24" height="24" viewBox="0 0 24 24" fill={a?'white':'none'} stroke="currentColor" strokeWidth={a?0:1.8}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>, label:'Messages', badge:inboxBadge },
    { id:'profile', icon:(a)=><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.2:1.8}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, label:'Profile' },
  ];

  return (
    <div style={{
      display:'flex',background:'rgba(8,8,15,0.97)',
      borderTop:`1px solid ${DS.b1}`,
      padding:`10px 4px max(26px,env(safe-area-inset-bottom))`,
      flexShrink:0, backdropFilter:'blur(30px)',
    }}>
      {tabs.map(tab => {
        const isActive = active===tab.id;
        if (tab.id==='create') return (
          <button key="create" onClick={()=>onChange('create')} style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'none',border:'none',cursor:'pointer',gap:0,padding:0 }}>
            <div style={{
              width:54,height:34,
              background:DS.aurora,backgroundSize:'200% 200%',animation:'auroraFlow 4s ease infinite',
              borderRadius:DS.r2,display:'flex',alignItems:'center',justifyContent:'center',
              boxShadow:`0 4px 20px rgba(255,45,107,0.4)`,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" stroke="white" fill="none" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
          </button>
        );
        return (
          <button key={tab.id} onClick={()=>{haptic('light');onChange(tab.id);}} style={{
            flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
            gap:3,background:'none',border:'none',cursor:'pointer',padding:'4px 0',
            color:isActive?DS.t1:DS.t4,position:'relative',
            transform:isActive?'translateY(-1px)':'translateY(0)',
            transition:'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <div style={{ position:'relative' }}>
              {tab.icon(isActive)}
              {tab.badge>0&&<div style={{ position:'absolute',top:-5,right:-5,minWidth:16,height:16,background:DS.rose,borderRadius:DS.rFull,border:`1.5px solid ${DS.ink1}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'white',fontWeight:800,padding:'0 3px' }}>{tab.badge>9?'9+':tab.badge}</div>}
            </div>
            {tab.label&&<span style={{ fontSize:9,fontWeight:isActive?700:400,letterSpacing:0.3 }}>{tab.label}</span>}
            {isActive&&<div style={{ position:'absolute',bottom:-7,left:'50%',width:20,height:3,borderRadius:2,background:DS.aurora,backgroundSize:'200% 200%',animation:'auroraFlow 4s ease infinite,tabActive 0.3s ease',transform:'translateX(-50%)' }}/>}
          </button>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════ */
export default function DaguApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [followed, setFollowed] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState(null);
  const [notifPopup, setNotifPopup] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showCall, setShowCall] = useState(null);
  const [showStoryViewer, setShowStoryViewer] = useState(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [inboxTargetId, setInboxTargetId] = useState(null);
  const [quickConv, setQuickConv] = useState(null);
  const isOnline = useNetworkStatus();

  const showToast = useCallback((message, type='info') => setToast({message,type}), []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async fbUser => {
      if (fbUser) {
        let profile = await getUserProfile(fbUser.uid).catch(()=>null);
        if (!profile) {
          for (let i=0;i<5;i++) {
            await new Promise(r=>setTimeout(r,1000));
            profile = await getUserProfile(fbUser.uid).catch(()=>null);
            if (profile) break;
          }
        }
        if (profile) {
          setCurrentUser({...profile,id:fbUser.uid});
          setFollowed(profile.following||[]);
          setBlockedUsers(profile.blockedUsers||[]);
        } else {
          const fb = buildProfile(fbUser.uid,{username:fbUser.email?.split('@')[0]||'user',email:fbUser.email||'',avatarUrl:fbUser.photoURL||null});
          setCurrentUser(fb);
        }
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return ()=>unsub();
  },[]);

  // Load videos (real-time)
  useEffect(() => {
    const q = query(collection(db,'videos'),orderBy('createdAt','desc'),limit(60));
    const unsub = onSnapshot(q,snap=>{setVideos(snap.docs.map(d=>({id:d.id,...d.data()})));});
    return ()=>unsub();
  },[]);

  // Load users (real-time)
  useEffect(() => {
    const unsub = onSnapshot(collection(db,'users'),snap=>{setUsers(snap.docs.map(d=>({id:d.id,...d.data()})));});
    return ()=>unsub();
  },[]);

  // Notification popups
  const usersRef = useRef(users);
  useEffect(()=>{usersRef.current=users;},[users]);
  useEffect(() => {
    if (!currentUser?.id) return;
    let first = true;
    const q = query(collection(db,'notifications'),where('toUserId','==',currentUser.id),where('read','==',false),orderBy('createdAt','desc'));
    const unsub = onSnapshot(q,snap=>{
      if(first){first=false;return;}
      snap.docChanges().forEach(ch=>{
        if(ch.type==='added'){
          const data=ch.doc.data();
          const fromUser=usersRef.current.find(u=>u.id===data.fromUserId);
          setNotifPopup({notif:{...data,id:ch.doc.id},user:fromUser});
        }
      });
    },()=>{});
    return ()=>unsub();
  },[currentUser?.id]);

  // Presence
  useEffect(() => {
    if (!currentUser?.id) return;
    setDoc(doc(db,'presence',currentUser.id),{online:true,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
    const handler = ()=>setDoc(doc(db,'presence',currentUser.id),{online:false,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
    window.addEventListener('beforeunload',handler);
    return ()=>window.removeEventListener('beforeunload',handler);
  },[currentUser?.id]);

  const handleLogin = useCallback(async profile => {
    setCurrentUser(profile);
    setFollowed(profile.following||[]);
    setBlockedUsers(profile.blockedUsers||[]);
    setDoc(doc(db,'presence',profile.id),{online:true,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
    showToast(`Welcome back, @${profile.username}! 👋`,'success');
  },[showToast]);

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };

  const toggleFollow = async uid => {
    if (!currentUser) return;
    const isF = followed.includes(uid);
    const newF = isF ? followed.filter(id=>id!==uid) : [...followed,uid];
    setFollowed(newF);
    await updateDoc(doc(db,'users',currentUser.id),{following:isF?arrayRemove(uid):arrayUnion(uid)}).catch(()=>{});
    await updateDoc(doc(db,'users',uid),{followers:isF?arrayRemove(currentUser.id):arrayUnion(currentUser.id)}).catch(()=>{});
    if (!isF) await notify(uid,currentUser.id,'follow','started following you');
  };

  const handleMessage = uid => {
    if (!uid||!currentUser?.id) return;
    const convId = getConvId(currentUser.id,uid);
    const otherUser = users.find(u=>u.id===uid)||{id:uid};
    setQuickConv({id:convId,otherUser});
    setDoc(doc(db,'conversations',convId),{participants:[currentUser.id,uid],lastMessageAt:serverTimestamp()},{merge:true}).catch(()=>{});
  };

  const handleViewProfile = uid => {
    const u = users.find(u=>u.id===uid);
    if (u) setViewingProfile(u);
  };

  const handleTabChange = tab => {
    if (tab==='create') { setShowCamera(true); return; }
    setShowCamera(false);
    setShowSearch(false);
    setActiveTab(tab);
  };

  // Loading
  if (authLoading) return (
    <div style={{ maxWidth:430,margin:'0 auto',height:'100dvh',background:DS.ink0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:20 }}>
      <GlobalStyles/>
      <div style={{ position:'relative' }}>
        <div style={{ position:'absolute',inset:-3,borderRadius:28,background:DS.aurora,backgroundSize:'200% 200%',animation:'auroraFlow 4s ease infinite' }}/>
        <img src="https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png" style={{ width:80,height:80,borderRadius:26,objectFit:'cover',display:'block',position:'relative' }} alt="Dagu"/>
      </div>
      <Spinner color={DS.rose} size={28}/>
    </div>
  );

  if (!currentUser) return (
    <div style={{ maxWidth:430,margin:'0 auto',height:'100dvh',background:DS.ink0,overflow:'hidden' }}>
      <GlobalStyles/>
      <AuthScreen onLogin={handleLogin}/>
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );

  return (
    <div style={{ maxWidth:430,margin:'0 auto',height:'100dvh',background:DS.ink0,display:'flex',flexDirection:'column',position:'relative',overflow:'hidden' }}>
      <GlobalStyles/>
      {!isOnline&&<OfflineBanner/>}

      {/* Overlays (highest z-index) */}
      {showCall&&<CallModal type={showCall.type} contactName={showCall.contactName} contactAvatar={showCall.contactAvatar} contactId={showCall.contactId} currentUser={currentUser} onClose={()=>setShowCall(null)} isCallee={showCall.isCallee} callDocId={showCall.callDocId}/>}
      {showStoryViewer&&<StoryViewer groups={showStoryViewer.groups} startIdx={showStoryViewer.startIdx||0} currentUser={currentUser} onClose={()=>setShowStoryViewer(null)} showToast={showToast}/>}
      {showCreateStory&&<CreateStory currentUser={currentUser} onClose={()=>setShowCreateStory(false)} showToast={showToast}/>}
      {showNotifications&&<NotificationsPage currentUser={currentUser} users={users} onClose={()=>setShowNotifications(false)} onViewProfile={uid=>{handleViewProfile(uid);setShowNotifications(false);}}/>}
      {viewingProfile&&<UserProfileModal user={viewingProfile} currentUser={currentUser} onClose={()=>setViewingProfile(null)} onFollow={toggleFollow} onMessage={uid=>{handleMessage(uid);setViewingProfile(null);}} onVoiceCall={uid=>{const u=users.find(uu=>uu.id===uid);setShowCall({type:'audio',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid});setViewingProfile(null);}} onVideoCall={uid=>{const u=users.find(uu=>uu.id===uid);setShowCall({type:'video',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid});setViewingProfile(null);}} followed={followed} showToast={showToast} userVideos={videos.filter(v=>v.userId===viewingProfile?.id)}/>}
      {quickConv&&(
        <div style={{ position:'fixed',inset:0,zIndex:10500,background:DS.ink0,maxWidth:430,margin:'0 auto' }}>
          <ConversationView currentUser={currentUser} otherUser={users.find(u=>u.id===quickConv.otherUser?.id)||quickConv.otherUser} conversationId={quickConv.id} onBack={()=>setQuickConv(null)} showToast={showToast} onViewProfile={uid=>{setQuickConv(null);handleViewProfile(uid);}} onVoiceCall={uid=>{const u=users.find(uu=>uu.id===uid);setShowCall({type:'audio',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid,callDocId:getConvId(currentUser.id,uid)});}} onVideoCall={uid=>{const u=users.find(uu=>uu.id===uid);setShowCall({type:'video',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid,callDocId:getConvId(currentUser.id,uid)});}}/>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex:1,overflow:'hidden',position:'relative',minHeight:0 }}>
        {showSearch&&<SearchOverlay onClose={()=>setShowSearch(false)} videos={videos} users={users} onViewProfile={uid=>{handleViewProfile(uid);setShowSearch(false);}}/>}
        {showCamera&&<CameraUpload currentUser={currentUser} onUpload={v=>setVideos(p=>[v,...p])} onClose={()=>setShowCamera(false)} showToast={showToast}/>}

        {!showSearch&&!showCamera&&(
          <>
            {activeTab==='home'&&<HomeFeed videos={videos} currentUser={currentUser} followed={followed} blockedUsers={blockedUsers} onFollow={toggleFollow} onMessage={handleMessage} onViewProfile={handleViewProfile} onBlock={uid=>setBlockedUsers(p=>[...p,uid])} showToast={showToast} onOpenSearch={()=>setShowSearch(true)} onOpenNotifications={()=>setShowNotifications(true)} onCreateStory={()=>setShowCreateStory(true)} onViewStory={setShowStoryViewer} users={users}/>}
            {activeTab==='friends'&&<FriendsFeed videos={videos} currentUser={currentUser} followed={followed} blockedUsers={blockedUsers} onFollow={toggleFollow} onMessage={handleMessage} onVoiceCall={uid=>{const u=users.find(uu=>uu.id===uid);setShowCall({type:'audio',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid,callDocId:getConvId(currentUser.id,uid)});}} onVideoCall={uid=>{const u=users.find(uu=>uu.id===uid);setShowCall({type:'video',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid,callDocId:getConvId(currentUser.id,uid)});}} onViewProfile={handleViewProfile} onBlock={uid=>setBlockedUsers(p=>[...p,uid])} showToast={showToast} users={users} onCreateStory={()=>setShowCreateStory(true)} onViewStory={setShowStoryViewer}/>}
            {activeTab==='inbox'&&<InboxPage currentUser={currentUser} users={users} showToast={showToast} onViewProfile={handleViewProfile} initialTargetId={inboxTargetId} onClearTarget={()=>setInboxTargetId(null)} onVoiceCall={uid=>{const u=users.find(uu=>uu.id===uid);setShowCall({type:'audio',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid,callDocId:getConvId(currentUser.id,uid)});}} onVideoCall={uid=>{const u=users.find(uu=>uu.id===uid);setShowCall({type:'video',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid,callDocId:getConvId(currentUser.id,uid)});}}/>}
            {activeTab==='profile'&&<ProfilePage user={currentUser} setCurrentUser={setCurrentUser} onLogout={handleLogout} users={users} showToast={showToast} allVideos={videos} setBlockedUsers={setBlockedUsers} onViewProfile={handleViewProfile}/>}
          </>
        )}
      </div>

      <TabBar active={activeTab} onChange={handleTabChange} currentUser={currentUser}/>

      {notifPopup&&<NotifPopup notif={notifPopup.notif} user={notifPopup.user} onClose={()=>setNotifPopup(null)} onTap={()=>{handleViewProfile(notifPopup.notif?.fromUserId);setNotifPopup(null);}}/>}
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
}
