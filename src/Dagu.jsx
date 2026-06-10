// DaguV3.jsx — FULLY REAL: Firebase Auth + Firestore + Cloudinary + EmailJS
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, increment, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';

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
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/* ─────────────── CLOUDINARY CONFIG ─────────────── */
const CLOUDINARY_CLOUD = 'dotvhzjmc';
const CLOUDINARY_PRESET = 'g3c7dwdg';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/upload`;

/* ─────────────── EMAILJS CONFIG ─────────────── */
const EMAILJS_SERVICE = 'service_mtqmvbb';
const EMAILJS_TEMPLATE = 'template_1k7wiqa';
const EMAILJS_PUBLIC_KEY = 'U9fs25Bcx5oQ6A2ru';

/* ─────────────── CONSTANTS ─────────────── */
const LOGIN_METHODS = [
  { id: 'google', name: 'Google', icon: '🌐', color: '#4285f4' },
  { id: 'email', name: 'Email', icon: '📧', color: '#ff2d55' },
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
  { id: 'skill', label: 'Skills' },
  { id: 'job', label: 'Jobs' },
];

const EMOJI_LIST = ['😀','😂','😍','🥰','😎','🤔','😭','😱','🔥','❤️','👍','🎉','✨','💯','🙌','👏','🤝','💪','🎵','📸'];

const formatNumber = (num) => {
  const n = Number(num) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
};

/* ─────────────── CLOUDINARY UPLOAD ─────────────── */
const uploadToCloudinary = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  formData.append('cloud_name', CLOUDINARY_CLOUD);
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.secure_url);
      } else {
        reject(new Error('Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload error'));
    xhr.open('POST', CLOUDINARY_UPLOAD_URL);
    xhr.send(formData);
  });
};

/* ─────────────── EMAILJS SEND ─────────────── */
const sendEmailJS = async (templateParams) => {
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE,
        template_id: EMAILJS_TEMPLATE,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: templateParams,
      }),
    });
    return res.status === 200;
  } catch { return false; }
};

/* ─────────────── FIREBASE HELPERS ─────────────── */
const createUserProfile = async (uid, data) => {
  await setDoc(doc(db, 'users', uid), {
    id: uid,
    username: data.username || '',
    fullName: data.fullName || '',
    email: data.email || '',
    avatar: (data.username || data.email || 'U')[0].toUpperCase(),
    avatarColor: data.avatarColor || `hsl(${Math.floor(Math.random()*360)},70%,60%)`,
    avatarUrl: data.avatarUrl || null,
    bio: data.bio || 'New to Infinity! 🎬',
    link: '',
    gender: '',
    verified: false,
    followers: [],
    following: [],
    coins: 500,
    walletBalance: 500,
    level: 1,
    streak: 1,
    subscription: 'free',
    createdAt: serverTimestamp(),
  }, { merge: true });
};

const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
};

/* ─────────────── GLOBAL STYLES ─────────────── */
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
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
    @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
    button:active{transform:scale(0.94)!important}
    input,textarea{font-family:'DM Sans',sans-serif}
    .tab-active-indicator{animation:tabPop 0.25s ease}
    .story-avatar-ring{background:conic-gradient(#ff2d55,#ff9500,#ffd700,#af52de,#ff2d55);padding:2.5px;border-radius:50%}
  `}</style>
);

/* ─────────────── TOAST ─────────────── */
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
    <div style={{ position:'fixed', bottom:110, left:'50%', transform:'translateX(-50%)', zIndex:9999, animation:'slideUp 0.3s ease', display:'flex', alignItems:'center', gap:10, background:'rgba(15,15,15,0.95)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:40, padding:'10px 18px 10px 10px', boxShadow:'0 8px 32px rgba(0,0,0,0.5)', whiteSpace:'nowrap' }}>
      <div style={{ width:26, height:26, borderRadius:'50%', background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:13, flexShrink:0 }}>{c.icon}</div>
      <span style={{ color:'white', fontSize:13, fontWeight:500, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{message}</span>
    </div>
  );
};

/* ─────────────── SHARE MODAL ─────────────── */
const ShareModal = ({ video, onClose, showToast }) => {
  const url = `https://infinity-now.vercel.app`;
  const shareText = `@${video?.username}: ${video?.description || 'Check this out on Infinity!'}`;

  const doShare = async (platform, action) => {
    action();
    await updateDoc(doc(db,'videos',video.id),{ shares: increment(1) });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(url)
      .then(()=>showToast?.('Link copied!','success'))
      .catch(()=>showToast?.('Copied!','success'));
    updateDoc(doc(db,'videos',video.id),{ shares: increment(1) });
  };

  const nativeShare = async () => {
    if(navigator.share){
      try {
                await navigator.share({ title:'Infinity', text:shareText, url });
        await updateDoc(doc(db,'videos',video.id),{ shares: increment(1) });
        showToast?.('Shared!','success');
      } catch {}
    } else {
      copyLink();
    }
  };

  const socialOptions = [
    { name:'Copy Link',   icon:'🔗', color:'#555',     action:()=>copyLink() },
    { name:'Share',       icon:'📤', color:'#007aff',  action:()=>nativeShare() },
    { name:'WhatsApp',    icon:'💬', color:'#25D366',  action:()=>doShare('whatsapp',()=>window.open(`https://wa.me/?text=${encodeURIComponent(shareText+' '+url)}`)) },
    { name:'Telegram',    icon:'✈️', color:'#26A5E4',  action:()=>doShare('telegram',()=>window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`)) },
    { name:'Facebook',    icon:'👥', color:'#1877f2',  action:()=>doShare('facebook',()=>window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)) },
    { name:'X/Twitter',   icon:'🐦', color:'#1DA1F2',  action:()=>doShare('twitter',()=>window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`)) },
    { name:'LinkedIn',    icon:'💼', color:'#0077b5',  action:()=>doShare('linkedin',()=>window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`)) },
    { name:'Pinterest',   icon:'📌', color:'#E60023',  action:()=>doShare('pinterest',()=>window.open(`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(shareText)}`)) },
    { name:'Reddit',      icon:'🤖', color:'#FF4500',  action:()=>doShare('reddit',()=>window.open(`https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(shareText)}`)) },
    { name:'TikTok',      icon:'🎵', color:'#010101',  action:()=>doShare('tiktok',()=>window.open(`https://www.tiktok.com`)) },
    { name:'Instagram',   icon:'📸', color:'#E1306C',  action:()=>{ copyLink(); showToast?.('Link copied — paste in Instagram!','info'); } },
    { name:'Email',       icon:'📧', color:'#ff2d55',  action:()=>doShare('email',()=>window.open(`mailto:?subject=Check this on Dagu&body=${encodeURIComponent(shareText+'\n'+url)}`)) },
    { name:'SMS',         icon:'💬', color:'#34c759',  action:()=>doShare('sms',()=>window.open(`sms:?body=${encodeURIComponent(shareText+' '+url)}`)) },
    { name:'iMessage',    icon:'🟢', color:'#34c759',  action:()=>doShare('imessage',()=>window.open(`sms:?body=${encodeURIComponent(shareText+' '+url)}`)) },
    { name:'Snapchat',    icon:'👻', color:'#FFFC00',  action:()=>doShare('snapchat',()=>window.open(`https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(url)}`)) },
    { name:'Viber',       icon:'📳', color:'#7360F2',  action:()=>doShare('viber',()=>window.open(`viber://forward?text=${encodeURIComponent(shareText+' '+url)}`)) },
  ];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:4000, display:'flex', alignItems:'flex-end' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', background:'#111', borderTopLeftRadius:32, borderTopRightRadius:32, paddingBottom:40, maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
        {/* Handle */}
        <div style={{ display:'flex', justifyContent:'center', padding:'14px 0 10px', flexShrink:0 }}>
          <div style={{ width:36, height:4, background:'rgba(255,255,255,0.15)', borderRadius:2 }} />
        </div>

        {/* Post preview */}
        {video && (
          <div style={{ margin:'0 16px 14px', background:'rgba(255,255,255,0.04)', borderRadius:18, padding:'12px 14px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
            <div style={{ width:44, height:44, borderRadius:10, background:'#222', overflow:'hidden', flexShrink:0 }}>
              {video.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i)
                ? <img src={video.videoUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" />
                : <video src={video.videoUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} muted />
              }
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:'white', fontSize:13, fontWeight:700 }}>@{video.username}</div>
              <div style={{ color:'rgba(255,255,255,0.4)', fontSize:11, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{video.description}</div>
            </div>
            <div style={{ color:'rgba(255,255,255,0.3)', fontSize:11, textAlign:'center', flexShrink:0 }}>
              <div style={{ color:'white', fontWeight:700, fontSize:14 }}>{formatNumber(video.shares||0)}</div>
              <div>shares</div>
            </div>
          </div>
        )}

        {/* Share link bar */}
        <div style={{ margin:'0 16px 14px', background:'rgba(255,255,255,0.05)', borderRadius:14, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <span style={{ color:'rgba(255,255,255,0.4)', fontSize:12, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{url}</span>
          <button onClick={copyLink} style={{ background:'linear-gradient(135deg,#ff2d55,#af52de)', border:'none', borderRadius:10, padding:'6px 14px', color:'white', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>Copy</button>
        </div>

        {/* Section label */}
        <div style={{ padding:'0 16px 10px', color:'rgba(255,255,255,0.4)', fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', flexShrink:0 }}>Share to</div>

        {/* Icons grid — scrollable */}
        <div style={{ overflowY:'auto', padding:'0 16px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {socialOptions.map(opt=>(
              <button key={opt.name} onClick={opt.action} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:18, padding:'14px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:7, cursor:'pointer' }}>
                <div style={{ width:48, height:48, borderRadius:'50%', background:opt.color+'22', border:`1.5px solid ${opt.color}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{opt.icon}</div>
                <span style={{ color:'rgba(255,255,255,0.6)', fontSize:10, fontWeight:500, textAlign:'center' }}>{opt.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const StoryViewer = ({ story, user, onClose }) => {
  const [progress, setProgress] = useState(0);
  const [storyReply, setStoryReply] = useState('');

  useEffect(() => {
    const i = setInterval(() => setProgress(p => {
      if (p >= 100) { onClose(); return 100; }
      return p + 1;
    }), 50);
    return () => clearInterval(i);
  }, [onClose]);

  const sendStoryReply = async () => {
    if(!storyReply.trim()) return;
    await addDoc(collection(db,'storyReplies'), {
      storyUserId: story?.userId,
      fromUserId: user?.id,
      fromUsername: user?.username,
      text: storyReply,
      createdAt: serverTimestamp(),
    });
    setStoryReply('');
    onClose();
  };

  const avatarSrc = user?.avatarUrl;
  return (
    <div style={{ position:'fixed', inset:0, background:'#000', zIndex:3000, display:'flex', flexDirection:'column' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'rgba(255,255,255,0.15)', zIndex:10 }}>
        <div style={{ height:'100%', background:'white', width:`${progress}%`, transition:'width 0.05s linear' }} />
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'20px 16px 12px', zIndex:10 }}>
        <div style={{ width:34, height:34, borderRadius:'50%', background:user?.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:14, overflow:'hidden' }}>
          {avatarSrc ? <img src={avatarSrc} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : user?.avatar}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ color:'white', fontWeight:600, fontSize:13 }}>@{user?.username}</div>
          <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11 }}>Just now</div>
        </div>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'50%', width:32, height:32, color:'white', cursor:'pointer', fontSize:16 }}>✕</button>
      </div>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#1a1a2e,#16213e)', overflow:'hidden' }}>
        {story?.mediaUrl ? (
          story.mediaType?.startsWith('video') ?
            <video src={story.mediaUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} autoPlay loop muted playsInline /> :
            <img src={story.mediaUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        ) : (
          <div style={{ textAlign:'center', padding:24, background:story?.bgColor||'#ff2d55', width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
            <div style={{ color:'white', fontSize:28, fontWeight:700, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif", textAlign:'center' }}>{story?.text || 'Story content'}</div>
          </div>
        )}
      </div>
      <div style={{ padding:'14px 16px 24px', display:'flex', gap:10 }}>
        <input value={storyReply} onChange={e=>setStoryReply(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendStoryReply()} placeholder="Reply to story..." style={{ flex:1, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:28, padding:'10px 16px', color:'white', outline:'none', fontSize:13 }} />
        <button onClick={sendStoryReply} style={{ background:'#ff2d55', border:'none', borderRadius:'50%', width:42, height:42, color:'white', cursor:'pointer', fontSize:16 }}>↑</button>
      </div>
    </div>
  );
};

/* ─────────────── STORIES BAR ─────────────── */
const Stories = ({ users, currentUser, onViewStory, onCreateStory }) => (
  <div style={{ display:'flex', gap:14, padding:'14px 16px', overflowX:'auto', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, flexShrink:0 }}>
      <button onClick={onCreateStory} style={{ width:62, height:62, borderRadius:'50%', background:'rgba(255,255,255,0.05)', border:'1.5px dashed rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', position:'relative', overflow:'hidden' }}>
        <div style={{ width:56, height:56, borderRadius:'50%', background:currentUser?.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:20, overflow:'hidden' }}>
          {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : currentUser?.avatar}
        </div>
        <div style={{ position:'absolute', bottom:0, right:0, width:20, height:20, background:'#ff2d55', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #0a0a0a', fontSize:12, color:'white', fontWeight:800 }}>+</div>
      </button>
      <span style={{ color:'rgba(255,255,255,0.5)', fontSize:11 }}>Your story</span>
    </div>
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, flexShrink:0 }}>
      <button onClick={() => onViewStory?.({ userId: currentUser?.id, text:`${currentUser?.username}'s story`, bgColor:'#ff2d55' })} style={{ padding:0, background:'none', border:'none', cursor:'pointer' }}>
        <div className="story-avatar-ring" style={{ width:66, height:66, borderRadius:'50%' }}>
          <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:'#0a0a0a', padding:2, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:currentUser?.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:20, overflow:'hidden' }}>
              {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : currentUser?.avatar}
            </div>
          </div>
        </div>
      </button>
      <span style={{ color:'rgba(255,255,255,0.5)', fontSize:11 }}>Me</span>
    </div>
    {users.filter(u => u.id !== currentUser?.id && (currentUser?.following||[]).includes(u.id)).map(u => (
      <div key={u.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, flexShrink:0 }}>
        <button onClick={() => onViewStory?.({ userId:u.id, text:`${u.username}'s story`, bgColor:'#1a1a2e' })} style={{ padding:0, background:'none', border:'none', cursor:'pointer' }}>
          <div className="story-avatar-ring" style={{ width:66, height:66, borderRadius:'50%' }}>
            <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:'#0a0a0a', padding:2, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:u.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:20, overflow:'hidden' }}>
                {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : u.avatar}
              </div>
            </div>
          </div>
        </button>
        <span style={{ color:'rgba(255,255,255,0.5)', fontSize:11 }}>{u.username.split('_')[0]}</span>
      </div>
    ))}
  </div>
);

/* ─────────────── CREATE STORY MODAL ─────────────── */
const CreateStoryModal = ({ currentUser, onClose, showToast }) => {
  const [mode, setMode] = useState(null);
  const [storyText, setStoryText] = useState('');
  const [bgColor, setBgColor] = useState('#ff2d55');
  const [selectedFile, setSelectedFile] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const colors = ['#ff2d55','#af52de','#007aff','#ff9500','#34c759','#00c7be','#ff3b30','#5856d6'];

  const startCamera = async () => {
    try { const s = await navigator.mediaDevices.getUserMedia({video:true}); streamRef.current=s; if(videoRef.current) videoRef.current.srcObject=s; setCameraActive(true); }
    catch { showToast?.('Camera denied','error'); }
  };
  const stopCamera = () => { streamRef.current?.getTracks().forEach(t=>t.stop()); streamRef.current=null; setCameraActive(false); };
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const c = document.createElement('canvas'); c.width=videoRef.current.videoWidth; c.height=videoRef.current.videoHeight;
    c.getContext('2d').drawImage(videoRef.current,0,0);
    c.toBlob(blob=>{setSelectedFile({url:URL.createObjectURL(blob),file:blob,type:'image/jpeg'}); stopCamera(); showToast?.('Photo captured!','success');});
  };
  const startAudio = async () => {
    try { const s = await navigator.mediaDevices.getUserMedia({audio:true}); const r=new MediaRecorder(s); chunksRef.current=[]; r.ondataavailable=e=>chunksRef.current.push(e.data); r.onstop=()=>{const blob=new Blob(chunksRef.current,{type:'audio/webm'}); setAudioBlob(blob); s.getTracks().forEach(t=>t.stop());}; r.start(); recorderRef.current=r; setIsRecording(true); }
    catch { showToast?.('Mic denied','error'); }
  };
  const stopAudio = () => { recorderRef.current?.stop(); setIsRecording(false); };
  useEffect(() => { if (mode==='camera') startCamera(); return ()=>stopCamera(); }, [mode]);

  const handlePost = async () => {
    if(!storyText.trim() && !selectedFile && !audioBlob){
      showToast?.('Add text, photo, or audio first','error');
      return;
    }
    setUploading(true);
    try {
      let mediaUrl = null, mediaType = null;
      if (selectedFile?.file) {
        mediaUrl = await uploadToCloudinary(selectedFile.file, ()=>{});
        mediaType = selectedFile.type;
      } else if (audioBlob) {
        mediaUrl = await uploadToCloudinary(audioBlob, ()=>{});
        mediaType = 'audio/webm';
      }
      await addDoc(collection(db, 'stories'), {
        userId: currentUser.id,
        username: currentUser.username || '',
        avatarColor: currentUser.avatarColor || '#ff2d55',
        avatarUrl: currentUser.avatarUrl || null,
        text: storyText || '',
        bgColor: bgColor || '#ff2d55',
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24*60*60*1000),
      });
      showToast?.('Story posted! ✨','success');
      onClose();
    } catch(e) {
      console.error('Story post error:', e);
      showToast?.(`Story failed: ${e.message}`,'error');
    }
    setUploading(false);
  };

  if (!mode) return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:3500, display:'flex', alignItems:'flex-end' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', background:'#0f0f0f', borderTopLeftRadius:32, borderTopRightRadius:32, padding:'20px 20px 44px', border:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width:36, height:4, background:'rgba(255,255,255,0.15)', borderRadius:2, margin:'0 auto 24px' }} />
        <div style={{ color:'white', fontWeight:800, fontSize:20, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Create Story</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[{id:'camera',icon:'📷',label:'Camera',sub:'Photo or video',color:'#ff2d55'},{id:'file',icon:'🖼️',label:'Gallery',sub:'From device',color:'#af52de'},{id:'text',icon:'✏️',label:'Text',sub:'Write a story',color:'#007aff'},{id:'audio',icon:'🎙️',label:'Audio',sub:'Voice story',color:'#34c759'}].map(opt=>(
            <button key={opt.id} onClick={()=>{if(opt.id==='file') fileInputRef.current?.click(); else setMode(opt.id);}} style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${opt.color}30`, borderRadius:22, padding:'18px 14px', display:'flex', flexDirection:'column', alignItems:'center', gap:8, cursor:'pointer' }}>
              <div style={{ width:52, height:52, borderRadius:'50%', background:opt.color+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 }}>{opt.icon}</div>
              <div style={{ color:'white', fontWeight:700, fontSize:14, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{opt.label}</div>
              <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11 }}>{opt.sub}</div>
            </button>
          ))}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={e=>{const f=e.target.files[0]; if(f){setSelectedFile({url:URL.createObjectURL(f),file:f,type:f.type}); setMode('file');}}} style={{display:'none'}} />
      </div>
    </div>
  );
  return (
    <div style={{ position:'fixed', inset:0, background:'#000', zIndex:3500, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <button onClick={()=>{stopCamera(); onClose();}} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:20, padding:'8px 16px', color:'white', cursor:'pointer', fontSize:13 }}>Cancel</button>
        <span style={{ color:'white', fontWeight:700, fontSize:15, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Story</span>
        <button onClick={handlePost} disabled={uploading} style={{ background:'linear-gradient(135deg,#ff2d55,#af52de)', border:'none', borderRadius:20, padding:'8px 16px', color:'white', fontWeight:700, cursor:'pointer', fontSize:13, opacity:uploading?0.6:1 }}>{uploading?'Posting...':'Post'}</button>
      </div>
      <div style={{ flex:1, position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {mode==='camera' && (
          <div style={{ width:'100%', height:'100%', position:'relative' }}>
            <video ref={videoRef} autoPlay playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            <button onClick={capturePhoto} style={{ position:'absolute', bottom:30, left:'50%', transform:'translateX(-50%)', background:'white', border:'4px solid rgba(255,255,255,0.4)', borderRadius:'50%', width:72, height:72, cursor:'pointer', fontSize:28 }}>📸</button>
          </div>
        )}
        {mode==='text' && (
          <div style={{ width:'100%', height:'100%', background:bgColor, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
            <textarea value={storyText} onChange={e=>setStoryText(e.target.value)} placeholder="Write something..." style={{ background:'transparent', border:'none', outline:'none', color:'white', fontSize:28, fontWeight:700, textAlign:'center', width:'100%', resize:'none', caretColor:'white', fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }} rows={4} autoFocus />
            <div style={{ position:'absolute', bottom:28, display:'flex', gap:10 }}>
              {colors.map(c=><div key={c} onClick={()=>setBgColor(c)} style={{ width:30, height:30, borderRadius:'50%', background:c, border:c===bgColor?'3px solid white':'3px solid transparent', cursor:'pointer' }} />)}
            </div>
          </div>
        )}
        {mode==='audio' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:24, padding:40 }}>
            <div style={{ fontSize:80 }}>🎙️</div>
            {audioBlob ? (
              <><audio src={URL.createObjectURL(audioBlob)} controls style={{ width:'100%' }} /><button onClick={()=>setAudioBlob(null)} style={{ background:'#333', border:'none', borderRadius:20, padding:'10px 20px', color:'white', cursor:'pointer' }}>Re-record</button></>
            ) : (
              <button onMouseDown={startAudio} onMouseUp={stopAudio} onTouchStart={startAudio} onTouchEnd={stopAudio} style={{ background:isRecording?'#ff2d55':'#333', border:'none', borderRadius:'50%', width:90, height:90, fontSize:36, cursor:'pointer' }}>{isRecording?'⏹':'🎙️'}</button>
            )}
            <p style={{ color:'#888', fontSize:13 }}>{isRecording?'Recording... release to stop':'Hold to record'}</p>
          </div>
        )}
        {mode==='file' && selectedFile && (
          selectedFile.type.startsWith('video/') ? <video src={selectedFile.url} style={{ width:'100%', height:'100%', objectFit:'cover' }} controls /> : <img src={selectedFile.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        )}
      </div>
    </div>
  );
};

/* ─────────────── USER PROFILE MODAL ─────────────── */
const UserProfileModal = ({ user, currentUser, onClose, onFollow, onMessage, onVoiceCall, onVideoCall, followed, showToast, userVideos }) => {
  const isFollowing = followed?.includes(user?.id);
  const isOwn = user?.id === currentUser?.id;
  const [tab, setTab] = useState('posts');
  const mockVideos = userVideos || [];
  const avatarSrc = user?.avatarUrl;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:3000, display:'flex', alignItems:'flex-end' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', background:'#0d0d0d', borderTopLeftRadius:32, borderTopRightRadius:32, maxHeight:'94vh', overflowY:'auto', border:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width:36, height:4, background:'rgba(255,255,255,0.12)', borderRadius:2, margin:'16px auto 0' }} />
        <div style={{ display:'flex', justifyContent:'flex-end', padding:'10px 16px 0' }}>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:'50%', width:34, height:34, color:'white', cursor:'pointer', fontSize:16 }}>✕</button>
        </div>
        <div style={{ textAlign:'center', padding:'4px 20px 20px' }}>
          <div style={{ width:90, height:90, borderRadius:'50%', padding:2.5, margin:'0 auto 14px', background:'conic-gradient(#ff2d55,#ff9500,#af52de,#ff2d55)' }}>
            <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:'#0d0d0d', padding:2 }}>
              <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:user?.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:32, overflow:'hidden' }}>
                {avatarSrc ? <img src={avatarSrc} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : user?.avatar}
              </div>
            </div>
          </div>
          <div style={{ color:'white', fontWeight:800, fontSize:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>@{user?.username}</div>
          {user?.verified && <div style={{ display:'inline-flex', alignItems:'center', gap:4, color:'#1d9bf0', fontSize:12, marginTop:4, background:'rgba(29,155,240,0.1)', borderRadius:20, padding:'3px 10px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#1d9bf0"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Verified
          </div>}
          <div style={{ color:'rgba(255,255,255,0.55)', fontSize:13, marginTop:8, lineHeight:1.5 }}>{user?.bio}</div>
          <div style={{ display:'flex', justifyContent:'center', gap:0, marginTop:18, background:'rgba(255,255,255,0.03)', borderRadius:20, padding:'14px 0', border:'1px solid rgba(255,255,255,0.06)' }}>
            {[['Posts', mockVideos.length], ['Followers', user?.followers?.length||0], ['Following', user?.following?.length||0]].map(([label,val],i)=>(
              <div key={label} style={{ flex:1, textAlign:'center', borderRight:i<2?'1px solid rgba(255,255,255,0.08)':'' }}>
                <div style={{ color:'white', fontWeight:800, fontSize:18, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{formatNumber(val)}</div>
                <div style={{ color:'rgba(255,255,255,0.4)', fontSize:11, marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        {!isOwn && (
          <div style={{ display:'flex', gap:8, padding:'0 16px 16px' }}>
            <button onClick={()=>{onFollow?.(user.id); onClose();}}
              style={{ flex:1, background:isFollowing?'rgba(255,255,255,0.06)':'linear-gradient(135deg,#ff2d55,#af52de)', border:isFollowing?'1px solid rgba(255,45,85,0.4)':'none', borderRadius:14, padding:'12px', color:isFollowing?'#ff2d55':'white', fontWeight:700, cursor:'pointer', fontSize:14, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>
              {isFollowing ? 'Following' : '+ Follow'}
            </button>
            <button onClick={()=>{onMessage?.(user.id); onClose();}} style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'12px', color:'white', fontWeight:600, cursor:'pointer', fontSize:14 }}>Message</button>
            <button onClick={()=>{onVoiceCall?.(user.id); onClose();}} style={{ background:'rgba(52,199,89,0.12)', border:'1px solid rgba(52,199,89,0.2)', borderRadius:14, padding:'12px 14px', color:'#34c759', cursor:'pointer', fontSize:18 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
            </button>
            <button onClick={()=>{onVideoCall?.(user.id); onClose();}} style={{ background:'rgba(175,82,222,0.12)', border:'1px solid rgba(175,82,222,0.2)', borderRadius:14, padding:'12px 14px', color:'#af52de', cursor:'pointer', fontSize:18 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#af52de" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
            </button>
          </div>
        )}
        <div style={{ display:'flex', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          {[{id:'posts',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>},{id:'saved',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>},{id:'drafts',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, background:'none', border:'none', borderTop:tab===t.id?'2px solid #ff2d55':'2px solid transparent', padding:'14px 0', color:tab===t.id?'white':'rgba(255,255,255,0.3)', cursor:'pointer', display:'flex', justifyContent:'center' }}>{t.icon}</button>
          ))}
        </div>
        <div style={{ padding:2 }}>
          {tab==='posts' && (
            mockVideos.length===0 ? (
              <div style={{ textAlign:'center', padding:48, color:'rgba(255,255,255,0.25)' }}>
                <div style={{ fontSize:40, marginBottom:10 }}>🎬</div>
                <div style={{ fontSize:14 }}>No posts yet</div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2 }}>
                {mockVideos.map(v=>(
                  <div key={v.id} style={{ aspectRatio:'9/16', background:'#1a1a1a', position:'relative', overflow:'hidden' }}>
                    {v.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i) ?
  <img src={v.videoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> :
  <video src={v.videoUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
}
                    <div style={{ position:'absolute', bottom:4, left:6, color:'white', fontSize:10, fontWeight:700, background:'rgba(0,0,0,0.6)', borderRadius:6, padding:'2px 6px' }}>{formatNumber(v.views)}</div>
                  </div>
                ))}
              </div>
            )
          )}
          {tab==='saved' && <div style={{ textAlign:'center', padding:48, color:'rgba(255,255,255,0.25)' }}><div style={{ fontSize:40, marginBottom:10 }}>🔖</div><div>No saved posts</div></div>}
          {tab==='drafts' && <div style={{ textAlign:'center', padding:48, color:'rgba(255,255,255,0.25)' }}><div style={{ fontSize:40, marginBottom:10 }}>📝</div><div>No drafts</div></div>}
        </div>
        <div style={{ height:30 }} />
      </div>
    </div>
  );
};

/* ─────────────── LIVE STREAM ─────────────── */
const LiveStream = ({ streamer, onClose, showToast, currentUser }) => {
  const [viewers, setViewers] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState('');
  const chatRef = useRef(null);
  const liveRef = useRef(null);

  useEffect(()=>{
    // Create live session in Firestore
    const createLive = async () => {
      const ref = await addDoc(collection(db, 'liveStreams'), {
        streamerId: streamer?.id,
        streamerUsername: streamer?.username,
        viewers: 0,
        createdAt: serverTimestamp(),
        active: true,
      });
      liveRef.current = ref.id;
    };
    createLive();

    // Real viewer count from Firestore
    let unsubLive = ()=>{};
    const waitForLive = setInterval(()=>{
      if(!liveRef.current) return;
      clearInterval(waitForLive);
      updateDoc(doc(db,'liveStreams',liveRef.current),{ viewers: increment(1) }).catch(()=>{});
      unsubLive = onSnapshot(doc(db,'liveStreams',liveRef.current), snap=>{
        if(snap.exists()) setViewers(snap.data().viewers||0);
      });
    },300);
    return ()=>{
      unsubLive();
      clearInterval(waitForLive);
      if(liveRef.current) updateDoc(doc(db,'liveStreams',liveRef.current),{ active:false, viewers: increment(-1) }).catch(()=>{});
    };
  },[streamer]);

  useEffect(()=>{},[streamer]);

  useEffect(()=>{
    if(!liveRef.current) return;
    const q = query(collection(db,'liveMessages'), where('liveId','==',liveRef.current), orderBy('createdAt','asc'));
    const unsub = onSnapshot(q, snap=>{
      const msgs = snap.docs.map(d=>({id:d.id,...d.data()}));
      setChatMessages(msgs.slice(-20));
    });
    return ()=>unsub();
  },[liveRef.current]);

  const sendMessage = async () => {
    if(!message.trim()||!liveRef.current) return;
    await addDoc(collection(db,'liveMessages'),{
      liveId: liveRef.current,
      user: currentUser?.username||'viewer',
      text: message,
      createdAt: serverTimestamp(),
    });
    setMessage('');
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'linear-gradient(160deg,#0d0025,#160d00)', zIndex:2000, display:'flex', flexDirection:'column' }}>
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 30% 40%,rgba(255,45,85,0.15),transparent 60%)' }} />
      <div style={{ padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', zIndex:10 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ background:'#ff2d55', borderRadius:20, padding:'4px 12px', display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'white', animation:'pulse 1s infinite' }} />
            <span style={{ color:'white', fontSize:13, fontWeight:700 }}>LIVE</span>
          </div>
          <div style={{ background:'rgba(0,0,0,0.4)', borderRadius:20, padding:'4px 12px', display:'flex', alignItems:'center', gap:5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span style={{ color:'rgba(255,255,255,0.7)', fontSize:12 }}>{formatNumber(viewers)}</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'50%', width:36, height:36, color:'white', cursor:'pointer', fontSize:16 }}>✕</button>
      </div>
      <div style={{ flex:1, display:'flex', alignItems:'flex-end', padding:'0 14px 10px', zIndex:10 }}>
        <div style={{ flex:1, maxHeight:200, overflowY:'hidden', display:'flex', flexDirection:'column', gap:6 }}>
          {chatMessages.slice(-8).map(m=>(
            <div key={m.id} style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(10px)', borderRadius:20, padding:'6px 12px', display:'inline-flex', gap:7, maxWidth:'85%', alignSelf:'flex-start' }}>
              <span style={{ color:'#ff2d55', fontSize:11, fontWeight:700 }}>@{m.user}</span>
              <span style={{ color:'white', fontSize:11 }}>{m.text}</span>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14, alignItems:'center', marginLeft:12 }}>
          {[['❤️',0],['🎁',1],['👍',2]].map(([icon,i])=>(
            <button key={i} onClick={()=>showToast?.('Gift sent! 🎁','success')} style={{ background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'50%', width:44, height:44, fontSize:22, cursor:'pointer' }}>{icon}</button>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', gap:10, padding:'10px 14px 28px', borderTop:'1px solid rgba(255,255,255,0.06)', zIndex:10 }}>
        <input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()} placeholder="Say something..." style={{ flex:1, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:28, padding:'10px 16px', color:'white', outline:'none', fontSize:13 }} />
        <button onClick={sendMessage} style={{ background:'linear-gradient(135deg,#ff2d55,#af52de)', border:'none', borderRadius:'50%', width:42, height:42, color:'white', cursor:'pointer', fontSize:16 }}>↑</button>
      </div>
    </div>
  );
};
const sendNotification = async (toUserId, fromUserId, type, message, extraData={}) => {
  if(toUserId === fromUserId) return;
  await addDoc(collection(db,'notifications'),{
    toUserId, fromUserId, type, message,
    read: false, createdAt: serverTimestamp(), ...extraData,
  });
};
/* ─────────────── COMMENT ITEM ─────────────── */
const CommentItem = ({ comment, currentUser, onLike, onReply, onPin, onViewProfile }) => {
  const isMine = comment.userId === currentUser?.id;
  return (
    <div style={{ display:'flex', justifyContent:isMine?'flex-end':'flex-start', alignItems:'flex-end', gap:8, marginBottom:12 }}>
      {!isMine && (
        <div onClick={()=>onViewProfile?.(comment.userId)} style={{ width:28, height:28, borderRadius:'50%', background:comment.avatarColor||'#333', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:11, flexShrink:0, overflow:'hidden', cursor:'pointer' }}>
          {comment.avatarUrl ? <img src={comment.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (comment.avatar||'U')}
        </div>
      )}
      <div style={{ maxWidth:'72%' }}>
        {!isMine && (
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
            <span onClick={()=>onViewProfile?.(comment.userId)} style={{ color:'rgba(255,255,255,0.6)', fontWeight:700, fontSize:11, cursor:'pointer' }}>@{comment.username}</span>
                        <span style={{ color:'rgba(255,255,255,0.28)',fontSize:10 }}>{comment.time||'just now'}</span>
          </div>
        )}
        <div style={{ background:isMine?'linear-gradient(135deg,#ff2d55,#af52de)':'rgba(255,255,255,0.09)', borderRadius:isMine?'20px 20px 4px 20px':'20px 20px 20px 4px', padding:'10px 14px' }}>
          {comment.mediaUrl && comment.mediaType?.startsWith('image') && <img src={comment.mediaUrl} alt="" style={{ maxWidth:'100%', borderRadius:10, display:'block', marginBottom:comment.text?6:0 }} />}
          {comment.mediaUrl && comment.mediaType?.startsWith('video') && <video src={comment.mediaUrl} controls style={{ maxWidth:'100%', borderRadius:10, display:'block', marginBottom:comment.text?6:0 }} />}
          {comment.mediaUrl && comment.mediaType?.startsWith('audio') && <audio src={comment.mediaUrl} controls style={{ width:'100%', marginBottom:comment.text?4:0 }} />}
          {comment.text && <span style={{ color:'white', fontSize:13, lineHeight:1.4 }}>{comment.text}</span>}
        </div>
        <div style={{ display:'flex', gap:10, marginTop:4, justifyContent:isMine?'flex-end':'flex-start' }}>
          <button onClick={()=>onLike?.(comment.id)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.35)', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            {comment.likes||0}
          </button>
          <button onClick={()=>onReply?.(comment)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.35)', fontSize:11, cursor:'pointer' }}>Reply</button>
          <button onClick={()=>onPin?.(comment.id)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.25)', fontSize:10, cursor:'pointer' }}>Pin</button>
        </div>
      </div>
      {isMine && (
        <div style={{ width:28, height:28, borderRadius:'50%', background:currentUser?.avatarColor||'#ff2d55', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:11, flexShrink:0, overflow:'hidden' }}>
          {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (currentUser?.avatar||'U')}
        </div>
      )}
    </div>
  );
};
const CommentInputBar = ({ currentUser, commentText, setCommentText, onSend, showToast, videoId }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = e => chunksRef.current.push(e.data);
      rec.onstop = () => { setAudioBlob(new Blob(chunksRef.current,{type:'audio/webm'})); stream.getTracks().forEach(t=>t.stop()); };
      rec.start(); recorderRef.current = rec; setIsRecording(true); setRecordSecs(0);
      timerRef.current = setInterval(()=>setRecordSecs(s=>s+1),1000);
    } catch { showToast?.('Mic access denied','error'); }
  };
  const stopVoice = () => { recorderRef.current?.stop(); setIsRecording(false); clearInterval(timerRef.current); };
  const pickFile = e => { const f=e.target.files[0]; if(f){setPreviewFile({url:URL.createObjectURL(f),file:f,type:f.type}); e.target.value='';} };
  const clearAttach = () => { setAudioBlob(null); setPreviewFile(null); };
  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  const handleSend = async () => {
    let mediaUrl=null, mediaType=null;
    if(previewFile?.file){ try{ mediaUrl=await uploadToCloudinary(previewFile.file); mediaType=previewFile.type; }catch{ showToast?.('Upload failed','error'); return; } }
    else if(audioBlob){ try{ mediaUrl=await uploadToCloudinary(audioBlob); mediaType='audio/webm'; }catch{ showToast?.('Upload failed','error'); return; } }
    if(!commentText.trim()&&!mediaUrl) return;
    const commentRef = await addDoc(collection(db,'comments'),{ videoId, userId:currentUser.id, username:currentUser.username, avatar:currentUser.avatar||(currentUser.username||'U')[0].toUpperCase(), avatarColor:currentUser.avatarColor||'#ff2d55', avatarUrl:currentUser.avatarUrl||null, text:commentText, mediaUrl, mediaType, likes:0, createdAt:serverTimestamp() });
    await updateDoc(doc(db,'videos',videoId),{comments:increment(1)});
    const parentVideo = (await getDoc(doc(db,'videos',videoId))).data();
    if(parentVideo?.userId) await sendNotification(parentVideo.userId, currentUser.id, 'comment', `commented: "${commentText.substring(0,40)}"`, {videoId});
    setCommentText(''); clearAttach();
  };

  return (
    <div style={{padding:'10px 14px 24px',borderTop:'1px solid rgba(255,255,255,0.06)',background:'#0a0a0a'}}>
      {(previewFile||audioBlob)&&(
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,background:'rgba(255,255,255,0.05)',borderRadius:14,padding:'8px 12px'}}>
          {previewFile?.type?.startsWith('image')&&<img src={previewFile.url} alt="" style={{height:44,width:44,objectFit:'cover',borderRadius:8}}/>}
          {previewFile?.type?.startsWith('video')&&<video src={previewFile.url} style={{height:44,width:60,objectFit:'cover',borderRadius:8}}/>}
          {audioBlob&&!previewFile&&<audio src={URL.createObjectURL(audioBlob)} controls style={{height:28,flex:1}}/>}
          <button onClick={clearAttach} style={{marginLeft:'auto',background:'rgba(255,45,85,0.2)',border:'none',borderRadius:'50%',width:22,height:22,color:'#ff2d55',cursor:'pointer',fontSize:13}}>✕</button>
        </div>
      )}
      {showEmoji && (
        <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:'10px 12px',background:'rgba(255,255,255,0.04)',borderRadius:16,marginBottom:8}}>
          {EMOJI_LIST.map(e=>(
            <button key={e} onClick={()=>setCommentText(t=>t+e)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',padding:2}}>{e}</button>
          ))}
        </div>
      )}
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
     <div style={{width:34,height:34,borderRadius:'50%',background:currentUser?.avatarColor,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'bold',fontSize:14,flexShrink:0,overflow:'hidden'}}>          {currentUser?.avatarUrl?<img src={currentUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:currentUser?.avatar}
        </div>
        <input value={commentText} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSend()} placeholder={isRecording?`🔴 ${fmt(recordSecs)}`:'Add a comment...'} style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:28,padding:'10px 14px',color:'white',outline:'none',fontSize:13}}/>
        <button onClick={()=>fileInputRef.current?.click()} style={{background:'rgba(255,255,255,0.07)',border:'none',borderRadius:'50%',width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" onChange={pickFile} style={{display:'none'}}/>
        <button onMouseDown={startVoice} onMouseUp={stopVoice} onTouchStart={startVoice} onTouchEnd={stopVoice} style={{background:isRecording?'rgba(255,45,85,0.9)':'rgba(255,255,255,0.07)',border:'none',borderRadius:'50%',width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,boxShadow:isRecording?'0 0 10px rgba(255,45,85,0.6)':'none'}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isRecording?'white':'rgba(255,255,255,0.6)'} strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </button>
        <button onClick={()=>setShowEmoji(v=>!v)} style={{background:'rgba(255,255,255,0.07)',border:'none',borderRadius:'50%',width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,fontSize:18}}>😊</button>
        <button onClick={handleSend} style={{background:'linear-gradient(135deg,#ff2d55,#af52de)',border:'none',borderRadius:'50%',width:36,height:36,color:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
};
/* ─────────────── ENHANCED VIDEO CARD ─────────────── */
const EnhancedVideoCard = memo(({ video, currentUser, isActive, onLike, onComment, onShare, onFollow, onMessage, onVoiceCall, onVideoCall, onDuet, onStitch, onSaveSound, followed, showToast, onViewProfile }) => {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video?.likes||0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [pinnedComment, setPinnedComment] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const tapTimer = useRef(null);
  const videoRef = useRef(null);

  useEffect(()=>()=>{ if(tapTimer.current) clearTimeout(tapTimer.current); },[]);

  // Load real likes state + comments from Firestore
  useEffect(()=>{
    if(!video?.id || !currentUser?.id) return;
    // Check if current user liked this video
    getDoc(doc(db,'likes',`${video.id}_${currentUser.id}`)).then(snap=>{
      if(snap.exists()) setLiked(true);
    }).catch(()=>{});
    // Count this as a view (once per mount)
    updateDoc(doc(db,'videos',video.id),{ views: increment(1) }).catch(()=>{});
    // Real-time comments
    const q = query(collection(db,'comments'), where('videoId','==',video.id), orderBy('createdAt','asc'));
    const unsub = onSnapshot(q, snap=>{
      setComments(snap.docs.map(d=>({id:d.id,...d.data(),time:d.data().createdAt?.toDate?.()?timeAgo(d.data().createdAt.toDate()):'now'})));
    }, (error)=>{
      console.error('Comments index error:', error);
      // Fallback: fetch without orderBy if index missing
      const q2 = query(collection(db,'comments'), where('videoId','==',video.id));
      onSnapshot(q2, snap2=>{
        const sorted = snap2.docs
          .map(d=>({id:d.id,...d.data(),time:d.data().createdAt?.toDate?.()?timeAgo(d.data().createdAt.toDate()):'now'}))
          .sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
        setComments(sorted);
      });
    });
    return ()=>unsub();
  },[video?.id, currentUser?.id]);

  const timeAgo = (date) => {
    const s = Math.floor((new Date()-date)/1000);
    if(s<60) return `${s}s ago`;
    if(s<3600) return `${Math.floor(s/60)}m ago`;
    if(s<86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  };

  const handleDoubleTap = async () => {
    if(!liked){
      setLiked(true);
      setLikeCount(p=>p+1);
      setHeartAnim(true);
      setTimeout(()=>setHeartAnim(false),900);
      // Persist like
      await setDoc(doc(db,'likes',`${video.id}_${currentUser.id}`),{ videoId:video.id, userId:currentUser.id, createdAt:serverTimestamp() });
      await updateDoc(doc(db,'videos',video.id),{ likes:increment(1) });
    }
  };

  const handleTap = (e) => {
    if(tapTimer.current){
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      handleDoubleTap();
    } else {
      tapTimer.current = setTimeout(()=>{
        tapTimer.current = null;
        const isImagePost = video?.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i) || video?.mediaType?.startsWith('image');
        if(isImagePost){
          setIsPlaying(p => !p);
        } else if(videoRef.current){
          if(isPlaying){ videoRef.current.pause(); setIsPlaying(false); }
          else { videoRef.current.play(); setIsPlaying(true); }
        }
      }, 280);
    }
  };

  const handleLike = async () => {
    if(!liked){
      setLiked(true);
      setLikeCount(p=>p+1);
      await setDoc(doc(db,'likes',`${video.id}_${currentUser.id}`),{ videoId:video.id, userId:currentUser.id, createdAt:serverTimestamp() });
      await updateDoc(doc(db,'videos',video.id),{ likes:increment(1) });
      await sendNotification(video.userId, currentUser.id, 'like', 'liked your post', {videoId:video.id});
    } else {
      setLiked(false);
      setLikeCount(p=>Math.max(0,p-1));
      await deleteDoc(doc(db,'likes',`${video.id}_${currentUser.id}`));
      await updateDoc(doc(db,'videos',video.id),{ likes:increment(-1) });
    }
  };

  const addComment = async () => {
    if(!commentText.trim()) return;
    const txt = commentText;
    setCommentText('');
    await addDoc(collection(db,'comments'),{
      videoId: video.id,
      userId: currentUser.id,
      username: currentUser.username,
     avatar: currentUser.avatar || (currentUser.username||'U')[0].toUpperCase(),
      avatarColor: currentUser.avatarColor || '#ff2d55',
      avatarUrl: currentUser.avatarUrl||null,
      text: txt,
      likes: 0,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db,'videos',video.id),{ comments:increment(1) });
  };

  const reportReasons = ['Spam','Inappropriate content','Hate speech','Misinformation','Copyright violation','Other'];

  return (
    <div style={{ position:'absolute', inset:0, background:'#000' }} onClick={handleTap}>
      {video?.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i) || video?.mediaType?.startsWith('image') ?
        <img src={video.videoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> :
        <video ref={videoRef} src={video?.videoUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} loop muted autoPlay playsInline />
      }
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.1) 40%,rgba(0,0,0,0.3) 100%)' }} />
      
      {!isPlaying && (video?.videoUrl && !video.videoUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)) && !video?.mediaType?.startsWith('image') && <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:15,pointerEvents:'none'}}><div style={{width:72,height:72,borderRadius:'50%',background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="32" height="32" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg></div></div>}
      {heartAnim && (
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:50, pointerEvents:'none' }}>
          <div style={{ fontSize:80, animation:'heartBurst 0.9s ease forwards' }}>❤️</div>
        </div>
      )}
      <div style={{ position:'absolute', bottom:90, left:14, right:70, zIndex:5 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <button onClick={()=>onViewProfile?.(video.userId)} style={{ position:'relative', background:'none', border:'none', cursor:'pointer', padding:0 }}>
            <div style={{ width:42, height:42, borderRadius:'50%', background:video.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:16, border:'2px solid rgba(255,255,255,0.5)', overflow:'hidden' }}>
              {video.avatarUrl ? <img src={video.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : video.avatar}
            </div>
            {video.verified && <div style={{ position:'absolute', bottom:-2, right:-2, width:14, height:14, background:'#1d9bf0', borderRadius:'50%', fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>✓</div>}
          </button>
          <span onClick={()=>onViewProfile?.(video.userId)} style={{ color:'white', fontWeight:700, fontSize:15, cursor:'pointer', fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>@{video.username}</span>
          <button onClick={()=>onFollow?.(video.userId)} style={{ padding:'5px 14px', borderRadius:20, background:followed?.includes(video.userId)?'rgba(255,255,255,0.08)':'rgba(255,45,85,0.9)', border:followed?.includes(video.userId)?'1px solid rgba(255,255,255,0.4)':'none', color:'white', fontSize:12, fontWeight:700, cursor:'pointer', backdropFilter:'blur(4px)' }}>{followed?.includes(video.userId)?'Unfollow':'+ Follow'}</button>
          <button onClick={()=>setShowActionMenu(!showActionMenu)} style={{ background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'50%', width:30, height:30, color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
        </div>
        <p style={{ color:'rgba(255,255,255,0.9)', fontSize:13, marginBottom:6, lineHeight:1.5 }}>{video.description}</p>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:22, height:22, borderRadius:'50%', background:'linear-gradient(135deg,#ff2d55,#af52de)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>♪</div>
          <span style={{ color:'rgba(255,255,255,0.65)', fontSize:12 }}>{video.song}</span>
          <button onClick={()=>onSaveSound?.()} style={{ marginLeft:8, background:'rgba(255,255,255,0.1)', border:'none', borderRadius:10, padding:'3px 8px', color:'rgba(255,255,255,0.7)', fontSize:10, cursor:'pointer', backdropFilter:'blur(8px)' }}>Save</button>
        </div>
      </div>

      {showActionMenu && (
        <div onClick={()=>setShowActionMenu(false)} style={{ position:'absolute', inset:0, zIndex:19 }}>
          <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', bottom:160, left:14, background:'rgba(18,18,18,0.97)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:22, padding:6, zIndex:20, minWidth:210, animation:'popIn 0.2s ease' }}>
            {[
              {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>, label:'Duet', fn:()=>onDuet?.(video.id)},
              {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M15 14l5-5-5-5"/><path d="M4 20v-7a4 4 0 014-4h12"/></svg>, label:'Stitch', fn:()=>onStitch?.(video.id)},
              {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>, label:'Message', fn:()=>onMessage?.(video.userId)},
              {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-5.99-5.99 19.79 19.79 0 01-3.07-8.67A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>, label:'Voice Call', fn:()=>onVoiceCall?.(video.userId)},
              {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>, label:'Video Call', fn:()=>onVideoCall?.(video.userId)},
              {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff9500" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, label:'Report', fn:()=>{ setShowReportModal(true); setShowActionMenu(false); }},
             {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff2d55" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>, label:'Block', fn:async()=>{ await updateDoc(doc(db,'users',currentUser.id),{ blockedUsers: arrayUnion(video.userId) }); showToast?.('User blocked','warning'); }},
            ].map(({icon,label,fn})=>(
              <button key={label} onClick={()=>{fn(); setShowActionMenu(false);}} style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'11px 14px', background:'none', border:'none', color:label==='Block'?'#ff2d55':label==='Report'?'#ff9500':'white', cursor:'pointer', borderRadius:16, fontSize:14, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>
                <span>{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showReportModal && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.9)', zIndex:50, display:'flex', alignItems:'flex-end' }} onClick={()=>setShowReportModal(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ width:'100%', background:'#111', borderTopLeftRadius:28, borderTopRightRadius:28, padding:'20px 20px 40px', animation:'slideUp 0.3s ease' }}>
            <div style={{ width:36, height:4, background:'rgba(255,255,255,0.12)', borderRadius:2, margin:'0 auto 20px' }} />
            <div style={{ color:'white', fontWeight:800, fontSize:18, marginBottom:4, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Report Post</div>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:13, marginBottom:16 }}>Why are you reporting this?</div>
            {reportReasons.map(r=>(
              <button key={r} onClick={async ()=>{
                await addDoc(collection(db,'reports'),{ videoId:video.id, userId:currentUser?.id, reason:r, createdAt:serverTimestamp() });
                showToast?.('Report submitted','success'); setShowReportModal(false);
              }} style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14, padding:'14px 16px', color:'white', textAlign:'left', cursor:'pointer', marginBottom:8, fontSize:14, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{r}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ position:'absolute', right:12, bottom:90, display:'flex', flexDirection:'column', alignItems:'center', gap:6, zIndex:6 }}>
        <button onClick={handleLike} style={{ background:'rgba(0,0,0,0.3)', border:'none', borderRadius:'50%', width:48, height:48, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill={liked?'#ff2d55':'none'} stroke={liked?'#ff2d55':'rgba(255,255,255,0.9)'} strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        </button>
        <span style={{ color:'rgba(255,255,255,0.85)', fontSize:11, fontWeight:600, letterSpacing:0.2 }}>{formatNumber(likeCount)}</span>
        <button onClick={()=>setShowComments(true)} style={{ background:'rgba(0,0,0,0.3)', border:'none', borderRadius:'50%', width:48, height:48, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', marginTop:4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        </button>
        <span style={{ color:'rgba(255,255,255,0.85)', fontSize:11, fontWeight:600 }}>{formatNumber(video.comments||comments.length)}</span>
        <button onClick={()=>setShowShare(true)} style={{ background:'rgba(0,0,0,0.3)', border:'none', borderRadius:'50%', width:48, height:48, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', marginTop:4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
        <span style={{ color:'rgba(255,255,255,0.85)', fontSize:11, fontWeight:600 }}>{formatNumber(video.shares||0)}</span>
      </div>

      {showComments && (
  <div
    onClick={e => e.stopPropagation()}
    onTouchStart={e => e.stopPropagation()}
    onTouchEnd={e => e.stopPropagation()}
    style={{ position:'fixed', top:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:430, height:'100%', background:'#0a0a0a', zIndex:9000, display:'flex', flexDirection:'column', animation:'slideUp 0.3s ease' }}>
          <div style={{ padding:'16px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:'white', fontWeight:700, fontSize:16, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Comments</span>
            <button onClick={()=>setShowComments(false)} style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:'50%', width:32, height:32, color:'white', cursor:'pointer', fontSize:16 }}>✕</button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'14px 16px' }}>
            {pinnedComment && (
              <div style={{ background:'rgba(255,45,85,0.08)', borderRadius:14, padding:'10px 12px', marginBottom:16, border:'1px solid rgba(255,45,85,0.2)' }}>
                <div style={{ color:'#ff2d55', fontSize:11, fontWeight:700, marginBottom:8 }}>📌 Pinned</div>
                <CommentItem comment={pinnedComment} currentUser={currentUser} onLike={()=>{}} onReply={()=>{}} onPin={()=>{}} />
              </div>
            )}
            {comments.length===0 && <div style={{textAlign:'center',padding:40,color:'rgba(255,255,255,0.3)',fontSize:13}}>No comments yet. Be the first! 💬</div>}
            {comments.map(comment=>(
              <CommentItem key={comment.id} comment={comment} currentUser={currentUser} onLike={async id=>{await updateDoc(doc(db,'comments',id),{likes:increment(1)});}} onReply={(c)=>setCommentText(`@${c.username} `)} onPin={id=>{const c=comments.find(cc=>cc.id===id); if(c){setPinnedComment(c); showToast?.('Pinned!','success');}}} onViewProfile={onViewProfile} />
            ))}
          </div>
          <CommentInputBar currentUser={currentUser} commentText={commentText} setCommentText={setCommentText} onSend={addComment} showToast={showToast} videoId={video.id} />
        </div>
      )}
      {showShare && <ShareModal video={video} onClose={()=>setShowShare(false)} showToast={showToast} />}
    </div>
  );
});

/* ─────────────── HOME FEED ─────────────── */
const HomeFeed = ({ videos, onLike, onComment, onShare, onFollow, onMessage, onVoiceCall, onVideoCall, onDuet, onStitch, onSaveSound, followed, showToast, onLive, currentUser, onViewProfile, onOpenSearch, onOpenNotifications }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState('foryou');
  const filteredVideos = useMemo(()=>{
    if(activeCategory==='foryou') return videos;
    return videos.filter(v=>v.category===activeCategory);
  },[videos, activeCategory]);
  const startY = useRef(null);
  const handleTouchStart = e => { startY.current=e.touches[0].clientY; };
  const handleTouchEnd = e => {
    if(startY.current===null) return;
    const dy=startY.current-e.changedTouches[0].clientY;
    if(Math.abs(dy)>50){if(dy>0) setCurrentIndex(i=>Math.min(filteredVideos.length-1,i+1)); else setCurrentIndex(i=>Math.max(0,i-1));}
    startY.current=null;
  };
  if(!filteredVideos.length) return <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}><div style={{ fontSize:48 }}>📭</div><div style={{ color:'rgba(255,255,255,0.3)' }}>No videos yet. Be the first to post!</div></div>;
  return (
    <div style={{ height:'100%', position:'relative', overflow:'hidden' }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:15, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px 0' }}>
        <div style={{ flex:1, display:'flex', justifyContent:'center', gap:24 }}>
          {TOP_CATEGORIES.map(cat=>(
            <button key={cat.id} onClick={()=>{setActiveCategory(cat.id); setCurrentIndex(0);}} style={{ background:'none', border:'none', color:activeCategory===cat.id?'white':'rgba(255,255,255,0.45)', fontWeight:activeCategory===cat.id?800:500, fontSize:15, cursor:'pointer', paddingBottom:6, borderBottom:activeCategory===cat.id?'2.5px solid white':'2.5px solid transparent', fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif", transition:'all 0.2s' }}>
              {cat.label}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <button onClick={onOpenSearch} style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'50%', width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <button onClick={onOpenNotifications} style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'50%', width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', position:'relative' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            <div style={{ position:'absolute', top:8, right:8, width:8, height:8, background:'#ff2d55', borderRadius:'50%', border:'1.5px solid #000' }} />
          </button>
        </div>
      </div>
      {filteredVideos.map((video,idx)=>(
  <div key={video.id} style={{ position:'absolute', inset:0, opacity:idx===currentIndex?1:0, translate:`0 ${(idx-currentIndex)*100}%`, transition:'translate 0.3s cubic-bezier(0.25,0.46,0.45,0.94)', pointerEvents:idx===currentIndex?'auto':'none' }}>
    <EnhancedVideoCard
      video={video}
      currentUser={currentUser}
      isActive={idx===currentIndex}
      onLike={onLike}
      onComment={onComment}
      onShare={onShare}
      onFollow={onFollow}
      onMessage={onMessage}
      onVoiceCall={onVoiceCall}
      onVideoCall={onVideoCall}
      onDuet={onDuet}
      onStitch={onStitch}
      onSaveSound={onSaveSound}
      followed={followed}
      showToast={showToast}
      onViewProfile={onViewProfile}
    />
  </div>
))}
      {filteredVideos.length>1 && (
        <div style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', display:'flex', flexDirection:'column', gap:4, zIndex:10 }}>
          {filteredVideos.map((_,i)=><div key={i} style={{ width:3, height:i===currentIndex?20:4, borderRadius:2, background:i===currentIndex?'white':'rgba(255,255,255,0.2)', cursor:'pointer', transition:'all 0.2s' }} onClick={()=>setCurrentIndex(i)} />)}
        </div>
      )}
    </div>
  );
};

/* ─────────────── FRIENDS FEED ─────────────── */
const FriendsFeed = ({ friends, videos, currentUser, onMessage, onVoiceCall, onVideoCall, onViewProfile, showToast, users, onCreateStory, onViewStory, onFollow, followed }) => {
  const [search, setSearch] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const startY = useRef(null);

  const friendsVideos = useMemo(()=>
    videos.filter(v=>friends.includes(v.userId) || v.userId===currentUser?.id)
      .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)),
  [friends,videos,currentUser?.id]);

  const filtered = useMemo(()=>
    !search ? friendsVideos : friendsVideos.filter(v=>
      v.username.toLowerCase().includes(search.toLowerCase()) ||
      v.description.toLowerCase().includes(search.toLowerCase())
    ),
  [friendsVideos,search]);

  // Reset index when filter changes
  useEffect(()=>setCurrentIndex(0),[search]);

  const handleTouchStart = e => { startY.current = e.touches[0].clientY; };
  const handleTouchEnd = e => {
    if(startY.current===null) return;
    const dy = startY.current - e.changedTouches[0].clientY;
    if(Math.abs(dy)>50){
      if(dy>0) setCurrentIndex(i=>Math.min(filtered.length-1,i+1));
      else setCurrentIndex(i=>Math.max(0,i-1));
    }
    startY.current = null;
  };

  if(filtered.length===0) return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#0a0a0a' }}>
      {/* Top bar */}
      <div style={{ position:'relative', zIndex:15, padding:'14px 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ color:'white', fontWeight:800, fontSize:18, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Friends</div>
        <button onClick={()=>setShowSearch(v=>!v)} style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'50%', width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
      </div>
      {showSearch && (
        <div style={{ padding:'10px 14px', zIndex:15 }}>
          <div style={{ display:'flex', gap:8, alignItems:'center', background:'rgba(255,255,255,0.07)', borderRadius:28, padding:'10px 16px', border:'1px solid rgba(255,255,255,0.08)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search friends..." style={{ flex:1, background:'none', border:'none', color:'white', outline:'none', fontSize:13 }} />
            {search && <button onClick={()=>setSearch('')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:16 }}>✕</button>}
          </div>
        </div>
      )}
      <Stories users={users} currentUser={currentUser} onViewStory={onViewStory} onCreateStory={onCreateStory} />
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'rgba(255,255,255,0.2)' }}>
        <div style={{ fontSize:44 }}>👥</div>
        <div style={{ fontSize:14 }}>{search ? 'No results found' : 'Follow people to see their videos here'}</div>
      </div>
    </div>
  );

  return (
    <div style={{ height:'100%', position:'relative', overflow:'hidden', background:'#000' }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {/* Fullscreen video cards — same as HomeFeed */}
      {filtered.map((video,idx)=>(
  <div key={video.id} onClick={()=>setShowSearch(false)} style={{ position:'absolute', inset:0, translate:`0 ${(idx-currentIndex)*100}%`, transition:'translate 0.3s cubic-bezier(0.25,0.46,0.45,0.94)', pointerEvents:idx===currentIndex?'auto':'none' }}>
          <EnhancedVideoCard
            video={video}
            currentUser={currentUser}
            isActive={idx===currentIndex}
            onLike={()=>{}}
            onComment={()=>{}}
            onShare={()=>{}}
            onFollow={onFollow}
            onMessage={onMessage}
            onVoiceCall={onVoiceCall}
            onVideoCall={onVideoCall}
            onDuet={()=>showToast?.('Duet mode ready','info')}
            onStitch={()=>showToast?.('Stitch mode ready','info')}
            onSaveSound={()=>showToast?.('Sound saved!','success')}
            followed={followed}
            showToast={showToast}
            onViewProfile={onViewProfile}
          />
        </div>
      ))}

      {/* Top overlay: Friends label + search — sits above Stories */}
      <div style={{ position:'absolute', top:110, left:0, right:0, zIndex:15, padding:'10px 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ color:'white', fontWeight:800, fontSize:18, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif", textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>Friends</div>
        <button onClick={()=>setShowSearch(v=>!v)} style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'50%', width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
      </div>

      {/* Search bar (dropdown) */}
      {showSearch && (
  <div style={{ position:'absolute', top:60, left:14, right:14, zIndex:20 }}
    onClick={e=>e.stopPropagation()}>
          <div style={{ display:'flex', gap:8, alignItems:'center', background:'rgba(10,10,10,0.92)', backdropFilter:'blur(16px)', borderRadius:28, padding:'10px 16px', border:'1px solid rgba(255,255,255,0.12)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search friends..." style={{ flex:1, background:'none', border:'none', color:'white', outline:'none', fontSize:13 }} />
            {search && <button onClick={()=>setSearch('')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:16 }}>✕</button>}
          </div>
        </div>
      )}

      {/* Stories row — always at top */}
      <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:14 }}>
        <Stories users={users} currentUser={currentUser} onViewStory={onViewStory} onCreateStory={onCreateStory} />
      </div>

      {/* Scroll position dots */}
      {filtered.length>1 && (
        <div style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', display:'flex', flexDirection:'column', gap:4, zIndex:10 }}>
          {filtered.map((_,i)=>(
            <div key={i} onClick={()=>setCurrentIndex(i)} style={{ width:3, height:i===currentIndex?20:4, borderRadius:2, background:i===currentIndex?'white':'rgba(255,255,255,0.2)', cursor:'pointer', transition:'all 0.2s' }} />
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────── CREATE SCREEN ─────────────── */
const CreateScreen = ({ onOpenCamera, onShowSoundLibrary, showToast }) => (
  <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, gap:12, background:'#0a0a0a' }}>
    <div style={{ textAlign:'center', marginBottom:12 }}>
      <div style={{ width:72, height:72, borderRadius:'50%', background:'linear-gradient(135deg,#ff2d55,#af52de)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:32 }}>🎬</div>
      <div style={{ color:'white', fontWeight:800, fontSize:24, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Create & Share</div>
      <div style={{ color:'rgba(255,255,255,0.35)', fontSize:14, marginTop:4 }}>Express yourself</div>
    </div>
    {[
      {icon:'📷',label:'Open Camera',sub:'Record or take photo',action:onOpenCamera,grad:true},
      {icon:'🖼️',label:'Upload from Gallery',sub:'Choose from your device',action:onOpenCamera,grad:false},
      {icon:'✏️',label:'Write Text Story',sub:'Share a thought',action:onOpenCamera,grad:false},
      {icon:'🎙️',label:'Record Audio',sub:'Voice post',action:onOpenCamera,grad:false},
      {icon:'🎵',label:'Add Sound',sub:'Browse music library',action:onShowSoundLibrary,grad:false},
    ].map(btn=>(
      <button key={btn.label} onClick={btn.action} style={{ width:'100%', maxWidth:320, background:btn.grad?'linear-gradient(135deg,#ff2d55,#af52de)':'rgba(255,255,255,0.04)', border:btn.grad?'none':'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'16px 20px', color:'white', fontSize:14, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:14, textAlign:'left' }}>
        <div style={{ width:44, height:44, borderRadius:14, background:btn.grad?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{btn.icon}</div>
        <div>
          <div style={{ fontWeight:700, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{btn.label}</div>
          <div style={{ color:btn.grad?'rgba(255,255,255,0.65)':'rgba(255,255,255,0.35)', fontSize:11, marginTop:2 }}>{btn.sub}</div>
        </div>
      </button>
    ))}
  </div>
);

/* ─────────────── WALLET PAGE ─────────────── */
const WalletPage = ({ user, setCurrentUser, showToast, onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [amount, setAmount] = useState('');
  const [transactions, setTransactions] = useState([]);

  useEffect(()=>{
    if(!user?.id) return;
    const q = query(collection(db,'transactions'), where('userId','==',user.id), orderBy('createdAt','desc'));
    const unsub = onSnapshot(q, snap=>{
      setTransactions(snap.docs.map(d=>({id:d.id,...d.data(),date:d.data().createdAt?.toDate?.()||new Date()})));
    });
    return ()=>unsub();
  },[user?.id]);

  const doDeposit = async () => {
    const n=parseInt(amount); if(!n||n<=0){showToast?.('Enter valid amount','error'); return;}
    try {
      await addDoc(collection(db,'transactions'),{ userId:user.id, type:'credit', label:`Top-up ${n} coins`, amount:n, coins:true, createdAt:serverTimestamp() });
      await updateDoc(doc(db,'users',user.id),{ coins:increment(n), walletBalance:increment(n) });
      setCurrentUser(u=>({...u,coins:(u.coins||0)+n,walletBalance:(u.walletBalance||0)+n}));
      showToast?.(`Added ${n} coins! 🎉`,'success');
      setAmount('');
    } catch(e) {
      showToast?.('Transaction failed: '+e.message,'error');
    }
  };
  const doWithdraw = async () => {
    const n=parseInt(amount); if(!n||n<=0){showToast?.('Enter valid amount','error'); return;}
    if((user?.coins||0)<n){showToast?.('Insufficient coins','error'); return;}
    try {
      await addDoc(collection(db,'transactions'),{ userId:user.id, type:'debit', label:`Withdrew ${n} coins`, amount:n, coins:true, createdAt:serverTimestamp() });
      await updateDoc(doc(db,'users',user.id),{ coins:increment(-n), walletBalance:increment(-n) });
      setCurrentUser(u=>({...u,coins:(u.coins||0)-n,walletBalance:(u.walletBalance||0)-n}));
      showToast?.(`Withdrew ${n} coins`,'success');
      setAmount('');
    } catch(e) {
      showToast?.('Transaction failed: '+e.message,'error');
    }
  };
  const convertCoins = async () => {
    const n=parseInt(amount); if(!n||n<=0||(user?.coins||0)<n){showToast?.('Insufficient coins','error'); return;}
    const eth=(n/10000).toFixed(4);
    try {
      await addDoc(collection(db,'transactions'),{ userId:user.id, type:'debit', label:`Converted to ${eth} ETH`, amount:n, coins:true, createdAt:serverTimestamp() });
      await updateDoc(doc(db,'users',user.id),{ coins:increment(-n) });
      setCurrentUser(u=>({...u,coins:(u.coins||0)-n}));
      showToast?.(`Converted to ${eth} ETH! ✨`,'success');
      setAmount('');
    } catch(e) {
      showToast?.('Transaction failed: '+e.message,'error');
    }
  };

  return (
    <div style={{ height:'100%', overflow:'auto', background:'#0a0a0a' }}>
      <div style={{ padding:'16px 16px 0' }}>
        <button onClick={onBack} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'8px 16px', color:'white', cursor:'pointer', fontSize:13, marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <div style={{ color:'white', fontWeight:800, fontSize:22, marginBottom:16, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Wallet</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          <div style={{ background:'linear-gradient(135deg,#ffd700,#ff9500)', borderRadius:22, padding:20 }}>
            <div style={{ color:'rgba(0,0,0,0.55)', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Coins</div>
            <div style={{ color:'#000', fontSize:30, fontWeight:800, marginTop:4, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{(user?.coins||0).toLocaleString()}</div>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:10, marginTop:2 }}>🪙 Infinity Coins</div>
          </div>
          <div style={{ background:'linear-gradient(135deg,#06d6a0,#00b4d8)', borderRadius:22, padding:20 }}>
            <div style={{ color:'rgba(0,0,0,0.55)', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Cash</div>
            <div style={{ color:'#000', fontSize:30, fontWeight:800, marginTop:4, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>${(user?.walletBalance||0).toLocaleString()}</div>
            <div style={{ color:'rgba(0,0,0,0.4)', fontSize:10, marginTop:2 }}>💵 USD</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:4, marginBottom:16, background:'rgba(255,255,255,0.04)', borderRadius:18, padding:4, border:'1px solid rgba(255,255,255,0.06)' }}>
          {['overview','deposit','withdraw','convert'].map(t=>(
            <button key={t} onClick={()=>setActiveTab(t)} style={{ flex:1, background:activeTab===t?'rgba(255,45,85,0.9)':'none', border:'none', borderRadius:14, padding:'8px 4px', color:'white', cursor:'pointer', fontSize:11, fontWeight:activeTab===t?700:400, textTransform:'capitalize' }}>{t}</button>
          ))}
        </div>
        {activeTab==='overview' && (
          <div>
            {transactions.length===0&&<div style={{textAlign:'center',padding:40,color:'rgba(255,255,255,0.2)'}}>No transactions yet</div>}
            {transactions.map(tx=>(
              <div key={tx.id} style={{ background:'rgba(255,255,255,0.03)', borderRadius:16, padding:'13px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:12, border:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:tx.type==='credit'?'rgba(6,214,160,0.12)':'rgba(255,45,85,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{tx.type==='credit'?'⬆️':'⬇️'}</div>
                <div style={{ flex:1 }}><div style={{ color:'white', fontSize:12 }}>{tx.label}</div><div style={{ color:'rgba(255,255,255,0.3)', fontSize:10, marginTop:2 }}>{tx.date?.toLocaleDateString?.()}</div></div>
                <div style={{ color:tx.type==='credit'?'#06d6a0':'#ff2d55', fontWeight:700, fontSize:15 }}>{tx.type==='credit'?'+':'-'}{tx.amount}{tx.coins?'🪙':'$'}</div>
              </div>
            ))}
          </div>
        )}
        {(activeTab==='deposit'||activeTab==='withdraw'||activeTab==='convert') && (
          <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:22, padding:20, border:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:12, marginBottom:8 }}>{activeTab==='deposit'?'Add coins':activeTab==='withdraw'?'Withdraw coins':'Convert to ETH (1 ETH = 10,000 🪙)'}</div>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              <input type="number" placeholder="Enter amount..." value={amount} onChange={e=>setAmount(e.target.value)} style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'12px', color:'white', outline:'none', fontSize:15 }} />
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              {[100,500,1000,5000].map(v=>(
                <button key={v} onClick={()=>setAmount(String(v))} style={{ flex:1, background:amount===String(v)?'rgba(255,45,85,0.9)':'rgba(255,255,255,0.06)', border:'none', borderRadius:10, padding:'8px', color:'white', cursor:'pointer', fontSize:12, fontWeight:600 }}>{v}</button>
              ))}
            </div>
            <button onClick={activeTab==='deposit'?doDeposit:activeTab==='withdraw'?doWithdraw:convertCoins} style={{ width:'100%', background:'linear-gradient(135deg,#ff2d55,#af52de)', border:'none', borderRadius:24, padding:'14px', color:'white', fontWeight:700, cursor:'pointer', fontSize:14, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>
              {activeTab==='deposit'?'Add Coins':activeTab==='withdraw'?'Withdraw':'Convert to ETH'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────── EDIT PROFILE MODAL ─────────────── */
const EditProfileModal = ({ user, onClose, onSave, showToast }) => {
  const [username, setUsername] = useState(user?.username||'');
  const [bio, setBio] = useState(user?.bio||'');
  const [link, setLink] = useState(user?.link||'');
  const [gender, setGender] = useState(user?.gender||'');
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor||'#ff2d55');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl||null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const colors = ['#FF2D55','#AF52DE','#007AFF','#FF9500','#34C759','#00C7BE','#FF3B30','#5856D6','#32ADE6','#FF6B6B'];

  const handleAvatarChange = (e) => {
    const f = e.target.files[0];
    if(f){setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f));}
  };

  const handleSave = async () => {
    setUploading(true);
    try {
      let avatarUrl = user?.avatarUrl || null;
      if(avatarFile) avatarUrl = await uploadToCloudinary(avatarFile);
      const updates = {username,bio,link,gender,avatarColor,avatarUrl};
      await updateDoc(doc(db,'users',user.id), updates);
      onSave(updates);
      showToast?.('Profile updated!','success');
      onClose();
    } catch(e) {
      showToast?.('Update failed','error');
    }
    setUploading(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:4000, display:'flex', alignItems:'flex-end' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', background:'#0f0f0f', borderTopLeftRadius:32, borderTopRightRadius:32, padding:'20px 20px 44px', maxHeight:'92vh', overflowY:'auto', border:'1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ width:36, height:4, background:'rgba(255,255,255,0.12)', borderRadius:2, margin:'0 auto 20px' }} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <span style={{ color:'white', fontWeight:800, fontSize:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Edit Profile</span>
          <button onClick={handleSave} disabled={uploading} style={{ background:'linear-gradient(135deg,#ff2d55,#af52de)', border:'none', borderRadius:20, padding:'9px 20px', color:'white', fontWeight:700, cursor:'pointer', fontSize:14, opacity:uploading?0.6:1 }}>{uploading?'Saving...':'Save'}</button>
        </div>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ position:'relative', display:'inline-block' }}>
            <div style={{ width:90, height:90, borderRadius:'50%', background:avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:36, margin:'0 auto', border:'3px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
              {avatarPreview ? <img src={avatarPreview} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : user?.avatar}
            </div>
            <div onClick={()=>fileInputRef.current?.click()} style={{ position:'absolute', bottom:0, right:0, background:'rgba(255,255,255,0.1)', border:'2px solid #0f0f0f', borderRadius:'50%', width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', backdropFilter:'blur(8px)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{display:'none'}} />
          <div style={{ color:'rgba(255,255,255,0.4)', fontSize:12, marginTop:12, marginBottom:12 }}>Profile color</div>
          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
            {colors.map(c=><div key={c} onClick={()=>setAvatarColor(c)} style={{ width:34, height:34, borderRadius:'50%', background:c, cursor:'pointer', border:c===avatarColor?'3px solid white':'3px solid transparent', transition:'all 0.15s' }} />)}
          </div>
        </div>
        {[
          {label:'Username',value:username,set:setUsername,placeholder:'Your username',prefix:'@'},
          {label:'Bio',value:bio,set:setBio,placeholder:'Tell people about yourself',multiline:true},
          {label:'Website / Link',value:link,set:setLink,placeholder:'https://yourwebsite.com'},
          {label:'Gender',value:gender,set:setGender,placeholder:'e.g. Male, Female, Other'},
        ].map(field=>(
          <div key={field.label} style={{ marginBottom:16 }}>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:12, marginBottom:7, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>{field.label}</div>
            {field.multiline ? (
              <textarea value={field.value} onChange={e=>field.set(e.target.value)} placeholder={field.placeholder} style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, padding:'12px 14px', color:'white', outline:'none', fontSize:14, resize:'none', minHeight:80, boxSizing:'border-box' }} />
            ) : (
              <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, padding:'12px 14px' }}>
                {field.prefix && <span style={{ color:'rgba(255,255,255,0.3)', marginRight:4, fontSize:14 }}>{field.prefix}</span>}
                <input value={field.value} onChange={e=>field.set(e.target.value)} placeholder={field.placeholder} style={{ flex:1, background:'none', border:'none', color:'white', outline:'none', fontSize:14 }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
const PrivacyToggles = ({ user, showToast }) => {
  const defaults = { 'Private Account':false,'Show Activity Status':true,'Allow Comments':true,'Allow Duets':true,'Allow Messages from Everyone':false,'Allow Calls from Everyone':false,'Allow Follow Requests':true };
  const [settings, setSettings] = useState({ ...defaults, ...(user?.privacy||{}) });
  const toggle = async (label) => {
    const next = { ...settings, [label]: !settings[label] };
    setSettings(next);
    await updateDoc(doc(db,'users',user.id),{ privacy: next });
    showToast?.('Saved','success');
  };
  return (
    <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:20, overflow:'hidden', marginBottom:20, border:'1px solid rgba(255,255,255,0.06)' }}>
      {Object.entries(settings).map(([label,on],i,arr)=>(
        <div key={label} onClick={()=>toggle(label)} style={{ padding:'14px 16px', borderBottom:i<arr.length-1?'1px solid rgba(255,255,255,0.05)':'', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}>
          <span style={{ color:'white', fontSize:13 }}>{label}</span>
          <div style={{ width:46, height:26, background:on?'#ff2d55':'rgba(255,255,255,0.1)', borderRadius:13, position:'relative', transition:'background 0.2s' }}>
            <div style={{ width:20, height:20, background:'white', borderRadius:'50%', position:'absolute', top:3, left:on?23:3, transition:'left 0.2s' }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─────────────── PROFILE PAGE ─────────────── */
const ProfilePage = ({ user, setCurrentUser, onLogout, users, showToast, onShowAnalytics, onShowQRCode, allVideos }) => {
  const [activeSubPage, setActiveSubPage] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileTab, setProfileTab] = useState('posts');
  const myVideos = allVideos?.filter(v=>v.userId===user?.id)||[];
  const saveProfile = data=>setCurrentUser(u=>({...u,...data}));

  if(activeSubPage==='analytics'){onShowAnalytics?.(); setActiveSubPage(null); return null;}
  if(activeSubPage==='qrcode'){onShowQRCode?.(); setActiveSubPage(null); return null;}
  if(activeSubPage==='wallet') return <WalletPage user={user} setCurrentUser={setCurrentUser} showToast={showToast} onBack={()=>setActiveSubPage(null)} />;

  if(activeSubPage==='settings') return (
    <div style={{ height:'100%', overflow:'auto', background:'#0a0a0a' }}>
      <div style={{ padding:'16px' }}>
        <button onClick={()=>setActiveSubPage(null)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'8px 16px', color:'white', cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
        </button>
        <div style={{ color:'white', fontWeight:800, fontSize:22, marginBottom:24, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Settings</div>
        <div style={{ color:'rgba(255,255,255,0.3)', fontSize:11, fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:1.2 }}>Account</div>
        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:20, overflow:'hidden', marginBottom:20, border:'1px solid rgba(255,255,255,0.06)' }}>
          {[
            {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,label:'Edit Profile',action:()=>{setShowEditProfile(true); setActiveSubPage(null);}},
            {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,label:'Change Password',action:async()=>{if(user?.email){await sendPasswordResetEmail(auth,user.email); showToast?.('Password reset email sent!','success');}else showToast?.('No email on account','error');}},
            {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,label:'Email & Phone',action:()=>showToast?.(user?.email||'No email','info')},
            {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,label:'Language',action:()=>showToast?.('Language: English','info')},
            {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,label:'Switch Account',action:()=>setActiveSubPage('switch')},
          ].map((item,i,arr)=>(
            <div key={item.label} onClick={item.action} style={{ padding:'15px 16px', borderBottom:i<arr.length-1?'1px solid rgba(255,255,255,0.05)':'', display:'flex', alignItems:'center', gap:14, cursor:'pointer' }}>
              <div style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center' }}>{item.icon}</div>
              <span style={{ color:'white', flex:1, fontSize:14 }}>{item.label}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          ))}
        </div>
        <div style={{ color:'rgba(255,255,255,0.3)', fontSize:11, fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:1.2 }}>Privacy</div>
        <PrivacyToggles user={user} showToast={showToast} />
        <div style={{ color:'rgba(255,255,255,0.3)', fontSize:11, fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:1.2 }}>Support</div>
        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:20, overflow:'hidden', marginBottom:20, border:'1px solid rgba(255,255,255,0.06)' }}>
          {[
            {label:'Help Center',action:()=>showToast?.('Help center','info')},
            {label:'Report a Problem',action:async()=>{
              await sendEmailJS({to_email:'getachewshambel11@gmail.com',from_name:user?.username,message:`User ${user?.username} (${user?.email}) reported a problem.`});
              showToast?.('Report sent!','success');
            }},
            {label:'Terms of Service',action:()=>showToast?.('Terms of Service','info')},
            {label:'Privacy Policy',action:()=>showToast?.('Privacy Policy','info')},
          ].map((item,i,arr)=>(
            <div key={item.label} onClick={item.action} style={{ padding:'14px 16px', borderBottom:i<arr.length-1?'1px solid rgba(255,255,255,0.05)':'', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <span style={{ color:'white', flex:1, fontSize:14 }}>{item.label}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          ))}
        </div>
        {/* RESET ACCOUNT — paste here */}
<div onClick={async()=>{
  if(window.confirm('Reset account? This will delete all your posts, comments and likes but keep your account.')){
    try {
      const vSnap = await getDocs(query(collection(db,'videos'),where('userId','==',user.id)));
      await Promise.all(vSnap.docs.map(d=>deleteDoc(doc(db,'videos',d.id))));
      const cSnap = await getDocs(query(collection(db,'comments'),where('userId','==',user.id)));
      await Promise.all(cSnap.docs.map(d=>deleteDoc(doc(db,'comments',d.id))));
      const lSnap = await getDocs(collection(db,'likes'));
      await Promise.all(lSnap.docs.filter(d=>d.id.includes(user.id)).map(d=>deleteDoc(doc(db,'likes',d.id))));
      await updateDoc(doc(db,'users',user.id),{
        followers:[], following:[], coins:500, walletBalance:500, streak:1
      });
      setCurrentUser(u=>({...u,followers:[],following:[],coins:500,walletBalance:500,streak:1}));
      showToast?.('Account reset successfully','success');
    } catch(e){
      showToast?.('Reset failed: '+e.message,'error');
    }
  }
}} style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff9500" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
  <span style={{ color:'#ff9500', fontSize:14 }}>Reset Account</span>
</div>

<div onClick={onLogout} style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff9500" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span style={{ color:'#ff9500', fontSize:14 }}>Log Out</span>
        </div>

        <div onClick={async()=>{
          if(window.confirm('Delete account? This cannot be undone.')){
            try{
              const vSnap = await getDocs(query(collection(db,'videos'),where('userId','==',user.id)));
              await Promise.all(vSnap.docs.map(d=>deleteDoc(doc(db,'videos',d.id))));
              const cSnap = await getDocs(query(collection(db,'comments'),where('userId','==',user.id)));
              await Promise.all(cSnap.docs.map(d=>deleteDoc(doc(db,'comments',d.id))));
              const nSnap = await getDocs(query(collection(db,'notifications'),where('toUserId','==',user.id)));
              await Promise.all(nSnap.docs.map(d=>deleteDoc(doc(db,'notifications',d.id))));
              await deleteDoc(doc(db,'users',user.id));
              await auth.currentUser?.delete();
              onLogout?.();
            }catch(e){
              showToast?.('Re-login required to delete','error');
            }
          }
        }} style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff2d55" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          <span style={{ color:'#ff2d55', fontSize:14 }}>Delete Account</span>
        </div>
        <div style={{ textAlign:'center', color:'rgba(255,255,255,0.15)', fontSize:11, marginBottom:16 }}>Infinity v3.0.0 • Made with ❤️</div>
      </div>
    </div>
  );

  if(activeSubPage==='privacy') return (
    <div style={{ height:'100%', overflow:'auto', background:'#0a0a0a', padding:16 }}>
      <button onClick={()=>setActiveSubPage(null)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'8px 16px', color:'white', cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{ color:'white', fontWeight:800, fontSize:22, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Privacy</div>
      <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:20, overflow:'hidden', border:'1px solid rgba(255,255,255,0.06)' }}>
        {['Private Account','Show Activity','Allow Messages from Everyone','Allow Comments','Allow Duets','Show Liked Videos'].map((label,i,arr)=>(
          <div key={label} style={{ padding:'14px 16px', borderBottom:i<arr.length-1?'1px solid rgba(255,255,255,0.05)':'', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:'white', fontSize:13 }}>{label}</span>
            <div style={{ width:46, height:26, background:'#ff2d55', borderRadius:13, position:'relative', cursor:'pointer' }}>
              <div style={{ width:20, height:20, background:'white', borderRadius:'50%', position:'absolute', top:3, left:23 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if(activeSubPage==='switch') return (
    <div style={{ height:'100%', overflow:'auto', background:'#0a0a0a', padding:16 }}>
      <button onClick={()=>setActiveSubPage(null)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'8px 16px', color:'white', cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{ color:'white', fontWeight:800, fontSize:22, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Switch Account</div>
      {JSON.parse(localStorage.getItem('infinity_accounts')||'[]').filter(u=>u.id===user?.id).map(u=>(
        <div key={u.id} style={{ background:'rgba(255,255,255,0.03)', borderRadius:18, padding:16, marginBottom:10, display:'flex', alignItems:'center', gap:14, cursor: u.id===user?.id?'default':'not-allowed', border:u.id===user?.id?'1px solid rgba(255,45,85,0.5)':'1px solid rgba(255,255,255,0.06)', opacity: u.id===user?.id?1:0.4 }} onClick={()=>{ if(u.id!==user?.id){ showToast?.('Sign in to switch accounts','info'); return; } }}>
          <div style={{ width:50, height:50, borderRadius:'50%', background:u.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:20, overflow:'hidden' }}>
            {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : u.avatar}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ color:'white', fontWeight:700, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>@{u.username}</div>
            <div style={{ color:'rgba(255,255,255,0.3)', fontSize:12, marginTop:2 }}>{u.subscription} plan</div>
          </div>
          {u.id===user?.id && <span style={{ color:'#ff2d55', fontSize:12, fontWeight:700 }}>Active</span>}
        </div>
      ))}
      <button style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px dashed rgba(255,255,255,0.15)', borderRadius:18, padding:16, color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:14, marginTop:4 }}>+ Add Account</button>
    </div>
  );

  if(activeSubPage==='badges') return (
    <div style={{ height:'100%', overflow:'auto', background:'#0a0a0a', padding:16 }}>
      <button onClick={()=>setActiveSubPage(null)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'8px 16px', color:'white', cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{ color:'white', fontWeight:800, fontSize:22, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Badges</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
        {[['🌟','First Post',myVideos.length>0],['🔥','7 Day Streak',(user?.streak||0)>=7],['💎','Top Creator',(user?.followers?.length||0)>=100],['👑','100K Fans',(user?.followers?.length||0)>=100000],['🚀','Viral',myVideos.some(v=>v.views>=10000)],['🎯','Pro User',user?.subscription==='pro']].map(([icon,name,earned])=>(
          <div key={name} style={{ background:'rgba(255,255,255,0.03)', borderRadius:20, padding:18, textAlign:'center', opacity:earned?1:0.4, border:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize:38, marginBottom:8 }}>{icon}</div>
            <div style={{ color:'white', fontSize:12, fontWeight:700, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{name}</div>
            <div style={{ color:earned?'#06d6a0':'rgba(255,255,255,0.3)', fontSize:10, marginTop:4 }}>{earned?'Earned':'Locked'}</div>
          </div>
        ))}
      </div>
    </div>
  );

  if(activeSubPage==='premium') return (
    <div style={{ height:'100%', overflow:'auto', background:'#0a0a0a', padding:16 }}>
      <button onClick={()=>setActiveSubPage(null)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'8px 16px', color:'white', cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{ color:'white', fontWeight:800, fontSize:22, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Premium</div>
      {[{name:'Plus',price:'$4.99/mo',color:'#af52de',features:['Ad-free experience','500 coins/month','Custom profile badge','Priority in search']},{name:'Pro',price:'$9.99/mo',color:'#ffd700',features:['All Plus features','2000 coins/month','Advanced analytics','Priority support','Custom username']}].map(plan=>(
        <div key={plan.name} style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${plan.color}40`, borderRadius:24, padding:22, marginBottom:14 }}>
          <div style={{ color:plan.color, fontWeight:800, fontSize:20, marginBottom:4, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{plan.name}</div>
          <div style={{ color:'white', fontSize:28, fontWeight:800, marginBottom:14, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{plan.price}</div>
          {plan.features.map(f=><div key={f} style={{ color:'rgba(255,255,255,0.7)', fontSize:13, marginBottom:8, display:'flex', alignItems:'center', gap:8 }}><span style={{ color:plan.color }}>✓</span>{f}</div>)}
          <button onClick={async()=>{
            await updateDoc(doc(db,'users',user.id),{subscription:plan.name.toLowerCase()});
            setCurrentUser(u=>({...u,subscription:plan.name.toLowerCase()}));
            showToast?.(`${plan.name} activated!`,'success');
            await sendEmailJS({to_email:user?.email,from_name:'Infinity',message:`Your ${plan.name} subscription has been activated!`});
          }} style={{ width:'100%', background:plan.color, border:'none', borderRadius:20, padding:14, color:'#000', fontWeight:800, cursor:'pointer', marginTop:10, fontSize:14, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Subscribe to {plan.name}</button>
        </div>
      ))}
    </div>
  );

  const menuItems = [
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,label:'Settings',page:'settings',color:'#fff'},
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,label:'Wallet',page:'wallet',color:'#ffd700'},
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,label:'Privacy',page:'privacy',color:'#fff'},
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,label:'Switch',page:'switch',color:'#fff'},
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#af52de" strokeWidth="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,label:'Badges',page:'badges',color:'#af52de'},
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,label:'Premium',page:'premium',color:'#ffd700'},
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06d6a0" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,label:'Analytics',page:'analytics',color:'#06d6a0'},
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,label:'QR Code',page:'qrcode',color:'#fff'},
  ];

  return (
    <div style={{ height:'100%', overflow:'auto', background:'#0a0a0a' }}>
      <div style={{ position:'relative', paddingBottom:20 }}>
        <div style={{ height:160, position:'absolute', top:0, left:0, right:0, overflow:'hidden' }}>
          {user?.avatarUrl
            ? <img src={user.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', filter:'blur(24px) brightness(0.45) saturate(1.4)', transform:'scale(1.15)' }} />
            : <div style={{ width:'100%', height:'100%', background:`linear-gradient(135deg,${user?.avatarColor||'#ff2d55'}88,rgba(175,82,222,0.4))` }} />
          }
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom,rgba(10,10,10,0.2),rgba(10,10,10,0.85))' }} />
        </div>
        <div style={{ position:'relative', padding:'52px 20px 0', textAlign:'center' }}>
          <div style={{ position:'absolute', top:10, right:16, display:'flex', gap:8 }}>
            <button onClick={()=>setActiveSubPage('qrcode')} style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'50%', width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </button>
            <button onClick={()=>setActiveSubPage('settings')} style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'50%', width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            </button>
          </div>
          <div style={{ position:'relative', display:'inline-block', marginBottom:14 }}>
            <div style={{ width:96, height:96, borderRadius:'50%', padding:3, background:'conic-gradient(#ff2d55,#ff9500,#af52de,#ff2d55)', margin:'0 auto' }}>
              <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:'#0a0a0a', padding:2, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:user?.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:36, overflow:'hidden' }}>
                  {user?.avatarUrl ? <img src={user.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : user?.avatar}
                </div>
              </div>
            </div>
            <button onClick={()=>setShowEditProfile(true)} style={{ position:'absolute', bottom:2, right:2, background:'linear-gradient(135deg,#ff2d55,#af52de)', border:'2px solid #0a0a0a', borderRadius:'50%', width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>
          <div style={{ color:'white', fontWeight:800, fontSize:22, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>@{user?.username}</div>
          {user?.verified && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:4, color:'#1d9bf0', fontSize:12, marginTop:4, background:'rgba(29,155,240,0.1)', borderRadius:20, padding:'3px 10px' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#1d9bf0"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Verified
            </div>
          )}
          <div style={{ color:'rgba(255,255,255,0.5)', fontSize:13, marginTop:8, lineHeight:1.6, maxWidth:260, margin:'8px auto 0' }}>{user?.bio||'No bio yet'}</div>
          {user?.link && <a href={user.link} target="_blank" rel="noopener noreferrer" style={{ color:'#007aff', fontSize:13, display:'block', marginTop:4 }}>{user.link}</a>}
          <button onClick={()=>setShowEditProfile(true)} style={{ marginTop:16, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:14, padding:'10px 32px', color:'white', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Edit Profile</button>
          <div style={{ display:'flex', justifyContent:'center', gap:0, marginTop:20, background:'rgba(255,255,255,0.03)', borderRadius:20, padding:'14px 0', border:'1px solid rgba(255,255,255,0.06)' }}>
            {[['Posts',myVideos.length],['Followers',user?.followers?.length||0],['Following',user?.following?.length||0]].map(([label,val],i)=>(
              <div key={label} style={{ flex:1, textAlign:'center', borderRight:i<2?'1px solid rgba(255,255,255,0.06)':'' }}>
                <div style={{ color:'white', fontWeight:800, fontSize:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{formatNumber(val)}</div>
                <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, marginTop:10, justifyContent:'center' }}>
            <div style={{ background:'rgba(255,165,0,0.1)', border:'1px solid rgba(255,165,0,0.2)', borderRadius:20, padding:'6px 14px', display:'flex', alignItems:'center', gap:6 }}>
              <span>🔥</span><span style={{ color:'#ff9500', fontSize:12, fontWeight:700 }}>{user?.streak||1} day streak</span>
            </div>
            <div style={{ background:'rgba(255,215,0,0.08)', border:'1px solid rgba(255,215,0,0.2)', borderRadius:20, padding:'6px 14px', display:'flex', alignItems:'center', gap:6 }}>
              <span>🪙</span><span style={{ color:'#ffd700', fontSize:12, fontWeight:700 }}>{(user?.coins||0).toLocaleString()} coins</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding:'16px 16px 4px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
          {menuItems.map(item=>(
            <button key={item.page} onClick={()=>setActiveSubPage(item.page)} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:18, padding:'14px 6px 12px', display:'flex', flexDirection:'column', alignItems:'center', gap:7, cursor:'pointer' }}>
              <div style={{ width:40, height:40, borderRadius:14, background:'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center' }}>{item.icon}</div>
              <span style={{ color:item.color==='#fff'?'rgba(255,255,255,0.75)':item.color, fontSize:10, fontWeight:700 }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', borderTop:'1px solid rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)', marginTop:16 }}>
        {[
          {id:'posts',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>},
          {id:'saved',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>},
          {id:'drafts',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>},
        ].map(t=>(
          <button key={t.id} onClick={()=>setProfileTab(t.id)} style={{ flex:1, background:'none', border:'none', borderTop:profileTab===t.id?'2px solid #ff2d55':'2px solid transparent', padding:'14px 0', color:profileTab===t.id?'white':'rgba(255,255,255,0.3)', cursor:'pointer', display:'flex', justifyContent:'center' }}>{t.icon}</button>
        ))}
      </div>
      <div style={{ padding:2 }}>
        {profileTab==='posts' && (
          myVideos.length===0 ? (
            <div style={{ textAlign:'center', padding:48, color:'rgba(255,255,255,0.2)' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🎬</div>
              <div style={{ fontSize:15, fontWeight:600, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>No posts yet</div>
              <div style={{ fontSize:13, marginTop:4 }}>Create your first video!</div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2 }}>
              {myVideos.map(v=>(
                <div key={v.id} style={{ aspectRatio:'9/16', background:'#1a1a1a', position:'relative', overflow:'hidden' }}>
                  {v.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i) || v.mediaType?.startsWith('image')
                    ? <img src={v.videoUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" />
                    : <video src={v.videoUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                  }
                  <div style={{ position:'absolute', bottom:4, left:6, color:'white', fontSize:10, fontWeight:700, background:'rgba(0,0,0,0.6)', borderRadius:8, padding:'2px 7px', display:'flex', alignItems:'center', gap:3 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    {formatNumber(v.views)}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        {profileTab==='saved' && <div style={{ textAlign:'center', padding:48, color:'rgba(255,255,255,0.2)' }}><div style={{ fontSize:40, marginBottom:12 }}>🔖</div><div>No saved posts</div></div>}
        {profileTab==='drafts' && <div style={{ textAlign:'center', padding:48, color:'rgba(255,255,255,0.2)' }}><div style={{ fontSize:40, marginBottom:12 }}>📝</div><div>No drafts yet</div></div>}
      </div>
      {showEditProfile && <EditProfileModal user={user} onClose={()=>setShowEditProfile(false)} onSave={saveProfile} showToast={showToast} />}
    </div>
  );
};

/* ─────────────── INBOX (REAL-TIME FIRESTORE) ─────────────── */
const ConversationView = ({ currentUser, otherUser, conversationId, onBack, showToast, onViewProfile }) => {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const bottomRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(()=>{
    if(!conversationId || !currentUser?.id || !otherUser?.id) return;
    let unsub = ()=>{};

    const init = async () => {
      await setDoc(doc(db,'conversations', conversationId),{
        participants: [currentUser.id, otherUser.id],
        lastMessageAt: serverTimestamp(),
      },{ merge: true });

      const q = query(
        collection(db,'messages', conversationId,'msgs'),
        orderBy('createdAt','asc')
      );
      unsub = onSnapshot(q, snap=>{
        const msgs = snap.docs.map(d=>({id:d.id,...d.data(),
          ts: d.data().createdAt?.toDate?.() || null
        }));
        setMessages(msgs);
        setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),80);
      }, async () => {
        // fallback: no index
        const q2 = query(collection(db,'messages', conversationId,'msgs'));
        unsub = onSnapshot(q2, snap2=>{
          const msgs = snap2.docs.map(d=>({id:d.id,...d.data(),
            ts: d.data().createdAt?.toDate?.() || null
          })).sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
          setMessages(msgs);
          setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),80);
        });
      });
    };

    init();
    return ()=>unsub();
  },[conversationId, currentUser?.id, otherUser?.id]);

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = e => chunksRef.current.push(e.data);
      rec.onstop = () => { setAudioBlob(new Blob(chunksRef.current,{type:'audio/webm'})); stream.getTracks().forEach(t=>t.stop()); };
      rec.start(); recorderRef.current=rec; setIsRecording(true); setRecordSecs(0);
      timerRef.current = setInterval(()=>setRecordSecs(s=>s+1),1000);
    } catch { showToast?.('Mic access denied','error'); }
  };
  const stopVoice = () => { recorderRef.current?.stop(); setIsRecording(false); clearInterval(timerRef.current); };
  const pickFile = e => { const f=e.target.files[0]; if(f){setPreviewFile({url:URL.createObjectURL(f),file:f,type:f.type}); e.target.value='';} };
  const clearAttach = () => { setAudioBlob(null); setPreviewFile(null); };
  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  const handleSend = async () => {
    if(!conversationId || !currentUser?.id || !otherUser?.id) return;
    let mediaUrl=null, mediaType=null;
    if(previewFile?.file){ 
      try{ mediaUrl=await uploadToCloudinary(previewFile.file); mediaType=previewFile.type; }
      catch{ showToast?.('Upload failed','error'); return; } 
    } else if(audioBlob){ 
      try{ mediaUrl=await uploadToCloudinary(audioBlob); mediaType='audio/webm'; }
      catch{ showToast?.('Upload failed','error'); return; } 
    }
    if(!text.trim() && !mediaUrl) return;
    const msg = text.trim();
    if(!msg && !mediaUrl) return;
    setText('');
    try {
      await addDoc(collection(db,'messages', conversationId,'msgs'),{
        from: currentUser.id, 
        to: otherUser.id, 
        text: msg, 
        mediaUrl: mediaUrl || null, 
        mediaType: mediaType || null, 
        createdAt: serverTimestamp() 
      });
      // Update conversation metadata
      await setDoc(doc(db,'conversations', conversationId),{ 
        participants: [currentUser.id, otherUser.id], 
        lastMessage: mediaUrl ? (mediaType?.startsWith('audio') ? '🎙️ Voice message' : '📎 Attachment') : msg, 
        lastMessageAt: serverTimestamp(), 
        [`unread_${otherUser.id}`]: increment(1) 
      },{ merge:true });
      clearAttach();
    } catch(e){
      showToast?.('Failed to send: ' + e.message, 'error');
      setText(msg); // restore text if failed
    }
  };

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'#0a0a0a'}}>
      <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:12}}>
        <button onClick={onBack} style={{background:'none',border:'none',color:'white',cursor:'pointer',padding:'4px 0'}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div onClick={()=>onViewProfile?.(otherUser?.id)} style={{width:40,height:40,borderRadius:'50%',background:otherUser?.avatarColor,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'bold',overflow:'hidden',cursor:'pointer'}}>
          {otherUser?.avatarUrl?<img src={otherUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:otherUser?.avatar}
        </div>
        <div onClick={()=>onViewProfile?.(otherUser?.id)} style={{cursor:'pointer'}}>
          <div style={{color:'white',fontWeight:700,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>@{otherUser?.username}</div>
          <div style={{color:'#06d6a0',fontSize:11,display:'flex',alignItems:'center',gap:4}}><div style={{width:6,height:6,borderRadius:'50%',background:'#06d6a0'}}/>Online</div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:10}}>
          <button style={{background:'rgba(255,255,255,0.06)',border:'none',borderRadius:'50%',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-5.99-5.99 19.79 19.79 0 01-3.07-8.67A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
          </button>
          <button style={{background:'rgba(255,255,255,0.06)',border:'none',borderRadius:'50%',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          </button>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
        {messages.length===0&&<div style={{textAlign:'center',padding:40,color:'rgba(255,255,255,0.2)'}}>Start a conversation! 👋</div>}
        {messages.map(msg=>{
          const isMine = msg.from===currentUser?.id;
          return (
            <div key={msg.id} style={{display:'flex',justifyContent:isMine?'flex-end':'flex-start',alignItems:'flex-end',gap:8,marginBottom:10}}>
              {!isMine&&(
                <div onClick={()=>onViewProfile?.(otherUser?.id)} style={{width:26,height:26,borderRadius:'50%',background:otherUser?.avatarColor,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'bold',fontSize:10,flexShrink:0,cursor:'pointer',overflow:'hidden'}}>
                  {otherUser?.avatarUrl?<img src={otherUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:otherUser?.avatar}
                </div>
              )}
              <div style={{maxWidth:'72%'}}>
                {msg.text&&<div style={{background:isMine?'linear-gradient(135deg,#ff2d55,#af52de)':'rgba(255,255,255,0.09)',borderRadius:isMine?'18px 18px 4px 18px':'18px 18px 18px 4px',padding:'9px 14px',marginBottom:msg.mediaUrl?4:0}}>
                  <span style={{color:'white',fontSize:14,lineHeight:1.4}}>{msg.text}</span>
                </div>}
                <div style={{color:'rgba(255,255,255,0.25)',fontSize:10,marginTop:3,textAlign:isMine?'right':'left',paddingLeft:isMine?0:2,paddingRight:isMine?2:0}}>
                  {msg.ts ? msg.ts.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : ''}
                </div>
                {msg.mediaUrl&&msg.mediaType?.startsWith('image')&&<img src={msg.mediaUrl} alt="" style={{maxWidth:'100%',borderRadius:14,display:'block'}}/>}
                {msg.mediaUrl&&msg.mediaType?.startsWith('video')&&<video src={msg.mediaUrl} controls style={{maxWidth:'100%',borderRadius:14,display:'block'}}/>}
                {msg.mediaUrl&&msg.mediaType?.startsWith('audio')&&(
                  <div style={{display:'flex',alignItems:'center',gap:8,background:isMine?'linear-gradient(135deg,#ff2d55,#af52de)':'rgba(255,255,255,0.07)',borderRadius:20,padding:'10px 14px'}}>
                    <span>🎙️</span><audio src={msg.mediaUrl} controls style={{flex:1,height:28}}/>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>

      {(previewFile||audioBlob)&&(
        <div style={{padding:'0 14px 6px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,0.05)',borderRadius:14,padding:'8px 12px'}}>
            {previewFile?.type?.startsWith('image')&&<img src={previewFile.url} alt="" style={{height:44,width:44,objectFit:'cover',borderRadius:8}}/>}
            {previewFile?.type?.startsWith('video')&&<video src={previewFile.url} style={{height:44,width:60,objectFit:'cover',borderRadius:8}}/>}
            {audioBlob&&!previewFile&&<audio src={URL.createObjectURL(audioBlob)} controls style={{height:28,flex:1}}/>}
            <button onClick={clearAttach} style={{marginLeft:'auto',background:'rgba(255,45,85,0.2)',border:'none',borderRadius:'50%',width:22,height:22,color:'#ff2d55',cursor:'pointer',fontSize:13}}>✕</button>
          </div>
        </div>
      )}

{showEmoji && (
        <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:'10px 14px',background:'rgba(255,255,255,0.04)',borderRadius:16,margin:'0 14px 4px'}}>
          {EMOJI_LIST.map(e=>(
            <button key={e} onClick={()=>setText(t=>t+e)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',padding:2}}>{e}</button>
          ))}
        </div>
      )}
      <div style={{padding:'10px 14px 28px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',gap:8,alignItems:'center'}}>        <button onClick={()=>fileInputRef.current?.click()} style={{background:'rgba(255,255,255,0.07)',border:'none',borderRadius:'50%',width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" onChange={pickFile} style={{display:'none'}}/>
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSend()} placeholder={isRecording?`🔴 ${fmt(recordSecs)}`:'Message...'} style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:28,padding:'11px 16px',color:'white',outline:'none',fontSize:13}}/>
        <button onMouseDown={startVoice} onMouseUp={stopVoice} onTouchStart={startVoice} onTouchEnd={stopVoice} style={{background:isRecording?'rgba(255,45,85,0.9)':'rgba(255,255,255,0.07)',border:'none',borderRadius:'50%',width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,boxShadow:isRecording?'0 0 12px rgba(255,45,85,0.6)':'none'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isRecording?'white':'rgba(255,255,255,0.6)'} strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </button>
        <button onClick={()=>setShowEmoji(v=>!v)} style={{background:'rgba(255,255,255,0.07)',border:'none',borderRadius:'50%',width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,fontSize:18}}>😊</button>
        <button onClick={handleSend} style={{background:'linear-gradient(135deg,#ff2d55,#af52de)',border:'none',borderRadius:'50%',width:42,height:42,color:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
};

const InboxPage = ({ users, currentUser, showToast, onViewProfile, initialTargetId, onClearTarget, persistedConversation, onSetConversation }) => {
  const [activeConversation, setActiveConversation] = useState(initialTargetId ? null : (persistedConversation || null));
  const [conversations, setConversations] = useState([]);

  useEffect(()=>{
    if(initialTargetId && currentUser?.id){
      openConversation(initialTargetId);
      onClearTarget?.();
    }
  },[initialTargetId]);

  useEffect(()=>{
    if(!currentUser?.id) return;
    const q = query(
      collection(db,'conversations'),
      where('participants','array-contains',currentUser.id),
      orderBy('lastMessageAt','desc')
    );
    const unsub = onSnapshot(q, snap=>{
      setConversations(snap.docs.map(d=>({id:d.id,...d.data()})));
    }, (error)=>{
      console.error('Conversations index error:', error);
      // Fallback without orderBy
      const q2 = query(collection(db,'conversations'), where('participants','array-contains',currentUser.id));
      onSnapshot(q2, snap2=>{
        const sorted = snap2.docs
          .map(d=>({id:d.id,...d.data()}))
          .sort((a,b)=>(b.lastMessageAt?.seconds||0)-(a.lastMessageAt?.seconds||0));
        setConversations(sorted);
      });
    });
    return ()=>unsub();
  },[currentUser?.id]);

  const getConversationId = (uid1,uid2) => [uid1,uid2].sort().join('_');

  const openConversation = async (otherUserId) => {
    const convId = getConversationId(currentUser.id, otherUserId);
    // Ensure conversation doc exists
    await setDoc(doc(db,'conversations',convId),{
      participants:[currentUser.id,otherUserId],
      lastMessageAt: serverTimestamp(),
    },{ merge:true });
    setActiveConversation({id:convId,otherUserId});
    onSetConversation?.({id:convId,otherUserId});
  };

  if(activeConversation){
    const otherUser = users.find(u=>u.id===activeConversation.otherUserId);
    return <ConversationView currentUser={currentUser} otherUser={otherUser} conversationId={activeConversation.id} onBack={()=>{ setActiveConversation(null); onSetConversation?.(null); }} showToast={showToast} onViewProfile={uid=>{ setActiveConversation(null); onSetConversation?.(null); onViewProfile?.(uid); }} />;
  }

  const convUsers = useMemo(()=>
    users.filter(u=>{
      if(u.id===currentUser?.id) return false;
      const convId = getConversationId(currentUser.id, u.id);
      return conversations.some(c=>c.id===convId);
    }).sort((a,b)=>{
      const convA = conversations.find(c=>c.id===getConversationId(currentUser.id,a.id));
      const convB = conversations.find(c=>c.id===getConversationId(currentUser.id,b.id));
      return (convB?.lastMessageAt?.seconds||0)-(convA?.lastMessageAt?.seconds||0);
    }),
  [users, conversations, currentUser?.id]);

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#0a0a0a' }}>
      <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ color:'white', fontWeight:800, fontSize:22, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Messages</div>
      </div>
      <div style={{ flex:1, overflowY:'auto' }}>
        {convUsers.length===0 && <div style={{textAlign:'center',padding:60,color:'rgba(255,255,255,0.2)'}}><div style={{fontSize:44,marginBottom:12}}>💬</div><div style={{fontSize:14}}>No messages yet</div><div style={{fontSize:12,marginTop:6,color:'rgba(255,255,255,0.12)'}}>Go to a profile and tap Message to start</div></div>}
        {convUsers.map(u=>{
          const convId = getConversationId(currentUser.id, u.id);
          const conv = conversations.find(c=>c.id===convId);
          return (
            <div key={u.id} onClick={()=>openConversation(u.id)} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}>
              <div style={{ position:'relative' }}>
                <div style={{ width:52, height:52, borderRadius:'50%', background:u.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:22, overflow:'hidden' }}>
                  {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : u.avatar}
                </div>
                <div style={{ position:'absolute', bottom:1, right:1, width:13, height:13, background:'#06d6a0', borderRadius:'50%', border:'2px solid #0a0a0a' }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:'white', fontWeight:700, fontSize:14, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>@{u.username}</div>
                <div style={{ color:'rgba(255,255,255,0.35)', fontSize:12, marginTop:2 }}>{conv?.lastMessage||'Tap to start chatting'}</div>
              </div>
              <div style={{ color:'rgba(255,255,255,0.2)', fontSize:11 }}>{conv?.lastMessageAt?'Now':''}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─────────────── CALL MODAL (REAL WebRTC) ─────────────── */
const CallModal = ({ type, contactName, contactAvatar, contactId, currentUser, onClose }) => {
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState('calling');
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const callDocId = useRef([[currentUser?.id, contactId].sort().join('_'), Date.now()].join('_'));

  useEffect(() => {
    let unsubAnswer = ()=>{};
    let unsubCandidates = ()=>{};

    const startCall = async () => {
      try {
        // Get local media
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === 'video',
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // Create peer connection using Google STUN servers
        // Fetch real TURN credentials from Metered
        let iceServers = [
          { urls: 'stun:stun.relay.metered.ca:80' },
        ];
        try {
          const turnRes = await fetch(
            'https://dagu_v1.metered.live/api/v1/turn/credentials?apiKey=7d52bf979697a1475416740a65a999ad38ea'
          );
          if (turnRes.ok) {
            iceServers = await turnRes.json();
          } else {
            throw new Error('fetch failed');
          }
        } catch (e) {
          console.warn('TURN fetch failed, using static fallback:', e);
          iceServers = [
            { urls: 'stun:stun.relay.metered.ca:80' },
            {
              urls: 'turn:global.relay.metered.ca:80',
              username: 'f5e29fd91b8ea2fc485c24ac',
              credential: 'FZlzkJ5GJJUyYocD',
            },
            {
              urls: 'turn:global.relay.metered.ca:80?transport=tcp',
              username: 'f5e29fd91b8ea2fc485c24ac',
              credential: 'FZlzkJ5GJJUyYocD',
            },
            {
              urls: 'turn:global.relay.metered.ca:443',
              username: 'f5e29fd91b8ea2fc485c24ac',
              credential: 'FZlzkJ5GJJUyYocD',
            },
            {
              urls: 'turns:global.relay.metered.ca:443?transport=tcp',
              username: 'f5e29fd91b8ea2fc485c24ac',
              credential: 'FZlzkJ5GJJUyYocD',
            },
          ];
        }
        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;

        // Add local tracks
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        // When we get remote stream
        pc.ontrack = (e) => {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
          setStatus('connected');
        };

        // Save ICE candidates to Firestore
        pc.onicecandidate = async (e) => {
          if (e.candidate) {
            await addDoc(
              collection(db, 'calls', callDocId.current, 'callerCandidates'),
              e.candidate.toJSON()
            );
          }
        };

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Save offer to Firestore
        await setDoc(doc(db, 'calls', callDocId.current), {
          offer: { type: offer.type, sdp: offer.sdp },
          callType: type,
          callerId: currentUser?.id,
          callerName: currentUser?.username,
          calleeId: contactId,
          calleeName: contactName,
          status: 'ringing',
          createdAt: serverTimestamp(),
        });

        // Send notification to callee
        await sendNotification(contactId, currentUser?.id, 'call',
          `is ${type === 'video' ? 'video' : 'voice'} calling you`,
          { callId: callDocId.current, callType: type }
        );

        // Listen for answer
        unsubAnswer = onSnapshot(doc(db, 'calls', callDocId.current), async (snap) => {
          const data = snap.data();
          if (data?.answer && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            setStatus('connected');
          }
          if (data?.status === 'declined') {
            setStatus('declined');
            setTimeout(onClose, 1500);
          }
        });

        // Listen for callee ICE candidates
        unsubCandidates = onSnapshot(
          collection(db, 'calls', callDocId.current, 'calleeCandidates'),
          (snap) => {
            snap.docChanges().forEach(async (change) => {
              if (change.type === 'added') {
                await pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
              }
            });
          }
        );
      } catch (e) {
        console.error('Call error:', e);
        if(e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError'){
          setStatus('failed');
          alert('Please allow camera/microphone access in your browser settings, then try again.');
        } else if(e.name === 'NotFoundError'){
          setStatus('failed');
          alert('No camera or microphone found on this device.');
        } else {
          setStatus('failed');
        }
        setTimeout(onClose, 2000);
      }
    };

    startCall();

    return () => {
      unsubAnswer();
      unsubCandidates();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
      // Mark call as ended in Firestore
      updateDoc(doc(db, 'calls', callDocId.current), { status: 'ended' }).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (status !== 'connected') return;
    const i = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(i);
  }, [status]);

  const fmt = () => {
    const m = Math.floor(duration / 60), s = duration % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(v => !v);
  };

  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCamOff(v => !v);
  };

  const statusLabel = {
    calling: type === 'video' ? 'Video calling...' : 'Calling...',
    connected: `Connected · ${fmt()}`,
    declined: 'Call declined',
    failed: 'Call failed',
  }[status] || 'Connecting...';

  return (
    <div style={{ position:'fixed', inset:0, background:'#0a0a0a', zIndex:2500, display:'flex', flexDirection:'column' }}>
      {/* Remote video (full screen) */}
      {type === 'video' && (
        <video ref={remoteVideoRef} autoPlay playsInline style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', background:'#111' }} />
      )}

      {/* Dark overlay when no remote video yet */}
      {status !== 'connected' && (
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(160deg,#0a0a1a,#1a0a0a)', zIndex:1 }}>
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 30%,rgba(255,45,85,0.2),transparent 60%)' }} />
        </div>
      )}

      {/* Local video (PiP) */}
      {type === 'video' && (
        <video ref={localVideoRef} autoPlay playsInline muted style={{ position:'absolute', top:60, right:16, width:100, height:140, objectFit:'cover', borderRadius:16, border:'2px solid rgba(255,255,255,0.2)', zIndex:10, background:'#222' }} />
      )}

      {/* Contact info */}
      <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:20, padding:'56px 20px 20px', textAlign:'center' }}>
        {type !== 'video' && (
          <div style={{ width:110, height:110, borderRadius:'50%', padding:3, background:'conic-gradient(#ff2d55,#af52de,#ff2d55)', margin:'0 auto 20px', animation:status==='calling'?'storyRing 4s linear infinite':'' }}>
            <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:'#1a0a0a', padding:2, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:'#ff2d55', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:42 }}>
                {contactAvatar || '?'}
              </div>
            </div>
          </div>
        )}
        <div style={{ color:'white', fontSize:22, fontWeight:800, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>@{contactName}</div>
        <div style={{ color:'rgba(255,255,255,0.5)', fontSize:13, marginTop:6 }}>{statusLabel}</div>
      </div>

      {/* Controls */}
      <div style={{ position:'absolute', bottom:60, left:0, right:0, zIndex:20, display:'flex', justifyContent:'center', gap:20 }}>
        {/* Mute */}
        <button onClick={toggleMute} style={{ background:isMuted?'rgba(255,45,85,0.9)':'rgba(255,255,255,0.12)', border:'none', borderRadius:'50%', width:60, height:60, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            {isMuted
              ? <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
              : <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
            }
          </svg>
        </button>

        {/* Hang up */}
        <button onClick={onClose} style={{ background:'#ff2d55', border:'none', borderRadius:'50%', width:70, height:70, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 0 30px rgba(255,45,85,0.5)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91"/>
            <line x1="23" y1="1" x2="1" y2="23"/>
          </svg>
        </button>

        {/* Camera toggle (video only) */}
        {type === 'video' && (
          <button onClick={toggleCam} style={{ background:isCamOff?'rgba(255,45,85,0.9)':'rgba(255,255,255,0.12)', border:'none', borderRadius:'50%', width:60, height:60, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              {isCamOff
                ? <><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3m3-3h6l2 3h4a2 2 0 012 2v9.34m-7.72-2.06a4 4 0 11-5.56-5.56"/></>
                : <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>
              }
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

/* ─────────────── SEARCH OVERLAY ─────────────── */
const SearchOverlay = ({ onClose, videos, users, onViewProfile }) => {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const results = useMemo(()=>{
    if(!query.trim()) return {videos:[],users:[],hashtags:[]};
    const q=query.toLowerCase();
    return {
      videos:videos.filter(v=>v.username.toLowerCase().includes(q)||v.description.toLowerCase().includes(q)).slice(0,6),
      users:users.filter(u=>u.username.toLowerCase().includes(q)).slice(0,6),
      hashtags:[...new Set(videos.flatMap(v=>v.hashtags||[]).filter(h=>h.toLowerCase().includes(q)))].slice(0,6),
    };
  },[query,videos,users]);
  return (
    <div style={{ position:'absolute', inset:0, background:'#0a0a0a', zIndex:200, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'14px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:10, alignItems:'center' }}>
        <div style={{ flex:1, display:'flex', alignItems:'center', background:'rgba(255,255,255,0.06)', borderRadius:28, padding:'10px 16px', border:'1px solid rgba(255,255,255,0.08)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" style={{ marginRight:10 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search anything..." style={{ flex:1, background:'none', border:'none', color:'white', outline:'none', fontSize:14 }} />
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:14, cursor:'pointer', fontWeight:600 }}>Cancel</button>
      </div>
      {query ? (
        <>
          <div style={{ display:'flex', padding:'8px 14px', gap:4, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            {['all','videos','users','hashtags'].map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{ background:tab===t?'rgba(255,45,85,0.15)':'none', border:tab===t?'1px solid rgba(255,45,85,0.3)':'1px solid transparent', padding:'5px 14px', color:tab===t?'#ff2d55':'rgba(255,255,255,0.4)', cursor:'pointer', borderRadius:20, fontSize:12, fontWeight:700, textTransform:'capitalize' }}>{t}</button>
            ))}
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:12 }}>
            {(tab==='all'||tab==='users')&&results.users.map(u=>(
              <div key={u.id} onClick={()=>{onViewProfile?.(u.id); onClose();}} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 12px', background:'rgba(255,255,255,0.03)', borderRadius:16, marginBottom:8, cursor:'pointer', border:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width:44, height:44, borderRadius:'50%', background:u.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:18, overflow:'hidden' }}>
                  {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : u.avatar}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ color:'white', fontWeight:700, fontSize:14, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>@{u.username}</div>
                  <div style={{ color:'rgba(255,255,255,0.3)', fontSize:11, marginTop:2 }}>{u.bio?.substring(0,45)}</div>
                </div>
              </div>
            ))}
            {(tab==='all'||tab==='videos')&&results.videos.map(v=>(
              <div key={v.id} style={{ padding:'12px 14px', background:'rgba(255,255,255,0.03)', borderRadius:16, marginBottom:8, border:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color:'#ff2d55', fontSize:12, fontWeight:700, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>@{v.username}</div>
                <div style={{ color:'rgba(255,255,255,0.8)', fontSize:13, marginTop:4 }}>{v.description}</div>
              </div>
            ))}
            {(tab==='all'||tab==='hashtags')&&results.hashtags.map(h=>(
              <div key={h} style={{ padding:'12px 16px', background:'rgba(255,255,255,0.03)', borderRadius:16, marginBottom:8, color:'#007aff', fontSize:16, fontWeight:700, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif", border:'1px solid rgba(255,255,255,0.05)' }}>{h}</div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ flex:1, padding:16 }}>
          <div style={{ color:'rgba(255,255,255,0.3)', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>Trending</div>
          {['#trending','#viral','#art','#music','#dance'].map(tag=>(
            <div key={tag} onClick={()=>setQuery(tag)} style={{ padding:'12px 16px', background:'rgba(255,255,255,0.03)', borderRadius:14, marginBottom:8, color:'#007aff', fontSize:15, fontWeight:700, border:'1px solid rgba(255,255,255,0.05)', cursor:'pointer', fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{tag}</div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────── CAMERA UPLOAD (REAL CLOUDINARY) ─────────────── */
const FILTERS = [
  { name:'Normal',   css:'' },
  { name:'Vivid',    css:'saturate(1.8) contrast(1.1)' },
  { name:'Warm',     css:'sepia(0.4) saturate(1.4) brightness(1.05)' },
  { name:'Cool',     css:'hue-rotate(20deg) saturate(1.2) brightness(1.05)' },
  { name:'B&W',      css:'grayscale(1)' },
  { name:'Fade',     css:'opacity(0.85) brightness(1.1) saturate(0.7)' },
  { name:'Drama',    css:'contrast(1.4) saturate(1.3) brightness(0.9)' },
  { name:'Bloom',    css:'brightness(1.2) saturate(0.8) blur(0.4px)' },
  { name:'Neon',     css:'saturate(2) hue-rotate(270deg) contrast(1.2)' },
  { name:'Vintage',  css:'sepia(0.6) contrast(0.9) brightness(0.95) saturate(0.8)' },
];

const CameraUpload = ({ onUpload, onClose, showToast, currentUser }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeFilter, setActiveFilter] = useState(0);
  const [cameraMode, setCameraMode] = useState('photo'); // 'photo' | 'video'
  const [recording, setRecording] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [flash, setFlash] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  const startCamera = async (facing = facingMode) => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video:{ facingMode: facing }, audio: true });
      streamRef.current = s;
      if(videoRef.current) videoRef.current.srcObject = s;
    } catch { showToast?.('Camera denied','error'); }
  };

  useEffect(() => { startCamera(); return () => { streamRef.current?.getTracks().forEach(t=>t.stop()); clearInterval(timerRef.current); }; }, []);

  const flipCamera = () => {
    const next = facingMode==='user'?'environment':'user';
    setFacingMode(next);
    startCamera(next);
  };

  const capturePhoto = () => {
    if(!videoRef.current) return;
    const c = document.createElement('canvas');
    c.width = videoRef.current.videoWidth;
    c.height = videoRef.current.videoHeight;
    const ctx = c.getContext('2d');
    if(flash){ ctx.fillStyle='white'; ctx.fillRect(0,0,c.width,c.height); }
    ctx.filter = FILTERS[activeFilter].css || 'none';
    ctx.drawImage(videoRef.current, 0, 0);
    c.toBlob(blob => {
      setSelectedFile({ file: new File([blob],'photo.jpg',{type:'image/jpeg'}), url: URL.createObjectURL(blob), type:'image/jpeg' });
    }, 'image/jpeg');
  };

  const startRecording = () => {
    if(!streamRef.current) return;
    chunksRef.current = [];
    const r = new MediaRecorder(streamRef.current);
    r.ondataavailable = e => chunksRef.current.push(e.data);
    r.onstop = () => {
      const blob = new Blob(chunksRef.current, { type:'video/webm' });
      setSelectedFile({ file: new File([blob],'video.webm',{type:'video/webm'}), url: URL.createObjectURL(blob), type:'video/webm' });
    };
    r.start();
    recorderRef.current = r;
    setRecording(true);
    setRecordSeconds(0);
    timerRef.current = setInterval(() => setRecordSeconds(s => { if(s>=59){ stopRecording(); return 60; } return s+1; }), 1000);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
    clearInterval(timerRef.current);
  };

  const handleFileSelect = e => {
    const f = e.target.files[0];
    if(f) setSelectedFile({ file:f, url:URL.createObjectURL(f), type:f.type });
  };

  const handleUpload = async () => {
    if(!selectedFile){ showToast?.('Capture or select media first','error'); return; }
    setUploading(true); setUploadProgress(0);
    try {
      const mediaUrl = await uploadToCloudinary(selectedFile.file, setUploadProgress);
      const videoData = {
        userId: currentUser.id,
        username: currentUser.username || '',
        avatar: currentUser.avatar || (currentUser.username||'U')[0].toUpperCase(),
        avatarColor: currentUser.avatarColor || '#ff2d55',
        avatarUrl: currentUser.avatarUrl || null,
        verified: currentUser.verified || false,
        description: description || 'New post! 🔥',
        videoUrl: mediaUrl,
        mediaType: selectedFile.type,
        song: 'Original sound',
        likes: 0, comments: 0, shares: 0, views: 0,
        hashtags: (description||'').match(/#\w+/g) || [],
        category: 'foryou',
        filter: FILTERS[activeFilter].name,
        createdAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db,'videos'), videoData);
      onUpload?.({ id:ref.id, ...videoData, videoUrl:mediaUrl, createdAt:{ toDate: ()=>new Date() } });
      showToast?.('Posted! 🚀','success');
      onClose?.();
    } catch(e) {
      showToast?.('Upload failed: '+e.message,'error');
    }
    setUploading(false);
  };

  const filterStyle = { filter: FILTERS[activeFilter].css || 'none' };

  // Preview screen (after capture)
  if(selectedFile) return (
    <div style={{ position:'fixed', inset:0, background:'#000', zIndex:100, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <button onClick={()=>setSelectedFile(null)} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:20, padding:'8px 16px', color:'white', cursor:'pointer', fontSize:13 }}>Retake</button>
        <span style={{ color:'white', fontWeight:800, fontSize:16, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>New Post</span>
        <button onClick={handleUpload} disabled={uploading} style={{ background:'linear-gradient(135deg,#ff2d55,#af52de)', border:'none', borderRadius:20, padding:'8px 18px', color:'white', fontWeight:700, cursor:'pointer', fontSize:13, opacity:uploading?0.7:1 }}>
          {uploading ? `${uploadProgress}%` : 'Post ✓'}
        </button>
      </div>
      {uploading && <div style={{ height:3, background:'rgba(255,255,255,0.1)' }}><div style={{ height:'100%', background:'linear-gradient(90deg,#ff2d55,#af52de)', width:`${uploadProgress}%`, transition:'width 0.3s' }} /></div>}
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        {selectedFile.type.startsWith('image/') 
          ? <img src={selectedFile.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', ...filterStyle }} />
          : <video src={selectedFile.url} style={{ width:'100%', height:'100%', objectFit:'cover' }} controls autoPlay loop />
        }
      </div>
      {/* Filter strip on preview */}
      <div style={{ padding:'10px 0', background:'rgba(0,0,0,0.8)', overflowX:'auto', display:'flex', gap:10, paddingLeft:16 }}>
        {FILTERS.map((f,i)=>(
          <div key={f.name} onClick={()=>setActiveFilter(i)} style={{ flexShrink:0, textAlign:'center', cursor:'pointer' }}>
            <div style={{ width:56, height:56, borderRadius:14, overflow:'hidden', border: i===activeFilter?'2px solid #ff2d55':'2px solid transparent' }}>
              <img src={selectedFile.type.startsWith('image/')?selectedFile.url:'https://picsum.photos/56'} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', filter: f.css||'none' }} />
            </div>
            <div style={{ color: i===activeFilter?'#ff2d55':'rgba(255,255,255,0.5)', fontSize:9, marginTop:4, fontWeight:700 }}>{f.name}</div>
          </div>
        ))}
      </div>
      <div style={{ padding:'10px 16px 32px', background:'rgba(0,0,0,0.9)' }}>
        <textarea placeholder="Write a caption... #hashtags" value={description} onChange={e=>setDescription(e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, padding:'12px 14px', color:'white', minHeight:70, outline:'none', fontSize:13, resize:'none', boxSizing:'border-box' }} />
      </div>
    </div>
  );

  // Camera screen
  return (
    <div style={{ position:'fixed', inset:0, background:'#000', zIndex:100, display:'flex', flexDirection:'column' }}>
      {/* Top bar */}
      <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:10, padding:'50px 16px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <button onClick={onClose} style={{ background:'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%', width:40, height:40, color:'white', cursor:'pointer', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={()=>setFlash(!flash)} style={{ background: flash?'rgba(255,215,0,0.3)':'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%', width:40, height:40, color: flash?'#ffd700':'white', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>⚡</button>
          <button onClick={flipCamera} style={{ background:'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%', width:40, height:40, color:'white', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>🔄</button>
          <button onClick={()=>setShowFilters(!showFilters)} style={{ background: showFilters?'rgba(255,45,85,0.5)':'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%', width:40, height:40, color:'white', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>✨</button>
        </div>
      </div>

      {/* Camera viewfinder */}
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%', height:'100%', objectFit:'cover', ...filterStyle }} />
        {/* Recording timer */}
        {recording && (
          <div style={{ position:'absolute', top:60, left:'50%', transform:'translateX(-50%)', background:'rgba(255,45,85,0.9)', borderRadius:20, padding:'6px 16px', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'white', animation:'pulse 1s infinite' }} />
            <span style={{ color:'white', fontWeight:700, fontSize:14 }}>00:{String(recordSeconds).padStart(2,'0')}</span>
          </div>
        )}
        {/* Live filter strip */}
        {showFilters && (
          <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'10px 0 10px 16px', background:'linear-gradient(transparent,rgba(0,0,0,0.7))', overflowX:'auto', display:'flex', gap:10 }}>
            {FILTERS.map((f,i)=>(
              <div key={f.name} onClick={()=>setActiveFilter(i)} style={{ flexShrink:0, textAlign:'center', cursor:'pointer' }}>
                <div style={{ width:52, height:52, borderRadius:12, background:'rgba(255,255,255,0.15)', border: i===activeFilter?'2px solid #ff2d55':'2px solid transparent', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                  <div style={{ width:'100%', height:'100%', background: i===0?'linear-gradient(135deg,#888,#444)':i===1?'linear-gradient(135deg,#ff6b6b,#ffa500)':i===2?'linear-gradient(135deg,#ffd700,#ff8c00)':i===3?'linear-gradient(135deg,#00bfff,#1e90ff)':i===4?'linear-gradient(135deg,#888,#222)':i===5?'linear-gradient(135deg,#ddd,#aaa)':i===6?'linear-gradient(135deg,#333,#000)':i===7?'linear-gradient(135deg,#ffe,#ffd)':i===8?'linear-gradient(135deg,#ff00ff,#00ffff)':'linear-gradient(135deg,#c8a97e,#8b6f47)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:9, color:'white', fontWeight:700 }}>{f.name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{ background:'rgba(0,0,0,0.9)', padding:'20px 0 48px' }}>
        {/* Photo / Video toggle */}
        <div style={{ display:'flex', justifyContent:'center', gap:28, marginBottom:24 }}>
          {['photo','video'].map(m=>(
            <button key={m} onClick={()=>setCameraMode(m)} style={{ background:'none', border:'none', color: cameraMode===m?'white':'rgba(255,255,255,0.35)', fontSize:13, fontWeight:700, cursor:'pointer', textTransform:'uppercase', letterSpacing:1, borderBottom: cameraMode===m?'2px solid #ff2d55':'2px solid transparent', paddingBottom:4 }}>{m}</button>
          ))}
        </div>

        {/* Capture row */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingLeft:60, paddingRight:60 }}>
          {/* Gallery */}
          <button onClick={()=>fileInputRef.current?.click()} style={{ width:48, height:48, borderRadius:14, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:22 }}>🖼️</button>
          <input ref={fileInputRef} type="file" accept="video/*,image/*" onChange={handleFileSelect} style={{ display:'none' }} />

          {/* Shutter / Record */}
          {cameraMode==='photo' ? (
            <button onClick={capturePhoto} style={{ width:76, height:76, borderRadius:'50%', background:'white', border:'5px solid rgba(255,255,255,0.3)', cursor:'pointer', position:'relative' }}>
              <div style={{ position:'absolute', inset:4, borderRadius:'50%', background:'white' }} />
            </button>
          ) : (
            <button onClick={recording?stopRecording:startRecording} style={{ width:76, height:76, borderRadius:'50%', background: recording?'#ff2d55':'white', border:'5px solid rgba(255,255,255,0.3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {recording
                ? <div style={{ width:24, height:24, borderRadius:4, background:'white' }} />
                : <div style={{ width:76, height:76, borderRadius:'50%', background:'#ff2d55' }} />
              }
            </button>
          )}

          {/* Flip (right side placeholder for symmetry) */}
          <button onClick={flipCamera} style={{ width:48, height:48, borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:22 }}>🔄</button>
        </div>
      </div>
    </div>
  );
};

  
/* ─────────────── SOUND LIBRARY ─────────────── */
const SoundLibraryPage = ({ onSelectSound, onClose }) => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(()=>!search?SOUND_LIBRARY:SOUND_LIBRARY.filter(s=>s.name.toLowerCase().includes(search.toLowerCase())),[search]);
  return (
    <div style={{ position:'fixed', inset:0, background:'#0a0a0a', zIndex:200, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h2 style={{ color:'white', fontSize:20, fontWeight:800, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Sounds</h2>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'none', borderRadius:20, padding:'8px 16px', color:'white', cursor:'pointer', fontSize:13 }}>Close</button>
      </div>
      <div style={{ padding:'10px 16px' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search sounds..." style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:28, padding:'11px 16px', color:'white', outline:'none', fontSize:13, boxSizing:'border-box' }} />
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'0 14px' }}>
        {filtered.map(sound=>(
          <div key={sound.id} onClick={()=>onSelectSound(sound)} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 12px', background:'rgba(255,255,255,0.03)', borderRadius:18, marginBottom:8, cursor:'pointer', border:'1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width:48, height:48, borderRadius:16, background:'linear-gradient(135deg,#ff2d55,#af52de)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🎵</div>
            <div style={{ flex:1 }}>
              <div style={{ color:'white', fontWeight:700, fontSize:13, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{sound.name}</div>
              <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, marginTop:2 }}>{sound.artist} · {sound.duration}</div>
            </div>
            {sound.popular && <span style={{ color:'#ff9500', fontSize:11, fontWeight:700 }}>🔥 {formatNumber(sound.usage)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────── ANALYTICS (REAL DATA) ─────────────── */
const CreatorAnalytics = ({ user, videos, onClose }) => {
  const userVideos = videos.filter(v=>v.userId===user?.id);
  const totalViews = userVideos.reduce((s,v)=>s+(v.views||0),0);
  const totalLikes = userVideos.reduce((s,v)=>s+(v.likes||0),0);
  const totalComments = userVideos.reduce((s,v)=>s+(v.comments||0),0);
  // Build weekly data from actual posts
  const now = new Date();
  const weeklyData = Array.from({length:7},(_,i)=>{
    const day = new Date(now); day.setDate(day.getDate()-6+i);
    return userVideos.filter(v=>{
      if(!v.createdAt) return false;
      const d = v.createdAt.toDate ? v.createdAt.toDate() : new Date(v.createdAt);
      return d.toDateString()===day.toDateString();
    }).reduce((s,v)=>s+(v.views||0),0);
  });
  const maxVal = Math.max(...weeklyData,1);

  return (
    <div style={{ position:'fixed', inset:0, background:'#0a0a0a', zIndex:200, overflow:'auto' }}>
      <div style={{ padding:'60px 20px 20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ color:'white', fontSize:24, fontWeight:800, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Analytics</h2>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'none', borderRadius:20, padding:'8px 18px', color:'white', cursor:'pointer', fontSize:13 }}>Close</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:20 }}>
          {[['Total Views',formatNumber(totalViews),'#06d6a0'],['Total Likes',formatNumber(totalLikes),'#ff2d55'],['Posts',String(userVideos.length),'#af52de'],['Coins',String(user?.coins||0),'#ffd700']].map(([label,val,color])=>(
            <div key={label} style={{ background:'rgba(255,255,255,0.03)', borderRadius:20, padding:20, border:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, textTransform:'uppercase', letterSpacing:0.5 }}>{label}</div>
              <div style={{ color:color, fontSize:28, fontWeight:800, marginTop:6, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:20, padding:20, marginBottom:16, border:'1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ color:'white', marginBottom:16, fontSize:14, fontWeight:700, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Weekly Views</h3>
          <div style={{ height:120, display:'flex', alignItems:'flex-end', gap:6 }}>
            {weeklyData.map((v,i)=>(
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ width:'100%', height:`${Math.max((v/maxVal)*100,4)}%`, background:`linear-gradient(180deg,#ff2d55,#af52de)`, borderRadius:6 }} />
                <span style={{ color:'rgba(255,255,255,0.3)', fontSize:9 }}>{['M','T','W','T','F','S','S'][i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:20, padding:20, border:'1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ color:'white', marginBottom:12, fontSize:14, fontWeight:700, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Top Videos</h3>
          {userVideos.sort((a,b)=>(b.views||0)-(a.views||0)).slice(0,3).map(v=>(
            <div key={v.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, padding:'10px 12px', background:'rgba(255,255,255,0.03)', borderRadius:14 }}>
              <div style={{ color:'white', fontSize:12, flex:1, marginRight:10 }}>{v.description?.substring(0,30)}...</div>
              <div style={{ color:'#06d6a0', fontSize:12, fontWeight:700 }}>{formatNumber(v.views||0)} views</div>
            </div>
          ))}
          {userVideos.length===0 && <div style={{textAlign:'center',color:'rgba(255,255,255,0.2)',padding:20}}>Post videos to see analytics</div>}
        </div>
      </div>
    </div>
  );
};

/* ─────────────── QR CODE ─────────────── */
const QRCodePage = ({ user, onClose }) => (
  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
    <div style={{ background:'#111', borderRadius:28, padding:32, textAlign:'center', maxWidth:300, width:'100%', margin:'0 20px', border:'1px solid rgba(255,255,255,0.08)', position:'relative' }}>
      <button onClick={onClose} style={{ position:'absolute', top:14, right:14, background:'rgba(255,255,255,0.08)', border:'none', borderRadius:'50%', width:32, height:32, color:'white', cursor:'pointer', fontSize:16 }}>✕</button>
      <div style={{ color:'white', fontWeight:800, fontSize:18, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>My QR Code</div>
      <div style={{ width:180, height:180, background:'white', margin:'0 auto 20px', borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', backgroundImage:'repeating-linear-gradient(45deg,#000 0,#000 2px,#fff 2px,#fff 8px)' }}>
        <div style={{ width:140, height:140, background:'white', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
          <div style={{ fontSize:36 }}>🎬</div>
          <div style={{ fontSize:11, fontWeight:'bold', marginTop:6 }}>@{user?.username}</div>
        </div>
      </div>
      <h3 style={{ color:'white', marginBottom:4, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>@{user?.username}</h3>
      <p style={{ color:'rgba(255,255,255,0.35)', fontSize:12, marginBottom:20 }}>Scan to follow on Infinity</p>
      <button onClick={()=>navigator.share?.({title:'Infinity',text:`Follow @${user?.username} on Infinity`,url:`https://infinity-now.vercel.app`
})} style={{ width:'100%', background:'linear-gradient(135deg,#ff2d55,#af52de)', border:'none', borderRadius:20, padding:13, color:'white', fontWeight:700, cursor:'pointer', fontSize:14, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Share Profile</button>
    </div>
  </div>
);

/* ─────────────── GUEST FEED ─────────────── */
const GuestFeed = ({ onSignIn }) => {
  const [videos, setVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const startY = useRef(null);

  useEffect(()=>{
    const q = query(collection(db,'videos'), orderBy('createdAt','desc'));
    const unsub = onSnapshot(q, snap=>{
      setVideos(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return ()=>unsub();
  },[]);

  const handleTouchStart = e => { startY.current = e.touches[0].clientY; };
  const handleTouchEnd = e => {
    if(startY.current===null) return;
    const dy = startY.current - e.changedTouches[0].clientY;
    if(Math.abs(dy)>50){
      if(dy>0) setCurrentIndex(i=>Math.min(videos.length-1,i+1));
      else setCurrentIndex(i=>Math.max(0,i-1));
    }
    startY.current = null;
  };

  return (
    <div style={{ height:'100%', position:'relative', overflow:'hidden', background:'#000' }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {videos.map((video,idx)=>(
        <div key={video.id} style={{ position:'absolute', inset:0, translate:`0 ${(idx-currentIndex)*100}%`, transition:'translate 0.3s cubic-bezier(0.25,0.46,0.45,0.94)', pointerEvents:idx===currentIndex?'auto':'none' }}>
          {video.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i)
            ? <img src={video.videoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : <video src={video.videoUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} loop autoPlay muted playsInline />
          }
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 50%)' }} />
          <div style={{ position:'absolute', bottom:100, left:14, right:14 }}>
            <div style={{ color:'white', fontWeight:700, fontSize:15 }}>@{video.username}</div>
            <div style={{ color:'rgba(255,255,255,0.8)', fontSize:13, marginTop:4 }}>{video.description}</div>
          </div>
        </div>
      ))}
      <div style={{ position:'absolute', bottom:28, left:0, right:0, display:'flex', justifyContent:'center', zIndex:20 }}>
        <button onClick={onSignIn} style={{ background:'linear-gradient(135deg,#ff2d55,#af52de)', border:'none', borderRadius:28, padding:'14px 36px', color:'white', fontWeight:800, fontSize:15, cursor:'pointer', boxShadow:'0 4px 24px rgba(255,45,85,0.5)' }}>
          Sign in to interact 🚀
        </button>
      </div>
    </div>
  );
};

/* ─────────────── AUTH SCREEN (REAL FIREBASE) ─────────────── */
const AuthScreen = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [step, setStep] = useState('method');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingOtp, setPendingOtp] = useState('');
  const [pendingCreds, setPendingCreds] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpExpiry, setOtpExpiry] = useState(()=>Date.now() + 10*60*1000);

  const handleGoogleLogin = async () => {
    setLoading(true); setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      let profile = await getUserProfile(fbUser.uid);
      if(!profile){
  // Check if a user doc with this email already exists (e.g. from a previous signup)
  const emailSnap = await getDocs(query(collection(db,'users'), where('email','==',fbUser.email||'')));
  if(!emailSnap.empty){
    // Profile exists under a different UID mapping — reuse it
    profile = emailSnap.docs[0].data();
    profile.id = emailSnap.docs[0].id;
  } else {
    const baseUsername = (fbUser.displayName||fbUser.email||'user')
      .split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g,'');
    // Make username unique but stable: based on UID not random
    const uname = baseUsername + fbUser.uid.slice(-4);
    await createUserProfile(fbUser.uid,{
      username: uname,
      fullName: fbUser.displayName||'',
      email: fbUser.email||'',
      avatarUrl: fbUser.photoURL||null,
      avatarColor: `hsl(${Math.floor(Math.random()*360)},70%,60%)`,
    });
    profile = await getUserProfile(fbUser.uid);
  }
}
      if(profile) onLogin({...profile, id:fbUser.uid});
    } catch(e){ 
      console.error('Google auth error:', e.code, e.message);
      if(e.code === 'auth/popup-blocked'){
        setError('Popup was blocked. Please allow popups for this site.');
      } else if(e.code === 'auth/popup-closed-by-user'){
        setError('Sign-in was cancelled.');
      } else if(e.code === 'auth/unauthorized-domain'){
        setError('This domain is not authorized. Add it in Firebase Console.');
      } else {
        setError(e.message?.replace('Firebase: ','').replace(/\(auth\/[^)]+\)\.?/g,'').trim() || 'Google sign-in failed.');
      }
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
  setLoading(true); setError('');
  try {
    if(isLogin){
      const result = await signInWithEmailAndPassword(auth, identifier, password);
if(!result.user.emailVerified){
  await signOut(auth);
  setError('Please verify your email. Check your inbox for the verification link.');
  setLoading(false);
  return;
}
      let profile = await getUserProfile(result.user.uid);
      if(!profile){
        await createUserProfile(result.user.uid,{email:identifier, username:identifier.split('@')[0]});
        profile = await getUserProfile(result.user.uid);
      }
      onLogin({...profile, id:result.user.uid});
    } else {
      if(!username){ setError('Username required'); setLoading(false); return; }
      if(!fullName){ setError('Full name required'); setLoading(false); return; }

      const usersSnap = await getDocs(query(collection(db,'users'), where('username','==',username)));
      if(!usersSnap.empty){ setError('Username already taken'); setLoading(false); return; }

      const emailSnap = await getDocs(query(collection(db,'users'), where('email','==',identifier)));
      if(!emailSnap.empty){
        await deleteDoc(doc(db,'users',emailSnap.docs[0].id));
      }

      const otp = String(Math.floor(100000 + Math.random() * 900000));
await sendEmailJS({
  to_email: identifier,
  from_name: 'Infinity',
  message: `Your Infinity verification code is: ${otp}\n\nExpires in 10 minutes.`,
  otp_code: otp,
  code: otp,
});
      setPendingOtp(otp);
setPendingCreds({ email: identifier, password, username, fullName });
setOtpExpiry(Date.now() + 10*60*1000);
setStep('otp');
      setLoading(false);
      return;
    }
  } catch(e){
    console.error('Auth error:', e.code, e.message);
    if (e.code === 'auth/operation-not-allowed') {
      setError('Email sign-in is not enabled. Contact support.');
    } else if (e.code === 'auth/email-already-in-use') {
      setError('This email is already registered. Please sign in instead.');
    } else if (e.code === 'auth/weak-password') {
      setError('Password must be at least 6 characters.');
    } else if (e.code === 'auth/invalid-email') {
      setError('Please enter a valid email address.');
    } else if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
      setError('Incorrect email or password.');
    } else {
      setError(e.message?.replace('Firebase: ','').replace(/\(auth\/[^)]+\)\.?/g,'').trim() || e.code || 'Something went wrong.');
    }
  }
  setLoading(false);
};

  const handleMethodSelect = m => {
    if(m.id==='google'){ handleGoogleLogin(); return; }
    setSelectedMethod(m); setStep('credentials');
  };

  if(step==='guest') return (
    <GuestFeed onSignIn={()=>setStep('method')} />
  );

  if(step==='method') return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#0a0a0a', overflow:'auto' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 24px 20px', position:'relative' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 30%,rgba(255,45,85,0.2),rgba(175,82,222,0.1),transparent 65%)' }} />
        <div style={{ position:'relative', textAlign:'center', marginBottom:40 }}>
          <img src="https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png" style={{ width:80, height:80, borderRadius:24, objectFit:'cover', margin:'0 auto 20px', display:'block', boxShadow:'0 20px 60px rgba(255,45,85,0.4)' }} />
          <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, marginTop:10 }}>{isLogin?'Welcome back! 👋':'Join the community 🎉'}</p>
        </div>
        <div style={{ position:'relative', width:'100%', maxWidth:340 }}>
          <div style={{ color:'rgba(255,255,255,0.3)', fontSize:11, marginBottom:14, textAlign:'center', fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>{isLogin?'Sign in with':'Sign up with'}</div>
          {error && error.trim().length > 1 && <div style={{background:'rgba(255,45,85,0.1)',border:'1px solid rgba(255,45,85,0.3)',borderRadius:12,padding:'10px 14px',color:'#ff2d55',fontSize:12,marginBottom:12,textAlign:'center'}}>{error}</div>}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginBottom:24 }}>
            {LOGIN_METHODS.map(m=>(
              <button key={m.id} onClick={()=>handleMethodSelect(m)} disabled={loading} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.05)', border:`1px solid rgba(255,255,255,0.1)`, borderRadius:30, padding:'8px 16px', cursor:'pointer', fontSize:13, color:'rgba(255,255,255,0.8)', transition:'all 0.15s', opacity:loading?0.5:1 }}>
                <span style={{ fontSize:16 }}>{m.icon}</span>{m.name}
              </button>
            ))}
          </div>
          {loading && <div style={{textAlign:'center',color:'rgba(255,255,255,0.5)',fontSize:13,marginBottom:12}}>⏳ Signing in...</div>}
          <button onClick={()=>setIsLogin(!isLogin)} style={{ width:'100%', background:'none', border:'none', color:'#ff2d55', fontSize:14, cursor:'pointer', fontWeight:600 }}>
            {isLogin?"Don't have an account? Sign up →":"Already have an account? Sign in →"}
          </button>
          {isLogin && (
            <button onClick={()=>setStep('resetpw')} style={{ width:'100%', background:'none', border:'none', color:'rgba(255,255,255,0.35)', fontSize:13, cursor:'pointer', marginTop:10, textDecoration:'underline' }}>
              Forgot password?
            </button>
          )}
          <button onClick={()=>setStep('guest')} style={{ width:'100%', background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:13, cursor:'pointer', marginTop:10 }}>
            👁 Browse without account
          </button>
        </div>
      </div>
      <div style={{ padding:'0 24px 40px', textAlign:'center', color:'rgba(255,255,255,0.2)', fontSize:11 }}>By continuing, you agree to our Terms of Service & Privacy Policy</div>
    </div>
  );
if(step==='otp') return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,background:'#0a0a0a'}}>
      <div style={{textAlign:'center',maxWidth:300,width:'100%'}}>
        <div style={{fontSize:64,marginBottom:16}}>📲</div>
        <div style={{color:'white',fontWeight:800,fontSize:22,marginBottom:10,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>Enter OTP</div>
        <div style={{color:'rgba(255,255,255,0.5)',fontSize:14,lineHeight:1.6,marginBottom:20}}>
          We sent a 6-digit code to <strong style={{color:'white'}}>{pendingCreds?.email}</strong>
        </div>
        {error && <div style={{background:'rgba(255,45,85,0.1)',border:'1px solid rgba(255,45,85,0.3)',borderRadius:12,padding:'10px 14px',color:'#ff2d55',fontSize:12,marginBottom:12}}>{error}</div>}
        <input
          placeholder="000000"
          value={otpInput}
          onChange={e=>setOtpInput(e.target.value.replace(/\D/g,'').slice(0,6))}
          style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,padding:'16px',color:'white',marginBottom:12,outline:'none',fontSize:28,boxSizing:'border-box',textAlign:'center',letterSpacing:12,fontWeight:800}}
          maxLength={6}
        />
        <button onClick={async()=>{
          if(Date.now() > otpExpiry){ setError('OTP expired. Please sign up again.'); return; }
          if(otpInput.trim() !== pendingOtp.trim()){ setError('Incorrect code. Try again.'); return; }
          setLoading(true); setError('');
          try {
            const result = await createUserWithEmailAndPassword(auth, pendingCreds.email, pendingCreds.password);
await createUserProfile(result.user.uid, {
  username: pendingCreds.username,
  fullName: pendingCreds.fullName,
  email: pendingCreds.email,
});
// Wait for Firestore write to propagate
await new Promise(r => setTimeout(r, 1500));
const profile = await getUserProfile(result.user.uid);
if(profile) {
  onLogin({...profile, id: result.user.uid});
} else {
  // Profile exists in Auth, build it from what we know and log in directly
  const fallbackProfile = {
    id: result.user.uid,
    username: pendingCreds.username,
    fullName: pendingCreds.fullName,
    email: pendingCreds.email,
    avatar: (pendingCreds.username||'U')[0].toUpperCase(),
    avatarColor: `hsl(${Math.floor(Math.random()*360)},70%,60%)`,
    avatarUrl: null,
    bio: 'New to Infinity! 🎬',
    followers: [],
    following: [],
    coins: 500,
    walletBalance: 500,
    verified: false,
    subscription: 'free',
    streak: 1,
    level: 1,
  };
  onLogin(fallbackProfile);
}
          } catch(e){
            console.error('OTP verify error:', e.code, e.message);
            if(e.code === 'auth/email-already-in-use'){
              setError('This email is already registered. Please sign in instead.');
            } else if(e.code === 'auth/weak-password'){
              setError('Password must be at least 6 characters.');
            } else if(e.code === 'auth/invalid-email'){
              setError('Invalid email address.');
            } else if(e.code === 'auth/network-request-failed'){
              setError('Network error. Check your connection and try again.');
            } else {
              setError(e.message?.replace('Firebase: ','').replace(/\(auth\/[^)]+\)\.?/g,'').trim() || 'Account creation failed. Please try again.');
            }
          }
          setLoading(false);
        }} disabled={loading||otpInput.length!==6} style={{width:'100%',background:'linear-gradient(135deg,#ff2d55,#af52de)',border:'none',borderRadius:24,padding:15,color:'white',fontWeight:700,cursor:'pointer',fontSize:15,marginBottom:12,opacity:(loading||otpInput.length!==6)?0.5:1,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>
          {loading?'Verifying...':'Verify & Create Account'}
        </button>
        <button onClick={async()=>{
  setLoading(true);
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await sendEmailJS({ 
    to_email: pendingCreds.email, 
    from_name: 'Infinity', 
    message: `Your new Infinity code: ${otp}`,
    otp_code: otp,
    code: otp,
  });
  setPendingOtp(otp);
setOtpExpiry(Date.now() + 10*60*1000);
setOtpInput('');
setError('');
setLoading(false);
}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:13,cursor:'pointer',textDecoration:'underline',marginBottom:8}}>
          Resend code
        </button>
        <br/>
        <button onClick={()=>{setStep('credentials');setError('');setOtpInput('');}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:13,cursor:'pointer',textDecoration:'underline'}}>
          Back
        </button>
      </div>
    </div>
  );
  if(step==='resetpw') return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,background:'#0a0a0a'}}>
      <div style={{textAlign:'center',maxWidth:300,width:'100%'}}>
        <div style={{fontSize:64,marginBottom:16}}>🔑</div>
        <div style={{color:'white',fontWeight:800,fontSize:22,marginBottom:10,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>Reset Password</div>
        <div style={{color:'rgba(255,255,255,0.5)',fontSize:14,lineHeight:1.6,marginBottom:20}}>Enter your email and we'll send a reset link.</div>
        {error && <div style={{background:'rgba(255,45,85,0.1)',border:'1px solid rgba(255,45,85,0.3)',borderRadius:12,padding:'10px 14px',color:'#ff2d55',fontSize:12,marginBottom:12}}>{error}</div>}
        <input placeholder="Your email" value={identifier} onChange={e=>setIdentifier(e.target.value)} style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,padding:'13px 16px',color:'white',marginBottom:12,outline:'none',fontSize:14,boxSizing:'border-box'}}/>
        <button onClick={async()=>{
          if(!identifier){setError('Enter your email'); return;}
          setLoading(true); setError('');
          try{
            await sendPasswordResetEmail(auth, identifier);
            setStep('resetpw_sent');
          }catch(e){
            setError('Could not send reset email: '+(e.message||''));
          }
          setLoading(false);
        }} disabled={loading} style={{width:'100%',background:'linear-gradient(135deg,#ff2d55,#af52de)',border:'none',borderRadius:24,padding:15,color:'white',fontWeight:700,cursor:'pointer',fontSize:15,marginBottom:12,opacity:loading?0.6:1,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>
          {loading?'Sending...':'Send Reset Link'}
        </button>
        <button onClick={()=>{setStep('method');setError('');}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:13,cursor:'pointer',textDecoration:'underline'}}>Back to sign in</button>
      </div>
    </div>
  );

  if(step==='verify') return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,background:'#0a0a0a'}}>
      <div style={{textAlign:'center',maxWidth:300}}>
        <div style={{fontSize:64,marginBottom:16}}>📧</div>
        <div style={{color:'white',fontWeight:800,fontSize:22,marginBottom:10,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>Verify your email</div>
        <div style={{color:'rgba(255,255,255,0.5)',fontSize:14,lineHeight:1.6,marginBottom:28}}>We sent a link to <strong style={{color:'white'}}>{identifier}</strong>. Click it then come back to sign in.</div>
        <button onClick={()=>{setStep('method');setIsLogin(true);}} style={{width:'100%',background:'linear-gradient(135deg,#ff2d55,#af52de)',border:'none',borderRadius:24,padding:15,color:'white',fontWeight:700,cursor:'pointer',fontSize:15,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>Go to Sign In →</button>
      </div>
    </div>
  );
return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'#0a0a0a' }}>
      <div style={{ width:'100%', maxWidth:340 }}>
        <button onClick={()=>setStep('method')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', marginBottom:24, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', gap:6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
        </button>
        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:24, padding:24, border:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24 }}>
            <div style={{ width:52, height:52, borderRadius:16, background:`${selectedMethod?.color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>{selectedMethod?.icon}</div>
            <div>
              <div style={{ color:'white', fontWeight:800, fontSize:16, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{isLogin?'Sign in':'Sign up'}</div>
              <div style={{ color:'rgba(255,255,255,0.35)', fontSize:12 }}>with {selectedMethod?.name}</div>
            </div>
          </div>
          {error && <div style={{background:'rgba(255,45,85,0.1)',border:'1px solid rgba(255,45,85,0.3)',borderRadius:12,padding:'10px 14px',color:'#ff2d55',fontSize:12,marginBottom:12}}>{error}</div>}
          {!isLogin && <>
            <input placeholder="Full Name" value={fullName} onChange={e=>setFullName(e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'13px 16px', color:'white', marginBottom:10, outline:'none', fontSize:14, boxSizing:'border-box' }} />
            <input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'13px 16px', color:'white', marginBottom:10, outline:'none', fontSize:14, boxSizing:'border-box' }} />
          </>}
          <input placeholder="Email" value={identifier} onChange={e=>setIdentifier(e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'13px 16px', color:'white', marginBottom:10, outline:'none', fontSize:14, boxSizing:'border-box' }} />
          <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'13px 16px', color:'white', marginBottom:14, outline:'none', fontSize:14, boxSizing:'border-box' }} />
          <button onClick={handleSubmit} disabled={loading||!identifier||!password||(!isLogin&&(!username||!fullName))} style={{ width:'100%', background:'linear-gradient(135deg,#ff2d55,#af52de)', border:'none', borderRadius:24, padding:15, color:'white', fontWeight:700, cursor:'pointer', fontSize:15, opacity:(loading||!identifier||!password)?0.5:1, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>
            {loading?'Please wait...':'Continue'}
          </button>
          {isLogin && (
  <button
    onClick={async () => {
      if (!identifier) { setError('Enter your email first'); return; }
      try {
        await sendPasswordResetEmail(auth, identifier);
        setError('');
        alert('Password reset email sent! Check your inbox.');
      } catch (e) {
        setError('Could not send reset email: ' + e.message);
      }
    }}
    style={{
      width: '100%', background: 'none', border: 'none',
      color: 'rgba(255,255,255,0.4)', fontSize: 13,
      cursor: 'pointer', marginTop: 10, textDecoration: 'underline'
    }}
  >
    Forgot password?
  </button>
)}
        </div>
      </div>
    </div>
  );
};
/* ─────────────── NOTIFICATIONS ─────────────── */
const NotificationsPage = ({ currentUser, users, videos, onClose, onViewProfile }) => {
  const [notifs, setNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(()=>{
    if(!currentUser?.id) return;
    const q = query(
      collection(db,'notifications'),
      where('toUserId','==',currentUser.id),
      orderBy('createdAt','desc')
    );
    const unsub = onSnapshot(q, snap=>{
      const list = snap.docs.map(d=>({id:d.id,...d.data(),date:d.data().createdAt?.toDate?.()|| new Date()}));
      setNotifs(list);
      setUnreadCount(list.filter(n=>!n.read).length);
    });
    return ()=>unsub();
  },[currentUser?.id]);

  const markAllRead = async () => {
    const unread = notifs.filter(n=>!n.read);
    await Promise.all(unread.map(n=>updateDoc(doc(db,'notifications',n.id),{read:true})));
  };

  const icons = { like:'❤️', comment:'💬', follow:'👤', mention:'@', gift:'🎁', live:'🔴', story:'📖' };

  return (
    <div style={{ position:'fixed', inset:0, background:'#0a0a0a', zIndex:300, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ color:'white', fontWeight:800, fontSize:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Notifications</div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {unreadCount>0 && <button onClick={markAllRead} style={{ background:'rgba(255,45,85,0.1)', border:'1px solid rgba(255,45,85,0.2)', borderRadius:20, padding:'5px 12px', color:'#ff2d55', fontSize:11, fontWeight:700, cursor:'pointer' }}>Mark all read</button>}
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.07)', border:'none', borderRadius:'50%', width:32, height:32, color:'white', cursor:'pointer', fontSize:16 }}>✕</button>
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto' }}>
        {notifs.length===0 && (
          <div style={{ textAlign:'center', padding:60, color:'rgba(255,255,255,0.2)' }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🔔</div>
            <div style={{ fontSize:14 }}>No notifications yet</div>
          </div>
        )}
        {notifs.map(n=>{
          const fromUser = users.find(u=>u.id===n.fromUserId);
          return (
            <div key={n.id} onClick={async()=>{ await updateDoc(doc(db,'notifications',n.id),{read:true}); onViewProfile?.(n.fromUserId); }} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.04)', cursor:'pointer', background:n.read?'transparent':'rgba(255,45,85,0.04)' }}>
              <div style={{ position:'relative', flexShrink:0 }}>
                <div style={{ width:46, height:46, borderRadius:'50%', background:fromUser?.avatarColor||'#333', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:18, overflow:'hidden' }}>
                  {fromUser?.avatarUrl ? <img src={fromUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (fromUser?.avatar||'?')}
                </div>
                <div style={{ position:'absolute', bottom:-2, right:-2, width:20, height:20, borderRadius:'50%', background:'#1a1a1a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>{icons[n.type]||'🔔'}</div>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:'white', fontSize:13, lineHeight:1.4 }}>
                  <span style={{ fontWeight:700 }}>@{fromUser?.username||'someone'}</span>
                  {' '}{n.message}
                </div>
                <div style={{ color:'rgba(255,255,255,0.3)', fontSize:11, marginTop:3 }}>
                  {n.date?.toLocaleDateString?.()}{n.date ? ' · ' : ''}{n.date?.toLocaleTimeString?.([],{hour:'2-digit',minute:'2-digit'})}
                </div>
              </div>
              {!n.read && <div style={{ width:8, height:8, borderRadius:'50%', background:'#ff2d55', flexShrink:0 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};



/* ─────────────── MAIN APP ─────────────── */
export default function DaguV3App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [friends, setFriends] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showCall, setShowCall] = useState(null); // { type, contactName, contactAvatar, contactId }
  const [showLiveStream, setShowLiveStream] = useState(null);
  const [showStoryViewer, setShowStoryViewer] = useState(null);
  const [showSoundLibrary, setShowSoundLibrary] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [followed, setFollowed] = useState([]);
  const [viewingProfile, setViewingProfile] = useState(null);

  const showToast = useCallback((message, type='info')=>setToast({message,type}),[]);

  // Firebase Auth listener
  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async (fbUser)=>{
      if(fbUser){
        // Block unverified email users from entering the app
        if(!fbUser.emailVerified && fbUser.providerData?.some(p => p.providerId === 'password')){
  await signOut(auth);
  setCurrentUser(null);
  setAuthLoading(false);
  return;
}
        let profile = await getUserProfile(fbUser.uid);
        if(!profile){
          // Profile may not exist yet if Google signup just happened
for(let i=0; i<5; i++){
  await new Promise(r => setTimeout(r, 1000));
  profile = await getUserProfile(fbUser.uid);
  if(profile) break;
}
        }
        if(profile) {
          setCurrentUser({...profile, id:fbUser.uid});
          setFollowed(profile.following||[]);
        }
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return ()=>unsub();
  },[]);

  // Real-time videos from Firestore
  useEffect(()=>{
    const q = query(collection(db,'videos'), orderBy('createdAt','desc'));
    const unsub = onSnapshot(q, snap=>{
      setVideos(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return ()=>unsub();
  },[]);

  // Real-time users from Firestore
  useEffect(()=>{
    const unsub = onSnapshot(collection(db,'users'), snap=>{
      setUsers(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return ()=>unsub();
  },[]);

  // Update friends when followed or users change
  useEffect(()=>{
    setFriends(followed);
  },[followed]);

  const handleLogin = (profile) => {
    setCurrentUser(profile);
    setFollowed(profile.following||[]);
    // Save to local accounts list
    const stored = JSON.parse(localStorage.getItem('infinity_accounts')||'[]');
    const exists = stored.find(a=>a.id===profile.id);
    if(!exists) {
      stored.push({ id:profile.id, username:profile.username, avatar:profile.avatar, avatarColor:profile.avatarColor, avatarUrl:profile.avatarUrl, subscription:profile.subscription });
      localStorage.setItem('infinity_accounts', JSON.stringify(stored));
    }
    showToast(`Welcome back, @${profile.username}! 👋`,'success');
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    showToast('Logged out','info');
  };

  const toggleFollow = async (uid) => {
    if(!currentUser) return;
    const isFollowing = followed.includes(uid);
    const newFollowed = isFollowing ? followed.filter(id=>id!==uid) : [...followed,uid];
    setFollowed(newFollowed);
    // Update current user's following in Firestore
    await updateDoc(doc(db,'users',currentUser.id),{
      following: isFollowing ? arrayRemove(uid) : arrayUnion(uid)
    });
    // Update target user's followers
    await updateDoc(doc(db,'users',uid),{
      followers: isFollowing ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id)
    });
    if(!isFollowing) await sendNotification(uid, currentUser.id, 'follow', 'started following you');
  };

  const handleViewProfile = uid => { const user=users.find(u=>u.id===uid); if(user) setViewingProfile(user); };
  const [inboxTargetId, setInboxTargetId] = useState(null);
const [activeConversation, setActiveConversation] = useState(()=>{
  try { return JSON.parse(sessionStorage.getItem('dagu_conv')||'null'); } catch { return null; }
});
const handleMessage = uid => {
  if(!uid) return;
  setActiveConversation(null);
  sessionStorage.removeItem('dagu_conv');
  setInboxTargetId(uid);
  setActiveTab('inbox');
};

  const tabs = [
    {id:'home'},{id:'friends'},{id:'create'},{id:'inbox'},{id:'profile'},
  ];

  const TabIcon = ({id,active}) => {
    const color = active ? '#ff2d55' : 'rgba(255,255,255,0.35)';
    const sw = active ? 2.2 : 1.8;
    const s = {width:26,height:26,fill:'none',stroke:color,strokeWidth:sw,strokeLinecap:'round',strokeLinejoin:'round'};
    if(id==='home') return (
      <div style={{ position:'relative' }}>
        <svg viewBox="0 0 24 24" style={s}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        {active && <div style={{ position:'absolute', bottom:-8, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:'#ff2d55' }} />}
      </div>
    );
    if(id==='friends') return (
      <div style={{ position:'relative' }}>
        <svg viewBox="0 0 24 24" style={s}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        {active && <div style={{ position:'absolute', bottom:-8, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:'#ff2d55' }} />}
      </div>
    );
    if(id==='create') return (
      <div style={{ width:52, height:34, background:'linear-gradient(135deg,#ff2d55,#af52de)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(255,45,85,0.4)' }}>
        <svg viewBox="0 0 24 24" style={{ width:22,height:22,stroke:'white',fill:'none',strokeWidth:2.5,strokeLinecap:'round' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </div>
    );
    if(id==='inbox') return (
      <div style={{ position:'relative' }}>
        <svg viewBox="0 0 24 24" style={s}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        <div style={{ position:'absolute', top:-2, right:-4, width:8, height:8, background:'#ff2d55', borderRadius:'50%', border:'1.5px solid #0a0a0a' }} />
        {active && <div style={{ position:'absolute', bottom:-8, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:'#ff2d55' }} />}
      </div>
    );
    if(id==='profile') return (
      <div style={{ position:'relative' }}>
        <svg viewBox="0 0 24 24" style={{...s,fill:active?'rgba(255,45,85,0.15)':''}}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        {active && <div style={{ position:'absolute', bottom:-8, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:'#ff2d55' }} />}
      </div>
    );
    return null;
  };

  if(authLoading) return (
    <div style={{ maxWidth:430, margin:'0 auto', height:'100dvh', background:'#0a0a0a', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <GlobalStyles />
      <img src="https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png" style={{ width:64, height:64, borderRadius:20, objectFit:'cover', boxShadow:'0 20px 60px rgba(255,45,85,0.4)' }} />
      <div style={{ width:32, height:32, border:'3px solid rgba(255,45,85,0.3)', borderTop:'3px solid #ff2d55', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
    </div>
  );

  if(!currentUser) return (
    <div style={{ maxWidth:430, margin:'0 auto', height:'100dvh', background:'#0a0a0a', overflow:'hidden' }}>
      <GlobalStyles />
      <AuthScreen onLogin={handleLogin} />
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
    </div>
  );

  return (
    <div style={{ maxWidth:430, margin:'0 auto', height:'100dvh', background:'#0a0a0a', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}>
      <GlobalStyles />

      {showCall && <CallModal type={showCall.type} contactName={showCall.contactName} contactAvatar={showCall.contactAvatar} contactId={showCall.contactId} currentUser={currentUser} onClose={()=>setShowCall(null)} />}
      {showLiveStream && <LiveStream streamer={showLiveStream} onClose={()=>setShowLiveStream(null)} showToast={showToast} currentUser={currentUser} />}
      {showStoryViewer && <StoryViewer story={showStoryViewer} user={users.find(u=>u.id===showStoryViewer.userId)||currentUser} onClose={()=>setShowStoryViewer(null)} />}
      {showSoundLibrary && <SoundLibraryPage onSelectSound={s=>{showToast?.(`Selected: ${s.name}`,'success'); setShowSoundLibrary(false);}} onClose={()=>setShowSoundLibrary(false)} />}
      {showQRCode && <QRCodePage user={currentUser} onClose={()=>setShowQRCode(false)} />}
      {showNotifications && <NotificationsPage currentUser={currentUser} users={users} videos={videos} onClose={()=>setShowNotifications(false)} onViewProfile={uid=>{handleViewProfile(uid); setShowNotifications(false);}} />}
      {showAnalytics && <CreatorAnalytics user={currentUser} videos={videos} onClose={()=>setShowAnalytics(false)} />}
      {showCreateStory && <CreateStoryModal currentUser={currentUser} onClose={()=>setShowCreateStory(false)} showToast={showToast} />}
      {viewingProfile && (
        <UserProfileModal user={viewingProfile} currentUser={currentUser} onClose={()=>setViewingProfile(null)} onFollow={toggleFollow} onMessage={uid=>{handleMessage(uid); setViewingProfile(null);}} onVoiceCall={uid=>{const u=users.find(uu=>uu.id===uid); setShowCall({type:'audio',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid}); setViewingProfile(null);}}
 onVideoCall={uid=>{const u=users.find(uu=>uu.id===uid); setShowCall({type:'video',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid}); setViewingProfile(null);}}
 followed={followed} showToast={showToast} userVideos={videos.filter(v=>v.userId===viewingProfile?.id)} />
      )}

      <div style={{ flex:1, overflow:'hidden', position:'relative', minHeight:0 }}>
        {showSearch && <SearchOverlay onClose={()=>setShowSearch(false)} videos={videos} users={users} onViewProfile={uid=>{handleViewProfile(uid); setShowSearch(false);}} />}
        {showCamera && <CameraUpload onUpload={v=>{setVideos(prev=>[v,...prev]);}} onClose={()=>setShowCamera(false)} showToast={showToast} currentUser={currentUser} />}
        {!showSearch && !showCamera && (
          <>
            {activeTab==='home' && <HomeFeed videos={videos} currentUser={currentUser} onLike={()=>{}} onComment={()=>{}} onShare={()=>{}} onFollow={toggleFollow} onMessage={handleMessage} onVoiceCall={uid=>{const u=users.find(uu=>uu.id===uid); setShowCall({type:'audio',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid});}}
 onVideoCall={uid=>{const u=users.find(uu=>uu.id===uid); setShowCall({type:'video',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid});}}
 onDuet={()=>showToast?.('Duet mode ready','info')} onStitch={()=>showToast?.('Stitch mode ready','info')} onSaveSound={()=>showToast?.('Sound saved!','success')} followed={followed} showToast={showToast} onLive={()=>setShowLiveStream(currentUser)} onViewProfile={handleViewProfile} onOpenSearch={()=>setShowSearch(true)} onOpenNotifications={()=>setShowNotifications(true)} />}
            {activeTab==='friends' && <FriendsFeed friends={friends} videos={videos} currentUser={currentUser} onMessage={handleMessage} onVoiceCall={uid=>{const u=users.find(uu=>uu.id===uid); setShowCall({type:'audio',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid});}}
 onVideoCall={uid=>{const u=users.find(uu=>uu.id===uid); setShowCall({type:'video',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid});}}
 onViewProfile={handleViewProfile} showToast={showToast} users={users} onCreateStory={()=>setShowCreateStory(true)} onViewStory={setShowStoryViewer} onFollow={toggleFollow} followed={followed} />}
            {activeTab==='create' && <CreateScreen onOpenCamera={()=>setShowCamera(true)} onShowSoundLibrary={()=>setShowSoundLibrary(true)} showToast={showToast} />}
            {activeTab==='inbox' && <InboxPage users={users} currentUser={currentUser} showToast={showToast} onViewProfile={handleViewProfile} initialTargetId={inboxTargetId} onClearTarget={()=>setInboxTargetId(null)} persistedConversation={activeConversation} onSetConversation={(conv)=>{ setActiveConversation(conv); sessionStorage.setItem('dagu_conv', JSON.stringify(conv)); }} />}
            {activeTab==='profile' && <ProfilePage user={currentUser} setCurrentUser={setCurrentUser} onLogout={handleLogout} users={users} showToast={showToast} onShowAnalytics={()=>setShowAnalytics(true)} onShowQRCode={()=>setShowQRCode(true)} allVideos={videos} />}
          </>
        )}
      </div>

      <div style={{ display:'flex', background:'rgba(8,8,8,0.97)', borderTop:'1px solid rgba(255,255,255,0.06)', padding:'12px 8px 24px', flexShrink:0, backdropFilter:'blur(20px)' }}>
        {tabs.map(tab=>{
          const isActive=activeTab===tab.id;
          return (
            <button key={tab.id} onClick={()=>{setActiveTab(tab.id); if(tab.id==='create') setShowCamera(true);}} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:0, background:'none', border:'none', cursor:'pointer', padding:'4px 0', position:'relative', transition:'transform 0.15s' }}>
              <TabIcon id={tab.id} active={isActive} />
            </button>
          );
        })}
      </div>

      {activeTab==='home' && (
        <button onClick={()=>setShowLiveStream(currentUser)} style={{ position:'absolute', right:14, bottom:88, background:'linear-gradient(135deg,#ff2d55,#af52de)', border:'none', borderRadius:24, padding:'8px 16px', cursor:'pointer', zIndex:15, display:'flex', alignItems:'center', gap:7, boxShadow:'0 4px 24px rgba(255,45,85,0.5)' }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:'white', animation:'pulse 1s infinite' }} />
          <span style={{ color:'white', fontSize:13, fontWeight:800, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif", letterSpacing:0.5 }}>LIVE</span>
        </button>
      )}

      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
    </div>
  );
}
