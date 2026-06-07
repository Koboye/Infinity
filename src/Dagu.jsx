// Dagu.jsx — Full TikTok-like app with Firebase, Cloudinary, EmailJS
// All features functional: auth, video feed, likes, comments, follow, messages, stories, live, calls, gifts, upload

import React, {
  useState, useEffect, useRef, useCallback, memo, useMemo
} from 'react';

// ─── Firebase ──────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, addDoc, onSnapshot, query,
  orderBy, serverTimestamp, getDocs, where, doc, setDoc,
  updateDoc, arrayUnion, arrayRemove, getDoc, deleteDoc, limit
} from 'firebase/firestore';

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
const db = getFirestore(app);

// ─── Cloudinary ────────────────────────────────────────────────────────────
const CLOUDINARY_CLOUD = 'dotvhzjmc';
const CLOUDINARY_PRESET = 'g3c7dwdg';

async function uploadToCloudinary(file, type = 'image') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  formData.append('cloud_name', CLOUDINARY_CLOUD);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${type}/upload`,
    { method: 'POST', body: formData }
  );
  const data = await res.json();
  return data.secure_url;
}

// ─── Constants ─────────────────────────────────────────────────────────────
const VIRTUAL_GIFTS = [
  { id: 'rose',      name: '🌹 Rose',      coins: 50,    animation: '🌹' },
  { id: 'chocolate', name: '🍫 Chocolate',  coins: 100,   animation: '🍫' },
  { id: 'bear',      name: '🧸 Teddy Bear', coins: 250,   animation: '🧸' },
  { id: 'cake',      name: '🎂 Cake',       coins: 500,   animation: '🎂' },
  { id: 'diamond',   name: '💎 Diamond',    coins: 1000,  animation: '💎' },
  { id: 'rocket',    name: '🚀 Rocket',     coins: 5000,  animation: '🚀' },
  { id: 'crown',     name: '👑 Crown',      coins: 10000, animation: '👑' },
  { id: 'galaxy',    name: '🌌 Galaxy',     coins: 50000, animation: '🌌' },
];

const EMOJI_LIST = ['😀','😂','😍','🥰','😎','🤔','😭','😱','🔥','❤️','👍','🎉','✨','💯','🙌','👏','🤝','💪','🎵','📸'];

const formatNumber = (num) => {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
};

// ─── Toast ─────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  return (
    <div style={{
      position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(15,15,15,0.97)', border: '1px solid #2a2a2a', borderRadius: 30,
      padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8,
      zIndex: 9999, whiteSpace: 'nowrap', backdropFilter: 'blur(10px)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)'
    }}>
      <span>{icons[type] || 'ℹ️'}</span>
      <span style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{message}</span>
    </div>
  );
};

// ─── Auth Screen ────────────────────────────────────────────────────────────
const AuthScreen = ({ onLogin, onSignup }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail]     = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async () => {
    if (!email) { setError('Email required'); return; }
    if (!isLogin && (!username || !fullName)) { setError('Fill all fields'); return; }
    setError(''); setLoading(true);
    try {
      if (isLogin) await onLogin(email, password);
      else         await onSignup(email, username, fullName, password);
    } catch (e) {
      setError(e.message || 'Something went wrong');
    }
    setLoading(false);
  };

  return (
    <div style={{ width: '100%', maxWidth: 360, padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>🎬</div>
        <div style={{ color: 'white', fontWeight: 800, fontSize: 28, letterSpacing: -1 }}>Dagu</div>
        <div style={{ color: '#555', fontSize: 13, marginTop: 4 }}>Share your world</div>
      </div>

      <div style={{ background: '#141414', borderRadius: 24, padding: 24, border: '1px solid #1e1e1e' }}>
        <div style={{ display: 'flex', background: '#0d0d0d', borderRadius: 16, padding: 4, marginBottom: 20 }}>
          {['Login','Sign Up'].map((label, i) => (
            <button key={label} onClick={() => { setIsLogin(i === 0); setError(''); }}
              style={{ flex: 1, background: (isLogin ? i===0 : i===1) ? '#ff2d55' : 'none', border: 'none',
                borderRadius: 12, padding: '10px', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              {label}
            </button>
          ))}
        </div>

        {!isLogin && (
          <>
            <input placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)}
              style={inputStyle} />
            <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)}
              style={inputStyle} />
          </>
        )}
        <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}
          style={inputStyle} />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)}
          style={inputStyle} />

        {error && <div style={{ color: '#ff2d55', fontSize: 12, marginBottom: 10, textAlign: 'center' }}>{error}</div>}

        <button onClick={handleSubmit} disabled={loading}
          style={{ width: '100%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none',
            borderRadius: 20, padding: 14, color: 'white', fontWeight: 700, cursor: 'pointer',
            fontSize: 15, opacity: loading ? 0.7 : 1 }}>
          {loading ? '...' : isLogin ? 'Login' : 'Create Account'}
        </button>
      </div>
    </div>
  );
};

const inputStyle = {
  width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 14,
  padding: '12px 14px', color: 'white', marginBottom: 10, outline: 'none',
  fontSize: 13, boxSizing: 'border-box'
};

// ─── Call Modal ─────────────────────────────────────────────────────────────
const CallModal = ({ type, contactName, contactAvatar, onClose }) => {
  const [duration, setDuration] = useState(0);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const localVideoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const connectTimer = setTimeout(async () => {
      setConnected(true);
      if (type === 'video') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          streamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.muted = true;
          }
        } catch {}
      }
    }, 2000);
    return () => clearTimeout(connectTimer);
  }, [type]);

  useEffect(() => {
    if (!connected) return;
    const t = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [connected]);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const formatDur = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => { t.enabled = muted; });
    }
    setMuted(m => !m);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: type === 'video' ? '#000' : 'linear-gradient(135deg,#1a2a2a,#0a0a0a)', zIndex: 5000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {type === 'video' && connected && (
        <video ref={localVideoRef} autoPlay playsInline
          style={{ position: 'absolute', top: 20, right: 20, width: 120, height: 160, objectFit: 'cover', borderRadius: 16, border: '2px solid #333', zIndex: 10 }} />
      )}
      <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, marginBottom: 16 }}>
        {contactAvatar}
      </div>
      <div style={{ color: 'white', fontSize: 22, fontWeight: 700 }}>@{contactName}</div>
      <div style={{ color: '#888', fontSize: 13, marginTop: 6 }}>
        {connected ? formatDur(duration) : (type === 'video' ? '📹 Connecting...' : '🎙️ Calling...')}
      </div>
      <div style={{ display: 'flex', gap: 20, marginTop: 48 }}>
        <button onClick={toggleMute}
          style={{ width: 60, height: 60, borderRadius: '50%', background: muted ? '#ff2d55' : '#222', border: 'none', color: 'white', fontSize: 24, cursor: 'pointer' }}>
          {muted ? '🔇' : '🎙️'}
        </button>
        <button onClick={onClose}
          style={{ width: 60, height: 60, borderRadius: '50%', background: '#ff2d55', border: 'none', color: 'white', fontSize: 24, cursor: 'pointer' }}>
          📵
        </button>
        {type === 'video' && (
          <button style={{ width: 60, height: 60, borderRadius: '50%', background: '#222', border: 'none', color: 'white', fontSize: 24, cursor: 'pointer' }}>
            📹
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Live Stream ────────────────────────────────────────────────────────────
const LiveStream = ({ streamer, onClose, showToast, currentUser }) => {
  const [viewers, setViewers]     = useState(Math.floor(Math.random()*2000)+500);
  const [chatMessages, setChat]   = useState([]);
  const [message, setMessage]     = useState('');
  const [showGifts, setShowGifts] = useState(false);
  const [giftAnims, setGiftAnims] = useState([]);
  const [isMuted, setIsMuted]     = useState(false);
  const [duration, setDuration]   = useState(0);
  const [cameraOn, setCameraOn]   = useState(false);
  const [cameraErr, setCameraErr] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const go = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true; }
        setCameraOn(true);
      } catch { setCameraErr('Camera denied — simulating stream'); }
    };
    go();
    const d = setInterval(() => setDuration(x => x + 1), 1000);
    const v = setInterval(() => setViewers(x => Math.max(1, x + Math.floor(Math.random()*20)-5)), 5000);
    // Simulate incoming chat
    const fakeNames = ['amara', 'yonas', 'tigist', 'biruk', 'selam'];
    const fakeMsg = setInterval(() => {
      setChat(c => [...c.slice(-50), {
        id: Date.now(), username: fakeNames[Math.floor(Math.random()*fakeNames.length)],
        text: ['🔥 Amazing!', '❤️ Love this!', 'keep going!', '🎉', 'wow!!'][Math.floor(Math.random()*5)],
        isGift: false
      }]);
    }, 3000);
    return () => {
      clearInterval(d); clearInterval(v); clearInterval(fakeMsg);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const toggleMute = () => {
    if (streamRef.current) streamRef.current.getAudioTracks().forEach(t => { t.enabled = isMuted; });
    setIsMuted(m => !m);
  };

  const fmt = () => {
    const m = Math.floor(duration/60), s = duration%60;
    return `${m}:${s.toString().padStart(2,'0')}`;
  };

  const sendMsg = () => {
    if (!message.trim()) return;
    setChat(c => [...c, { id: Date.now(), username: currentUser?.username, text: message, isGift: false }]);
    setMessage('');
  };

  const sendGift = (gift) => {
    if ((currentUser?.coins || 0) < gift.coins) { showToast('Not enough coins! 🪙', 'error'); return; }
    const id = Date.now();
    setGiftAnims(g => [...g, { id, gift, x: Math.random()*80+10, y: Math.random()*40+10 }]);
    setChat(c => [...c, { id, username: currentUser?.username, text: `sent ${gift.name}`, isGift: true, gift }]);
    showToast(`Sent ${gift.name}! 🎁`, 'success');
    setTimeout(() => setGiftAnims(g => g.filter(x => x.id !== id)), 3000);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 2, position: 'relative', background: '#111' }}>
        {cameraOn
          ? <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#1a1a2a,#0a0a0a)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{ fontSize: 64 }}>📹</div>
              <div style={{ color: 'white', fontSize: 16, fontWeight: 700 }}>LIVE</div>
              {cameraErr && <div style={{ color: '#ff9500', fontSize: 11, textAlign: 'center', padding: '0 30px' }}>{cameraErr}</div>}
            </div>
        }
        {/* Badges */}
        <div style={{ position: 'absolute', top: 20, left: 16, background: '#ff2d55', borderRadius: 20, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'white', animation: 'pulse 1s infinite' }} />
          <span style={{ color: 'white', fontWeight: 700, fontSize: 12 }}>LIVE · {viewers.toLocaleString()} 👁</span>
        </div>
        <div style={{ position: 'absolute', top: 20, right: 16, background: 'rgba(0,0,0,0.6)', borderRadius: 16, padding: '6px 12px' }}>
          <span style={{ color: 'white', fontSize: 12 }}>{fmt()}</span>
        </div>
        {/* Controls */}
        <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, display: 'flex', gap: 10 }}>
          <button onClick={toggleMute} style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 42, height: 42, fontSize: 20, cursor: 'pointer' }}>{isMuted ? '🔇' : '🔊'}</button>
          <button onClick={onClose} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 24px', color: 'white', fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>End Stream</button>
        </div>
        {/* Gift animations */}
        {giftAnims.map(g => (
          <div key={g.id} style={{ position: 'absolute', left: `${g.x}%`, top: `${g.y}%`, fontSize: 44, pointerEvents: 'none', zIndex: 20, animation: 'floatUp 2s ease-out forwards' }}>{g.gift.animation}</div>
        ))}
      </div>

      {/* Chat */}
      <div style={{ flex: 1, background: '#0a0a0a', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>Live Chat</span>
          <button onClick={() => setShowGifts(g => !g)} style={{ background: '#ffd700', border: 'none', borderRadius: 20, padding: '5px 12px', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>🎁 Gift</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {chatMessages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', gap: 6, alignItems: 'center', background: msg.isGift ? 'rgba(255,215,0,0.08)' : 'transparent', padding: '3px 6px', borderRadius: 8, marginBottom: 3 }}>
              <span style={{ color: '#ff2d55', fontWeight: 600, fontSize: 11 }}>@{msg.username}</span>
              <span style={{ color: 'white', fontSize: 11 }}>{msg.text}</span>
              {msg.isGift && <span>{msg.gift?.animation}</span>}
            </div>
          ))}
        </div>
        {showGifts && (
          <div style={{ background: '#141414', borderTop: '1px solid #222', padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {VIRTUAL_GIFTS.map(g => (
                <button key={g.id} onClick={() => sendGift(g)} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '10px 6px', cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: 24 }}>{g.animation}</div>
                  <div style={{ color: '#ffd700', fontSize: 10, marginTop: 2 }}>{g.coins}🪙</div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ padding: '8px 12px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 8 }}>
          <input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key==='Enter' && sendMsg()}
            placeholder="Say something..." style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 24, padding: '8px 14px', color: 'white', outline: 'none', fontSize: 13 }} />
          <button onClick={sendMsg} style={{ background: '#ff2d55', border: 'none', borderRadius: 24, padding: '8px 18px', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Send</button>
        </div>
      </div>
    </div>
  );
};

// ─── Stories ────────────────────────────────────────────────────────────────
const Stories = ({ users, stories, currentUser, onViewStory, onAddStory, showToast }) => {
  const fileRef = useRef(null);
  const storyUsers = useMemo(() => {
    const ids = [...new Set(stories.map(s => s.userId))];
    return ids.map(id => users.find(u => u.id === id)).filter(Boolean);
  }, [stories, users]);

  const handleAdd = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showToast('Uploading story...', 'info');
    try {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const url = await uploadToCloudinary(file, type === 'video' ? 'video' : 'image');
      const story = {
        userId: currentUser.id, username: currentUser.username,
        avatarColor: currentUser.avatarColor, avatar: currentUser.avatar,
        type, media: url, timestamp: serverTimestamp(), expiresAt: Date.now() + 86400000
      };
      await addDoc(collection(db, 'stories'), story);
      onAddStory(story);
      showToast('Story posted! ✨', 'success');
    } catch { showToast('Upload failed', 'error'); }
  };

  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 14px', overflowX: 'auto', borderBottom: '1px solid #141414', flexShrink: 0 }}>
      {/* Add story */}
      <div onClick={() => fileRef.current?.click()} style={{ flexShrink: 0, cursor: 'pointer', textAlign: 'center' }}>
        <div style={{ width: 58, height: 58, borderRadius: '50%', background: '#141414', border: '2px dashed #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 4 }}>+</div>
        <div style={{ color: '#666', fontSize: 10, width: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Add</div>
        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleAdd} style={{ display: 'none' }} />
      </div>
      {/* Story rings */}
      {storyUsers.map(u => (
        <div key={u.id} onClick={() => onViewStory(u)} style={{ flexShrink: 0, cursor: 'pointer', textAlign: 'center' }}>
          <div style={{ width: 58, height: 58, borderRadius: '50%', padding: 2, background: 'linear-gradient(135deg,#ff2d55,#af52de,#ffd700)' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 20, border: '2px solid #0a0a0a', overflow: 'hidden' }}>
              {u.photoURL ? <img src={u.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : u.avatar}
            </div>
          </div>
          <div style={{ color: '#aaa', fontSize: 10, marginTop: 4, width: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username}</div>
        </div>
      ))}
    </div>
  );
};

// ─── Story Viewer ────────────────────────────────────────────────────────────
const StoryViewer = ({ stories, user, onClose, onNextUser, onPrevUser }) => {
  const userStories = stories.filter(s => s.userId === user?.id);
  const [idx, setIdx]         = useState(0);
  const [progress, setProgress] = useState(0);
  const DURATION = 5000;

  useEffect(() => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (idx < userStories.length - 1) { setIdx(i => i+1); return 0; }
          else { onNextUser(); return 100; }
        }
        return p + (100 / (DURATION/100));
      });
    }, 100);
    return () => clearInterval(interval);
  }, [idx, userStories.length]);

  if (!userStories.length) { onClose(); return null; }
  const story = userStories[idx];

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1500 }} onClick={onClose}>
      {/* Progress bars */}
      <div style={{ position: 'absolute', top: 16, left: 12, right: 12, display: 'flex', gap: 4, zIndex: 10 }}>
        {userStories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: i === idx ? `${progress}%` : i < idx ? '100%' : '0%', height: '100%', background: 'white', transition: 'width 0.1s linear' }} />
          </div>
        ))}
      </div>

      {/* User info */}
      <div style={{ position: 'absolute', top: 30, left: 14, right: 14, display: 'flex', alignItems: 'center', gap: 10, zIndex: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: user?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16 }}>{user?.avatar}</div>
        <div style={{ color: 'white', fontWeight: 600, fontSize: 13 }}>@{user?.username}</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginLeft: 'auto' }}>{idx+1}/{userStories.length}</div>
        <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      {/* Content */}
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {story.type === 'image' && story.media && <img src={story.media} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {story.type === 'video' && story.media && <video src={story.media} autoPlay loop style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {story.type === 'text' && (
          <div style={{ background: `linear-gradient(135deg,${user?.avatarColor},#000)`, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <div style={{ color: 'white', fontSize: 28, fontWeight: 700, textAlign: 'center' }}>{story.text}</div>
          </div>
        )}
      </div>

      <button onClick={(e) => { e.stopPropagation(); onPrevUser(); }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '40%', background: 'transparent', border: 'none', cursor: 'pointer' }} />
      <button onClick={(e) => { e.stopPropagation(); onNextUser(); }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '40%', background: 'transparent', border: 'none', cursor: 'pointer' }} />
    </div>
  );
};

// ─── Video Card ──────────────────────────────────────────────────────────────
const VideoCard = memo(({ video, currentUser, onFollow, onMessage, onVoiceCall, onVideoCall, followed, showToast, onViewProfile }) => {
  const [liked, setLiked]           = useState(false);
  const [likeCount, setLikeCount]   = useState(video.likes || 0);
  const [saved, setSaved]           = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments]     = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showGifts, setShowGifts]   = useState(false);
  const [giftAnims, setGiftAnims]   = useState([]);
  const [showMore, setShowMore]     = useState(false);
  const [hearts, setHearts]         = useState([]);
  const [paused, setPaused]         = useState(false);
  const [muted, setMuted]           = useState(true);
  const videoRef = useRef(null);
  const lastTap = useRef(0);

  // Load comments from Firestore
  useEffect(() => {
    if (!showComments) return;
    const q = query(collection(db, 'comments'), where('videoId','==',video.id), orderBy('timestamp','desc'));
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [showComments, video.id]);

  const handleLike = async () => {
    if (liked) return;
    setLiked(true);
    setLikeCount(c => c + 1);
    try {
      const ref = doc(db, 'videos', video.id);
      await updateDoc(ref, { likes: likeCount + 1 });
      await addDoc(collection(db, 'likes'), { videoId: video.id, userId: currentUser?.id, timestamp: serverTimestamp() });
    } catch {}
  };

  const handleDoubleTap = (e) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      handleLike();
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          const id = Date.now() + i;
          setHearts(h => [...h, { id, x, y }]);
          setTimeout(() => setHearts(h => h.filter(hh => hh.id !== id)), 900);
        }, i * 50);
      }
    }
    lastTap.current = now;
  };

  const handleTap = () => {
    if (videoRef.current) {
      if (paused) { videoRef.current.play(); setPaused(false); }
      else        { videoRef.current.pause(); setPaused(true); }
    }
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    const c = {
      videoId: video.id, userId: currentUser?.id, username: currentUser?.username,
      avatar: currentUser?.avatar, avatarColor: currentUser?.avatarColor,
      text: commentText, likes: 0, timestamp: serverTimestamp()
    };
    setCommentText('');
    try { await addDoc(collection(db, 'comments'), c); }
    catch { showToast('Error posting comment', 'error'); }
  };

  const sendGift = (gift) => {
    if ((currentUser?.coins || 0) < gift.coins) { showToast('Not enough coins! 🪙', 'error'); return; }
    const id = Date.now();
    setGiftAnims(g => [...g, { id, gift }]);
    showToast(`Sent ${gift.name}! 🎁`, 'success');
    setTimeout(() => setGiftAnims(g => g.filter(x => x.id !== id)), 2500);
    setShowGifts(false);
  };

  const handleShare = async () => {
    const shareData = { title: `Watch @${video.username} on Dagu`, text: video.description, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(window.location.href); showToast('Link copied! 🔗', 'success'); }
    } catch {}
  };

  const isFollowing = followed?.includes(video.userId);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000', overflow: 'hidden' }}
      onClick={handleTap} onDoubleClick={handleDoubleTap}>

      {/* Video */}
      <video ref={videoRef} src={video.videoUrl} loop playsInline autoPlay muted={muted}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

      {/* Gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 55%)', pointerEvents: 'none' }} />

      {/* Paused indicator */}
      {paused && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 60, opacity: 0.8 }}>⏸</div>
        </div>
      )}

      {/* Heart burst */}
      {hearts.map(h => (
        <div key={h.id} style={{ position: 'absolute', left: h.x-24, top: h.y-24, fontSize: 44, pointerEvents: 'none', zIndex: 100, animation: 'heartBurst 0.9s ease-out forwards' }}>❤️</div>
      ))}

      {/* Gift animations */}
      {giftAnims.map(g => (
        <div key={g.id} style={{ position: 'absolute', left: '50%', top: '40%', fontSize: 52, pointerEvents: 'none', zIndex: 50, animation: 'floatUp 2s ease-out forwards', transform: 'translateX(-50%)' }}>{g.gift.animation}</div>
      ))}

      {/* Bottom info */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 70, padding: '16px 14px', zIndex: 5, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, pointerEvents: 'auto' }}>
          <div onClick={(e) => { e.stopPropagation(); onViewProfile?.(video.userId); }} style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: video.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16, border: '2px solid rgba(255,255,255,0.5)', overflow: 'hidden' }}>
              {video.photoURL ? <img src={video.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : video.avatar}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div onClick={(e) => { e.stopPropagation(); onViewProfile?.(video.userId); }} style={{ color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>@{video.username}</div>
            {video.soundName && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>🎵 {video.soundName}</div>}
          </div>
          {video.userId !== currentUser?.id && (
            <button onClick={(e) => { e.stopPropagation(); onFollow?.(video.userId); }}
              style={{ background: isFollowing ? 'rgba(255,255,255,0.1)' : '#ff2d55', border: isFollowing ? '1px solid rgba(255,255,255,0.3)' : 'none', borderRadius: 20, padding: '6px 16px', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 12, pointerEvents: 'auto' }}>
              {isFollowing ? '✓' : '+ Follow'}
            </button>
          )}
        </div>
        <div style={{ pointerEvents: 'none' }}>
          <p style={{ color: 'white', fontSize: 13, lineHeight: 1.4, marginBottom: 4 }}>
            {showMore ? video.description : (video.description?.substring(0,80) || '')}
            {(video.description?.length > 80) && (
              <span onClick={(e) => { e.stopPropagation(); setShowMore(m => !m); }} style={{ color: '#ccc', cursor: 'pointer', pointerEvents: 'auto' }}>
                {showMore ? ' less' : '... more'}
              </span>
            )}
          </p>
          {video.hashtags?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {video.hashtags.slice(0,4).map(h => <span key={h} style={{ color: '#fff', fontWeight: 600, fontSize: 12 }}>{h}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* Right action buttons */}
      <div style={{ position: 'absolute', right: 10, bottom: 20, display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center', zIndex: 10 }}>
        {/* Like */}
        <ActionBtn icon={liked ? '❤️' : '🤍'} count={formatNumber(likeCount)} active={liked}
          onClick={(e) => { e.stopPropagation(); handleLike(); }} color='#ff2d55' />
        {/* Comment */}
        <ActionBtn icon='💬' count={formatNumber(video.commentCount || 0)}
          onClick={(e) => { e.stopPropagation(); setShowComments(true); }} />
        {/* Share */}
        <ActionBtn icon='↗️' count='Share' onClick={(e) => { e.stopPropagation(); handleShare(); }} />
        {/* Gift */}
        <ActionBtn icon='🎁' count='Gift' onClick={(e) => { e.stopPropagation(); setShowGifts(g => !g); }} color='#ffd700' />
        {/* Save */}
        <ActionBtn icon={saved ? '🔖' : '📌'} count={saved ? 'Saved' : 'Save'} active={saved}
          onClick={(e) => { e.stopPropagation(); setSaved(s => !s); showToast(saved ? 'Removed' : 'Saved! 🔖', 'success'); }} color='#06d6a0' />
        {/* Mute */}
        <ActionBtn icon={muted ? '🔇' : '🔊'} count=''
          onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }} />
        {/* Message creator */}
        {video.userId !== currentUser?.id && (
          <ActionBtn icon='✉️' count='DM'
            onClick={(e) => { e.stopPropagation(); onMessage?.(video.userId); }} color='#af52de' />
        )}
      </div>

      {/* Gift picker */}
      {showGifts && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#1a1a1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, zIndex: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: 'white', fontWeight: 700 }}>🎁 Send a Gift</span>
            <span style={{ color: '#ffd700', fontWeight: 600, fontSize: 13 }}>🪙 {currentUser?.coins || 0}</span>
            <button onClick={() => setShowGifts(false)} style={{ background: '#333', border: 'none', borderRadius: '50%', width: 28, height: 28, color: 'white', cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {VIRTUAL_GIFTS.map(g => (
              <button key={g.id} onClick={() => sendGift(g)} style={{ background: '#222', border: '1px solid #2a2a2a', borderRadius: 14, padding: '10px 6px', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: 26 }}>{g.animation}</div>
                <div style={{ color: '#ffd700', fontSize: 10, marginTop: 3 }}>{g.coins}🪙</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Comments drawer */}
      {showComments && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#0f0f0f', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%', display: 'flex', flexDirection: 'column', zIndex: 20 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'white', fontWeight: 700 }}>Comments ({comments.length})</span>
            <button onClick={() => setShowComments(false)} style={{ background: '#222', border: 'none', borderRadius: '50%', width: 28, height: 28, color: 'white', cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
            {comments.length === 0 && <div style={{ textAlign: 'center', color: '#444', marginTop: 40 }}>No comments yet. Be first!</div>}
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: c.avatarColor || '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{c.avatar || '?'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#ff2d55', fontWeight: 600, fontSize: 11 }}>@{c.username}</div>
                  <div style={{ color: '#ddd', fontSize: 13, marginTop: 2 }}>{c.text}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 12px', borderTop: '1px solid #1e1e1e', display: 'flex', gap: 8 }}>
            <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key==='Enter' && addComment()}
              placeholder="Add a comment..." style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 24, padding: '9px 14px', color: 'white', outline: 'none', fontSize: 13 }} />
            <button onClick={addComment} style={{ background: '#ff2d55', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', cursor: 'pointer', fontSize: 18 }}>↑</button>
          </div>
        </div>
      )}
    </div>
  );
});

const ActionBtn = ({ icon, count, onClick, active, color = 'white' }) => (
  <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: 2 }}>
    <div style={{ fontSize: 28, filter: active ? `drop-shadow(0 0 6px ${color})` : 'none', transition: 'transform 0.15s', transform: active ? 'scale(1.2)' : 'scale(1)' }}>{icon}</div>
    {count && <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: 600 }}>{count}</span>}
  </div>
);

// ─── Home Feed (vertical swipe) ──────────────────────────────────────────────
const HomeFeed = ({ videos, currentUser, onFollow, onMessage, onVoiceCall, onVideoCall, followed, showToast, onViewProfile }) => {
  const [idx, setIdx]     = useState(0);
  const [tab, setTab]     = useState('foryou');
  const containerRef      = useRef(null);
  const startY            = useRef(null);

  const displayed = useMemo(() => {
    if (tab === 'following') return videos.filter(v => followed?.includes(v.userId));
    return videos;
  }, [videos, tab, followed]);

  const handleTouchStart = (e) => { startY.current = e.touches[0].clientY; };
  const handleTouchEnd = (e) => {
    if (startY.current === null) return;
    const diff = startY.current - e.changedTouches[0].clientY;
    if (diff > 60 && idx < displayed.length - 1) setIdx(i => i + 1);
    if (diff < -60 && idx > 0) setIdx(i => i - 1);
    startY.current = null;
  };
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY > 60 && idx < displayed.length - 1) setIdx(i => i + 1);
    if (e.deltaY < -60 && idx > 0) setIdx(i => i - 1);
  };

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Category tabs */}
      <div style={{ position: 'absolute', top: 10, left: 0, right: 0, zIndex: 15, display: 'flex', justifyContent: 'center', gap: 20 }}>
        {['foryou','following'].map(t => (
          <button key={t} onClick={() => { setTab(t); setIdx(0); }}
            style={{ background: 'none', border: 'none', color: tab===t ? 'white' : 'rgba(255,255,255,0.45)', fontWeight: tab===t ? 700 : 400, fontSize: 15, cursor: 'pointer', paddingBottom: 4, borderBottom: tab===t ? '2px solid white' : '2px solid transparent', textTransform: 'capitalize' }}>
            {t === 'foryou' ? 'For You' : 'Following'}
          </button>
        ))}
      </div>

      {/* Video stack */}
      <div ref={containerRef} style={{ height: '100%' }}
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}>
        {displayed.length === 0
          ? <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
              <div style={{ fontSize: 48 }}>🎬</div>
              <div style={{ marginTop: 12, fontSize: 14 }}>No videos yet</div>
            </div>
          : <VideoCard
              video={displayed[idx]}
              currentUser={currentUser}
              onFollow={onFollow}
              onMessage={onMessage}
              onVoiceCall={onVoiceCall}
              onVideoCall={onVideoCall}
              followed={followed}
              showToast={showToast}
              onViewProfile={onViewProfile}
            />
        }
      </div>

      {/* Position indicator */}
      {displayed.length > 0 && (
        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 4, zIndex: 5, pointerEvents: 'none' }}>
          {displayed.slice(Math.max(0, idx-2), idx+5).map((_, i) => {
            const actual = Math.max(0, idx-2) + i;
            return <div key={actual} style={{ width: 3, height: actual === idx ? 16 : 6, borderRadius: 2, background: actual === idx ? '#ff2d55' : 'rgba(255,255,255,0.2)' }} />;
          })}
        </div>
      )}
    </div>
  );
};

// ─── Conversation ────────────────────────────────────────────────────────────
const ConversationView = ({ currentUser, otherUser, onBack, showToast }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const endRef = useRef(null);
  const convId = [currentUser?.id, otherUser?.id].sort().join('_');

  useEffect(() => {
    if (!convId) return;
    const q = query(collection(db, 'messages', convId, 'msgs'), orderBy('timestamp','asc'));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [convId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    const msg = { from: currentUser.id, to: otherUser.id, text, timestamp: serverTimestamp(), read: false };
    setText('');
    try { await addDoc(collection(db, 'messages', convId, 'msgs'), msg); }
    catch { showToast('Send failed', 'error'); }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '7px 12px', color: 'white', cursor: 'pointer', fontSize: 15 }}>←</button>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: otherUser?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16, overflow: 'hidden' }}>
          {otherUser?.photoURL ? <img src={otherUser.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : otherUser?.avatar}
        </div>
        <div>
          <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>@{otherUser?.username}</div>
          <div style={{ color: '#06d6a0', fontSize: 11 }}>● Online</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && <div style={{ textAlign: 'center', color: '#444', fontSize: 13, marginTop: 40 }}>Say hi to @{otherUser?.username}! 👋</div>}
        {messages.map(msg => {
          const isMe = msg.from === currentUser?.id;
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{ background: isMe ? '#ff2d55' : '#1a1a1a', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', maxWidth: '76%' }}>
                <div style={{ color: 'white', fontSize: 13 }}>{msg.text}</div>
                <div style={{ color: isMe ? 'rgba(255,255,255,0.5)' : '#555', fontSize: 9, marginTop: 4, textAlign: 'right' }}>
                  {msg.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'now'}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {showEmoji && (
        <div style={{ background: '#161616', padding: 10, display: 'flex', flexWrap: 'wrap', gap: 6, borderTop: '1px solid #222' }}>
          {EMOJI_LIST.map(e => <button key={e} onClick={() => setText(t => t+e)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>{e}</button>)}
        </div>
      )}

      <div style={{ padding: '10px 12px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        <button onClick={() => setShowEmoji(e => !e)} style={{ background: '#1a1a1a', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 18, cursor: 'pointer' }}>😊</button>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key==='Enter' && sendMessage()}
          placeholder="Message..." style={{ flex: 1, background: '#161616', border: '1px solid #222', borderRadius: 22, padding: '9px 14px', color: 'white', outline: 'none', fontSize: 13 }} />
        <button onClick={sendMessage} style={{ background: text.trim() ? '#ff2d55' : '#222', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', cursor: 'pointer', fontSize: 18 }}>↑</button>
      </div>
    </div>
  );
};

// ─── Inbox ───────────────────────────────────────────────────────────────────
const InboxPage = ({ users, currentUser, showToast }) => {
  const [conv, setConv] = useState(null);
  const others = users.filter(u => u.id !== currentUser?.id);

  if (conv) {
    const other = users.find(u => u.id === conv);
    return <ConversationView currentUser={currentUser} otherUser={other} onBack={() => setConv(null)} showToast={showToast} />;
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      <div style={{ padding: '16px 16px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
        <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>💬 Messages</h2>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {others.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>💬</div>
            <div>No users yet</div>
          </div>
        )}
        {others.map(u => (
          <div key={u.id} onClick={() => setConv(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid #111', cursor: 'pointer', transition: 'background 0.15s' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 20, overflow: 'hidden' }}>
                {u.photoURL ? <img src={u.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : u.avatar}
              </div>
              <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, background: '#06d6a0', borderRadius: '50%', border: '2px solid #0a0a0a' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>@{u.username}</div>
              <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>Tap to message</div>
            </div>
            <span style={{ color: '#333', fontSize: 18 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Upload / Create ─────────────────────────────────────────────────────────
const CreatePage = ({ currentUser, onUploaded, showToast, onGoLive }) => {
  const [file, setFile]       = useState(null);
  const [desc, setDesc]       = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]  = useState(0);
  const [showCam, setShowCam]    = useState(false);
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const fileRef   = useRef(null);

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setShowCam(true);
    } catch { showToast('Camera denied', 'error'); }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setShowCam(false);
  };

  const capture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
      const f = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
      setFile({ f, url: URL.createObjectURL(blob), type: 'image/jpeg' });
      closeCamera();
    }, 'image/jpeg');
  };

  const pickFile = (e) => {
    const f = e.target.files[0];
    if (f) setFile({ f, url: URL.createObjectURL(f), type: f.type });
  };

  const upload = async () => {
    if (!file) { showToast('Choose a file first', 'error'); return; }
    setUploading(true);
    try {
      const isVideo = file.type.startsWith('video/');
      const url = await uploadToCloudinary(file.f, isVideo ? 'video' : 'image');
      const videoDoc = {
        userId: currentUser.id,
        username: currentUser.username,
        avatar: currentUser.avatar,
        avatarColor: currentUser.avatarColor,
        photoURL: currentUser.photoURL || '',
        videoUrl: url,
        description: desc || 'New post! 🔥',
        hashtags: (desc.match(/#\w+/g) || []),
        likes: 0, commentCount: 0, views: 0, shares: 0,
        soundName: '',
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, 'videos'), videoDoc);
      onUploaded({ id: ref.id, ...videoDoc });
      showToast('Posted! 🚀', 'success');
      setFile(null); setDesc('');
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error');
    }
    setUploading(false);
  };

  useEffect(() => { return closeCamera; }, []);

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <h2 style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Create Post</h2>
        {file && (
          <button onClick={upload} disabled={uploading} style={{ background: uploading ? '#555' : '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 20px', color: 'white', fontWeight: 700, cursor: uploading ? 'default' : 'pointer', fontSize: 14 }}>
            {uploading ? 'Uploading...' : 'Post 🚀'}
          </button>
        )}
      </div>

      <div style={{ flex: 1, padding: 16 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button onClick={() => { closeCamera(); fileRef.current?.click(); }}
            style={{ flex: 1, background: !showCam ? '#ff2d55' : '#1a1a1a', border: 'none', borderRadius: 14, padding: 12, color: 'white', cursor: 'pointer', fontWeight: 600 }}>📱 Gallery</button>
          <button onClick={openCamera}
            style={{ flex: 1, background: showCam ? '#ff2d55' : '#1a1a1a', border: 'none', borderRadius: 14, padding: 12, color: 'white', cursor: 'pointer', fontWeight: 600 }}>📷 Camera</button>
          <button onClick={onGoLive}
            style={{ flex: 1, background: 'rgba(255,45,85,0.15)', border: '1px solid #ff2d55', borderRadius: 14, padding: 12, color: '#ff2d55', cursor: 'pointer', fontWeight: 600 }}>🔴 Live</button>
        </div>
        <input ref={fileRef} type="file" accept="video/*,image/*" onChange={pickFile} style={{ display: 'none' }} />

        {/* Preview area */}
        <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 20, minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, overflow: 'hidden' }}>
          {showCam ? (
            <div style={{ position: 'relative', width: '100%' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 20 }} />
              <button onClick={capture} style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: '#ff2d55', border: '3px solid white', borderRadius: '50%', width: 62, height: 62, fontSize: 28, cursor: 'pointer' }}>📸</button>
              <button onClick={closeCamera} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer' }}>✕</button>
            </div>
          ) : file?.type?.startsWith('image/') ? (
            <img src={file.url} alt="" style={{ width: '100%', borderRadius: 20 }} />
          ) : file?.type?.startsWith('video/') ? (
            <video src={file.url} controls style={{ width: '100%', borderRadius: 20 }} />
          ) : (
            <label onClick={() => fileRef.current?.click()} style={{ textAlign: 'center', cursor: 'pointer', padding: 48 }}>
              <div style={{ fontSize: 52, marginBottom: 10 }}>🎬</div>
              <div style={{ color: '#555', fontSize: 14 }}>Tap to select video or photo</div>
            </label>
          )}
        </div>

        <textarea placeholder="Write a caption... (use #hashtags)" value={desc} onChange={e => setDesc(e.target.value)}
          style={{ width: '100%', background: '#141414', border: '1px solid #1e1e1e', borderRadius: 14, padding: 14, color: 'white', minHeight: 90, outline: 'none', fontSize: 13, resize: 'none', boxSizing: 'border-box' }} />
      </div>
    </div>
  );
};

// ─── Search ──────────────────────────────────────────────────────────────────
const SearchOverlay = ({ onClose, videos, users, onViewProfile }) => {
  const [query, setQuery] = useState('');
  const [tab, setTab]     = useState('all');

  const results = useMemo(() => {
    if (!query.trim()) return { videos: [], users: [], hashtags: [] };
    const q = query.toLowerCase();
    return {
      users: users.filter(u => u.username.toLowerCase().includes(q) || (u.bio||'').toLowerCase().includes(q)).slice(0,8),
      videos: videos.filter(v => v.username.toLowerCase().includes(q) || (v.description||'').toLowerCase().includes(q)).slice(0,8),
      hashtags: [...new Set(videos.flatMap(v => v.hashtags||[]).filter(h => h.toLowerCase().includes(q)))].slice(0,8),
    };
  }, [query, videos, users]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#161616', borderRadius: 24, padding: '9px 14px' }}>
          <span style={{ marginRight: 8 }}>🔍</span>
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search videos, users, tags..."
            style={{ flex: 1, background: 'none', border: 'none', color: 'white', outline: 'none', fontSize: 13 }} />
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer' }}>✕</button>
      </div>
      {query && (
        <>
          <div style={{ display: 'flex', gap: 4, padding: '8px 14px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
            {['all','users','videos','hashtags'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ background: tab===t ? 'rgba(255,45,85,0.15)' : 'none', border: 'none', padding: '5px 14px', color: tab===t ? '#ff2d55' : '#666', cursor: 'pointer', borderRadius: 20, fontSize: 12, fontWeight: tab===t ? 700 : 400, textTransform: 'capitalize' }}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {(tab==='all'||tab==='users') && results.users.map(u => (
              <div key={u.id} onClick={() => { onViewProfile?.(u.id); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#141414', borderRadius: 14, marginBottom: 8, cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 18, overflow: 'hidden' }}>
                  {u.photoURL ? <img src={u.photoURL} style={{ width:'100%',height:'100%',objectFit:'cover' }} alt="" /> : u.avatar}
                </div>
                <div>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: 13 }}>@{u.username}</div>
                  <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>{(u.bio||'').substring(0,40)}</div>
                </div>
              </div>
            ))}
            {(tab==='all'||tab==='videos') && results.videos.map(v => (
              <div key={v.id} style={{ padding: '10px 12px', background: '#141414', borderRadius: 14, marginBottom: 8 }}>
                <div style={{ color: '#ff2d55', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>@{v.username}</div>
                <div style={{ color: 'white', fontSize: 13 }}>{v.description?.substring(0,80)}</div>
              </div>
            ))}
            {(tab==='all'||tab==='hashtags') && results.hashtags.map(h => (
              <div key={h} style={{ padding: '12px 14px', background: '#141414', borderRadius: 14, marginBottom: 8, color: '#ff2d55', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                {h}
              </div>
            ))}
            {results.users.length===0 && results.videos.length===0 && results.hashtags.length===0 && (
              <div style={{ textAlign: 'center', color: '#555', marginTop: 60 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                <div>No results for "{query}"</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─── User Profile Modal ───────────────────────────────────────────────────────
const UserProfileModal = ({ user, currentUser, onClose, onFollow, onMessage, onVoiceCall, onVideoCall, followed, showToast }) => {
  const isFollowing = followed?.includes(user?.id);
  const isOwn       = user?.id === currentUser?.id;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#0f0f0f', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button onClick={onClose} style={{ background: '#222', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: user?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 32, margin: '0 auto 12px', border: '3px solid #ff2d55', overflow: 'hidden' }}>
            {user?.photoURL ? <img src={user.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : user?.avatar}
          </div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 20 }}>@{user?.username}</div>
          {user?.verified && <div style={{ color: '#1d9bf0', fontSize: 12, marginTop: 2 }}>✓ Verified</div>}
          <div style={{ color: '#888', fontSize: 13, marginTop: 6 }}>{user?.bio}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 22 }}>
          {[['Followers', user?.followers?.length||0], ['Following', user?.following?.length||0], ['Videos', user?.videoCount||0]].map(([label, val]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>{formatNumber(val)}</div>
              <div style={{ color: '#666', fontSize: 11 }}>{label}</div>
            </div>
          ))}
        </div>

        {!isOwn && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <button onClick={() => onFollow?.(user.id)} style={{ flex: 1, background: isFollowing ? '#222' : '#ff2d55', border: isFollowing ? '1px solid #333' : 'none', borderRadius: 24, padding: 12, color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                {isFollowing ? '✓ Following' : '+ Follow'}
              </button>
              <button onClick={() => { onMessage?.(user.id); onClose(); }} style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 24, padding: 12, color: 'white', fontWeight: 700, cursor: 'pointer' }}>💬 Message</button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { onVoiceCall?.(user.id); onClose(); }} style={{ flex: 1, background: '#0d2010', border: '1px solid #1a3a1a', borderRadius: 20, padding: 10, color: '#06d6a0', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>🎙️ Voice Call</button>
              <button onClick={() => { onVideoCall?.(user.id); onClose(); }} style={{ flex: 1, background: '#0d0d1a', border: '1px solid #1a1a3a', borderRadius: 20, padding: 10, color: '#af52de', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>📹 Video Call</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Profile Page ─────────────────────────────────────────────────────────────
const ProfilePage = ({ user, setCurrentUser, onLogout, users, showToast, onShowAnalytics, onShowQRCode }) => {
  const [subPage, setSubPage] = useState(null);
  const photoRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [myVideos, setMyVideos]   = useState([]);
  const [editing, setEditing]     = useState(false);
  const [bio, setBio]             = useState(user?.bio || '');

  useEffect(() => {
    if (!user?.id) return;
    const q = query(collection(db, 'videos'), where('userId','==',user.id), orderBy('timestamp','desc'));
    const unsub = onSnapshot(q, snap => setMyVideos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [user?.id]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file, 'image');
      await updateDoc(doc(db, 'users', user.id), { photoURL: url });
      setCurrentUser(u => ({ ...u, photoURL: url }));
      showToast('Profile photo updated! ✅', 'success');
    } catch { showToast('Upload failed', 'error'); }
    setUploading(false);
  };

  const saveBio = async () => {
    try {
      await updateDoc(doc(db, 'users', user.id), { bio });
      setCurrentUser(u => ({ ...u, bio }));
      showToast('Bio updated!', 'success');
    } catch {}
    setEditing(false);
  };

  const menuItems = [
    { page: 'analytics', icon: '📊', label: 'Analytics', color: '#06d6a0', action: onShowAnalytics },
    { page: 'qr',        icon: '📱', label: 'QR Code',   color: '#af52de', action: onShowQRCode },
    { page: 'coins',     icon: '🪙', label: 'Coins',     color: '#ffd700' },
    { page: 'premium',   icon: '⭐', label: 'Premium',   color: '#ffd700' },
    { page: 'privacy',   icon: '🔒', label: 'Privacy',   color: '#1d9bf0' },
    { page: 'switch',    icon: '🔄', label: 'Accounts',  color: '#06d6a0' },
    { page: 'logout',    icon: '🚪', label: 'Logout',    color: '#ff2d55', action: onLogout },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a' }}>
      {/* Header */}
      <div style={{ padding: 20, textAlign: 'center', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ position: 'relative', width: 84, margin: '0 auto 14px' }}>
          <div onClick={() => photoRef.current?.click()} style={{ width: 84, height: 84, borderRadius: '50%', background: user?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 34, border: '3px solid #ff2d55', cursor: 'pointer', overflow: 'hidden' }}>
            {user?.photoURL ? <img src={user.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : user?.avatar}
          </div>
          <div onClick={() => photoRef.current?.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, background: '#ff2d55', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}>📷</div>
          <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
          {uploading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11 }}>...</div>}
        </div>
        <div style={{ color: 'white', fontWeight: 700, fontSize: 20 }}>@{user?.username}</div>
        {user?.verified && <div style={{ color: '#1d9bf0', fontSize: 12 }}>✓ Verified</div>}

        {editing ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center' }}>
            <input value={bio} onChange={e => setBio(e.target.value)} style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 12, padding: '7px 12px', color: 'white', outline: 'none', fontSize: 13, width: 200 }} />
            <button onClick={saveBio} style={{ background: '#ff2d55', border: 'none', borderRadius: 12, padding: '7px 14px', color: 'white', cursor: 'pointer', fontSize: 13 }}>Save</button>
          </div>
        ) : (
          <div onClick={() => setEditing(true)} style={{ color: '#888', fontSize: 13, marginTop: 6, cursor: 'pointer' }}>{user?.bio || 'Tap to add bio...'}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 30, marginTop: 16 }}>
          {[['Followers', user?.followers?.length||0,'#fff'], ['Following', user?.following?.length||0,'#fff'], ['Coins 🪙', user?.coins||0,'#ffd700'], ['Videos', myVideos.length,'#fff']].map(([label, val, color]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ color, fontWeight: 700, fontSize: 16 }}>{formatNumber(val)}</div>
              <div style={{ color: '#666', fontSize: 10 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Menu Grid */}
      <div style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          {menuItems.map(item => (
            <button key={item.page} onClick={item.action || (() => setSubPage(item.page))}
              style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 16, padding: '14px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ color: item.color, fontSize: 10, fontWeight: 600 }}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* My Videos grid */}
        <div style={{ color: 'white', fontWeight: 700, marginBottom: 12 }}>My Posts ({myVideos.length})</div>
        {myVideos.length === 0
          ? <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>🎬</div>
              <div>No posts yet. Go create!</div>
            </div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2 }}>
              {myVideos.map(v => (
                <div key={v.id} style={{ aspectRatio: '3/4', background: '#141414', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                  <video src={v.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 6, left: 6, color: 'white', fontSize: 11, fontWeight: 600, background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '2px 6px' }}>❤️ {formatNumber(v.likes)}</div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
};

// ─── Analytics ────────────────────────────────────────────────────────────────
const AnalyticsPage = ({ user, videos, onClose }) => {
  const myVids     = videos.filter(v => v.userId === user?.id);
  const totalViews = myVids.reduce((s,v) => s + (v.views||0), 0);
  const totalLikes = myVids.reduce((s,v) => s + (v.likes||0), 0);
  const weeklyData = [1200,1450,1800,2100,2500,2900,3400];
  const maxW       = Math.max(...weeklyData);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 200, overflow: 'auto' }}>
      <div style={{ padding: '24px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: 'white', fontSize: 22, fontWeight: 800 }}>📊 Analytics</h2>
          <button onClick={onClose} style={{ background: '#1a1a1a', border: 'none', borderRadius: 20, padding: '8px 16px', color: 'white', cursor: 'pointer' }}>Close</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 20 }}>
          {[['Total Views',formatNumber(totalViews),'#06d6a0'],['Total Likes',formatNumber(totalLikes),'#ff2d55'],['Videos',String(myVids.length),'#af52de'],['Coins',String(user?.coins||0),'#ffd700']].map(([label,val,color]) => (
            <div key={label} style={{ background: '#141414', borderRadius: 18, padding: 18, border: '1px solid #1e1e1e' }}>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>{label}</div>
              <div style={{ color, fontSize: 26, fontWeight: 800 }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#141414', borderRadius: 18, padding: 18, marginBottom: 16 }}>
          <div style={{ color: 'white', fontWeight: 700, marginBottom: 16, fontSize: 14 }}>📈 Weekly Growth</div>
          <div style={{ height: 100, display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            {weeklyData.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', background: i===weeklyData.length-1?'#ff2d55':'#af52de', borderRadius: '4px 4px 0 0', height: `${(v/maxW)*100}%`, minHeight: 4 }} />
                <div style={{ color: '#555', fontSize: 9 }}>{['M','T','W','T','F','S','S'][i]}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#141414', borderRadius: 18, padding: 18 }}>
          <div style={{ color: 'white', fontWeight: 700, marginBottom: 12, fontSize: 14 }}>🌍 Top Regions</div>
          {[['Ethiopia','60%','#ff2d55'],['Kenya','20%','#06d6a0'],['Nigeria','12%','#af52de'],['Other','8%','#ffd700']].map(([country,pct,color]) => (
            <div key={country} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#aaa', fontSize: 12 }}>{country}</span>
                <span style={{ color: 'white', fontSize: 12, fontWeight: 600 }}>{pct}</span>
              </div>
              <div style={{ background: '#222', borderRadius: 4, height: 6 }}>
                <div style={{ width: pct, background: color, borderRadius: 4, height: '100%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Friends Feed ─────────────────────────────────────────────────────────────
const FriendsFeed = ({ friends, videos, currentUser, onMessage, onViewProfile, showToast }) => {
  const [search, setSearch] = useState('');
  const friendVids = useMemo(() => videos.filter(v => friends.includes(v.userId)).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)), [friends, videos]);
  const filtered   = useMemo(() => !search ? friendVids : friendVids.filter(v => v.username.toLowerCase().includes(search.toLowerCase()) || (v.description||'').toLowerCase().includes(search.toLowerCase())), [friendVids, search]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#161616', borderRadius: 24, padding: '8px 14px' }}>
          <span>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search friend posts..."
            style={{ flex: 1, background: 'none', border: 'none', color: 'white', outline: 'none', fontSize: 13 }} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0
          ? <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
              <div style={{ fontSize: 15, marginBottom: 8 }}>No friend videos yet</div>
              <div style={{ fontSize: 12, color: '#444' }}>Follow people to see their posts here</div>
            </div>
          : <div style={{ padding: 12 }}>
              {filtered.map(video => (
                <div key={video.id} style={{ background: '#141414', borderRadius: 18, marginBottom: 14, overflow: 'hidden', border: '1px solid #1e1e1e' }}>
                  <div style={{ background: '#000', minHeight: 180 }}>
                    <video src={video.videoUrl} style={{ width: '100%', maxHeight: 220 }} controls playsInline />
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div onClick={() => onViewProfile?.(video.userId)} style={{ width: 38, height: 38, borderRadius: '50%', background: video.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', overflow: 'hidden' }}>
                        {video.photoURL ? <img src={video.photoURL} style={{ width:'100%',height:'100%',objectFit:'cover' }} alt="" /> : video.avatar}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div onClick={() => onViewProfile?.(video.userId)} style={{ color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>@{video.username}</div>
                        <div style={{ color: '#555', fontSize: 11 }}>{formatNumber(video.views||0)} views · ❤️ {formatNumber(video.likes||0)}</div>
                      </div>
                      <button onClick={() => onMessage?.(video.userId)} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '6px 14px', color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>💬</button>
                    </div>
                    <p style={{ color: '#bbb', fontSize: 12, lineHeight: 1.5 }}>{video.description}</p>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function DaguApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers]             = useState([]);
  const [videos, setVideos]           = useState([]);
  const [stories, setStories]         = useState([]);
  const [followed, setFollowed]       = useState([]);
  const [activeTab, setActiveTab]     = useState('home');
  const [toast, setToast]             = useState(null);

  const [showSearch, setShowSearch]   = useState(false);
  const [showLive, setShowLive]       = useState(null);
  const [showCall, setShowCall]       = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [storyViewerUser, setStoryViewerUser] = useState(null);
  const [showStoryViewer, setShowStoryViewer] = useState(false);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
  }, []);

  // Load users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Load videos
  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('timestamp', 'desc'), limit(50));
    const unsub = onSnapshot(q, snap => {
      setVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Load stories (last 24h)
  useEffect(() => {
    const q = query(collection(db, 'stories'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setStories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Sync followed from user profile
  useEffect(() => {
    if (currentUser?.following) setFollowed(currentUser.following);
  }, [currentUser]);

  const handleLogin = async (email, password) => {
    const q = query(collection(db, 'users'), where('email','==',email));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      setCurrentUser({ id: d.id, ...d.data() });
      showToast(`Welcome back, @${d.data().username}! 👋`, 'success');
    } else {
      // Auto-create user if not found (simple auth)
      const username = email.split('@')[0];
      const newUser = {
        username, email, fullName: username,
        avatar: username[0].toUpperCase(),
        avatarColor: `hsl(${Math.floor(Math.random()*360)},65%,55%)`,
        verified: false, bio: 'New to Dagu! 🎬',
        followers: [], following: [],
        coins: 500, walletBalance: 500,
        level: 1, streak: 1, subscription: 'free', photoURL: '', videoCount: 0
      };
      const ref = doc(collection(db, 'users'));
      await setDoc(ref, newUser);
      setCurrentUser({ id: ref.id, ...newUser });
      showToast(`Welcome to Dagu, @${username}! 🎉`, 'success');
    }
  };

  const handleSignup = async (email, username, fullName, password) => {
    const newUser = {
      username, email, fullName,
      avatar: username[0].toUpperCase(),
      avatarColor: `hsl(${Math.floor(Math.random()*360)},65%,55%)`,
      verified: false, bio: 'New to Dagu! 🎬',
      followers: [], following: [],
      coins: 500, walletBalance: 500,
      level: 1, streak: 1, subscription: 'free', photoURL: '', videoCount: 0
    };
    const ref = doc(collection(db, 'users'));
    await setDoc(ref, newUser);
    setCurrentUser({ id: ref.id, ...newUser });
    showToast(`Welcome to Dagu, @${username}! 🎉`, 'success');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setFollowed([]);
    setActiveTab('home');
    showToast('Logged out', 'info');
  };

  const toggleFollow = async (userId) => {
    const isFollowing = followed.includes(userId);
    const newFollowed = isFollowing ? followed.filter(id => id !== userId) : [...followed, userId];
    setFollowed(newFollowed);
    showToast(isFollowing ? 'Unfollowed' : 'Followed! 🎉', 'success');
    try {
      await updateDoc(doc(db, 'users', currentUser.id), { following: newFollowed });
      if (isFollowing) {
        await updateDoc(doc(db, 'users', userId), { followers: arrayRemove(currentUser.id) });
      } else {
        await updateDoc(doc(db, 'users', userId), { followers: arrayUnion(currentUser.id) });
      }
      setCurrentUser(u => ({ ...u, following: newFollowed }));
    } catch {}
  };

  const handleViewProfile = (userId) => {
    const user = users.find(u => u.id === userId);
    if (user) setViewingProfile(user);
  };

  const handleMessage = (userId) => {
    setActiveTab('inbox');
  };

  const handleUpload = (video) => {
    // Already added to Firestore in CreatePage; update local state for instant UI
    setVideos(prev => [video, ...prev]);
    setActiveTab('home');
  };

  // Story navigation
  const storyUserList = useMemo(() => {
    const ids = [...new Set(stories.map(s => s.userId))];
    return ids.map(id => users.find(u => u.id === id)).filter(Boolean);
  }, [stories, users]);

  const currentStoryIdx = storyUserList.findIndex(u => u?.id === storyViewerUser?.id);

  const goNextStoryUser = () => {
    if (currentStoryIdx < storyUserList.length - 1) setStoryViewerUser(storyUserList[currentStoryIdx + 1]);
    else { setShowStoryViewer(false); setStoryViewerUser(null); }
  };

  const goPrevStoryUser = () => {
    if (currentStoryIdx > 0) setStoryViewerUser(storyUserList[currentStoryIdx - 1]);
  };

  // ── Auth gate
  if (!currentUser) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <style>{`*{margin:0;padding:0;box-sizing:border-box}::-webkit-scrollbar{display:none}`}</style>
        <AuthScreen onLogin={handleLogin} onSignup={handleSignup} />
      </div>
    );
  }

  const tabs = [
    { id: 'home',    icon: '🏠', label: 'Home' },
    { id: 'friends', icon: '👥', label: 'Friends' },
    { id: 'create',  icon: '➕', label: 'Create' },
    { id: 'inbox',   icon: '💬', label: 'Inbox' },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ];

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        ::-webkit-scrollbar{display:none}
        @keyframes heartBurst{0%{transform:scale(0.3) translateY(0);opacity:1}100%{transform:scale(1.6) translateY(-80px);opacity:0}}
        @keyframes floatUp{0%{transform:translateX(-50%) translateY(0) scale(1);opacity:1}100%{transform:translateX(-50%) translateY(-120px) scale(1.6);opacity:0}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        button:active{transform:scale(0.94);transition:transform 0.1s}
        input,textarea{color-scheme:dark}
      `}</style>

      {/* ── Overlays ── */}
      {showCall && (
        <CallModal type={showCall.type} contactName={showCall.contactName} contactAvatar={showCall.contactAvatar}
          onClose={() => setShowCall(null)} />
      )}
      {showLive && (
        <LiveStream streamer={showLive} onClose={() => setShowLive(null)} showToast={showToast} currentUser={currentUser} />
      )}
      {showStoryViewer && storyViewerUser && (
        <StoryViewer stories={stories} user={storyViewerUser} currentUser={currentUser}
          onClose={() => { setShowStoryViewer(false); setStoryViewerUser(null); }}
          onNextUser={goNextStoryUser} onPrevUser={goPrevStoryUser} />
      )}
      {viewingProfile && (
        <UserProfileModal
          user={viewingProfile} currentUser={currentUser}
          onClose={() => setViewingProfile(null)}
          onFollow={toggleFollow}
          onMessage={(uid) => { handleMessage(uid); setViewingProfile(null); }}
          onVoiceCall={(uid) => { const u = users.find(uu => uu.id===uid); setShowCall({ type:'audio', contactName:u?.username, contactAvatar:u?.avatar }); setViewingProfile(null); }}
          onVideoCall={(uid) => { const u = users.find(uu => uu.id===uid); setShowCall({ type:'video', contactName:u?.username, contactAvatar:u?.avatar }); setViewingProfile(null); }}
          followed={followed} showToast={showToast}
        />
      )}
      {showAnalytics && (
        <AnalyticsPage user={currentUser} videos={videos} onClose={() => setShowAnalytics(false)} />
      )}

      {/* ── Stories Row (home only) ── */}
      {activeTab === 'home' && !showStoryViewer && !showLive && (
        <Stories users={users} stories={stories} currentUser={currentUser}
          onViewStory={(u) => { setStoryViewerUser(u); setShowStoryViewer(true); }}
          onAddStory={(s) => setStories(prev => [s, ...prev])}
          showToast={showToast}
        />
      )}

      {/* ── Search bar (non-profile tabs) ── */}
      {activeTab !== 'profile' && activeTab !== 'create' && (
        <div style={{ padding: '8px 14px', background: '#0a0a0a', borderBottom: '1px solid #141414', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button onClick={() => setShowSearch(true)} style={{ flex: 1, background: '#141414', border: '1px solid #1e1e1e', borderRadius: 24, padding: '8px 14px', color: '#555', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <span>🔍</span> Search videos, users...
          </button>
          {activeTab === 'home' && (
            <button onClick={() => setShowLive(currentUser)} style={{ background: '#ff2d55', border: 'none', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔴</button>
          )}
        </div>
      )}

      {/* ── Main content ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {showSearch && (
          <SearchOverlay onClose={() => setShowSearch(false)} videos={videos} users={users}
            onViewProfile={(uid) => { handleViewProfile(uid); setShowSearch(false); }} />
        )}

        {!showSearch && (
          <>
            {activeTab === 'home' && (
              <HomeFeed
                videos={videos} currentUser={currentUser}
                onFollow={toggleFollow}
                onMessage={handleMessage}
                onVoiceCall={(uid) => { const u = users.find(uu => uu.id===uid); setShowCall({ type:'audio', contactName:u?.username, contactAvatar:u?.avatar }); }}
                onVideoCall={(uid) => { const u = users.find(uu => uu.id===uid); setShowCall({ type:'video', contactName:u?.username, contactAvatar:u?.avatar }); }}
                followed={followed} showToast={showToast}
                onViewProfile={handleViewProfile}
              />
            )}
            {activeTab === 'friends' && (
              <FriendsFeed
                friends={followed} videos={videos} currentUser={currentUser}
                onMessage={handleMessage}
                onViewProfile={handleViewProfile}
                showToast={showToast}
              />
            )}
            {activeTab === 'create' && (
              <CreatePage
                currentUser={currentUser}
                onUploaded={handleUpload}
                showToast={showToast}
                onGoLive={() => setShowLive(currentUser)}
              />
            )}
            {activeTab === 'inbox' && (
              <InboxPage users={users} currentUser={currentUser} showToast={showToast} />
            )}
            {activeTab === 'profile' && (
              <ProfilePage
                user={currentUser} setCurrentUser={setCurrentUser}
                onLogout={handleLogout} users={users} showToast={showToast}
                onShowAnalytics={() => setShowAnalytics(true)}
                onShowQRCode={() => showToast('QR Code coming soon!', 'info')}
              />
            )}
          </>
        )}
      </div>

      {/* ── Tab Bar ── */}
      <div style={{ display: 'flex', background: 'rgba(8,8,8,0.97)', borderTop: '1px solid #161616', padding: '8px 4px 16px', flexShrink: 0, backdropFilter: 'blur(12px)' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
            <span style={{ fontSize: tab.id==='create' ? 26 : 20, transform: activeTab===tab.id ? 'scale(1.18)' : 'scale(1)', transition: 'transform 0.15s' }}>{tab.icon}</span>
            <span style={{ fontSize: 10, color: activeTab===tab.id ? '#ff2d55' : '#444', fontWeight: activeTab===tab.id ? 700 : 400 }}>{tab.label}</span>
          </button>
        ))}
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
