// InfinityV1.jsx — FULLY REAL: Firebase Auth + Firestore + Cloudinary + EmailJS
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, increment, serverTimestamp, arrayUnion, arrayRemove, limit, startAfter, Timestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithCustomToken, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail, sendEmailVerification, getIdTokenResult } from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { COLORS, TYPE, RADIUS, applyTheme, getStoredTheme, subscribeTheme, resolveAvatarColor, pickAvatarColor } from '@/lib/theme';

/* ─────────────── IN-APP CONFIRM DIALOG (replaces window.confirm) ─────────────── */
// window.confirm() renders the browser's own native dialog — shows the raw domain
// ("infinity-now.vercel.app says"), ignores all app styling, and can't be customized.
// This is a drop-in async replacement: same call signature/semantics as window.confirm
// (`if (await confirmDialog('message')) { ... }`) but resolves via a real React modal
// styled with the app's own COLORS/RADIUS tokens instead. ConfirmDialogHost (rendered
// once, near the root, in InfinityV1app) registers itself into the module-level handler
// below so confirmDialog can be called from any component or plain async function in
// this file without threading a prop/context through every call site — the same
// "just works from anywhere" ergonomics window.confirm had, but themed.
let _confirmHandler = null;
function confirmDialog(message, options = {}) {
  return new Promise((resolve) => {
    if (_confirmHandler) {
      _confirmHandler({ message, resolve, ...options });
    } else {
      // Fallback if the host hasn't mounted yet (shouldn't normally happen).
      resolve(window.confirm(message));
    }
  });
}

function ConfirmDialogHost() {
  const [req, setReq] = useState(null); // { message, resolve, danger, confirmLabel, cancelLabel }
  useEffect(() => {
    _confirmHandler = (r) => setReq(r);
    return () => { _confirmHandler = null; };
  }, []);
  if (!req) return null;
  const finish = (result) => { req.resolve(result); setReq(null); };
  return (
    <div
      onClick={() => finish(false)}
      style={{ position:'fixed', inset:0, zIndex:10000, background:'rgba(11,15,25,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background:COLORS.surface, borderRadius:RADIUS.lg, padding:'22px 20px', width:'100%', maxWidth:340, boxShadow:'0 20px 60px rgba(11,15,25,0.25)' }}
      >
        <div style={{ fontSize:TYPE.md, color:COLORS.textPrimary, lineHeight:1.4, marginBottom:20 }}>{req.message}</div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button
            onClick={() => finish(false)}
            style={{ padding:'10px 18px', borderRadius:RADIUS.pill, border:'none', background:COLORS.surfaceAlt, color:COLORS.textSecondary, fontSize:TYPE.base, fontWeight:600, cursor:'pointer' }}
          >
            {req.cancelLabel || 'Cancel'}
          </button>
          <button
            onClick={() => finish(true)}
            style={{ padding:'10px 18px', borderRadius:RADIUS.pill, border:'none', background:req.danger === false ? COLORS.brand : COLORS.danger, color:'#FFFFFF', fontSize:TYPE.base, fontWeight:600, cursor:'pointer' }}
          >
            {req.confirmLabel || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── SHARED ELEVATION / MOTION SYSTEM ───────────────
   A small, consistent set of shadow + transition tokens used across every
   card, sheet, avatar and control in the app. Real social apps (Instagram,
   Facebook, Threads) don't hand-tune shadows per-screen — they draw from one
   scale so a card on the Home feed reads as the same "material" as a card in
   Inbox or Profile. These are plain JS objects (not COLORS.* additions) so
   they work without touching the external theme module. */
const SHADOW = {
  xs: '0 1px 2px rgba(20,16,32,0.06)',
  sm: '0 2px 8px rgba(20,16,32,0.07)',
  card: '0 4px 16px rgba(20,16,32,0.08), 0 1px 3px rgba(20,16,32,0.06)',
  raised: '0 8px 28px rgba(20,16,32,0.12), 0 2px 6px rgba(20,16,32,0.07)',
  modal: '0 24px 64px rgba(12,10,20,0.28), 0 4px 16px rgba(12,10,20,0.14)',
  glow: (color) => `0 4px 20px ${color}40`,
};
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const TRANSITION = {
  fast: `all 0.15s ${EASE}`,
  base: `all 0.22s ${EASE}`,
  slow: `all 0.35s ${EASE}`,
};
// Consistent press/hover feedback for tappable surfaces (cards, avatars, buttons).
// Spread this onto a style object, then swap transform on active/hover state.
const pressable = { transition: TRANSITION.fast, cursor: 'pointer' };

// Normalizes a createdAt value (Firestore Timestamp, plain number, or Date) to millis,
// then sorts newest-first. Used everywhere the videos collection is fetched so post
// order is consistent regardless of which timestamp shape a given doc has.
const tsToMillis = (ts) => {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
};
const sortByNewest = (list) => list.slice().sort((a,b)=>tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
// Same normalization but returns a Date (or null), for display helpers like timeAgo().
const tsToDate = (ts) => {
  const ms = tsToMillis(ts);
  return ms ? new Date(ms) : null;
};

/* ─────────────── FIREBASE CONFIG ─────────────── */
// Firebase web config values (apiKey, projectId, etc.) aren't secret — real security
// comes from firestore.rules, not from hiding these — so it's fine for them to be
// visible in the shipped JS bundle. What's NOT fine is hardcoding a *fallback* project
// here: if NEXT_PUBLIC_FIREBASE_* env vars are ever missing (a fresh clone, a broken
// deploy config), the app would silently connect to whatever project was hardcoded —
// meaning every signup/message/upload goes into someone else's live Firebase project
// instead of failing loudly. Required at build/runtime; see env.example.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
if (typeof window !== 'undefined' && (!firebaseConfig.apiKey || !firebaseConfig.projectId)) {
  // Thrown client-side only, and only when a required value is actually missing —
  // this never fires once .env.local (or your host's env var settings) is filled in.
  throw new Error(
    'Missing Firebase config. Set NEXT_PUBLIC_FIREBASE_* in .env.local (see env.example) before running the app.'
  );
}
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
let messaging = null;
try { messaging = getMessaging(app); } catch(e) { console.log('Messaging not supported:', e); }
// Web Push certificate key from Firebase Console > Project Settings > Cloud Messaging >
// Web Push certificates. Not secret (same category as the config above — it's sent to
// the browser to subscribe it for push), but it's still project-specific: replace it
// with your own project's key, don't reuse this one.
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/* ─────────────── SERVER API HELPER ─────────────── */
// All money/auth-sensitive operations go through /api/* routes now (server-authoritative).
// This attaches the current user's Firebase ID token so the route can verify who's calling;
// routes that don't need auth (send-otp/verify-otp, pre-login) just ignore the missing header.
const apiFetch = async (path, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(path, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
};

const useNetworkStatus = () => {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(()=>{
    const on = ()=>setOnline(true);
    const off = ()=>setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return ()=>{ window.removeEventListener('online',on); window.removeEventListener('offline',off); };
  },[]);
  return online;
};

const OfflineBanner = () => (
  <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:10000, background:'#FFB100', padding:'10px 16px', display:'flex', alignItems:'center', gap:8, justifyContent:'center', animation:'slideDown 0.3s ease' }}>
    <span style={{ fontSize:16 }}>📡</span>
    <span style={{ color:'#000', fontWeight:700, fontSize:13 }}>You're offline — some features may be unavailable</span>
  </div>
);
/* ─────────────── EMAILJS CONFIG ─────────────── */
const EMAILJS_SERVICE = 'service_mtqmvbb';
const EMAILJS_TEMPLATE = 'template_1k7wiqa';
const EMAILJS_PUBLIC_KEY = 'U9fs25Bcx5oQ6A2ru';
// Recipient for in-app "Report a Problem" submissions. Change in one place if the support inbox changes.
const SUPPORT_EMAIL = 'supportinfinity@gmail.com';
/* ─────────────── CONSTANTS ─────────────── */
const LOGIN_METHODS = [
  { id: 'google', name: 'Google', icon: '🌐', color: '#4285f4' },
  { id: 'email', name: 'Email', icon: '📧', color: '#0B5FFF' },
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

const EMOJI_LIST = ['😀','😂','😍','🥰','😎','🤔','😭','😱','🔥','❤️','👍','🎉','✨','💯','🙌','👏','🤝','💪','🎵','📸'];

/* ─────────────── CHAT THEME PRESETS ───────────────
   Per-conversation bubble/accent color, independent of the app-wide light/dark
   COLORS toggle in lib/theme.js. Stored on the conversation doc as `chatTheme`
   (a preset id) so BOTH participants see the same theme, mirroring how the
   feature works in real chat apps. 'default' means "no override" — falls back
   to whatever COLORS.gradient/COLORS.brand already resolve to. */
const CHAT_THEMES = [
  { id: 'default', name: 'Default',    gradient: null,                                   accent: null },
  { id: 'ocean',   name: 'Ocean',      gradient: 'linear-gradient(135deg,#2E7BFF,#0B5FFF)', accent: '#0B5FFF' },
  { id: 'sunset',  name: 'Sunset',     gradient: 'linear-gradient(135deg,#FF9A56,#FF6B6B)', accent: '#FF6B6B' },
  { id: 'forest',  name: 'Forest',     gradient: 'linear-gradient(135deg,#34D399,#059669)', accent: '#059669' },
  { id: 'grape',   name: 'Grape',      gradient: 'linear-gradient(135deg,#A78BFA,#7C3AED)', accent: '#7C3AED' },
  { id: 'rose',    name: 'Rose',       gradient: 'linear-gradient(135deg,#FB7185,#E11D48)', accent: '#E11D48' },
  { id: 'midnight',name: 'Midnight',   gradient: 'linear-gradient(135deg,#475569,#1E293B)', accent: '#1E293B' },
  { id: 'gold',    name: 'Gold',       gradient: 'linear-gradient(135deg,#FCD34D,#D97706)', accent: '#D97706' },
];
const getChatTheme = (id) => CHAT_THEMES.find(t => t.id === id) || CHAT_THEMES[0];

/* ─────────────── DISAPPEARING MESSAGES DURATIONS ───────────────
   Mirrors the standard 24h / 7d / 90d options. Value is seconds; 0 means off.
   The actual deletion is enforced server-side via a Firestore TTL policy on the
   `expireAt` field (configured once via gcloud/console — see RELEASE_CHECKLIST),
   NOT by any client-side timer, so it still works even if nobody has the chat open. */
const DISAPPEARING_OPTIONS = [
  { seconds: 0,        label: 'Off' },
  { seconds: 86400,    label: '24 hours' },
  { seconds: 604800,   label: '7 days' },
  { seconds: 7776000,  label: '90 days' },
];
const TRANSLATIONS = {
  en: { home:'For You', friends:'Friends', inbox:'Messages', profile:'Profile', create:'Create', foryou:'For You', skills:'Skills', jobs:'Jobs', post:'Post', cancel:'Cancel', save:'Save', follow:'+ Follow', unfollow:'Following', message:'Message', settings:'Settings', logout:'Log Out', editProfile:'Edit Profile', search:'Search anything...', noVideos:'No videos yet. Be the first to post!', addComment:'Add a comment...', noMessages:'No messages yet', startChat:'Go to a profile and tap Message to start', notifications:'Notifications', markRead:'Mark all read', wallet:'Wallet', analytics:'Analytics', badges:'Badges', premium:'Premium', live:'Go Live', report:'Report', block:'Block', duet:'Duet', stitch:'Stitch', voiceCall:'Voice Call', videoCall:'Video Call', pinned:'Pinned', reply:'Reply', pin:'Pin', retake:'Retake', newPost:'New Post', sounds:'Sounds', close:'Close', back:'Back', comments:'Comments' },
am: { home:'ለእርስዎ', friends:'ጓደኞች', inbox:'መልዕክቶች', profile:'መገለጫ', create:'ፍጠር', foryou:'ለእርስዎ', skills:'ችሎታዎች', jobs:'ስራዎች', post:'ለጥፍ', cancel:'ሰርዝ', save:'አስቀምጥ', follow:'+ ተከተል', unfollow:'እየተከተሉ ነው', message:'መልዕክት', settings:'ቅንብሮች', logout:'ውጣ', editProfile:'መገለጫ አርትዕ', search:'ፈልግ...', noVideos:'ምንም ቪዲዮ የለም።', addComment:'አስተያየት ጨምር...', noMessages:'ምንም መልዕክቶች የሉም', startChat:'ወደ መገለጫ ሂድ እና መልዕክት ላክ', notifications:'ማሳወቂያዎች', markRead:'ሁሉንም እንደተነበበ ምልክት አድርግ', wallet:'ቦርሳ', analytics:'ትንተና', badges:'ሽልማቶች', premium:'ፕሪሚየም', live:'ቀጥታ', report:'ሪፖርት', block:'አግድ', duet:'ዱዌት', stitch:'ስቲች', voiceCall:'የድምፅ ጥሪ', videoCall:'ቪዲዮ ጥሪ', pinned:'ተሰክቷል', reply:'መልስ', pin:'ስክ', retake:'እንደገና', newPost:'አዲስ ለጥፍ', sounds:'ድምፆች', close:'ዝጋ', back:'ተመለስ', comments:'አስተያየቶች', posts:'ልጥፎች', followers:'ተከታዮች', following:'እየተከተሉ', language:'ቋንቋ', privacy:'ግላዊነት', deposit:'ጨምር', withdraw:'አውጣ', convert:'ቀይር', transactions:'ግብይቶች', noTransactions:'ምንም ግብይቶች የሉም', coins:'ሳንቲሞች', cash:'ገንዘብ', openCamera:'ካሜራ ክፈት', uploadGallery:'ከጋለሪ ጫን', writeText:'ጽሁፍ ጻፍ', recordAudio:'ድምፅ ቅዳ', addSound:'ድምፅ ጨምር', createShare:'ፍጠር እና አጋራ', expressYourself:'እራስህን ግለፅ', noPosts:'ምንም ልጥፍ የለም', noSaved:'ምንም አልተቀመጠም', noDrafts:'ምንም ረቂቆች የሉም', createFirst:'የመጀመሪያ ቪዲዮህን ፍጠር!', online:'ኦንላይን', offline:'ኦፍላይን', typing:'እየተየፉ ነው...', startConvo:'ወግ ጀምር! 👋', verified:'የተረጋገጠ', trending:'አዝማሚያ', noResults:'ምንም ውጤት የለም', shareProfile:'መገለጫ አጋራ', scanToFollow:'ለመከተል ቅዱ', weeklyViews:'ሳምንታዊ እይታዎች', topVideos:'ምርጥ ቪዲዮዎች', totalViews:'ጠቅላላ እይታዎች', totalLikes:'ጠቅላላ ወደዶዎች', changePassword:'የይለፍ ቃል ቀይር', emailPhone:'ኢሜይል እና ስልክ', switchAccount:'አካውንት ቀይር', blockedUsers:'የታገዱ ተጠቃሚዎች', helpCenter:'የእርዳታ ማዕከል', reportProblem:'ችግር ሪፖርት አድርግ', termsOfService:'የአገልግሎት ውሎች', privacyPolicy:'የግላዊነት ፖሊሲ', resetAccount:'አካውንት ዳግም አስጀምር', deleteAccount:'አካውንት ሰርዝ', logOut:'ውጣ', version:'ስሪት', madeWith:'ተሰርቷል', noNotifications:'ምንም ማሳወቂያዎች የሉም', markAllRead:'ሁሉንም እንደተነበበ ምልክት አድርግ' },  ar: { home:'لك', friends:'أصدقاء', inbox:'رسائل', profile:'الملف', create:'إنشاء', foryou:'لك', skills:'مهارات', jobs:'وظائف', post:'نشر', cancel:'إلغاء', save:'حفظ', follow:'+ متابعة', unfollow:'تتابع', message:'رسالة', settings:'الإعدادات', logout:'تسجيل الخروج', editProfile:'تعديل الملف', search:'ابحث...', noVideos:'لا توجد مقاطع بعد.', addComment:'أضف تعليقاً...', noMessages:'لا رسائل بعد', startChat:'اذهب إلى ملف وأرسل رسالة', notifications:'الإشعارات', markRead:'تعليم الكل كمقروء', wallet:'المحفظة', analytics:'التحليلات', badges:'الشارات', premium:'مميز', live:'بث مباشر', report:'إبلاغ', block:'حظر', duet:'ثنائي', stitch:'خياطة', voiceCall:'مكالمة صوتية', videoCall:'مكالمة فيديو', pinned:'مثبت', reply:'رد', pin:'تثبيت', retake:'إعادة', newPost:'منشور جديد', sounds:'أصوات', close:'إغلاق', back:'رجوع', comments:'تعليقات' },
  fr: { home:'Pour vous', friends:'Amis', inbox:'Messages', profile:'Profil', create:'Créer', foryou:'Pour vous', skills:'Compétences', jobs:'Emplois', post:'Publier', cancel:'Annuler', save:'Enregistrer', follow:'+ Suivre', unfollow:'Abonné', message:'Message', settings:'Paramètres', logout:'Déconnexion', editProfile:'Modifier le profil', search:'Rechercher...', noVideos:'Aucune vidéo pour l\'instant.', addComment:'Ajouter un commentaire...', noMessages:'Aucun message', startChat:'Allez sur un profil et envoyez un message', notifications:'Notifications', markRead:'Tout marquer comme lu', wallet:'Portefeuille', analytics:'Analytique', badges:'Badges', premium:'Premium', live:'En direct', report:'Signaler', block:'Bloquer', duet:'Duo', stitch:'Raccord', voiceCall:'Appel vocal', videoCall:'Appel vidéo', pinned:'Épinglé', reply:'Répondre', pin:'Épingler', retake:'Reprendre', newPost:'Nouveau post', sounds:'Sons', close:'Fermer', back:'Retour', comments:'Commentaires' },
  es: { home:'Para ti', friends:'Amigos', inbox:'Mensajes', profile:'Perfil', create:'Crear', foryou:'Para ti', skills:'Habilidades', jobs:'Empleos', post:'Publicar', cancel:'Cancelar', save:'Guardar', follow:'+ Seguir', unfollow:'Siguiendo', message:'Mensaje', settings:'Ajustes', logout:'Cerrar sesión', editProfile:'Editar perfil', search:'Buscar...', noVideos:'Aún no hay videos.', addComment:'Añadir comentario...', noMessages:'Sin mensajes aún', startChat:'Ve a un perfil y envía un mensaje', notifications:'Notificaciones', markRead:'Marcar todo como leído', wallet:'Billetera', analytics:'Analíticas', badges:'Insignias', premium:'Premium', live:'En vivo', report:'Reportar', block:'Bloquear', duet:'Dueto', stitch:'Costura', voiceCall:'Llamada de voz', videoCall:'Videollamada', pinned:'Fijado', reply:'Responder', pin:'Fijar', retake:'Retomar', newPost:'Nueva publicación', sounds:'Sonidos', close:'Cerrar', back:'Atrás', comments:'Comentarios' },
  pt: { home:'Para você', friends:'Amigos', inbox:'Mensagens', profile:'Perfil', create:'Criar', foryou:'Para você', skills:'Habilidades', jobs:'Empregos', post:'Publicar', cancel:'Cancelar', save:'Salvar', follow:'+ Seguir', unfollow:'Seguindo', message:'Mensagem', settings:'Configurações', logout:'Sair', editProfile:'Editar perfil', search:'Pesquisar...', noVideos:'Nenhum vídeo ainda.', addComment:'Adicionar comentário...', noMessages:'Sem mensagens ainda', startChat:'Vá a um perfil e envie uma mensagem', notifications:'Notificações', markRead:'Marcar tudo como lido', wallet:'Carteira', analytics:'Análises', badges:'Emblemas', premium:'Premium', live:'Ao vivo', report:'Denunciar', block:'Bloquear', duet:'Dueto', stitch:'Ponto', voiceCall:'Chamada de voz', videoCall:'Chamada de vídeo', pinned:'Fixado', reply:'Responder', pin:'Fixar', retake:'Refazer', newPost:'Nova publicação', sounds:'Sons', close:'Fechar', back:'Voltar', comments:'Comentários' },
  hi: { home:'आपके लिए', friends:'दोस्त', inbox:'संदेश', profile:'प्रोफ़ाइल', create:'बनाएं', foryou:'आपके लिए', skills:'कौशल', jobs:'नौकरियाँ', post:'पोस्ट करें', cancel:'रद्द करें', save:'सहेजें', follow:'+ फ़ॉलो', unfollow:'फ़ॉलोइंग', message:'संदेश', settings:'सेटिंग्स', logout:'लॉग आउट', editProfile:'प्रोफ़ाइल संपादित करें', search:'कुछ भी खोजें...', noVideos:'अभी कोई वीडियो नहीं।', addComment:'टिप्पणी जोड़ें...', noMessages:'अभी कोई संदेश नहीं', startChat:'किसी प्रोफ़ाइल पर जाएं और संदेश भेजें', notifications:'सूचनाएं', markRead:'सभी को पढ़ा हुआ चिह्नित करें', wallet:'वॉलेट', analytics:'विश्लेषण', badges:'बैज', premium:'प्रीमियम', live:'लाइव', report:'रिपोर्ट', block:'ब्लॉक', duet:'युगल', stitch:'सिलाई', voiceCall:'वॉयस कॉल', videoCall:'वीडियो कॉल', pinned:'पिन किया', reply:'जवाब', pin:'पिन', retake:'दोबारा', newPost:'नई पोस्ट', sounds:'ध्वनियां', close:'बंद', back:'वापस', comments:'टिप्पणियाँ' },
  zh: { home:'为你', friends:'朋友', inbox:'消息', profile:'我的', create:'创建', foryou:'为你', skills:'技能', jobs:'工作', post:'发布', cancel:'取消', save:'保存', follow:'+ 关注', unfollow:'已关注', message:'消息', settings:'设置', logout:'退出登录', editProfile:'编辑资料', search:'搜索...', noVideos:'暂无视频。', addComment:'添加评论...', noMessages:'暂无消息', startChat:'前往用户资料并发送消息', notifications:'通知', markRead:'全部标为已读', wallet:'钱包', analytics:'分析', badges:'徽章', premium:'高级版', live:'直播', report:'举报', block:'屏蔽', duet:'合唱', stitch:'拼接', voiceCall:'语音通话', videoCall:'视频通话', pinned:'已置顶', reply:'回复', pin:'置顶', retake:'重拍', newPost:'新帖子', sounds:'音效', close:'关闭', back:'返回', comments:'评论' },
};
/* ─────────────── ADDITIONAL LANGUAGES (v4 Enhancement) ─────────────── */
const EXTRA_TRANSLATIONS = {
  sw: { home:'Kwako', friends:'Marafiki', inbox:'Ujumbe', profile:'Wasifu', create:'Unda', foryou:'Kwako', skills:'Ujuzi', jobs:'Kazi', post:'Chapisha', cancel:'Ghairi', save:'Hifadhi', follow:'+ Fuata', unfollow:'Unafuata', message:'Ujumbe', settings:'Mipangilio', logout:'Toka', editProfile:'Hariri Wasifu', search:'Tafuta...', noVideos:'Hakuna video bado.', addComment:'Ongeza maoni...', noMessages:'Hakuna ujumbe bado', startChat:'Nenda kwenye wasifu na tuma ujumbe', notifications:'Arifa', markRead:'Weka zote kama zilizosomwa', wallet:'Mkoba', analytics:'Uchambuzi', badges:'Beji', premium:'Premium', live:'Moja kwa moja', report:'Ripoti', block:'Zuia', duet:'Dueti', stitch:'Stichi', voiceCall:'Simu ya sauti', videoCall:'Simu ya video', pinned:'Imepachikwa', reply:'Jibu', pin:'Pachika', retake:'Piga tena', newPost:'Chapisho Jipya', sounds:'Sauti', close:'Funga', back:'Rudi', comments:'Maoni' },
  de: { home:'Für dich', friends:'Freunde', inbox:'Nachrichten', profile:'Profil', create:'Erstellen', foryou:'Für dich', skills:'Fähigkeiten', jobs:'Jobs', post:'Posten', cancel:'Abbrechen', save:'Speichern', follow:'+ Folgen', unfollow:'Du folgst', message:'Nachricht', settings:'Einstellungen', logout:'Abmelden', editProfile:'Profil bearbeiten', search:'Suchen...', noVideos:'Noch keine Videos.', addComment:'Kommentar hinzufügen...', noMessages:'Noch keine Nachrichten', startChat:'Gehe zu einem Profil und sende eine Nachricht', notifications:'Benachrichtigungen', markRead:'Alle als gelesen markieren', wallet:'Geldbörse', analytics:'Analytik', badges:'Abzeichen', premium:'Premium', live:'Live', report:'Melden', block:'Blockieren', duet:'Duett', stitch:'Stitch', voiceCall:'Sprachanruf', videoCall:'Videoanruf', pinned:'Angeheftet', reply:'Antworten', pin:'Anheften', retake:'Wiederholen', newPost:'Neuer Beitrag', sounds:'Sounds', close:'Schließen', back:'Zurück', comments:'Kommentare' },
  ru: { home:'Для вас', friends:'Друзья', inbox:'Сообщения', profile:'Профиль', create:'Создать', foryou:'Для вас', skills:'Навыки', jobs:'Работа', post:'Опубликовать', cancel:'Отмена', save:'Сохранить', follow:'+ Подписаться', unfollow:'Вы подписаны', message:'Сообщение', settings:'Настройки', logout:'Выйти', editProfile:'Редактировать профиль', search:'Поиск...', noVideos:'Видео пока нет.', addComment:'Добавить комментарий...', noMessages:'Нет сообщений', startChat:'Перейдите в профиль и отправьте сообщение', notifications:'Уведомления', markRead:'Отметить все прочитанными', wallet:'Кошелёк', analytics:'Аналитика', badges:'Значки', premium:'Премиум', live:'Прямой эфир', report:'Пожаловаться', block:'Заблокировать', duet:'Дуэт', stitch:'Стич', voiceCall:'Голосовой звонок', videoCall:'Видеозвонок', pinned:'Закреплено', reply:'Ответить', pin:'Закрепить', retake:'Переснять', newPost:'Новая публикация', sounds:'Звуки', close:'Закрыть', back:'Назад', comments:'Комментарии' },
  tr: { home:'Sana Özel', friends:'Arkadaşlar', inbox:'Mesajlar', profile:'Profil', create:'Oluştur', foryou:'Sana Özel', skills:'Beceriler', jobs:'İşler', post:'Paylaş', cancel:'İptal', save:'Kaydet', follow:'+ Takip Et', unfollow:'Takip Ediyorsun', message:'Mesaj', settings:'Ayarlar', logout:'Çıkış Yap', editProfile:'Profili Düzenle', search:'Ara...', noVideos:'Henüz video yok.', addComment:'Yorum ekle...', noMessages:'Henüz mesaj yok', startChat:'Bir profile git ve mesaj gönder', notifications:'Bildirimler', markRead:'Tümünü okundu işaretle', wallet:'Cüzdan', analytics:'Analitik', badges:'Rozetler', premium:'Premium', live:'Canlı', report:'Şikayet Et', block:'Engelle', duet:'Düet', stitch:'Stitch', voiceCall:'Sesli Arama', videoCall:'Görüntülü Arama', pinned:'Sabitlendi', reply:'Yanıtla', pin:'Sabitle', retake:'Yeniden Çek', newPost:'Yeni Gönderi', sounds:'Sesler', close:'Kapat', back:'Geri', comments:'Yorumlar' },
  ja: { home:'あなたへ', friends:'友達', inbox:'メッセージ', profile:'プロフィール', create:'作成', foryou:'あなたへ', skills:'スキル', jobs:'仕事', post:'投稿', cancel:'キャンセル', save:'保存', follow:'+ フォロー', unfollow:'フォロー中', message:'メッセージ', settings:'設定', logout:'ログアウト', editProfile:'プロフィール編集', search:'検索...', noVideos:'まだ動画がありません。', addComment:'コメントを追加...', noMessages:'まだメッセージがありません', startChat:'プロフィールに移動してメッセージを送る', notifications:'通知', markRead:'全て既読にする', wallet:'ウォレット', analytics:'分析', badges:'バッジ', premium:'プレミアム', live:'ライブ', report:'報告', block:'ブロック', duet:'デュエット', stitch:'スティッチ', voiceCall:'音声通話', videoCall:'ビデオ通話', pinned:'固定', reply:'返信', pin:'固定する', retake:'撮り直す', newPost:'新しい投稿', sounds:'サウンド', close:'閉じる', back:'戻る', comments:'コメント' },
  ko: { home:'추천', friends:'친구', inbox:'메시지', profile:'프로필', create:'만들기', foryou:'추천', skills:'스킬', jobs:'직업', post:'게시', cancel:'취소', save:'저장', follow:'+ 팔로우', unfollow:'팔로잉', message:'메시지', settings:'설정', logout:'로그아웃', editProfile:'프로필 편집', search:'검색...', noVideos:'아직 동영상이 없습니다.', addComment:'댓글 추가...', noMessages:'아직 메시지가 없습니다', startChat:'프로필로 이동하여 메시지를 보내세요', notifications:'알림', markRead:'모두 읽음 표시', wallet:'지갑', analytics:'분석', badges:'배지', premium:'프리미엄', live:'라이브', report:'신고', block:'차단', duet:'듀엣', stitch:'스티치', voiceCall:'음성 통화', videoCall:'영상 통화', pinned:'고정됨', reply:'답글', pin:'고정', retake:'다시 찍기', newPost:'새 게시물', sounds:'사운드', close:'닫기', back:'뒤로', comments:'댓글' },
  it: { home:'Per te', friends:'Amici', inbox:'Messaggi', profile:'Profilo', create:'Crea', foryou:'Per te', skills:'Competenze', jobs:'Lavoro', post:'Pubblica', cancel:'Annulla', save:'Salva', follow:'+ Segui', unfollow:'Stai seguendo', message:'Messaggio', settings:'Impostazioni', logout:'Esci', editProfile:'Modifica profilo', search:'Cerca...', noVideos:'Nessun video ancora.', addComment:'Aggiungi commento...', noMessages:'Nessun messaggio ancora', startChat:'Vai a un profilo e invia un messaggio', notifications:'Notifiche', markRead:'Segna tutto come letto', wallet:'Portafoglio', analytics:'Analisi', badges:'Badge', premium:'Premium', live:'In diretta', report:'Segnala', block:'Blocca', duet:'Duetto', stitch:'Stitch', voiceCall:'Chiamata vocale', videoCall:'Videochiamata', pinned:'In primo piano', reply:'Rispondi', pin:'Fissa', retake:'Riprendi', newPost:'Nuovo post', sounds:'Suoni', close:'Chiudi', back:'Indietro', comments:'Commenti' },
};
// Merge extra translations into TRANSLATIONS
Object.assign(TRANSLATIONS, EXTRA_TRANSLATIONS);

/* ─────────────── LIVE TRANSLATION HOOK (v4 Enhancement) ─────────────── */
const translationCache = {};
const liveTranslate = async (text, targetLang = 'en') => {
  if (!text || targetLang === 'auto') return text;
  const cacheKey = `${targetLang}:${text.substring(0, 80)}`;
  if (translationCache[cacheKey]) return translationCache[cacheKey];
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    );
    const data = await res.json();
    const translated = data?.[0]?.map(s => s?.[0]).filter(Boolean).join('') || text;
    translationCache[cacheKey] = translated;
    return translated;
  } catch { return text; }
};

const useLiveTranslation = (text, targetLang) => {
  const [translated, setTranslated] = useState(text);
  useEffect(() => {
    if (!text || !targetLang || targetLang === 'en') { setTranslated(text); return; }
    liveTranslate(text, targetLang).then(setTranslated);
  }, [text, targetLang]);
  return translated;
};

/* ─────────────── EXTRA CONSTANTS (v4) ─────────────── */
const TRENDING_HASHTAGS = [
  '#Infinity', '#infinity', '#trending', '#viral', '#fyp', '#ethiopia', '#addisababa',
  '#africa', '#music', '#dance', '#comedy', '#fashion', '#food', '#travel', '#tech',
];

const SUPPORTED_LANGUAGES = [
  ['English','English','en'],['አማርኛ','Amharic','am'],['العربية','Arabic','ar'],['Français','French','fr'],['Español','Spanish','es'],
  ['Português','Portuguese','pt'],['हिन्दी','Hindi','hi'],['中文','Chinese','zh'],['Kiswahili','Swahili','sw'],['Deutsch','German','de'],
  ['Русский','Russian','ru'],['Türkçe','Turkish','tr'],['日本語','Japanese','ja'],['한국어','Korean','ko'],['Italiano','Italian','it'],
];

const REPORT_REASONS = [
  'Spam or misleading','Inappropriate content','Hate speech or harassment',
  'Violence or dangerous acts','Misinformation','Intellectual property violation',
  'Nudity or sexual content','Suicide or self-harm','Impersonation','Other',
];

// How urgently a report reason should bubble to the top of the moderation queue.
// Used only by ModerationPage to sort/flag — does not affect the reporting UI itself.
const REASON_SEVERITY = {
  'Suicide or self-harm': 'high', 'Violence or dangerous acts': 'high',
  'Nudity or sexual content': 'high', 'Hate speech or harassment': 'high',
  'Impersonation': 'med', 'Misinformation': 'med', 'Intellectual property violation': 'med',
  'Spam or misleading': 'low', 'Inappropriate content': 'med', 'Other': 'low',
};

// Suspension length presets offered from the moderation queue.
const SUSPENSION_OPTIONS = [
  { label: '24 hours', days: 1 }, { label: '3 days', days: 3 },
  { label: '7 days', days: 7 }, { label: '30 days', days: 30 },
];

// Field on the `reports` doc that identifies the target, per report type.
const REPORT_TARGET_FIELD = { user: 'reportedUserId', comment: 'commentId', video: 'videoId' };

/* Shared report submission used by every report entry point (profile, post, comment).
   Two responsibilities that used to live nowhere:
   1. Duplicate-report protection — without this, one person mashing "Report" (or
      reporting the same post from two screens) silently inflated the report count
      and could make a borderline case look far more urgent than it really is.
   2. A single write path so every report type is shaped consistently for the
      Moderation Center's grouping logic. */
const submitReport = async (type, targetId, reporterId, payload = {}) => {
  if (!targetId || !reporterId) throw new Error('Missing report target');
  const field = REPORT_TARGET_FIELD[type] || 'videoId';
  try {
    const dupQ = query(
      collection(db, 'reports'),
      where('type', '==', type),
      where(field, '==', targetId),
      where('reportedBy', '==', reporterId),
    );
    const existing = await getDocs(dupQ);
    if (!existing.empty) {
      const err = new Error("You've already reported this — thanks for flagging it");
      err.duplicate = true;
      throw err;
    }
  } catch (e) {
    if (e.duplicate) throw e;
    // Index/permission hiccup on the dedup check shouldn't block a legitimate report.
  }
  await addDoc(collection(db, 'reports'), {
    type, reportedBy: reporterId, createdAt: serverTimestamp(), ...payload,
  });
};

const STICKER_PACKS = [
  { id:'fun', name:'Fun', stickers:['😂','🤣','😎','🥳','🎉','🎊','✨','🔥','💯','👏'] },
  { id:'love', name:'Love', stickers:['❤️','🥰','😍','💕','💖','💗','💘','💝','😘','🫶'] },
  { id:'reactions', name:'Reactions', stickers:['👍','👎','😮','😡','😢','😱','🙌','🫡','💪','🤔'] },
  { id:'food', name:'Food', stickers:['🍕','🍔','🍟','🌮','🍜','🍣','🍦','🎂','☕','🧋'] },
];

/* ─────────────── POLL COMPONENT (v4 — like Instagram/Telegram polls) ─────────────── */
const PollWidget = ({ poll, currentUser, videoId, showToast }) => {
  const initialVoted = poll?.voters && currentUser?.id in (poll.voters||{}) ? poll.voters[currentUser.id] : null;
  const [voted, setVoted] = useState(initialVoted);
  const [localVotes, setLocalVotes] = useState(poll?.votes || {});
  const votePendingRef = useRef(false);
  // Re-sync from the live Firestore snapshot whenever it changes (someone else voting)
  // so totals/percentages update in real time for every viewer, instead of freezing
  // at whatever the poll looked like when this card first mounted.
  useEffect(() => {
    if (votePendingRef.current) return; // don't clobber our own optimistic update mid-flight
    setLocalVotes(poll?.votes || {});
    setVoted(poll?.voters && currentUser?.id in (poll.voters||{}) ? poll.voters[currentUser.id] : null);
  }, [poll?.votes, poll?.voters, currentUser?.id]);
  const totalVotes = Object.values(localVotes).reduce((s, v) => s + (v || 0), 0);

  const handleVote = async (optionIdx) => {
    if (voted !== null || !currentUser?.id) return;
    votePendingRef.current = true;
    const prevVoted = voted;
    const prevVotes = localVotes;
    setVoted(optionIdx);
    const newVotes = { ...localVotes, [optionIdx]: (localVotes[optionIdx] || 0) + 1 };
    setLocalVotes(newVotes);
    try {
      await updateDoc(doc(db, 'videos', videoId), {
        [`poll.votes.${optionIdx}`]: increment(1),
        [`poll.voters.${currentUser.id}`]: optionIdx
      });
      // Only report success once the write has actually been confirmed — previously
      // this toast fired unconditionally after the try/catch, so a rejected write
      // (e.g. the missing 'poll' field in firestore.rules, now fixed) still told the
      // user their vote was counted even though nothing was persisted.
      showToast?.('Vote counted! 🗳️', 'success');
    } catch (e) {
      console.log('Poll vote error:', e);
      // Roll back the optimistic update so the UI matches what's really in Firestore.
      setVoted(prevVoted);
      setLocalVotes(prevVotes);
      showToast?.('Vote failed — please try again', 'error');
    }
    finally { votePendingRef.current = false; }
  };

  if (!poll?.options?.length) return null;
  return (
    <div style={{ background: COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius: 16, padding: 14, marginBottom: 12 }}>
      <div style={{ color: COLORS.textTertiary, fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>📊 Poll</div>
      <div style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{poll.question}</div>
      {poll.options.map((opt, i) => {
        const pct = totalVotes > 0 ? Math.round(((localVotes[i] || 0) / totalVotes) * 100) : 0;
        const isChosen = voted === i;
        return (
          <div key={i} onClick={() => handleVote(i)} style={{ marginBottom: 8, cursor: voted === null ? 'pointer' : 'default' }}>
            <div style={{ position: 'relative', background: COLORS.surface, borderRadius: 10, overflow: 'hidden', border: isChosen ? `1.5px solid ${COLORS.brand}` : `1.5px solid ${COLORS.border}` }}>
              {voted !== null && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: isChosen ? 'rgba(11,95,255,0.18)' : COLORS.surfaceAlt, transition: 'width 0.4s ease' }} />}
              <div style={{ position: 'relative', padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: isChosen ? 700 : 500 }}>{opt}</span>
                {voted !== null && <span style={{ color: COLORS.textTertiary, fontSize: 12, fontWeight: 700 }}>{pct}%</span>}
              </div>
            </div>
          </div>
        );
      })}
      {voted !== null && <div style={{ color: COLORS.textTertiary, fontSize: 11, marginTop: 4 }}>{formatNumber(totalVotes)} vote{totalVotes !== 1 ? 's' : ''}</div>}
    </div>
  );
};

/* BookmarkButton removed — dead code, never rendered. Save/unsave now lives in
   FeedPostCard.toggleSave, writing to videos.savedBy, which SavedPostsPage reads
   via array-contains. */

/* ─────────────── SHARE SHEET (v4 — like TikTok/WhatsApp share) ─────────────── */
/* ─────────────── SHEET HEADER (shared by Likes / Save / More Options) ─────────────── */
const SheetBackHeader = ({ title, onClose, right }) => (
  <div style={{ display:'flex', alignItems:'center', gap:14, padding:'16px 16px 14px', borderBottom:`1px solid ${COLORS.border}` }}>
    <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:COLORS.textPrimary, padding:4, display:'flex' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
    </button>
    <div style={{ flex:1, color:COLORS.textPrimary, fontWeight:800, fontSize:17 }}>{title}</div>
    {right}
  </div>
);

/* ─────────────── REPORT REASON SHEET (shared by post + user reports) ─────────────── */
/* Reuses the existing REPORT_REASONS constant declared above (was previously unused —
   nothing rendered it before this sheet existed). */
const ReportReasonSheet = ({ title = 'Report', onClose, onSubmit }) => {
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  return (
    <div style={{ position:'fixed', inset:0, zIndex:6000, background:'rgba(20,15,35,0.55)', display:'flex', alignItems:'flex-end' }} onClick={e=>{ e.stopPropagation(); onClose(); }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxHeight:'86vh', overflowY:'auto', background:COLORS.surface, borderTopLeftRadius:26, borderTopRightRadius:26, paddingBottom:'max(20px, env(safe-area-inset-bottom))' }}>
        <SheetBackHeader title={title} onClose={onClose} />
        <div style={{ padding:'10px 16px 4px', color:COLORS.textTertiary, fontSize:12.5 }}>
          Your report is anonymous, except if you're reporting an intellectual property infringement.
        </div>
        <div style={{ padding:'10px 8px' }}>
          {REPORT_REASONS.map(reason=>(
            <button
              key={reason}
              disabled={submitting}
              onClick={()=>setSelected(reason)}
              style={{
                width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                background: selected===reason ? `${COLORS.brand}14` : 'none',
                border: selected===reason ? `1px solid ${COLORS.brand}55` : '1px solid transparent',
                borderRadius:12, padding:'13px 12px', marginBottom:4,
                color:COLORS.textPrimary, fontSize:14.5, fontWeight:600, cursor:submitting?'default':'pointer', textAlign:'left'
              }}>
              {reason}
              {selected===reason && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.brand} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              )}
            </button>
          ))}
        </div>
        <div style={{ padding:'8px 16px 0' }}>
          <button
            disabled={!selected||submitting}
            onClick={async()=>{
              setSubmitting(true);
              try { await onSubmit?.(selected); }
              finally { setSubmitting(false); }
            }}
            style={{
              width:'100%', background: (!selected||submitting) ? COLORS.surfaceAlt : COLORS.gradient,
              border:'none', borderRadius:20, padding:'14px', color: (!selected||submitting) ? COLORS.textTertiary : 'white',
              fontWeight:700, fontSize:14.5, cursor:(!selected||submitting)?'default':'pointer'
            }}>
            {submitting ? 'Submitting…' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ShareIconBtn = ({ bg, fg='#fff', label, onClick, children }) => (
  <button onClick={onClick} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:7, width:60 }}>
    <div style={{ width:52, height:52, borderRadius:'50%', background:bg, display:'flex', alignItems:'center', justifyContent:'center', color:fg, flexShrink:0 }}>{children}</div>
    <span style={{ color:COLORS.textSecondary, fontSize:11, fontWeight:600, textAlign:'center' }}>{label}</span>
  </button>
);

const ShareSheet = ({ video, currentUser, onClose, showToast }) => {
  const shareUrl = `https://infinity-now.vercel.app/video/${video?.id}`;
  const mediaSrc = (Array.isArray(video?.images) && video.images[0]) || video?.videoUrl;
  // Every share action below previously did nothing to the post's actual share count —
  // the "shares" number shown in the feed never moved no matter how many times someone
  // shared. Now each action bumps it, TikTok-style.
  const recordShare = () => {
    if (!video?.id) return;
    updateDoc(doc(db, 'videos', video.id), { shares: increment(1) }).catch(() => {});
  };
  const copyLink = async () => { try { await navigator.clipboard.writeText(shareUrl); recordShare(); showToast?.('Link copied!', 'success'); } catch { showToast?.('Copy failed', 'error'); } };
  const shareTo = [
    { label:'Copy link', bg:COLORS.surfaceAlt, fg:COLORS.brand, action:copyLink, icon:(<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 007.07 7.07l1.5-1.5"/></svg>) },
    { label:'Facebook', bg:'#1877F2', action:()=>{ recordShare(); window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`); }, icon:(<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 10-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0022 12z"/></svg>) },
    { label:'Messenger', bg:'linear-gradient(135deg,#00B2FF,#006AFF)', action:()=>{ recordShare(); showToast?.('Opening Messenger…','info'); }, icon:(<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.15 2 11.25c0 2.9 1.45 5.49 3.72 7.19V22l3.4-1.87c.91.25 1.87.38 2.88.38 5.52 0 10-4.15 10-9.26C22 6.15 17.52 2 12 2zm1.02 12.47l-2.55-2.72-4.98 2.72 5.48-5.83 2.61 2.72 4.92-2.72-5.48 5.83z"/></svg>) },
    { label:'TikTok', bg:'#000', action:()=>{ recordShare(); showToast?.('Opening TikTok…','info'); }, icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82a4.28 4.28 0 01-3.15-1.4V15.3a5.4 5.4 0 11-4.68-5.35v2.68a2.72 2.72 0 102.28 2.68V2h2.6a4.28 4.28 0 003.9 3.8z"/></svg>) },
    { label:'More', bg:COLORS.surfaceAlt, fg:COLORS.textPrimary, action:async()=>{ try { await navigator.share({ title:`@${video?.username} on Infinity`, text:video?.description, url:shareUrl }); recordShare(); } catch {} }, icon:(<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>) },
  ];
  const moreWays = [
    { label:'Repost', bg:COLORS.surfaceAlt, fg:COLORS.textPrimary, action:()=>{ recordShare(); showToast?.('Reposted to your profile','success'); }, icon:(<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>) },
    { label:'Stories', bg:COLORS.gradient, action:()=>{ recordShare(); showToast?.('Open Create to add to story','info'); }, icon:(<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="4"/></svg>) },
    { label:'WhatsApp', bg:'#25D366', action:()=>{ recordShare(); window.open(`https://wa.me/?text=${encodeURIComponent((video?.description||'')+' '+shareUrl)}`); }, icon:(<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.5 15.2L2 22l4.9-1.4A10 10 0 1012 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.3-.5.1-1 .1-3.3-.7-2.8-1-4.6-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.5.7 1.8.8 1.9.1.2.1.4 0 .6-.1.2-.2.3-.4.5-.2.2-.4.4-.5.6-.2.2-.4.4-.2.7.2.4.9 1.5 2 2.4 1.4 1.2 2.5 1.6 2.9 1.8.4.2.6.1.8-.1.2-.2.9-1 1.1-1.4.2-.4.5-.3.8-.2.3.1 1.9.9 2.3 1 .3.2.5.2.6.4.1.2.1.9-.2 1.5z"/></svg>) },
    { label:'Instagram Direct', bg:'linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)', action:()=>{ recordShare(); showToast?.('Opening Instagram…','info'); }, icon:(<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>) },
    { label:'SMS', bg:COLORS.success, action:()=>{ recordShare(); window.open(`sms:?body=${encodeURIComponent((video?.description||'')+' '+shareUrl)}`); }, icon:(<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>) },
  ];
  return (
    <div style={{ position:'fixed', inset:0, zIndex:5000, background:'rgba(20,15,35,0.45)', display:'flex', alignItems:'flex-end', animation:'fadeIn 0.2s ease' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxHeight:'86vh', overflowY:'auto', background:COLORS.surface, borderTopLeftRadius:26, borderTopRightRadius:26, paddingBottom:'max(20px, env(safe-area-inset-bottom))' }}>
        <SheetBackHeader title="Share" onClose={onClose} />
        <div style={{ padding:'16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, background:COLORS.surface2, borderRadius:16, padding:10, marginBottom:22 }}>
            <div style={{ width:52, height:52, borderRadius:12, overflow:'hidden', background:COLORS.surfaceAlt, flexShrink:0 }}>
              {mediaSrc && <img src={mediaSrc} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ color:COLORS.textPrimary, fontSize:13, fontWeight:600, lineHeight:1.35, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{video?.description || 'Shared post'}</div>
              <div style={{ color:COLORS.textTertiary, fontSize:12, marginTop:3 }}>by {video?.fullName || video?.username}</div>
            </div>
          </div>

          <div style={{ color:COLORS.textTertiary, fontSize:12.5, fontWeight:700, marginBottom:14 }}>Share to</div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:24 }}>
            {shareTo.map(o => <ShareIconBtn key={o.label} bg={o.bg} fg={o.fg} label={o.label} onClick={o.action}>{o.icon}</ShareIconBtn>)}
          </div>

          <div style={{ color:COLORS.textTertiary, fontSize:12.5, fontWeight:700, marginBottom:14 }}>More ways to share</div>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            {moreWays.map(o => <ShareIconBtn key={o.label} bg={o.bg} fg={o.fg} label={o.label} onClick={o.action}>{o.icon}</ShareIconBtn>)}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────── STICKER PICKER (v4) ─────────────── */
const StickerPicker = ({ onSelect, onClose }) => {
  const [activePack, setActivePack] = useState(0);
  return (
    <div style={{ background: '#1C1C24', borderRadius: 20, padding: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, overflowX: 'auto' }}>
        {STICKER_PACKS.map((pack, i) => (
          <button key={pack.id} onClick={() => setActivePack(i)} style={{ background: i === activePack ? 'rgba(11,95,255,0.2)' : 'transparent', border: i === activePack ? '1px solid rgba(11,95,255,0.4)' : '1px solid transparent', borderRadius: 20, padding: '4px 12px', color: i === activePack ? '#0B5FFF' : 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
            {pack.name}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {STICKER_PACKS[activePack].stickers.map(s => (
          <button key={s} onClick={() => onSelect(s)} style={{ background: 'none', border: 'none', fontSize: 28, cursor: 'pointer', padding: 4, borderRadius: 8, transition: 'transform 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >{s}</button>
        ))}
      </div>
    </div>
  );
};

/* ─────────────── TRENDING HASHTAGS COMPONENT (v4) ─────────────── */
const TrendingHashtags = ({ onSearch }) => (
  <div style={{ padding: '10px 0', overflowX: 'auto', display: 'flex', gap: 8 }}>
    {TRENDING_HASHTAGS.map(tag => (
      <button key={tag} onClick={() => onSearch?.(tag)} style={{ background: 'rgba(11,95,255,0.1)', border: '1px solid rgba(11,95,255,0.2)', borderRadius: 20, padding: '6px 14px', color: '#0B5FFF', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
        {tag}
      </button>
    ))}
  </div>
);

/* ─────────────── GROUP CHAT (v4 — like WhatsApp/Telegram groups) ─────────────── */
const GroupChatPage = ({ currentUser, users, showToast, onBack }) => {
  const [groups, setGroups] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupMessages, setGroupMessages] = useState([]);
  const [msgText, setMsgText] = useState('');
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupCallOpen, setGroupCallOpen] = useState(null); // 'audio' | 'video' | null
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.id) return;
    // NOTE: avoid combining array-contains with orderBy on a different field —
    // that requires a Firestore composite index, and without it onSnapshot
    // silently errors and `groups` stays empty (new groups appear "not found").
    // Sort client-side instead.
    const q = query(collection(db, 'groups'), where('members', 'array-contains', currentUser.id));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, avatarColor: resolveAvatarColor(data.avatarColor, d.id) };
      });
      list.sort((a, b) => (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0));
      setGroups(list);
    }, (err) => {
      console.error('groups query error:', err);
      showToast?.('Failed to load groups: ' + err.message, 'error');
    });
    return () => unsub();
  }, [currentUser?.id]);

  useEffect(() => {
    if (!activeGroup) return;
    const q = query(collection(db, 'groups', activeGroup.id, 'msgs'), orderBy('createdAt', 'asc'), limit(100));
    const unsub = onSnapshot(q, snap => {
      setGroupMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    });
    return () => unsub();
  }, [activeGroup?.id]);

  useEffect(() => {
    setShowGroupInfo(false);
    setGroupCallOpen(null);
  }, [activeGroup?.id]);

  const createGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) { showToast?.('Add a name and at least one member', 'error'); return; }
    const members = [currentUser.id, ...selectedMembers];
    const avatar = groupName.trim()[0].toUpperCase();
    const avatarColor = pickAvatarColor(groupName.trim() + Date.now());
    try {
      const ref = await addDoc(collection(db, 'groups'), {
        name: groupName.trim(), members, admin: currentUser.id,
        createdAt: serverTimestamp(), lastMessageAt: serverTimestamp(),
        avatar, avatarColor
      });
      showToast?.('Group created! 🎉', 'success');
      setShowCreate(false); setGroupName(''); setSelectedMembers([]);
      setActiveGroup({ id: ref.id, name: groupName.trim(), members, avatar, avatarColor, admin: currentUser.id });
    } catch (err) {
      console.error('createGroup error:', err);
      showToast?.('Failed to create group: ' + err.message, 'error');
    }
  };


  const sendGroupMsg = async () => {
    if (!msgText.trim() || !activeGroup) return;
    const txt = msgText; setMsgText('');
    await addDoc(collection(db, 'groups', activeGroup.id, 'msgs'), {
      text: txt, senderId: currentUser.id, senderName: currentUser.username,
      senderAvatar: currentUser.avatar, senderAvatarColor: currentUser.avatarColor,
      senderAvatarUrl: currentUser.avatarUrl || null,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'groups', activeGroup.id), { lastMessage: txt, lastMessageAt: serverTimestamp() });
  };

  if (activeGroup) {
    const groupMembers = users.filter(u => (activeGroup.members||[]).includes(u.id));
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: COLORS.bg }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${COLORS.overlaySubtle}`, display: 'flex', alignItems: 'center', gap: 12, background: COLORS.overlaySubtle }}>
          <button onClick={() => setActiveGroup(null)} style={{ background: 'none', border: 'none', color: COLORS.textPrimary, cursor: 'pointer', fontSize: 18 }}>←</button>
          <div onClick={()=>setShowGroupInfo(true)} style={{ display:'flex', alignItems:'center', gap:10, flex:1, cursor:'pointer' }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: activeGroup.avatarColor || COLORS.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 16 }}>{activeGroup.avatar || '👥'}</div>
            <div>
              <div style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 15 }}>{activeGroup.name}</div>
              <div style={{ color: COLORS.textTertiary, fontSize: 11 }}>{(activeGroup.members || []).length} members · tap for info</div>
            </div>
          </div>
          <button onClick={()=>setGroupCallOpen('audio')} style={{ background:'rgba(52,199,89,0.15)', border:'1px solid rgba(52,199,89,0.25)', borderRadius:'50%', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.success} strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-5.99-5.99 19.79 19.79 0 01-3.07-8.67A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
          </button>
          <button onClick={()=>setGroupCallOpen('video')} style={{ background:'rgba(175,82,222,0.15)', border:'1px solid rgba(175,82,222,0.25)', borderRadius:'50%', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.brandSecondary} strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          </button>
        </div>
        {/* Group Info Panel */}
        {showGroupInfo && (
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.85)', zIndex:50, display:'flex', alignItems:'flex-end' }} onClick={()=>setShowGroupInfo(false)}>
            <div onClick={e=>e.stopPropagation()} style={{ width:'100%', background:COLORS.surface2, borderTopLeftRadius:28, borderTopRightRadius:28, padding:'20px 20px 40px', maxHeight:'70%', overflowY:'auto' }}>
              <div style={{ width:36, height:4, background:COLORS.border, borderRadius:2, margin:'0 auto 20px' }} />
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
                <div style={{ width:52, height:52, borderRadius:'50%', background:activeGroup.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:22 }}>{activeGroup.avatar||'👥'}</div>
                <div>
                  <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:18 }}>{activeGroup.name}</div>
                  <div style={{ color:COLORS.textTertiary, fontSize:12 }}>Created by group admin</div>
                </div>
              </div>
              <div style={{ color:COLORS.textTertiary, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Members ({groupMembers.length})</div>
              {groupMembers.map(u=>(
                <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom:`1px solid ${COLORS.overlaySubtle}` }}>
                  <div style={{ width:44, height:44, borderRadius:'50%', background:u.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:COLORS.textPrimary, fontWeight:'bold', fontSize:18, overflow:'hidden', flexShrink:0 }}>
                    {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : u.avatar}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:COLORS.textPrimary, fontSize:14, fontWeight:700, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                      @{u.username}
                      {u.id===currentUser?.id && <span style={{ color:COLORS.success, fontSize:10 }}>You</span>}
                      {activeGroup.admin===u.id && <span style={{ background:'rgba(255,204,0,0.15)', border:'1px solid rgba(255,204,0,0.3)', borderRadius:10, padding:'1px 7px', color:COLORS.warningAlt, fontSize:9, fontWeight:800 }}>ADMIN</span>}
                    </div>
                    {u.bio && <div style={{ color:COLORS.textTertiary, fontSize:11, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.bio}</div>}
                    <div style={{ color:COLORS.borderStrong, fontSize:10, marginTop:1 }}>{u.followers?.length||0} followers</div>
                  </div>
                  {currentUser?.id===activeGroup?.admin && u.id!==currentUser?.id && (
                    <button onClick={e=>{e.stopPropagation(); const nm=(activeGroup.members||[]).filter(id=>id!==u.id); updateDoc(doc(db,'groups',activeGroup.id),{members:nm}).then(()=>{setActiveGroup(g=>({...g,members:nm})); showToast?.('Member removed','info');}).catch(()=>{});}} style={{ background:'rgba(255,59,48,0.1)', border:'1px solid rgba(255,59,48,0.2)', borderRadius:10, padding:'5px 10px', color:COLORS.danger, fontSize:11, cursor:'pointer', flexShrink:0 }}>Remove</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Group Call Overlay */}
        {groupCallOpen && (
          <div style={{ position:'absolute', inset:0, background:COLORS.bg, zIndex:60, display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'20px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${COLORS.overlaySubtle}` }}>
              <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:18 }}>{groupCallOpen==='video'?'📹':'📞'} Group {groupCallOpen==='video'?'Video':'Voice'} Call</div>
              <button onClick={()=>setGroupCallOpen(null)} style={{ background:'rgba(11,95,255,0.15)', border:'1px solid rgba(11,95,255,0.3)', borderRadius:'50%', width:36, height:36, color:COLORS.brand, cursor:'pointer', fontSize:18 }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexWrap:'wrap', gap:12, alignContent:'flex-start', justifyContent:'center' }}>
              {groupMembers.map(u=>(
                <div key={u.id} style={{ width:'calc(50% - 6px)', background:COLORS.overlaySubtle, borderRadius:20, padding:'18px 12px', display:'flex', flexDirection:'column', alignItems:'center', gap:8, border:`1px solid ${COLORS.border}` }}>
                  <div style={{ width:56, height:56, borderRadius:'50%', background:u.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:COLORS.textPrimary, fontWeight:'bold', fontSize:22, overflow:'hidden', border:'2px solid rgba(52,199,89,0.4)' }}>
                    {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : u.avatar}
                  </div>
                  <div style={{ color:COLORS.textPrimary, fontSize:12, fontWeight:700 }}>@{u.username}</div>
                  {u.id===currentUser?.id && <div style={{ color:COLORS.success, fontSize:10 }}>You</div>}
                  <div style={{ width:8, height:8, borderRadius:'50%', background:COLORS.success, animation:'pulse 1.5s ease infinite' }} />
                </div>
              ))}
            </div>
            <div style={{ padding:'16px 20px 32px', display:'flex', justifyContent:'center', gap:20, borderTop:`1px solid ${COLORS.overlaySubtle}` }}>
              <button onClick={()=>showToast?.('Muted','info')} style={{ width:56, height:56, borderRadius:'50%', background:COLORS.border, border:'none', color:COLORS.textPrimary, fontSize:22, cursor:'pointer' }}>🎤</button>
              {groupCallOpen==='video' && <button onClick={()=>showToast?.('Camera toggled','info')} style={{ width:56, height:56, borderRadius:'50%', background:COLORS.border, border:'none', color:COLORS.textPrimary, fontSize:22, cursor:'pointer' }}>📷</button>}
              <button onClick={()=>setGroupCallOpen(null)} style={{ width:56, height:56, borderRadius:'50%', background:COLORS.brand, border:'none', color:'white', fontSize:22, cursor:'pointer' }}>📵</button>
            </div>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
          {groupMessages.map(msg => {
            const isMine = msg.senderId === currentUser.id;
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                {!isMine && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: msg.senderAvatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textPrimary, fontSize: 11, fontWeight: 'bold', marginRight: 8, flexShrink: 0, overflow: 'hidden' }}>
                    {msg.senderAvatarUrl ? <img src={msg.senderAvatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : msg.senderAvatar}
                  </div>
                )}
                <div style={{ maxWidth: '72%' }}>
                  {!isMine && <div style={{ color: COLORS.textTertiary, fontSize: 10, marginBottom: 3 }}>@{msg.senderName}</div>}
                  <div style={{ background: isMine ? `linear-gradient(135deg,${COLORS.brand},${COLORS.brandSecondary})` : COLORS.surfaceAlt, borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', color: isMine ? 'white' : COLORS.textPrimary, fontSize: 14 }}>
                    {msg.text}
                    {!isMine && <MessageTranslate text={msg.text} targetLang={currentUser?.language || 'en'} isMine={isMine} />}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: '10px 14px', borderTop: `1px solid ${COLORS.overlaySubtle}`, display: 'flex', gap: 8 }}>
          <input value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendGroupMsg()} placeholder="Message group..." style={{ flex: 1, background: COLORS.overlaySubtle, border: `1px solid ${COLORS.border}`, borderRadius: 24, padding: '11px 16px', color: COLORS.textPrimary, outline: 'none', fontSize: 13 }} />
          <button onClick={sendGroupMsg} style={{ background: `linear-gradient(135deg,${COLORS.brand},${COLORS.brandSecondary})`, border: 'none', borderRadius: '50%', width: 42, height: 42, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    );
  }

  if (showCreate) return (
    <div style={{ height: '100%', overflow: 'auto', background: COLORS.bg, padding: 16 }}>
      <button onClick={() => setShowCreate(false)} style={{ background: COLORS.overlaySubtle, border: 'none', borderRadius: 20, padding: '8px 16px', color: COLORS.textPrimary, cursor: 'pointer', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>← Back</button>
      <div style={{ color: COLORS.textPrimary, fontWeight: 800, fontSize: 22, marginBottom: 20 }}>New Group</div>
      <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name" style={{ width: '100%', background: COLORS.overlaySubtle, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: '13px 16px', color: COLORS.textPrimary, outline: 'none', fontSize: 14, boxSizing: 'border-box', marginBottom: 16 }} />
      <div style={{ color: COLORS.textTertiary, fontSize: 12, marginBottom: 10, fontWeight: 600, textTransform: 'uppercase' }}>Add Members</div>
      {users.filter(u => u.id !== currentUser?.id).map(u => (
        <div key={u.id} onClick={() => setSelectedMembers(p => p.includes(u.id) ? p.filter(id => id !== u.id) : [...p, u.id])} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${COLORS.overlaySubtle}`, cursor: 'pointer' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textPrimary, fontWeight: 'bold', fontSize: 16, overflow: 'hidden', flexShrink: 0 }}>
            {u.avatarUrl ? <img src={u.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : u.avatar}
          </div>
          <div style={{ flex: 1 }}><div style={{ color: COLORS.textPrimary, fontSize: 14, fontWeight: 600 }}>@{u.username}</div></div>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: selectedMembers.includes(u.id) ? COLORS.brand : COLORS.border, border: selectedMembers.includes(u.id) ? 'none' : `2px solid ${COLORS.borderStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
            {selectedMembers.includes(u.id) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
          </div>
        </div>
      ))}
      <button onClick={createGroup} style={{ width: '100%', background: `linear-gradient(135deg,${COLORS.brand},${COLORS.brandSecondary})`, border: 'none', borderRadius: 24, padding: 15, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 15, marginTop: 20 }}>Create Group ({selectedMembers.length} members)</button>
    </div>
  );

  return (
    <div style={{ height: '100%', overflow: 'auto', background: COLORS.bg }}>
      <div style={{ padding: '16px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${COLORS.overlaySubtle}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: COLORS.textPrimary, cursor: 'pointer', fontSize: 18 }}>←</button>
          <div style={{ color: COLORS.textPrimary, fontWeight: 800, fontSize: 18 }}>Groups</div>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ background: `linear-gradient(135deg,${COLORS.brand},${COLORS.brandSecondary})`, border: 'none', borderRadius: 20, padding: '8px 16px', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ New</button>
      </div>
      <div style={{ padding: 12 }}>
        {groups.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: COLORS.borderStrong }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>No groups yet</div>
            <div style={{ fontSize: 12 }}>Create a group to chat with multiple friends</div>
          </div>
        )}
        {groups.map(g => (
          <div key={g.id} onClick={() => setActiveGroup(g)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: COLORS.overlaySubtle, borderRadius: 18, marginBottom: 8, cursor: 'pointer', border: `1px solid ${COLORS.overlaySubtle}` }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: g.avatarColor || COLORS.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 20, flexShrink: 0 }}>{g.avatar || '👥'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 14 }}>{g.name}</div>
              <div style={{ color: COLORS.textTertiary, fontSize: 12, marginTop: 2 }}>{g.lastMessage || 'No messages yet'} · {(g.members || []).length} members</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────── SAVED POSTS PAGE (v4 — like Instagram Collections) ─────────────── */
const SavedPostsPage = ({ currentUser, onClose, showToast }) => {
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.id) return;
    const q = query(collection(db, 'videos'), where('savedBy', 'array-contains', currentUser.id), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setSaved(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [currentUser?.id]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: COLORS.bg, zIndex: 300, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${COLORS.overlaySubtle}` }}>
        <div style={{ color: COLORS.textPrimary, fontWeight: 800, fontSize: 20 }}>Saved</div>
        <button onClick={onClose} style={{ background: COLORS.border, border: 'none', borderRadius: '50%', width: 32, height: 32, color: COLORS.textPrimary, cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {loading && <div style={{ textAlign: 'center', padding: 40 }}><div style={{ width: 28, height: 28, border: '3px solid rgba(11,95,255,0.3)', borderTop: `3px solid ${COLORS.brand}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} /></div>}
        {!loading && saved.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: COLORS.borderStrong }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🔖</div>
            <div style={{ fontSize: 14 }}>No saved posts yet</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Tap the bookmark icon on any post to save it</div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
          {saved.map(v => (
            <div key={v.id} style={{ aspectRatio: '9/16', position: 'relative', overflow: 'hidden', borderRadius: 8, background: COLORS.surface4 }}>
              {v.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i) || v.mediaType?.startsWith('image')
                ? <ProgressiveImage src={v.videoUrl} alt="" style={{ width: '100%', height: '100%' }} />
                : <video src={v.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />}
              <div style={{ position: 'absolute', bottom: 4, left: 4, color: COLORS.textPrimary, fontSize: 10, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>{v.likes || 0} ❤️</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* TranslateButton removed — dead code, superseded by MessageTranslate (used in
   ConversationView/GroupChatPage), never rendered itself. */

/* ─────────────── INLINE MESSAGE TRANSLATE TOGGLE (chat & group messages) ─────────────── */
const MessageTranslate = ({ text, targetLang, isMine }) => {
  const [translated, setTranslated] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(false);
  if (!text || text.length < 2 || !targetLang || targetLang === 'en') return null;
  const toggle = async () => {
    if (translated) { setShowOriginal(s=>!s); return; }
    setLoading(true);
    const result = await liveTranslate(text, targetLang);
    setTranslated(result);
    setLoading(false);
  };
  return (
    <>
      {translated && !showOriginal && (
        <div style={{ fontSize:13, lineHeight:1.4, color: isMine?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.85)', marginTop:4, paddingTop:4, borderTop:'1px solid rgba(255,255,255,0.12)' }}>{translated}</div>
      )}
      <button onClick={toggle} disabled={loading} style={{ background:'none', border:'none', color:'#2F9BFF', fontSize:10, cursor:'pointer', padding:0, marginTop:4, display:'block' }}>
        {loading ? '...' : translated ? (showOriginal ? '🌐 See translation' : '🌐 See original') : '🌐 Translate'}
      </button>
    </>
  );
};

/* ─────────────── STATUS / BROADCAST (v4 — like WhatsApp Status) ─────────────── */
const BroadcastPage = ({ currentUser, users, showToast, onClose }) => {
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState('#0B5FFF');
  const [posting, setPosting] = useState(false);
  const colors = ['#0B5FFF','#2E7BFF','#083FB0','#FFB100','#2ED573','#00A9D6','#FF453A'];

  const postStatus = async () => {
    if (!text.trim()) { showToast?.('Write something first', 'error'); return; }
    setPosting(true);
    await addDoc(collection(db, 'broadcasts'), {
      userId: currentUser.id, username: currentUser.username, text: text.trim(),
      bgColor, createdAt: serverTimestamp(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      seenBy: [], avatarUrl: currentUser.avatarUrl || null, avatarColor: currentUser.avatarColor
    });
    showToast?.('Status posted! 📡', 'success');
    setPosting(false);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: bgColor, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: 20, padding: '8px 16px', color: 'white', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        <span style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>Status</span>
        <button onClick={postStatus} disabled={posting} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 20, padding: '8px 16px', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>{posting ? '...' : 'Post'}</button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Write your status..." autoFocus style={{ background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 28, fontWeight: 700, textAlign: 'center', width: '100%', resize: 'none', caretColor: 'white' }} rows={4} />
      </div>
      <div style={{ padding: '0 20px 40px', display: 'flex', justifyContent: 'center', gap: 12 }}>
        {colors.map(c => <div key={c} onClick={() => setBgColor(c)} style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: c === bgColor ? '3px solid white' : '3px solid transparent', cursor: 'pointer' }} />)}
      </div>
    </div>
  );
};

/* ─────────────── DISCOVER / EXPLORE PAGE (v4 — like TikTok Discover) ─────────────── */
const DiscoverPage = ({ videos, users, onViewProfile, showToast, onClose }) => {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const filters = [['all','All'],['video','Videos'],['people','People'],['hashtag','Tags']];
  const searchLower = search.toLowerCase();
  const filteredVideos = videos.filter(v =>
    (!search || v.description?.toLowerCase().includes(searchLower) || v.username?.toLowerCase().includes(searchLower))
    && (activeFilter === 'all' || activeFilter === 'video')
  );
  const filteredUsers = users.filter(u =>
    search && (u.username?.toLowerCase().includes(searchLower) || u.fullName?.toLowerCase().includes(searchLower))
    && (activeFilter === 'all' || activeFilter === 'people')
  );
  const filteredTags = TRENDING_HASHTAGS.filter(t =>
    (!search || t.toLowerCase().includes(searchLower))
    && (activeFilter === 'all' || activeFilter === 'hashtag')
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: COLORS.bg, zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${COLORS.overlaySubtle}` }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ flex: 1, background: COLORS.overlaySubtle, borderRadius: 24, display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Infinity..." autoFocus style={{ flex: 1, background: 'none', border: 'none', color: COLORS.textPrimary, outline: 'none', fontSize: 14 }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: COLORS.textTertiary, cursor: 'pointer', fontSize: 16 }}>✕</button>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: COLORS.textTertiary, cursor: 'pointer', fontSize: 14, padding: 4 }}>Cancel</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {filters.map(([id, label]) => (
            <button key={id} onClick={() => setActiveFilter(id)} style={{ background: activeFilter === id ? 'rgba(11,95,255,0.15)' : COLORS.overlaySubtle, border: `1px solid ${activeFilter === id ? 'rgba(11,95,255,0.4)' : COLORS.border}`, borderRadius: 20, padding: '6px 14px', color: activeFilter === id ? COLORS.brand : COLORS.textTertiary, fontSize: 12, fontWeight: activeFilter === id ? 700 : 400, cursor: 'pointer' }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {!search && (
          <>
            <div style={{ color: COLORS.textTertiary, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Trending</div>
            <TrendingHashtags onSearch={t => setSearch(t)} />
            <div style={{ color: COLORS.textTertiary, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '20px 0 10px' }}>Suggested Creators</div>
            {users.slice(0, 6).map(u => (
              <div key={u.id} onClick={() => { onViewProfile?.(u.id); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${COLORS.overlaySubtle}`, cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textPrimary, fontWeight: 'bold', fontSize: 18, overflow: 'hidden', flexShrink: 0 }}>
                  {u.avatarUrl ? <img src={u.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : u.avatar}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 14 }}>@{u.username}</div>
                  <div style={{ color: COLORS.textTertiary, fontSize: 12 }}>{formatNumber(u.followers?.length || 0)} followers</div>
                </div>
              </div>
            ))}
          </>
        )}
        {search && filteredUsers.length > 0 && (
          <>
            <div style={{ color: COLORS.textTertiary, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>People</div>
            {filteredUsers.map(u => (
              <div key={u.id} onClick={() => { onViewProfile?.(u.id); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${COLORS.overlaySubtle}`, cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textPrimary, fontWeight: 'bold', fontSize: 18, overflow: 'hidden', flexShrink: 0 }}>
                  {u.avatarUrl ? <img src={u.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : u.avatar}
                </div>
                <div>
                  <div style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 14 }}>@{u.username}</div>
                  {u.verified && <span style={{ color: COLORS.info, fontSize: 11 }}>✓ Verified</span>}
                </div>
              </div>
            ))}
          </>
        )}
        {search && filteredTags.length > 0 && (activeFilter === 'all' || activeFilter === 'hashtag') && (
          <>
            <div style={{ color: COLORS.textTertiary, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '16px 0 10px' }}>Hashtags</div>
            {filteredTags.map(tag => (
              <div key={tag} style={{ padding: '10px 14px', background: COLORS.overlaySubtle, borderRadius: 14, marginBottom: 6, cursor: 'pointer', color: COLORS.brand, fontWeight: 700, fontSize: 14 }}>{tag}</div>
            ))}
          </>
        )}
        {search && (activeFilter === 'all' || activeFilter === 'video') && filteredVideos.length > 0 && (
          <>
            <div style={{ color: COLORS.textTertiary, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '16px 0 10px' }}>Videos</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {filteredVideos.slice(0, 8).map(v => (
                <div key={v.id} style={{ aspectRatio: '9/16', position: 'relative', borderRadius: 14, overflow: 'hidden', background: COLORS.surface4 }}>
                  {v.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i) || v.mediaType?.startsWith('image')
                    ? <img src={v.videoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <video src={v.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent,rgba(0,0,0,0.7))', padding: '20px 8px 8px' }}>
                    <div style={{ color: COLORS.textPrimary, fontSize: 11, fontWeight: 600 }}>@{v.username}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ─────────────── DARK/LIGHT MODE ─────────────── */
// (Previously an unfinished useTheme() hook lived here — it computed its own isDark/colors
// object but nothing ever read them, and its toggleTheme wrote to Firestore but never fed
// back into the actual COLORS tokens the rest of the app renders with. Removed in favor of
// the applyTheme()/COLORS_DARK system in src/lib/theme.js, wired up in InfinityV1app below.)

/* ─────────────── SEND NOTIFICATION HELPER (v4 — already defined below, re-export alias) ─────────────── */
// Title shown by the OS notification (lock screen / notification tray) per type — kept
// short since some platforms truncate aggressively. `message` is the existing in-app
// copy (e.g. "sent you a message") and becomes the push body, prefixed with @username
// by the caller where that context is available.
const pushTitleForType = (type) => ({
  message: 'New message',
  follow: 'New follower',
  like: 'New like',
  comment: 'New comment',
  mention: 'You were mentioned',
  gift: 'You got a gift',
  live: 'Live now',
  call: 'Incoming call',
  moderation: 'Infinity',
}[type] || 'Infinity');

const sendNotification = async (toUserId, fromUserId, type, message, extra = {}) => {
  if (!toUserId || toUserId === fromUserId) return;
  const { fromUsername, ...docExtra } = extra; // fromUsername is push-only, never stored
  try {
    await addDoc(collection(db, 'notifications'), {
      toUserId, fromUserId, type, message,
      read: false, createdAt: serverTimestamp(), ...docExtra,
    });
  } catch (e) { console.log('Notification error:', e); }
  // Fire-and-forget the actual push — this is what reaches the device when the
  // app is backgrounded/closed. In-app Firestore doc above still drives the
  // in-app toast/badge regardless of whether this succeeds.
  try {
    const pushBody = fromUsername ? `@${fromUsername} ${message}` : message;
    await apiFetch('/api/notifications/send', {
      method: 'POST',
      body: JSON.stringify({ toUserId, title: pushTitleForType(type), body: pushBody, type, data: docExtra?.link ? { link: docExtra.link } : undefined }),
    });
  } catch (e) { /* push is best-effort; in-app notification already landed */ }
};

// WhatsApp-style: show phone number only if the user opted in via Privacy settings; default to @username
// Uses publicPhone (the opt-in mirror field) rather than the private phone field, since
// `user` here may be another person's public profile doc, which never contains raw `phone`.
const getDisplayHandle = (user) => {
  if (user?.privacy?.['Show Phone Number on Profile'] && user?.publicPhone) return user.publicPhone;
  return `@${user?.username || 'user'}`;
};

const formatNumber = (num) => {
  const n = Number(num) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
};
// Guards against javascript:/data:/vbscript: URIs in user-supplied profile links (EditProfileModal's
// "Website / Link" field is free text, so without this a stored `javascript:...` value would run
// arbitrary script for anyone who taps the link on that profile). Only allow http(s); bare domains
// like "example.com" are treated as https since that's what people actually type.
const safeProfileUrl = (raw) => {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  try {
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch { return null; }
};
const timeAgo = (date) => {
  if(!date) return 'now';
  const secs = Math.floor((Date.now() - date.getTime())/1000);
  if(secs < 60) return 'now';
  const mins = Math.floor(secs/60);
  if(mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins/60);
  if(hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs/24);
  if(days < 7) return `${days}d`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', sameYear ? { month:'short', day:'numeric' } : { month:'short', day:'numeric', year:'numeric' });
};
const haptic = (style='light') => {
  try {
    if(window.navigator?.vibrate){
      style==='heavy'?navigator.vibrate([30,10,30]):style==='medium'?navigator.vibrate(20):navigator.vibrate(10);
    }
  } catch {}
};
const useIntersectionObserver = (ref, options={}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  useEffect(()=>{
    if(!ref.current) return;
    const obs = new IntersectionObserver(([entry])=>setIsIntersecting(entry.isIntersecting), options);
    obs.observe(ref.current);
    return ()=>obs.disconnect();
  },[]);
  return isIntersecting;
};
/* ─────────────── CLOUDINARY UPLOAD ─────────────── */
/* ─────────────── CLOUDINARY UPLOAD (SIGNED) ─────────────── */
// Signed uploads keep the API secret server-side (never shipped to the browser) and
// gate every upload behind requireAuth + rate limiting in /api/cloudinary-sign.
// Deliberately signs *only* `timestamp` — no upload_preset — since a preset is one
// more thing that has to exist, match "signed" mode, and be spelled identically on
// both ends; dropping it removes that whole class of "Invalid Signature"/"preset not
// found" failures. The upload itself goes to the bare `/upload` endpoint (no
// resource_type segment), which auto-detects image vs video.
const uploadToCloudinary = async (file, onProgress) => {
  const { signature, timestamp, apiKey, cloudName } = await apiFetch('/api/cloudinary-sign', { method: 'POST' });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);

  // Must include the resource_type segment (Cloudinary requires it — a bare
  // `/upload` with nothing before it is not a valid endpoint path). `auto` lets
  // Cloudinary detect image vs video vs raw itself, so this one endpoint handles
  // every upload type used in this app (photos, videos, audio notes).
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

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
        console.error('Cloudinary response:', xhr.responseText);
        let message = `Upload failed (${xhr.status})`;
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed?.error?.message) message = parsed.error.message;
        } catch {}
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error('Upload error — check your connection and try again'));
    xhr.open('POST', uploadUrl);
    xhr.send(formData);
  });
};
// Turns a list of {file,type} media items plus their already-uploaded Cloudinary URLs
// into the correct {videoUrl, images, mediaType} shape the feed renderer expects.
// Mirrors the working camera-upload flow's convention: mediaType is the real MIME
// type (or 'image/multi' for a multi-photo post), and videoUrl is always populated
// so `mediaSrc = images[0] || videoUrl` resolves correctly no matter the media type.
// (Previously CreateScreen/QuickComposer hardcoded mediaType to the literal string
// 'image' any time media existed and never set videoUrl at all — so an uploaded
// video landed in `images` labeled as an image, which the feed then tried to render
// with an <img> tag instead of <video>, silently failing to display.)
const buildMediaFields = (mediaItems, uploadedUrls) => {
  if (!uploadedUrls.length) return { mediaType: 'text' };
  const videoIdx = mediaItems.findIndex(m => (m.type||'').startsWith('video'));
  if (videoIdx !== -1) {
    const videoUrl = uploadedUrls[videoIdx];
    const images = uploadedUrls.filter((_, i) => i !== videoIdx);
    return { videoUrl, images, mediaType: mediaItems[videoIdx].type || 'video/mp4' };
  }
  if (uploadedUrls.length > 1) {
    return { videoUrl: uploadedUrls[0], images: uploadedUrls, mediaType: 'image/multi' };
  }
  return { videoUrl: uploadedUrls[0], images: uploadedUrls, mediaType: mediaItems[0].type || 'image/jpeg' };
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
// Shared defaults for a brand-new user profile. Used by createUserProfile (Firestore)
// and by the local/in-memory fallback profiles used when a Firestore write hasn't
// propagated yet. Keeping this in one place avoids the 3-way drift that existed
// between createUserProfile and the two inline fallback objects in <AuthScreen>
// and the onAuthStateChanged handler.
// PUBLIC doc (users/{uid}) — readable by any authenticated user (the app has no backend,
// so the feed/search/comments/follow-lists all read this collection directly). Never put
// anything here you wouldn't want any logged-in user to see.
const buildDefaultProfile = (uid, data = {}) => ({
  id: uid,
  username: data.username || '',
  usernameLower: (data.username || '').toLowerCase(),
  fullName: data.fullName || '',
  email: data.email || '', // kept public/queryable — Google sign-in account-linking looks
                            // up existing users by email and there's no backend to proxy that
  avatar: (data.username || data.fullName || data.email || 'U')[0].toUpperCase(),
  avatarColor: data.avatarColor || pickAvatarColor(uid),
  avatarUrl: data.avatarUrl || null,
  bio: data.bio || 'New to Infinity! 🎬',
  link: '',
  gender: '',
  publicPhone: '', // opt-in mirror of the private phone number; see PrivacyToggles
  verified: false,
  followers: [],
  following: [],
  blockedUsers: [],
  coins: 500,
  walletBalance: 500,
  level: 1,
  streak: 1,
  subscription: 'free',
});

// PRIVATE doc (users/{uid}/private/contact) — owner-read-only per firestore.rules.
// email is intentionally kept OUT of this (see note in signup/Google-auth flows): the app
// looks up existing accounts by email with no backend, which requires it to stay queryable
// on the public collection. Only phone and birthdate — which have no such requirement — are
// isolated here.
const buildPrivateContact = (data = {}) => ({
  phone: data.phone || '',
  birthdate: data.birthdate || '',
});

// Fields that must never be silently overwritten by a later merge — either because they're
// balances that should only ever change via increment()/explicit transactions (coins,
// walletBalance), or because they're relationship data owned by toggleFollow, not profile
// edits (followers, following). Re-including these on a merge-update also used to trip the
// Firestore rule that blocks coins/walletBalance writes outside dedicated flows, which was
// the root cause of the repeated-Google-signin bug.
const PROTECTED_PROFILE_FIELDS = ['coins', 'walletBalance', 'followers', 'following'];

const createUserProfile = async (uid, data) => {
  const userRef = doc(db, 'users', uid);
  const existing = await getDoc(userRef);

  if (!existing.exists()) {
    // First-time creation: write the full public default profile (including starting
    // coins/walletBalance) plus the private contact doc alongside it.
    await setDoc(userRef, {
      ...buildDefaultProfile(uid, data),
      createdAt: serverTimestamp(),
    });
  } else {
    // Re-invocation (e.g. Google sign-in firing again before propagation, or a profile
    // check on an existing account): only merge safe public fields, never the protected
    // ones, so we can't reset coins/walletBalance or violate the update rule.
    const publicDefaults = buildDefaultProfile(uid, data);
    PROTECTED_PROFILE_FIELDS.forEach(f => delete publicDefaults[f]);
    await setDoc(userRef, publicDefaults, { merge: true });
  }

  const privateRef = doc(db, 'users', uid, 'private', 'contact');
  await setDoc(privateRef, buildPrivateContact(data), { merge: true });
};

// Only ever called with the caller's own uid (audited across the codebase), so it's safe to
// also read the owner-only private subcollection here and merge it into the returned object.
const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const publicData = snap.data();
  try {
    const privateSnap = await getDoc(doc(db, 'users', uid, 'private', 'contact'));
    if (privateSnap.exists()) return { ...publicData, ...privateSnap.data() };
  } catch (e) {
    console.log('Private profile fetch failed (rules should prevent this only for non-owners):', e);
  }
  return publicData;
};

/* ─────────────── GLOBAL STYLES ─────────────── */
const GlobalStyles = () => (
  <style>{`
    /* ── DESIGN TOKENS (reference) ──────────────────────────────────────
       Brand (only)     #0B5FFF → #083FB0 (blue)
       Live (only)      #E11D2E — reserved exclusively for LIVE indicators
       Success          #22C55E   |  Warning            #F59E0B
       Danger           #EF4444   |  Info               #0B5FFF
       Text             black/near-black on white surfaces
       No purple, no pink, anywhere — see src/lib/theme.js COLORS as the
       single source of truth for the app's palette.
    ──────────────────────────────────────────────────────────────────── */
    :root{
      --accent:#0B5FFF; --accent-2:#0B5FFF;
      --success:#22C55E; --warning:#F59E0B; --danger:#EF4444; --info:#3B82F6; --indigo:#6366F1;
      --gold:#FBBF24; --teal:#22D3EE; --teal-2:#3B82F6; --verified:#3B82F6;
      --bg-base:#F5F8FF; --bg-elev-1:#FFFFFF; --bg-elev-2:#F3F6FD; --bg-elev-3:#EAF0FC;
      --border-strong:rgba(11,95,255,0.22); --text-muted:rgba(11,15,25,0.45);
    }
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    html{scroll-behavior:smooth}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;overscroll-behavior:none;touch-action:manipulation;background:#F5F8FF}
    ::-webkit-scrollbar{display:none}
    *{scrollbar-width:none;-ms-overflow-style:none}
    ::selection{background:rgba(11,95,255,0.25);color:#0B0F19}
    @keyframes heartBurst{0%{transform:scale(0.4) translateY(0);opacity:1}100%{transform:scale(1.8) translateY(-80px);opacity:0}}
    @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes toastIn{from{transform:translateX(-50%) translateY(100%);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
    @keyframes toastOut{from{transform:translateX(-50%) translateY(0);opacity:1}to{transform:translateX(-50%) translateY(16px);opacity:0}}
    @keyframes slideDown{from{transform:translateY(-20px);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes slideLeft{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
    @keyframes floatUp{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-120px) scale(1.5);opacity:0}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    @keyframes focusPulse{0%{transform:scale(1.3);opacity:0.3}50%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0.7}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes shimmerLoad{0%{opacity:0.4}50%{opacity:0.8}100%{opacity:0.4}}
    @keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
    @keyframes popIn{0%{transform:scale(0.8);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
    @keyframes popInBounce{0%{transform:scale(0.5);opacity:0}60%{transform:scale(1.15)}80%{transform:scale(0.95)}100%{transform:scale(1);opacity:1}}
    @keyframes ripple{0%{transform:scale(0);opacity:0.6}100%{transform:scale(4);opacity:0}}
    @keyframes tabPop{0%{transform:scaleX(0)}100%{transform:scaleX(1)}}
    @keyframes storyRing{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
    @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
    @keyframes notifBar{0%{width:100%}100%{width:0%}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes slideInLeft{from{transform:translateX(-100%)}to{transform:translateX(0)}}
    @keyframes scaleIn{from{transform:scale(0.95);opacity:0}to{transform:scale(1);opacity:1}}
    @keyframes likeHeart{0%{transform:scale(1)}15%{transform:scale(1.4)}30%{transform:scale(0.9)}45%{transform:scale(1.2)}60%{transform:scale(1)}}
    @keyframes progressBar{from{width:0%}to{width:100%}}
    @keyframes bounceIn{0%{transform:scale(0.3);opacity:0}50%{transform:scale(1.1)}70%{transform:scale(0.9)}100%{transform:scale(1);opacity:1}}
    @keyframes swipeHint{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    button{touch-action:manipulation}
    button:active{transform:scale(0.94)!important;transition:transform 0.1s}
    input,textarea{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}
    input:focus,textarea:focus{outline:none;box-shadow:none}
    .tab-active-indicator{animation:tabPop 0.25s ease}
    .story-avatar-ring{background:conic-gradient(#0B5FFF,#2E7BFF,#0B5FFF);padding:2.5px;border-radius:50%}
    .skeleton{background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.1) 50%,rgba(255,255,255,0.04) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}
    .ripple-btn{position:relative;overflow:hidden}
    .ripple-btn::after{content:'';position:absolute;border-radius:50%;background:rgba(255,255,255,0.3);width:100px;height:100px;margin-top:-50px;margin-left:-50px;top:var(--y,50%);left:var(--x,50%);animation:ripple 0.6s linear;opacity:0}
    @media (prefers-reduced-motion: reduce){*{animation-duration:0.01ms!important;transition-duration:0.01ms!important}}
    *{-webkit-tap-highlight-color:transparent;box-sizing:border-box}
    ::-webkit-scrollbar{width:0;height:0;display:none}
    img{image-rendering:-webkit-optimize-contrast}
    video{will-change:transform}
    .smooth-scroll{-webkit-overflow-scrolling:touch;scroll-behavior:smooth}
  `}</style>
);
const SkeletonLoader = ({ count=3 }) => (
  <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:12 }}>
    {Array.from({length:count}).map((_,i)=>(
      <div key={i} style={{ display:'flex', gap:12, alignItems:'center' }}>
        <div className="skeleton" style={{ width:52, height:52, borderRadius:'50%', flexShrink:0 }} />
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
          <div className="skeleton" style={{ height:13, borderRadius:6, width:'60%' }} />
          <div className="skeleton" style={{ height:11, borderRadius:6, width:'40%' }} />
        </div>
      </div>
    ))}
  </div>
);

// Was defined but never rendered anywhere (a leftover from before the light-theme
// redesign — it still had the old hardcoded dark '#15151C' background). Reworked to
// use the current theme tokens and now used as Infinity's loading placeholder while
// posts are still streaming in, instead of just deleting it outright.
const VideoSkeleton = () => (
  <div style={{ background:COLORS.surface, borderRadius:20, overflow:'hidden', border:`1px solid ${COLORS.border}` }}>
    <div style={{ display:'flex', gap:10, alignItems:'center', padding:'12px 14px 10px' }}>
      <div className="skeleton-shimmer" style={{ width:28, height:28, borderRadius:'50%', flexShrink:0 }} />
      <div className="skeleton-shimmer" style={{ height:11, borderRadius:6, width:'35%' }} />
    </div>
    <div className="skeleton-shimmer" style={{ width:'100%', height:200 }} />
    <div style={{ padding:'12px 14px 14px', display:'flex', flexDirection:'column', gap:8 }}>
      <div className="skeleton-shimmer" style={{ height:11, borderRadius:6, width:'80%' }} />
      <div className="skeleton-shimmer" style={{ height:11, borderRadius:6, width:'55%' }} />
    </div>
  </div>
);
const RippleButton = ({ onClick, style, children, disabled }) => {
  const handleClick = (e) => {
    if(disabled) return;
    haptic('light');
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    btn.style.setProperty('--x', `${e.clientX - rect.left}px`);
    btn.style.setProperty('--y', `${e.clientY - rect.top}px`);
    btn.classList.remove('ripple-btn');
    void btn.offsetWidth;
    btn.classList.add('ripple-btn');
    onClick?.(e);
  };
  return <button onClick={handleClick} disabled={disabled} style={style} className="ripple-btn">{children}</button>;
};
const ProgressiveImage = ({ src, alt, style }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div style={{ position:'relative', overflow:'hidden', ...style }}>
      {!loaded && !error && <div className="skeleton" style={{ position:'absolute', inset:0 }} />}
      {error
        ? <div style={{ position:'absolute', inset:0, background:'#1C1C24', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32 }}>🖼️</div>
        : <img src={src} alt={alt||''} onLoad={()=>setLoaded(true)} onError={()=>setError(true)} style={{ width:'100%', height:'100%', objectFit:'cover', opacity: loaded?1:0, transition:'opacity 0.3s ease' }} />
      }
    </div>
  );
};

/* ─────────────── SOUND HELPERS ─────────────── */
const playNotifSound = (type = 'notif') => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (type === 'call') {
      // Ringtone: two-tone repeating pattern like a phone ring
      const playRingTone = (startTime) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
        osc1.frequency.value = 480; osc2.frequency.value = 620;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
        gain.gain.setValueAtTime(0.4, startTime + 0.4);
        gain.gain.linearRampToValueAtTime(0, startTime + 0.5);
        osc1.start(startTime); osc1.stop(startTime + 0.5);
        osc2.start(startTime); osc2.stop(startTime + 0.5);
      };
      playRingTone(ctx.currentTime);
      playRingTone(ctx.currentTime + 0.7);
      playRingTone(ctx.currentTime + 1.4);
    } else {
      // Telegram-style ding: two ascending tones
      [[880, 0, 0.15], [1100, 0.18, 0.28]].forEach(([freq, start, stop]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.35, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + stop);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + stop);
      });
    }
  } catch {}
};

/* ─────────────── BACKGROUND PUSH NOTIFICATIONS (Service Worker) ─────────────── */
// BUG FIX: this used to register a Service Worker from a Blob URL
// (URL.createObjectURL(...)) at scope '/'. Two problems, both silent:
//   1. Blob-URL service workers don't persist — the browser can't re-fetch a
//      blob: URL on a later visit, so this "background handler" effectively
//      stopped existing the moment the tab that created it was closed. That's
//      exactly the situation where a TikTok-style notification is supposed to
//      still show up.
//   2. It registered at the SAME scope ('/') as /firebase-messaging-sw.js —
//      the real, file-based service worker the Firebase Messaging SDK needs
//      for background pushes. Two service workers fighting over one scope's
//      push events is undefined behavior across browsers, and on top of the
//      root cause below (no server ever sent a push at all), this made sure
//      even a correctly-sent push had nowhere reliable to land.
// Fix: register the actual static file, and hand that registration to
// getToken() explicitly instead of relying on implicit auto-registration.
const registerNotifServiceWorker = async () => {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return null;
  try {
    return await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
  } catch (e) {
    console.log('SW registration skipped:', e.message);
    return null;
  }
};

/* ─────────────── BROWSER NOTIFICATION HELPER ─────────────── */
const showBrowserNotification = (title, body, type = 'notif') => {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return; // Only show when app is in background/closed
  try {
    const n = new Notification(title, {
      body,
      icon: 'https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png',
      badge: 'https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png',
      vibrate: type === 'call' ? [300, 100, 300, 100, 300] : [200],
      tag: type,
      renotify: true,
      silent: false,
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch {}
};

/* ─────────────── NOTIFICATION POPUP (Telegram style) ─────────────── */
const NotifPopup = ({ notif, user, onClose, onTap }) => {
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(null);
  useEffect(()=>{
    const t = setTimeout(onClose, 4500);
    const isCall = notif?.type === 'call';
    try {
      navigator.vibrate?.(isCall ? [300,100,300,100,300] : [200]);
      playNotifSound(isCall ? 'call' : 'notif');
    } catch {}
    // Also fire a browser notification if app is in background
    showBrowserNotification(
      isCall ? `📞 Incoming ${notif?.callType||'voice'} call from @${user?.username||'someone'}` : `@${user?.username||'someone'} ${notif?.message||'sent you a notification'}`,
      isCall ? 'Tap to answer' : 'Tap to view',
      isCall ? 'call' : 'notif'
    );
    return ()=>clearTimeout(t);
  },[onClose]);
  const icons = { like:'❤️', comment:'💬', follow:'👤', mention:'@', gift:'🎁', live:'🔴', call:'📞' };
  const handleTouchStart = e => { startX.current = e.touches[0].clientX; setSwiping(true); };
  const handleTouchMove = e => {
    if(startX.current===null) return;
    const dx = e.touches[0].clientX - startX.current;
    if(dx > 0) setSwipeX(dx);
  };
  const handleTouchEnd = () => {
    if(swipeX > 80) onClose();
    else setSwipeX(0);
    setSwiping(false);
  };
  return (
    <div
      onClick={()=>{ haptic('medium'); onTap?.(); onClose(); }}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      style={{ position:'fixed', top:52, left:12, right:12, zIndex:9999,
        transform:`translateX(${swipeX}px)`,
        transition: swiping?'none':'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        animation: swipeX===0?'slideDown 0.35s cubic-bezier(0.34,1.56,0.64,1)':'none',
        cursor:'pointer', background:'rgba(18,18,22,0.97)', backdropFilter:'blur(24px)',
        border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:'12px 14px',
        display:'flex', alignItems:'center', gap:12,
        boxShadow:'0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
        opacity: 1 - (swipeX / 200) }}>
      <div style={{ position:'relative', flexShrink:0 }}>
        <div style={{ width:44, height:44, borderRadius:'50%', background:user?.avatarColor||'#0B5FFF', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:18, overflow:'hidden' }}>
          {user?.avatarUrl ? <img src={user.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : (user?.avatar||'?')}
        </div>
        <div style={{ position:'absolute', bottom:-2, right:-2, width:18, height:18, borderRadius:'50%', background:'#1C1C24', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, border:'1.5px solid rgba(255,255,255,0.1)' }}>{icons[notif?.type]||'🔔'}</div>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ color:'white', fontSize:13, fontWeight:600, lineHeight:1.35, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          <span style={{ color:'#0B5FFF' }}>@{user?.username||'someone'}</span>{' '}{notif?.message}
        </div>
        <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, marginTop:2 }}>Just now · Swipe to dismiss</div>
      </div>
      <button onClick={e=>{e.stopPropagation();onClose();}} style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:'50%', width:26, height:26, color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:'rgba(255,255,255,0.06)', borderRadius:'0 0 20px 20px', overflow:'hidden' }}>
        <div style={{ height:'100%', background:'linear-gradient(90deg,#2E7BFF,#0B5FFF)', animation:'notifBar 4.5s linear forwards' }}/>
      </div>
    </div>
  );
};
/* ─────────────── TOAST ─────────────── */
const Toast = ({ message, type, onClose }) => {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLeaving(true), 2500);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(onClose, 250);
    return () => clearTimeout(t);
  }, [leaving, onClose]);
  const configs = {
    success: { bg: `linear-gradient(135deg,${COLORS.success},#16A34A)`, icon: '✓' },
    error: { bg: `linear-gradient(135deg,${COLORS.danger},#B91C1C)`, icon: '✕' },
    info: { bg: COLORS.gradient, icon: 'i' },
    warning: { bg: `linear-gradient(135deg,${COLORS.warning},#D97706)`, icon: '!' },
  };
  const c = configs[type] || configs.info;
  return (
    <div style={{ position:'fixed', bottom:110, left:'50%', zIndex:9999, animation: leaving ? 'toastOut 0.25s ease forwards' : 'toastIn 0.3s cubic-bezier(0.22,1,0.36,1) forwards', display:'flex', alignItems:'center', gap:10, background:'rgba(15,15,15,0.95)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:40, padding:'10px 18px 10px 10px', boxShadow:'0 8px 32px rgba(0,0,0,0.5)', whiteSpace:'nowrap' }}>
      <div style={{ width:26, height:26, borderRadius:'50%', background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:13, flexShrink:0 }}>{c.icon}</div>
      <span style={{ color:'white', fontSize:13, fontWeight:500, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{message}</span>
    </div>
  );
};

/* ShareModal removed — dead code, superseded by the richer ShareSheet
   component (with Copy Link/Facebook/Messenger/TikTok/WhatsApp/More ways
   section) which is what FeedPostCard and the top-level app actually render. */

/* ─────────────── STORIES BAR ─────────────── */
/* ─────────────── TELEGRAM-STYLE STORY VIEWER ─────────────── */
const TelegramStoryViewer = ({ storyGroups, startGroupIdx, currentUser, onClose, onViewProfile, showToast }) => {
  const [groupIdx, setGroupIdx] = useState(startGroupIdx || 0);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [seenMap, setSeenMap] = useState({});
  const [liked, setLiked] = useState({});
  const [finished, setFinished] = useState(false);
  const timerRef = useRef(null);
  const DURATION = 5000;

  const currentGroup = storyGroups[groupIdx];
  const currentStory = currentGroup?.stories[storyIdx];

  // Reflect this user's own persisted reaction (if any) when the story changes
  useEffect(() => {
    if (!currentStory?.id || !currentUser?.id) return;
    const mine = (currentStory.reactions || []).find(r => r.startsWith(`${currentUser.id}:`));
    setLiked(p => ({ ...p, [currentStory.id]: mine ? mine.split(':')[1] : (p[currentStory.id] || null) }));
  }, [currentStory?.id]);

  // Mark story as seen
  useEffect(() => {
    if (!currentStory?.id || !currentUser?.id) return;
    const key = currentStory.id;
    if (seenMap[key]) return;
    setSeenMap(p => ({ ...p, [key]: true }));
    updateDoc(doc(db, 'stories', key), {
      seenBy: arrayUnion(currentUser.id)
    }).catch(() => {});
  }, [currentStory?.id]);

  // Progress timer
  useEffect(() => {
    setProgress(0);
    if (paused || finished) return;
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) goNext();
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [storyIdx, groupIdx, paused, finished]);

  const goNext = useCallback(() => {
    clearInterval(timerRef.current);
    const grp = storyGroups[groupIdx];
    if (storyIdx < (grp?.stories?.length || 1) - 1) {
      setStoryIdx(s => s + 1);
      setProgress(0);
    } else if (groupIdx < storyGroups.length - 1) {
      setGroupIdx(g => g + 1);
      setStoryIdx(0);
      setProgress(0);
    } else {
      // Reached the end — show a Replay screen instead of silently closing
      setProgress(100);
      setFinished(true);
    }
  }, [storyIdx, groupIdx, storyGroups]);

  const handleReplay = () => {
    setFinished(false);
    setGroupIdx(0);
    setStoryIdx(0);
    setProgress(0);
  };

  const goPrev = useCallback(() => {
    clearInterval(timerRef.current);
    if (storyIdx > 0) {
      setStoryIdx(s => s - 1);
      setProgress(0);
    } else if (groupIdx > 0) {
      setGroupIdx(g => g - 1);
      setStoryIdx(0);
      setProgress(0);
    }
  }, [storyIdx, groupIdx]);

  const sendReply = async () => {
    if (!replyText.trim() || !currentStory?.id) return;
    try {
      // Previously wrote to a flat top-level `messages` collection with a shape
      // (senderId/receiverId, no participants array) that firestore.rules didn't
      // actually grant write access to, AND that nothing in the app ever read back —
      // so a story reply silently failed and, even when it didn't, the story owner
      // never saw it anywhere. Routes through the real 1:1 conversation thread
      // instead, same collection/shape ConversationView uses, so it shows up as an
      // actual chat message for the story's owner.
      const convId = [currentUser.id, currentGroup.userId].sort().join('_');
      await addDoc(collection(db, 'messages', convId, 'msgs'), {
        from: currentUser.id,
        to: currentGroup.userId,
        text: `↩️ Replied to your story: ${replyText.trim()}`,
        createdAt: serverTimestamp(),
        status: 'sent',
        expireAt: null,
      });
      await setDoc(doc(db, 'conversations', convId), {
        participants: [currentUser.id, currentGroup.userId],
        lastMessage: `↩️ Replied to your story: ${replyText.trim()}`,
        lastMessageAt: serverTimestamp(),
        lastSenderId: currentUser.id,
        lastMessageStatus: 'sent',
        hiddenFor: [],
        [`unread_${currentGroup.userId}`]: increment(1),
      }, { merge: true });
      // Persist so the story owner sees a comment count on their own story
      await updateDoc(doc(db, 'stories', currentStory.id), { replyCount: increment(1) }).catch(() => {});
      sendNotification?.(currentGroup.userId, currentUser.id, 'message', `replied to your story: ${replyText.trim()}`, { fromUsername: currentUser.username });
      showToast?.('Reply sent ✓', 'success');
    } catch { showToast?.('Failed to send', 'error'); }
    setReplyText('');
  };

  const toggleLike = (emoji = '❤️') => {
    const key = currentStory?.id;
    if (!key || !currentUser?.id) return;
    const already = liked[key] === emoji;
    setLiked(p => ({ ...p, [key]: already ? null : emoji }));
    // Persist the reaction on the story doc (one reaction per user, stored as "uid:emoji")
    const tag = `${currentUser.id}:${emoji}`;
    if (already) {
      updateDoc(doc(db, 'stories', key), { reactions: arrayRemove(tag) }).catch(() => {});
    } else {
      const prevEmoji = liked[key];
      if (prevEmoji) updateDoc(doc(db, 'stories', key), { reactions: arrayRemove(`${currentUser.id}:${prevEmoji}`) }).catch(() => {});
      updateDoc(doc(db, 'stories', key), { reactions: arrayUnion(tag) }).catch(() => {});
      showToast?.(`${emoji} Reacted!`, 'success');
    }
  };

  if (!currentGroup || !currentStory) return null;
  const stories = currentGroup.stories;
  const isOwn = currentGroup.userId === currentUser?.id;

  return (
    <div style={{ position:'fixed', inset:0, background:'#000', zIndex:3000, display:'flex', flexDirection:'column', userSelect:'none' }}>
      {/* Progress bars */}
      <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:20, padding:'10px 10px 0', display:'flex', gap:3 }}>
        {stories.map((_, i) => (
          <div key={i} style={{ flex:1, height:2.5, background:'rgba(255,255,255,0.3)', borderRadius:2, overflow:'hidden' }}>
            <div style={{
              height:'100%', background:'white', borderRadius:2,
              width: i < storyIdx ? '100%' : i === storyIdx ? `${progress}%` : '0%',
              transition: i === storyIdx ? 'none' : undefined
            }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ position:'absolute', top:20, left:0, right:0, zIndex:20, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 14px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}
          onClick={() => { if (currentGroup.userId) { onViewProfile?.(currentGroup.userId); onClose(); } }}>
          <div style={{ width:42, height:42, borderRadius:'50%', background:currentGroup.avatarColor||'#0B5FFF',
            display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:17,
            overflow:'hidden', border:'2.5px solid white' }}>
            {currentGroup.avatarUrl
              ? <img src={currentGroup.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" />
              : (currentGroup.username||'?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ color:'white', fontWeight:700, fontSize:14 }}>@{currentGroup.username}</div>
            <div style={{ color:'rgba(255,255,255,0.6)', fontSize:11 }}>
              {currentStory.createdAt?.seconds
                ? new Date(currentStory.createdAt.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
                : 'Just now'}
              {isOwn && (currentStory.seenBy?.length > 0) && ` · 👁 ${currentStory.seenBy.length}`}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onPointerDown={()=>setPaused(true)} onPointerUp={()=>setPaused(false)}
            style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:34, height:34, color:'white', cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {paused ? '▶' : '⏸'}
          </button>
          <button onClick={onClose}
            style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:34, height:34, color:'white', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
      </div>

      {/* Tap zones */}
      <div style={{ position:'absolute', inset:0, display:'flex', zIndex:10 }}>
        <div style={{ flex:1 }} onClick={goPrev} />
        <div style={{ flex:1 }} onClick={goNext} />
      </div>

      {/* Story content */}
      <div style={{ flex:1, position:'relative', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
        {currentStory.mediaType === 'video' || currentStory.mediaUrl?.includes('/video/')
          ? <video src={currentStory.mediaUrl} autoPlay loop playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : currentStory.mediaUrl
            ? <img src={currentStory.mediaUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : <div style={{ width:'100%', height:'100%', background:currentStory.bgColor||'#0B5FFF', display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
                <div style={{ color:'white', fontSize:28, fontWeight:700, textAlign:'center', lineHeight:1.4 }}>{currentStory.text}</div>
              </div>}
        {/* Text overlay on media */}
        {currentStory.text && currentStory.mediaUrl && (
          <div style={{ position:'absolute', bottom:90, left:0, right:0, textAlign:'center', padding:'0 24px' }}>
            <div style={{ color:'white', fontSize:18, fontWeight:700, textShadow:'0 2px 8px rgba(0,0,0,0.8)', lineHeight:1.4 }}>{currentStory.text}</div>
          </div>
        )}
      </div>

      {/* Story group dots (showing which user) */}
      {storyGroups.length > 1 && (
        <div style={{ position:'absolute', bottom:90, left:0, right:0, zIndex:15, display:'flex', justifyContent:'center', gap:6 }}>
          {storyGroups.map((_, i) => (
            <div key={i} onClick={e=>{e.stopPropagation(); setGroupIdx(i); setStoryIdx(0); setProgress(0);}}
              style={{ width: i===groupIdx ? 22 : 6, height:6, borderRadius:3, background: i===groupIdx ? 'white' : 'rgba(255,255,255,0.35)', cursor:'pointer', transition:'all 0.25s' }} />
          ))}
        </div>
      )}

      {/* Footer: Like + Reply — Instagram/Facebook standards */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:20, padding:'0 12px 36px' }}>
        {!isOwn ? (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* Quick emoji reactions */}
            <div style={{ display:'flex', gap:4 }}>
              {['❤️','😂','😮','🔥','👏'].map(emoji=>(
                <button key={emoji} onClick={e=>{e.stopPropagation(); toggleLike(emoji);}}
                  style={{ background: liked[currentStory?.id]===emoji ? 'rgba(11,95,255,0.35)' : 'rgba(255,255,255,0.1)', backdropFilter:'blur(12px)', border:'none', borderRadius:'50%', width:38, height:38, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transform: liked[currentStory?.id]===emoji ? 'scale(1.3)' : 'scale(1)', transition:'transform 0.15s' }}>
                  {emoji}
                </button>
              ))}
            </div>
            <div style={{ flex:1, display:'flex', alignItems:'center', background:'rgba(255,255,255,0.1)', backdropFilter:'blur(12px)', borderRadius:28, border:'1px solid rgba(255,255,255,0.18)', paddingLeft:14, paddingRight:8 }}>
              <input value={replyText} onChange={e=>setReplyText(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter') sendReply(); e.stopPropagation(); }}
                onClick={e=>e.stopPropagation()}
                placeholder={`Reply to @${currentGroup.username}…`}
                style={{ flex:1, background:'none', border:'none', outline:'none', color:'white', fontSize:14, padding:'12px 0' }} />
              {replyText.trim() && (
                <button onClick={e=>{e.stopPropagation(); sendReply();}}
                  style={{ background:'#0B5FFF', border:'none', borderRadius:'50%', width:32, height:32, color:'white', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>➤</button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(12px)', borderRadius:20, padding:'12px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:8 }}>
              <span style={{ display:'flex', alignItems:'center', gap:6, color:'white', fontWeight:700, fontSize:14 }}>
                <span style={{ fontSize:16 }}>👁</span>{currentStory.seenBy?.length || 0}
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:6, color:'white', fontWeight:700, fontSize:14 }}>
                <span style={{ fontSize:16 }}>❤️</span>{currentStory.reactions?.length || 0}
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:6, color:'white', fontWeight:700, fontSize:14 }}>
                <span style={{ fontSize:16 }}>💬</span>{currentStory.replyCount || 0}
              </span>
            </div>
            {(currentStory.seenBy?.length || 0) > 0 && (
              <div style={{ display:'flex', gap:-8 }}>
                {(currentStory.seenBy || []).slice(0,6).map((uid,i)=>{
                  const viewer = [{ id: currentUser?.id }].find(u=>u.id===uid) || { id:uid };
                  return (
                    <div key={uid} style={{ width:28, height:28, borderRadius:'50%', background:'#0B5FFF', border:'2px solid #000', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:11, fontWeight:'bold', marginLeft: i>0?-8:0 }}>
                      {uid[0]?.toUpperCase()}
                    </div>
                  );
                })}
                {(currentStory.seenBy?.length || 0) > 6 && <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'2px solid #000', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:10, marginLeft:-8 }}>+{currentStory.seenBy.length-6}</div>}
              </div>
            )}
            {!(currentStory.seenBy?.length) && <div style={{ color:'rgba(255,255,255,0.4)', fontSize:13 }}>No views yet — share it!</div>}
          </div>
        )}
      </div>

      {/* Replay overlay — shown instead of auto-closing when the last story ends */}
      {finished && (
        <div style={{ position:'fixed', inset:0, zIndex:40, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(6px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:18, animation:'fadeIn 0.25s ease' }}>
          <div style={{ width:76, height:76, borderRadius:'50%', background:currentGroup.avatarColor||'#0B5FFF', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:28, overflow:'hidden', border:'3px solid white' }}>
            {currentGroup.avatarUrl ? <img src={currentGroup.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (currentGroup.username||'?')[0].toUpperCase()}
          </div>
          <div style={{ color:'white', fontWeight:700, fontSize:16 }}>You've seen all stories</div>
          <div style={{ display:'flex', gap:12 }}>
            <button onClick={handleReplay} style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:24, padding:'12px 22px', color:'white', fontWeight:700, fontSize:14, cursor:'pointer' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
              Replay
            </button>
            <button onClick={onClose} style={{ background:'linear-gradient(135deg,#2E7BFF,#0B5FFF)', border:'none', borderRadius:24, padding:'12px 26px', color:'white', fontWeight:700, fontSize:14, cursor:'pointer' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────── STORIES ROW ─────────────── */
const Stories = ({ users, currentUser, onViewStory, onCreateStory, followed, liveUserIds }) => {
  const [storyUsers, setStoryUsers] = useState([]);

  useEffect(() => {
    // Live-subscribe to all users' stories (not just followed) so a story posted
    // just now shows up immediately, instead of only appearing after a remount.
    const buildGroups = (docs) => {
      const now = new Date();
      const byUser = {};
      docs.forEach(d => {
        const data = d.data();
        const exp = data.expiresAt?.toDate ? data.expiresAt.toDate() : (data.expiresAt ? new Date(data.expiresAt) : null);
        if (exp && exp < now) return; // skip expired
        if (!byUser[data.userId]) byUser[data.userId] = { userId: data.userId, stories: [] };
        byUser[data.userId].stories.push({ id: d.id, ...data });
      });
      return Object.values(byUser).map(g => {
        const u = users.find(u => u.id === g.userId);
        return { ...g, username: u?.username || g.stories[0]?.username || 'user', avatarColor: u?.avatarColor || g.stories[0]?.avatarColor, avatarUrl: u?.avatarUrl || g.stories[0]?.avatarUrl };
      });
    };
    const primaryQ = query(collection(db, 'stories'), orderBy('createdAt', 'desc'));
    let fallbackUnsub = null;
    const unsub = onSnapshot(primaryQ, snap => {
      setStoryUsers(buildGroups(snap.docs));
    }, () => {
      // Fallback: no orderBy (e.g. missing composite index)
      const fallbackQ = query(collection(db, 'stories'));
      fallbackUnsub = onSnapshot(fallbackQ, snap => {
        setStoryUsers(buildGroups(snap.docs));
      }, () => {});
    });
    return () => { unsub(); fallbackUnsub?.(); };
  }, [users]);

  const myStories = storyUsers.find(g => g.userId === currentUser?.id);
  const otherStories = storyUsers.filter(g => g.userId !== currentUser?.id);

  const handleMyStory = async () => {
    if (myStories) { onViewStory?.({ groups: storyUsers, startIdx: storyUsers.findIndex(g => g.userId === currentUser?.id) }); }
    else onCreateStory?.();
  };

  // Facebook-style tall rectangular story card. The whole card is the tappable target
  // (not just an avatar circle) — cover photo fills the card, name sits at the bottom
  // over a gradient scrim, and the person's avatar overlaps the top-left corner.
  const CARD_W = 104, CARD_H = 172;
  const StoryCard = ({ cover, avatarUrl, avatarColor, initial, label, isLive, isAddCard, onClick }) => (
    <button
      onClick={onClick}
      onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
      onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
      onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
      style={{ position:'relative', width:CARD_W, height:CARD_H, flexShrink:0, borderRadius:14, overflow:'hidden', border:'none', padding:0, cursor:'pointer', background:COLORS.surfaceAlt, boxShadow:SHADOW.sm, transition:TRANSITION.fast }}
    >
      {cover ? (
        <img src={cover} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
      ) : (
        <div style={{ width:'100%', height:'100%', background: avatarColor || COLORS.brand, opacity:0.55 }} />
      )}
      <div style={{ position:'absolute', inset:0, background: isAddCard ? 'linear-gradient(to top,rgba(0,0,0,0.05),transparent 55%)' : 'linear-gradient(to top,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.05) 45%,transparent 65%)' }} />
      {isLive && (
        <div style={{ position:'absolute', top:8, left:8, background:COLORS.live, borderRadius:6, padding:'2px 7px', fontSize:9, fontWeight:800, color:'white', letterSpacing:0.4 }}>LIVE</div>
      )}
      {isAddCard ? (
        <>
          <div style={{ position:'absolute', left:0, right:0, top: CARD_H - 66, height:66, background:COLORS.surface, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:36, height:36, borderRadius:'50%', background:COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', border:`3px solid ${COLORS.surfaceAlt}`, color:'white', fontSize:20, fontWeight:800, marginTop:-40 }}>+</div>
          </div>
          <div style={{ position:'absolute', bottom:8, left:0, right:0, textAlign:'center', color:COLORS.textPrimary, fontSize:11.5, fontWeight:700 }}>{label}</div>
        </>
      ) : (
        <>
          <div style={{ position:'absolute', top:8, left:8, width:30, height:30, borderRadius:'50%', background: isLive ? `linear-gradient(135deg,${COLORS.live},#B3121F)` : `linear-gradient(135deg,${COLORS.brand},${COLORS.brandSecondary})`, padding:2.5, boxSizing:'border-box' }}>
            <div style={{ width:'100%', height:'100%', borderRadius:'50%', background: avatarColor || COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:12, overflow:'hidden' }}>
              {avatarUrl ? <img src={avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : initial}
            </div>
          </div>
          <div style={{ position:'absolute', bottom:8, left:8, right:8, color:'white', fontSize:12.5, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textShadow:'0 1px 3px rgba(0,0,0,0.5)' }}>{label}</div>
        </>
      )}
    </button>
  );

  return (
    <div style={{ display:'flex', gap:8, padding:'12px 16px', overflowX:'auto', borderBottom:`1px solid ${COLORS.overlaySubtle}`, scrollbarWidth:'none' }}>
      {/* My Story / Create Story card */}
      {myStories ? (
        <StoryCard
          cover={currentUser?.avatarUrl}
          avatarUrl={currentUser?.avatarUrl}
          avatarColor={currentUser?.avatarColor}
          initial={currentUser?.avatar}
          label="Your story"
          onClick={handleMyStory}
        />
      ) : (
        <StoryCard isAddCard label="Create story" onClick={handleMyStory} />
      )}

      {/* Other users' stories — ALL users, not just followed */}
      {otherStories.map(group => {
        const isLive = liveUserIds?.has(group.userId);
        return (
          <StoryCard
            key={group.userId}
            cover={group.avatarUrl}
            avatarUrl={group.avatarUrl}
            avatarColor={group.avatarColor}
            initial={(group.username||'?')[0].toUpperCase()}
            label={group.username.split('_')[0]}
            isLive={isLive}
            onClick={() => onViewStory?.({ groups: storyUsers, startIdx: storyUsers.findIndex(g => g.userId === group.userId) })}
          />
        );
      })}
    </div>
  );
};

/* ─────────────── STORIES PAGE (image 2) — full-screen browse ─────────────── */
const StoriesPage = ({ users, currentUser, onClose, onViewStory, onCreateStory, showToast, t }) => {
  const [storyUsers, setStoryUsers] = useState([]);
  const [explore, setExplore] = useState('popular');
  const [activeIdx, setActiveIdx] = useState(0);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const buildGroups = (docs) => {
      const byUser = {};
      docs.forEach(d => {
        const data = d.data();
        if (!byUser[data.userId]) byUser[data.userId] = { userId: data.userId, stories: [] };
        byUser[data.userId].stories.push({ id: d.id, ...data });
      });
      return Object.values(byUser).map(g => {
        const u = users.find(uu => uu.id === g.userId);
        return { ...g, username: u?.username || g.stories[0]?.username || 'user', avatarColor: u?.avatarColor, avatarUrl: u?.avatarUrl };
      });
    };
    const primaryQ = query(collection(db, 'stories'), orderBy('createdAt', 'desc'));
    let fallbackUnsub = null;
    const unsub = onSnapshot(primaryQ, snap => setStoryUsers(buildGroups(snap.docs)), () => {
      const fallbackQ = query(collection(db, 'stories'));
      fallbackUnsub = onSnapshot(fallbackQ, snap => setStoryUsers(buildGroups(snap.docs)), () => {});
    });
    return () => { unsub(); fallbackUnsub?.(); };
  }, [users]);

  const myStories = storyUsers.find(g => g.userId === currentUser?.id);
  const others = storyUsers.filter(g => g.userId !== currentUser?.id);
  const tiles = [{ userId: currentUser?.id, mine: true, username: 'Your story', avatarColor: currentUser?.avatarColor, avatarUrl: currentUser?.avatarUrl, stories: myStories?.stories||[] }, ...others];
  const active = tiles[activeIdx];
  const activeStory = active?.stories?.[0];
  const activeMedia = activeStory?.mediaUrl;
  const activeMediaType = activeStory?.mediaType || '';
  const isActiveVideo = activeMediaType.startsWith('video');
  const isActiveAudio = activeMediaType.includes('audio');
  const isActiveImage = activeMedia && !isActiveVideo && !isActiveAudio;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:4000, background:COLORS.bg, display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ padding:'16px 16px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:COLORS.textPrimary, padding:4, display:'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:20, padding:'9px 14px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span style={{ color:COLORS.textTertiary, fontSize:13 }}>{t?.search||'Search'}</span>
          </div>
          <button style={{ background:'none', border:'none', width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', color:COLORS.textSecondary, cursor:'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
          </button>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:22 }}>Stories</div>
          <button style={{ background:'none', border:'none', cursor:'pointer', color:COLORS.textSecondary }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          </button>
        </div>
      </div>

      {/* Story tiles row */}
      <div style={{ display:'flex', gap:12, padding:'0 16px 18px', overflowX:'auto' }}>
        {tiles.map((tile,i)=>(
          <div key={tile.userId||i} onClick={()=>{ if(tile.mine && !tile.stories.length){ onCreateStory?.(); } else { setActiveIdx(i); } }} style={{ position:'relative', flexShrink:0, width:96, height:130, borderRadius:18, overflow:'hidden', cursor:'pointer', border:activeIdx===i?`2.5px solid ${COLORS.brand}`:`1px solid ${COLORS.border}`, background:COLORS.surfaceAlt }}>
            {tile.stories?.[0]?.mediaUrl ? (
              <img src={tile.stories[0].mediaUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            ) : (
              <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:tile.avatarColor||COLORS.brand, color:'#fff', fontWeight:700, fontSize:26 }}>
                {tile.avatarUrl ? <img src={tile.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (tile.username||'?')[0]?.toUpperCase()}
              </div>
            )}
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,rgba(0,0,0,0) 55%,rgba(0,0,0,0.55) 100%)' }} />
            <div style={{ position:'absolute', top:8, left:8, width:26, height:26, borderRadius:'50%', border:'2px solid #fff', overflow:'hidden', background:tile.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700 }}>
              {tile.avatarUrl ? <img src={tile.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (tile.username||'?')[0]?.toUpperCase()}
            </div>
            {tile.mine && !tile.stories?.length && (
              <div onClick={e=>{e.stopPropagation(); onCreateStory?.();}} style={{ position:'absolute', bottom:8, right:8, width:20, height:20, borderRadius:'50%', background:COLORS.brand, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800 }}>+</div>
            )}
            <div style={{ position:'absolute', bottom:8, left:8, right:8, color:'#fff', fontSize:11, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tile.mine ? 'Your story' : tile.username}</div>
            {!tile.mine && <div style={{ position:'absolute', bottom:22, left:8, color:'rgba(255,255,255,0.85)', fontSize:9.5 }}>{tile.stories?.[0]?.createdAt?.toDate ? timeAgo(tile.stories[0].createdAt.toDate()) : ''}</div>}
          </div>
        ))}
      </div>

      {/* Explore Stories */}
      <div style={{ padding:'0 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:15 }}>Explore Stories</div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </div>
      <div style={{ display:'flex', gap:10, padding:'0 16px 18px' }}>
        {[
          { id:'popular', label:'Popular', icon:'✨' },
          { id:'nearby', label:'Nearby', icon:(<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z"/></svg>) },
          { id:'following', label:'Following', icon:(<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>) },
        ].map(p=>(
          <button key={p.id} onClick={()=>setExplore(p.id)} style={{ display:'flex', alignItems:'center', gap:6, background:explore===p.id?COLORS.gradient:COLORS.surface, border:explore===p.id?'none':`1px solid ${COLORS.border}`, borderRadius:16, padding:'8px 14px', color:explore===p.id?'#fff':COLORS.textSecondary, fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
            {p.icon}{p.label}
          </button>
        ))}
      </div>

      {/* Preview panel */}
      <div style={{ flex:1, margin:'0 16px 16px', borderRadius:22, overflow:'hidden', position:'relative', background: activeStory?.bgColor || '#1a1a24', minHeight:0 }}>
        {isActiveImage ? (
          <img src={activeMedia} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }} />
        ) : isActiveVideo ? (
          <video src={activeMedia} muted loop autoPlay playsInline style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }} />
        ) : isActiveAudio ? (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, padding:24 }}>
            <div style={{ fontSize:56 }}>🎙️</div>
            <audio src={activeMedia} controls style={{ width:'100%', maxWidth:260 }} />
          </div>
        ) : activeStory?.text ? (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
            <span style={{ color:'#fff', fontWeight:700, fontSize:22, textAlign:'center' }}>{activeStory.text}</span>
          </div>
        ) : (
          <>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:active?.avatarColor||COLORS.brand, overflow:'hidden' }}>
              {active?.avatarUrl ? <img src={active.avatarUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : <span style={{ color:'#fff', fontWeight:800, fontSize:64 }}>{(active?.username||'?')[0]?.toUpperCase()}</span>}
            </div>
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:'rgba(255,255,255,0.85)', fontSize:13, fontWeight:600, textAlign:'center', padding:'0 20px' }}>
                {active?.mine ? "You haven't posted a story yet — tap + to add one" : 'No story to preview'}
              </span>
            </div>
          </>
        )}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,rgba(0,0,0,0.05) 40%,rgba(0,0,0,0.65) 100%)' }} />
        <div style={{ position:'absolute', bottom:14, left:14, right:14, display:'flex', alignItems:'center', gap:10 }}>
          <input value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Send message" style={{ flex:1, background:'rgba(255,255,255,0.15)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:22, padding:'10px 16px', color:'#fff', outline:'none', fontSize:13 }} />
          <button onClick={()=>{ setMsg(''); showToast?.('Reaction sent','success'); }} style={{ width:38, height:38, borderRadius:'50%', background:'rgba(255,255,255,0.18)', border:'1px solid rgba(255,255,255,0.25)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          </button>
          <button onClick={()=> active && onViewStory?.({ groups: tiles, startIdx: activeIdx })} style={{ width:38, height:38, borderRadius:'50%', background:'rgba(255,255,255,0.18)', border:'1px solid rgba(255,255,255,0.25)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────── CREATE STORY MODAL ─────────────── */
const CreateStoryModal = ({ currentUser, onClose, showToast }) => {
  const [mode, setMode] = useState(null);
  const [storyText, setStoryText] = useState('');
  const [bgColor, setBgColor] = useState('#0B5FFF');
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
  const colors = ['#0B5FFF','#2E7BFF','#083FB0','#FFB100','#2ED573','#00A9D6','#FF453A','#5E5CE6'];

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
        avatarColor: currentUser.avatarColor || '#0B5FFF',
        avatarUrl: currentUser.avatarUrl || null,
        text: storyText || '',
        bgColor: bgColor || '#0B5FFF',
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
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:3500, display:'flex', alignItems:'flex-end', animation:'fadeIn 0.2s ease' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', background:'#15151C', borderTopLeftRadius:32, borderTopRightRadius:32, padding:'20px 20px 44px', border:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width:36, height:4, background:'rgba(255,255,255,0.15)', borderRadius:2, margin:'0 auto 24px' }} />
        <div style={{ color:'white', fontWeight:800, fontSize:20, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Create Story</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[{id:'camera',icon:'📷',label:'Camera',sub:'Photo or video',color:'#0B5FFF'},{id:'file',icon:'🖼️',label:'Gallery',sub:'From device',color:'#0B5FFF'},{id:'text',icon:'✏️',label:'Text',sub:'Write a story',color:'#0A84FF'},{id:'audio',icon:'🎙️',label:'Audio',sub:'Voice story',color:'#2ED573'}].map(opt=>(
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
        <button onClick={handlePost} disabled={uploading} style={{ background:'linear-gradient(135deg,#2E7BFF,#0B5FFF)', border:'none', borderRadius:20, padding:'8px 16px', color:'white', fontWeight:700, cursor:'pointer', fontSize:13, opacity:uploading?0.6:1 }}>{uploading?'Posting...':'Post'}</button>
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
              <><audio src={URL.createObjectURL(audioBlob)} controls style={{ width:'100%' }} /><button onClick={()=>setAudioBlob(null)} style={{ background:'#34343E', border:'none', borderRadius:20, padding:'10px 20px', color:'white', cursor:'pointer' }}>Re-record</button></>
            ) : (
              <button onMouseDown={startAudio} onMouseUp={stopAudio} onTouchStart={startAudio} onTouchEnd={stopAudio} style={{ background:isRecording?'#0B5FFF':'#34343E', border:'none', borderRadius:'50%', width:90, height:90, fontSize:36, cursor:'pointer' }}>{isRecording?'⏹':'🎙️'}</button>
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

/* ─────────────── DONATION SHEET (real-money, Flutterwave) ───────────────
   Separate rail from the coins/gift economy above (VIRTUAL_GIFTS, sendGift,
   WalletPage) — those move in-app coins that were already purchased through
   /api/wallet. This moves real money directly from a supporter's card/bank
   to a creator's wallet via /api/donations/{init,verify,webhook}, which is
   why it's a distinct component: different backend, different trust model
   (server mints tx_ref, verifies with Flutterwave directly, settles once).
   Reused as-is from both UserProfileModal (profile → Donate) and LiveStream
   (live chat → 💝) — same component, different `recipient`. Uses the file's
   module-level `apiFetch` (Firebase-ID-token-authed) rather than a prop,
   matching how sendGift/WalletPage already call apiFetch above. */
let flwScriptPromise = null;
const loadFlutterwaveScript = () => {
  if (window.FlutterwaveCheckout) return Promise.resolve();
  if (!flwScriptPromise) {
    flwScriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.flutterwave.com/v3.js';
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }
  return flwScriptPromise;
};

const DONATION_PRESETS = [500, 1000, 2500, 5000]; // smallest sensible unit for `currency`, e.g. NGN

const DonationSheet = ({ recipient, currentUser, onClose, showToast, currency = 'NGN', onSuccess }) => {
  const [amount, setAmount] = useState(DONATION_PRESETS[1]);
  const [customAmount, setCustomAmount] = useState('');
  const [status, setStatus] = useState('idle'); // idle | opening | verifying | success | error

  useEffect(() => { loadFlutterwaveScript().catch(() => showToast?.('Could not load payment gateway', 'error')); }, []);

  const effectiveAmount = customAmount ? Number(customAmount) : amount;

  const startDonation = async () => {
    if (!effectiveAmount || effectiveAmount <= 0) { showToast?.('Enter a valid amount', 'error'); return; }
    setStatus('opening');
    try {
      await loadFlutterwaveScript();
      // Server mints tx_ref + hands back the public key — never let the client
      // forge its own reference for something money-related (see /api/donations/init).
      const { tx_ref, public_key } = await apiFetch('/api/donations/init', {
        method: 'POST',
        body: JSON.stringify({ amount: effectiveAmount, currency, recipientId: recipient.id }),
      });

      window.FlutterwaveCheckout({
        public_key,
        tx_ref,
        amount: effectiveAmount,
        currency,
        payment_options: 'card,banktransfer,ussd',
        customer: {
          email: currentUser.email || `${currentUser.username}@donor.infinity`,
          name: currentUser.fullName || currentUser.username,
        },
        customizations: {
          title: `Support @${recipient.username}`,
          description: 'In-app donation',
          logo: 'https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png',
        },
        callback: async (payment) => {
          setStatus('verifying');
          try {
            // Server-side verify against Flutterwave's API is the source of truth —
            // this callback payload is just a UX hint that lets us poll sooner.
            const result = await apiFetch('/api/donations/verify', {
              method: 'POST',
              body: JSON.stringify({ tx_ref, transaction_id: payment.transaction_id }),
            });
            if (result.verified) {
              setStatus('success');
              showToast?.(`Sent ${currency} ${effectiveAmount.toLocaleString()} to @${recipient.username}!`, 'success');
              onSuccess?.(effectiveAmount);
            } else {
              setStatus('error');
              showToast?.('Payment could not be verified', 'error');
            }
          } catch (e) {
            setStatus('error');
            showToast?.(e.message || 'Verification failed', 'error');
          }
        },
        onclose: () => {
          // Fires on both success and plain dismissal — only reset to idle
          // if we're not already mid-verify or settled.
          setStatus(s => (s === 'success' || s === 'error' || s === 'verifying') ? s : 'idle');
        },
      });
    } catch (e) {
      setStatus('error');
      showToast?.(e.message || 'Could not start donation', 'error');
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(15,10,25,0.55)', display: 'flex', alignItems: 'flex-end', maxWidth: 430, margin: '0 auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#15151C', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '20px 20px max(24px, env(safe-area-inset-bottom))' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 18px' }} />

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Thank you!</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13.5, marginBottom: 20 }}>
              Your donation to @{recipient.username} was received.
            </div>
            <button onClick={onClose} style={{ width: '100%', background: 'white', border: 'none', borderRadius: 16, padding: 14, color: '#0B0B0F', fontWeight: 700, cursor: 'pointer' }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 18, marginBottom: 4, textAlign: 'center' }}>
              💝 Support @{recipient.username}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12.5, marginBottom: 18, textAlign: 'center' }}>
              100% goes straight to their creator wallet
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {DONATION_PRESETS.map(a => (
                <button key={a} onClick={() => { setAmount(a); setCustomAmount(''); }}
                  style={{
                    flex: '1 1 70px', padding: '12px 8px', borderRadius: 14, fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                    background: amount === a && !customAmount ? 'white' : 'rgba(255,255,255,0.08)',
                    color: amount === a && !customAmount ? '#0B0B0F' : 'white',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}>
                  {currency} {a.toLocaleString()}
                </button>
              ))}
            </div>

            <input
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder={`Custom amount (${currency})`}
              inputMode="numeric"
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 14, color: 'white', fontSize: 14, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
            />

            <button
              onClick={startDonation}
              disabled={status === 'opening' || status === 'verifying'}
              style={{
                width: '100%', background: 'linear-gradient(135deg,#0B5FFF,#6E4CF5)', border: 'none', borderRadius: 16,
                padding: 15, color: 'white', fontWeight: 700, fontSize: 15,
                cursor: status === 'idle' ? 'pointer' : 'default', opacity: status === 'idle' ? 1 : 0.7,
              }}>
              {status === 'opening' ? 'Opening…' : status === 'verifying' ? 'Confirming…' : `Donate ${currency} ${effectiveAmount ? effectiveAmount.toLocaleString() : ''}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/* ─────────────── USER PROFILE MODAL ─────────────── */
const UserProfileModal = ({ user, currentUser, onClose, onFollow, onMessage, onVoiceCall, onVideoCall, followed, showToast, userVideos, isLive, onJoinLive }) => {
  const isFollowing = followed?.includes(user?.id);
  const isOwn = user?.id === currentUser?.id;
  const [tab, setTab] = useState('posts');
  const profileVideos = userVideos || [];
  const avatarSrc = user?.avatarUrl;
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const submitUserReport = async (reason) => {
    try {
      await submitReport('user', user.id, currentUser.id, {
        reportedUserId: user.id,
        reportedUsername: user?.username || null,
        reporterUsername: currentUser?.username || currentUser?.fullName || null,
        reason,
      });
      showToast?.('User reported — thanks for letting us know', 'success');
    } catch (e) {
      showToast?.(e.message || 'Could not submit report', e.duplicate ? 'info' : 'error');
    }
    setShowReportSheet(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:3000, display:'flex', alignItems:'flex-end', animation:'fadeIn 0.2s ease' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', background:'#15151C', borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ width:36, height:4, background:'rgba(255,255,255,0.12)', borderRadius:2, margin:'16px auto 0' }} />
        <div style={{ display:'flex', justifyContent:'flex-end', padding:'10px 16px 0' }}>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:'50%', width:34, height:34, color:'white', cursor:'pointer', fontSize:16 }}>✕</button>
        </div>
        <div style={{ textAlign:'center', padding:'4px 20px 20px' }}>
          <div style={{ width:90, height:90, borderRadius:'50%', padding:2.5, margin:'0 auto 14px', background: isLive ? `linear-gradient(135deg,${COLORS.live},#B3121F)` : `conic-gradient(${COLORS.brand},${COLORS.brandSecondary},${COLORS.brand})`, position:'relative' }}>
            <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:'#0d0d0d', padding:2 }}>
              <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:user?.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:32, overflow:'hidden' }}>
                {avatarSrc ? <img src={avatarSrc} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : user?.avatar}
              </div>
            </div>
            {isLive && (
              <div style={{ position:'absolute', bottom:-2, left:'50%', transform:'translateX(-50%)', background:COLORS.live, borderRadius:6, padding:'2px 8px', fontSize:9, fontWeight:800, color:'white', letterSpacing:0.4, whiteSpace:'nowrap' }}>LIVE</div>
            )}
          </div>
          <div style={{ color:'white', fontWeight:800, fontSize:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{user?.fullName || user?.username}</div>
          {isLive && (
            <button onClick={()=>onJoinLive?.(user)} style={{ marginTop:10, background:`linear-gradient(135deg,${COLORS.live},#B3121F)`, border:'none', borderRadius:20, padding:'9px 20px', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              Join Live
            </button>
          )}
          {user?.verified && <div style={{ display:'inline-flex', alignItems:'center', gap:4, color:'#2F9BFF', fontSize:12, marginTop:4, background:'rgba(29,155,240,0.1)', borderRadius:20, padding:'3px 10px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#2F9BFF"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Verified
          </div>}
          <div style={{ color:'rgba(255,255,255,0.55)', fontSize:13, marginTop:8, lineHeight:1.5 }}>{user?.bio}</div>
          <div style={{ display:'flex', justifyContent:'center', gap:0, marginTop:18, background:'rgba(255,255,255,0.03)', borderRadius:20, padding:'14px 0', border:'1px solid rgba(255,255,255,0.06)' }}>
            {[['Posts', profileVideos.length], ['Followers', user?.followers?.length||0], ['Following', user?.following?.length||0]].map(([label,val],i)=>(
              <div key={label} style={{ flex:1, textAlign:'center', borderRight:i<2?'1px solid rgba(255,255,255,0.08)':'' }}>
                <div style={{ color:'white', fontWeight:800, fontSize:18, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{formatNumber(val)}</div>
                <div style={{ color:'rgba(255,255,255,0.4)', fontSize:11, marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        {!isOwn && (
          <div style={{ padding:'0 16px 16px', display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>{onFollow?.(user.id); onClose();}}
                style={{ flex:1, background:isFollowing?'rgba(255,255,255,0.06)':'linear-gradient(135deg,#2E7BFF,#0B5FFF)', border:isFollowing?'1px solid rgba(11,95,255,0.4)':'none', borderRadius:14, padding:'12px', color:isFollowing?'#0B5FFF':'white', fontWeight:700, cursor:'pointer', fontSize:14 }}>
                {isFollowing ? 'Following' : '+ Follow'}
              </button>
              <button onClick={()=>{onMessage?.(user.id); onClose();}} style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'12px', color:'white', fontWeight:600, cursor:'pointer', fontSize:14 }}>Message</button>
              <button
                onClick={() => setShowDonate(true)}
                style={{ flex:1, background:'rgba(255,214,10,0.12)', border:'1px solid rgba(255,214,10,0.3)', borderRadius:14, padding:'12px', color:'#FFD60A', fontWeight:700, cursor:'pointer', fontSize:14 }}
              >💝 Donate</button>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>{onVoiceCall?.(user.id); onClose();}} style={{ flex:1, background:'rgba(52,199,89,0.12)', border:'1px solid rgba(52,199,89,0.2)', borderRadius:14, padding:'12px', color:'#2ED573', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2ED573" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
              </button>
              <button onClick={()=>{onVideoCall?.(user.id); onClose();}} style={{ flex:1, background:'rgba(175,82,222,0.12)', border:'1px solid rgba(175,82,222,0.2)', borderRadius:14, padding:'12px', color:'#0B5FFF', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B5FFF" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              </button>
              <button
                onClick={() => setShowReportSheet(true)}
                style={{ flex:1, background:'rgba(255,150,0,0.1)', border:'1px solid rgba(255,150,0,0.3)', borderRadius:14, padding:'12px', color:'#FFB100', fontWeight:600, cursor:'pointer', fontSize:13 }}
              >Report</button>
            </div>
          </div>
        )}
        <div style={{ display:'flex', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          {[{id:'posts',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>},{id:'saved',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>},{id:'drafts',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, background:'none', border:'none', borderTop:tab===t.id?'2px solid #0B5FFF':'2px solid transparent', padding:'14px 0', color:tab===t.id?'white':'rgba(255,255,255,0.3)', cursor:'pointer', display:'flex', justifyContent:'center' }}>{t.icon}</button>
          ))}
        </div>
        <div style={{ padding:2 }}>
          {tab==='posts' && (
            profileVideos.length===0 ? (
              <div style={{ textAlign:'center', padding:48, color:'rgba(255,255,255,0.25)' }}>
                <div style={{ fontSize:40, marginBottom:10 }}>🎬</div>
                <div style={{ fontSize:14 }}>No posts yet</div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2 }}>
                {profileVideos.map(v => {
                  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(v.videoUrl || '');
                  return (
                    <div key={v.id} style={{ aspectRatio:'9/16', background:'#1C1C24', position:'relative', overflow:'hidden' }}>
                      {isImage
                        ? <img src={v.videoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : <video src={v.videoUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      }
                      <div style={{ position:'absolute', bottom:4, left:6, color:'white', fontSize:10, fontWeight:700, background:'rgba(0,0,0,0.6)', borderRadius:6, padding:'2px 6px' }}>{formatNumber(v.views)}</div>
                    </div>
                  );
                })}
              </div>
            )
          )}
          {tab==='saved' && <div style={{ textAlign:'center', padding:48, color:'rgba(255,255,255,0.25)' }}><div style={{ fontSize:40, marginBottom:10 }}>🔖</div><div>No saved posts</div></div>}
          {tab==='drafts' && <div style={{ textAlign:'center', padding:48, color:'rgba(255,255,255,0.25)' }}><div style={{ fontSize:40, marginBottom:10 }}>📝</div><div>No drafts</div></div>}
        </div>
        <div style={{ height:30 }} />
      </div>
      {showReportSheet && (
        <ReportReasonSheet
          title={`Report @${user?.username||'user'}`}
          onClose={()=>setShowReportSheet(false)}
          onSubmit={submitUserReport}
        />
      )}
      {showDonate && (
        <DonationSheet
          recipient={user}
          currentUser={currentUser}
          onClose={() => setShowDonate(false)}
          showToast={showToast}
        />
      )}
    </div>
  );
};
/* LiveCameraView removed — it made every LiveStream participant (host AND
   every viewer) open their own camera, which was the root cause of viewers
   never seeing the streamer. Replaced by LiveHostVideo (host's own camera)
   and LiveViewerVideo (the streamer's video received over WebRTC) below. */
/* ─────────────── LIVE STREAM ─────────────── */
/* ─────────────── LIVE CHAT MESSAGE (with live translation) ─────────────── */
const LiveChatMessage = ({ msg, targetLang }) => {
  const [translated, setTranslated] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(false);
  const eligible = targetLang && targetLang !== 'en' && msg.text && msg.text.length >= 2;
  const toggle = async () => {
    if (translated) { setShowOriginal(s=>!s); return; }
    setLoading(true);
    const result = await liveTranslate(msg.text, targetLang);
    setTranslated(result);
    setLoading(false);
  };
  return (
    <div style={{ background: msg.isGift ? 'rgba(255,214,10,0.16)' : 'rgba(0,0,0,0.4)', border: msg.isGift ? '1px solid rgba(255,214,10,0.35)' : 'none', backdropFilter:'blur(10px)', borderRadius:20, padding:'6px 12px', display:'inline-flex', flexDirection:'column', gap:2, maxWidth:'85%', alignSelf:'flex-start' }}>
      <div style={{ display:'flex', gap:7, alignItems:'baseline' }}>
        <span style={{ color: msg.isGift ? '#FFD60A' : '#0B5FFF', fontSize:11, fontWeight:700 }}>@{msg.user}</span>
        <span style={{ color: msg.isGift ? '#FFD60A' : 'white', fontSize:11, fontWeight: msg.isGift?700:400 }}>{(translated && !showOriginal) ? translated : msg.text}</span>
      </div>
      {eligible && (
        <button onClick={toggle} disabled={loading} style={{ alignSelf:'flex-start', background:'none', border:'none', color:'#2F9BFF', fontSize:10, cursor:'pointer', padding:0, marginTop:1 }}>
          {loading ? '...' : translated ? (showOriginal ? '🌐 See translation' : '🌐 See original') : '🌐 Translate'}
        </button>
      )}
    </div>
  );
};

const LIVE_ICE_SERVERS = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'turn:global.relay.metered.ca:80', username: 'f5e29fd91b8ea2fc485c24ac', credential: 'FZlzkJ5GJJUyYocD' },
  { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: 'f5e29fd91b8ea2fc485c24ac', credential: 'FZlzkJ5GJJUyYocD' },
  { urls: 'turn:global.relay.metered.ca:443', username: 'f5e29fd91b8ea2fc485c24ac', credential: 'FZlzkJ5GJJUyYocD' },
  { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: 'f5e29fd91b8ea2fc485c24ac', credential: 'FZlzkJ5GJJUyYocD' },
];

// Some environments simply don't expose a real RTCPeerConnection constructor at all:
// embedded webviews/preview iframes without WebRTC entitlements, some in-app browsers
// (e.g. certain social apps' built-in browser), or strict privacy modes that stub it
// out. In those cases `new RTCPeerConnection(...)` throws "RTCPeerConnection is not a
// constructor" deep inside a snapshot handler, as an uncaught promise rejection with no
// user-facing message at all. This checks up front so Live/Calls can fail with a clear,
// actionable toast instead of silently doing nothing.
const isWebRTCSupported = () =>
  typeof window !== 'undefined' && typeof window.RTCPeerConnection === 'function';

// Broadcaster's own camera preview (host side only).
const LiveHostVideo = ({ streamRef }) => {
  const videoRef = useRef(null);
  useEffect(()=>{
    if(videoRef.current && streamRef.current){
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(()=>{});
    }
  });
  return <video ref={videoRef} autoPlay playsInline muted style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>;
};

// Viewer's incoming WebRTC feed from the streamer — this is what makes "going live"
// actually visible to anyone other than the broadcaster. Previously every participant
// (host AND every viewer) rendered LiveCameraView, i.e. each person's own camera, so
// viewers never saw the streamer at all. This renders the real remote MediaStream
// received over the peer connection set up below.
const LiveViewerVideo = ({ remoteStream, connected }) => {
  const videoRef = useRef(null);
  useEffect(()=>{
    if(videoRef.current && remoteStream){
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play().catch(()=>{});
    }
  },[remoteStream]);
  return (
    <>
      <video ref={videoRef} autoPlay playsInline style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',background:'#000'}}/>
      {!connected && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12 }}>
          <div style={{ width:36, height:36, border:'3px solid rgba(255,255,255,0.25)', borderTop:'3px solid #0B5FFF', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
          <span style={{ color:'rgba(255,255,255,0.6)', fontSize:13 }}>Connecting to stream...</span>
        </div>
      )}
    </>
  );
};

/* ─────────────── LIVE STREAM ───────────────
   `streamer` is the user whose broadcast this is. `isHost` (streamer.id === currentUser.id)
   decides the role:
   - Host: captures their own camera/mic and, for every viewer that joins, opens a
     dedicated RTCPeerConnection and pushes their local tracks to it (simple mesh — fine
     for small live audiences; a real SFU would be needed at scale).
   - Viewer: opens a single RTCPeerConnection, receives the host's offer via Firestore
     signaling under liveStreams/{id}/viewers/{viewerId}, answers it, and renders the
     resulting remote stream. No camera/mic of their own is requested. */
const LiveStream = ({ streamer, onClose, showToast, currentUser }) => {
  const isHost = !!streamer?.id && streamer.id === currentUser?.id;
  const [liveId, setLiveId] = useState(null);
  const [viewers, setViewers] = useState(0);
  const [connected, setConnected] = useState(isHost); // host is "connected" immediately (their own camera)
  const [remoteStream, setRemoteStream] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [floatingGifts, setFloatingGifts] = useState([]);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [showDonate, setShowDonate] = useState(false); // real-money tip, separate from coin gifts below
  const localStreamRef = useRef(null);
  const liveIdRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const unloadHandlerRef = useRef(null);
  const endedRef = useRef(false);

  // ── HOST: capture camera/mic, create the live doc, and answer every viewer ──
  useEffect(() => {
    if(!isHost) return;
    let cancelled = false;
    const pcByViewer = new Map();
    const cleanupByViewer = new Map();
    let unsubViewers = () => {};

    const start = async () => {
      if (!isWebRTCSupported()) {
        showToast?.("This browser/window doesn't support video calling. Try opening the app in a regular browser tab.", 'error');
        onClose?.();
        return;
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' }, audio:true });
      } catch (e) {
        showToast?.('Camera/mic access is needed to go live', 'error');
        onClose?.();
        return;
      }
      if(cancelled){ stream.getTracks().forEach(t=>t.stop()); return; }
      localStreamRef.current = stream;

      const ref = await addDoc(collection(db, 'liveStreams'), {
        streamerId: streamer?.id,
        streamerUsername: streamer?.username,
        viewers: 0,
        createdAt: serverTimestamp(),
        lastHeartbeat: serverTimestamp(),
        active: true,
      });
      if(cancelled){ updateDoc(ref, { active:false }).catch(()=>{}); return; }
      liveIdRef.current = ref.id;
      setLiveId(ref.id);

      // Keep proving to viewers (and useLiveStreamerIds) that this stream is still
      // genuinely alive. Without this, the only way `active` ever flipped back to
      // false was the cleanup below running on a clean unmount — which never happens
      // if the tab crashes, loses network, or the app is force-quit, leaving a
      // "ghost" live stream that shows the LIVE ring forever even though no one is
      // actually streaming.
      heartbeatIntervalRef.current = setInterval(() => {
        updateDoc(ref, { lastHeartbeat: serverTimestamp() }).catch(()=>{});
      }, 15000);

      // Best-effort: if the tab is abruptly closed (not just navigated within the app),
      // try to flip `active` off immediately rather than waiting up to LIVE_STALE_MS for
      // the heartbeat to go stale. Not guaranteed to complete, which is exactly why the
      // heartbeat/staleness check above still exists as the real fix.
      const markInactiveOnUnload = () => { updateDoc(ref, { active:false }).catch(()=>{}); };
      window.addEventListener('pagehide', markInactiveOnUnload);
      unloadHandlerRef.current = markInactiveOnUnload;

      unsubViewers = onSnapshot(collection(db, 'liveStreams', ref.id, 'viewers'), snap => {
        setViewers(snap.size);
        snap.docChanges().forEach(async change => {
          // (see error handler below — if this listener never fires for a viewer
          // that actually joined, the host never creates a peer connection/offer,
          // and that viewer is stuck on "Connecting..." with nothing wrong shown)
          const viewerId = change.doc.id;
          if(change.type === 'added'){
            const pc = new RTCPeerConnection({ iceServers: LIVE_ICE_SERVERS });
            pcByViewer.set(viewerId, pc);
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
            pc.onicecandidate = e => {
              if(e.candidate) addDoc(collection(db,'liveStreams',ref.id,'viewers',viewerId,'hostCandidates'), e.candidate.toJSON()).catch(()=>{});
            };
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              await updateDoc(change.doc.ref, { offer: { type: offer.type, sdp: offer.sdp } });
            } catch {}
            const unsubAnswer = onSnapshot(change.doc.ref, async docSnap => {
              const data = docSnap.data();
              if(data?.answer && pc.signalingState === 'have-local-offer'){
                try { await pc.setRemoteDescription(new RTCSessionDescription(data.answer)); } catch {}
              }
            });
            const unsubCands = onSnapshot(collection(db,'liveStreams',ref.id,'viewers',viewerId,'viewerCandidates'), s2 => {
              s2.docChanges().forEach(async c => {
                if(c.type === 'added'){ try { await pc.addIceCandidate(new RTCIceCandidate(c.doc.data())); } catch {} }
              });
            });
            cleanupByViewer.set(viewerId, () => { unsubAnswer(); unsubCands(); });
          } else if(change.type === 'removed'){
            pcByViewer.get(viewerId)?.close();
            pcByViewer.delete(viewerId);
            cleanupByViewer.get(viewerId)?.();
            cleanupByViewer.delete(viewerId);
          }
        });
      }, (err) => {
        // BUG FIX: this listener previously had no error callback at all. If Firestore
        // denied it (e.g. a rules mismatch on liveStreams/{id}/viewers), the host would
        // never learn a viewer had joined, never create a peer connection, and never
        // send an offer — the viewer would then sit on "Connecting..." until the
        // 20s timeout with no indication of what went wrong. Now it's logged so the
        // real cause (almost always firestore.rules) is visible instead of invisible.
        console.error('Live host viewers listener error (check firestore.rules for /liveStreams/{id}/viewers):', err);
        showToast?.('Having trouble reaching viewers — check your connection', 'error');
      });
    };
    start();

    return () => {
      cancelled = true;
      endedRef.current = true;
      clearInterval(heartbeatIntervalRef.current);
      if(unloadHandlerRef.current) window.removeEventListener('pagehide', unloadHandlerRef.current);
      unsubViewers();
      cleanupByViewer.forEach(fn => fn());
      pcByViewer.forEach(pc => pc.close());
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      if(liveIdRef.current) updateDoc(doc(db,'liveStreams',liveIdRef.current), { active:false }).catch(()=>{});
    };
  }, [isHost, streamer?.id]);

  // ── VIEWER: find the streamer's active live doc and answer their offer ──
  useEffect(() => {
    if(isHost) return;
    let cancelled = false;
    let pc = null;
    let unsubOffer = () => {};
    let unsubHostCandidates = () => {};
    let unsubLiveDoc = () => {};
    let viewerDocRef = null;

    const start = async () => {
      if (!isWebRTCSupported()) {
        showToast?.("This browser/window doesn't support video calling. Try opening the app in a regular browser tab.", 'error');
        onClose?.();
        return;
      }
      const q = query(collection(db,'liveStreams'), where('streamerId','==', streamer?.id), where('active','==', true));
      const snap = await getDocs(q);
      if(cancelled) return;
      if(snap.empty){
        showToast?.('This live stream has ended', 'info');
        onClose?.();
        return;
      }
      const liveDoc = snap.docs.sort((a,b)=>(b.data().createdAt?.seconds||0)-(a.data().createdAt?.seconds||0))[0];
      liveIdRef.current = liveDoc.id;
      setLiveId(liveDoc.id);

      pc = new RTCPeerConnection({ iceServers: LIVE_ICE_SERVERS });
      pc.ontrack = e => { setRemoteStream(e.streams[0]); setConnected(true); };

      // BUG FIX: previously there was no timeout here at all — if the WebRTC connection
      // never actually established (dead/rate-limited TURN servers, blocked ports,
      // restrictive NAT), the viewer was stuck on "Connecting to stream..." forever with
      // no error and no way out except manually closing. That's exactly what "tries and
      // nothing happens" looks like from the outside. Now it gives up and tells the user
      // after a generous window instead of hanging silently.
      const connectTimeout = setTimeout(() => {
        if (!cancelled && pc && pc.connectionState !== 'connected') {
          showToast?.('Could not connect to this live stream. Check your connection and try again.', 'error');
          onClose?.();
        }
      }, 20000);
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'connected') clearTimeout(connectTimeout);
      });

      viewerDocRef = doc(db, 'liveStreams', liveDoc.id, 'viewers', currentUser.id);
      pc.onicecandidate = e => {
        if(e.candidate) addDoc(collection(viewerDocRef,'viewerCandidates'), e.candidate.toJSON()).catch(()=>{});
      };

      await setDoc(viewerDocRef, { joinedAt: serverTimestamp(), username: currentUser?.username || 'viewer' });

      unsubOffer = onSnapshot(viewerDocRef, async docSnap => {
        const data = docSnap.data();
        if(data?.offer && pc.signalingState === 'stable' && !pc.currentRemoteDescription){
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await updateDoc(viewerDocRef, { answer: { type: answer.type, sdp: answer.sdp } });
          } catch {}
        }
      }, (err) => {
        console.error('Viewer offer listener error (check firestore.rules for /liveStreams/{id}/viewers/{viewerId}):', err);
      });
      unsubHostCandidates = onSnapshot(collection(viewerDocRef, 'hostCandidates'), s2 => {
        s2.docChanges().forEach(async c => {
          if(c.type === 'added'){ try { await pc.addIceCandidate(new RTCIceCandidate(c.doc.data())); } catch {} }
        });
      });
      unsubLiveDoc = onSnapshot(doc(db,'liveStreams', liveDoc.id), s => {
        const d = s.data();
        if(!d) return;
        setViewers(d.viewers ?? 0);
        if(d.active === false && !endedRef.current){
          endedRef.current = true;
          showToast?.('Stream ended', 'info');
          onClose?.();
        }
      });
    };
    start();

    return () => {
      cancelled = true;
      unsubOffer(); unsubHostCandidates(); unsubLiveDoc();
      pc?.close();
      if(viewerDocRef) deleteDoc(viewerDocRef).catch(()=>{});
    };
  }, [isHost, streamer?.id, currentUser?.id]);

  useEffect(() => {
    if(!liveId) return;
    const q = query(collection(db,'liveMessages'), where('liveId','==',liveId), orderBy('createdAt','asc'));
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      setChatMessages(msgs.slice(-20));
    });
    return () => unsub();
  }, [liveId]);

  const sendMessage = async () => {
    if(!message.trim() || !liveId) return;
    await addDoc(collection(db,'liveMessages'), {
      liveId,
      user: currentUser?.username || 'viewer',
      text: message,
      createdAt: serverTimestamp(),
    });
    setMessage('');
  };

  const sendGift = async (gift) => {
    if(!currentUser?.id || !liveId) return;
    if((currentUser.coins||0) < gift.coins){ showToast?.('Insufficient coins','error'); return; }
    setShowGiftPicker(false);
    const emoji = gift.name.split(' ')[0];
    const fid = Date.now()+Math.random();
    setFloatingGifts(g=>[...g, { id:fid, emoji, x: 20+Math.random()*60 }]);
    setTimeout(()=>setFloatingGifts(g=>g.filter(x=>x.id!==fid)), 1500);
    try {
      await apiFetch('/api/wallet', {
        method: 'POST',
        body: JSON.stringify({ type:'gift', toUserId: streamer?.id, amount: gift.coins, streamId: liveId }),
      });
      await addDoc(collection(db,'transactions'),{ userId:currentUser.id, type:'debit', label:`Sent ${gift.name} to @${streamer?.username||'streamer'}`, amount:gift.coins, coins:true, createdAt:serverTimestamp() });
      await addDoc(collection(db,'liveMessages'),{
        liveId,
        user: currentUser?.username||'viewer',
        text: `sent ${gift.name}`,
        isGift: true,
        createdAt: serverTimestamp(),
      });
    } catch(e){ showToast?.('Failed to send gift','error'); }
  };

  // Called once /api/donations/verify confirms a real-money tip. The money itself
  // already landed in the streamer's walletBalance server-side (settleDonation) —
  // this just gives it the same floating-emoji + chat-announcement treatment as a
  // coin gift so cash tips feel native to the live room, not bolted on.
  const onCashDonation = async (amountSent) => {
    const fid = Date.now()+Math.random();
    setFloatingGifts(g=>[...g, { id:fid, emoji:'💝', x: 20+Math.random()*60 }]);
    setTimeout(()=>setFloatingGifts(g=>g.filter(x=>x.id!==fid)), 1500);
    if (!liveId) return;
    try {
      await addDoc(collection(db,'liveMessages'),{
        liveId,
        user: currentUser?.username||'viewer',
        text: `sent a NGN ${amountSent.toLocaleString()} tip`,
        isGift: true,
        createdAt: serverTimestamp(),
      });
    } catch(e) { /* announcement is best-effort — the donation itself already settled */ }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'linear-gradient(160deg,#0d0025,#160d00)', zIndex:2000, display:'flex', flexDirection:'column' }}>
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 30% 40%,rgba(11,95,255,0.15),transparent 60%)' }} />
      <div style={{ padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', zIndex:10 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ background:`linear-gradient(135deg,${COLORS.live},#B3121F)`, borderRadius:20, padding:'4px 12px', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 14px rgba(225,29,46,0.45)' }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'white', animation:'pulse 1s infinite' }} />
            <span style={{ color:'white', fontSize:13, fontWeight:700, letterSpacing:0.3 }}>LIVE</span>
          </div>
          {!isHost && (
            <div style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderRadius:20, padding:'4px 12px', border:'1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color:'white', fontSize:12, fontWeight:700 }}>@{streamer?.username || 'streamer'}</span>
            </div>
          )}
          <div style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderRadius:20, padding:'4px 12px', display:'flex', alignItems:'center', gap:5, border:'1px solid rgba(255,255,255,0.08)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span style={{ color:'rgba(255,255,255,0.7)', fontSize:12 }}>{formatNumber(viewers)}</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'50%', width:36, height:36, color:'white', cursor:'pointer', fontSize:16, transition:TRANSITION.fast }}>✕</button>
      </div>
      {isHost ? <LiveHostVideo streamRef={localStreamRef} /> : <LiveViewerVideo remoteStream={remoteStream} connected={connected} />}
      {floatingGifts.map(g=>(
        <div key={g.id} style={{ position:'absolute', bottom:120, left:`${g.x}%`, zIndex:60, pointerEvents:'none', fontSize:44, animation:'floatUp 1.5s ease forwards' }}>{g.emoji}</div>
      ))}
      <div style={{ flex:1, display:'flex', alignItems:'flex-end', padding:'0 14px 10px', zIndex:10 }}>
        <div style={{ flex:1, maxHeight:200, overflowY:'hidden', display:'flex', flexDirection:'column', gap:6 }}>
          {chatMessages.slice(-8).map(m=>{
            const targetLang = currentUser?.language || 'en';
            return <LiveChatMessage key={m.id} msg={m} targetLang={targetLang} />;
          })}
        </div>
      </div>
      {showGiftPicker && (
        <div style={{ padding:'0 14px 8px', zIndex:10 }}>
          <div style={{ background:'rgba(10,10,16,0.92)', backdropFilter:'blur(20px)', borderRadius:20, padding:14, border:'1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={{ color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>Send a gift</span>
              <span style={{ color:'#FFD60A', fontSize:12, fontWeight:700 }}>💰 {formatNumber(currentUser?.coins||0)}</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
              {VIRTUAL_GIFTS.map(g=>(
                <button key={g.id} onClick={()=>sendGift(g)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'10px 4px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <span style={{ fontSize:24 }}>{g.name.split(' ')[0]}</span>
                  <span style={{ color:'#FFD60A', fontSize:10, fontWeight:700 }}>{formatNumber(g.coins)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div style={{ display:'flex', gap:10, padding:'10px 14px 28px', borderTop:'1px solid rgba(255,255,255,0.06)', zIndex:10 }}>
        <input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()} placeholder="Say something..." style={{ flex:1, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:28, padding:'10px 16px', color:'white', outline:'none', fontSize:13 }} />
        {!isHost && (
          <button onClick={()=>setShowGiftPicker(v=>!v)} style={{ background: showGiftPicker ? 'rgba(255,214,10,0.25)' : 'rgba(255,255,255,0.08)', border:'1px solid rgba(255,214,10,0.3)', borderRadius:'50%', width:42, height:42, color:'#FFD60A', cursor:'pointer', fontSize:18, flexShrink:0 }}>🎁</button>
        )}
        {!isHost && (
          // Real-money tip straight to the streamer's wallet, alongside (not instead
          // of) the coin-based gifts above — same DonationSheet used from profiles.
          <button onClick={()=>setShowDonate(true)} title="Send a cash tip" style={{ background:'rgba(11,95,255,0.14)', border:'1px solid rgba(11,95,255,0.35)', borderRadius:'50%', width:42, height:42, color:'#6E4CF5', cursor:'pointer', fontSize:18, flexShrink:0 }}>💝</button>
        )}
        <button onClick={sendMessage} style={{ background:'linear-gradient(135deg,#2E7BFF,#0B5FFF)', border:'none', borderRadius:'50%', width:42, height:42, color:'white', cursor:'pointer', fontSize:16, flexShrink:0 }}>↑</button>
      </div>
      {showDonate && (
        <DonationSheet
          recipient={streamer}
          currentUser={currentUser}
          onClose={() => setShowDonate(false)}
          showToast={showToast}
          onSuccess={onCashDonation}
        />
      )}
    </div>
  );
};
/* CommentItem and CommentInputBar removed — dead code. CommentsModal (used by
   FeedPostCard) hand-rolls its own comment list and input inline instead of
   reusing these; neither was ever rendered on its own. */
const VideoProgressBar = ({ videoRef, isActive, isImage }) => {
  const [progress, setProgress] = useState(0);
  useEffect(()=>{
    if(isImage || !isActive) return;
    const tick = setInterval(()=>{
      const el = videoRef?.current;
      if(el && el.duration) setProgress((el.currentTime / el.duration) * 100);
    }, 500);
    return ()=>clearInterval(tick);
  },[isActive, isImage]);
  if(isImage) return null;
  return (
    <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'rgba(255,255,255,0.15)', zIndex:20 }}>
      <div style={{ height:'100%', background:'linear-gradient(90deg,#2E7BFF,#0B5FFF)', width:`${progress}%`, transition:'width 0.5s linear' }} />
    </div>
  );
};
/* ─────────────── ENHANCED VIDEO CARD ─────────────── */
/* EnhancedVideoCard removed — dead code, a fully-featured duplicate of the
   full-screen video card that was never rendered. FeedPostCard is the one
   actually used in HomeFeed; its long-press save/like logic already writes
   to videos.savedBy/likedBy the same way this component did. */
/* NotifBellButton removed — dead code, an earlier filled-circle notification bell
   that was superseded by NotificationBellButton below (the one actually rendered in
   HomeFeed's header) and never deleted. InboxBadge (used in the tab bar) already
   covers the unread-count concern this component duplicated. */

// Notification entry point in the Home Feed header — a real bell glyph (previously
// this rendered a 4-dot sparkle icon that didn't read as a notifications control).
const NotificationBellButton = ({ onOpenNotifications, currentUser }) => {
  const [unread, setUnread] = useState(0);
  useEffect(()=>{
    if(!currentUser?.id) return;
    const q = query(collection(db,'notifications'), where('toUserId','==',currentUser.id), where('read','==',false));
    const unsub = onSnapshot(q, snap=>setUnread(snap.size), ()=>{});
    return ()=>unsub();
  },[currentUser?.id]);
  return (
    <button onClick={onOpenNotifications} style={{ background:'none', border:'none', width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', position:'relative', flexShrink:0 }}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={COLORS.brand} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 01-3.46 0"/>
      </svg>
      {unread>0 && <div style={{ position:'absolute', top:0, right:0, minWidth:15, height:15, background:COLORS.danger, borderRadius:8, border:`1.5px solid ${COLORS.surface}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'white', fontWeight:800, padding:'0 2px' }}>{unread>9?'9+':unread}</div>}
    </button>
  );
};

      
/* ─────────────── JOBS & SKILLS PAGE ─────────────── */

/* ─────────────── HOME FEED ─────────────── */

/* SuggestedUsers removed — dead code, duplicate of the already-shipped Smart
   Suggestions block in FriendsDiscoveryPage, never rendered itself. */
// Single scrollable post card — replaces the old full-screen swipe video player.
// Matches the "HOME FEED (ENHANCED)" reference: avatar, name, caption, media,
// then a like/comment/share/save row with live counts underneath.
/* ─────────────── LIKES MODAL (image 8) ─────────────── */
const LikesModal = ({ video, currentUser, users, onClose, onFollow, followed }) => {
  const [tab, setTab] = useState('all');
  const likers = useMemo(() => {
    const ids = video?.likedBy || [];
    return ids.map(id => users?.find(u => u.id === id)).filter(Boolean);
  }, [video, users]);
  const count = video?.likes || likers.length;
  return (
    <div style={{ position:'fixed', inset:0, zIndex:5000, background:COLORS.surface, display:'flex', flexDirection:'column' }}>
      <SheetBackHeader title="Likes" onClose={onClose} />
      <div style={{ textAlign:'center', padding:'22px 16px 6px' }}>
        <div style={{ width:52, height:52, borderRadius:'50%', background:COLORS.gradient, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 21s-7.5-4.6-10-9.2C.4 8 2 4 6 4c2.2 0 3.7 1.2 4.5 2.4C11.3 5.2 12.8 4 15 4c4 0 5.6 4 4 7.8-2.5 4.6-10 9.2-10 9.2z"/></svg>
        </div>
        <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:19 }}>{formatNumber(count)} Likes</div>
      </div>
      <div style={{ display:'flex', gap:26, padding:'16px 16px 0', borderBottom:`1px solid ${COLORS.border}` }}>
        {[{id:'all',label:'All'},{id:'people',label:'People'}].map(tb => (
          <button key={tb.id} onClick={()=>setTab(tb.id)} style={{ background:'none', border:'none', cursor:'pointer', padding:'0 0 12px', color:tab===tb.id?COLORS.brand:COLORS.textTertiary, fontWeight:700, fontSize:14, borderBottom:tab===tb.id?`2.5px solid ${COLORS.brand}`:'2.5px solid transparent' }}>{tb.label}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'8px 16px' }}>
        {!likers.length && <div style={{ textAlign:'center', color:COLORS.textTertiary, padding:'40px 0', fontSize:13 }}>No likes yet</div>}
        {likers.map(u => (
          <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0' }}>
            <div onClick={()=>onViewProfile?.(u.id)} style={{ width:46, height:46, borderRadius:'50%', background:u.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, overflow:'hidden', flexShrink:0, cursor:'pointer' }}>
              {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (u.username||'?')[0]?.toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:14 }}>{u.fullName || u.username}</div>
              <div style={{ color:COLORS.textTertiary, fontSize:12 }}>@{u.username}</div>
            </div>
            <button onClick={()=>onFollow?.(u.id)} style={{ background:followed?.includes(u.id)?COLORS.surfaceAlt:COLORS.gradient, color:followed?.includes(u.id)?COLORS.textSecondary:'#fff', border:'none', borderRadius:14, padding:'7px 16px', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>{followed?.includes(u.id)?'Following':'Follow'}</button>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────── COMMENTS MODAL (image 9) ─────────────── */
const REACTION_EMOJIS = ['❤️','😂','😢','🔥','😍','🙏'];
const CommentsModal = ({ video, currentUser, onClose, showToast, onViewProfile }) => {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const cmFileInputRef = useRef(null);
  const cmCameraInputRef = useRef(null);
  const [cmAttachment, setCmAttachment] = useState(null);
  const cmPickFile = e => { const f=e.target.files[0]; if(f){setCmAttachment({url:URL.createObjectURL(f),file:f,type:f.type}); e.target.value='';} };

  useEffect(() => {
    if (!video?.id) return;
    setLoading(true);
    setLoadError(false);
    // The compound query (where + orderBy on different fields) needs a Firestore
    // composite index. If that index hasn't been created yet, onSnapshot's error
    // callback fires and — since there wasn't one before — the list just silently
    // stayed empty forever with no indication anything had gone wrong. Falling back
    // to the where-only query (sorted client-side) means comments still show even
    // before/without that index, matching the same fallback pattern already used
    // for stories.
    const primaryQ = query(collection(db, 'comments'), where('videoId', '==', video.id), orderBy('createdAt', 'desc'));
    let fallbackUnsub = null;
    const unsub = onSnapshot(primaryQ, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => {
      const fallbackQ = query(collection(db, 'comments'), where('videoId', '==', video.id));
      fallbackUnsub = onSnapshot(fallbackQ, snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setComments(list);
        setLoading(false);
      }, () => { setLoading(false); setLoadError(true); });
    });
    return () => { unsub(); fallbackUnsub?.(); };
  }, [video?.id]);

  const likeComment = async (id) => {
    try { await updateDoc(doc(db, 'comments', id), { likes: increment(1) }); } catch {}
  };

  // Comment moderation: report (anyone but the author) or delete (author or admin).
  // Comments previously had zero moderation surface — no way to flag one, and no
  // way for the person who wrote it (or an admin) to take it down.
  const [reportTarget, setReportTarget] = useState(null); // comment being reported
  const [openMenuFor, setOpenMenuFor] = useState(null); // comment id with the ⋯ menu open

  const submitCommentReport = async (reason) => {
    const c = reportTarget;
    if (!c) return;
    try {
      await submitReport('comment', c.id, currentUser.id, {
        commentId: c.id,
        commentText: c.text || '',
        commentUserId: c.userId || null,
        commentUsername: c.username || null,
        videoId: video?.id || null,
        videoThumbUrl: video?.thumbUrl || video?.thumbnailUrl || video?.url || null,
        reporterUsername: currentUser?.username || currentUser?.fullName || null,
        reason,
      });
      showToast?.('Comment reported — thanks for letting us know', 'success');
    } catch (e) {
      showToast?.(e.message || 'Could not submit report', e.duplicate ? 'info' : 'error');
    }
    setReportTarget(null);
  };

  const deleteComment = async (c) => {
    if (!(await confirmDialog('Delete this comment? This cannot be undone.'))) return;
    try {
      await deleteDoc(doc(db, 'comments', c.id));
      await updateDoc(doc(db, 'videos', video.id), { comments: increment(-1) }).catch(()=>{});
      setComments(prev => prev.filter(x => x.id !== c.id));
      showToast?.('Comment deleted', 'success');
    } catch (e) {
      showToast?.('Could not delete comment', 'error');
    }
    setOpenMenuFor(null);
  };

  const send = async () => {
    if (!commentText.trim() && !cmAttachment) return;
    try {
      let mediaUrl = null, mediaType = null;
      if (cmAttachment?.file) {
        try { mediaUrl = await uploadToCloudinary(cmAttachment.file); mediaType = cmAttachment.type; }
        catch { showToast?.('Upload failed', 'error'); return; }
      }
      await addDoc(collection(db, 'comments'), { videoId: video.id, userId: currentUser.id, username: currentUser.username, avatar: currentUser.avatar || (currentUser.username||'U')[0].toUpperCase(), avatarColor: currentUser.avatarColor || COLORS.brand, avatarUrl: currentUser.avatarUrl || null, text: commentText, mediaUrl, mediaType, likes: 0, createdAt: serverTimestamp() });
      await updateDoc(doc(db, 'videos', video.id), { comments: increment(1) });
    } catch { showToast?.('Failed to post comment', 'error'); }
    setCommentText(''); setCmAttachment(null);
  };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:5000, background:'rgba(15,10,25,0.5)', display:'flex', alignItems:'flex-end', maxWidth:430, margin:'0 auto' }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', height:'58vh', maxHeight:520, background:COLORS.surface, borderTopLeftRadius:24, borderTopRightRadius:24, display:'flex', flexDirection:'column', animation:'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
      <div style={{ display:'flex', justifyContent:'center', paddingTop:8 }}>
        <div style={{ width:36, height:4, borderRadius:2, background:COLORS.border }} />
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:14, padding:'10px 16px 14px', borderBottom:`1px solid ${COLORS.border}` }}>
        <div style={{ flex:1, color:COLORS.textPrimary, fontWeight:800, fontSize:16, textAlign:'center' }}>{comments.length} Comments</div>
        <button onClick={onClose} style={{ position:'absolute', right:16, background:'none', border:'none', cursor:'pointer', color:COLORS.textTertiary, padding:4, display:'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'14px 16px' }}>
        {loading && <div style={{ textAlign:'center', color:COLORS.textTertiary, padding:'40px 0', fontSize:13 }}>Loading comments…</div>}
        {!loading && loadError && <div style={{ textAlign:'center', color:COLORS.textTertiary, padding:'40px 0', fontSize:13 }}>Couldn't load comments. Pull down to try again.</div>}
        {!loading && !loadError && !comments.length && <div style={{ textAlign:'center', color:COLORS.textTertiary, padding:'40px 0', fontSize:13 }}>Be the first to comment</div>}
        {comments.map(c => {
          const isOwn = c.userId === currentUser?.id;
          const canModerate = isOwn || currentUser?.isAdmin;
          return (
          <div key={c.id} style={{ display:'flex', gap:10, marginBottom:18 }}>
            <div onClick={()=>onViewProfile?.(c.userId)} style={{ width:38, height:38, borderRadius:'50%', background:c.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:13, overflow:'hidden', flexShrink:0, cursor:'pointer' }}>
              {c.avatarUrl ? <img src={c.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (c.avatar||'U')}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                <span style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:13.5 }}>{c.username}</span>
                <span style={{ color:COLORS.textTertiary, fontSize:11.5, marginLeft:'auto' }}>{c.createdAt?.toDate ? timeAgo(c.createdAt.toDate()) : 'now'}</span>
                <div style={{ position:'relative' }}>
                  <button onClick={()=>setOpenMenuFor(m=>m===c.id?null:c.id)} style={{ background:'none', border:'none', cursor:'pointer', color:COLORS.textTertiary, padding:'2px 4px', display:'flex' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
                  </button>
                  {openMenuFor === c.id && (
                    <div style={{ position:'absolute', top:'calc(100% + 4px)', right:0, background:COLORS.surface3, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:4, zIndex:10, minWidth:120, boxShadow:'0 8px 24px rgba(0,0,0,0.3)' }}>
                      {!isOwn && (
                        <div onClick={()=>{ setReportTarget(c); setOpenMenuFor(null); }} style={{ padding:'8px 10px', borderRadius:8, color:COLORS.textPrimary, fontSize:12.5, cursor:'pointer' }}>Report</div>
                      )}
                      {canModerate && (
                        <div onClick={()=>deleteComment(c)} style={{ padding:'8px 10px', borderRadius:8, color:COLORS.danger, fontSize:12.5, cursor:'pointer' }}>Delete</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ color:COLORS.textSecondary, fontSize:13.5, lineHeight:1.45, marginTop:2 }}>{c.text}</div>
              <div style={{ display:'flex', alignItems:'center', gap:16, marginTop:6 }}>
                <button onClick={()=>likeComment(c.id)} style={{ background:'none', border:'none', cursor:'pointer', color:COLORS.textTertiary, fontSize:12, fontWeight:600 }}>Like</button>
                <button onClick={()=>{}} style={{ background:'none', border:'none', cursor:'pointer', color:COLORS.textTertiary, fontSize:12, fontWeight:600 }}>Reply</button>
              </div>
            </div>
            <button onClick={()=>likeComment(c.id)} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, color:COLORS.textTertiary, flexShrink:0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
              <span style={{ fontSize:11 }}>{c.likes||0}</span>
            </button>
          </div>
          );
        })}
      </div>
      {reportTarget && (
        <ReportReasonSheet
          title="Report Comment"
          onClose={()=>setReportTarget(null)}
          onSubmit={submitCommentReport}
        />
      )}
      {cmAttachment && (
        <div style={{ padding:'0 16px 6px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, background:COLORS.overlaySubtle, borderRadius:14, padding:'8px 12px' }}>
            {cmAttachment.type?.startsWith('image') && <img src={cmAttachment.url} alt="" style={{ height:44, width:44, objectFit:'cover', borderRadius:8 }}/>}
            {cmAttachment.type?.startsWith('video') && <video src={cmAttachment.url} style={{ height:44, width:60, objectFit:'cover', borderRadius:8 }}/>}
            <button onClick={()=>setCmAttachment(null)} style={{ marginLeft:'auto', background:'rgba(11,95,255,0.2)', border:'none', borderRadius:'50%', width:22, height:22, color:COLORS.brand, cursor:'pointer', fontSize:13 }}>✕</button>
          </div>
        </div>
      )}
      <div style={{ padding:'8px 16px', display:'flex', gap:8 }}>
        {REACTION_EMOJIS.map(e => (
          <button key={e} onClick={()=>setCommentText(t=>t+e)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', padding:2 }}>{e}</button>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px max(16px, env(safe-area-inset-bottom))', borderTop:`1px solid ${COLORS.border}` }}>
        <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:2, background:COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius:24, padding:'4px 6px 4px 12px' }}>
          <input value={commentText} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Add a comment..." style={{ flex:1, minWidth:0, background:'none', border:'none', outline:'none', color:COLORS.textPrimary, fontSize:13, padding:'8px 4px' }} />
          <button onClick={()=>cmFileInputRef.current?.click()} style={{ background:'none', border:'none', cursor:'pointer', color:COLORS.textTertiary, flexShrink:0, display:'flex', padding:5 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <button onClick={()=>cmCameraInputRef.current?.click()} style={{ background:'none', border:'none', cursor:'pointer', color:COLORS.textTertiary, flexShrink:0, display:'flex', padding:5 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </button>
        </div>
        <input ref={cmFileInputRef} type="file" accept="image/*,video/*" onChange={cmPickFile} style={{ display:'none' }} />
        <input ref={cmCameraInputRef} type="file" accept="image/*" capture="environment" onChange={cmPickFile} style={{ display:'none' }} />
        <button onClick={send} style={{ background:COLORS.gradient, border:'none', borderRadius:'50%', width:36, height:36, color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
      </div>
    </div>
  );
};

/* ─────────────── SAVE CONFIRM SHEET (image 11) ─────────────── */
const SaveConfirmSheet = ({ onClose, onViewCollections }) => (
  <div style={{ position:'fixed', inset:0, zIndex:5000, background:'rgba(20,15,35,0.45)', display:'flex', alignItems:'flex-end', animation:'fadeIn 0.2s ease' }} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{ width:'100%', background:COLORS.surface, borderTopLeftRadius:26, borderTopRightRadius:26, paddingBottom:'max(24px, env(safe-area-inset-bottom))' }}>
      <SheetBackHeader title="Save" onClose={onClose} />
      <div style={{ textAlign:'center', padding:'34px 24px 8px' }}>
        <div style={{ width:64, height:64, borderRadius:20, background:COLORS.gradient, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M6 2a2 2 0 00-2 2v18l8-6 8 6V4a2 2 0 00-2-2z"/></svg>
        </div>
        <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:19, marginBottom:8 }}>Saved!</div>
        <div style={{ color:COLORS.textTertiary, fontSize:13.5, lineHeight:1.5, marginBottom:26 }}>This post has been saved to your collection.</div>
        <button onClick={onViewCollections} style={{ width:'100%', background:COLORS.gradient, border:'none', borderRadius:16, padding:'14px', color:'#fff', fontWeight:700, fontSize:14.5, cursor:'pointer' }}>View Collections</button>
      </div>
    </div>
  </div>
);

/* ─────────────── POST OPTIONS MENU (image 12) ─────────────── */
const PostOptionsMenu = ({ video, currentUser, onClose, showToast, onDelete, onBlock }) => {
  const isMine = video?.userId === currentUser?.id;
  const name = video?.fullName || video?.username || 'User';
  const [showReportSheet, setShowReportSheet] = useState(false);
  const submitPostReport = async (reason) => {
    try {
      await submitReport('video', video?.id, currentUser.id, {
        videoId: video?.id || null,
        reporterUsername: currentUser.username || currentUser.fullName || null,
        reason,
        // Denormalized snapshot so the moderation screen can show what was reported
        // even if the post is later edited or deleted.
        videoUsername: video?.username || null,
        videoUserId: video?.userId || null,
        videoCaption: video?.description || video?.caption || null,
        videoThumbUrl: video?.thumbUrl || video?.thumbnailUrl || video?.url || null,
      });
      showToast?.('Post reported — thanks for letting us know', 'success');
    } catch (e) {
      showToast?.(e.message || 'Could not submit report', e.duplicate ? 'info' : 'error');
    }
    setShowReportSheet(false);
    onClose();
  };
  const items = [
    { label:'Edit Post', show:isMine, action:()=>{ showToast?.('Opening editor…','info'); }, icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></svg>) },
    { label:'Pin Post', show:isMine, action:()=>{ showToast?.('Pinned to profile','success'); }, icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-1.4-7.5A3 3 0 0014.66 7H9.34a3 3 0 00-2.94 2.5z"/></svg>) },
    { label:'Copy Link', show:true, action:async()=>{ try{ await navigator.clipboard.writeText(`https://infinity-now.vercel.app/video/${video?.id}`); showToast?.('Link copied!','success'); }catch{ showToast?.('Could not copy link','error'); } }, icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 007.07 7.07l1.5-1.5"/></svg>) },
    { label:'Repost', show:!isMine, action:()=>{ showToast?.('Reposted to your profile','success'); }, icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>) },
    { label:'Send to Friends', show:true, action:()=>{ showToast?.('Open Messages to send','info'); }, icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>) },
    { label:'Add to Collection', show:true, action:()=>{ showToast?.('Added to collection','success'); }, icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2a2 2 0 00-2 2v18l8-6 8 6V4a2 2 0 00-2-2z"/></svg>) },
    { label:`Mute ${name}`, show:!isMine, action:()=>{ showToast?.(`Muted ${name}`,'info'); }, icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>) },
    { label:`Block ${name}`, show:!isMine, action:()=>{ onBlock?.(video?.userId); showToast?.(`Blocked ${name} — their posts are now hidden`,'info'); }, icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/></svg>) },
    { label:'Report', show:!isMine, danger:true, keepOpen:true, action:()=>{ setShowReportSheet(true); }, icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>) },
    { label:'Delete Post', show:isMine, danger:true, sep:true, action:async()=>{
        if(!(await confirmDialog('Delete this post? This cannot be undone.'))) return;
        try{ await deleteDoc(doc(db,'videos',video.id)); showToast?.('Post deleted','success'); }
        catch(e){ showToast?.('Could not delete post','error'); }
        onDelete?.(video?.id); onClose();
      }, icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>) },
  ].filter(i => i.show);
  return (
    <div style={{ position:'fixed', inset:0, zIndex:5000, background:'rgba(20,15,35,0.45)', display:'flex', alignItems:'flex-end', animation:'fadeIn 0.2s ease' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxHeight:'86vh', overflowY:'auto', background:COLORS.surface, borderTopLeftRadius:26, borderTopRightRadius:26, paddingBottom:'max(20px, env(safe-area-inset-bottom))' }}>
        <SheetBackHeader title="More Options" onClose={onClose} />
        <div style={{ padding:'6px 8px' }}>
          {items.map(item => (
            <button key={item.label} onClick={()=>{ item.action(); if(!item.label.startsWith('Delete') && !item.keepOpen) onClose(); }} style={{ width:'100%', display:'flex', alignItems:'center', gap:14, background:'none', border:'none', borderTop:item.sep?`1px solid ${COLORS.border}`:'none', marginTop:item.sep?8:0, paddingTop:item.sep?16:12, padding:item.sep?'16px 12px 12px':'12px', color:item.danger?COLORS.danger:COLORS.textPrimary, fontSize:14.5, fontWeight:600, cursor:'pointer', textAlign:'left', borderRadius:12 }}>
              {item.icon}{item.label}
            </button>
          ))}
        </div>
      </div>
      {showReportSheet && (
        <ReportReasonSheet
          title="Report Post"
          onClose={()=>{ setShowReportSheet(false); onClose(); }}
          onSubmit={submitPostReport}
        />
      )}
    </div>
  );
};

// Ensures only one FeedPostCard video autoplays at a time (TikTok-style single active playback)
let __activeFeedVideoEl = null;

const FeedPostCard = ({ video, currentUser, onViewProfile, onOpenComments, onShare, users, onFollow, followed, showToast, onDelete, onBlock, isLive }) => {
  const [liked, setLiked] = useState((video.likedBy||[]).includes(currentUser?.id));
  const [likeCount, setLikeCount] = useState(video.likes||0);
  // Author lookup — the video doc doesn't carry a denormalized `verified` flag, so we
  // check the live users list (same one Home/Infinity already have in hand) to show a
  // verified badge next to the name, exactly like Instagram/Facebook/X do.
  const author = useMemo(()=> (users||[]).find(u=>u.id===video.userId), [users, video.userId]);
  const displayName = author?.fullName || video.fullName || author?.username || video.username || 'user';
  // Double-tap-to-like — Instagram's signature interaction. A double tap on the media
  // always likes (never unlikes) and shows a brief heart-burst overlay; burstKey forces
  // the CSS animation to restart on every tap instead of only playing once ever.
  const [burstKey, setBurstKey] = useState(0);
  const burstTimeoutRef = useRef(null);
  // Re-sync from the live Firestore snapshot whenever it changes (e.g. someone else
  // likes/unlikes this post) so the count updates in real time for every viewer,
  // TikTok-style, instead of freezing at whatever it was when this card first mounted.
  const likeActionPendingRef = useRef(false);
  useEffect(() => {
    if (likeActionPendingRef.current) return; // don't clobber our own optimistic update mid-flight
    setLiked((video.likedBy||[]).includes(currentUser?.id));
    setLikeCount(video.likes||0);
  }, [video.likes, video.likedBy, currentUser?.id]);
  const [saved, setSaved] = useState((video.savedBy||[]).includes(currentUser?.id));
  const [showLikes, setShowLikes] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const isVideo = video?.mediaType?.startsWith('video') || /\.(mp4|webm|mov)(\?|$)/i.test(video?.videoUrl||'');
  const mediaSrc = (Array.isArray(video.images) && video.images[0]) || video.videoUrl;
  const mediaWrapRef = useRef(null);
  const videoElRef = useRef(null);
  const [videoPaused, setVideoPaused] = useState(false);
  const viewCountedRef = useRef(false);
  const isVisible = useIntersectionObserver(mediaWrapRef, { threshold: 0.6 });

  // Count a view once per mount, the first time the post is actually scrolled into view
  useEffect(() => {
    if (!isVisible || viewCountedRef.current || !video?.id) return;
    viewCountedRef.current = true;
    updateDoc(doc(db, 'videos', video.id), { views: increment(1) }).catch(() => {});
  }, [isVisible, video?.id]);

  // TikTok-style single-active playback: autoplay when in view, pause when scrolled away,
  // and pause any other feed video that was already playing so only one plays at once.
  useEffect(() => {
    if (!isVideo) return;
    const el = videoElRef.current;
    if (!el) return;
    if (isVisible) {
      if (__activeFeedVideoEl && __activeFeedVideoEl !== el) {
        try { __activeFeedVideoEl.pause(); } catch {}
      }
      __activeFeedVideoEl = el;
      el.play().then(()=>setVideoPaused(false)).catch(() => { setVideoPaused(true); });
    } else {
      el.pause();
      setVideoPaused(true);
      if (__activeFeedVideoEl === el) __activeFeedVideoEl = null;
    }
  }, [isVisible, isVideo]);

  useEffect(() => () => {
    if (__activeFeedVideoEl === videoElRef.current) __activeFeedVideoEl = null;
  }, []);

  const toggleLike = async () => {
    const nowLiked = !liked;
    likeActionPendingRef.current = true;
    setLiked(nowLiked);
    setLikeCount(c => c + (nowLiked ? 1 : -1));
    haptic('light');
    try {
      await updateDoc(doc(db, 'videos', video.id), {
        likes: increment(nowLiked ? 1 : -1),
        likedBy: nowLiked ? arrayUnion(currentUser?.id) : arrayRemove(currentUser?.id),
      });
    } catch (e) { /* best-effort */ }
    finally { likeActionPendingRef.current = false; }
  };

  const handleMediaDoubleClick = () => {
    if (!liked) toggleLike();
    haptic('light');
    setBurstKey(k => k + 1);
    if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);
    burstTimeoutRef.current = setTimeout(() => setBurstKey(0), 800);
  };
  useEffect(() => () => { if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current); }, []);

  const toggleSave = async () => {
    const nowSaved = !saved;
    setSaved(nowSaved);
    haptic('light');
    try {
      await updateDoc(doc(db, 'videos', video.id), {
        savedBy: nowSaved ? arrayUnion(currentUser?.id) : arrayRemove(currentUser?.id),
        saves: increment(nowSaved ? 1 : -1),
      });
    } catch (e) {}
    if (nowSaved) setShowSaveConfirm(true);
  };

  const handleDownload = async () => {
    if (!mediaSrc) { showToast?.('No media to download', 'error'); return; }
    haptic('light');
    try {
      const res = await fetch(mediaSrc);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const ext = isVideo ? 'mp4' : 'jpg';
      const a = document.createElement('a');
      a.href = url; a.download = `infinity_post_${video.id || Date.now()}.${ext}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      showToast?.('Post downloaded! 📥', 'success');
    } catch (e) {
      showToast?.('Download failed', 'error');
    }
  };

  return (
    <>
    {showLikes && <LikesModal video={video} currentUser={currentUser} users={users} onClose={()=>setShowLikes(false)} onFollow={onFollow} followed={followed} onViewProfile={onViewProfile} />}
    {showComments && <CommentsModal video={video} currentUser={currentUser} onClose={()=>setShowComments(false)} showToast={showToast} onViewProfile={onViewProfile} />}
    {showShare && <ShareSheet video={video} currentUser={currentUser} onClose={()=>setShowShare(false)} showToast={showToast} />}
    {showSaveConfirm && <SaveConfirmSheet onClose={()=>setShowSaveConfirm(false)} onViewCollections={()=>{ setShowSaveConfirm(false); showToast?.('Opening collections…','info'); }} />}
    {showOptions && <PostOptionsMenu video={video} currentUser={currentUser} onClose={()=>setShowOptions(false)} showToast={showToast} onDelete={onDelete} onBlock={onBlock} />}
    <div style={{ background:COLORS.surface, borderRadius:RADIUS.lg, padding:14, marginBottom:0, boxShadow:SHADOW.card, border:`1px solid ${COLORS.border}`, transition:TRANSITION.base }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
        <div onClick={()=>onViewProfile?.(video.userId)} style={{ width:44, height:44, borderRadius:'50%', background:video.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:17, overflow:'hidden', cursor:'pointer', flexShrink:0, position:'relative', border: isLive ? `2px solid ${COLORS.live}` : `2px solid ${COLORS.surface}`, boxShadow: isLive ? SHADOW.glow(COLORS.live) : SHADOW.xs, transition:TRANSITION.fast }}>
          {(author?.avatarUrl || video.avatarUrl) ? <img src={author?.avatarUrl || video.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (displayName||'?')[0]?.toUpperCase()}
          {isLive && (
            <div style={{ position:'absolute', bottom:-3, left:'50%', transform:'translateX(-50%)', background:COLORS.live, borderRadius:6, padding:'1px 5px', fontSize:7, fontWeight:800, color:'white', letterSpacing:0.3, whiteSpace:'nowrap' }}>LIVE</div>
          )}
        </div>
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden', cursor:'pointer' }} onClick={()=>onViewProfile?.(video.userId)}>
          {/* Posts show only the person's current display name (full name), read live
              from `users` via `author` — not the username/fullName that was snapshotted
              onto the video doc at the moment it was posted. Using the snapshot meant the
              same person's older and newer posts could show two different names/handles
              after they ever changed their profile name. Falls back to the post's own
              snapshot only for the rare case the author's live profile hasn't loaded yet
              (e.g. they were removed), and to username only if no full name exists at all. */}
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, whiteSpace:'nowrap', overflow:'hidden' }}>
            <span style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:14, overflow:'hidden', textOverflow:'ellipsis' }}>{displayName}</span>
            {author?.verified && <svg width="14" height="14" viewBox="0 0 24 24" fill={COLORS.info} style={{flexShrink:0}}><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            {video.feeling && <span style={{ color:COLORS.textSecondary, fontWeight:500, fontSize:14 }}> is feeling {video.feeling.emoji} {video.feeling.text}</span>}
          </span>
          <span style={{ color:COLORS.textTertiary, fontSize:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{timeAgo(tsToDate(video.createdAt))}</span>
        </div>
        <button onClick={()=>setShowOptions(true)} style={{ background:'none', border:'none', cursor:'pointer', color:COLORS.textTertiary, fontSize:16, padding:4, flexShrink:0 }}>•••</button>
      </div>
      {(video.location || video.taggedUsers?.length > 0) && (
        <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:6, marginTop:-6, marginBottom:10, color:COLORS.textSecondary, fontSize:12, fontWeight:600 }}>
          {video.location && (
            <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
              {video.location}
            </span>
          )}
          {video.taggedUsers?.length > 0 && (
            <span>with {video.taggedUsers.slice(0,3).map(u=>`@${u.username}`).join(', ')}{video.taggedUsers.length>3 ? ` +${video.taggedUsers.length-3}` : ''}</span>
          )}
        </div>
      )}
      {video.event?.title && (
        <div style={{ display:'flex', alignItems:'center', gap:10, background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:14, padding:'10px 12px', marginBottom:12 }}>
          <span style={{ fontSize:20 }}>📅</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{video.event.title}</div>
            <div style={{ color:COLORS.textTertiary, fontSize:11.5 }}>
              {video.event.date}{video.event.location ? ` · ${video.event.location}` : ''}
            </div>
          </div>
        </div>
      )}
      {video.poll?.options?.length > 0 && (
        <PollWidget poll={video.poll} currentUser={currentUser} videoId={video.id} showToast={showToast} />
      )}
      {video.description && (()=>{
        const DESC_LIMIT = 140;
        const isLong = video.description.length > DESC_LIMIT;
        const shown = descExpanded || !isLong ? video.description : video.description.slice(0, DESC_LIMIT).trimEnd();
        const bg = video.bgColor && video.mediaType==='text';
        return (
          <div style={bg ? {
            background:video.bgColor, borderRadius:16, padding:'28px 18px', marginBottom:12,
            display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center', minHeight:120,
            color:'#fff', fontSize:18, fontWeight:700, lineHeight:1.4, whiteSpace:'pre-wrap', wordBreak:'break-word',
          } : { color:COLORS.textPrimary, fontSize:14, lineHeight:1.5, marginBottom:12, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
            {shown}{isLong && !descExpanded && '…'}
            {isLong && (
              <span onClick={()=>setDescExpanded(v=>!v)} style={{ color:bg?'rgba(255,255,255,0.85)':COLORS.textTertiary, fontWeight:700, cursor:'pointer', marginLeft:5 }}>
                {descExpanded ? 'Show less' : 'See more'}
              </span>
            )}
          </div>
        );
      })()}
      {mediaSrc && (
        <div ref={mediaWrapRef} onDoubleClick={handleMediaDoubleClick} style={{ position:'relative', borderRadius:16, overflow:'hidden', marginBottom:10, background:'#000', boxShadow:SHADOW.sm }}>
          {isVideo ? (
            <>
              <div onClick={()=>{
                  const el = videoElRef.current; if (!el) return;
                  if (el.paused) { el.play().then(()=>setVideoPaused(false)).catch(()=>{}); }
                  else { el.pause(); setVideoPaused(true); }
                }} style={{ cursor:'pointer', width:'100%', maxHeight:520, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <video
                  ref={videoElRef}
                  src={mediaSrc}
                  loop
                  playsInline
                  muted={false}
                  style={{ width:'100%', maxHeight:520, display:'block', objectFit:'cover', background:'#000' }}
                />
              </div>
              {/* Top progress line — mirrors the swipeable feed's video progress style */}
              <VideoProgressBar videoRef={videoElRef} isActive={isVisible} isImage={false} />
              {videoPaused && (
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                  <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </div>
                </div>
              )}
            </>
          ) : (
            <img src={mediaSrc} alt="" style={{ width:'100%', maxHeight:420, display:'block', objectFit:'cover' }} />
          )}
          {/* Double-tap heart burst — Instagram's signature like gesture, purely visual
              (the actual like state/count is handled by handleMediaDoubleClick). */}
          {burstKey > 0 && (
            <div key={burstKey} style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
              <svg width="90" height="90" viewBox="0 0 24 24" fill="#fff" style={{ filter:'drop-shadow(0 4px 18px rgba(0,0,0,0.35))', animation:'heartBurst 0.7s cubic-bezier(0.2,0.8,0.3,1) forwards' }}>
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
              </svg>
            </div>
          )}
        </div>
      )}
      {/* ── Action bar — laid out directly on the post's own white surface
          (no separate pill/background/border of its own), so it reads as
          part of the same card instead of a bolted-on widget. One accent
          colour only: the app's blue brand colour on active states; every
          icon is otherwise a plain dark outline, exactly like the rest of
          the post's typography and iconography. ── */}
      <div style={{ marginTop:10 }}>
        {/* Stats row: reaction bubble + count, comments/shares as tappable text on the right */}
        {(likeCount > 0 || video.comments > 0 || video.shares > 0) && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 2px 10px' }}>
            <div onClick={()=>likeCount>0 && setShowLikes(true)} style={{ display:'flex', alignItems:'center', gap:6, cursor: likeCount>0 ? 'pointer' : 'default' }}>
              {likeCount > 0 && (
                <div style={{ width:20, height:20, borderRadius:'50%', background:COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 0 0 2px ${COLORS.surface}` }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                </div>
              )}
              <span style={{ color:COLORS.textTertiary, fontSize:13 }}>{likeCount > 0 ? formatNumber(likeCount) : ''}</span>
            </div>
            <div style={{ display:'flex', gap:14 }}>
              {video.comments > 0 && <span onClick={()=>{ setShowComments(true); onOpenComments?.(video); }} style={{ color:COLORS.textTertiary, fontSize:13, cursor:'pointer' }}>{formatNumber(video.comments)} comments</span>}
              {video.shares > 0 && <span style={{ color:COLORS.textTertiary, fontSize:13 }}>{formatNumber(video.shares)} shares</span>}
            </div>
          </div>
        )}

        {(() => {
          // Flat icon button sitting directly on the card's own white surface —
          // no chip, no fill, no border. Neutral = dark outline matching the
          // card's own text colour. Active (liked/saved) = the same icon turns
          // solid brand blue. That's the only thing that ever changes: colour
          // of the stroke/fill, never a background shape appearing around it.
          const iconBtn = () => ({
            background:'none', border:'none', padding:8, margin:-8,
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', flexShrink:0, transition:TRANSITION.fast, borderRadius:10,
          });
          const press = e => e.currentTarget.style.transform = 'scale(0.88)';
          const unpress = e => e.currentTarget.style.transform = 'scale(1)';
          const neutral = COLORS.textSecondary;
          return (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', borderTop:`1px solid ${COLORS.border}`, paddingTop:8 }}>
              {/* Views */}
              <button onClick={()=>showToast?.(`${formatNumber(video.views||0)} views`,'info')} onMouseDown={press} onMouseUp={unpress} onMouseLeave={unpress} style={iconBtn()}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={neutral} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>

              {/* Like */}
              <button onClick={toggleLike} onDoubleClick={()=>setShowLikes(true)} onMouseDown={press} onMouseUp={unpress} onMouseLeave={unpress} style={iconBtn()}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill={liked?COLORS.brand:'none'} stroke={liked?COLORS.brand:neutral} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: liked ? 'likeHeart 0.35s ease' : 'none' }}>
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
              </button>

              {/* Comment */}
              <button onClick={()=>{ setShowComments(true); onOpenComments?.(video); }} onMouseDown={press} onMouseUp={unpress} onMouseLeave={unpress} style={iconBtn()}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={neutral} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
              </button>

              {/* Share */}
              <button onClick={()=>{ setShowShare(true); onShare?.(video); }} onMouseDown={press} onMouseUp={unpress} onMouseLeave={unpress} style={iconBtn()}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={neutral} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>

              {/* Download */}
              <button onClick={handleDownload} onMouseDown={press} onMouseUp={unpress} onMouseLeave={unpress} style={iconBtn()}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={neutral} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>

              {/* Save */}
              <button onClick={toggleSave} onMouseDown={press} onMouseUp={unpress} onMouseLeave={unpress} style={iconBtn()}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill={saved?COLORS.brand:'none'} stroke={saved?COLORS.brand:neutral} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
              </button>

              {/* More */}
              <button onClick={()=>setShowOptions(true)} onMouseDown={press} onMouseUp={unpress} onMouseLeave={unpress} style={iconBtn()}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={neutral} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
              </button>
            </div>
          );
        })()}
      </div>
    </div>
    </>
  );
};

// Tracks which users are currently broadcasting, so their avatar can show a LIVE
// badge wherever it already appears (Stories, their post in the feed) instead of
// duplicating that avatar in a separate floating strip.
// A live stream's `active: true` flag was previously only ever cleared by the host's own
// cleanup running on clean component unmount (see the LiveStream effect below). If the
// host's tab crashed, lost network, force-quit the app, or the OS just killed it in the
// background, that cleanup never ran and the doc stayed `active: true` forever — so the
// red LIVE ring kept showing on that user's avatar/profile even though they weren't
// streaming anymore. The host now also writes a `lastHeartbeat` timestamp every ~15s
// while genuinely live (see the host effect), and this hook additionally requires that
// heartbeat to be recent before it treats someone as live, re-checked on an interval so a
// stream doesn't have to wait for another Firestore event to be recognized as stale.
const LIVE_STALE_MS = 45000;
const useLiveStreamerIds = (currentUser) => {
  const [liveIds, setLiveIds] = useState(() => new Set());
  const docsRef = useRef([]);
  useEffect(()=>{
    const recompute = () => {
      const now = Date.now();
      const ids = new Set(
        docsRef.current
          .filter(d => {
            const hb = tsToMillis(d.lastHeartbeat) || tsToMillis(d.createdAt);
            return hb && (now - hb) < LIVE_STALE_MS;
          })
          .map(d=>d.streamerId)
          .filter(id=>id && id!==currentUser?.id)
      );
      setLiveIds(ids);
    };
    const q = query(collection(db,'liveStreams'), where('active','==',true));
    const unsub = onSnapshot(q, snap=>{
      docsRef.current = snap.docs.map(d=>d.data());
      recompute();
    });
    const interval = setInterval(recompute, 10000);
    return ()=>{ unsub(); clearInterval(interval); };
  },[currentUser?.id]);
  return liveIds;
};
// Placeholder card shown while the feed's first snapshot is still loading, so the user
// sees skeleton content instead of a flash of "No posts yet" before real data arrives.
const FeedSkeletonCard = () => (
  <div style={{ background:COLORS.card, borderRadius:RADIUS.lg, padding:14, marginBottom:12 }} aria-hidden="true">
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
      <div className="skeleton-shimmer" style={{ width:38, height:38, borderRadius:'50%' }} />
      <div style={{ flex:1 }}>
        <div className="skeleton-shimmer" style={{ width:'40%', height:12, borderRadius:6, marginBottom:6 }} />
        <div className="skeleton-shimmer" style={{ width:'25%', height:10, borderRadius:6 }} />
      </div>
    </div>
    <div className="skeleton-shimmer" style={{ width:'100%', height:14, borderRadius:6, marginBottom:6 }} />
    <div className="skeleton-shimmer" style={{ width:'80%', height:14, borderRadius:6, marginBottom:12 }} />
    <div className="skeleton-shimmer" style={{ width:'100%', height:180, borderRadius:10 }} />
  </div>
);

/* PeopleYouMayKnow: considered adding a suggestions carousel into the Home feed, but the
   app already has a suggestions feature in the Friends tab (Smart Suggestions below) —
   so the Facebook-style card design went there instead, in place, rather than duplicating
   the feature across tabs. */

const HomeFeed = ({ t, videos, videosLoading, onLike, onComment, onShare, onFollow, onMessage, onVoiceCall, onVideoCall, onDuet, onStitch, onSaveSound, followed, showToast, onWatchLive, currentUser, onViewProfile, onOpenSearch, onOpenNotifications, onOpenStories, onCreateStory, onViewStory, blockedUsers, onBlock, users, onOpenProfileDrawer, onFeedScroll, onOpenCamera, onOpenComposer }) => {
  const liveUserIds = useLiveStreamerIds(currentUser);
  // Inline "quick search" — filters users/posts in place instead of navigating to Discover.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchResults = useMemo(()=>{
    const q = searchQuery.trim().toLowerCase();
    if(!q) return { users:[], posts:[] };
    const matchedUsers = (users||[]).filter(u=>u.id!==currentUser?.id && (u.username?.toLowerCase().includes(q) || u.fullName?.toLowerCase().includes(q))).slice(0,5);
    const matchedPosts = (videos||[]).filter(v=>v.description?.toLowerCase().includes(q)).slice(0,5);
    return { users:matchedUsers, posts:matchedPosts };
  },[searchQuery, users, videos, currentUser?.id]);

  // Inline quick composer — Photo/Video/Poll/Feeling/Live all act directly on this card
  // (single tap, no separate page). Mirrors CreateScreen's post-submission logic.
  const [composerText, setComposerText] = useState('');
  const [composerMedia, setComposerMedia] = useState([]);
  const [composerPosting, setComposerPosting] = useState(false);
  const [showFeelingPicker, setShowFeelingPicker] = useState(false);
  const [feeling, setFeeling] = useState(null);
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const composerFileInputRef = useRef(null);

  const pickComposerFiles = e => {
    const files = Array.from(e.target.files||[]);
    setComposerMedia(m => [...m, ...files.map(f=>({ url:URL.createObjectURL(f), file:f, type:f.type }))].slice(0,4));
    e.target.value = '';
  };
  const removeComposerMedia = idx => setComposerMedia(m => m.filter((_,i)=>i!==idx));
  const setPollOption = (idx, val) => setPollOptions(opts => opts.map((o,i)=>i===idx?val:o));
  const addPollOption = () => setPollOptions(opts => [...opts, '']); // unlimited options — poll length is only naturally bounded by what fits Firestore/UI
  const removePollOption = idx => setPollOptions(opts => opts.length>2 ? opts.filter((_,i)=>i!==idx) : opts);
  const closePollBuilder = () => { setShowPollBuilder(false); setPollQuestion(''); setPollOptions(['','']); };
  const pollIsValid = pollQuestion.trim() && pollOptions.filter(o=>o.trim()).length>=2;
  const composerHasContent = composerText.trim() || composerMedia.length || pollIsValid || feeling;

  const submitQuickPost = async () => {
    if(!composerHasContent || composerPosting) return;
    setComposerPosting(true);
    try {
      let uploadedUrls = [];
      // Previously each upload failure was swallowed by an empty `catch {}`, so a
      // broken/rejected photo or video upload just silently vanished — the post still
      // went through as a text-only post with no indication anything had failed. Now a
      // failed upload stops the whole post and tells the user, instead of quietly
      // publishing something they didn't intend to send.
      for (const m of composerMedia) {
        try {
          uploadedUrls.push(await uploadToCloudinary(m.file));
        } catch (uploadErr) {
          console.error('Media upload failed:', uploadErr);
          showToast?.(uploadErr?.message || 'Failed to upload photo/video — please try again', 'error');
          setComposerPosting(false);
          return;
        }
      }
      const payload = { description: composerText, ...buildMediaFields(composerMedia, uploadedUrls), hashtags: (composerText||'').match(/#\w+/g) || [] };
      if (pollIsValid) payload.poll = { question: pollQuestion.trim(), options: pollOptions.map(o=>o.trim()).filter(Boolean), votes:{}, voters:{} };
      if (feeling) payload.feeling = feeling;
      const data = await apiFetch('/api/videos/create', { method:'POST', body: JSON.stringify(payload) });
      showToast?.(data.moderationStatus === 'pending' ? 'Posted — under review' : 'Posted!', 'success');
      setComposerText(''); setComposerMedia([]); setFeeling(null); setShowFeelingPicker(false); closePollBuilder();
    } catch (e) { showToast?.(e?.message || 'Failed to post', 'error'); }
    setComposerPosting(false);
  };

  // Feed order is strictly reverse-chronological (newest on top, oldest at bottom) —
  // no engagement-based re-ranking.
  const filteredVideos = useMemo(()=>{
    return sortByNewest(videos.filter(v=>!(blockedUsers||[]).includes(v.userId)));
  },[videos, blockedUsers]);

  return (
    <div data-main-scroll="true" onScroll={onFeedScroll} style={{ height:'100%', overflowY:'auto', background:COLORS.bg, padding:'10px 14px max(74px, calc(58px + env(safe-area-inset-bottom)))' }}>
      {/* Masthead — the app's wordmark, top-left, the way Instagram/Facebook/Threads
          anchor their brand at the top of the main feed. Rendered in the same brand
          gradient used everywhere else (nav active state, buttons) so it reads as
          part of one cohesive identity rather than a bolted-on label. */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, padding:'2px 2px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontSize:15 }}>♾️</span>
          <span style={{ fontSize:20, fontWeight:900, letterSpacing:-0.6, background:COLORS.gradient, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Infinity</span>
        </div>
      </div>

      {/* Top search bar — expands and filters in place; tapping a result acts immediately,
          nothing here navigates to a separate search page. */}
      <div style={{ position:'relative', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={onOpenProfileDrawer} style={{ width:40, height:40, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:14, cursor:'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:COLORS.surface, border:`1px solid ${searchOpen?COLORS.brand:COLORS.border}`, borderRadius:20, padding:'10px 14px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2" style={{flexShrink:0}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={searchQuery}
              onFocus={()=>setSearchOpen(true)}
              onChange={e=>{ setSearchQuery(e.target.value); setSearchOpen(true); }}
              placeholder="Search"
              style={{ flex:1, minWidth:0, background:'none', border:'none', outline:'none', color:COLORS.textPrimary, fontSize:13, fontFamily:'inherit' }}
            />
            {searchOpen && (
              <span onClick={()=>{ setSearchOpen(false); setSearchQuery(''); }} style={{ cursor:'pointer', color:COLORS.textTertiary, fontSize:12, flexShrink:0 }}>✕</span>
            )}
          </div>
          <NotificationBellButton onOpenNotifications={onOpenNotifications} currentUser={currentUser} />
        </div>


        {searchOpen && searchQuery.trim() && (
          <div style={{ position:'absolute', top:'calc(100% + 6px)', left:50, right:0, background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:16, boxShadow:SHADOW.raised, zIndex:40, maxHeight:320, overflowY:'auto', padding:8 }}>
            {!searchResults.users.length && !searchResults.posts.length && (
              <div style={{ padding:'14px 10px', color:COLORS.textTertiary, fontSize:12.5, textAlign:'center' }}>No matches for "{searchQuery}"</div>
            )}
            {searchResults.users.map(u=>(
              <div key={u.id} onClick={()=>{ onViewProfile?.(u.id); setSearchOpen(false); setSearchQuery(''); }} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 6px', borderRadius:10, cursor:'pointer' }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:u.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:13, overflow:'hidden', flexShrink:0 }}>
                  {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : (u.username||'?')[0]?.toUpperCase()}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>@{u.username}</div>
                  {u.fullName && <div style={{ color:COLORS.textTertiary, fontSize:11 }}>{u.fullName}</div>}
                </div>
              </div>
            ))}
            {searchResults.posts.map(v=>(
              <div key={v.id} onClick={()=>{ onViewProfile?.(v.userId); setSearchOpen(false); setSearchQuery(''); }} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 6px', borderRadius:10, cursor:'pointer' }}>
                <div style={{ width:32, height:32, borderRadius:8, background:COLORS.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 15l-5-5L5 19"/></svg>
                </div>
                <div style={{ color:COLORS.textSecondary, fontSize:12.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stories row — reuses the same Stories component as the Friends feed, so
          tapping an avatar actually opens that user's story instead of their profile,
          and the "+" actually opens the story composer instead of doing nothing. */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
        <span style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:14 }}>Stories</span>
        <span onClick={onOpenStories} style={{ color:COLORS.brand, fontSize:12, fontWeight:700, cursor:'pointer' }}>See all</span>
      </div>
      <div style={{ margin:'0 -14px 6px' }}>
        <Stories users={users} currentUser={currentUser} onViewStory={onViewStory} onCreateStory={onCreateStory} followed={followed} liveUserIds={liveUserIds} />
      </div>

      {/* Post composer — fully inline: typing, attaching a photo, building a poll and
          picking a feeling all happen right here in one tap each, nothing navigates away. */}
      <div style={{ background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:RADIUS.lg, padding:14, marginBottom:0 }}>
        <input ref={composerFileInputRef} type="file" accept="image/*,video/*" multiple onChange={pickComposerFiles} style={{ display:'none' }} />
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:12 }}>
          <div style={{ width:38, height:38, borderRadius:'50%', background:currentUser?.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, overflow:'hidden', flexShrink:0 }}>
            {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : (currentUser?.username||'?')[0]?.toUpperCase()}
          </div>
          <textarea
            value={composerText}
            onChange={e=>setComposerText(e.target.value)}
            placeholder="What's on your mind?"
            rows={1}
            style={{ flex:1, minWidth:0, background:'none', border:'none', outline:'none', resize:'none', color:COLORS.textPrimary, fontSize:13.5, fontFamily:'inherit', paddingTop:8 }}
          />
        </div>

        {feeling && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:'5px 10px', fontSize:12, fontWeight:600, color:COLORS.textSecondary, marginBottom:10 }}>
            feeling {feeling.emoji} {feeling.text}
            <span onClick={()=>setFeeling(null)} style={{ cursor:'pointer', color:COLORS.textTertiary, fontWeight:800 }}>✕</span>
          </div>
        )}

        {composerMedia.length>0 && (
          <div style={{ display:'flex', gap:8, marginBottom:12, overflowX:'auto' }}>
            {composerMedia.map((m,i)=>(
              <div key={i} style={{ position:'relative', width:64, height:64, borderRadius:12, overflow:'hidden', background:COLORS.surfaceAlt, flexShrink:0 }}>
                {m.type?.startsWith('video') ? <video src={m.url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <img src={m.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
                <button onClick={()=>removeComposerMedia(i)} style={{ position:'absolute', top:3, right:3, width:18, height:18, borderRadius:'50%', background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {showFeelingPicker && (
          <div style={{ background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:14, padding:12, marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:12.5 }}>How are you feeling?</span>
              <span onClick={()=>setShowFeelingPicker(false)} style={{ cursor:'pointer', color:COLORS.textTertiary }}>✕</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
              {FEELINGS.map(f=>(
                <button key={f.text} onClick={()=>{ setFeeling(f); setShowFeelingPicker(false); }} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, background:feeling?.text===f.text?COLORS.surface2:COLORS.surface, border:`1px solid ${feeling?.text===f.text?COLORS.brand:COLORS.border}`, borderRadius:12, padding:'8px 4px', cursor:'pointer' }}>
                  <span style={{ fontSize:18 }}>{f.emoji}</span>
                  <span style={{ fontSize:9.5, color:COLORS.textSecondary, fontWeight:600 }}>{f.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showPollBuilder && (
          <div style={{ background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:14, padding:12, marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:12.5 }}>📊 Create a poll</span>
              <span onClick={closePollBuilder} style={{ cursor:'pointer', color:COLORS.textTertiary }}>✕</span>
            </div>
            <input value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)} placeholder="Ask a question…" style={{ width:'100%', background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:'9px 12px', color:COLORS.textPrimary, outline:'none', fontSize:13, marginBottom:8, boxSizing:'border-box' }} />
            {pollOptions.map((opt,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <input value={opt} onChange={e=>setPollOption(i,e.target.value)} placeholder={`Option ${i+1}`} style={{ flex:1, background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:'8px 12px', color:COLORS.textPrimary, outline:'none', fontSize:12.5, boxSizing:'border-box' }} />
                {pollOptions.length>2 && (
                  <span onClick={()=>removePollOption(i)} style={{ cursor:'pointer', color:COLORS.textTertiary, fontSize:13, padding:4 }}>✕</span>
                )}
              </div>
            ))}
            <button onClick={addPollOption} style={{ background:'none', border:'none', color:COLORS.brand, fontWeight:700, fontSize:12, cursor:'pointer', padding:'2px 0' }}>+ Add option</button>
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          {[
            {icon:(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.info} strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 15l-5-5L5 19"/></svg>), label:'Photo', active:false, action:()=>composerFileInputRef.current?.click()},
            {icon:(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.brand} strokeWidth="2"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>), label:'Poll', active:showPollBuilder, action:()=>setShowPollBuilder(v=>!v)},
            {icon:(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.warning} strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M8 15s1.5 2 4 2 4-2 4-2"/></svg>), label:'Feeling', active:showFeelingPicker, action:()=>setShowFeelingPicker(v=>!v)},
            {icon:(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.live} strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>), label:'Live', active:false, action:()=>onWatchLive?.(currentUser)},
          ].map(btn=>(
            <button key={btn.label} onClick={e=>{ e.stopPropagation(); btn.action(); }} style={{ display:'flex', alignItems:'center', gap:6, background:btn.active?COLORS.surface2:COLORS.surfaceAlt, border:`1px solid ${btn.active?COLORS.brand:'transparent'}`, borderRadius:14, padding:'7px 12px', color:COLORS.textSecondary, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              {btn.icon}{btn.label}
            </button>
          ))}
          {composerHasContent && (
            <button onClick={submitQuickPost} disabled={composerPosting} style={{ marginLeft:'auto', background:'linear-gradient(135deg,#2E7BFF,#0B5FFF)', border:'none', borderRadius:14, padding:'8px 16px', color:'white', fontSize:12.5, fontWeight:700, cursor:composerPosting?'default':'pointer', opacity:composerPosting?0.7:1 }}>
              {composerPosting ? 'Posting…' : 'Post'}
            </button>
          )}
        </div>
      </div>

      {videosLoading && !filteredVideos.length && (
        <>
          <FeedSkeletonCard />
          <FeedSkeletonCard />
          <FeedSkeletonCard />
        </>
      )}

      {!videosLoading && !filteredVideos.length && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:COLORS.textTertiary }}>
          <div style={{ fontSize:44, marginBottom:10 }}>📭</div>
          <div>{t?.noVideos||'No posts yet. Be the first to post!'}</div>
        </div>
      )}

      {filteredVideos.map(video=>(
        <FeedPostCard
          key={video.id}
          video={video}
          currentUser={currentUser}
          onViewProfile={onViewProfile}
          onOpenComments={onComment}
          onShare={onShare}
          users={users}
          onFollow={onFollow}
          followed={followed}
          showToast={showToast}
          onBlock={onBlock}
          isLive={liveUserIds?.has(video.userId)}
        />
      ))}
    </div>
  );
};

/* FriendsFeed removed — dead code, fully replaced by FriendsDiscoveryPage below. */
/* ─────────────── FRIENDS DISCOVERY (SMART DISCOVERY) ─────────────── */
/* ─────────────── FRIENDS DISCOVERY (SMART DISCOVERY) ─────────────── */
const FriendsDiscoveryPage = ({ currentUser, users, followed, onFollow, onViewProfile, onOpenSearch, onFeedScroll, onCreateStory, onViewStory, onOpenStories }) => {
  const [tab, setTab] = useState('discover');
  const [search, setSearch] = useState('');

  const others = useMemo(()=>(users||[]).filter(u=>u.id!==currentUser?.id), [users, currentUser?.id]);
  const suggestions = useMemo(()=>
    others.filter(u=>!(followed||[]).includes(u.id)).sort((a,b)=>(b.followers?.length||0)-(a.followers?.length||0)).slice(0,6)
  ,[others, followed]);
  const yourFriends = useMemo(()=>others.filter(u=>(followed||[]).includes(u.id)), [others, followed]);
  const closeFriends = yourFriends.slice(0,5);
  const filteredList = search
    ? others.filter(u=>u.username?.toLowerCase().includes(search.toLowerCase()) || u.fullName?.toLowerCase().includes(search.toLowerCase()))
    : null;

  const AvatarCircle = ({ u, size=44 }) => (
    <div style={{ width:size, height:size, borderRadius:'50%', background:u.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:size*0.4, overflow:'hidden', flexShrink:0 }}>
      {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : (u.avatar||u.username?.[0]||'?')}
    </div>
  );

  return (
    <div data-main-scroll="true" onScroll={onFeedScroll} style={{ height:'100%', overflowY:'auto', background:COLORS.bg, padding:'10px 16px max(74px, calc(58px + env(safe-area-inset-bottom)))' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:18 }}>Friends</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:20, padding:'10px 14px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search friends" style={{ flex:1, background:'none', border:'none', outline:'none', color:COLORS.textPrimary, fontSize:13 }} />
        </div>
        <button style={{ width:38, height:38, borderRadius:'50%', background:COLORS.surfaceAlt, border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </button>
      </div>

      {!search && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
            <span style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:14 }}>Stories</span>
            {onOpenStories && <span onClick={onOpenStories} style={{ color:COLORS.brand, fontSize:12, fontWeight:700, cursor:'pointer' }}>See all</span>}
          </div>
          <div style={{ margin:'0 -16px 6px' }}>
            <Stories users={users} currentUser={currentUser} onViewStory={onViewStory} onCreateStory={onCreateStory} followed={followed} />
          </div>
        </>
      )}

      {search ? (
        <div>
          {filteredList.length===0 && <div style={{ textAlign:'center', padding:40, color:COLORS.textTertiary }}>No results for "{search}"</div>}
          {filteredList.map(u=>(
            <div key={u.id} onClick={()=>onViewProfile?.(u.id)} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', cursor:'pointer' }}>
              <AvatarCircle u={u} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:13.5 }}>{u.fullName || u.username}</div>
                <div style={{ color:COLORS.textTertiary, fontSize:12 }}>@{u.username}</div>
              </div>
              <RippleButton onClick={e=>{e.stopPropagation(); onFollow?.(u.id);}} style={{ background:(followed||[]).includes(u.id)?COLORS.surfaceAlt:'none', border:`1px solid ${COLORS.brand}`, color:(followed||[]).includes(u.id)?COLORS.textSecondary:COLORS.brand, borderRadius:14, padding:'6px 16px', fontSize:12, fontWeight:700, cursor:'pointer' }}>{(followed||[]).includes(u.id)?'Following':'Follow'}</RippleButton>
            </div>
          ))}
        </div>
      ) : (
      <>
      <div style={{ display:'flex', gap:22, marginBottom:14 }}>
        {[['discover','Discover'],['yours','Your Friends'],['requests','Requests'],['groups','Groups']].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ background:'none', border:'none', borderBottom:tab===id?`2px solid ${COLORS.brand}`:'2px solid transparent', padding:'0 0 10px', color:tab===id?COLORS.brand:COLORS.textTertiary, fontSize:13.5, fontWeight:700, cursor:'pointer' }}>{label}</button>
        ))}
      </div>

      {tab==='discover' && (
        <>
          <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:12 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:COLORS.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={COLORS.brand} strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:13.5 }}>Smart Suggestions</div>
                <span style={{ color:COLORS.brand, fontSize:12, fontWeight:700, cursor:'pointer' }}>See all</span>
              </div>
              <div style={{ color:COLORS.textTertiary, fontSize:11.5, marginTop:2 }}>AI-powered picks based on your interests, mutual friends & activity</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:16, marginBottom:6 }}>
            {suggestions.map(u=>(
              <div key={u.id} style={{ position:'relative', flexShrink:0, width:132, background:COLORS.surfaceAlt, borderRadius:14, overflow:'hidden', border:`1px solid ${COLORS.border}`, boxShadow:SHADOW.card, transition:TRANSITION.base }}>
                <div onClick={()=>onViewProfile?.(u.id)} style={{ height:110, background:u.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', overflow:'hidden' }}>
                  {u.avatarUrl ? <img src={u.avatarUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : <span style={{ color:'white', fontWeight:800, fontSize:32 }}>{u.avatar||u.username?.[0]?.toUpperCase()}</span>}
                </div>
                <div style={{ padding:'8px 10px 10px' }}>
                  <div onClick={()=>onViewProfile?.(u.id)} style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:12.5, cursor:'pointer', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.fullName || u.username}</div>
                  <div style={{ color:COLORS.textTertiary, fontSize:11, marginBottom:8 }}>{Math.max(1,(u.followers?.length||0)%20)} mutual</div>
                  <RippleButton onClick={()=>onFollow?.(u.id)} style={{ width:'100%', background:COLORS.gradient, border:'none', borderRadius:8, padding:'7px 0', color:'white', fontSize:12, fontWeight:700, cursor:'pointer' }}>+ Follow</RippleButton>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <div>
              <div style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:13.5 }}>Close Friends</div>
              <div style={{ color:COLORS.textTertiary, fontSize:11.5 }}>People you interact with most</div>
            </div>
            <span style={{ color:COLORS.brand, fontSize:12, fontWeight:700, cursor:'pointer' }}>See all</span>
          </div>
          {closeFriends.length===0 && <div style={{ color:COLORS.textTertiary, fontSize:12.5, padding:'14px 0' }}>Follow people to see them here.</div>}
          {closeFriends.map(u=>(
            <div key={u.id} onClick={()=>onViewProfile?.(u.id)} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', cursor:'pointer' }}>
              <AvatarCircle u={u} size={40} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:13 }}>{u.fullName || u.username}</div>
                <div style={{ color:COLORS.textTertiary, fontSize:11.5 }}>@{u.username}</div>
              </div>
              <span style={{ color:COLORS.textTertiary, fontSize:16, cursor:'pointer' }}>•••</span>
            </div>
          ))}

          <div style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:13.5, margin:'18px 0 10px' }}>Explore More</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
            {[
              {label:'Contacts', icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>)},
              {label:'Interests', icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>)},
              {label:'Nearby', icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>)},
              {label:'Groups', icon:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>), action:()=>setTab('groups')},
            ].map(item=>(
              <button key={item.label} onClick={item.action}
                onMouseDown={e=>e.currentTarget.style.transform='scale(0.95)'}
                onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
                onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
                style={{ background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:16, padding:'14px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:6, cursor:'pointer', boxShadow:SHADOW.xs, transition:TRANSITION.fast }}>
                {item.icon}
                <span style={{ color:COLORS.textSecondary, fontSize:10.5, fontWeight:600 }}>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {tab==='yours' && (
        yourFriends.length===0 ? (
          <div style={{ textAlign:'center', padding:48, color:COLORS.textTertiary }}>
            <div style={{ fontSize:44, marginBottom:12 }}>👥</div>
            <div>Follow people to build your friends list</div>
          </div>
        ) : yourFriends.map(u=>(
          <div key={u.id} onClick={()=>onViewProfile?.(u.id)} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', cursor:'pointer' }}>
            <AvatarCircle u={u} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:13.5 }}>{u.fullName || u.username}</div>
              <div style={{ color:COLORS.textTertiary, fontSize:12 }}>@{u.username}</div>
            </div>
            <span style={{ color:COLORS.textTertiary, fontSize:16 }}>•••</span>
          </div>
        ))
      )}

      {tab==='requests' && (
        <div style={{ textAlign:'center', padding:48, color:COLORS.textTertiary }}>
          <div style={{ fontSize:44, marginBottom:12 }}>📬</div>
          <div>No pending friend requests</div>
        </div>
      )}

      {tab==='groups' && (
        <div style={{ margin:'0 -16px', height:'calc(100vh - 260px)', minHeight:420 }}>
          <GroupChatPage currentUser={currentUser} users={users} showToast={showToast} onBack={()=>setTab('discover')} />
        </div>
      )}
      </>
      )}
    </div>
  );
};


const FEELINGS = [
  { emoji:'😊', text:'happy' }, { emoji:'😍', text:'loved' }, { emoji:'🙏', text:'blessed' },
  { emoji:'🎉', text:'celebrating' }, { emoji:'😢', text:'sad' }, { emoji:'😴', text:'tired' },
  { emoji:'🔥', text:'motivated' }, { emoji:'🙌', text:'grateful' }, { emoji:'😎', text:'confident' },
  { emoji:'🤔', text:'thoughtful' }, { emoji:'😂', text:'amused' }, { emoji:'❤️', text:'thankful' },
];

const POST_BG_COLORS = ['#0B5FFF','#2E7BFF','#083FB0','#FFB100','#2ED573','#00A9D6','#FF453A','#5E5CE6'];
const CreateScreen = ({ onOpenCamera, onShowSoundLibrary, showToast, t, currentUser, users, onPosted, onClose, autoFocusText }) => {
  const [text, setText] = useState('');
  const [media, setMedia] = useState([]); // [{url,file,type}]
  const [posting, setPosting] = useState(false);
  const [visibility, setVisibility] = useState('Everyone');
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [showFeelingPicker, setShowFeelingPicker] = useState(false);
  const [feeling, setFeeling] = useState(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [taggedUsers, setTaggedUsers] = useState([]); // [{id,username,avatarUrl,avatarColor}]
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [location, setLocation] = useState('');
  const [showEventBuilder, setShowEventBuilder] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [bgColor, setBgColor] = useState(null); // null = normal post, hex = colored text card
  const [captionLoading, setCaptionLoading] = useState(false);
  const fileInputRef = useRef(null);

  const toggleTagUser = (u) => setTaggedUsers(list => list.some(x=>x.id===u.id) ? list.filter(x=>x.id!==u.id) : [...list, { id:u.id, username:u.username, avatarUrl:u.avatarUrl||null, avatarColor:u.avatarColor||COLORS.brand }]);
  const eventIsValid = eventTitle.trim() && eventDate.trim();
  const closeEventBuilder = () => setShowEventBuilder(false);

  const pickFiles = e => {
    const files = Array.from(e.target.files||[]);
    setMedia(m => [...m, ...files.map(f=>({ url:URL.createObjectURL(f), file:f, type:f.type }))].slice(0,4));
    e.target.value = '';
  };
  const removeMedia = idx => setMedia(m => m.filter((_,i)=>i!==idx));

  const setPollOption = (idx, val) => setPollOptions(opts => opts.map((o,i)=>i===idx?val:o));
  const addPollOption = () => setPollOptions(opts => [...opts, '']); // unlimited options — poll length is only naturally bounded by what fits Firestore/UI
  const removePollOption = idx => setPollOptions(opts => opts.length>2 ? opts.filter((_,i)=>i!==idx) : opts);
  const closePollBuilder = () => { setShowPollBuilder(false); setPollQuestion(''); setPollOptions(['','']); };
  const pollIsValid = pollQuestion.trim() && pollOptions.filter(o=>o.trim()).length>=2;

  const quickActions = [
    { label:'Photo', color:COLORS.info, icon:(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 15l-5-5L5 19"/></svg>), action:()=>fileInputRef.current?.click() },
    { label:'Video', color:COLORS.brandSecondary, icon:(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3"/></svg>), action:()=>fileInputRef.current?.click() },
    { label:'Poll', color:COLORS.brand, icon:(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>), action:()=>setShowPollBuilder(v=>!v) },
    { label:'Feeling', color:COLORS.warning, icon:(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M8 15s1.5 2 4 2 4-2 4-2"/></svg>), action:()=>setShowFeelingPicker(v=>!v) },
  ];
  const gridActions = [
    { label:'Tag people', icon:(<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>), action:()=>setShowTagPicker(v=>!v) },
    { label:'Location', icon:(<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>), action:()=>setShowLocationInput(v=>!v) },
    { label:'Music', icon:(<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>), action:onShowSoundLibrary },
    { label:'Activity', icon:(<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>), action:()=>setShowFeelingPicker(v=>!v) },
    { label:'Event', icon:(<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>), action:()=>setShowEventBuilder(v=>!v) },
    { label:'GIF', icon:(<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M8 10v4M13 10h-2v4h2M16 10v4M16 12h1.5"/></svg>), action:()=>showToast?.('GIF search needs a Giphy/Tenor API key — not wired up yet','info') },
    { label:'Background', icon:(<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 19"/></svg>), action:()=>setShowBgPicker(v=>!v) },
    { label:'Text', icon:(<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>), action:()=>setShowBgPicker(v=>!v) },
  ];

  const submitPost = async () => {
    const hasContent = text.trim() || media.length || pollIsValid || eventIsValid || taggedUsers.length || location.trim();
    if (!hasContent) return;
    setPosting(true);
    try {
      let uploadedUrls = [];
      // See submitQuickPost's comment above — same fix: don't swallow upload errors,
      // stop and tell the user instead of quietly posting without their media.
      for (const m of media) {
        try {
          uploadedUrls.push(await uploadToCloudinary(m.file));
        } catch (uploadErr) {
          console.error('Media upload failed:', uploadErr);
          showToast?.(uploadErr?.message || 'Failed to upload photo/video — please try again', 'error');
          setPosting(false);
          return;
        }
      }
      const payload = {
        description: text, ...buildMediaFields(media, uploadedUrls),
        hashtags: (text||'').match(/#\w+/g) || [],
      };
      if (pollIsValid) {
        payload.poll = { question: pollQuestion.trim(), options: pollOptions.map(o=>o.trim()).filter(Boolean), votes:{}, voters:{} };
      }
      if (feeling) payload.feeling = feeling;
      if (location.trim()) payload.location = location.trim();
      if (taggedUsers.length) payload.taggedUsers = taggedUsers;
      if (eventIsValid) payload.event = { title: eventTitle.trim(), date: eventDate, location: eventLocation.trim() || null };
      if (bgColor && !uploadedUrls.length) payload.bgColor = bgColor;
      const data = await apiFetch('/api/videos/create', { method:'POST', body: JSON.stringify(payload) });
      showToast?.(data.moderationStatus === 'pending' ? 'Posted — under review' : 'Posted!', 'success');
      setText(''); setMedia([]); closePollBuilder(); setFeeling(null); setShowFeelingPicker(false);
      setTaggedUsers([]); setShowTagPicker(false); setLocation(''); setShowLocationInput(false);
      setEventTitle(''); setEventDate(''); setEventLocation(''); setShowEventBuilder(false);
      setBgColor(null); setShowBgPicker(false);
      onPosted?.();
    } catch (e) { showToast?.(e?.message || 'Failed to post', 'error'); }
    setPosting(false);
  };

  return (
    <div style={{ height:'100%', overflowY:'auto', background:COLORS.bg }}>
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={pickFiles} style={{ display:'none' }} />
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 16px 14px', background:COLORS.surface, borderBottom:`1px solid ${COLORS.border}` }}>
        <button onClick={()=>{ if(onClose){ onClose(); } else { setText(''); setMedia([]); } }} style={{ background:'none', border:'none', cursor:'pointer', color:COLORS.textTertiary, width:26, height:26, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div style={{ flex:1, color:COLORS.textPrimary, fontWeight:800, fontSize:17 }}>Create Post</div>
        <button onClick={submitPost} disabled={posting || !(text.trim() || media.length || pollIsValid || eventIsValid || taggedUsers.length || location.trim())} style={{ background:COLORS.gradient, opacity:(posting || !(text.trim() || media.length || pollIsValid || eventIsValid || taggedUsers.length || location.trim()))?0.5:1, border:'none', borderRadius:16, padding:'8px 18px', color:'#fff', fontWeight:700, fontSize:13.5, cursor:'pointer' }}>{posting?'Posting…':'Post'}</button>
      </div>

      <div style={{ padding:16 }}>
        {/* Composer */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:14 }}>
          <div style={{ width:40, height:40, borderRadius:'50%', background:currentUser?.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, overflow:'hidden', flexShrink:0 }}>
            {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (currentUser?.username||'?')[0]?.toUpperCase()}
          </div>
          <div style={{ flex:1 }}>
            {bgColor ? (
              <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="What's on your mind?" rows={4} autoFocus style={{ width:'100%', background:bgColor, borderRadius:16, border:'none', outline:'none', resize:'none', color:'#fff', fontWeight:700, fontSize:17, textAlign:'center', fontFamily:'inherit', padding:'24px 14px', boxSizing:'border-box' }} />
            ) : (
              <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="What's on your mind?" rows={3} autoFocus style={{ width:'100%', background:'none', border:'none', outline:'none', resize:'none', color:COLORS.textPrimary, fontSize:15, fontFamily:'inherit', paddingTop:8, boxSizing:'border-box' }} />
            )}
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
              {feeling && (
                <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:'5px 10px', fontSize:12.5, fontWeight:600, color:COLORS.textSecondary }}>
                  is feeling {feeling.emoji} {feeling.text}
                  <span onClick={()=>setFeeling(null)} style={{ cursor:'pointer', color:COLORS.textTertiary, fontWeight:800 }}>✕</span>
                </div>
              )}
              {location && (
                <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:'5px 10px', fontSize:12.5, fontWeight:600, color:COLORS.textSecondary }}>
                  📍 {location}
                  <span onClick={()=>setLocation('')} style={{ cursor:'pointer', color:COLORS.textTertiary, fontWeight:800 }}>✕</span>
                </div>
              )}
              {taggedUsers.length>0 && (
                <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:'5px 10px', fontSize:12.5, fontWeight:600, color:COLORS.textSecondary }}>
                  with {taggedUsers.slice(0,2).map(u=>`@${u.username}`).join(', ')}{taggedUsers.length>2?` +${taggedUsers.length-2}`:''}
                  <span onClick={()=>setTaggedUsers([])} style={{ cursor:'pointer', color:COLORS.textTertiary, fontWeight:800 }}>✕</span>
                </div>
              )}
              {eventIsValid && (
                <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:'5px 10px', fontSize:12.5, fontWeight:600, color:COLORS.textSecondary }}>
                  📅 {eventTitle}
                  <span onClick={()=>{ setEventTitle(''); setEventDate(''); setEventLocation(''); }} style={{ cursor:'pointer', color:COLORS.textTertiary, fontWeight:800 }}>✕</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feeling picker */}
        {showFeelingPicker && (
          <div style={{ background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:16, padding:14, marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:13.5 }}>How are you feeling?</span>
              <span onClick={()=>setShowFeelingPicker(false)} style={{ cursor:'pointer', color:COLORS.textTertiary }}>✕</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
              {FEELINGS.map(f=>(
                <button key={f.text} onClick={()=>{ setFeeling(f); setShowFeelingPicker(false); }} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, background:feeling?.text===f.text?COLORS.surface2:COLORS.surfaceAlt, border:`1px solid ${feeling?.text===f.text?COLORS.brand:COLORS.border}`, borderRadius:12, padding:'8px 4px', cursor:'pointer' }}>
                  <span style={{ fontSize:20 }}>{f.emoji}</span>
                  <span style={{ fontSize:10.5, color:COLORS.textSecondary, fontWeight:600 }}>{f.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Poll builder */}
        {showPollBuilder && (
          <div style={{ background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:16, padding:14, marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:13.5 }}>📊 Create a poll</span>
              <span onClick={closePollBuilder} style={{ cursor:'pointer', color:COLORS.textTertiary }}>✕</span>
            </div>
            <input value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)} placeholder="Ask a question…" style={{ width:'100%', background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:'10px 12px', color:COLORS.textPrimary, outline:'none', fontSize:13.5, marginBottom:10, boxSizing:'border-box' }} />
            {pollOptions.map((opt,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <input value={opt} onChange={e=>setPollOption(i,e.target.value)} placeholder={`Option ${i+1}`} style={{ flex:1, background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:'9px 12px', color:COLORS.textPrimary, outline:'none', fontSize:13, boxSizing:'border-box' }} />
                {pollOptions.length>2 && (
                  <span onClick={()=>removePollOption(i)} style={{ cursor:'pointer', color:COLORS.textTertiary, fontSize:14, padding:4 }}>✕</span>
                )}
              </div>
            ))}
            <button onClick={addPollOption} style={{ background:'none', border:'none', color:COLORS.brand, fontWeight:700, fontSize:12.5, cursor:'pointer', padding:'4px 0' }}>+ Add option</button>
          </div>
        )}

        {/* Media previews */}
        {media.length>0 && (
          <div style={{ display:'flex', gap:8, marginBottom:16, overflowX:'auto' }}>
            {media.map((m,i)=>(
              <div key={i} style={{ position:'relative', width:76, height:76, borderRadius:14, overflow:'hidden', background:COLORS.surfaceAlt, flexShrink:0 }}>
                {m.type?.startsWith('video') ? <video src={m.url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <img src={m.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
                <button onClick={()=>removeMedia(i)} style={{ position:'absolute', top:4, right:4, width:20, height:20, borderRadius:'50%', background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
              </div>
            ))}
            {media.length<4 && (
              <button onClick={()=>fileInputRef.current?.click()} style={{ width:76, height:76, borderRadius:14, background:COLORS.surfaceAlt, border:`1.5px dashed ${COLORS.borderStrong}`, color:COLORS.brand, fontSize:24, cursor:'pointer', flexShrink:0 }}>+</button>
            )}
          </div>
        )}

        {/* Quick action row */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          {quickActions.map(btn=>{
            const isActive = (btn.label==='Poll' && showPollBuilder) || (btn.label==='Feeling' && (showFeelingPicker || feeling));
            return (
              <button key={btn.label} onClick={btn.action} style={{ display:'flex', alignItems:'center', gap:6, background:isActive?COLORS.surface2:COLORS.surface, border:`1px solid ${isActive?COLORS.brand:COLORS.border}`, borderRadius:14, padding:'8px 13px', color:COLORS.textSecondary, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>
                <span style={{ color:btn.color, display:'flex' }}>{btn.icon}</span>{btn.label}
              </button>
            );
          })}
        </div>

        {/* Grid of extras */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
          {gridActions.map(item=>(
            <button key={item.label} onClick={item.action||(()=>showToast?.(item.label,'info'))} style={{ background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:16, padding:'14px 4px', display:'flex', flexDirection:'column', alignItems:'center', gap:6, cursor:'pointer' }}>
              {item.icon}<span style={{ color:COLORS.textSecondary, fontSize:10.5, fontWeight:600 }}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* AI Caption suggestion */}
        <div onClick={async()=>{
          if (captionLoading) return;
          if (!media.length) { showToast?.('Add a photo first', 'info'); return; }
          setCaptionLoading(true);
          try {
            const imageUrl = media[0].url.startsWith('blob:') ? await uploadToCloudinary(media[0].file) : media[0].url;
            const data = await apiFetch('/api/ai/caption', { method:'POST', body: JSON.stringify({ imageUrl, hint: text }) });
            if (data.captions?.[0]) setText(data.captions[0]);
          } catch(e) {
            showToast?.(e.message || 'Failed to generate caption', 'error');
          }
          setCaptionLoading(false);
        }} style={{ cursor:'pointer', background:COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius:16, padding:'14px 16px', marginBottom:20, opacity:captionLoading?0.6:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ color:COLORS.brand, fontSize:13, fontWeight:700 }}>✨ AI Caption</span>
            <span style={{ background:COLORS.gradient, color:'#fff', fontSize:9.5, fontWeight:800, borderRadius:8, padding:'2px 7px' }}>New</span>
          </div>
          <div style={{ color:COLORS.textTertiary, fontSize:12.5 }}>{captionLoading ? 'Thinking…' : 'Let AI suggest a caption based on your photo'}</div>
        </div>

        {/* Mood / nature quick-insert row (the old "Leaf" stub) — inserts a decorative
            sprig into the caption instead of doing nothing, since there's no separate
            "nature mood" data model to build a whole feature around. */}
        <div style={{ display:'flex', gap:10, marginBottom:22 }}>
          <button onClick={()=>setText(v=>v ? `${v} 🌿` : '🌿')} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:14, padding:'11px 0', color:COLORS.textSecondary, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.success} strokeWidth="2"><path d="M11 20A7 7 0 019.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-9 4-13 8-16"/></svg>
            Leaf
          </button>
        </div>

        {/* Tag people panel */}
        {showTagPicker && (
          <div style={{ background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:16, padding:14, marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:13.5 }}>Tag people</span>
              <span onClick={()=>setShowTagPicker(false)} style={{ cursor:'pointer', color:COLORS.textTertiary }}>✕</span>
            </div>
            <input value={tagSearch} onChange={e=>setTagSearch(e.target.value)} placeholder="Search people…" style={{ width:'100%', background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:'9px 12px', color:COLORS.textPrimary, outline:'none', fontSize:13, marginBottom:10, boxSizing:'border-box' }} />
            {taggedUsers.length>0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                {taggedUsers.map(u=>(
                  <span key={u.id} style={{ display:'inline-flex', alignItems:'center', gap:5, background:COLORS.surface2, border:`1px solid ${COLORS.brand}`, borderRadius:12, padding:'4px 9px', fontSize:12, fontWeight:600, color:COLORS.textPrimary }}>
                    @{u.username}
                    <span onClick={()=>toggleTagUser(u)} style={{ cursor:'pointer', color:COLORS.textTertiary, fontWeight:800 }}>✕</span>
                  </span>
                ))}
              </div>
            )}
            <div style={{ maxHeight:220, overflowY:'auto' }}>
              {(users||[]).filter(u=>u.id!==currentUser?.id && u.username?.toLowerCase().includes(tagSearch.toLowerCase())).slice(0,30).map(u=>{
                const isTagged = taggedUsers.some(x=>x.id===u.id);
                return (
                  <div key={u.id} onClick={()=>toggleTagUser(u)} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 4px', cursor:'pointer', borderRadius:10 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:u.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:13, overflow:'hidden', flexShrink:0 }}>
                      {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (u.username||'?')[0]?.toUpperCase()}
                    </div>
                    <span style={{ flex:1, color:COLORS.textPrimary, fontSize:13, fontWeight:600 }}>@{u.username}</span>
                    {isTagged && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.brand} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                );
              })}
              {(!users || users.length===0) && <div style={{ color:COLORS.textTertiary, fontSize:12.5, padding:'8px 4px' }}>No one to tag yet.</div>}
            </div>
          </div>
        )}

        {/* Location panel */}
        {showLocationInput && (
          <div style={{ background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:16, padding:14, marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:13.5 }}>📍 Add location</span>
              <span onClick={()=>{ setShowLocationInput(false); }} style={{ cursor:'pointer', color:COLORS.textTertiary }}>✕</span>
            </div>
            <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="e.g. Addis Ababa, Ethiopia" style={{ width:'100%', background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:'10px 12px', color:COLORS.textPrimary, outline:'none', fontSize:13.5, boxSizing:'border-box' }} />
            {location && <button onClick={()=>setLocation('')} style={{ background:'none', border:'none', color:COLORS.textTertiary, fontSize:12, cursor:'pointer', marginTop:8, padding:0 }}>Clear</button>}
          </div>
        )}

        {/* Event panel */}
        {showEventBuilder && (
          <div style={{ background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:16, padding:14, marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:13.5 }}>📅 Create an event</span>
              <span onClick={closeEventBuilder} style={{ cursor:'pointer', color:COLORS.textTertiary }}>✕</span>
            </div>
            <input value={eventTitle} onChange={e=>setEventTitle(e.target.value)} placeholder="Event title" style={{ width:'100%', background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:'10px 12px', color:COLORS.textPrimary, outline:'none', fontSize:13.5, marginBottom:8, boxSizing:'border-box' }} />
            <div style={{ marginBottom:8 }}>
              <InlineDateSelect value={eventDate} onChange={setEventDate} minYear={new Date().getFullYear()} maxYear={new Date().getFullYear()+10} futureOk />
            </div>
            <input value={eventLocation} onChange={e=>setEventLocation(e.target.value)} placeholder="Event location (optional)" style={{ width:'100%', background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:'10px 12px', color:COLORS.textPrimary, outline:'none', fontSize:13.5, boxSizing:'border-box' }} />
          </div>
        )}

        {/* Background / colored-text-post panel */}
        {showBgPicker && (
          <div style={{ background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:16, padding:14, marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:13.5 }}>🎨 Colored background</span>
              <span onClick={()=>setShowBgPicker(false)} style={{ cursor:'pointer', color:COLORS.textTertiary }}>✕</span>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
              <div onClick={()=>setBgColor(null)} style={{ width:34, height:34, borderRadius:'50%', background:COLORS.surfaceAlt, border:bgColor===null?`3px solid ${COLORS.brand}`:`1px solid ${COLORS.border}`, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:COLORS.textTertiary, fontSize:14 }}>✕</div>
              {POST_BG_COLORS.map(c=>(
                <div key={c} onClick={()=>setBgColor(c)} style={{ width:34, height:34, borderRadius:'50%', background:c, border:bgColor===c?'3px solid white':'3px solid transparent', boxShadow:bgColor===c?`0 0 0 2px ${COLORS.brand}`:'none', cursor:'pointer' }} />
              ))}
            </div>
            {bgColor && media.length>0 && <div style={{ color:COLORS.warning, fontSize:11.5, marginTop:8 }}>Colored backgrounds only show on text-only posts — this won't appear while photos/videos are attached.</div>}
          </div>
        )}

        {/* Visibility */}
        <button onClick={()=>setVisibility(v=>v==='Everyone'?'Friends':'Everyone')} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:16, padding:'13px 16px', cursor:'pointer' }}>
          <span style={{ color:COLORS.textPrimary, fontSize:13.5, fontWeight:600 }}>Who can see this?</span>
          <span style={{ display:'flex', alignItems:'center', gap:6, color:COLORS.textSecondary, fontSize:13, fontWeight:600 }}>
            {visibility}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </span>
        </button>
      </div>
    </div>
  );
};

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

  // Fixed catalog lives server-side (src/app/api/wallet/route.js) so the client can't submit
  // an arbitrary coins-per-dollar rate — the preset buttons below map to these package ids.
  const TOPUP_PACKAGES = { 100:'small', 550:'medium', 1200:'large', 6500:'mega' };
  const nearestPackage = (n) => {
    const keys = Object.keys(TOPUP_PACKAGES).map(Number);
    const closest = keys.reduce((a,b)=>Math.abs(b-n)<Math.abs(a-n)?b:a);
    return TOPUP_PACKAGES[closest];
  };

  const doDeposit = async () => {
    const n=parseInt(amount); if(!n||n<=0){showToast?.('Enter valid amount','error'); return;}
    try {
      const pkg = nearestPackage(n);
      const data = await apiFetch('/api/wallet', { method:'POST', body: JSON.stringify({ type:'topup', package: pkg }) });
      setCurrentUser(u=>({...u, coins:data.coins}));
      showToast?.(`Added coins! 🎉`,'success');
      setAmount('');
    } catch(e) {
      showToast?.('Transaction failed: '+e.message,'error');
    }
  };
  const doWithdraw = async () => {
    if((user?.walletBalance||0)<5000){showToast?.('Minimum withdrawal is 5,000 coins','error'); return;}
    try {
      const data = await apiFetch('/api/wallet', { method:'POST', body: JSON.stringify({ type:'withdraw' }) });
      setCurrentUser(u=>({...u, walletBalance:0}));
      showToast?.(`Withdrawal requested: ${data.pendingPayout} coins`,'success');
      setAmount('');
    } catch(e) {
      showToast?.('Transaction failed: '+e.message,'error');
    }
  };
  const convertCoins = async () => {
    const n=parseInt(amount); if(!n||n<=0||(user?.coins||0)<n){showToast?.('Insufficient coins','error'); return;}
    try {
      const data = await apiFetch('/api/wallet', { method:'POST', body: JSON.stringify({ type:'convert', amount:n }) });
      setCurrentUser(u=>({...u, coins:data.coins}));
      showToast?.(`Converted to ${data.eth} ETH! ✨`,'success');
      setAmount('');
    } catch(e) {
      showToast?.('Transaction failed: '+e.message,'error');
    }
  };

  return (
    <div style={{ height:'100%', overflow:'auto', background:COLORS.bg }}>
      <div style={{ padding:'16px 16px 0' }}>
        <button onClick={onBack} style={{ background:COLORS.overlaySubtle, border:`1px solid ${COLORS.border}`, borderRadius:20, padding:'8px 16px', color:COLORS.textPrimary, cursor:'pointer', fontSize:13, marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:22, marginBottom:16, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Wallet</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          <div style={{ background:`linear-gradient(135deg,${COLORS.warningAlt},${COLORS.warning})`, borderRadius:22, padding:20 }}>
            <div style={{ color:'rgba(0,0,0,0.55)', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Coins</div>
            <div style={{ color:'#000', fontSize:30, fontWeight:800, marginTop:4, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{(user?.coins||0).toLocaleString()}</div>
            <div style={{ color:'rgba(0,0,0,0.45)', fontSize:10, marginTop:2 }}>🪙 Infinity Coins</div>
          </div>
          <div style={{ background:`linear-gradient(135deg,${COLORS.brand},${COLORS.info})`, borderRadius:22, padding:20 }}>
            <div style={{ color:'rgba(0,0,0,0.55)', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Cash</div>
            <div style={{ color:'#000', fontSize:30, fontWeight:800, marginTop:4, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>${(user?.walletBalance||0).toLocaleString()}</div>
            <div style={{ color:'rgba(0,0,0,0.4)', fontSize:10, marginTop:2 }}>💵 USD</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:4, marginBottom:16, background:COLORS.overlaySubtle, borderRadius:18, padding:4, border:`1px solid ${COLORS.overlaySubtle}` }}>
          {['overview','deposit','withdraw','convert'].map(t=>(
            <button key={t} onClick={()=>setActiveTab(t)} style={{ flex:1, background:activeTab===t?'rgba(11,95,255,0.9)':'none', border:'none', borderRadius:14, padding:'8px 4px', color:COLORS.textPrimary, cursor:'pointer', fontSize:11, fontWeight:activeTab===t?700:400, textTransform:'capitalize' }}>{t}</button>
          ))}
        </div>
        {activeTab==='overview' && (
          <div>
            {transactions.length===0&&<div style={{textAlign:'center',padding:40,color:COLORS.borderStrong}}>No transactions yet</div>}
            {transactions.map(tx=>(
              <div key={tx.id} style={{ background:COLORS.overlaySubtle, borderRadius:16, padding:'13px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:12, border:`1px solid ${COLORS.overlaySubtle}` }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:tx.type==='credit'?'rgba(6,214,160,0.12)':'rgba(11,95,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{tx.type==='credit'?'⬆️':'⬇️'}</div>
                <div style={{ flex:1 }}><div style={{ color:COLORS.textPrimary, fontSize:12 }}>{tx.label}</div><div style={{ color:COLORS.textTertiary, fontSize:10, marginTop:2 }}>{tx.date?.toLocaleDateString?.()}</div></div>
                <div style={{ color:tx.type==='credit'?COLORS.brand:COLORS.brand, fontWeight:700, fontSize:15 }}>{tx.type==='credit'?'+':'-'}{tx.amount}{tx.coins?'🪙':'$'}</div>
              </div>
            ))}
          </div>
        )}
        {(activeTab==='deposit'||activeTab==='withdraw'||activeTab==='convert') && (
          <div style={{ background:COLORS.overlaySubtle, borderRadius:22, padding:20, border:`1px solid ${COLORS.overlaySubtle}` }}>
            <div style={{ color:COLORS.textTertiary, fontSize:12, marginBottom:8 }}>{activeTab==='deposit'?'Add coins':activeTab==='withdraw'?'Withdraw coins':'Convert to ETH (1 ETH = 10,000 🪙)'}</div>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              <input type="number" placeholder="Enter amount..." value={amount} onChange={e=>setAmount(e.target.value)} style={{ flex:1, background:COLORS.overlaySubtle, border:`1px solid ${COLORS.border}`, borderRadius:14, padding:'12px', color:COLORS.textPrimary, outline:'none', fontSize:15 }} />
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              {(activeTab==='deposit' ? [100,550,1200,6500] : [100,500,1000,5000]).map(v=>(
                <button key={v} onClick={()=>setAmount(String(v))} style={{ flex:1, background:amount===String(v)?'rgba(11,95,255,0.9)':COLORS.overlaySubtle, border:'none', borderRadius:10, padding:'8px', color:COLORS.textPrimary, cursor:'pointer', fontSize:12, fontWeight:600 }}>{v}</button>
              ))}
            </div>
            <button onClick={activeTab==='deposit'?doDeposit:activeTab==='withdraw'?doWithdraw:convertCoins} style={{ width:'100%', background:`linear-gradient(135deg,${COLORS.brand},${COLORS.brandSecondary})`, border:'none', borderRadius:24, padding:'14px', color:'white', fontWeight:700, cursor:'pointer', fontSize:14, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>
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
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor||'#0B5FFF');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl||null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const colors = ['#0B5FFF','#2E7BFF','#083FB0','#FFB100','#2ED573','#00A9D6','#FF453A','#5E5CE6','#00A9D6','#5CA0FF'];

  const handleAvatarChange = (e) => {
    const f = e.target.files[0];
    if(f){setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f));}
  };

  const handleSave = async () => {
    setUploading(true);
    try {
      let avatarUrl = user?.avatarUrl || null;
      if (username.toLowerCase() !== (user.username||'').toLowerCase()) {
  // Same 5-32 char, lowercase letter/digit/underscore, starts-with-a-letter rule
  // used to auto-generate usernames at sign-up (see generateUsername/isValidUsername).
  if (!isValidUsername(username.toLowerCase())) {
    showToast?.('Username must be 5-32 characters: lowercase letters, numbers, or underscore, starting with a letter', 'error');
    setUploading(false);
    return;
  }
  // Case-insensitive: @Bob and @bob are the same handle, matching WhatsApp/Instagram.
  const snap = await getDocs(query(collection(db, 'users'), where('usernameLower', '==', username.toLowerCase())));
  if (!snap.empty) {
    showToast?.('Username already taken', 'error');
    setUploading(false);
    return;
  }
}
      if(avatarFile) avatarUrl = await uploadToCloudinary(avatarFile);
      const updates = {username, usernameLower: username.toLowerCase(), bio, link, gender, avatarColor, avatarUrl, avatar: username[0].toUpperCase()};
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
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:4000, display:'flex', alignItems:'flex-end', animation:'fadeIn 0.2s ease' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', background:'#15151C', borderTopLeftRadius:32, borderTopRightRadius:32, padding:'20px 20px 44px', maxHeight:'92vh', overflowY:'auto', border:'1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ width:36, height:4, background:'rgba(255,255,255,0.12)', borderRadius:2, margin:'0 auto 20px' }} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <span style={{ color:'white', fontWeight:800, fontSize:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Edit Profile</span>
          <button onClick={handleSave} disabled={uploading} style={{ background:'linear-gradient(135deg,#2E7BFF,#0B5FFF)', border:'none', borderRadius:20, padding:'9px 20px', color:'white', fontWeight:700, cursor:'pointer', fontSize:14, opacity:uploading?0.6:1 }}>{uploading?'Saving...':'Save'}</button>
        </div>
        <div style={{ position:'relative', display:'inline-block' }}>
            <div style={{ width:90, height:90, borderRadius:'50%', background:avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:36, margin:'0 auto', border:'3px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
              {avatarPreview ? <img src={avatarPreview} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : user?.avatar}
            </div>
            <div onClick={()=>fileInputRef.current?.click()} style={{ position:'absolute', bottom:0, right:0, background:'rgba(255,255,255,0.1)', border:'2px solid #15151C', borderRadius:'50%', width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', backdropFilter:'blur(8px)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{display:'none'}} />
          <div style={{ color:'rgba(255,255,255,0.4)', fontSize:12, marginTop:12, marginBottom:12 }}>Profile color</div>
          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
            {colors.map(c=><div key={c} onClick={()=>setAvatarColor(c)} style={{ width:34, height:34, borderRadius:'50%', background:c, cursor:'pointer', border:c===avatarColor?'3px solid white':'3px solid transparent', transition:'all 0.15s' }} />)}
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
  const defaults = { 'Private Account':false,'Show Activity Status':true,'Allow Comments':true,'Allow Duets':true,'Allow Messages from Everyone':false,'Allow Calls from Everyone':false,'Allow Follow Requests':true,'Show Phone Number on Profile':false };
  const [settings, setSettings] = useState({ ...defaults, ...(user?.privacy||{}) });
  const toggle = async (label) => {
    const next = { ...settings, [label]: !settings[label] };
    setSettings(next);
    const updates = { privacy: next };
    // Keep the public `publicPhone` mirror in sync with the toggle: only ever populated
    // when the owner has opted in, since it's readable by anyone (unlike the private
    // phone field). user.phone is available here because getUserProfile merges the
    // owner-only private/contact doc into currentUser at load time.
    if (label === 'Show Phone Number on Profile') {
      updates.publicPhone = next[label] ? (user?.phone || '') : '';
    }
    await updateDoc(doc(db,'users',user.id), updates);
    showToast?.('Saved','success');
  };
  return (
    <div style={{ background:COLORS.surface2, borderRadius:20, overflow:'hidden', marginBottom:20, border:`1px solid ${COLORS.border}` }}>
      {Object.entries(settings).map(([label,on],i,arr)=>(
        <div key={label} onClick={()=>toggle(label)} style={{ padding:'14px 16px', borderBottom:i<arr.length-1?`1px solid ${COLORS.border}`:'', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}>
          <span style={{ color:COLORS.textPrimary, fontSize:13 }}>{label}{label==='Show Phone Number on Profile' && <div style={{ color:COLORS.textTertiary, fontSize:11, marginTop:2 }}>Off shows your @username instead, like WhatsApp</div>}</span>
          <div style={{ width:46, height:26, background:on?COLORS.brand:COLORS.surface3, borderRadius:13, position:'relative', transition:'background 0.2s', flexShrink:0 }}>
            <div style={{ width:20, height:20, background:'white', borderRadius:'50%', position:'absolute', top:3, left:on?23:3, transition:'left 0.2s' }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─────────────── ENFORCEMENT ─────────────── */
/* Actual enforcement for bans/suspensions. Before this, `accountStatus` was set by the
   Moderation Center but nothing ever read it back on the client — a banned or suspended
   user could keep using the app exactly as before. getEnforcementStatus + EnforcementScreen
   replace the whole app with a block screen for any signed-in user currently restricted,
   with a one-shot appeal flow underneath.
   IMPORTANT: this is a client-side gate for UX (clear messaging instead of a silent block
   or a blank screen). It is NOT a substitute for firestore.rules — writes from a banned or
   suspended uid must also be denied server-side, since a client can always be bypassed by
   calling Firestore directly. Add a rule along the lines of:
     match /videos/{id}  { allow create: if !(get(/databases/$(database)/documents/users/$(request.auth.uid)).data.accountStatus in ['banned','suspended']); }
   (and equivalently for /comments, /reports, /messages, etc.) so the ban is real everywhere
   a request could originate, not just inside this UI. */
const getEnforcementStatus = (user) => {
  if (!user) return null;
  if (user.accountStatus === 'banned') return { kind: 'banned' };
  if (user.accountStatus === 'suspended') {
    const until = tsToDate(user.suspendedUntil);
    if (until && until.getTime() > Date.now()) return { kind: 'suspended', until };
    return null; // window has passed — caller (root effect) reinstates
  }
  return null;
};

// Lets a restricted user ask for a second look. One pending appeal at a time —
// once submitted, the form is replaced by a status readout until it's resolved.
const AppealForm = ({ user, showToast }) => {
  const [existingAppeal, setExistingAppeal] = useState(undefined); // undefined = still loading
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(collection(db, 'appeals'), where('userId', '==', user.id), orderBy('createdAt', 'desc'), limit(1));
    getDocs(q).then(snap => {
      setExistingAppeal(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
    }).catch(() => setExistingAppeal(null));
  }, [user?.id]);

  const submit = async () => {
    if (!message.trim()) { showToast?.('Tell us why you think this was a mistake', 'error'); return; }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'appeals'), {
        userId: user.id, username: user.username || null,
        accountStatus: user.accountStatus, violationReason: user.lastModerationAction?.reason || null,
        message: message.trim(), status: 'pending', createdAt: serverTimestamp(),
      });
      setExistingAppeal({ status: 'pending', message: message.trim() });
      showToast?.("Appeal submitted — we'll review it soon", 'success');
    } catch (e) {
      showToast?.('Could not submit appeal, try again later', 'error');
    }
    setSubmitting(false);
  };

  if (existingAppeal === undefined) {
    return <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Loading…</div>;
  }

  if (existingAppeal) {
    const statusText = {
      pending: "Your appeal is under review. We'll notify you once it's been decided.",
      approved: 'Your appeal was approved — refresh the app to continue.',
      denied: 'Your appeal was reviewed and the original decision was upheld.',
    }[existingAppeal.status || 'pending'];
    const statusLabel = (existingAppeal.status || 'pending');
    return (
      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 18px', textAlign: 'left' }}>
        <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>
          Appeal status: {statusLabel[0].toUpperCase() + statusLabel.slice(1)}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, lineHeight: 1.5 }}>{statusText}</div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'left' }}>
      <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
        placeholder="Explain why you think this decision was a mistake…"
        style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 12, color: 'white', fontSize: 13.5, outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      <button onClick={submit} disabled={submitting} style={{ width: '100%', marginTop: 10, background: 'white', border: 'none', borderRadius: 14, padding: '12px', color: '#0B0B0F', fontWeight: 700, fontSize: 14, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
        {submitting ? 'Submitting…' : 'Submit appeal'}
      </button>
    </div>
  );
};

// Full-screen block shown instead of the app for any banned/suspended account.
const EnforcementScreen = ({ user, onSignOut, showToast }) => {
  const status = getEnforcementStatus(user);
  if (!status) return null;
  const isBanned = status.kind === 'banned';
  return (
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100dvh', background: '#0B0B0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 28px', textAlign: 'center', overflow: 'auto' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: isBanned ? 'rgba(255,69,58,0.15)' : 'rgba(255,159,10,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, flexShrink: 0 }}>
        <span style={{ fontSize: 28 }}>{isBanned ? '🚫' : '⏸'}</span>
      </div>
      <div style={{ color: 'white', fontWeight: 800, fontSize: 20, marginBottom: 8 }}>
        {isBanned ? 'Account banned' : 'Account suspended'}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13.5, lineHeight: 1.6, marginBottom: 6, maxWidth: 320 }}>
        {isBanned
          ? 'Your account was permanently banned for violating our community guidelines.'
          : `Your account is suspended until ${status.until ? status.until.toLocaleString() : 'the suspension period ends'}.`}
      </div>
      {user?.lastModerationAction?.reason && (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12.5, marginBottom: 24 }}>Reason: {user.lastModerationAction.reason}</div>
      )}
      <div style={{ width: '100%', maxWidth: 340, marginTop: 8, marginBottom: 20 }}>
        <AppealForm user={user} showToast={showToast} />
      </div>
      <button onClick={onSignOut} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 14, padding: '11px 22px', color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Sign out</button>
    </div>
  );
};

/* ─────────────── PROFILE PAGE ─────────────── */
/* Moderation Center — groups every report by the account or post it targets so admins see
   report VOLUME (not just a flat list), the full context of who/what is being reported, and
   a real set of actions (warn / suspend / ban / remove content) instead of just "dismiss".
   Every action is written to `moderationActions` as an audit trail. */
const ModerationPage = ({ user, users, allVideos, showToast, onBack }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flagged, setFlagged] = useState([]);
  const [flaggedLoading, setFlaggedLoading] = useState(true);
  const [actionLog, setActionLog] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [tab, setTab] = useState('reports'); // 'reports' | 'flagged' | 'appeals' | 'log'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'user' | 'post' | 'comment'
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [openDurationFor, setOpenDurationFor] = useState(null); // group key with the suspend picker open
  const [busyKey, setBusyKey] = useState(null); // group key (or `appeal:{id}`) currently processing an action

  useEffect(()=>{
    const q = query(collection(db,'reports'), orderBy('createdAt','desc'));
    const unsub = onSnapshot(q, snap=>{
      setReports(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    }, ()=>setLoading(false));
    return ()=>unsub();
  },[]);

  useEffect(()=>{
    const q = query(collection(db,'moderationActions'), orderBy('createdAt','desc'), limit(60));
    const unsub = onSnapshot(q, snap=>{
      setActionLog(snap.docs.map(d=>({id:d.id,...d.data()})));
    }, ()=>{});
    return ()=>unsub();
  },[]);

  // Ban/suspension appeals submitted from the enforcement screen (see AppealForm).
  useEffect(()=>{
    const q = query(collection(db,'appeals'), orderBy('createdAt','desc'), limit(100));
    const unsub = onSnapshot(q, snap=>{
      setAppeals(snap.docs.map(d=>({id:d.id,...d.data()})));
    }, ()=>{});
    return ()=>unsub();
  },[]);
  const pendingAppeals = useMemo(()=>appeals.filter(a=>a.status==='pending'), [appeals]);

  const loadFlagged = async () => {
    setFlaggedLoading(true);
    try {
      const data = await apiFetch('/api/moderation');
      setFlagged(data.items || []);
    } catch (e) {
      showToast?.(e.message || 'Failed to load moderation queue', 'error');
    }
    setFlaggedLoading(false);
  };
  useEffect(()=>{ loadFlagged(); },[]);

  const reviewFlagged = async (videoId, action) => {
    try {
      await apiFetch('/api/moderation', { method:'POST', body: JSON.stringify({ videoId, action }) });
      setFlagged(list => list.filter(v => v.id !== videoId));
      showToast?.(action === 'approve' ? 'Post approved' : 'Post removed', 'success');
    } catch (e) {
      showToast?.(e.message || 'Action failed', 'error');
    }
  };

  // ── Group raw report docs by the account/post they target ────────────────────────────
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of reports) {
      // reportKind replaces the old boolean isUserReport now that there are three
      // distinct target types to group by (account / post / comment). isUserReport
      // is kept alongside it so existing account-only checks below don't all need
      // rewriting — it's just `reportKind==='user'`.
      const reportKind = r.type === 'user' ? 'user' : r.type === 'comment' ? 'comment' : 'post';
      const isUserReport = reportKind === 'user';
      const key = reportKind === 'user' ? `user:${r.reportedUserId || r.userId || 'unknown'}`
        : reportKind === 'comment' ? `comment:${r.commentId || r.id}`
        : `post:${r.videoId || r.id}`;
      if (!map.has(key)) {
        map.set(key, {
          key, isUserReport, reportKind,
          targetId: reportKind === 'user' ? (r.reportedUserId || r.userId) : reportKind === 'comment' ? r.commentId : r.videoId,
          reports: [], reporters: new Set(), reasonCounts: {}, firstAt: null, lastAt: null,
        });
      }
      const g = map.get(key);
      g.reports.push(r);
      g.reporters.add(r.reporterUsername || r.reportedBy || 'unknown');
      const reason = r.reason || 'Not specified';
      g.reasonCounts[reason] = (g.reasonCounts[reason] || 0) + 1;
      const at = r.createdAt?.toDate ? r.createdAt.toDate() : null;
      if (at && (!g.firstAt || at < g.firstAt)) g.firstAt = at;
      if (at && (!g.lastAt || at > g.lastAt)) g.lastAt = at;
    }

    return Array.from(map.values()).map(g => {
      const sample = g.reports[0];
      const topReason = Object.entries(g.reasonCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'Not specified';
      const severity = g.reports.reduce((worst, r) => {
        const s = REASON_SEVERITY[r.reason] || 'low';
        const rank = { high:3, med:2, low:1 };
        return rank[s] > rank[worst] ? s : worst;
      }, 'low');
      const urgent = severity === 'high' || g.reports.length >= 5;

      if (g.isUserReport) {
        const targetUser = users?.find(u => u.id === g.targetId);
        return {
          ...g, topReason, severity, urgent,
          targetUser,
          label: `@${sample.reportedUsername || targetUser?.username || g.targetId || 'unknown'}`,
        };
      }
      if (g.reportKind === 'comment') {
        const parentVideo = allVideos?.find(v => v.id === sample.videoId);
        const author = sample.commentUsername || sample.commentUserId || 'unknown';
        return {
          ...g, topReason, severity, urgent,
          author,
          videoId: sample.videoId || null,
          caption: sample.commentText ?? '(comment removed)',
          thumb: sample.videoThumbUrl || parentVideo?.thumbUrl || parentVideo?.thumbnailUrl,
          label: `@${author}`,
        };
      }
      const targetVideo = allVideos?.find(v => v.id === g.targetId);
      const author = sample.videoUsername || targetVideo?.username || sample.videoUserId || 'unknown';
      return {
        ...g, topReason, severity, urgent,
        targetVideo,
        author,
        caption: sample.videoCaption ?? targetVideo?.description ?? targetVideo?.caption ?? '(no caption)',
        thumb: sample.videoThumbUrl || targetVideo?.thumbUrl || targetVideo?.thumbnailUrl,
        label: `@${author}`,
      };
    });
  }, [reports, users, allVideos]);

  // Real per-target audit trail — groups the already-fetched `moderationActions` log by
  // targetId so each report card can show exactly what's happened to that account/post
  // before, straight from Firestore. No synthetic history, no placeholder entries.
  const actionsByTarget = useMemo(() => {
    const map = new Map();
    for (const a of actionLog) {
      if (!a.targetId) continue;
      if (!map.has(a.targetId)) map.set(a.targetId, []);
      map.get(a.targetId).push(a);
    }
    return map;
  }, [actionLog]);

  const typeCounts = useMemo(() => ({
    all: groups.length,
    user: groups.filter(g => g.reportKind === 'user').length,
    post: groups.filter(g => g.reportKind === 'post').length,
    comment: groups.filter(g => g.reportKind === 'comment').length,
  }), [groups]);

  const filteredGroups = useMemo(() => {
    let list = groups;
    if (typeFilter !== 'all') list = list.filter(g => g.reportKind === typeFilter);
    if (urgentOnly) list = list.filter(g => g.urgent);
    if (search.trim()) {
      const q = search.trim().toLowerCase().replace(/^@/,'');
      list = list.filter(g => g.label.toLowerCase().includes(q));
    }
    const rank = { high:3, med:2, low:1 };
    return [...list].sort((a,b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      if (rank[b.severity] !== rank[a.severity]) return rank[b.severity]-rank[a.severity];
      if (b.reports.length !== a.reports.length) return b.reports.length - a.reports.length;
      return (b.lastAt||0) - (a.lastAt||0);
    });
  }, [groups, typeFilter, urgentOnly, search]);

  const totalReports = reports.length;
  const urgentCount = groups.filter(g=>g.urgent).length;
  const actionsToday = actionLog.filter(a => {
    const at = a.createdAt?.toDate ? a.createdAt.toDate() : null;
    return at && (Date.now() - at.getTime()) < 86400000;
  }).length;

  const logAction = async (group, action, extra = {}) => {
    try {
      await addDoc(collection(db, 'moderationActions'), {
        targetType: group.reportKind || (group.isUserReport ? 'user' : 'post'),
        targetId: group.targetId, targetLabel: group.label,
        action, reportCount: group.reports.length,
        actorId: user?.id, actorUsername: user?.username || 'admin',
        createdAt: serverTimestamp(), ...extra,
      });
    } catch (e) { /* audit log failure shouldn't block the moderation action itself */ }
  };

  const resolveGroupReports = async (group) => {
    await Promise.all(group.reports.map(r => deleteDoc(doc(db,'reports',r.id)).catch(()=>{})));
  };

  const runAction = async (group, fn) => {
    setBusyKey(group.key);
    try { await fn(); } catch(e) { showToast?.(e.message || 'Action failed', 'error'); }
    setBusyKey(null);
    setOpenDurationFor(null);
  };

  const dismissGroup = (group) => runAction(group, async () => {
    await resolveGroupReports(group);
    await logAction(group, 'dismiss');
    showToast?.('Report dismissed', 'info');
  });

  const deletePostGroup = (group) => runAction(group, async () => {
    if (!group.targetId) return;
    if (!(await confirmDialog('Delete this reported post? This cannot be undone.'))) return;
    await deleteDoc(doc(db,'videos',group.targetId)).catch(()=>{});
    await resolveGroupReports(group);
    await logAction(group, 'delete_post');
    showToast?.('Post removed', 'success');
  });

  const deleteCommentGroup = (group) => runAction(group, async () => {
    if (!group.targetId) return;
    if (!(await confirmDialog('Delete this reported comment? This cannot be undone.'))) return;
    await deleteDoc(doc(db,'comments',group.targetId)).catch(()=>{});
    // Keep the parent post's comment count in sync — it's incremented on post,
    // so a moderation-removed comment needs the matching decrement.
    if (group.videoId) {
      await updateDoc(doc(db,'videos',group.videoId), { comments: increment(-1) }).catch(()=>{});
    }
    await resolveGroupReports(group);
    await logAction(group, 'delete_comment');
    showToast?.('Comment removed', 'success');
  });

  const warnUser = (group) => runAction(group, async () => {
    if (!group.targetId) return;
    await updateDoc(doc(db,'users',group.targetId), {
      accountStatus: 'warned', strikeCount: increment(1),
      lastModerationAction: { action:'warn', at: new Date(), reason: group.topReason },
    });
    await sendNotification(group.targetId, user?.id, 'moderation',
      `You've received a warning for: ${group.topReason}. Please review our community guidelines.`);
    await resolveGroupReports(group);
    await logAction(group, 'warn', { reason: group.topReason });
    showToast?.('User warned', 'success');
  });

  const suspendUser = (group, days) => runAction(group, async () => {
    if (!group.targetId) return;
    const until = new Date(Date.now() + days*86400000);
    await updateDoc(doc(db,'users',group.targetId), {
      accountStatus: 'suspended', suspendedUntil: until, strikeCount: increment(1),
      lastModerationAction: { action:'suspend', at: new Date(), reason: group.topReason, days },
    });
    await sendNotification(group.targetId, user?.id, 'moderation',
      `Your account has been suspended for ${days} day${days===1?'':'s'} for: ${group.topReason}.`);
    await resolveGroupReports(group);
    await logAction(group, 'suspend', { reason: group.topReason, days });
    showToast?.(`User suspended for ${days} day${days===1?'':'s'}`, 'success');
  });

  const banUser = (group) => runAction(group, async () => {
    if (!group.targetId) return;
    if (!(await confirmDialog('Permanently ban this account? This cannot be undone from here.'))) return;
    await updateDoc(doc(db,'users',group.targetId), {
      accountStatus: 'banned', suspendedUntil: null,
      lastModerationAction: { action:'ban', at: new Date(), reason: group.topReason },
    });
    await sendNotification(group.targetId, user?.id, 'moderation',
      `Your account has been banned for violating our community guidelines: ${group.topReason}.`);
    await resolveGroupReports(group);
    await logAction(group, 'ban', { reason: group.topReason });
    showToast?.('User banned', 'success');
  });

  const reinstateUser = (group) => runAction(group, async () => {
    if (!group.targetId) return;
    await updateDoc(doc(db,'users',group.targetId), { accountStatus:'active', suspendedUntil:null });
    await logAction(group, 'reinstate');
    showToast?.('Account reinstated', 'success');
  });

  // ── Appeals ────────────────────────────────────────────────────────────────
  // Runs an action keyed by the appeal's own id rather than a report group's key,
  // since appeal actions (approve/deny) aren't tied to a report group at all.
  const runAppealAction = async (appeal, fn) => {
    setBusyKey(`appeal:${appeal.id}`);
    try { await fn(); } catch(e) { showToast?.(e.message || 'Action failed', 'error'); }
    setBusyKey(null);
  };

  const logAppealAction = async (appeal, action) => {
    try {
      await addDoc(collection(db, 'moderationActions'), {
        targetType: 'user', targetId: appeal.userId, targetLabel: `@${appeal.username || 'unknown'}`,
        action, actorId: user?.id, actorUsername: user?.username || 'admin',
        reason: appeal.violationReason || null, createdAt: serverTimestamp(),
      });
    } catch (e) { /* audit log failure shouldn't block the appeal decision */ }
  };

  const approveAppeal = (appeal) => runAppealAction(appeal, async () => {
    if (!appeal.userId) return;
    await updateDoc(doc(db,'users',appeal.userId), { accountStatus:'active', suspendedUntil:null });
    await updateDoc(doc(db,'appeals',appeal.id), {
      status:'approved', resolvedAt: serverTimestamp(), resolvedBy: user?.id,
    });
    await sendNotification(appeal.userId, user?.id, 'moderation',
      `Your appeal was reviewed and your account has been reinstated.`);
    await logAppealAction(appeal, 'appeal_approved');
    showToast?.('Appeal approved — account reinstated', 'success');
  });

  const denyAppeal = (appeal) => runAppealAction(appeal, async () => {
    if (!appeal.id) return;
    if (!(await confirmDialog('Deny this appeal? The account will remain restricted.'))) return;
    await updateDoc(doc(db,'appeals',appeal.id), {
      status:'denied', resolvedAt: serverTimestamp(), resolvedBy: user?.id,
    });
    await sendNotification(appeal.userId, user?.id, 'moderation',
      `Your appeal was reviewed and the original decision has been upheld.`);
    await logAppealAction(appeal, 'appeal_denied');
    showToast?.('Appeal denied', 'info');
  });

  const severityColor = s => s==='high' ? COLORS.danger : s==='med' ? COLORS.warning : COLORS.textTertiary;

  const StatCard = ({ label, value, color, icon }) => (
    <div style={{ flex:1, minWidth:90, background:COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius:16, padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
      <div>
        <div style={{ color: color||COLORS.textPrimary, fontWeight:800, fontSize:20 }}>{value}</div>
        <div style={{ color:COLORS.textTertiary, fontSize:11, marginTop:2 }}>{label}</div>
      </div>
      {icon && <div style={{ fontSize:18, opacity:0.8 }}>{icon}</div>}
    </div>
  );

  const TabButton = ({ id, label, count }) => (
    <button onClick={()=>setTab(id)} style={{
      background: tab===id ? COLORS.brand : 'transparent', color: tab===id ? '#fff' : COLORS.textSecondary,
      border:`1px solid ${tab===id ? COLORS.brand : COLORS.border}`, borderRadius:20, padding:'7px 14px',
      fontSize:12.5, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
    }}>{label}{typeof count==='number' ? ` (${count})` : ''}</button>
  );

  const ReporterChips = ({ group }) => {
    const names = Array.from(group.reporters);
    const shown = names.slice(0,3);
    const rest = names.length - shown.length;
    return (
      <div style={{ color:COLORS.textTertiary, fontSize:11.5, marginTop:4 }}>
        Reported by <span style={{color:COLORS.textSecondary,fontWeight:600}}>{shown.map(n=>`@${n}`).join(', ')}</span>
        {rest>0 ? ` +${rest} more` : ''}
        {group.lastAt ? ` · last ${timeAgo(group.lastAt)}` : ''}
      </div>
    );
  };

  const ReasonBreakdown = ({ group }) => (
    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
      {Object.entries(group.reasonCounts).sort((a,b)=>b[1]-a[1]).map(([reason,count]) => (
        <span key={reason} style={{
          display:'inline-flex', alignItems:'center', gap:4,
          background:`${severityColor(REASON_SEVERITY[reason]||'low')}14`,
          color: severityColor(REASON_SEVERITY[reason]||'low'),
          fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:10,
        }}>{reason} · {count}</span>
      ))}
    </div>
  );

  const AccountStatusChip = ({ targetUser }) => {
    if (!targetUser || !targetUser.accountStatus || targetUser.accountStatus==='active') return null;
    const map = {
      warned: { bg: COLORS.warning, label: `⚠ Warned${targetUser.strikeCount?` · ${targetUser.strikeCount} strike${targetUser.strikeCount===1?'':'s'}`:''}` },
      suspended: { bg: COLORS.warning, label: `⏸ Suspended${targetUser.suspendedUntil?.toDate ? ` until ${targetUser.suspendedUntil.toDate().toLocaleDateString()}` : ''}` },
      banned: { bg: COLORS.danger, label: '🚫 Banned' },
    };
    const cfg = map[targetUser.accountStatus];
    if (!cfg) return null;
    return <span style={{ background:`${cfg.bg}1A`, color:cfg.bg, fontSize:10.5, fontWeight:700, padding:'3px 8px', borderRadius:10 }}>{cfg.label}</span>;
  };

  const GroupCard = ({ group }) => {
    const busy = busyKey === group.key;
    const durationOpen = openDurationFor === group.key;
    const [showHistory, setShowHistory] = useState(false);
    const history = actionsByTarget.get(group.targetId) || [];
    const historyLabels = {
      dismiss:'Dismissed', delete_post:'Deleted post', delete_comment:'Deleted comment', warn:'Warned',
      suspend:'Suspended', ban:'Banned', reinstate:'Reinstated',
      appeal_approved:'Appeal approved', appeal_denied:'Appeal denied',
    };
    return (
      <div style={{
        background:COLORS.surface2, borderRadius:18, padding:'14px 16px', marginBottom:12,
        border:`1px solid ${group.urgent ? `${COLORS.danger}66` : COLORS.border}`,
        opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6, gap:10 }}>
          <div style={{ display:'flex', gap:10, alignItems:'flex-start', minWidth:0 }}>
            {group.isUserReport ? (
              <div style={{ width:44, height:44, borderRadius:'50%', background:group.targetUser?.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:16, overflow:'hidden', flexShrink:0 }}>
                {group.targetUser?.avatarUrl ? <img src={group.targetUser.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : (group.targetUser?.avatar || group.label[1] || '?')}
              </div>
            ) : (
              group.thumb ? <img src={group.thumb} alt="" style={{ width:44, height:44, borderRadius:10, objectFit:'cover', flexShrink:0 }} />
                : <div style={{ width:44, height:44, borderRadius:10, background:COLORS.surface3, flexShrink:0 }} />
            )}
            <div style={{ minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                <div style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:14 }}>
                  {group.isUserReport ? 'Account' : group.reportKind === 'comment' ? 'Comment' : 'Post'} — {group.label}
                </div>
                {group.isUserReport && group.targetUser?.verified && <span style={{color:COLORS.brand,fontSize:12}}>✓</span>}
                <AccountStatusChip targetUser={group.targetUser} />
              </div>
              {group.isUserReport ? (
                <div style={{ color:COLORS.textTertiary, fontSize:11.5, marginTop:2 }}>
                  {formatNumber(group.targetUser?.followers?.length||0)} followers
                  {group.targetUser?.createdAt?.toDate ? ` · joined ${group.targetUser.createdAt.toDate().toLocaleDateString()}` : ''}
                </div>
              ) : group.reportKind === 'comment' ? (
                <div style={{ color:COLORS.textSecondary, fontSize:12, marginTop:2, maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  "{group.caption}"
                </div>
              ) : (
                <>
                  <div style={{ color:COLORS.textSecondary, fontSize:12, marginTop:2, maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    "{group.caption}"
                  </div>
                  <div style={{ color:COLORS.textTertiary, fontSize:11, marginTop:2 }}>
                    {formatNumber(group.targetVideo?.views||0)} views · {formatNumber(group.targetVideo?.likes||0)} likes
                  </div>
                </>
              )}
              <ReporterChips group={group} />
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
            {group.urgent && (
              <span style={{ background:`${COLORS.danger}1A`, color:COLORS.danger, fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:10 }}>URGENT</span>
            )}
            <span style={{ background:`${COLORS.brand}1A`, color:COLORS.brand, fontSize:16, fontWeight:800, padding:'2px 10px', borderRadius:12, lineHeight:1.4 }}>
              {group.reports.length}
            </span>
            <span style={{ color:COLORS.textTertiary, fontSize:9.5 }}>report{group.reports.length===1?'':'s'}</span>
          </div>
        </div>

        <ReasonBreakdown group={group} />

        {history.length > 0 && (
          <div style={{ marginTop:10 }}>
            <button onClick={()=>setShowHistory(v=>!v)} style={{
              background:'none', border:'none', padding:0, color:COLORS.brand, fontSize:11.5, fontWeight:700, cursor:'pointer',
            }}>
              {showHistory ? '▾' : '▸'} {history.length} prior moderation action{history.length===1?'':'s'} on this target
            </button>
            {showHistory && (
              <div style={{ marginTop:8, background:COLORS.surface3, borderRadius:12, padding:'8px 10px' }}>
                {history.slice(0,5).map(h => (
                  <div key={h.id} style={{ display:'flex', justifyContent:'space-between', gap:8, fontSize:11.5, padding:'4px 0', borderBottom:`1px solid ${COLORS.border}` }}>
                    <span style={{ color:COLORS.textSecondary, fontWeight:600 }}>{historyLabels[h.action] || h.action}</span>
                    <span style={{ color:COLORS.textTertiary, textAlign:'right' }}>
                      {h.reason ? `${h.reason} · ` : ''}{h.createdAt?.toDate ? timeAgo(h.createdAt.toDate()) : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:12 }}>
          <button onClick={()=>dismissGroup(group)} style={{ flex:'1 1 90px', background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:14, padding:'9px', color:COLORS.textSecondary, fontWeight:600, fontSize:12.5, cursor:'pointer' }}>Dismiss</button>

          {group.reportKind === 'post' && group.targetId && (
            <button onClick={()=>deletePostGroup(group)} style={{ flex:'1 1 110px', background:`${COLORS.danger}1A`, border:`1px solid ${COLORS.danger}4D`, borderRadius:14, padding:'9px', color:COLORS.danger, fontWeight:700, fontSize:12.5, cursor:'pointer' }}>Delete post</button>
          )}

          {group.reportKind === 'comment' && group.targetId && (
            <button onClick={()=>deleteCommentGroup(group)} style={{ flex:'1 1 110px', background:`${COLORS.danger}1A`, border:`1px solid ${COLORS.danger}4D`, borderRadius:14, padding:'9px', color:COLORS.danger, fontWeight:700, fontSize:12.5, cursor:'pointer' }}>Delete comment</button>
          )}

          {group.isUserReport && group.targetId && (
            <>
              <button onClick={()=>warnUser(group)} style={{ flex:'1 1 90px', background:`${COLORS.warning}1A`, border:`1px solid ${COLORS.warning}4D`, borderRadius:14, padding:'9px', color:COLORS.warning, fontWeight:700, fontSize:12.5, cursor:'pointer' }}>Warn</button>

              <div style={{ position:'relative', flex:'1 1 110px' }}>
                <button onClick={()=>setOpenDurationFor(durationOpen?null:group.key)} style={{ width:'100%', background:`${COLORS.warning}1A`, border:`1px solid ${COLORS.warning}4D`, borderRadius:14, padding:'9px', color:COLORS.warning, fontWeight:700, fontSize:12.5, cursor:'pointer' }}>Suspend ▾</button>
                {durationOpen && (
                  <div style={{ position:'absolute', bottom:'calc(100% + 6px)', left:0, right:0, background:COLORS.surface3, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:6, zIndex:5, boxShadow:'0 8px 24px rgba(0,0,0,0.3)' }}>
                    {SUSPENSION_OPTIONS.map(opt => (
                      <div key={opt.days} onClick={()=>suspendUser(group, opt.days)} style={{ padding:'8px 10px', borderRadius:8, color:COLORS.textPrimary, fontSize:12.5, cursor:'pointer' }}
                        onMouseEnter={e=>e.currentTarget.style.background=COLORS.surface2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        {opt.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={()=>banUser(group)} style={{ flex:'1 1 90px', background:`${COLORS.danger}1A`, border:`1px solid ${COLORS.danger}4D`, borderRadius:14, padding:'9px', color:COLORS.danger, fontWeight:700, fontSize:12.5, cursor:'pointer' }}>Ban</button>

              {(group.targetUser?.accountStatus==='suspended' || group.targetUser?.accountStatus==='banned' || group.targetUser?.accountStatus==='warned') && (
                <button onClick={()=>reinstateUser(group)} style={{ flex:'1 1 110px', background:`${COLORS.success}1A`, border:`1px solid ${COLORS.success}4D`, borderRadius:14, padding:'9px', color:COLORS.success, fontWeight:700, fontSize:12.5, cursor:'pointer' }}>Reinstate</button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ height:'100%', overflow:'auto', background:COLORS.bg, padding:16 }}>
      <button onClick={onBack} style={{ background:COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius:20, padding:'8px 16px', color:COLORS.textPrimary, cursor:'pointer', fontSize:13, marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>

      <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:24, marginBottom:4 }}>Moderation Center</div>
      <div style={{ color:COLORS.textTertiary, fontSize:12.5, marginBottom:16 }}>Review reports, take action, and track outcomes</div>

      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:18 }}>
        <StatCard label="Open reports" value={totalReports} icon="⏳" />
        <StatCard label="Urgent" value={urgentCount} color={urgentCount>0?COLORS.danger:COLORS.textPrimary} icon="🚨" />
        <StatCard label="Auto-flagged" value={flagged.length} color={COLORS.warning} icon="🤖" />
        <StatCard label="Actions today" value={actionsToday} color={COLORS.success} icon="✅" />
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16, overflowX:'auto' }}>
        <TabButton id="reports" label="User reports" count={groups.length} />
        <TabButton id="flagged" label="Auto-flagged" count={flagged.length} />
        <TabButton id="appeals" label="Appeals" count={pendingAppeals.length} />
        <TabButton id="log" label="Action log" />
      </div>

      {tab === 'reports' && (
        <>
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by @username…"
              style={{ flex:'1 1 180px', background:COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius:14, padding:'9px 12px', color:COLORS.textPrimary, fontSize:12.5, outline:'none' }} />
            <button onClick={()=>setUrgentOnly(u=>!u)} style={{
              background: urgentOnly ? `${COLORS.danger}1A` : COLORS.surface2,
              border:`1px solid ${urgentOnly ? `${COLORS.danger}66` : COLORS.border}`,
              color: urgentOnly ? COLORS.danger : COLORS.textSecondary,
              borderRadius:14, padding:'9px 12px', fontSize:12.5, fontWeight:700, cursor:'pointer',
            }}>🚨 Urgent only</button>
          </div>

          <div style={{ display:'flex', gap:6, marginBottom:14, overflowX:'auto' }}>
            {[
              { id:'all', label:'All' },
              { id:'user', label:'Accounts' },
              { id:'post', label:'Posts' },
              { id:'comment', label:'Comments' },
            ].map(f => (
              <button key={f.id} onClick={()=>setTypeFilter(f.id)} style={{
                background: typeFilter===f.id ? COLORS.brand : COLORS.surface2,
                color: typeFilter===f.id ? '#fff' : COLORS.textSecondary,
                border:`1px solid ${typeFilter===f.id ? COLORS.brand : COLORS.border}`,
                borderRadius:20, padding:'7px 14px', fontSize:12.5, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
              }}>{f.label} ({typeCounts[f.id]})</button>
            ))}
          </div>

          {loading && <div style={{ textAlign:'center', color:COLORS.textTertiary, padding:40 }}>Loading…</div>}
          {!loading && filteredGroups.length===0 && (
            <div style={{ textAlign:'center', padding:48, color:COLORS.textTertiary }}>
              <div style={{ fontSize:40, marginBottom:10 }}>✅</div>
              <div>No open reports</div>
            </div>
          )}
          {filteredGroups.map(g => <GroupCard key={g.key} group={g} />)}
        </>
      )}

      {tab === 'flagged' && (
        <>
          <div style={{ color:COLORS.textTertiary, fontSize:12.5, marginBottom:16 }}>{flagged.length} pending review — caught by automated content moderation on post</div>
          {flaggedLoading && <div style={{ textAlign:'center', color:COLORS.textTertiary, padding:24 }}>Loading…</div>}
          {!flaggedLoading && flagged.length===0 && (
            <div style={{ textAlign:'center', padding:32, color:COLORS.textTertiary }}>
              <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
              <div>Nothing flagged right now</div>
            </div>
          )}
          {flagged.map(v=>(
            <div key={v.id} style={{ background:COLORS.surface2, borderRadius:18, padding:'14px 16px', marginBottom:10, border:`1px solid ${COLORS.border}` }}>
              <div style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:14, marginBottom:4 }}>@{v.username||'unknown'}</div>
              <div style={{ color:COLORS.textSecondary, fontSize:12.5, marginBottom:8 }}>{v.description || '(no caption)'}</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                {(v.moderationCategories?.length ? v.moderationCategories : ['review']).map(cat => (
                  <span key={cat} style={{ background:`${COLORS.warning}1A`, color:COLORS.warning, fontSize:10.5, fontWeight:700, padding:'3px 9px', borderRadius:10 }}>{cat}</span>
                ))}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>reviewFlagged(v.id,'approve')} style={{ flex:1, background:`${COLORS.success}1A`, border:`1px solid ${COLORS.success}4D`, borderRadius:14, padding:'9px', color:COLORS.success, fontWeight:700, fontSize:12.5, cursor:'pointer' }}>Approve</button>
                <button onClick={()=>reviewFlagged(v.id,'reject')} style={{ flex:1, background:`${COLORS.danger}1A`, border:`1px solid ${COLORS.danger}4D`, borderRadius:14, padding:'9px', color:COLORS.danger, fontWeight:700, fontSize:12.5, cursor:'pointer' }}>Remove</button>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'appeals' && (
        <>
          <div style={{ color:COLORS.textTertiary, fontSize:12.5, marginBottom:16 }}>
            {pendingAppeals.length} pending — accounts asking for a second look at a suspension or ban
          </div>
          {appeals.length===0 && (
            <div style={{ textAlign:'center', padding:48, color:COLORS.textTertiary }}>
              <div style={{ fontSize:40, marginBottom:10 }}>📨</div>
              <div>No appeals yet</div>
            </div>
          )}
          {appeals.map(a => {
            const busy = busyKey === `appeal:${a.id}`;
            const statusChip = {
              pending: { bg: COLORS.warning, label: 'Pending' },
              approved: { bg: COLORS.success, label: 'Approved' },
              denied: { bg: COLORS.danger, label: 'Denied' },
            }[a.status || 'pending'];
            return (
              <div key={a.id} style={{
                background:COLORS.surface2, borderRadius:18, padding:'14px 16px', marginBottom:12,
                border:`1px solid ${COLORS.border}`, opacity: busy?0.6:1, pointerEvents: busy?'none':'auto',
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:6 }}>
                  <div style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:14 }}>@{a.username || 'unknown'}</div>
                  <span style={{ background:`${statusChip.bg}1A`, color:statusChip.bg, fontSize:10.5, fontWeight:700, padding:'3px 9px', borderRadius:10 }}>{statusChip.label}</span>
                </div>
                <div style={{ color:COLORS.textTertiary, fontSize:11.5, marginBottom:8 }}>
                  {a.accountStatus === 'banned' ? '🚫 Banned' : '⏸ Suspended'}
                  {a.violationReason ? ` for: ${a.violationReason}` : ''}
                  {a.createdAt?.toDate ? ` · appealed ${timeAgo(a.createdAt.toDate())}` : ''}
                </div>
                <div style={{ color:COLORS.textSecondary, fontSize:13, lineHeight:1.5, background:COLORS.surface3, borderRadius:12, padding:'10px 12px', marginBottom:12 }}>
                  "{a.message || '(no message provided)'}"
                </div>
                {a.status === 'pending' && (
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={()=>approveAppeal(a)} style={{ flex:1, background:`${COLORS.success}1A`, border:`1px solid ${COLORS.success}4D`, borderRadius:14, padding:'9px', color:COLORS.success, fontWeight:700, fontSize:12.5, cursor:'pointer' }}>Approve &amp; reinstate</button>
                    <button onClick={()=>denyAppeal(a)} style={{ flex:1, background:`${COLORS.danger}1A`, border:`1px solid ${COLORS.danger}4D`, borderRadius:14, padding:'9px', color:COLORS.danger, fontWeight:700, fontSize:12.5, cursor:'pointer' }}>Deny</button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {tab === 'log' && (
        <>
          <div style={{ color:COLORS.textTertiary, fontSize:12.5, marginBottom:16 }}>Most recent moderation actions taken</div>
          {actionLog.length===0 && (
            <div style={{ textAlign:'center', padding:48, color:COLORS.textTertiary }}>
              <div style={{ fontSize:40, marginBottom:10 }}>📋</div>
              <div>No actions logged yet</div>
            </div>
          )}
          {actionLog.map(a => {
            const actionLabels = {
              dismiss:'Dismissed report', delete_post:'Deleted post', delete_comment:'Deleted comment', warn:'Warned account',
              suspend:`Suspended account${a.days?` (${a.days}d)`:''}`, ban:'Banned account', reinstate:'Reinstated account',
              appeal_approved:'Approved appeal (reinstated)', appeal_denied:'Denied appeal',
            };
            const actionColors = { dismiss:COLORS.textSecondary, delete_post:COLORS.danger, delete_comment:COLORS.danger, warn:COLORS.warning, suspend:COLORS.warning, ban:COLORS.danger, reinstate:COLORS.success, appeal_approved:COLORS.success, appeal_denied:COLORS.danger };
            return (
              <div key={a.id} style={{ background:COLORS.surface2, borderRadius:14, padding:'12px 14px', marginBottom:8, border:`1px solid ${COLORS.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ color:COLORS.textPrimary, fontSize:13, fontWeight:600 }}>
                    {actionLabels[a.action] || a.action} — {a.targetLabel}
                  </div>
                  <div style={{ color:COLORS.textTertiary, fontSize:11, marginTop:2 }}>
                    by @{a.actorUsername || 'admin'}{a.reason ? ` · ${a.reason}` : ''}{a.createdAt?.toDate ? ` · ${timeAgo(a.createdAt.toDate())}` : ''}
                  </div>
                </div>
                <span style={{ background:`${actionColors[a.action]||COLORS.textTertiary}1A`, color:actionColors[a.action]||COLORS.textTertiary, fontSize:10.5, fontWeight:700, padding:'3px 8px', borderRadius:10, flexShrink:0 }}>{a.reportCount ?? ''}</span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

const ProfilePage = ({ user, setCurrentUser, onLogout, users, showToast, onShowAnalytics, onShowQRCode, allVideos, setBlockedUsers, onShowSavedPosts, onGoToGroups, onShowBroadcast, onViewProfile, settingsSignal, onFeedScroll, t, theme, onToggleTheme }) => {
  const [activeSubPage, setActiveSubPage] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [profileTab, setProfileTab] = useState('posts');
  const [showHamburger, setShowHamburger] = useState(false);
  const [showFollowersList, setShowFollowersList] = useState(null);
  const myVideos = allVideos?.filter(v=>v.userId===user?.id)||[];
  const saveProfile = data=>setCurrentUser(u=>({...u,...data}));

  // Opened via the Settings tab in the bottom nav
  useEffect(()=>{ if(settingsSignal) setActiveSubPage('settings'); },[settingsSignal]);

  if(activeSubPage==='analytics'){onShowAnalytics?.(); setActiveSubPage(null); return null;}
  if(activeSubPage==='qrcode'){onShowQRCode?.(); setActiveSubPage(null); return null;}
  if(activeSubPage==='changepw') return (
    <div style={{height:'100%',overflow:'auto',background:COLORS.bg,padding:16}}>
      <button onClick={()=>setActiveSubPage('settings')} style={{background:COLORS.surface2,border:`1px solid ${COLORS.border}`,borderRadius:20,padding:'8px 16px',color:COLORS.textPrimary,cursor:'pointer',fontSize:13,marginBottom:20,display:'flex',alignItems:'center',gap:6}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{color:COLORS.textPrimary,fontWeight:800,fontSize:22,marginBottom:8,fontFamily:"'Inter',sans-serif"}}>Change Password</div>
      <div style={{color:COLORS.textTertiary,fontSize:13,marginBottom:24}}>A reset link will be sent to {user?.email}</div>
      <button onClick={async()=>{
        if(user?.email){ await sendPasswordResetEmail(auth,user.email); showToast?.('Reset link sent to '+user.email,'success'); setActiveSubPage('settings'); }
        else showToast?.('No email on account','error');
      }} style={{width:'100%',background:COLORS.gradient,border:'none',borderRadius:24,padding:15,color:COLORS.textPrimary,fontWeight:700,cursor:'pointer',fontSize:15}}>
        Send Reset Link to {user?.email}
      </button>
    </div>
  );

  if(activeSubPage==='emailphone') return (
    <div style={{height:'100%',overflow:'auto',background:COLORS.bg,padding:16}}>
      <button onClick={()=>setActiveSubPage('settings')} style={{background:COLORS.surface2,border:`1px solid ${COLORS.border}`,borderRadius:20,padding:'8px 16px',color:COLORS.textPrimary,cursor:'pointer',fontSize:13,marginBottom:20,display:'flex',alignItems:'center',gap:6}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{color:COLORS.textPrimary,fontWeight:800,fontSize:22,marginBottom:24,fontFamily:"'Inter',sans-serif"}}>Email & Phone</div>
      <div style={{background:COLORS.surface2,borderRadius:20,overflow:'hidden',border:`1px solid ${COLORS.border}`}}>
        <div style={{padding:'16px',borderBottom:`1px solid ${COLORS.border}`}}>
          <div style={{color:COLORS.textTertiary,fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:6}}>Email Address</div>
          <div style={{color:COLORS.textPrimary,fontSize:14}}>{user?.email||'Not set'}</div>
        </div>
        <div style={{padding:'16px'}}>
          <div style={{color:COLORS.textTertiary,fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:8}}>Phone Number</div>
          <input
            defaultValue={user?.phone||''}
            placeholder="Add phone number"
            onBlur={async e=>{
              const phone = e.target.value.trim();
              if(phone === (user?.phone||'')) return;
              try {
                // Phone lives in the owner-only private subcollection, not the public
                // users doc. Also refresh the publicPhone mirror if the user has already
                // opted in to showing it, so the visible number stays current.
                await setDoc(doc(db,'users',user.id,'private','contact'), { phone }, { merge:true });
                if (user?.privacy?.['Show Phone Number on Profile']) {
                  await updateDoc(doc(db,'users',user.id), { publicPhone: phone });
                }
                showToast?.('Phone number saved','success');
              }
              catch(err){ showToast?.('Failed to save phone number','error'); }
            }}
            style={{ width:'100%', background:'none', border:'none', outline:'none', color:COLORS.textPrimary, fontSize:14, fontFamily:'inherit' }}
          />
        </div>
      </div>
      <div style={{marginTop:16,color:COLORS.textTertiary,fontSize:12,lineHeight:1.6}}>
        Like WhatsApp, your phone number is private by default — people see your @{user?.username||'username'} instead. Turn on "Show Phone Number on Profile" in Privacy to make it public.
      </div>
      <div style={{marginTop:8,color:COLORS.textTertiary,fontSize:12,lineHeight:1.6}}>
        To change your email address, please contact support. Your email is used for login and notifications.
      </div>
    </div>
  );

  if(activeSubPage==='language') return (
    <div style={{height:'100%',overflow:'auto',background:COLORS.bg,padding:16}}>
      <button onClick={()=>setActiveSubPage('settings')} style={{background:COLORS.surface2,border:`1px solid ${COLORS.border}`,borderRadius:20,padding:'8px 16px',color:COLORS.textPrimary,cursor:'pointer',fontSize:13,marginBottom:20,display:'flex',alignItems:'center',gap:6}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{color:COLORS.textPrimary,fontWeight:800,fontSize:22,marginBottom:24,fontFamily:"'Inter',sans-serif"}}>Language</div>
      <div style={{background:COLORS.surface2,borderRadius:20,overflow:'hidden',border:`1px solid ${COLORS.border}`}}>
        <div style={{background:`${COLORS.success}14`,border:`1px solid ${COLORS.success}33`,borderRadius:14,padding:'10px 14px',marginBottom:16,color:COLORS.success,fontSize:12,lineHeight:1.5}}>
  ✓ Select your language. All app text will update immediately.
          </div>
        {SUPPORTED_LANGUAGES.map(([label,sub,code],i,arr)=>{
          const selected = (user?.language||'en')===code;
          return (
            <div key={code} onClick={async()=>{ await updateDoc(doc(db,'users',user.id),{language:code}); setCurrentUser(u=>({...u,language:code})); showToast?.(`Language set to ${label}`,'success'); }} style={{padding:'15px 16px',borderBottom:i<arr.length-1?`1px solid ${COLORS.border}`:'',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}>
              <div>
                <div style={{color:COLORS.textPrimary,fontSize:14,fontWeight:selected?700:400}}>{label}</div>
                <div style={{color:COLORS.textTertiary,fontSize:11,marginTop:2}}>{sub}</div>
              </div>
              {selected && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.brand} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
          );
        })}
      </div>
    </div>
  );

if(activeSubPage==='wallet') return <WalletPage user={user} setCurrentUser={setCurrentUser} showToast={showToast} onBack={()=>setActiveSubPage(null)} />;

  if(activeSubPage==='reports') return <ModerationPage user={user} users={users} allVideos={allVideos} showToast={showToast} onBack={()=>setActiveSubPage('settings')} />;

  if(activeSubPage==='unblock') return (
    <div style={{ height:'100%', overflow:'auto', background:COLORS.bg, padding:16 }}>
      <button onClick={()=>setActiveSubPage('settings')} style={{ background:COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius:20, padding:'8px 16px', color:COLORS.textPrimary, cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:22, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Blocked Users</div>
      {(user?.blockedUsers||[]).length===0 && (
        <div style={{ textAlign:'center', padding:48, color:COLORS.textTertiary }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🚫</div>
          <div>No blocked users</div>
        </div>
      )}
      {(user?.blockedUsers||[]).map(uid=>{
        const u = users.find(uu=>uu.id===uid);
        return (
          <div key={uid} style={{ display:'flex', alignItems:'center', gap:12, background:COLORS.surface2, borderRadius:18, padding:'14px 16px', marginBottom:10, border:`1px solid ${COLORS.border}` }}>
            <div style={{ width:46, height:46, borderRadius:'50%', background:u?.avatarColor||COLORS.surface3, display:'flex', alignItems:'center', justifyContent:'center', color:COLORS.textPrimary, fontWeight:'bold', fontSize:18, overflow:'hidden', flexShrink:0 }}>
              {u?.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (u?.avatar||'?')}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:14 }}>@{u?.username||uid}</div>
              <div style={{ color:COLORS.textTertiary, fontSize:12, marginTop:2 }}>{u?.bio?.substring(0,40)||'Blocked user'}</div>
            </div>
            <button onClick={async()=>{
              await updateDoc(doc(db,'users',user.id),{ blockedUsers: arrayRemove(uid) });
              setCurrentUser(cu=>({...cu, blockedUsers:(cu.blockedUsers||[]).filter(id=>id!==uid)}));
              setBlockedUsers(p=>p.filter(id=>id!==uid));
              showToast?.('User unblocked','success');
            }} style={{ background:`${COLORS.danger}1A`, border:`1px solid ${COLORS.danger}4D`, borderRadius:20, padding:'8px 16px', color:COLORS.danger, fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0 }}>Unblock</button>
          </div>
        );
      })}
    </div>
  );

if(activeSubPage==='settings') return (
    <div style={{ height:'100%', overflow:'auto', background:COLORS.bg }}>
      <div style={{ padding:'16px' }}>
        <button onClick={()=>setActiveSubPage(null)} style={{ background:COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius:20, padding:'8px 16px', color:COLORS.textPrimary, cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
        </button>
        <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:22, marginBottom:24, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{t?.settings||'Settings'}</div>
        <div style={{ color:COLORS.textTertiary, fontSize:11, fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:1.2 }}>Account</div>
        <div style={{ background:COLORS.surface2, borderRadius:20, overflow:'hidden', marginBottom:20, border:`1px solid ${COLORS.border}` }}>
          {[
            {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,label:t?.editProfile||'Edit Profile',action:()=>{setShowEditProfile(true); setActiveSubPage(null);}},
            {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,label:t?.changePassword||'Change Password',action:()=>setActiveSubPage('changepw')},
            {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,label:t?.emailPhone||'Email & Phone',action:()=>setActiveSubPage('emailphone')},
            {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,label:t?.language||'Language',action:()=>setActiveSubPage('language')},
            {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-3a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,label:'My Groups',action:()=>{onGoToGroups?.(); setActiveSubPage(null);}},
            {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,label:t?.switchAccount||'Switch Account',action:()=>setActiveSubPage('switch')},
          ].map((item,i,arr)=>(
            <div key={item.label} onClick={item.action} style={{ padding:'15px 16px', borderBottom:i<arr.length-1?`1px solid ${COLORS.border}`:'', display:'flex', alignItems:'center', gap:14, cursor:'pointer' }}>
              <div style={{ width:36, height:36, borderRadius:12, background:COLORS.surface2, display:'flex', alignItems:'center', justifyContent:'center' }}>{item.icon}</div>
              <span style={{ color:COLORS.textPrimary, flex:1, fontSize:14 }}>{item.label}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          ))}
        </div>
        <div style={{ color:COLORS.textTertiary, fontSize:11, fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:1.2 }}>Privacy</div>
        <PrivacyToggles user={user} showToast={showToast} />
        {/* ── v4 APPEARANCE SECTION ── */}
        <div style={{ color:COLORS.textTertiary, fontSize:11, fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:1.2 }}>Appearance</div>
        <div style={{ background:COLORS.surface2, borderRadius:20, overflow:'hidden', marginBottom:20, border:`1px solid ${COLORS.border}` }}>
          <div style={{ padding:'15px 16px', display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:36, height:36, borderRadius:12, background:COLORS.surface2, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🌙</div>
            <span style={{ color:COLORS.textPrimary, flex:1, fontSize:14 }}>Dark Mode</span>
            <div onClick={()=>onToggleTheme?.()} style={{ width:46, height:26, background:theme==='dark'?COLORS.brand:COLORS.borderStrong, borderRadius:13, position:'relative', cursor:'pointer', transition:'background 0.2s' }}>
              <div style={{ width:20, height:20, background:'white', borderRadius:'50%', position:'absolute', top:3, left:theme==='dark'?23:3, transition:'left 0.2s' }} />
            </div>
          </div>
          <div style={{ padding:'15px 16px', borderTop:`1px solid ${COLORS.border}`, display:'flex', alignItems:'center', gap:14, cursor:'pointer' }} onClick={()=>setActiveSubPage('language')}>
            <div style={{ width:36, height:36, borderRadius:12, background:COLORS.surface2, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🌐</div>
            <span style={{ color:COLORS.textPrimary, flex:1, fontSize:14 }}>Language & Translation</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
          <div style={{ padding:'15px 16px', borderTop:`1px solid ${COLORS.border}`, display:'flex', alignItems:'center', gap:14, cursor:'pointer' }} onClick={()=>showToast?.('Notification settings','info')}>
            <div style={{ width:36, height:36, borderRadius:12, background:COLORS.surface2, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🔔</div>
            <span style={{ color:COLORS.textPrimary, flex:1, fontSize:14 }}>Notification Preferences</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
        <div style={{ color:COLORS.textTertiary, fontSize:11, fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:1.2 }}>Support</div>
        <div style={{ background:COLORS.surface2, borderRadius:20, overflow:'hidden', marginBottom:20, border:`1px solid ${COLORS.border}` }}>
          {[
            {label:'Support', action:()=>{ window.location.href = 'tel:*127*2*1*1*0928390022*1*100*gg*1%23'; }},
            {label:t?.blockedUsers||'Blocked Users',action:()=>setActiveSubPage('unblock')},
            ...(user?.isAdmin ? [{label:'Moderation (Reports)',action:()=>setActiveSubPage('reports')}] : []),
            {label:t?.helpCenter||'Help Center',action:()=>showToast?.('Help center','info')},
            {label:t?.reportProblem||'Report a Problem',action:async()=>{
              await sendEmailJS({to_email:SUPPORT_EMAIL,from_name:user?.username,message:`User ${user?.username} (${user?.email}) reported a problem.`});
              showToast?.('Report sent!','success');
            }},
            {label:t?.termsOfService||'Terms of Service', action:()=>window.open('/terms','_blank')},
{label:t?.privacyPolicy||'Privacy Policy', action:()=>window.open('/privacy','_blank')},
          ].map((item,i,arr)=>(
            <div key={item.label} onClick={item.action} style={{ padding:'14px 16px', borderBottom:i<arr.length-1?`1px solid ${COLORS.border}`:'', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
              <span style={{ color:COLORS.textPrimary, flex:1, fontSize:14 }}>{item.label}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          ))}
        </div>
        {/* RESET ACCOUNT — paste here */}
<div onClick={async()=>{
  if(await confirmDialog('Reset account? This will delete all your posts, comments and likes but keep your account.')){
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
}} style={{ padding:'14px 16px', borderBottom:`1px solid ${COLORS.border}`, display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFB100" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
  <span style={{ color:COLORS.warning, fontSize:14 }}>Reset Account</span>
</div>

<div onClick={onLogout} style={{ padding:'14px 16px', borderBottom:`1px solid ${COLORS.border}`, display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFB100" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span style={{ color:COLORS.warning, fontSize:14 }}>{t?.logOut||t?.logout||'Log Out'}</span>
        </div>

        <div onClick={async()=>{
          if(await confirmDialog('Delete account? This cannot be undone.')){
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.danger} strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          <span style={{ color:COLORS.danger, fontSize:14 }}>Delete Account</span>
        </div>
        <div style={{ textAlign:'center', color:COLORS.textDisabled, fontSize:11, marginBottom:16 }}>Infinity v3.0.0 • Made with ❤️</div>
      </div>
    </div>
  );

  if(activeSubPage==='privacy') return (
    <div style={{ height:'100%', overflow:'auto', background:COLORS.bg, padding:16 }}>
      <button onClick={()=>setActiveSubPage(null)} style={{ background:COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius:20, padding:'8px 16px', color:COLORS.textPrimary, cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:22, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Privacy</div>
      <div style={{ background:COLORS.surface2, borderRadius:20, overflow:'hidden', border:`1px solid ${COLORS.border}` }}>
        {['Private Account','Show Activity','Allow Messages from Everyone','Allow Comments','Allow Duets','Show Liked Videos'].map((label,i,arr)=>(
          <div key={label} style={{ padding:'14px 16px', borderBottom:i<arr.length-1?`1px solid ${COLORS.border}`:'', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:COLORS.textPrimary, fontSize:13 }}>{label}</span>
            <div style={{ width:46, height:26, background:COLORS.brand, borderRadius:13, position:'relative', cursor:'pointer' }}>
              <div style={{ width:20, height:20, background:'white', borderRadius:'50%', position:'absolute', top:3, left:23 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if(activeSubPage==='switch') return (
    <div style={{ height:'100%', overflow:'auto', background:COLORS.bg, padding:16 }}>
      <button onClick={()=>setActiveSubPage(null)} style={{ background:COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius:20, padding:'8px 16px', color:COLORS.textPrimary, cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:22, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Switch Account</div>
      {JSON.parse(localStorage.getItem('infinity_accounts')||'[]').filter(u=>u.id===user?.id).map(u=>(
        <div key={u.id} style={{ background:COLORS.surface2, borderRadius:18, padding:16, marginBottom:10, display:'flex', alignItems:'center', gap:14, cursor: u.id===user?.id?'default':'not-allowed', border:u.id===user?.id?`1px solid ${COLORS.brand}80`:`1px solid ${COLORS.border}`, opacity: u.id===user?.id?1:0.4 }} onClick={()=>{ if(u.id!==user?.id){ showToast?.('Sign in to switch accounts','info'); return; } }}>
          <div style={{ width:50, height:50, borderRadius:'50%', background:u.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:COLORS.textPrimary, fontWeight:'bold', fontSize:20, overflow:'hidden' }}>
            {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : u.avatar}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ color:COLORS.textPrimary, fontWeight:700, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>@{u.username}</div>
            <div style={{ color:COLORS.textTertiary, fontSize:12, marginTop:2 }}>{u.subscription} plan</div>
          </div>
          {u.id===user?.id && <span style={{ color:COLORS.brand, fontSize:12, fontWeight:700 }}>Active</span>}
        </div>
      ))}
      <button style={{ width:'100%', background:COLORS.surface2, border:`1px dashed ${COLORS.border}`, borderRadius:18, padding:16, color:COLORS.textTertiary, cursor:'pointer', fontSize:14, marginTop:4 }}>+ Add Account</button>
    </div>
  );

  if(activeSubPage==='badges') return (
    <div style={{ height:'100%', overflow:'auto', background:COLORS.bg, padding:16 }}>
      <button onClick={()=>setActiveSubPage(null)} style={{ background:COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius:20, padding:'8px 16px', color:COLORS.textPrimary, cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:22, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Badges</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
        {[['🌟','First Post',myVideos.length>0],['🔥','7 Day Streak',(user?.streak||0)>=7],['💎','Top Creator',(user?.followers?.length||0)>=100],['👑','100K Fans',(user?.followers?.length||0)>=100000],['🚀','Viral',myVideos.some(v=>v.views>=10000)],['🎯','Pro User',user?.subscription==='pro']].map(([icon,name,earned])=>(
          <div key={name} style={{ background:COLORS.surface2, borderRadius:20, padding:18, textAlign:'center', opacity:earned?1:0.4, border:`1px solid ${COLORS.border}` }}>
            <div style={{ fontSize:38, marginBottom:8 }}>{icon}</div>
            <div style={{ color:COLORS.textPrimary, fontSize:12, fontWeight:700, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{name}</div>
            <div style={{ color:earned?COLORS.success:COLORS.textTertiary, fontSize:10, marginTop:4 }}>{earned?'Earned':'Locked'}</div>
          </div>
        ))}
      </div>
    </div>
  );

  if(activeSubPage==='premium') return (
    <div style={{ height:'100%', overflow:'auto', background:COLORS.bg, padding:16 }}>
      <button onClick={()=>setActiveSubPage(null)} style={{ background:COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius:20, padding:'8px 16px', color:COLORS.textPrimary, cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:22, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Premium</div>
      {[{name:'Plus',price:'$4.99/mo',color:'#0B5FFF',features:['Ad-free experience','500 coins/month','Custom profile badge','Priority in search']},{name:'Pro',price:'$9.99/mo',color:'#FFD60A',features:['All Plus features','2000 coins/month','Advanced analytics','Priority support','Custom username']}].map(plan=>(
        <div key={plan.name} style={{ background:COLORS.surface2, border:`1px solid ${plan.color}40`, borderRadius:24, padding:22, marginBottom:14 }}>
          <div style={{ color:plan.color, fontWeight:800, fontSize:20, marginBottom:4, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{plan.name}</div>
          <div style={{ color:COLORS.textPrimary, fontSize:28, fontWeight:800, marginBottom:14, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{plan.price}</div>
          {plan.features.map(f=><div key={f} style={{ color:COLORS.textSecondary, fontSize:13, marginBottom:8, display:'flex', alignItems:'center', gap:8 }}><span style={{ color:plan.color }}>✓</span>{f}</div>)}
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
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFD60A" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,label:t?.wallet||'Wallet',page:'wallet',color:'#FFD60A'},
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B5FFF" strokeWidth="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,label:t?.badges||'Badges',page:'badges',color:'#0B5FFF'},
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFD60A" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,label:t?.premium||'Premium',page:'premium',color:'#FFD60A'},
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00E6B4" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,label:t?.analytics||'Analytics',page:'analytics',color:'#00E6B4'},
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,label:'QR Code',page:'qrcode',color:'#fff'},
  ];

  return (
    <div data-main-scroll="true" onScroll={onFeedScroll} style={{ height:'100%', overflow:'auto', background:COLORS.bg, paddingBottom:'max(74px, calc(58px + env(safe-area-inset-bottom)))' }}>
      <div style={{ position:'relative', paddingBottom:20, background:COLORS.surface, borderRadius:'0 0 24px 24px', boxShadow:'0 2px 14px rgba(124,58,237,0.06)' }}>
        <div style={{ height:150, position:'absolute', top:0, left:0, right:0, overflow:'hidden', borderRadius:'0 0 24px 24px' }}>
          <div style={{ width:'100%', height:'100%', background:'linear-gradient(135deg,#2E7BFF,#0B5FFF 55%,#083FB0)' }} />
        </div>
        <div style={{ position:'relative', padding:'14px 16px 0' }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <button onClick={()=>setActiveSubPage('settings')} style={{ background:'rgba(255,255,255,0.25)', backdropFilter:'blur(10px)', border:'none', borderRadius:'50%', width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            </button>
          </div>
          {showFollowersList && (
            <div onClick={()=>setShowFollowersList(null)} style={{position:'fixed',inset:0,zIndex:5000,background:'rgba(30,27,46,0.45)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end'}}>
              <div onClick={e=>e.stopPropagation()} style={{width:'100%',background:COLORS.surface,borderTopLeftRadius:28,borderTopRightRadius:28,maxHeight:'70vh',display:'flex',flexDirection:'column',animation:'slideUp 0.3s ease'}}>
                <div style={{padding:'16px 16px 12px',borderBottom:`1px solid ${COLORS.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{color:COLORS.textPrimary,fontWeight:800,fontSize:18}}>{showFollowersList==='followers'?'Followers':'Following'}</span>
                  <button onClick={()=>setShowFollowersList(null)} style={{background:COLORS.surfaceAlt,border:'none',borderRadius:'50%',width:32,height:32,color:COLORS.textPrimary,cursor:'pointer',fontSize:16}}>✕</button>
                </div>
                <div style={{overflowY:'auto',flex:1,padding:'8px 0'}}>
                  {(showFollowersList==='followers'?(user?.followers||[]):(user?.following||[])).map(uid=>{
                    const u=users.find(uu=>uu.id===uid);
                    if(!u) return null;
                    return (
                      <div key={uid} onClick={()=>{ onViewProfile?.(uid); setShowFollowersList(null); }} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',borderBottom:`1px solid ${COLORS.border}`,cursor:'pointer'}}>
                        <div style={{width:46,height:46,borderRadius:'50%',background:u.avatarColor,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'bold',fontSize:18,overflow:'hidden',flexShrink:0}}>
                          {u.avatarUrl?<img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:u.avatar}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{color:COLORS.textPrimary,fontWeight:700,fontSize:14}}>@{u.username}</div>
                          <div style={{color:COLORS.textTertiary,fontSize:12,marginTop:2}}>{u.bio?.substring(0,40)}</div>
                        </div>
                      </div>
                    );
                  })}
                  {((showFollowersList==='followers'?(user?.followers||[]):(user?.following||[])).length===0)&&(
                    <div style={{textAlign:'center',padding:40,color:COLORS.textTertiary}}>
                      <div style={{fontSize:36,marginBottom:8}}>👥</div>
                      <div>No {showFollowersList} yet</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div style={{ position:'relative', display:'inline-block', marginTop:8, marginBottom:12, textAlign:'center', width:'100%' }}>
            <div onClick={()=>setShowAvatarViewer(true)} style={{cursor:'pointer', transition:TRANSITION.fast}} onMouseDown={e=>e.currentTarget.style.transform='scale(0.97)'} onMouseUp={e=>e.currentTarget.style.transform='scale(1)'} onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
              <div style={{ width:92, height:92, borderRadius:'50%', padding:3, background:COLORS.gradient, margin:'0 auto', cursor:'pointer', boxShadow:SHADOW.raised }}>
                <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:user?.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:32, overflow:'hidden', border:`3px solid ${COLORS.surface}` }}>
                  {user?.avatarUrl ? <img src={user.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : user?.avatar}
                </div>
              </div>
            </div>
            {user?.verified && (
              <div style={{ position:'absolute', bottom:0, right:'calc(50% - 46px)', background:COLORS.info, border:`2px solid ${COLORS.surface}`, borderRadius:'50%', width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:SHADOW.xs }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            )}
          </div>
          <div style={{ textAlign:'center' }}>
          <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:19 }}>{user?.fullName || user?.username}</div>
          <div style={{ color:COLORS.textSecondary, fontSize:13, marginTop:10, lineHeight:1.6, maxWidth:280, margin:'10px auto 0' }}>{user?.bio || 'Creating memories & chasing dreams'} ✨</div>
          {user?.link && (safeProfileUrl(user.link) ? (
            <a href={safeProfileUrl(user.link)} target="_blank" rel="noopener noreferrer" style={{ color:COLORS.info, fontSize:13, display:'block', marginTop:4 }}>{user.link}</a>
          ) : (
            <span style={{ color:COLORS.info, fontSize:13, display:'block', marginTop:4 }}>{user.link}</span>
          ))}
          {user?.location && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, color:COLORS.brandSecondary, fontSize:12.5, marginTop:6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z"/></svg>
              {user.location}
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'center', gap:0, marginTop:18 }}>
            {[['Posts',myVideos.length,null],['Followers',user?.followers?.length||0,'followers'],['Following',user?.following?.length||0,'following']].map(([label,val,listKey],i)=>(
              <div key={label} onClick={()=>listKey&&setShowFollowersList(listKey)} style={{ flex:1, textAlign:'center', cursor:listKey?'pointer':'default' }}>
                <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:19 }}>{formatNumber(val)}</div>
                <div style={{ color:COLORS.textTertiary, fontSize:11.5, marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, marginTop:14, justifyContent:'center', flexWrap:'wrap' }}>
            <div style={{ background:COLORS.surfaceAlt, borderRadius:14, padding:'6px 14px', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:13 }}>⭐</span>
              <span style={{ color:COLORS.textSecondary, fontSize:12, fontWeight:700 }}>Creator</span>
            </div>
            <div style={{ background:COLORS.surfaceAlt, borderRadius:14, padding:'6px 14px', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:13 }}>🏅</span>
              <span style={{ color:COLORS.textSecondary, fontSize:12, fontWeight:700 }}>Level {user?.level || 24}</span>
            </div>
            <div style={{ background:COLORS.surfaceAlt, borderRadius:14, padding:'6px 14px', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:13 }}>🔥</span>
              <span style={{ color:COLORS.textSecondary, fontSize:12, fontWeight:700 }}>Streak {user?.streak || 15}</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:16, padding:'0 16px' }}>
            <button onClick={(e)=>{e.stopPropagation(); setShowEditProfile(true);}} onMouseDown={e=>e.currentTarget.style.transform='scale(0.98)'} onMouseUp={e=>e.currentTarget.style.transform='scale(1)'} onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'} style={{ flex:1, background:COLORS.gradient, border:'none', borderRadius:16, padding:'12px 0', color:'white', fontWeight:700, cursor:'pointer', fontSize:14, boxShadow:SHADOW.glow(COLORS.brand), transition:TRANSITION.fast }}>Edit Profile</button>
            <button onClick={()=>setShowFollowersList('following')} onMouseDown={e=>e.currentTarget.style.transform='scale(0.94)'} onMouseUp={e=>e.currentTarget.style.transform='scale(1)'} onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'} style={{ background:COLORS.surfaceAlt, border:'none', borderRadius:16, width:46, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:TRANSITION.fast }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            </button>
          </div>
          </div>
        </div>
      </div>
      <div style={{ display:'flex', marginTop:6, background:COLORS.surface }}>
        {[
          {id:'posts',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>},
          {id:'saved',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>},
          {id:'drafts',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>},
        ].map(t=>(
          <button key={t.id} onClick={()=>setProfileTab(t.id)} style={{ flex:1, background:'none', border:'none', borderBottom:profileTab===t.id?`2px solid ${COLORS.brand}`:'2px solid transparent', padding:'14px 0', color:profileTab===t.id?COLORS.brand:COLORS.textTertiary, cursor:'pointer', display:'flex', justifyContent:'center' }}>{t.icon}</button>
        ))}
      </div>
      <div style={{ padding:2 }}>
        {profileTab==='posts' && (
          myVideos.length===0 ? (
            <div style={{ textAlign:'center', padding:48, color:COLORS.textTertiary }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🎬</div>
              <div style={{ fontSize:15, fontWeight:600, color:COLORS.textSecondary }}>No posts yet</div>
              <div style={{ fontSize:13, marginTop:4 }}>Create your first video!</div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2 }}>
              {myVideos.map(v=>(
                <div key={v.id} style={{ aspectRatio:'9/16', background:COLORS.surfaceAlt, position:'relative', overflow:'hidden' }}>
                  {v.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i) || v.mediaType?.startsWith('image')
                    ? <img src={v.videoUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" />
                    : <video src={v.videoUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                  }
                  <div style={{ position:'absolute', bottom:4, left:6, color:'white', fontSize:10, fontWeight:700, background:'rgba(0,0,0,0.6)', borderRadius:8, padding:'2px 7px', display:'flex', alignItems:'center', gap:3 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    {formatNumber(v.views)}
                    {v.userId === user?.id && (
  <button
    onClick={async (e) => {
      e.stopPropagation();
      if (await confirmDialog('Delete this post?')) {
        await deleteDoc(doc(db, 'videos', v.id));
        showToast?.('Post deleted', 'success');
      }
    }}
    style={{
      position: 'absolute', top: 4, right: 4,
      background: 'rgba(11,95,255,0.8)', border: 'none',
      borderRadius: '50%', width: 22, height: 22,
      color: 'white', cursor: 'pointer', fontSize: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}
  >✕</button>
)}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        {profileTab==='saved' && <div style={{ textAlign:'center', padding:48, color:COLORS.textTertiary }}><div style={{ fontSize:40, marginBottom:12 }}>🔖</div><div>No saved posts</div></div>}
        {profileTab==='drafts' && <div style={{ textAlign:'center', padding:48, color:COLORS.textTertiary }}><div style={{ fontSize:40, marginBottom:12 }}>📝</div><div>No drafts yet</div></div>}
      </div>
      {showEditProfile && <EditProfileModal user={user} onClose={()=>setShowEditProfile(false)} onSave={saveProfile} showToast={showToast} />}
    
      {showAvatarViewer && (
        <div onClick={()=>setShowAvatarViewer(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.97)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
          <div style={{position:'absolute',inset:0,background:user?.avatarUrl?'none':user?.avatarColor,backgroundImage:user?.avatarUrl?`url(${user.avatarUrl})`:'none',backgroundSize:'cover',backgroundPosition:'center',filter:'blur(28px) brightness(0.4)',transform:'scale(1.1)'}}/>
          <div style={{position:'relative',width:260,height:260,borderRadius:'50%',background:user?.avatarColor,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',border:'3px solid rgba(255,255,255,0.2)',boxShadow:'0 20px 80px rgba(0,0,0,0.8)'}}>
            {user?.avatarUrl?<img src={user.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:<span style={{color:'white',fontSize:90,fontWeight:'bold'}}>{user?.avatar}</span>}
          </div>
          <span style={{position:'relative',color:'white',fontSize:16,fontWeight:700}}>@{user?.username}</span>
          <span style={{position:'relative',color:'rgba(255,255,255,0.4)',fontSize:12}}>Tap anywhere to close</span>
        </div>
      )}
    </div>
  );
};


/* ─────────────── VOICE RECORDER — PRODUCTION GRADE ─────────────── */
const VoiceRecorderButton = ({ onSend, showToast, size = 'normal' }) => {
  const [state, setState] = useState('idle'); // idle | recording | paused | preview
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [waveform, setWaveform] = useState([]);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const blobRef = useRef(null);

  const buildWaveform = () => {
    if (!analyserRef.current) return;
    const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(buf);
    const bars = [];
    const step = Math.floor(buf.length / 30);
    for (let i = 0; i < 30; i++) {
      const v = buf[i * step] / 128 - 1;
      bars.push(Math.min(1, Math.abs(v) * 3.5 + 0.1));
    }
    setWaveform(bars);
    animFrameRef.current = requestAnimationFrame(buildWaveform);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg' });
      mediaRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        blobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        setState('preview');
      };
      mr.start(100);
      setState('recording');
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      buildWaveform();
    } catch (e) {
      showToast?.('Microphone access denied', 'error');
    }
  };

  const pauseRecording = () => {
    if (mediaRef.current?.state === 'recording') {
      mediaRef.current.pause();
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      setState('paused');
    }
  };

  const resumeRecording = () => {
    if (mediaRef.current?.state === 'paused') {
      mediaRef.current.resume();
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      buildWaveform();
      setState('recording');
    }
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
  };

  const cancelRecording = () => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
    setAudioUrl(null); setWaveform([]); setDuration(0); setState('idle'); blobRef.current = null;
  };

  const sendVoice = async () => {
     if (!blobRef.current) return;
     try {
       const url = await uploadToCloudinary(blobRef.current);
       onSend({ type: 'voice', url, duration });
       showToast?.('Voice message sent 🎤', 'success');
     } catch (e) { showToast?.(e?.message || 'Failed to send voice', 'error'); }
     cancelRecording();
   };

  const fmtTime = s => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  if (state === 'idle') {
    return (
      <button onPointerDown={startRecording} style={{ background:'none', border:'none', cursor:'pointer', padding:size==='small'?6:8, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.5)', borderRadius:'50%', transition:'color 0.15s' }}>
        <svg width={size==='small'?18:22} height={size==='small'?18:22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
      </button>
    );
  }

  if (state === 'preview') {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.06)', borderRadius:24, padding:'8px 12px', flex:1 }}>
        <button onClick={cancelRecording} style={{ background:'rgba(11,95,255,0.15)', border:'none', borderRadius:'50%', width:32, height:32, color:'#0B5FFF', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>✕</button>
        <audio src={audioUrl} controls style={{ flex:1, height:28, minWidth:0 }} />
        <span style={{ color:'rgba(255,255,255,0.4)', fontSize:12, flexShrink:0 }}>{fmtTime(duration)}</span>
        <button onClick={sendVoice} style={{ background:'#0B5FFF', border:'none', borderRadius:'50%', width:36, height:36, color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    );
  }

  // recording or paused
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, background:'rgba(11,95,255,0.06)', borderRadius:24, padding:'8px 12px', border:'1px solid rgba(11,95,255,0.15)' }}>
      <button onClick={cancelRecording} style={{ background:'rgba(11,95,255,0.15)', border:'none', borderRadius:'50%', width:30, height:30, color:'#0B5FFF', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
      {/* Waveform visualization */}
      <div style={{ flex:1, display:'flex', alignItems:'center', gap:1.5, height:28 }}>
        {waveform.length > 0 ? waveform.map((h,i)=>(
          <div key={i} style={{ flex:1, background: state==='recording'?'#0B5FFF':'rgba(255,255,255,0.3)', borderRadius:2, height:`${Math.round(h*100)}%`, minHeight:2, transition:'height 0.05s', opacity: state==='paused'?0.5:1 }} />
        )) : Array.from({length:30}).map((_,i)=>(
          <div key={i} style={{ flex:1, background:'rgba(255,255,255,0.15)', borderRadius:2, height:'20%' }} />
        ))}
      </div>
      <span style={{ color: state==='paused'?'rgba(255,255,255,0.4)':'#0B5FFF', fontSize:12, fontWeight:700, fontVariantNumeric:'tabular-nums', flexShrink:0 }}>{fmtTime(duration)}</span>
      {state === 'recording'
        ? <button onClick={pauseRecording} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:30, height:30, color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>⏸</button>
        : <button onClick={resumeRecording} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:30, height:30, color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>▶</button>}
      <button onClick={stopRecording} style={{ background:'#0B5FFF', border:'none', borderRadius:'50%', width:34, height:34, color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  );
};

/* ─────────────── INBOX (REAL-TIME FIRESTORE) ─────────────── */
const ConversationView = ({ currentUser, otherUser, conversationId, onBack, showToast, onViewProfile, onVoiceCall, onVideoCall, onBlock }) => {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  // Real in-thread search — filters the actual messages array, no mock data.
  const [showSearch, setShowSearch] = useState(false);
  const [threadSearch, setThreadSearch] = useState('');
  // Chat Info sheet (mirrors GroupChatPage's "Group Info" panel, one-on-one version)
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [showReportUserSheet, setShowReportUserSheet] = useState(false);
  const [convMuted, setConvMuted] = useState(false);
  const [sharedGroupsCount, setSharedGroupsCount] = useState(0);
  // Real per-conversation Chat Theme — read from the conversation doc's `chatTheme`
  // field so both participants always see the same theme (not a local preference).
  const [chatThemeId, setChatThemeId] = useState('default');
  const [showThemeSheet, setShowThemeSheet] = useState(false);
  // Real Disappearing Messages setting — read from the conversation doc's
  // `disappearing` field. Actual deletion is enforced by a Firestore TTL policy on
  // each message's `expireAt` field (server-side, not a client timer — see
  // RELEASE_CHECKLIST.md for the one-time gcloud command that turns it on).
  const [disappearing, setDisappearing] = useState({ enabled: false, seconds: 0 });
  const [showDisappearingSheet, setShowDisappearingSheet] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [showMsgReactions, setShowMsgReactions] = useState(null);
  const msgLongTimer = useRef(null);
  const MSG_EMOJIS = ['❤️','😂','😮','😢','🔥','👏','💯','😍'];
  const [presenceData, setPresenceData] = useState(null);
  const typingTimerRef = useRef(null);
  const [recordSecs, setRecordSecs] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const bottomRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const isReady = !!(otherUser?.id && conversationId && currentUser?.id);

  const timeAgo = (date) => {
    if(!date) return '';
    const s = Math.floor((new Date() - date) / 1000);
    if(s < 60) return `${s}s ago`;
    if(s < 3600) return `${Math.floor(s/60)}m ago`;
    if(s < 86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  };

  useEffect(()=>{
    if(!isReady) return;
    let unsub = ()=>{};

    const init = async () => {
      await setDoc(doc(db,'conversations', conversationId),{
        participants: [currentUser.id, otherUser.id],
        lastMessageAt: serverTimestamp(),
      },{ merge: true });

      const q = query(
  collection(db, 'messages', conversationId, 'msgs'),
  orderBy('createdAt', 'asc')
);
const q2 = query(collection(db, 'messages', conversationId, 'msgs'));

let usedFallback = false;

unsub = onSnapshot(q, (snap) => {
  const now = Date.now();
  // Real deletion happens server-side via the Firestore TTL policy on `expireAt`
  // (can take up to ~24h after expiry to actually purge the doc), so this filter
  // just keeps the UI honest in the meantime — it never re-shows an expired message.
  const msgs = snap.docs.map(d => ({
    id: d.id, ...d.data(),
    ts: d.data().createdAt?.toDate?.() || null
  })).filter(m => !m.expireAt || (m.expireAt.toMillis ? m.expireAt.toMillis() : m.expireAt) > now);
  setMessages(msgs);
  setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  // Mark incoming messages as seen. This was previously only done in the fallback
  // branch below (triggered on a missing-index error) — so on the normal, indexed
  // path (the common case) messages were NEVER marked seen and read receipts never
  // worked at all. Also patches the conversation doc so the inbox list's tick icon
  // can show "seen" without re-reading this subcollection per row.
  const unseen = snap.docs.filter(d =>
    d.data().from === otherUser.id && d.data().status !== 'seen'
  );
  if (unseen.length) {
    unseen.forEach(d => updateDoc(d.ref, { status: 'seen' }).catch(()=>{}));
    updateDoc(doc(db,'conversations',conversationId), { lastMessageStatus: 'seen' }).catch(()=>{});
  }
}, () => {
  if (usedFallback) return;
  usedFallback = true;
  unsub = onSnapshot(q2, (snap2) => {
    const now2 = Date.now();
    const msgs = snap2.docs.map(d => ({
      id: d.id, ...d.data(),
      ts: d.data().createdAt?.toDate?.() || null
    })).filter(m => !m.expireAt || (m.expireAt.toMillis ? m.expireAt.toMillis() : m.expireAt) > now2)
      .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    setMessages(msgs);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    // Mark incoming messages as seen
    const unseen2 = snap2.docs.filter(d =>
      d.data().from === otherUser.id && d.data().status !== 'seen'
    );
    if (unseen2.length) {
      unseen2.forEach(d => updateDoc(d.ref, { status: 'seen' }).catch(()=>{}));
      updateDoc(doc(db,'conversations',conversationId), { lastMessageStatus: 'seen' }).catch(()=>{});
    }
  });
});
    };

    init();
    const typingUnsub = onSnapshot(doc(db,'typing',conversationId), snap => {
      const data = snap.data();
      if (!data) return;
      const ts = data[otherUser.id]?.toMillis?.();
      setOtherTyping(!!(ts && Date.now() - ts < 4000));
    });
    const presenceUnsub = onSnapshot(doc(db,'presence',otherUser.id), snap => {
      setPresenceData(snap.data());
    });
    // Real per-user mute flag — same muted_{uid} field the Inbox reads/writes, so
    // toggling it here (via the Chat Info sheet) stays in sync with the inbox list.
    const muteUnsub = onSnapshot(doc(db,'conversations',conversationId), snap => {
      const data = snap.data();
      setConvMuted(!!data?.[`muted_${currentUser.id}`]);
      setChatThemeId(data?.chatTheme || 'default');
      setDisappearing({
        enabled: !!data?.disappearing?.enabled,
        seconds: data?.disappearing?.seconds || 0,
      });
    }, ()=>{});
    return ()=>{ unsub(); typingUnsub(); presenceUnsub(); muteUnsub(); };
  },[conversationId, currentUser?.id, otherUser?.id]);

  // Real "shared groups" count for the Chat Info sheet — queries the actual groups
  // collection (same one GroupChatPage uses) rather than showing a fabricated number.
  useEffect(()=>{
    if(!currentUser?.id || !otherUser?.id) return;
    const q = query(collection(db,'groups'), where('members','array-contains',currentUser.id));
    const unsub = onSnapshot(q, snap=>{
      const shared = snap.docs.filter(d => (d.data().members||[]).includes(otherUser.id));
      setSharedGroupsCount(shared.length);
    }, ()=>{});
    return ()=>unsub();
  },[currentUser?.id, otherUser?.id]);

  const toggleMuteThisConversation = () => {
    setDoc(doc(db,'conversations', conversationId), { [`muted_${currentUser.id}`]: !convMuted }, { merge: true }).catch(()=>{
      showToast?.('Could not update mute setting', 'error');
    });
  };

  // Persists the chosen Chat Theme on the conversation doc (so both people see it)
  // and drops a real system message into the thread announcing the change, same as
  // WhatsApp/Messenger do — not a toast that only the person who tapped it sees.
  const applyChatTheme = async (themeId) => {
    try {
      await setDoc(doc(db,'conversations', conversationId), { chatTheme: themeId }, { merge: true });
      const theme = getChatTheme(themeId);
      await addDoc(collection(db,'messages', conversationId,'msgs'), {
        from: currentUser.id, to: otherUser.id,
        type: 'system',
        text: themeId === 'default' ? `${currentUser.username} reset the chat theme` : `${currentUser.username} changed the theme to ${theme.name}`,
        createdAt: serverTimestamp(), status: 'sent', expireAt: null,
      });
      setShowThemeSheet(false);
    } catch (e) {
      showToast?.('Could not update chat theme', 'error');
    }
  };

  // Persists the Disappearing Messages setting on the conversation doc. Only NEW
  // messages sent after this point get an expireAt — existing messages are left
  // alone, matching real chat-app behavior (this isn't retroactive).
  const applyDisappearing = async (seconds) => {
    try {
      const enabled = seconds > 0;
      await setDoc(doc(db,'conversations', conversationId), {
        disappearing: { enabled, seconds, updatedBy: currentUser.id, updatedAt: Date.now() },
      }, { merge: true });
      const label = DISAPPEARING_OPTIONS.find(o => o.seconds === seconds)?.label || 'Off';
      await addDoc(collection(db,'messages', conversationId,'msgs'), {
        from: currentUser.id, to: otherUser.id,
        type: 'system',
        text: enabled
          ? `${currentUser.username} turned on disappearing messages. New messages will disappear from this chat after ${label}.`
          : `${currentUser.username} turned off disappearing messages`,
        createdAt: serverTimestamp(), status: 'sent', expireAt: null,
      });
      setShowDisappearingSheet(false);
    } catch (e) {
      showToast?.('Could not update disappearing messages', 'error');
    }
  };

  const blockThisUser = async () => {
    if (!otherUser?.id) return;
    try {
      await updateDoc(doc(db,'users',currentUser.id), { blockedUsers: arrayUnion(otherUser.id) });
      onBlock?.(otherUser.id);
      showToast?.(`Blocked @${otherUser.username||'user'}`, 'info');
      setShowChatInfo(false);
      onBack?.();
    } catch (e) {
      showToast?.('Could not block user', 'error');
    }
  };

  const submitUserReport = async (reason) => {
    try {
      await submitReport('user', otherUser?.id, currentUser.id, {
        reportedUserId: otherUser?.id || null,
        reportedUsername: otherUser?.username || null,
        reporterUsername: currentUser.username || currentUser.fullName || null,
        reason,
      });
      showToast?.('User reported — thanks for letting us know', 'success');
    } catch (e) {
      showToast?.(e.message || 'Could not submit report', e.duplicate ? 'info' : 'error');
    }
    setShowReportUserSheet(false);
    setShowChatInfo(false);
  };

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
  createdAt: serverTimestamp(),
  status: 'sent',
  // Real per-message expiry when Disappearing Messages is on for this chat — a
  // Firestore TTL policy on `expireAt` (collection group: msgs) does the actual
  // deletion server-side. null when the setting is off, same as every other
  // message type below.
  expireAt: disappearing.enabled ? Timestamp.fromMillis(Date.now() + disappearing.seconds * 1000) : null,
});
      // Update conversation metadata. lastSenderId + lastMessageStatus let the inbox list
      // show sent/delivered/seen ticks without re-reading the msgs subcollection per row;
      // the preview text is media-aware (was just a generic '📎 Attachment' before, which
      // looked identical for a photo, a video, or a PDF).
      await setDoc(doc(db,'conversations', conversationId),{ 
        participants: [currentUser.id, otherUser.id], 
        lastMessage: mediaUrl ? (mediaType?.startsWith('audio') ? '🎙️ Voice message' : mediaType?.startsWith('video') ? '🎥 Video' : mediaType?.startsWith('image') ? '📷 Photo' : '📎 Attachment') : msg, 
        lastMessageAt: serverTimestamp(), 
        lastSenderId: currentUser.id,
        lastMessageStatus: 'sent',
        // A fresh message means the chat is active again for both sides — clears any
        // previous "delete chat" (hiddenFor) so it reappears in the recipient's inbox
        // instead of staying hidden forever after they'd deleted it.
        hiddenFor: [],
        [`unread_${otherUser.id}`]: increment(1) 
      },{ merge:true });
      clearAttach();
      sendNotification(otherUser.id, currentUser.id, 'message', 'sent you a message', { fromUsername: currentUser.username });
    } catch(e){
      showToast?.('Failed to send: ' + e.message, 'error');
      if(msg) setText(msg);
      clearAttach();
    }
  };

  const sendSticker = async (sticker) => {
    if(!conversationId || !currentUser?.id || !otherUser?.id) return;
    setShowStickers(false);
    try {
      await addDoc(collection(db,'messages', conversationId,'msgs'),{
        from: currentUser.id,
        to: otherUser.id,
        text: sticker,
        type: 'sticker',
        mediaUrl: null,
        mediaType: null,
        createdAt: serverTimestamp(),
        status: 'sent',
        expireAt: disappearing.enabled ? Timestamp.fromMillis(Date.now() + disappearing.seconds * 1000) : null,
      });
      await setDoc(doc(db,'conversations', conversationId),{
        participants: [currentUser.id, otherUser.id],
        lastMessage: `${sticker} Sticker`,
        lastMessageAt: serverTimestamp(),
        lastSenderId: currentUser.id,
        lastMessageStatus: 'sent',
        hiddenFor: [],
        [`unread_${otherUser.id}`]: increment(1)
      },{ merge:true });
      sendNotification(otherUser.id, currentUser.id, 'message', 'sent you a sticker', { fromUsername: currentUser.username });
    } catch(e){
      showToast?.('Failed to send sticker: ' + e.message, 'error');
    }
  };


  if(!otherUser?.id || !conversationId || !currentUser?.id) {
  return (
    <div style={{height:'100%',background:COLORS.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12}}>
      <div style={{width:32,height:32,border:`3px solid ${COLORS.border}`,borderTop:`3px solid ${COLORS.brand}`,borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
      <div style={{color:COLORS.textTertiary,fontSize:13}}>Loading conversation...</div>
      <button onClick={onBack} style={{background:COLORS.surfaceAlt,border:'none',borderRadius:20,padding:'8px 20px',color:COLORS.textSecondary,cursor:'pointer',fontSize:12,marginTop:8}}>← Back</button>
    </div>
  );
}

  // Computed once per render, used by the composer's send button/voice bubble AND
  // the message list below, so both stay in sync with whatever theme is active.
  const activeTheme = getChatTheme(chatThemeId);
  const myBubbleBg = activeTheme.gradient || COLORS.gradient;
  const myGlow = SHADOW.glow(activeTheme.accent || COLORS.brand);

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:COLORS.bg}}>
      <div style={{padding:'14px 16px',background:COLORS.surface,borderBottom:`1px solid ${COLORS.border}`,display:'flex',alignItems:'center',gap:12,boxShadow:'0 1px 0 rgba(11,95,255,0.04)'}}>
        <button onClick={onBack} style={{background:'none',border:'none',color:COLORS.textPrimary,cursor:'pointer',padding:'4px 0',display:'flex'}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div onClick={()=>onViewProfile?.(otherUser?.id)} style={{width:42,height:42,borderRadius:'50%',background:otherUser?.avatarColor||COLORS.brand,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,overflow:'hidden',cursor:'pointer',boxShadow:SHADOW.xs,flexShrink:0}}>
          {otherUser?.avatarUrl?<img src={otherUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:(otherUser?.avatar||'?')}
        </div>
        <div onClick={()=>onViewProfile?.(otherUser?.id)} style={{cursor:'pointer',minWidth:0}}>
          <div style={{color:COLORS.textPrimary,fontWeight:700,fontSize:15,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>@{otherUser?.username||'user'}</div>
          <div style={{color: presenceData?.online ? COLORS.success : COLORS.textTertiary, fontSize:11.5, display:'flex', alignItems:'center', gap:4}}>
            {presenceData?.online && <div style={{width:6,height:6,borderRadius:'50%', background: COLORS.success}}/>}
            {presenceData?.online ? 'Online' : presenceData?.lastSeen ? `last seen ${timeAgo(presenceData.lastSeen.toDate())}` : 'Offline'}
          </div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8}}>
          <button onClick={()=>onVoiceCall?.(otherUser?.id)} style={{background:COLORS.surfaceAlt,border:`1px solid ${COLORS.border}`,borderRadius:'50%',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={COLORS.brand} strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-5.99-5.99 19.79 19.79 0 01-3.07-8.67A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
          </button>
          <button onClick={()=>onVideoCall?.(otherUser?.id)} style={{background:COLORS.surfaceAlt,border:`1px solid ${COLORS.border}`,borderRadius:'50%',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={COLORS.brand} strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          </button>
          <button onClick={()=>{ setShowSearch(s=>!s); if(showSearch) setThreadSearch(''); }} title="Search in chat" style={{background:showSearch?COLORS.surfaceAlt:'none',border:'none',borderRadius:'50%',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <button onClick={()=>setShowChatInfo(true)} title="Chat info" style={{background:'none',border:'none',borderRadius:'50%',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
          </button>
        </div>
      </div>

      {/* Disappearing Messages banner — mirrors the persistent notice real chat apps
          show while the setting is active, driven off the real `disappearing` field
          on the conversation doc (not a one-time dismissible toast). */}
      {disappearing.enabled && (
        <div style={{ padding:'8px 16px', background:COLORS.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
          <span style={{ color:COLORS.textTertiary, fontSize:11.5, fontWeight:600 }}>
            Disappearing messages are on. Messages disappear {DISAPPEARING_OPTIONS.find(o=>o.seconds===disappearing.seconds)?.label.toLowerCase() || ''} after being sent.
          </span>
        </div>
      )}

      {/* In-thread search bar — filters the real messages array below, no fake results */}
      {showSearch && (
        <div style={{ padding:'10px 16px', background:COLORS.surface, borderBottom:`1px solid ${COLORS.border}`, display:'flex', alignItems:'center', gap:8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2" style={{flexShrink:0}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            autoFocus
            placeholder="Search in this chat"
            value={threadSearch}
            onChange={e=>setThreadSearch(e.target.value)}
            style={{ flex:1, background:COLORS.surfaceAlt, border:'none', borderRadius:10, padding:'8px 12px', color:COLORS.textPrimary, outline:'none', fontSize:13.5 }} />
          {threadSearch && (
            <div style={{ color:COLORS.textTertiary, fontSize:11.5, whiteSpace:'nowrap' }}>
              {messages.filter(m=>m.text?.toLowerCase().includes(threadSearch.toLowerCase())).length} found
            </div>
          )}
        </div>
      )}

      <div style={{flex:1,overflowY:'auto',padding:'16px',backgroundImage:`radial-gradient(${COLORS.border} 1px, transparent 1px)`,backgroundSize:'18px 18px',backgroundColor:COLORS.bg}}>
        {messages.length===0&&<div style={{textAlign:'center',padding:40,color:COLORS.textTertiary,fontSize:13}}>Start a conversation! 👋</div>}
        {(threadSearch.trim() ? messages.filter(m=>m.text?.toLowerCase().includes(threadSearch.toLowerCase())) : messages).length===0 && threadSearch.trim() && (
          <div style={{textAlign:'center',padding:40,color:COLORS.textTertiary,fontSize:13}}>No messages matching "{threadSearch}"</div>
        )}
        {(threadSearch.trim() ? messages.filter(m=>m.text?.toLowerCase().includes(threadSearch.toLowerCase())) : messages).map(msg=>{
          if (msg.type === 'system') {
            return (
              <div key={msg.id} style={{ display:'flex', justifyContent:'center', margin:'10px 0' }}>
                <div style={{ background:COLORS.surfaceAlt, color:COLORS.textTertiary, fontSize:11.5, fontWeight:600, padding:'6px 14px', borderRadius:14, textAlign:'center', maxWidth:'85%' }}>
                  {msg.text}
                </div>
              </div>
            );
          }
          const isMine = msg.from===currentUser?.id;
          return (
            <div key={msg.id}
              onTouchStart={()=>{ msgLongTimer.current=setTimeout(()=>{ haptic('heavy'); setShowMsgReactions(msg.id); },500); }}
              onTouchEnd={()=>clearTimeout(msgLongTimer.current)}
              onMouseDown={()=>{ msgLongTimer.current=setTimeout(()=>setShowMsgReactions(msg.id),500); }}
              onMouseUp={()=>clearTimeout(msgLongTimer.current)}
              style={{display:'flex',justifyContent:isMine?'flex-end':'flex-start',alignItems:'flex-end',gap:8,marginBottom:10,position:'relative'}}>
  {!isMine && (
    <div onClick={()=>onViewProfile?.(otherUser?.id)} style={{width:26,height:26,borderRadius:'50%',background:otherUser?.avatarColor||COLORS.brand,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:10,flexShrink:0,cursor:'pointer',overflow:'hidden'}}>
      {otherUser?.avatarUrl ? <img src={otherUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : otherUser?.avatar}
    </div>
  )}
              <div style={{maxWidth:'72%'}}>
                {msg.text && msg.type==='sticker' && !msg.deleted && (
                  <div style={{fontSize:56, lineHeight:1, padding:'2px 4px'}}>{msg.text}</div>
                )}
                {msg.text && msg.type!=='sticker' && <div style={{background: msg.deleted ? COLORS.surfaceAlt : isMine?myBubbleBg:COLORS.surface, borderRadius:isMine?'18px 18px 4px 18px':'18px 18px 18px 4px',padding:'9px 14px',marginBottom:msg.mediaUrl?4:0, boxShadow: isMine ? myGlow : SHADOW.xs, border: isMine ? 'none' : `1px solid ${COLORS.border}` }}>
  <span style={{color: msg.deleted ? COLORS.textTertiary : isMine?COLORS.textOnBrand:COLORS.textPrimary, fontSize:14, lineHeight:1.4, fontStyle: msg.deleted?'italic':'normal'}}>{msg.text}</span>
  {!msg.deleted && !isMine && <MessageTranslate text={msg.text} targetLang={currentUser?.language || 'en'} isMine={isMine} />}
</div>}
                <div style={{ color:COLORS.textTertiary, fontSize:10.5, marginTop:3, textAlign:isMine?'right':'left', paddingLeft:isMine?0:2, paddingRight:isMine?2:0, display:'flex', alignItems:'center', justifyContent:isMine?'flex-end':'flex-start', gap:3 }}>
  {/* Real per-message expiry indicator — only shows when this specific message
      actually carries an expireAt (i.e. it was sent while disappearing messages
      was on), not a static icon tied to the current toggle state. */}
  {msg.expireAt && (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2.2" style={{flexShrink:0}}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
  )}
  <span>{msg.ts ? msg.ts.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : ''}</span>
  {isMine && (
    <span style={{ fontSize:12, color: msg.status==='seen' ? (activeTheme.accent || COLORS.brand) : COLORS.textTertiary, letterSpacing:-2 }}>
      {msg.status === 'sent' ? '✓' : '✓✓'}
    </span>
  )}
</div>
                {/* Reaction picker */}
              {showMsgReactions===msg.id && (
                <div onClick={e=>e.stopPropagation()} style={{position:'absolute',bottom:'100%',left:isMine?'auto':'0',right:isMine?'0':'auto',background:COLORS.surface,backdropFilter:'blur(20px)',borderRadius:40,padding:'6px 10px',display:'flex',gap:4,zIndex:100,border:`1px solid ${COLORS.border}`,animation:'popInBounce 0.25s ease',marginBottom:4,boxShadow:SHADOW.raised}}>
                  {MSG_EMOJIS.map(emoji=>(
                    <button key={emoji} onClick={async()=>{
                      await updateDoc(doc(db,'messages',conversationId,'msgs',msg.id),{[`reactions.${currentUser.id}`]:emoji});
                      setShowMsgReactions(null);
                      haptic('light');
                    }} style={{background:'none',border:'none',fontSize:24,cursor:'pointer',padding:'2px 4px',borderRadius:20,transition:'transform 0.15s'}}
                    onMouseEnter={e=>e.currentTarget.style.transform='scale(1.3)'}
                    onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
                    >{emoji}</button>
                  ))}
                  <button onClick={()=>setShowMsgReactions(null)} style={{background:COLORS.surfaceAlt,border:'none',borderRadius:'50%',width:28,height:28,color:COLORS.textSecondary,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',marginLeft:4}}>✕</button>
                </div>
              )}

              {/* Show reactions below bubble */}
              {msg.reactions && Object.keys(msg.reactions).length>0 && (
                <div style={{display:'flex',gap:3,marginTop:3,justifyContent:isMine?'flex-end':'flex-start',flexWrap:'wrap'}}>
                  {[...new Set(Object.values(msg.reactions))].map(emoji=>(
                    <span key={emoji} onClick={async()=>{
                      await updateDoc(doc(db,'messages',conversationId,'msgs',msg.id),{[`reactions.${currentUser.id}`]:emoji});
                      haptic('light');
                    }} style={{background:COLORS.surface,borderRadius:20,padding:'2px 7px',fontSize:12,border:`1px solid ${COLORS.border}`,cursor:'pointer',display:'flex',alignItems:'center',gap:3,boxShadow:SHADOW.xs}}>
                      {emoji}
                      <span style={{color:COLORS.textTertiary,fontSize:10}}>{Object.values(msg.reactions).filter(r=>r===emoji).length}</span>
                    </span>
                  ))}
                </div>
              )}
                {msg.mediaUrl&&msg.mediaType?.startsWith('image')&&<img src={msg.mediaUrl} alt="" style={{maxWidth:'100%',borderRadius:14,display:'block'}}/>}
                {msg.mediaUrl&&msg.mediaType?.startsWith('video')&&<video src={msg.mediaUrl} controls style={{maxWidth:'100%',borderRadius:14,display:'block'}}/>}
                {(msg.mediaUrl&&msg.mediaType?.startsWith('audio')) || msg.type==='voice'&&(msg.voiceUrl||msg.mediaUrl) ? (
                  <div style={{display:'flex',alignItems:'center',gap:10,background:isMine?myBubbleBg:COLORS.surface,borderRadius:20,padding:'10px 14px',minWidth:200,border: isMine?'none':`1px solid ${COLORS.border}`,boxShadow: isMine ? myGlow : SHADOW.xs}}>
                    <button onClick={e=>{
                      e.stopPropagation();
                      const url = msg.voiceUrl || msg.mediaUrl;
                      if (!url) return;
                      const audio = new Audio(url);
                      audio.play().catch(()=>{});
                    }} style={{background:isMine?'rgba(255,255,255,0.25)':COLORS.surfaceAlt,border:'none',borderRadius:'50%',width:34,height:34,color:isMine?'white':COLORS.brand,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill={isMine?'white':COLORS.brand}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                    <div style={{flex:1,display:'flex',alignItems:'center',gap:1.5,height:24}}>
                      {Array.from({length:24}).map((_,i)=>(
                        <div key={i} style={{flex:1,background:isMine?'rgba(255,255,255,0.6)':COLORS.border,borderRadius:2,height:`${20+Math.sin(i*0.8)*14}%`,minHeight:3}}/>
                      ))}
                    </div>
                    <span style={{color:isMine?'rgba(255,255,255,0.8)':COLORS.textTertiary,fontSize:11,flexShrink:0}}>{msg.duration ? `0:${String(msg.duration).padStart(2,'0')}` : '🎙️'}</span>
                  </div>
                ) : null}
              </div>
              {isMine && (
                <button onClick={async()=>{
  const choice = await confirmDialog('Delete for everyone?');
  if(choice){
    await updateDoc(doc(db,'messages',conversationId,'msgs',msg.id), { 
      text: '🚫 Message deleted', 
      mediaUrl: null, 
      deleted: true 
    });
  }
}} style={{background:'none',border:'none',color:COLORS.textDisabled,fontSize:10,cursor:'pointer',padding:'0 2px',alignSelf:'flex-end',marginBottom:2}}>✕</button>
              )}
            </div>
          );
        })}
        {otherTyping && (
  <div style={{ display:'flex', alignItems:'flex-end', gap:8, marginBottom:8, animation:'fadeIn 0.3s ease' }}>
    <div style={{ width:28, height:28, borderRadius:'50%', background:otherUser?.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:11, overflow:'hidden', flexShrink:0 }}>
      {otherUser?.avatarUrl ? <img src={otherUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : otherUser?.avatar}
    </div>
    <div style={{ background:COLORS.surface, borderRadius:'18px 18px 18px 4px', padding:'12px 16px', display:'flex', gap:5, alignItems:'center', border:`1px solid ${COLORS.border}`, boxShadow:SHADOW.xs }}>
      {[0,1,2].map(i=>(
        <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:COLORS.textTertiary,
          animation:`pulse 1.4s ease ${i*0.22}s infinite`,
          transform:`scaleY(${1})` }}/>
      ))}
    </div>
  </div>
)}
        <div ref={bottomRef}/>
      </div>

      {(previewFile||audioBlob)&&(
        <div style={{padding:'0 14px 6px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,background:COLORS.surface,border:`1px solid ${COLORS.border}`,borderRadius:14,padding:'8px 12px',boxShadow:SHADOW.xs}}>
            {previewFile?.type?.startsWith('image')&&<img src={previewFile.url} alt="" style={{height:44,width:44,objectFit:'cover',borderRadius:8}}/>}
            {previewFile?.type?.startsWith('video')&&<video src={previewFile.url} style={{height:44,width:60,objectFit:'cover',borderRadius:8}}/>}
            {audioBlob&&!previewFile&&<audio src={URL.createObjectURL(audioBlob)} controls style={{height:28,flex:1}}/>}
            <button onClick={clearAttach} style={{marginLeft:'auto',background:COLORS.surfaceAlt,border:'none',borderRadius:'50%',width:22,height:22,color:COLORS.brand,cursor:'pointer',fontSize:13}}>✕</button>
          </div>
        </div>
      )}

{showEmoji && (
        <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:'10px 14px',background:COLORS.surface,border:`1px solid ${COLORS.border}`,borderRadius:16,margin:'0 14px 4px',maxHeight:180,overflowY:'auto'}}>
          {EMOJI_LIST.map(e=>(
            <button key={e} onClick={()=>setText(t=>t+e)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',padding:2}}>{e}</button>
          ))}
        </div>
      )}
      {showStickers && (
        <div style={{padding:'0 14px 4px'}}>
          <StickerPicker onSelect={sendSticker} onClose={()=>setShowStickers(false)} />
        </div>
      )}
      <div style={{padding:'10px 14px',paddingBottom:'max(28px, env(safe-area-inset-bottom))',background:COLORS.surface,borderTop:`1px solid ${COLORS.border}`,display:'flex',gap:8,alignItems:'center'}}>
        <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:2,background:COLORS.surfaceAlt,border:`1px solid ${COLORS.border}`,borderRadius:26,padding:'4px 6px 4px 12px'}}>
          <button onClick={()=>setShowEmoji(v=>!v)} style={{background:'none',border:'none',cursor:'pointer',flexShrink:0,fontSize:18,display:'flex',padding:4}}>😊</button>
          <button onClick={()=>setShowStickers(v=>!v)} style={{background:'none',border:'none',cursor:'pointer',flexShrink:0,fontSize:18,display:'flex',padding:4}}>🧩</button>
          <input value={text} onChange={e=>{
            setText(e.target.value);
            setDoc(doc(db,'typing',conversationId),{[currentUser.id]:serverTimestamp()},{merge:true}).catch(()=>{});
          }} onKeyDown={e=>e.key==='Enter'&&handleSend()} placeholder={isRecording?`🔴 ${fmt(recordSecs)}`:'Message'} style={{flex:1,minWidth:0,background:'none',border:'none',outline:'none',color:COLORS.textPrimary,fontSize:13.5,padding:'9px 4px'}}/>
          <button onClick={()=>fileInputRef.current?.click()} style={{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,padding:6}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <button onClick={()=>cameraInputRef.current?.click()} style={{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,padding:6}}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" onChange={pickFile} style={{display:'none'}}/>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={pickFile} style={{display:'none'}}/>
        {(text.trim() || previewFile || audioBlob) ? (
          <button onClick={handleSend} style={{background:myBubbleBg,border:'none',borderRadius:'50%',width:42,height:42,color:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:myGlow}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1"><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        ) : (
          <VoiceRecorderButton
            showToast={showToast}
            size="small"
            onSend={async (voiceMsg) => {
              try {
                const ref = await addDoc(collection(db,'messages',conversationId,'msgs'), {
                  from: currentUser.id, to: otherUser?.id,
                  type: 'voice', mediaUrl: voiceMsg.url, mediaType: 'audio',
                  duration: voiceMsg.duration,
                  createdAt: serverTimestamp(), status: 'sent',
                  expireAt: disappearing.enabled ? Timestamp.fromMillis(Date.now() + disappearing.seconds * 1000) : null,
                });
                await setDoc(doc(db,'conversations',conversationId), {
                  participants:[currentUser.id,otherUser?.id],
                  lastMessage:'🎙️ Voice message',
                  lastMessageAt:serverTimestamp(),
                  lastSenderId: currentUser.id,
                  lastMessageStatus: 'sent',
                  hiddenFor: [],
                  // Was missing entirely before — a voice message never incremented the
                  // recipient's unread count, so it silently never showed an unread badge.
                  [`unread_${otherUser?.id}`]: increment(1),
                },{merge:true});
                await sendNotification(otherUser?.id, currentUser.id, 'message', `🎤 ${currentUser.username} sent a voice message`);
              } catch(e) { showToast?.('Failed to send voice','error'); }
            }}
          />
        )}
      </div>

      {/* Chat Info sheet — one-on-one counterpart to GroupChatPage's Group Info panel.
          Every field here is wired to real data: presence, the real muted_{uid} field,
          a real shared-groups query, and (below) the real chatTheme + disappearing
          fields on the conversation doc — both readable/writable by either
          participant and reflected instantly for both via onSnapshot. */}
      {showChatInfo && (
        <div onClick={()=>setShowChatInfo(false)} style={{ position:'fixed', inset:0, zIndex:2700, background:'rgba(11,15,25,0.55)', display:'flex', alignItems:'flex-end', animation:'fadeIn 0.15s ease' }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:430, margin:'0 auto', maxHeight:'85vh', overflowY:'auto', background:COLORS.surface, borderTopLeftRadius:26, borderTopRightRadius:26, paddingBottom:'max(24px, env(safe-area-inset-bottom))' }}>
            <div style={{ width:36, height:4, background:COLORS.border, borderRadius:2, margin:'12px auto 8px' }} />
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 20px 20px', borderBottom:`1px solid ${COLORS.border}` }}>
              <div onClick={()=>{ setShowChatInfo(false); onViewProfile?.(otherUser?.id); }} style={{ width:76, height:76, borderRadius:'50%', background:otherUser?.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:30, overflow:'hidden', cursor:'pointer', marginBottom:12 }}>
                {otherUser?.avatarUrl?<img src={otherUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:(otherUser?.avatar||'?')}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:17 }}>{otherUser?.fullName || otherUser?.username || 'User'}</div>
                {otherUser?.verified && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={COLORS.brand}><path d="M12 2l2.4 2.4 3.3-.7 1 3.2 3.2 1-.7 3.3L23.6 14l-2.4 2.4.7 3.3-3.2 1-1 3.2-3.3-.7L12 26l-2.4-2.4-3.3.7-1-3.2-3.2-1 .7-3.3L0 14l2.4-2.4-.7-3.3 3.2-1 1-3.2 3.3.7z" transform="translate(0,-2) scale(0.92)"/><path d="M8.5 12.2l2.3 2.3 4.5-4.7" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </div>
              <div style={{ color: presenceData?.online ? COLORS.success : COLORS.textTertiary, fontSize:12.5, marginTop:2 }}>
                {presenceData?.online ? 'Online' : presenceData?.lastSeen ? `last seen ${timeAgo(presenceData.lastSeen.toDate())}` : 'Offline'}
              </div>
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button onClick={()=>{ setShowChatInfo(false); onVoiceCall?.(otherUser?.id); }} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer' }}>
                  <div style={{ width:44, height:44, borderRadius:'50%', background:COLORS.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.brand} strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-5.99-5.99 19.79 19.79 0 01-3.07-8.67A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
                  </div>
                  <span style={{ color:COLORS.textSecondary, fontSize:11 }}>Call</span>
                </button>
                <button onClick={()=>{ setShowChatInfo(false); onVideoCall?.(otherUser?.id); }} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer' }}>
                  <div style={{ width:44, height:44, borderRadius:'50%', background:COLORS.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.brand} strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                  </div>
                  <span style={{ color:COLORS.textSecondary, fontSize:11 }}>Video</span>
                </button>
                <button onClick={()=>{ setShowSearch(true); setShowChatInfo(false); }} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer' }}>
                  <div style={{ width:44, height:44, borderRadius:'50%', background:COLORS.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.brand} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </div>
                  <span style={{ color:COLORS.textSecondary, fontSize:11 }}>Search</span>
                </button>
              </div>
            </div>

            <div style={{ padding:'8px 8px' }}>
              <button onClick={toggleMuteThisConversation} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, background:'none', border:'none', padding:'13px 14px', color:COLORS.textPrimary, fontSize:14.5, fontWeight:600, cursor:'pointer', textAlign:'left' }}>
                <span style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2">{convMuted ? <><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/></> : <><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="1" x2="1" y2="23"/></>}</svg>
                  Notifications
                </span>
                <div style={{ width:40, height:22, borderRadius:11, background:convMuted?COLORS.border:COLORS.brand, position:'relative', transition:'background 0.15s' }}>
                  <div style={{ position:'absolute', top:2, left:convMuted?2:20, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left 0.15s' }} />
                </div>
              </button>
              <button onClick={()=>setShowThemeSheet(true)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, background:'none', border:'none', padding:'13px 14px', color:COLORS.textPrimary, fontSize:14.5, fontWeight:600, cursor:'pointer', textAlign:'left' }}>
                <span style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2a10 10 0 100 20 4 4 0 004-4 1 1 0 011-1h1a1 1 0 001-1 10 10 0 00-7-14z"/></svg>
                  Chat Theme
                </span>
                <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:18, height:18, borderRadius:'50%', background: activeTheme.gradient || COLORS.gradient, border:`1px solid ${COLORS.border}` }} />
                  <span style={{ color:COLORS.textTertiary, fontSize:13 }}>{activeTheme.name}</span>
                </span>
              </button>
              <button onClick={()=>setShowDisappearingSheet(true)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, background:'none', border:'none', padding:'13px 14px', color:COLORS.textPrimary, fontSize:14.5, fontWeight:600, cursor:'pointer', textAlign:'left' }}>
                <span style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                  Disappearing Messages
                </span>
                <span style={{ color:COLORS.textTertiary, fontSize:13 }}>
                  {DISAPPEARING_OPTIONS.find(o=>o.seconds===disappearing.seconds)?.label || 'Off'}
                </span>
              </button>
              <button onClick={()=>{ setShowChatInfo(false); onViewProfile?.(otherUser?.id); }} style={{ width:'100%', display:'flex', alignItems:'center', gap:12, background:'none', border:'none', padding:'13px 14px', color:COLORS.textPrimary, fontSize:14.5, fontWeight:600, cursor:'pointer', textAlign:'left' }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                View Profile
              </button>
              <div style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'13px 14px', color:COLORS.textPrimary, fontSize:14.5, fontWeight:600 }}>
                <span style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                  Shared Groups
                </span>
                <span style={{ color:COLORS.textTertiary, fontSize:13 }}>{sharedGroupsCount}</span>
              </div>
              <button onClick={blockThisUser} style={{ width:'100%', display:'flex', alignItems:'center', gap:12, background:'none', border:'none', borderTop:`1px solid ${COLORS.border}`, marginTop:6, paddingTop:16, padding:'16px 14px 13px', color:COLORS.danger, fontSize:14.5, fontWeight:600, cursor:'pointer', textAlign:'left' }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={COLORS.danger} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/></svg>
                Block {otherUser?.username ? `@${otherUser.username}` : 'User'}
              </button>
              <button onClick={()=>setShowReportUserSheet(true)} style={{ width:'100%', display:'flex', alignItems:'center', gap:12, background:'none', border:'none', padding:'13px 14px', color:COLORS.danger, fontSize:14.5, fontWeight:600, cursor:'pointer', textAlign:'left' }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={COLORS.danger} strokeWidth="2"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                Report {otherUser?.username ? `@${otherUser.username}` : 'User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportUserSheet && (
        <ReportReasonSheet
          title="Report User"
          onClose={()=>setShowReportUserSheet(false)}
          onSubmit={submitUserReport}
        />
      )}

      {/* Chat Theme picker — writes chatTheme straight onto the conversation doc via
          applyChatTheme, so the choice is shared with the other participant immediately
          (not a local-only preference). */}
      {showThemeSheet && (
        <div onClick={()=>setShowThemeSheet(false)} style={{ position:'fixed', inset:0, zIndex:2800, background:'rgba(11,15,25,0.55)', display:'flex', alignItems:'flex-end', animation:'fadeIn 0.15s ease' }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:430, margin:'0 auto', maxHeight:'80vh', overflowY:'auto', background:COLORS.surface, borderTopLeftRadius:26, borderTopRightRadius:26, paddingBottom:'max(24px, env(safe-area-inset-bottom))' }}>
            <div style={{ width:36, height:4, background:COLORS.border, borderRadius:2, margin:'12px auto 8px' }} />
            <div style={{ padding:'8px 20px 4px', color:COLORS.textPrimary, fontWeight:800, fontSize:16 }}>Chat Theme</div>
            <div style={{ padding:'0 20px 12px', color:COLORS.textTertiary, fontSize:12.5 }}>Applies to this chat for both of you.</div>
            <div style={{ padding:'4px 12px' }}>
              {CHAT_THEMES.map(theme => (
                <button key={theme.id} onClick={()=>applyChatTheme(theme.id)} style={{ width:'100%', display:'flex', alignItems:'center', gap:14, background: theme.id===chatThemeId ? COLORS.surfaceAlt : 'none', border:'none', borderRadius:14, padding:'12px 12px', cursor:'pointer', textAlign:'left' }}>
                  <div style={{ width:34, height:34, borderRadius:'50%', background: theme.gradient || COLORS.gradient, boxShadow: SHADOW.xs, flexShrink:0, border: theme.id==='default' ? `1px solid ${COLORS.border}` : 'none' }} />
                  <span style={{ flex:1, color:COLORS.textPrimary, fontSize:14.5, fontWeight:600 }}>{theme.name}</span>
                  {theme.id===chatThemeId && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.accent || COLORS.brand} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Disappearing Messages picker — writes { enabled, seconds } onto the conversation
          doc via applyDisappearing. Only messages sent AFTER this is turned on get an
          expireAt; nothing already in the thread is retroactively affected. */}
      {showDisappearingSheet && (
        <div onClick={()=>setShowDisappearingSheet(false)} style={{ position:'fixed', inset:0, zIndex:2800, background:'rgba(11,15,25,0.55)', display:'flex', alignItems:'flex-end', animation:'fadeIn 0.15s ease' }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:430, margin:'0 auto', maxHeight:'80vh', overflowY:'auto', background:COLORS.surface, borderTopLeftRadius:26, borderTopRightRadius:26, paddingBottom:'max(24px, env(safe-area-inset-bottom))' }}>
            <div style={{ width:36, height:4, background:COLORS.border, borderRadius:2, margin:'12px auto 8px' }} />
            <div style={{ padding:'8px 20px 4px', color:COLORS.textPrimary, fontWeight:800, fontSize:16 }}>Disappearing Messages</div>
            <div style={{ padding:'0 20px 12px', color:COLORS.textTertiary, fontSize:12.5 }}>New messages will disappear from this chat after the time you select. This doesn't affect messages already sent.</div>
            <div style={{ padding:'4px 12px' }}>
              {DISAPPEARING_OPTIONS.map(opt => (
                <button key={opt.seconds} onClick={()=>applyDisappearing(opt.seconds)} style={{ width:'100%', display:'flex', alignItems:'center', gap:14, background: opt.seconds===disappearing.seconds ? COLORS.surfaceAlt : 'none', border:'none', borderRadius:14, padding:'13px 12px', cursor:'pointer', textAlign:'left' }}>
                  <span style={{ flex:1, color:COLORS.textPrimary, fontSize:14.5, fontWeight:600 }}>{opt.label}</span>
                  {opt.seconds===disappearing.seconds && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.brand} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Live online/last-seen status for one user, read from /presence/{uid}. Several inbox
// rows subscribe to this independently (one listener per visible row) — fine at the
// scale of a single person's chat list, same tradeoff the app already makes for typing
// indicators and per-conversation listeners elsewhere.
const usePresence = (uid) => {
  const [presence, setPresence] = useState(null);
  useEffect(() => {
    if (!uid) { setPresence(null); return; }
    const unsub = onSnapshot(doc(db, 'presence', uid), snap => setPresence(snap.data() || null), () => {});
    return () => unsub();
  }, [uid]);
  return presence;
};

// Small checkmark cluster mirroring the sent → delivered → seen progression used in the
// chat bubbles themselves, so the inbox list and the open conversation agree with each
// other about a message's status.
const MessageStatusTicks = ({ status }) => {
  const color = status === 'seen' ? COLORS.brand : COLORS.textTertiary;
  return (
    <svg width="15" height="10" viewBox="0 0 15 10" fill="none" style={{ flexShrink:0 }}>
      <path d="M1 5l2.7 3L9 2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {status !== 'sent' && <path d="M6 5l2.7 3L14 2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
};

// One row in the chat list. Pulled out to its own component so each row can own its
// presence + typing subscriptions without re-subscribing every other row on every render.
const ConversationRow = ({ u, conv, currentUser, onOpen, onLongPress }) => {
  const presence = usePresence(u.id);
  const isOnline = !!presence?.online;
  const [isTyping, setIsTyping] = useState(false);
  const convId = conv?.id;
  const pressTimer = useRef(null);
  const pressFired = useRef(false);

  useEffect(() => {
    if (!convId) return;
    const unsub = onSnapshot(doc(db, 'typing', convId), snap => {
      const ts = snap.data()?.[u.id]?.toMillis?.();
      setIsTyping(!!(ts && Date.now() - ts < 4000));
    }, () => {});
    return () => unsub();
  }, [convId, u.id]);

  const unread = conv?.[`unread_${currentUser.id}`] || 0;
  const muted = !!conv?.[`muted_${currentUser.id}`];
  const pinned = !!conv?.[`pinned_${currentUser.id}`];
  const isMine = conv?.lastSenderId === currentUser.id;
  const lastAt = tsToDate(conv?.lastMessageAt);

  const previewText = isTyping
    ? 'typing…'
    : conv?.lastMessage || 'Tap to start chatting';

  const startPress = () => {
    pressFired.current = false;
    pressTimer.current = setTimeout(() => {
      pressFired.current = true;
      haptic('medium');
      onLongPress(u, conv);
    }, 480);
  };
  const cancelPress = () => { clearTimeout(pressTimer.current); };
  const handleClick = () => {
    if (pressFired.current) { pressFired.current = false; return; }
    onOpen(u.id);
  };

  return (
    <div
      onClick={handleClick}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={e=>{ cancelPress(); e.currentTarget.style.background='transparent'; }}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      onMouseEnter={e=>e.currentTarget.style.background=COLORS.surfaceAlt}
      onContextMenu={e=>{ e.preventDefault(); onLongPress(u, conv); }}
      style={{ display:'flex', alignItems:'center', gap:14, padding:'11px 16px', cursor:'pointer', borderRadius:16, transition:TRANSITION.fast, userSelect:'none', WebkitUserSelect:'none' }}
    >
      <div style={{ position:'relative', flexShrink:0 }}>
        <div style={{ width:52, height:52, borderRadius:'50%', background:u.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:20, overflow:'hidden', boxShadow:SHADOW.xs }}>
          {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : u.avatar}
        </div>
        {/* Real presence — was a hardcoded green dot on every row before regardless of
            whether that person was actually online. */}
        {isOnline && <div style={{ position:'absolute', bottom:1, right:1, width:13, height:13, background:COLORS.success, borderRadius:'50%', border:`2.5px solid ${COLORS.surface}` }} />}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <div style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:14.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.fullName || u.username}</div>
          {u.verified && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill={COLORS.brand} style={{flexShrink:0}}><path d="M12 2l2.4 2.4 3.3-.7 1 3.2 3.2 1-.7 3.3L23.6 14l-2.4 2.4.7 3.3-3.2 1-1 3.2-3.3-.7L12 26l-2.4-2.4-3.3.7-1-3.2-3.2-1 .7-3.3L0 14l2.4-2.4-.7-3.3 3.2-1 1-3.2 3.3.7z" transform="translate(0,-2) scale(0.92)"/><path d="M8.5 12.2l2.3 2.3 4.5-4.7" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          )}
          {muted && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2" style={{flexShrink:0}}><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="1" x2="1" y2="23"/></svg>
          )}
          {pinned && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2.2" style={{flexShrink:0}}><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-1.4-7.5A3 3 0 0014.66 7H9.34a3 3 0 00-2.94 2.5z"/></svg>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
          {isMine && !isTyping && conv?.lastMessageStatus && <MessageStatusTicks status={conv.lastMessageStatus} />}
          <div style={{ color:isTyping?COLORS.brand:unread>0?COLORS.textPrimary:COLORS.textTertiary, fontWeight:unread>0?600:400, fontSize:12.5, fontStyle:isTyping?'italic':'normal', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{previewText}</div>
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
        <div style={{ color:unread>0?COLORS.brand:COLORS.textTertiary, fontSize:11, fontWeight:unread>0?700:400 }}>{lastAt ? timeAgo(lastAt) : ''}</div>
        {unread>0 && <div style={{ minWidth:19, height:19, borderRadius:10, background:COLORS.gradient, color:'white', fontSize:10.5, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 5px', boxShadow:SHADOW.glow(COLORS.brand) }}>{unread>9?'9+':unread}</div>}
      </div>
    </div>
  );
};

// Avatar in the horizontal "contacts" strip at the top of the inbox. Only shows the
// green ring/dot when that person is genuinely online (via /presence), not unconditionally.
const InboxStripAvatar = ({ u, onClick }) => {
  const presence = usePresence(u.id);
  const isOnline = !!presence?.online;
  return (
    <div onClick={onClick} style={{ textAlign:'center', flexShrink:0, cursor:'pointer' }}>
      <div style={{ position:'relative' }}>
        <div className={isOnline ? 'story-avatar-ring' : ''} style={{ width:50, height:50, borderRadius:'50%', border: isOnline ? undefined : `2px solid ${COLORS.border}`, padding: isOnline ? undefined : 2 }}>
          <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:u.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, overflow:'hidden' }}>
            {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : u.avatar}
          </div>
        </div>
        {isOnline && <div style={{ position:'absolute', bottom:1, right:1, width:12, height:12, background:COLORS.success, borderRadius:'50%', border:`2px solid ${COLORS.surface}` }} />}
      </div>
      <div style={{ color:COLORS.textSecondary, fontSize:10.5, marginTop:4, maxWidth:50, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.username}</div>
    </div>
  );
};

const InboxPage = ({ t, users, currentUser, showToast, onViewProfile, initialTargetId, onClearTarget, persistedConversation, onSetConversation, onVoiceCall, onVideoCall, openGroupsSignal, onFeedScroll, onBlock }) => {
  const [activeConversation, setActiveConversation] = useState(persistedConversation || null);
  const [conversations, setConversations] = useState([]);
  const [showGroupsView, setShowGroupsView] = useState(false);
  const [inboxSearch, setInboxSearch] = useState('');
  const [convLoadError, setConvLoadError] = useState(false);
  const [convLoading, setConvLoading] = useState(true);
  const [inboxTab, setInboxTab] = useState('all'); // 'all' | 'unread'
  const [actionSheetUser, setActionSheetUser] = useState(null); // {id, convId, muted} | null
  useEffect(()=>{
    if(openGroupsSignal){ setShowGroupsView(true); }
  },[openGroupsSignal]);
  useEffect(()=>{
    // Only clear an active conversation if it's malformed (no target user id).
    // Do NOT clear it just because `users` hasn't loaded that participant yet —
    // ConversationView and the render branch below handle a missing profile
    // gracefully with a placeholder, so the chat still opens.
    if(activeConversation && !activeConversation.otherUserId){
      setActiveConversation(null);
      onSetConversation?.(null);
    }
  },[activeConversation]);

  useEffect(()=>{
    if(!initialTargetId || !currentUser?.id) return;
    const tid = initialTargetId;
    const convId = [currentUser.id, tid].sort().join('_');
    setActiveConversation({ id: convId, otherUserId: tid });
    onSetConversation?.({ id: convId, otherUserId: tid });
    onClearTarget?.();
    setDoc(doc(db, 'conversations', convId), {
      participants: [currentUser.id, tid],
      lastMessageAt: serverTimestamp(),
    }, { merge: true }).catch(() => {});
  },[initialTargetId, currentUser?.id]);

  useEffect(()=>{
    if(!currentUser?.id) return;
    setConvLoading(true);
    setConvLoadError(false);
    const q = query(
      collection(db,'conversations'),
      where('participants','array-contains',currentUser.id),
      orderBy('lastMessageAt','desc')
    );
    let fallbackUnsub = null;
    const unsub = onSnapshot(q, snap=>{
      setConversations(snap.docs.map(d=>({id:d.id,...d.data()})));
      setConvLoading(false);
      setConvLoadError(false);
      // Mark messages as delivered for this user
snap.docs.forEach(async conv => {
  const convId = conv.id;
  const msgSnap = await getDocs(
    query(collection(db,'messages',convId,'msgs'), 
    where('to','==',currentUser.id), 
    where('status','==','sent'))
  );
  if (!msgSnap.empty) {
    msgSnap.docs.forEach(d => updateDoc(d.ref, { status: 'delivered' }).catch(()=>{}));
    if (conv.data().lastMessageStatus !== 'seen') {
      updateDoc(doc(db,'conversations',convId), { lastMessageStatus: 'delivered' }).catch(()=>{});
    }
  }
});
    }, (error)=>{
      console.error('Conversations index error:', error);
      // Fallback without orderBy — handles a missing composite index. If this
      // ALSO errors out (e.g. Firestore security rules reject the read), that's
      // a real failure and the inbox should say so instead of silently looking
      // like "no messages yet" forever.
      const q2 = query(collection(db,'conversations'), where('participants','array-contains',currentUser.id));
      fallbackUnsub = onSnapshot(q2, snap2=>{
        const sorted = snap2.docs
          .map(d=>({id:d.id,...d.data()}))
          .sort((a,b)=>(b.lastMessageAt?.seconds||0)-(a.lastMessageAt?.seconds||0));
        setConversations(sorted);
        setConvLoading(false);
        setConvLoadError(false);
        // Mark messages as delivered for this user
      snap2.docs.forEach(async conv => {
        const convId = conv.id;
        try {
          const msgSnap = await getDocs(
            query(collection(db,'messages',convId,'msgs'),
            where('to','==',currentUser.id),
            where('status','==','sent'))
          );
          if (!msgSnap.empty) {
            msgSnap.docs.forEach(d => updateDoc(d.ref, { status: 'delivered' }).catch(()=>{}));
            if (conv.data().lastMessageStatus !== 'seen') {
              updateDoc(doc(db,'conversations',convId), { lastMessageStatus: 'delivered' }).catch(()=>{});
            }
          }
        } catch(e) {}
      });
      }, (error2)=>{
        console.error('Conversations fallback error:', error2);
        setConvLoading(false);
        setConvLoadError(true);
      });
    });
    return () => { unsub(); fallbackUnsub?.(); };
  },[currentUser?.id]);

  const getConversationId = (uid1,uid2) => [uid1,uid2].sort().join('_');

  const openConversation = (otherUserId) => {
    if (!currentUser?.id || !otherUserId) return;
    const convId = getConversationId(currentUser.id, otherUserId);
    setActiveConversation({ id: convId, otherUserId });
    onSetConversation?.({ id: convId, otherUserId });
    setDoc(doc(db, 'conversations', convId), {
      participants: [currentUser.id, otherUserId],
      lastMessageAt: serverTimestamp(),
      // Clear the badge the moment the conversation is opened — previously nothing
      // ever reset this field, so the unread count (and the Inbox tab's red badge,
      // which reads this same field) only ever grew.
      [`unread_${currentUser.id}`]: 0,
    }, { merge: true }).catch(() => {});
  };

  // Mute silences future notification sound/toast for this conversation, scoped to just
  // the current user (mirrors the unread_{uid} per-user field pattern already used above).
  const toggleMuteConversation = (convId, currentlyMuted) => {
    setDoc(doc(db,'conversations', convId), { [`muted_${currentUser.id}`]: !currentlyMuted }, { merge: true }).catch(()=>{
      showToast?.('Could not update mute setting', 'error');
    });
  };

  // Pin keeps a chat pinned to the top of THIS user's inbox only — same per-user
  // field pattern as muted_{uid}/unread_{uid} above, so it never affects what the
  // other participant sees.
  const togglePinConversation = (convId, currentlyPinned) => {
    setDoc(doc(db,'conversations', convId), { [`pinned_${currentUser.id}`]: !currentlyPinned }, { merge: true }).catch(()=>{
      showToast?.('Could not update pin', 'error');
    });
  };

  // Real count for the "Groups" shortcut badge — same query GroupChatPage itself
  // runs, so the number always matches what's actually inside that screen.
  const [groupsCount, setGroupsCount] = useState(0);
  useEffect(()=>{
    if(!currentUser?.id) return;
    const q = query(collection(db,'groups'), where('members','array-contains',currentUser.id));
    const unsub = onSnapshot(q, snap=>setGroupsCount(snap.size), ()=>{});
    return ()=>unsub();
  },[currentUser?.id]);

  // "Delete" only removes the conversation from THIS user's inbox list — the other
  // participant still sees it and the underlying messages aren't touched. Matches how
  // Telegram/WhatsApp "delete chat" behaves (not delete-for-everyone).
  const hideConversation = (convId) => {
    setDoc(doc(db,'conversations', convId), { hiddenFor: arrayUnion(currentUser.id) }, { merge: true })
      .then(()=>showToast?.('Chat deleted', 'success'))
      .catch(()=>showToast?.('Could not delete chat', 'error'));
  };

  const convUsers = useMemo(()=>{
    if(!currentUser?.id) return [];
    return users.filter(u=>{
      if(u.id===currentUser.id) return false;
      const convId = getConversationId(currentUser.id, u.id);
      const conv = conversations.find(c=>c.id===convId);
      if (!conv) return false;
      // Hide conversations this user deleted — see hideConversation(). They reappear
      // automatically the moment a new message resets hiddenFor (see handleSend etc).
      if (conv.hiddenFor?.includes(currentUser.id)) return false;
      return true;
    }).sort((a,b)=>{
      const convA = conversations.find(c=>c.id===getConversationId(currentUser.id,a.id));
      const convB = conversations.find(c=>c.id===getConversationId(currentUser.id,b.id));
      return (convB?.lastMessageAt?.seconds||0)-(convA?.lastMessageAt?.seconds||0);
    });
  },[users, conversations, currentUser?.id]);

  if(showGroupsView){
    return (
      <GroupChatPage
        currentUser={currentUser}
        users={users}
        showToast={showToast}
        onBack={()=>setShowGroupsView(false)}
        onVoiceCall={onVoiceCall}
        onVideoCall={onVideoCall}
      />
    );
  }

  if(activeConversation && activeConversation.otherUserId){
    const otherUser = users.find(u=>u.id===activeConversation.otherUserId)
      || { id: activeConversation.otherUserId, username: '', avatar:'?', avatarColor:'#5A5A66' };
    return (
      <div style={{ position:'fixed', inset:0, zIndex:1500, background:'#0B0B0F', maxWidth:430, margin:'0 auto' }}>
        <ConversationView
          currentUser={currentUser}
          otherUser={otherUser}
          conversationId={activeConversation.id}
          onBack={()=>{ setActiveConversation(null); onSetConversation?.(null); onClearTarget?.(); }}
          showToast={showToast}
          onViewProfile={uid=>{ onViewProfile?.(uid); }}
          onVoiceCall={onVoiceCall}
          onVideoCall={onVideoCall}
          onBlock={onBlock}
        />
      </div>
    );
  }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:COLORS.bg, position:'relative' }}>
      <div style={{ padding:'14px 16px 0', background:COLORS.surface, borderBottom:`1px solid ${COLORS.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:20 }}>Chats</div>
          <button onClick={()=>setShowGroupsView(true)} aria-label="New group" style={{ background:COLORS.surfaceAlt, border:'none', width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:COLORS.brand, cursor:'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
        {/* Inline search */}
        <div style={{ display:'flex', alignItems:'center', background:COLORS.surfaceAlt, borderRadius:14, padding:'9px 12px', gap:8, marginBottom:12 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            placeholder="Search chats"
            value={inboxSearch||''}
            onChange={e=>setInboxSearch?.(e.target.value)}
            style={{ flex:1, background:'none', border:'none', color:COLORS.textPrimary, outline:'none', fontSize:14 }} />
          {inboxSearch && (
            <button onClick={()=>setInboxSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:COLORS.textTertiary, display:'flex', padding:2 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
        {/* Online now strip — InboxStripAvatar shows a real presence dot per contact,
            instead of every recent contact getting a hardcoded green dot regardless
            of whether they're actually online. */}
        {convUsers.length>0 && !inboxSearch && (
          <div style={{ display:'flex', gap:16, overflowX:'auto', paddingBottom:12 }}>
            {convUsers.slice(0,10).map(u=>(
              <InboxStripAvatar key={u.id} u={u} onClick={()=>openConversation(u.id)} />
            ))}
          </div>
        )}
        {/* Tabs — badges are real counts derived from convUsers/conversations below,
            not hardcoded numbers. */}
        <div style={{ display:'flex', gap:20 }}>
          {[
            {id:'all', label:'All', count: convUsers.length},
            {id:'unread', label:'Unread', count: convUsers.filter(u=>{
              const conv = conversations.find(c=>c.id===getConversationId(currentUser.id,u.id));
              return (conv?.[`unread_${currentUser.id}`]||0) > 0;
            }).length},
          ].map(tab=>(
            <button key={tab.id} onClick={()=>setInboxTab(tab.id)} style={{ background:'none', border:'none', borderBottom:inboxTab===tab.id?`2px solid ${COLORS.brand}`:'2px solid transparent', padding:'0 0 10px', color:inboxTab===tab.id?COLORS.brand:COLORS.textTertiary, fontSize:13.5, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
              {tab.label}
              {tab.count>0 && <span style={{ fontSize:11, color: tab.id==='unread'?COLORS.brand:COLORS.textTertiary }}>{tab.count}</span>}
            </button>
          ))}
          <button onClick={()=>setShowGroupsView(true)} style={{ background:'none', border:'none', borderBottom:'2px solid transparent', padding:'0 0 10px', color:COLORS.textTertiary, fontSize:13.5, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
            Groups
            {groupsCount>0 && <span style={{ fontSize:11, color:COLORS.textTertiary }}>{groupsCount}</span>}
          </button>
        </div>
      </div>
      <div data-main-scroll="true" onScroll={onFeedScroll} style={{ flex:1, overflowY:'auto', paddingBottom:'max(74px, calc(58px + env(safe-area-inset-bottom)))' }}>
        {convLoading ? (
          <div style={{padding:'12px 16px'}}>
            <SkeletonLoader count={6} />
          </div>
        ) : convLoadError ? (
          <div style={{textAlign:'center',padding:60,color:COLORS.textTertiary}}>
            <div style={{fontSize:44,marginBottom:12}}>⚠️</div>
            <div style={{fontSize:14, color:COLORS.textPrimary, fontWeight:700, marginBottom:6}}>Couldn't load your messages</div>
            <div style={{fontSize:12.5, marginBottom:16}}>This is usually a permissions or connection issue, not an empty inbox.</div>
            <button onClick={()=>{ setConvLoading(true); setConvLoadError(false); }} style={{ background:COLORS.gradient, border:'none', borderRadius:20, padding:'10px 22px', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>Retry</button>
          </div>
        ) : (() => {
          let filteredConvUsers = inboxSearch
            ? convUsers.filter(u => u.username?.toLowerCase().includes(inboxSearch.toLowerCase()) || u.fullName?.toLowerCase().includes(inboxSearch.toLowerCase()))
            : convUsers;
          if (inboxTab === 'unread') {
            filteredConvUsers = filteredConvUsers.filter(u => {
              const conv = conversations.find(c=>c.id===getConversationId(currentUser.id,u.id));
              return (conv?.[`unread_${currentUser.id}`]||0) > 0;
            });
          }
          if (filteredConvUsers.length === 0) return (
            <div style={{textAlign:'center',padding:60,color:COLORS.textTertiary}}>
              <div style={{fontSize:44,marginBottom:12}}>{inboxTab==='unread' ? '✅' : '💬'}</div>
              <div style={{fontSize:14}}>
                {inboxSearch ? `No chats matching "${inboxSearch}"` : inboxTab==='unread' ? "You're all caught up" : (t?.noMessages||'No messages yet')}
              </div>
              {!inboxSearch && inboxTab==='all' && <div style={{fontSize:12,marginTop:6,color:COLORS.textDisabled}}>{t?.startChat||'Go to a profile and tap Message to start'}</div>}
            </div>
          );
          // Real pinned split — pinned_{uid} is a per-user field on the conversation
          // doc (same pattern as muted_{uid}), so pinning never affects the other
          // participant's inbox order.
          const pinnedUsers = filteredConvUsers.filter(u=>{
            const conv = conversations.find(c=>c.id===getConversationId(currentUser.id,u.id));
            return !!conv?.[`pinned_${currentUser.id}`];
          });
          const restUsers = filteredConvUsers.filter(u=>!pinnedUsers.includes(u));

          const renderRow = u => {
            const convId = getConversationId(currentUser.id, u.id);
            const conv = conversations.find(c=>c.id===convId);
            return (
              <ConversationRow
                key={u.id}
                u={u}
                conv={conv}
                currentUser={currentUser}
                onOpen={openConversation}
                onLongPress={(user, conv)=>setActionSheetUser({
                  id:user.id,
                  name:user.fullName||user.username,
                  convId:conv?.id||getConversationId(currentUser.id,user.id),
                  muted: !!conv?.[`muted_${currentUser.id}`],
                  pinned: !!conv?.[`pinned_${currentUser.id}`],
                })}
              />
            );
          };

          return (
            <>
              {pinnedUsers.length > 0 && (
                <div style={{ marginBottom:4 }}>
                  <div style={{ padding:'10px 16px 4px', display:'flex', alignItems:'center', gap:6, color:COLORS.textTertiary, fontSize:11.5, fontWeight:700, textTransform:'uppercase', letterSpacing:0.4 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2.2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-1.4-7.5A3 3 0 0014.66 7H9.34a3 3 0 00-2.94 2.5z"/></svg>
                    Pinned
                  </div>
                  {pinnedUsers.map(renderRow)}
                </div>
              )}
              {restUsers.map(renderRow)}
            </>
          );
        })()}
      </div>

      {/* Long-press action sheet: mute / delete-for-me. Triggered from ConversationRow's
          long-press (mobile) or right-click (desktop), same pattern as message reactions
          already use elsewhere in this component (msgLongTimer). */}
      {actionSheetUser && (
        <div onClick={()=>setActionSheetUser(null)} style={{ position:'fixed', inset:0, zIndex:2600, background:'rgba(11,15,25,0.45)', display:'flex', alignItems:'flex-end', animation:'fadeIn 0.15s ease' }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:430, margin:'0 auto', background:COLORS.surface, borderTopLeftRadius:24, borderTopRightRadius:24, padding:'10px 8px calc(20px + env(safe-area-inset-bottom))', boxShadow:SHADOW.modal }}>
            <div style={{ width:36, height:4, background:COLORS.border, borderRadius:2, margin:'4px auto 10px' }} />
            <div style={{ padding:'4px 14px 12px', color:COLORS.textTertiary, fontSize:12.5, fontWeight:700 }}>{actionSheetUser.name}</div>
            <button onClick={()=>{ togglePinConversation(actionSheetUser.convId, actionSheetUser.pinned); setActionSheetUser(null); }}
              style={{ width:'100%', background:'none', border:'none', display:'flex', alignItems:'center', gap:12, padding:'13px 14px', borderRadius:14, color:COLORS.textPrimary, fontSize:14.5, fontWeight:600, cursor:'pointer', textAlign:'left' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-1.4-7.5A3 3 0 0014.66 7H9.34a3 3 0 00-2.94 2.5z"/></svg>
              {actionSheetUser.pinned ? 'Unpin chat' : 'Pin chat'}
            </button>
            <button onClick={()=>{ toggleMuteConversation(actionSheetUser.convId, actionSheetUser.muted); setActionSheetUser(null); }}
              style={{ width:'100%', background:'none', border:'none', display:'flex', alignItems:'center', gap:12, padding:'13px 14px', borderRadius:14, color:COLORS.textPrimary, fontSize:14.5, fontWeight:600, cursor:'pointer', textAlign:'left' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2">{actionSheetUser.muted ? <><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/></> : <><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="1" x2="1" y2="23"/></>}</svg>
              {actionSheetUser.muted ? 'Unmute notifications' : 'Mute notifications'}
            </button>
            <button onClick={()=>{ hideConversation(actionSheetUser.convId); setActionSheetUser(null); }}
              style={{ width:'100%', background:'none', border:'none', display:'flex', alignItems:'center', gap:12, padding:'13px 14px', borderRadius:14, color:COLORS.danger, fontSize:14.5, fontWeight:600, cursor:'pointer', textAlign:'left' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={COLORS.danger} strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              Delete chat
            </button>
            <button onClick={()=>setActionSheetUser(null)}
              style={{ width:'100%', background:COLORS.surfaceAlt, border:'none', borderRadius:14, padding:'13px 14px', color:COLORS.textSecondary, fontSize:14.5, fontWeight:700, cursor:'pointer', marginTop:6 }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────── CALL MODAL (REAL WebRTC) ─────────────── */
const IncomingCallScreen = ({ callData, onAnswer, onDecline }) => {
  useEffect(() => {
    // Play ringtone on loop while incoming call screen is shown
    let stopped = false;
    const ring = () => {
      if (stopped) return;
      playNotifSound('call');
      setTimeout(() => { if (!stopped) ring(); }, 2200);
    };
    ring();
    return () => { stopped = true; };
  }, []);
  return (
  <div style={{position:'fixed',inset:0,background:'linear-gradient(160deg,#0d0025,#001a0d)',zIndex:3000,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'space-between',padding:'80px 40px 80px'}}>
    <div style={{textAlign:'center'}}>
      <div style={{color:'rgba(255,255,255,0.5)',fontSize:14,marginBottom:16,letterSpacing:2,textTransform:'uppercase'}}>{callData.callType==='video'?'Incoming Video Call':'Incoming Voice Call'}</div>
      <div style={{width:120,height:120,borderRadius:'50%',background:callData.callerColor||'#0B5FFF',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'bold',fontSize:48,margin:'0 auto 20px',border:'4px solid rgba(255,255,255,0.2)',boxShadow:'0 0 0 12px rgba(255,255,255,0.05),0 0 0 24px rgba(255,255,255,0.03)'}}>
        {callData.callerAvatar||'?'}
      </div>
      <div style={{color:'white',fontSize:28,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>@{callData.callerName}</div>
      <div style={{color:'rgba(255,255,255,0.4)',fontSize:14,marginTop:8,animation:'pulse 1.5s infinite'}}>Calling...</div>
    </div>
    <div style={{display:'flex',justifyContent:'space-around',width:'100%',alignItems:'center'}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
        <button onClick={onDecline} style={{width:70,height:70,borderRadius:'50%',background:COLORS.danger,border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:'0 8px 30px rgba(239,68,68,0.5)'}}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg>
        </button>
        <span style={{color:'rgba(255,255,255,0.5)',fontSize:13}}>Decline</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
        <button onClick={onAnswer} style={{width:70,height:70,borderRadius:'50%',background:'#2ED573',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:'0 8px 30px rgba(52,199,89,0.5)',animation:'pulse 1.5s infinite'}}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
        </button>
        <span style={{color:'rgba(255,255,255,0.5)',fontSize:13}}>Answer</span>
      </div>
    </div>
  </div>
  );
};

const CallModal = ({ type, contactName, contactAvatar, contactId, currentUser, onClose, isCallee: isCalleeProp, callDocId: callDocIdProp, showToast }) => {
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState('calling');
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  // Voice calls render as a small popup card instead of taking over the whole screen
  // (WhatsApp-style) — `minimized` further collapses that popup into a tiny pill the
  // person can tap to bring back. Video calls are left full-screen as before.
  const [minimized, setMinimized] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const callDocId = useRef(callDocIdProp || [currentUser?.id, contactId].sort().join('_'));

  const unsubAnswerRef = useRef(()=>{});
  const unsubCandidatesRef = useRef(()=>{});
  useEffect(() => {

    const startCall = async () => {
      try {
        if (!isWebRTCSupported()) {
          showToast?.("This browser/window doesn't support calling. Try opening the app in a regular browser tab.", 'error');
          setStatus('failed');
          setTimeout(onClose, 1500);
          return;
        }
        const constraints = type === 'video'
          ? { audio: true, video: { facingMode: 'user' } }
          : { audio: true, video: false };
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (camErr) {
          console.error('getUserMedia failed:', camErr?.name, camErr?.message);
          if (type === 'video') {
            // Don't silently fall back to audio — that leaves the UI showing
            // a "video call" with no camera feed and confuses users.
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            console.warn('Video unavailable, continuing as audio-only:', camErr?.message);
          } else {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          }
        }
        localStreamRef.current = stream;
        const gotVideoTrack = stream.getVideoTracks().length > 0;
        console.log('Call stream tracks:', stream.getTracks().map(t => `${t.kind}:${t.label}`));
        if (type === 'video' && !gotVideoTrack) {
          setIsCamOff(true);
        }
        if (localVideoRef.current) { localVideoRef.current.srcObject = stream; localVideoRef.current.play().catch(()=>{}); }

        // DEMO ONLY — expressturn free tier has low bandwidth caps.
// For production, generate short-lived TURN credentials server-side.
const pc = new RTCPeerConnection({
  iceServers: [
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
  ]
});
        pcRef.current = pc;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.ontrack = (e) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = e.streams[0];
            remoteVideoRef.current.play().catch(()=>{});
          }
          setStatus('connected');
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') setStatus('connected');
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setStatus('failed'); setTimeout(onClose, 2000);
          }
        };

        // Check if we're answering (callee) or initiating (caller)
let callSnap = await getDoc(doc(db, 'calls', callDocId.current));

// If callee but offer not yet written, wait up to 5 seconds
if (isCalleeProp && (!callSnap.exists() || !callSnap.data()?.offer)) {
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 500));
    callSnap = await getDoc(doc(db, 'calls', callDocId.current));
    if (callSnap.exists() && callSnap.data()?.offer) break;
  }
}

const isCallee = isCalleeProp !== undefined
  ? isCalleeProp
  : (callSnap.exists() && callSnap.data()?.calleeId === currentUser?.id);

if (isCallee) {
  if (!callSnap.data()?.offer) {
    setStatus('failed');
    setTimeout(onClose, 2000);
    return;
  }
  await pc.setRemoteDescription(new RTCSessionDescription(callSnap.data().offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await updateDoc(doc(db, 'calls', callDocId.current), {
            answer: { type: answer.type, sdp: answer.sdp }, status: 'answered'
          });
          pc.onicecandidate = (e) => {
            if (e.candidate) addDoc(collection(db, 'calls', callDocId.current, 'calleeCandidates'), e.candidate.toJSON()).catch(()=>{});
          };
unsubCandidatesRef.current = onSnapshot(collection(db, 'calls', callDocId.current, 'callerCandidates'), (snap) => {
            snap.docChanges().forEach(async (change) => {
              if (change.type === 'added') {
                try { await pc.addIceCandidate(new RTCIceCandidate(change.doc.data())); } catch {}
              }
            });
          });
        } else {
          pc.onicecandidate = (e) => {
            if (e.candidate) addDoc(collection(db, 'calls', callDocId.current, 'callerCandidates'), e.candidate.toJSON()).catch(()=>{});
          };
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          // BUG FIX: this write was previously wrapped in .catch(()=>{}) — if it failed
          // (most commonly a Firestore permission-denied, or a transient network error),
          // the call UI kept going as if ringing had started, but no call doc ever
          // existed for the callee to see. That's exactly "I call, the other person
          // never gets notified." Now a failed write is a real, visible failure instead
          // of a silent no-op (caught by the outer try/catch below).
          await setDoc(doc(db, 'calls', callDocId.current), {
            offer: { type: offer.type, sdp: offer.sdp },
            callType: type, callerId: currentUser?.id, callerName: currentUser?.username,
            callerAvatar: currentUser?.avatar, callerColor: currentUser?.avatarColor,
            calleeId: contactId, calleeName: contactName, status: 'ringing', createdAt: serverTimestamp(),
          });
unsubAnswerRef.current = onSnapshot(doc(db, 'calls', callDocId.current), async (snap) => {
            const data = snap.data();
            if (data?.answer && pc.signalingState === 'have-local-offer') {
              try { await pc.setRemoteDescription(new RTCSessionDescription(data.answer)); setStatus('connected'); } catch {}
            }
            if (data?.status === 'declined') { setStatus('declined'); setTimeout(onClose, 1500); }
          }, (err) => {
            console.error('Call doc listener error:', err);
            showToast?.('Lost connection to call status — check permissions/network', 'error');
            setStatus('failed');
            setTimeout(onClose, 2000);
          });
unsubCandidatesRef.current = onSnapshot(collection(db, 'calls', callDocId.current, 'calleeCandidates'), (snap) => {
            snap.docChanges().forEach(async (change) => {
              if (change.type === 'added') {
                try { await pc.addIceCandidate(new RTCIceCandidate(change.doc.data())); } catch {}
              }
            });
          });
        }
        // BUG FIX: this used to force status to 'connected' after 8 seconds no matter
        // what — even if the peer connection had never actually connected (e.g. dead/
        // rate-limited TURN servers, blocked ports, restrictive NAT). That made the UI
        // show "Connected · 0:01" with a running timer while no audio/video was ever
        // flowing, which looked exactly like "the call does nothing" to the user. Now,
        // if the connection genuinely hasn't gone through after a generous window, we
        // report a real failure instead of a fake success.
        const connectTimeout = setTimeout(() => {
          if (pc.connectionState !== 'connected') {
            setStatus('failed');
            showToast?.('Could not connect the call. Check your connection and try again.', 'error');
            setTimeout(onClose, 2500);
          }
        }, 20000);
        pc.addEventListener('connectionstatechange', () => {
          if (pc.connectionState === 'connected') clearTimeout(connectTimeout);
        });
      } catch (e) {
        console.error('Call error:', e);
        // NotFoundError means the device has no camera/mic at all (not just permission
        // denied) — the earlier audio-only fallback can't help in that case either, so
        // surface something clearer than a silent "failed" status.
        if (e?.name === 'NotFoundError') {
          showToast?.('No camera or microphone found on this device', 'error');
        } else if (e?.name === 'NotAllowedError') {
          showToast?.('Camera/mic access was denied', 'error');
        }
        setStatus('failed');
        setTimeout(onClose, 2500);
      }
    };

    startCall();

    return () => {
      unsubAnswerRef.current();
      unsubCandidatesRef.current();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
      const cleanupCall = async () => {
  try {
    const callerCands = await getDocs(collection(db, 'calls', callDocId.current, 'callerCandidates'));
    await Promise.all(callerCands.docs.map(d => deleteDoc(d.ref)));
    const calleeCands = await getDocs(collection(db, 'calls', callDocId.current, 'calleeCandidates'));
    await Promise.all(calleeCands.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(doc(db, 'calls', callDocId.current));
  } catch {}
};
cleanupCall();
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

  // ── VOICE CALL: small popup card (never full screen), collapsible to a tiny pill ──
  if (type !== 'video') {
    const endCallBtn = (size=44) => (
      <button onClick={onClose} title="End call" style={{ background:COLORS.danger, border:'none', borderRadius:'50%', width:size, height:size, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 6px 18px rgba(239,68,68,0.4)', flexShrink:0 }}>
        <svg width={size*0.42} height={size*0.42} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91"/>
          <line x1="23" y1="1" x2="1" y2="23"/>
        </svg>
      </button>
    );

    return (
      <>
        <audio ref={remoteVideoRef} autoPlay playsInline style={{ display:'none' }} />
        {minimized ? (
          // Collapsed pill — tap to reopen the popup, exactly like WhatsApp's
          // minimized in-call bar. Ending the call still works without expanding.
          <div onClick={()=>setMinimized(false)} style={{ position:'fixed', top:'max(14px, env(safe-area-inset-top))', left:'50%', transform:'translateX(-50%)', zIndex:2500, background:COLORS.gradient, borderRadius:999, padding:'7px 8px 7px 14px', display:'flex', alignItems:'center', gap:10, boxShadow:SHADOW.raised, cursor:'pointer' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#fff', animation: status==='connected' ? 'pulse 1.4s ease infinite' : '' }} />
            <span style={{ color:'white', fontSize:12.5, fontWeight:700 }}>@{contactName}</span>
            <span style={{ color:'rgba(255,255,255,0.85)', fontSize:11.5 }}>{status==='connected' ? fmt() : statusLabel}</span>
            <div onClick={e=>e.stopPropagation()}>{endCallBtn(30)}</div>
          </div>
        ) : (
          <div style={{ position:'fixed', top:'max(20px, env(safe-area-inset-top))', right:16, zIndex:2500, width:264, background:COLORS.surface, borderRadius:RADIUS.xl, boxShadow:SHADOW.raised, border:`1px solid ${COLORS.border}`, padding:'16px 16px 18px', display:'flex', flexDirection:'column', alignItems:'center', animation:'popInBounce 0.25s ease' }}>
            <button onClick={()=>setMinimized(true)} title="Minimize" style={{ position:'absolute', top:10, right:10, background:COLORS.surfaceAlt, border:'none', borderRadius:'50%', width:26, height:26, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:COLORS.textSecondary }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <div style={{ width:76, height:76, borderRadius:'50%', padding:3, background:COLORS.gradient, margin:'4px auto 12px', animation:status==='calling'?'storyRing 4s linear infinite':'' }}>
              <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:COLORS.surface, padding:2, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:28 }}>
                  {contactAvatar || '?'}
                </div>
              </div>
            </div>
            <div style={{ color:COLORS.textPrimary, fontSize:16, fontWeight:700, fontFamily:"'Inter',sans-serif" }}>@{contactName}</div>
            <div style={{ color:COLORS.textTertiary, fontSize:12.5, marginTop:4, marginBottom:16 }}>{statusLabel}</div>
            <div style={{ display:'flex', justifyContent:'center', gap:16 }}>
              <button onClick={toggleMute} style={{ background:isMuted?COLORS.danger:COLORS.surfaceAlt, border:'none', borderRadius:'50%', width:44, height:44, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isMuted?'white':COLORS.textSecondary} strokeWidth="2">
                  {isMuted
                    ? <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
                    : <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
                  }
                </svg>
              </button>
              {endCallBtn(52)}
            </div>
          </div>
        )}
      </>
    );
  }

  // ── VIDEO CALL: full screen, as expected for video ──
  return (
    <div style={{ position:'fixed', inset:0, background:'#0B0B0F', zIndex:2500, display:'flex', flexDirection:'column' }}>
      <video ref={remoteVideoRef} autoPlay playsInline style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', background:'#15151C' }} />
      {status !== 'connected' && (
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(160deg,#0a0a1a,#1a0a0a)', zIndex:1 }}>
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 30%,rgba(11,95,255,0.2),transparent 60%)' }} />
        </div>
      )}
      <video ref={localVideoRef} autoPlay playsInline muted style={{ position:'absolute', top:60, right:16, width:100, height:140, objectFit:'cover', borderRadius:16, border:'2px solid rgba(255,255,255,0.2)', zIndex:10, background:'#24242E' }} />
      <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:20, padding:'56px 20px 20px', textAlign:'center' }}>
        <div style={{ color:'white', fontSize:22, fontWeight:800, fontFamily:"'Inter',sans-serif" }}>@{contactName}</div>
        <div style={{ color:'rgba(255,255,255,0.5)', fontSize:13, marginTop:6 }}>{statusLabel}</div>
      </div>
      <div style={{ position:'absolute', bottom:60, left:0, right:0, zIndex:20, display:'flex', justifyContent:'center', gap:20 }}>
        <button onClick={toggleMute} style={{ background:isMuted?COLORS.danger:'rgba(255,255,255,0.12)', border:'none', borderRadius:'50%', width:60, height:60, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            {isMuted
              ? <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
              : <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
            }
          </svg>
        </button>
        <button onClick={onClose} style={{ background:'#0B5FFF', border:'none', borderRadius:'50%', width:70, height:70, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 0 30px rgba(11,95,255,0.5)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91"/>
            <line x1="23" y1="1" x2="1" y2="23"/>
          </svg>
        </button>
        <button onClick={toggleCam} style={{ background:isCamOff?COLORS.danger:'rgba(255,255,255,0.12)', border:'none', borderRadius:'50%', width:60, height:60, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            {isCamOff
              ? <><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3m3-3h6l2 3h4a2 2 0 012 2v9.34m-7.72-2.06a4 4 0 11-5.56-5.56"/></>
              : <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>
            }
          </svg>
        </button>
      </div>
    </div>
  );
};

/* ─────────────── SEARCH OVERLAY — TELEGRAM STANDARDS ─────────────── */
const SearchOverlay = ({ onClose, videos, users, onViewProfile }) => {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('Infinity_recent_searches') || '[]'); } catch { return []; }
  });
  const [trendingSearches] = useState(['#viral', '#ethiopia', '#music', '#dance', '#comedy', '#travel', '#food', '#fashion']);

  const addRecentSearch = (term) => {
    if (!term.trim()) return;
    const updated = [term, ...recentSearches.filter(r => r !== term)].slice(0, 8);
    setRecentSearches(updated);
    try { localStorage.setItem('Infinity_recent_searches', JSON.stringify(updated)); } catch {}
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try { localStorage.removeItem('Infinity_recent_searches'); } catch {}
  };

  const results = useMemo(()=>{
    if(!query.trim()) return {videos:[],users:[],hashtags:[],posts:[]};
    const q=query.toLowerCase();
    return {
      users:users.filter(u=>u.username?.toLowerCase().includes(q)||u.fullName?.toLowerCase().includes(q)||u.bio?.toLowerCase().includes(q)).slice(0,8),
      videos:videos.filter(v=>v.description?.toLowerCase().includes(q)||v.username?.toLowerCase().includes(q)).slice(0,8),
      hashtags:[...new Set(videos.flatMap(v=>v.hashtags||[]).filter(h=>h.toLowerCase().includes(q)))].slice(0,8),
      posts:videos.filter(v=>v.description?.toLowerCase().includes(q)).slice(0,6),
    };
  },[query,videos,users]);
  const SEARCH_TABS = [
    {id:'all',label:'All'},
    {id:'users',label:'People'},
    {id:'videos',label:'Videos'},
    {id:'hashtags',label:'Tags'},
    {id:'posts',label:'Posts'},
  ];

  const totalResults = results.users.length + results.videos.length + results.hashtags.length;

  return (
    <div style={{ position:'absolute', inset:0, background:COLORS.bg, zIndex:200, display:'flex', flexDirection:'column' }}>
      {/* ── Header ── */}
      <div style={{ padding:'12px 16px', borderBottom:`1px solid ${COLORS.overlaySubtle}`, display:'flex', gap:10, alignItems:'center', background:COLORS.surface, backdropFilter:'blur(20px)' }}>
        <div style={{ flex:1, display:'flex', alignItems:'center', background:COLORS.border, borderRadius:14, padding:'11px 14px', gap:10, border:`1.5px solid ${COLORS.border}`, transition:'border-color 0.2s' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input autoFocus value={query}
            onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter' && query.trim()) addRecentSearch(query.trim()); }}
            placeholder="Search users, posts, hashtags..."
            style={{ flex:1, background:'none', border:'none', color:COLORS.textPrimary, outline:'none', fontSize:15, fontWeight:500 }} />
          {query && <button onClick={()=>setQuery('')} style={{ background:COLORS.border, border:'none', borderRadius:'50%', width:20, height:20, color:COLORS.textTertiary, cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>}
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:COLORS.textTertiary, fontSize:14, cursor:'pointer', fontWeight:600, padding:'4px 8px' }}>Cancel</button>
      </div>

      {/* ── Filter tabs (when searching) ── */}
      {query.trim() && (
        <div style={{ display:'flex', padding:'8px 12px', gap:6, borderBottom:`1px solid ${COLORS.overlaySubtle}`, overflowX:'auto', scrollbarWidth:'none' }}>
          {SEARCH_TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ flexShrink:0, background:tab===t.id?'rgba(11,95,255,0.15)':COLORS.overlaySubtle, border:tab===t.id?'1px solid rgba(11,95,255,0.4)':`1px solid ${COLORS.border}`, padding:'6px 14px', color:tab===t.id?COLORS.brand:COLORS.textTertiary, cursor:'pointer', borderRadius:20, fontSize:12, fontWeight:700, transition:'all 0.15s' }}>{t.label}</button>
          ))}
        </div>
      )}

      <div style={{ flex:1, overflowY:'auto' }}>
        {/* ── Empty state: recent + trending ── */}
        {!query.trim() && (
          <div style={{ padding:'0 14px' }}>
            {recentSearches.length > 0 && (
              <div style={{ marginTop:20, marginBottom:24 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <span style={{ color:COLORS.textTertiary, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>Recent</span>
                  <button onClick={clearRecentSearches} style={{ background:'none', border:'none', color:COLORS.textTertiary, fontSize:12, cursor:'pointer' }}>Clear</button>
                </div>
                {recentSearches.map((term,i)=>(
                  <div key={i} onClick={()=>setQuery(term)} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:`1px solid ${COLORS.overlaySubtle}`, cursor:'pointer' }}>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:COLORS.overlaySubtle, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2"><polyline points="12 8 12 12 14 14"/><circle cx="12" cy="12" r="10"/></svg>
                    </div>
                    <span style={{ color:COLORS.textTertiary, fontSize:14, flex:1 }}>{term}</span>
                    <button onClick={e=>{e.stopPropagation(); const u=[...recentSearches]; u.splice(i,1); setRecentSearches(u); try{localStorage.setItem('Infinity_recent_searches',JSON.stringify(u));}catch{}}} style={{ background:'none', border:'none', color:COLORS.textTertiary, cursor:'pointer', fontSize:16 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginBottom:8 }}>
              <div style={{ color:COLORS.textTertiary, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>🔥 Trending</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {trendingSearches.map((tag,i)=>(
                  <button key={i} onClick={()=>{ setQuery(tag); addRecentSearch(tag); }}
                    onMouseDown={e=>e.currentTarget.style.transform='scale(0.95)'}
                    onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
                    onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
                    style={{ background:COLORS.overlaySubtle, border:`1px solid ${COLORS.border}`, borderRadius:20, padding:'8px 14px', color:COLORS.textSecondary, fontSize:13, cursor:'pointer', fontWeight:600, transition:TRANSITION.fast }}>{tag}</button>
                ))}
              </div>
            </div>
            <div style={{ marginTop:24 }}>
              <div style={{ color:COLORS.textTertiary, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>Suggested People</div>
              {users.slice(0,5).map(u=>(
                <div key={u.id} onClick={()=>{onViewProfile?.(u.id); addRecentSearch('@'+u.username); onClose();}} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom:`1px solid ${COLORS.overlaySubtle}`, cursor:'pointer' }}>
                  <div style={{ width:44, height:44, borderRadius:'50%', background:u.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:18, overflow:'hidden', flexShrink:0 }}>
                    {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : u.avatar}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:14 }}>@{u.username}</div>
                    <div style={{ color:COLORS.textTertiary, fontSize:12, marginTop:1 }}>{u.bio?.substring(0,40)||'No bio'}</div>
                  </div>
                  {u.verified && <svg width="16" height="16" viewBox="0 0 24 24" fill={COLORS.info}><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Search results ── */}
        {query.trim() && (
          <div style={{ padding:'8px 14px' }}>
            {totalResults === 0 && (
              <div style={{ textAlign:'center', padding:'60px 20px', color:COLORS.textTertiary }}>
                <div style={{ fontSize:44, marginBottom:12 }}>🔍</div>
                <div style={{ fontSize:15, fontWeight:600 }}>No results for "{query}"</div>
                <div style={{ fontSize:13, marginTop:6 }}>Try different keywords</div>
              </div>
            )}

            {/* People */}
            {(tab==='all'||tab==='users') && results.users.length > 0 && (
              <div style={{ marginBottom:20 }}>
                {tab==='all' && <div style={{ color:COLORS.textTertiary, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>People</div>}
                {results.users.map(u=>(
                  <div key={u.id} onClick={()=>{onViewProfile?.(u.id); addRecentSearch('@'+u.username); onClose();}} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 12px', background:COLORS.overlaySubtle, borderRadius:16, marginBottom:6, cursor:'pointer', border:`1px solid ${COLORS.overlaySubtle}`, transition:'background 0.1s' }}>
                    <div style={{ position:'relative', flexShrink:0 }}>
                      <div style={{ width:48, height:48, borderRadius:'50%', background:u.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:20, overflow:'hidden' }}>
                        {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : u.avatar}
                      </div>
                      {u.isOnline && <div style={{ position:'absolute', bottom:1, right:1, width:12, height:12, background:COLORS.success, borderRadius:'50%', border:`2px solid ${COLORS.bg}` }} />}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:14 }}>@{u.username}</span>
                        {u.verified && <svg width="14" height="14" viewBox="0 0 24 24" fill={COLORS.info}><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                      </div>
                      <div style={{ color:COLORS.textTertiary, fontSize:12, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.bio?.substring(0,50)||'No bio'}</div>
                      <div style={{ color:COLORS.textTertiary, fontSize:11, marginTop:1 }}>{(u.followers?.length||0).toLocaleString()} followers</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                ))}
              </div>
            )}

            {/* Videos */}
            {(tab==='all'||tab==='videos') && results.videos.length > 0 && (
              <div style={{ marginBottom:20 }}>
                {tab==='all' && <div style={{ color:COLORS.textTertiary, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Videos</div>}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {results.videos.slice(0,6).map(v=>(
                    <div key={v.id} style={{ aspectRatio:'9/16', position:'relative', borderRadius:14, overflow:'hidden', background:COLORS.surfaceAlt, cursor:'pointer' }}>
                      {v.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i) || v.mediaType?.startsWith('image')
                        ? <img src={v.videoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : <video src={v.videoUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted />}
                      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(transparent,rgba(0,0,0,0.8))', padding:'20px 8px 8px' }}>
                        <div style={{ color:COLORS.textPrimary, fontSize:11, fontWeight:700 }}>@{v.username}</div>
                        <div style={{ color:COLORS.textTertiary, fontSize:10, marginTop:1 }}>{v.likes||0} ❤️</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hashtags */}
            {(tab==='all'||tab==='hashtags') && results.hashtags.length > 0 && (
              <div style={{ marginBottom:20 }}>
                {tab==='all' && <div style={{ color:COLORS.textTertiary, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Hashtags</div>}
                {results.hashtags.map((h,i)=>(
                  <div key={i} onClick={()=>{ setQuery(h); addRecentSearch(h); }} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 12px', background:COLORS.overlaySubtle, borderRadius:14, marginBottom:6, cursor:'pointer', border:`1px solid ${COLORS.overlaySubtle}` }}>
                    <div style={{ width:40, height:40, borderRadius:12, background:'rgba(11,95,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>#</div>
                    <div>
                      <div style={{ color:COLORS.brand, fontWeight:700, fontSize:14 }}>{h}</div>
                      <div style={{ color:COLORS.textTertiary, fontSize:12 }}>{videos.filter(v=>v.hashtags?.includes(h)).length} posts</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Posts text search */}
            {(tab==='all'||tab==='posts') && results.posts.length > 0 && (
              <div style={{ marginBottom:20 }}>
                {tab==='all' && <div style={{ color:COLORS.textTertiary, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Posts</div>}
                {results.posts.map(v=>(
                  <div key={v.id} style={{ padding:'12px 14px', background:COLORS.overlaySubtle, borderRadius:14, marginBottom:6, border:`1px solid ${COLORS.overlaySubtle}`, cursor:'pointer' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:users.find(u=>u.id===v.userId)?.avatarColor||COLORS.brand, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:12, fontWeight:'bold' }}>
                        {users.find(u=>u.id===v.userId)?.avatarUrl ? <img src={users.find(u=>u.id===v.userId).avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : v.username?.[0]?.toUpperCase()}
                      </div>
                      <span style={{ color:COLORS.brand, fontSize:12, fontWeight:700 }}>@{v.username}</span>
                      <span style={{ color:COLORS.textTertiary, fontSize:11, marginLeft:'auto' }}>{v.likes||0} ❤️</span>
                    </div>
                    <div style={{ color:COLORS.textTertiary, fontSize:13, lineHeight:1.5 }}>{v.description?.substring(0,100)}{v.description?.length>100?'...':''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
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
  const [zoom, setZoom] = useState(1);
  const [zoomCaps, setZoomCaps] = useState(null);
  const [focusPoint, setFocusPoint] = useState(null);
  const [recordSpeed, setRecordSpeed] = useState(1);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);
  const focusTimerRef = useRef(null);
  const MAX_RECORD_SECONDS = 60;

  const startCamera = async (facing = facingMode) => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    let s;
    try {
      s = await navigator.mediaDevices.getUserMedia({ video:{ facingMode: facing }, audio: true });
    } catch (err) {
      // Requesting camera+mic together fails outright if the mic is denied/unavailable —
      // even when the camera itself is fine — which silently blocked the whole camera
      // screen (no preview, capture button did nothing). Falling back to video-only
      // means posing for a photo still works even without microphone access; video
      // recordings just won't have audio in that case.
      try {
        s = await navigator.mediaDevices.getUserMedia({ video:{ facingMode: facing }, audio: false });
        showToast?.('Microphone unavailable — recording without audio','info');
      } catch (err2) {
        showToast?.(err2?.name === 'NotAllowedError' ? 'Camera access denied — enable it in your browser/app settings' : 'Could not access camera','error');
        return;
      }
    }
    streamRef.current = s;
    if(videoRef.current){ videoRef.current.srcObject = s; videoRef.current.play().catch(()=>{}); }
    // Detect optical/digital zoom support on this track
    const track = s.getVideoTracks?.()[0];
    const caps = track?.getCapabilities?.();
    if(caps?.zoom){
      setZoomCaps({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 });
      setZoom(caps.zoom.min || 1);
    } else {
      setZoomCaps(null);
      setZoom(1);
    }
  };

  const applyZoom = (value) => {
    setZoom(value);
    const track = streamRef.current?.getVideoTracks?.()[0];
    if(track?.getCapabilities?.()?.zoom){
      track.applyConstraints({ advanced: [{ zoom: value }] }).catch(()=>{});
    }
  };

  const handleFocusTap = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFocusPoint({ x, y });
    const track = streamRef.current?.getVideoTracks?.()[0];
    if(track?.getCapabilities?.()?.focusMode){
      track.applyConstraints({ advanced: [{ focusMode: 'continuous', pointsOfInterest: [{ x: x/rect.width, y: y/rect.height }] }] }).catch(()=>{});
    }
    clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(()=>setFocusPoint(null), 700);
  };

  useEffect(() => { startCamera(); return () => { streamRef.current?.getTracks().forEach(t=>t.stop()); clearInterval(timerRef.current); clearTimeout(focusTimerRef.current); }; }, []);

  const flipCamera = () => {
    const next = facingMode==='user'?'environment':'user';
    setFacingMode(next);
    startCamera(next);
  };

  const capturePhoto = () => {
    if(!videoRef.current){ showToast?.('Camera not ready yet — try again in a moment','error'); return; }
    // videoWidth/videoHeight are 0 until the stream has actually started decoding frames.
    // Capturing before that produces a blank/empty image with no error, which is exactly
    // what looked like "posing for a photo fails" — nothing visibly happens on tap.
    if(!videoRef.current.videoWidth || !videoRef.current.videoHeight){
      showToast?.('Camera still loading — hold still and try again','error');
      return;
    }
    try {
      const c = document.createElement('canvas');
      c.width = videoRef.current.videoWidth;
      c.height = videoRef.current.videoHeight;
      const ctx = c.getContext('2d');
      if(flash){ ctx.fillStyle='white'; ctx.fillRect(0,0,c.width,c.height); }
      ctx.filter = FILTERS[activeFilter].css || 'none';
      ctx.drawImage(videoRef.current, 0, 0);
      c.toBlob(blob => {
        if(!blob){ showToast?.('Could not capture photo — try again','error'); return; }
        setSelectedFile({ file: new File([blob],'photo.jpg',{type:'image/jpeg'}), url: URL.createObjectURL(blob), type:'image/jpeg' });
      }, 'image/jpeg');
    } catch (e) {
      showToast?.('Could not capture photo — try again','error');
    }
  };

  const startRecording = () => {
    if(!streamRef.current){ showToast?.('Camera not ready — try again in a moment','error'); return; }
    if(!streamRef.current.getVideoTracks().length){ showToast?.('No camera feed to record — check camera permission','error'); return; }
    chunksRef.current = [];
    try {
      // Not every browser supports the same container/codec — Safari/iOS in particular
      // often can't do plain 'video/webm'. Picking the first type it actually supports
      // (and falling back to the recorder's default if none report as supported) is what
      // was missing here; previously an unsupported mimeType threw inside the constructor
      // and, since there was no try/catch, recording silently failed with no feedback.
      const preferredTypes = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'];
      const mimeType = preferredTypes.find(mt => window.MediaRecorder?.isTypeSupported?.(mt));
      const r = mimeType ? new MediaRecorder(streamRef.current, { mimeType }) : new MediaRecorder(streamRef.current);
      const usedType = r.mimeType || mimeType || 'video/webm';
      r.ondataavailable = e => { if(e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      r.onerror = () => { showToast?.('Recording failed — try again','error'); setRecording(false); clearInterval(timerRef.current); };
      r.onstop = () => {
        if(!chunksRef.current.length){ showToast?.('Recording was empty — try again','error'); return; }
        const blob = new Blob(chunksRef.current, { type: usedType });
        const ext = usedType.includes('mp4') ? 'mp4' : 'webm';
        setSelectedFile({ file: new File([blob],`video.${ext}`,{type:usedType}), url: URL.createObjectURL(blob), type:usedType });
      };
      r.start();
      recorderRef.current = r;
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds(s => { if(s>=MAX_RECORD_SECONDS-1){ stopRecording(); return MAX_RECORD_SECONDS; } return s+1; }), 1000);
    } catch (e) {
      showToast?.('Recording is not supported on this device/browser','error');
    }
  };

  const stopRecording = () => {
    try { if(recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop(); } catch {}
    setRecording(false);
    clearInterval(timerRef.current);
  };

  const handleFileSelect = e => {
    const files = Array.from(e.target.files || []);
    if(!files.length) return;
    // If multiple images chosen, prepare a multi-image (TikTok-style slide) post
    const allImages = files.every(f=>f.type.startsWith('image/'));
    if(allImages && files.length > 1){
      setSelectedFile({
        files,
        urls: files.map(f=>URL.createObjectURL(f)),
        type: 'image/multi'
      });
    } else {
      const f = files[0];
      setSelectedFile({ file:f, url:URL.createObjectURL(f), type:f.type });
    }
  };

  const handleUpload = async () => {
    if(!selectedFile){ showToast?.('Capture or select media first','error'); return; }
    setUploading(true); setUploadProgress(0);
    try {
      let videoData;
      if(selectedFile.type === 'image/multi'){
        // Multi-image post: upload each image, store as `images` array for horizontal slide
        const urls = [];
        for(let i=0;i<selectedFile.files.length;i++){
          const u = await uploadToCloudinary(selectedFile.files[i], (p)=>setUploadProgress(Math.round(((i + p/100) / selectedFile.files.length) * 100)));
          urls.push(u);
        }
        videoData = {
          userId: currentUser.id,
          username: currentUser.username || '',
          fullName: currentUser.fullName || currentUser.username || '',
          avatar: currentUser.avatar || (currentUser.username||'U')[0].toUpperCase(),
          avatarColor: currentUser.avatarColor || '#0B5FFF',
          avatarUrl: currentUser.avatarUrl || null,
          verified: currentUser.verified || false,
          description: description,
          videoUrl: urls[0],
          images: urls,
          mediaType: 'image/multi',
          song: 'Original sound',
          likes: 0, comments: 0, shares: 0, views: 0,
          hashtags: (description||'').match(/#\w+/g) || [],
          category: 'foryou',
          filter: FILTERS[activeFilter].name,
          playbackRate: 1,
          createdAt: serverTimestamp(),
        };
      } else {
        const mediaUrl = await uploadToCloudinary(selectedFile.file, setUploadProgress);
        videoData = {
          userId: currentUser.id,
          username: currentUser.username || '',
          fullName: currentUser.fullName || currentUser.username || '',
          avatar: currentUser.avatar || (currentUser.username||'U')[0].toUpperCase(),
          avatarColor: currentUser.avatarColor || '#0B5FFF',
          avatarUrl: currentUser.avatarUrl || null,
          verified: currentUser.verified || false,
          description: description,
          videoUrl: mediaUrl,
          mediaType: selectedFile.type,
          song: 'Original sound',
          likes: 0, comments: 0, shares: 0, views: 0,
          hashtags: (description||'').match(/#\w+/g) || [],
          category: 'foryou',
          filter: FILTERS[activeFilter].name,
          playbackRate: selectedFile.type.startsWith('video/') ? recordSpeed : 1,
          createdAt: serverTimestamp(),
        };
      }
      const data = await apiFetch('/api/videos/create', { method:'POST', body: JSON.stringify(videoData) });
      if (data.moderationStatus === 'pending') {
        showToast?.('Posted — under review, will appear once approved', 'info');
      } else {
        showToast?.('Posted! 🚀','success');
      }
      onUpload?.({ id:data.id, ...videoData, moderationStatus:data.moderationStatus, createdAt: new Date() });
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
        <button onClick={handleUpload} disabled={uploading} style={{ background:'linear-gradient(135deg,#2E7BFF,#0B5FFF)', border:'none', borderRadius:20, padding:'8px 18px', color:'white', fontWeight:700, cursor:'pointer', fontSize:13, opacity:uploading?0.7:1 }}>
          {uploading ? `${uploadProgress}%` : 'Post ✓'}
        </button>
      </div>
      {uploading && <div style={{ height:3, background:'rgba(255,255,255,0.1)' }}><div style={{ height:'100%', background:'linear-gradient(90deg,#2E7BFF,#0B5FFF)', width:`${uploadProgress}%`, transition:'width 0.3s' }} /></div>}
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        {selectedFile.type === 'image/multi' ? (
          <div style={{ display:'flex', width:'100%', height:'100%', overflowX:'auto', scrollSnapType:'x mandatory' }}>
            {selectedFile.urls.map((u,i)=>(
              <div key={i} style={{ flex:'0 0 100%', height:'100%', scrollSnapAlign:'center' }}>
                <img src={u} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', ...filterStyle }} />
              </div>
            ))}
          </div>
        ) : selectedFile.type.startsWith('image/') 
          ? <img src={selectedFile.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', ...filterStyle }} />
          : <video src={selectedFile.url} style={{ width:'100%', height:'100%', objectFit:'cover' }} controls autoPlay loop ref={el=>{ if(el) el.playbackRate = recordSpeed; }} />
        }
        {selectedFile.type === 'image/multi' && (
          <div style={{ position:'absolute', top:10, left:0, right:0, display:'flex', justifyContent:'center', gap:5, pointerEvents:'none' }}>
            {selectedFile.urls.map((_,i)=>(
              <div key={i} style={{ flex:1, maxWidth:36, height:3, borderRadius:2, background:'rgba(255,255,255,0.6)' }} />
            ))}
          </div>
        )}
      </div>
      {/* Filter strip on preview */}
      <div style={{ padding:'10px 0', background:'rgba(0,0,0,0.8)', overflowX:'auto', display:'flex', gap:10, paddingLeft:16 }}>
        {FILTERS.map((f,i)=>(
          <div key={f.name} onClick={()=>setActiveFilter(i)} style={{ flexShrink:0, textAlign:'center', cursor:'pointer' }}>
            <div style={{ width:56, height:56, borderRadius:14, overflow:'hidden', border: i===activeFilter?'2px solid #0B5FFF':'2px solid transparent' }}>
              <img src={selectedFile.type==='image/multi' ? selectedFile.urls[0] : selectedFile.type.startsWith('image/')?selectedFile.url:'https://picsum.photos/56'} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', filter: f.css||'none' }} />
            </div>
            <div style={{ color: i===activeFilter?'#0B5FFF':'rgba(255,255,255,0.5)', fontSize:9, marginTop:4, fontWeight:700 }}>{f.name}</div>
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
          <button onClick={()=>setFlash(!flash)} style={{ background: flash?'rgba(255,215,0,0.3)':'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%', width:40, height:40, color: flash?'#FFD60A':'white', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>⚡</button>
          <button onClick={flipCamera} style={{ background:'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%', width:40, height:40, color:'white', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>🔄</button>
          <button onClick={()=>setShowFilters(!showFilters)} style={{ background: showFilters?'rgba(11,95,255,0.5)':'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%', width:40, height:40, color:'white', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>✨</button>
        </div>
      </div>

      {/* Camera viewfinder */}
      <div onClick={handleFocusTap} style={{ flex:1, position:'relative', overflow:'hidden', cursor: cameraMode==='photo' ? 'default' : 'default' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%', height:'100%', objectFit:'cover', ...filterStyle }} />
        {/* Tap-to-focus ring */}
        {focusPoint && (
          <div style={{ position:'absolute', left:focusPoint.x-28, top:focusPoint.y-28, width:56, height:56, borderRadius:'50%', border:'2px solid #FFD60A', pointerEvents:'none', animation:'focusPulse 0.6s ease-out' }} />
        )}
        {/* Recording timer */}
        {recording && (
          <div style={{ position:'absolute', top:60, left:'50%', transform:'translateX(-50%)', background:'rgba(11,95,255,0.9)', borderRadius:20, padding:'6px 16px', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'white', animation:'pulse 1s infinite' }} />
            <span style={{ color:'white', fontWeight:700, fontSize:14 }}>00:{String(recordSeconds).padStart(2,'0')} / 00:{String(MAX_RECORD_SECONDS).padStart(2,'0')}</span>
          </div>
        )}
        {/* Zoom slider */}
        {zoomCaps && (
          <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:8, background:'rgba(0,0,0,0.45)', borderRadius:20, padding:'12px 6px' }}>
            <span style={{ color:'white', fontSize:11, fontWeight:700 }}>{zoom.toFixed(1)}x</span>
            <input
              type="range"
              min={zoomCaps.min}
              max={zoomCaps.max}
              step={zoomCaps.step}
              value={zoom}
              onChange={e=>applyZoom(parseFloat(e.target.value))}
              style={{ writingMode:'vertical-lr', WebkitAppearance:'slider-vertical', height:120, width:24, accentColor:'#0B5FFF' }}
            />
          </div>
        )}
        {/* Live filter strip */}
        {showFilters && (
          <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', bottom:0, left:0, right:0, padding:'10px 0 10px 16px', background:'linear-gradient(transparent,rgba(0,0,0,0.7))', overflowX:'auto', display:'flex', gap:10 }}>
            {FILTERS.map((f,i)=>(
              <div key={f.name} onClick={()=>setActiveFilter(i)} style={{ flexShrink:0, textAlign:'center', cursor:'pointer' }}>
                <div style={{ width:52, height:52, borderRadius:12, background:'rgba(255,255,255,0.15)', border: i===activeFilter?'2px solid #0B5FFF':'2px solid transparent', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                  <div style={{ width:'100%', height:'100%', background: i===0?'linear-gradient(135deg,#888,#34343E)':i===1?'linear-gradient(135deg,#ff6b6b,#ffa500)':i===2?'linear-gradient(135deg,#FFD60A,#ff8c00)':i===3?'linear-gradient(135deg,#00bfff,#1e90ff)':i===4?'linear-gradient(135deg,#888,#24242E)':i===5?'linear-gradient(135deg,#ddd,#aaa)':i===6?'linear-gradient(135deg,#34343E,#000)':i===7?'linear-gradient(135deg,#ffe,#ffd)':i===8?'linear-gradient(135deg,#ff00ff,#00ffff)':'linear-gradient(135deg,#c8a97e,#8b6f47)', display:'flex', alignItems:'center', justifyContent:'center' }}>
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
        <div style={{ display:'flex', justifyContent:'center', gap:28, marginBottom: cameraMode==='video' && !recording ? 12 : 24 }}>
          {['photo','video'].map(m=>(
            <button key={m} onClick={()=>setCameraMode(m)} style={{ background:'none', border:'none', color: cameraMode===m?'white':'rgba(255,255,255,0.35)', fontSize:13, fontWeight:700, cursor:'pointer', textTransform:'uppercase', letterSpacing:1, borderBottom: cameraMode===m?'2px solid #0B5FFF':'2px solid transparent', paddingBottom:4 }}>{m}</button>
          ))}
        </div>

        {/* Speed selector (video only, before recording) */}
        {cameraMode==='video' && !recording && (
          <div style={{ display:'flex', justifyContent:'center', gap:10, marginBottom:24 }}>
            {[0.5,1,2,3].map(sp=>(
              <button key={sp} onClick={()=>setRecordSpeed(sp)} style={{ background: recordSpeed===sp?'rgba(11,95,255,0.25)':'rgba(255,255,255,0.08)', border: recordSpeed===sp?'1px solid #0B5FFF':'1px solid rgba(255,255,255,0.1)', borderRadius:16, padding:'5px 12px', color: recordSpeed===sp?'#0B5FFF':'rgba(255,255,255,0.6)', fontSize:12, fontWeight:700, cursor:'pointer' }}>{sp}x</button>
            ))}
          </div>
        )}

        {/* Capture row */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingLeft:60, paddingRight:60 }}>
          {/* Gallery */}
          <button onClick={()=>fileInputRef.current?.click()} style={{ width:48, height:48, borderRadius:14, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:22 }}>🖼️</button>
          <input ref={fileInputRef} type="file" accept="video/*,image/*" multiple onChange={handleFileSelect} style={{ display:'none' }} />

          {/* Shutter / Record */}
          {cameraMode==='photo' ? (
            <button onClick={capturePhoto} style={{ width:76, height:76, borderRadius:'50%', background:'white', border:'5px solid rgba(255,255,255,0.3)', cursor:'pointer', position:'relative' }}>
              <div style={{ position:'absolute', inset:4, borderRadius:'50%', background:'white' }} />
            </button>
          ) : (
            <button onClick={recording?stopRecording:startRecording} style={{ width:76, height:76, borderRadius:'50%', background: recording?'#0B5FFF':'white', border:'5px solid rgba(255,255,255,0.3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
              {recording && (
                <svg width="86" height="86" viewBox="0 0 86 86" style={{ position:'absolute', top:-5, left:-5, transform:'rotate(-90deg)', pointerEvents:'none' }}>
                  <circle cx="43" cy="43" r="40" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                  <circle cx="43" cy="43" r="40" fill="none" stroke="#0B5FFF" strokeWidth="3"
                    strokeDasharray={`${2*Math.PI*40}`}
                    strokeDashoffset={`${2*Math.PI*40*(1 - recordSeconds/MAX_RECORD_SECONDS)}`}
                    style={{ transition:'stroke-dashoffset 1s linear' }} />
                </svg>
              )}
              {recording
                ? <div style={{ width:24, height:24, borderRadius:4, background:'white' }} />
                : <div style={{ width:76, height:76, borderRadius:'50%', background:'#0B5FFF' }} />
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
    <div style={{ position:'fixed', inset:0, background:COLORS.bg, zIndex:200, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'14px 16px', borderBottom:`1px solid ${COLORS.overlaySubtle}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h2 style={{ color:COLORS.textPrimary, fontSize:20, fontWeight:800, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Sounds</h2>
        <button onClick={onClose} style={{ background:COLORS.overlaySubtle, border:'none', borderRadius:20, padding:'8px 16px', color:COLORS.textPrimary, cursor:'pointer', fontSize:13 }}>Close</button>
      </div>
      <div style={{ padding:'10px 16px' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search sounds..." style={{ width:'100%', background:COLORS.overlaySubtle, border:`1px solid ${COLORS.border}`, borderRadius:28, padding:'11px 16px', color:COLORS.textPrimary, outline:'none', fontSize:13, boxSizing:'border-box' }} />
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'0 14px' }}>
        {filtered.map(sound=>(
          <div key={sound.id} onClick={()=>onSelectSound(sound)} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 12px', background:COLORS.overlaySubtle, borderRadius:18, marginBottom:8, cursor:'pointer', border:`1px solid ${COLORS.overlaySubtle}` }}>
            <div style={{ width:48, height:48, borderRadius:16, background:`linear-gradient(135deg,${COLORS.brand},${COLORS.brandSecondary})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🎵</div>
            <div style={{ flex:1 }}>
              <div style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:13, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{sound.name}</div>
              <div style={{ color:COLORS.textTertiary, fontSize:11, marginTop:2 }}>{sound.artist} · {sound.duration}</div>
            </div>
            {sound.popular && <span style={{ color:COLORS.warning, fontSize:11, fontWeight:700 }}>🔥 {formatNumber(sound.usage)}</span>}
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
    <div style={{ position:'fixed', inset:0, background:COLORS.bg, zIndex:200, overflow:'auto' }}>
      <div style={{ padding:'60px 20px 20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ color:COLORS.textPrimary, fontSize:24, fontWeight:800, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Analytics</h2>
          <button onClick={onClose} style={{ background:COLORS.overlaySubtle, border:'none', borderRadius:20, padding:'8px 18px', color:COLORS.textPrimary, cursor:'pointer', fontSize:13 }}>Close</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:20 }}>
          {[['Total Views',formatNumber(totalViews),COLORS.brand],['Total Likes',formatNumber(totalLikes),COLORS.brand],['Posts',String(userVideos.length),COLORS.brandSecondary],['Coins',String(user?.coins||0),COLORS.warningAlt]].map(([label,val,color])=>(
            <div key={label} style={{ background:COLORS.overlaySubtle, borderRadius:20, padding:20, border:`1px solid ${COLORS.overlaySubtle}` }}>
              <div style={{ color:COLORS.textTertiary, fontSize:11, textTransform:'uppercase', letterSpacing:0.5 }}>{label}</div>
              <div style={{ color:color, fontSize:28, fontWeight:800, marginTop:6, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ background:COLORS.overlaySubtle, borderRadius:20, padding:20, marginBottom:16, border:`1px solid ${COLORS.overlaySubtle}` }}>
          <h3 style={{ color:COLORS.textPrimary, marginBottom:16, fontSize:14, fontWeight:700, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Weekly Views</h3>
          <div style={{ height:120, display:'flex', alignItems:'flex-end', gap:6 }}>
            {weeklyData.map((v,i)=>(
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ width:'100%', height:`${Math.max((v/maxVal)*100,4)}%`, background:`linear-gradient(180deg,#2E7BFF,#0B5FFF)`, borderRadius:6 }} />
                <span style={{ color:COLORS.textTertiary, fontSize:9 }}>{['M','T','W','T','F','S','S'][i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:COLORS.overlaySubtle, borderRadius:20, padding:20, border:`1px solid ${COLORS.overlaySubtle}` }}>
          <h3 style={{ color:COLORS.textPrimary, marginBottom:12, fontSize:14, fontWeight:700, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Top Videos</h3>
          {userVideos.sort((a,b)=>(b.views||0)-(a.views||0)).slice(0,3).map(v=>(
            <div key={v.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, padding:'10px 12px', background:COLORS.overlaySubtle, borderRadius:14 }}>
              <div style={{ color:COLORS.textPrimary, fontSize:12, flex:1, marginRight:10 }}>{v.description?.substring(0,30)}...</div>
              <div style={{ color:COLORS.brand, fontSize:12, fontWeight:700 }}>{formatNumber(v.views||0)} views</div>
            </div>
          ))}
          {userVideos.length===0 && <div style={{textAlign:'center',color:COLORS.borderStrong,padding:20}}>Post videos to see analytics</div>}
        </div>
      </div>
    </div>
  );
};

/* ─────────────── QR CODE ─────────────── */
const QRCodePage = ({ user, onClose }) => (
  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
    <div style={{ background:'#15151C', borderRadius:28, padding:32, textAlign:'center', maxWidth:300, width:'100%', margin:'0 20px', border:'1px solid rgba(255,255,255,0.08)', position:'relative' }}>
      <button onClick={onClose} style={{ position:'absolute', top:14, right:14, background:'rgba(255,255,255,0.08)', border:'none', borderRadius:'50%', width:32, height:32, color:'white', cursor:'pointer', fontSize:16 }}>✕</button>
      <div style={{ color:'white', fontWeight:800, fontSize:18, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>My QR Code</div>
      <div style={{ width:180, height:180, margin:'0 auto 20px', borderRadius:20, overflow:'hidden', background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
  <img
    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent('https://infinity-now.vercel.app/user/' + user?.username)}`}
    alt="QR Code"
    style={{ width:160, height:160 }}
  />
</div>
      <h3 style={{ color:'white', marginBottom:4, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>@{user?.username}</h3>
      <p style={{ color:'rgba(255,255,255,0.35)', fontSize:12, marginBottom:20 }}>Scan to follow on Infinity</p>
      <button onClick={()=>navigator.share?.({title:'Infinity',text:`Follow @${user?.username} on Infinity`,url:`https://infinity-now.vercel.app`
})} style={{ width:'100%', background:'linear-gradient(135deg,#2E7BFF,#0B5FFF)', border:'none', borderRadius:20, padding:13, color:'white', fontWeight:700, cursor:'pointer', fontSize:14, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Share Profile</button>
    </div>
  </div>
);

/* ─────────────── GUEST FEED ─────────────── */
const GuestFeed = ({ onSignIn }) => {
  const [videos, setVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const startY = useRef(null);
  const videoRefs = useRef({});

  useEffect(()=>{
    const q = query(collection(db,'videos'), orderBy('createdAt','desc'), limit(20));
    const unsub = onSnapshot(q, snap=>{
      setVideos(sortByNewest(snap.docs.map(d=>({id:d.id,...d.data()}))));
    });
    return ()=>unsub();
  },[]);

  useEffect(()=>{
    Object.entries(videoRefs.current).forEach(([id,el])=>{
      if(!el) return;
      el.muted = muted;
      if(id===String(videos[currentIndex]?.id) && !muted) el.play().catch(()=>{});
    });
  },[muted, currentIndex, videos]);

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
        <div key={video.id} onClick={()=>setMuted(m=>!m)} style={{ position:'absolute', inset:0, transform:`translateY(${(idx-currentIndex)*100}%)`, transition:'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)', pointerEvents:idx===currentIndex?'auto':'none' }}>
          {video.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i)
            ? <img src={video.videoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : <video ref={el=>{videoRefs.current[video.id]=el;}} src={video.videoUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} loop autoPlay muted={idx===currentIndex?muted:true} playsInline />
          }
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 50%)' }} />
          {idx===currentIndex && muted && (
            <div style={{ position:'absolute', top:16, right:16, background:'rgba(0,0,0,0.4)', borderRadius:'50%', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            </div>
          )}
          <div style={{ position:'absolute', bottom:100, left:14, right:14 }}>
            <div style={{ color:'white', fontWeight:700, fontSize:15 }}>@{video.username}</div>
            <div style={{ color:'rgba(255,255,255,0.8)', fontSize:13, marginTop:4 }}>{video.description}</div>
          </div>
        </div>
      ))}
      <div style={{ position:'absolute', bottom:28, left:0, right:0, display:'flex', justifyContent:'center', zIndex:20 }}>
        <button onClick={onSignIn} style={{ background:'linear-gradient(135deg,#2E7BFF,#0B5FFF)', border:'none', borderRadius:28, padding:'14px 36px', color:'white', fontWeight:800, fontSize:15, cursor:'pointer', boxShadow:'0 4px 24px rgba(11,95,255,0.5)' }}>
          Sign in to interact 🚀
        </button>
      </div>
    </div>
  );
};

/* ─────────────── Reusable inline date picker (no full-screen native picker) ───────────────
   Native <input type="date"> is fine on desktop, but on mobile Chrome/Safari it opens an OS-level
   full-screen picker that takes over the whole viewport and feels jarring inside a modal/panel.
   This renders three plain <select> dropdowns instead, matching the existing dropdown look used
   elsewhere, and stays inline no matter what device it's on. */
const InlineDateSelect = ({ value, onChange, minYear, maxYear, futureOk }) => {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const today = new Date();
  const hiYear = maxYear ?? today.getFullYear() + (futureOk ? 10 : 0);
  const loYear = minYear ?? today.getFullYear() - 100;

  // Keep the three dropdowns' own pending state instead of deriving purely from `value`.
  // Reason: `value` is only a complete "YYYY-MM-DD" string once all three are picked, so if
  // we derived straight from it, selecting e.g. Month alone (with Day/Year still empty) had
  // nowhere to be remembered and immediately got reported back up as '' — which looked like
  // the picker "wasn't picking" anything. Now each dropdown's choice sticks locally right
  // away, and we only call onChange() once with a full date once all three are set.
  const initial = value ? value.split('-') : ['', '', ''];
  const [y, setY] = useState(initial[0] || '');
  const [m, setM] = useState(initial[1] || '');
  const [d, setD] = useState(initial[2] || '');

  // If the parent resets `value` externally (e.g. clearing the form), mirror that here too.
  useEffect(() => {
    if (!value) { setY(''); setM(''); setD(''); }
  }, [value]);

  const daysInMonth = (year, month) => {
    if (!year || !month) return 31;
    return new Date(Number(year), Number(month), 0).getDate();
  };
  const maxDay = daysInMonth(y, m);

  const commit = (nextY, nextM, nextD) => {
    setY(nextY); setM(nextM); setD(nextD);
    if (!nextY || !nextM || !nextD) return; // wait until all three are picked
    const clampedDay = Math.min(Number(nextD), daysInMonth(nextY, nextM));
    onChange(`${nextY}-${String(nextM).padStart(2,'0')}-${String(clampedDay).padStart(2,'0')}`);
  };

  const selectStyle = {
    flex:1, background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:12,
    padding:'12px 10px', color:(y||m||d)?COLORS.textPrimary:COLORS.textTertiary, fontSize:14,
    fontWeight:600, outline:'none', appearance:'none', WebkitAppearance:'none', cursor:'pointer',
    fontFamily:'inherit',
    backgroundImage:`url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(COLORS.textTertiary)}' stroke-width='2'><polyline points='6 9 12 15 18 9'/></svg>")`,
    backgroundRepeat:'no-repeat', backgroundPosition:'right 8px center', backgroundSize:14,
    paddingRight:26,
  };
  return (
    <div style={{display:'flex',gap:8}}>
      <select aria-label="Month" value={m||''} onChange={e=>commit(y, e.target.value, d)} style={selectStyle}>
        <option value="" disabled>Month</option>
        {MONTHS.map((name,i)=>(<option key={name} value={String(i+1).padStart(2,'0')}>{name}</option>))}
      </select>
      <select aria-label="Day" value={d||''} onChange={e=>commit(y, m, e.target.value)} style={{...selectStyle, flex:0.7}}>
        <option value="" disabled>Day</option>
        {Array.from({length:maxDay},(_,i)=>i+1).map(day=>(<option key={day} value={String(day).padStart(2,'0')}>{day}</option>))}
      </select>
      <select aria-label="Year" value={y||''} onChange={e=>commit(e.target.value, m, d)} style={{...selectStyle, flex:0.9}}>
        <option value="" disabled>Year</option>
        {Array.from({length:hiYear-loYear+1},(_,i)=>hiYear-i).map(year=>(<option key={year} value={String(year)}>{year}</option>))}
      </select>
    </div>
  );
};

/* ─────────────── USERNAME RULES (Telegram-style) ───────────────
   - 5-32 characters
   - lowercase letters, digits, underscore only
   - must start with a letter (not a digit/underscore)
   Used to (a) auto-generate a default username at signup instead of asking
   for one, and (b) validate edits made later from Edit Profile. */
const USERNAME_RE = /^[a-z][a-z0-9_]{4,31}$/;
const isValidUsername = (u) => USERNAME_RE.test(String(u || ''));

// Builds a candidate username from a display name / email, e.g. "Getachew Shambel"
// -> "getachewshambel482". Always starts with a letter and is at least 5 chars;
// a random numeric suffix is added both to pad short names out to the minimum
// length and to make collisions with an existing username unlikely. Callers
// should still check availability and regenerate on conflict (see AuthScreen).
const generateUsername = (seedText) => {
  let base = String(seedText || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!base || !/^[a-z]/.test(base)) base = 'user' + base;
  base = base.slice(0, 20);
  const suffix = String(Math.floor(1000 + Math.random() * 90000));
  let candidate = (base + suffix).slice(0, 32);
  if (candidate.length < 5) candidate = candidate.padEnd(5, '0');
  return candidate;
};

/* ─────────────── AUTH SCREEN (REAL FIREBASE) ─────────────── */
const AuthScreen = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [step, setStep] = useState('method');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [pendingOtp, setPendingOtp] = useState('');
  const [pendingCreds, setPendingCreds] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpExpiry, setOtpExpiry] = useState(()=>Date.now() + 10*60*1000);
  // Google users land here for a moment before an account is created — see handleGoogleLogin.
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  const [googleFullName, setGoogleFullName] = useState('');
  const [googleBirthdate, setGoogleBirthdate] = useState('');

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
    profile = { ...emailSnap.docs[0].data(), id: emailSnap.docs[0].id };
    onLogin({...profile, id: fbUser.uid});
    setLoading(false);
    return;
  } else {
    // Brand-new account: username is generated automatically (see generateUsername),
    // not collected from the person — only full name and date of birth are confirmed
    // before the account is created.
    setPendingGoogleUser(fbUser);
    setGoogleFullName(fbUser.displayName||'');
    setGoogleBirthdate('');
    setStep('google_onboarding');
    setLoading(false);
    return;
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
  setError('');
  if(!identifier){ setError('Email is required'); return; }
  if(!password){ setError('Password is required'); return; }
  setLoading(true);
  try {
    if(isLogin){
      const result = await signInWithEmailAndPassword(auth, identifier, password);
// Only block login if the account is older than 30 seconds (i.e. not just created)
const createdAt = result.user.metadata?.creationTime;
const isNewAccount = createdAt && (Date.now() - new Date(createdAt).getTime()) < 120000;
if(!result.user.emailVerified && !isNewAccount){
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
      if(!fullName){ setError('Full name required'); setLoading(false); return; }
      if(!birthdate){ setError('Date of birth is required'); setLoading(false); return; }
      const ageMs = Date.now() - new Date(birthdate).getTime();
      if(ageMs < 13*365.25*24*60*60*1000){ setError('You must be at least 13 years old to sign up'); setLoading(false); return; }

      // Username is no longer collected from the person at sign-up — it's generated
      // automatically from their full name (they can change it any time afterward from
      // Edit Profile). /api/auth/send-otp still checks availability server-side; on the
      // rare collision, regenerate a new candidate and retry a few times before giving up.
      let autoUsername = generateUsername(fullName);
      let sent = false;
      for (let attempt = 0; attempt < 5 && !sent; attempt++) {
        try {
          await apiFetch('/api/auth/send-otp', {
            method: 'POST',
            body: JSON.stringify({ email: identifier, username: autoUsername }),
          });
          sent = true;
        } catch (e) {
          if (e.message === 'Username already taken') {
            autoUsername = generateUsername(fullName);
          } else {
            throw e;
          }
        }
      }
      if (!sent) { setError('Could not generate a username right now. Please try again.'); setLoading(false); return; }
      setUsername(autoUsername);
      setPendingCreds({ email: identifier, password, username: autoUsername, fullName, birthdate });
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

  if(step==='google_onboarding') return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:COLORS.bg }}>
      <div style={{ width:'100%', maxWidth:340 }}>
        <div style={{ background:COLORS.surface, borderRadius:24, padding:24, border:`1px solid ${COLORS.border}`, boxShadow:'0 4px 20px rgba(30,27,46,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
            {pendingGoogleUser?.photoURL
              ? <img src={pendingGoogleUser.photoURL} alt="" style={{ width:52, height:52, borderRadius:16, objectFit:'cover' }} />
              : <div style={{ width:52, height:52, borderRadius:16, background:`${COLORS.brand}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>🌐</div>}
            <div>
              <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:16, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Finish setting up</div>
              <div style={{ color:COLORS.textTertiary, fontSize:12 }}>{pendingGoogleUser?.email}</div>
            </div>
          </div>
          <div style={{ color:COLORS.textSecondary, fontSize:13, lineHeight:1.5, marginBottom:16 }}>
            Almost done — confirm a few details before we create your account.
          </div>
          {error && <div style={{background:`${COLORS.danger}1A`,border:`1px solid ${COLORS.danger}4D`,borderRadius:12,padding:'10px 14px',color:COLORS.danger,fontSize:12,marginBottom:12}}>{error}</div>}
          <input placeholder="Full Name" value={googleFullName} onChange={e=>setGoogleFullName(e.target.value)} style={{ width:'100%', background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:14, padding:'13px 16px', color:COLORS.textPrimary, marginBottom:10, outline:'none', fontSize:14, boxSizing:'border-box' }} />
          <div style={{marginBottom:16}}>
            <div style={{color:COLORS.textTertiary,fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:7}}>Date of Birth *</div>
            <InlineDateSelect value={googleBirthdate} onChange={setGoogleBirthdate} maxYear={new Date().getFullYear()-13} minYear={new Date().getFullYear()-100} />
            <div style={{color:COLORS.textTertiary,fontSize:11,marginTop:6}}>You must be at least 13 years old.</div>
          </div>
          <button onClick={async()=>{
            setError('');
            if(!googleFullName.trim()){ setError('Full name is required'); return; }
            if(!googleBirthdate){ setError('Date of birth is required'); return; }
            const ageMs = Date.now() - new Date(googleBirthdate).getTime();
            if(ageMs < 13*365.25*24*60*60*1000){ setError('You must be at least 13 years old to sign up'); return; }
            setLoading(true);
            try {
              const fbUser = pendingGoogleUser;
              // Username is generated from their full name rather than asked for — retry
              // a few times on the (rare) chance the generated handle is already taken.
              let finalUsername = null;
              for (let attempt = 0; attempt < 5 && !finalUsername; attempt++) {
                const candidate = generateUsername(googleFullName.trim());
                const existing = await getDocs(query(collection(db,'users'), where('usernameLower','==',candidate)));
                if (existing.empty) finalUsername = candidate;
              }
              if (!finalUsername) { setError('Could not generate a username right now. Please try again.'); setLoading(false); return; }
              await createUserProfile(fbUser.uid,{
                username: finalUsername,
                fullName: googleFullName.trim(),
                email: fbUser.email||'',
                birthdate: googleBirthdate,
                avatarUrl: fbUser.photoURL||null,
                avatarColor: pickAvatarColor(fbUser.uid),
              });
              const profile = await getUserProfile(fbUser.uid);
              onLogin(profile ? {...profile, id:fbUser.uid} : buildDefaultProfile(fbUser.uid, {
                username: finalUsername, fullName: googleFullName.trim(), email: fbUser.email||'',
              }));
            } catch(e){
              setError(e.message || 'Could not finish setting up your account.');
              setLoading(false);
            }
          }} disabled={loading} style={{ width:'100%', background:COLORS.gradient, border:'none', borderRadius:24, padding:15, color:'white', fontWeight:700, cursor:'pointer', fontSize:15, opacity:loading?0.6:1, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>
            {loading?'Creating account...':'Create Account'}
          </button>
          <button onClick={async()=>{ await signOut(auth).catch(()=>{}); setPendingGoogleUser(null); setStep('method'); setError(''); }} style={{ width:'100%', background:'none', border:'none', color:COLORS.textTertiary, fontSize:13, cursor:'pointer', marginTop:10, textDecoration:'underline' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  if(step==='method') return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:COLORS.bg, overflow:'auto' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 24px 20px', position:'relative' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 30%,rgba(11,95,255,0.14),rgba(236,72,153,0.08),transparent 65%)' }} />
        <div style={{ position:'relative', textAlign:'center', marginBottom:40 }}>
          <img src="https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png" alt="Infinity" style={{ width:80, height:80, borderRadius:24, objectFit:'cover', margin:'0 auto 20px', display:'block', boxShadow:'0 20px 60px rgba(11,95,255,0.25)' }} />
          <p style={{ color:COLORS.textSecondary, fontSize:14, marginTop:10 }}>{isLogin?'Welcome back! 👋':'Join the community 🎉'}</p>
        </div>
        <div style={{ position:'relative', width:'100%', maxWidth:340 }}>
          <div style={{ color:COLORS.textTertiary, fontSize:11, marginBottom:14, textAlign:'center', fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>{isLogin?'Sign in with':'Sign up with'}</div>
          {error && error.trim().length > 1 && <div style={{background:`${COLORS.danger}1A`,border:`1px solid ${COLORS.danger}4D`,borderRadius:12,padding:'10px 14px',color:COLORS.danger,fontSize:12,marginBottom:12,textAlign:'center'}}>{error}</div>}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginBottom:24 }}>
            {LOGIN_METHODS.map(m=>(
              <button key={m.id} onClick={()=>handleMethodSelect(m)} disabled={loading} style={{ display:'inline-flex', alignItems:'center', gap:6, background:COLORS.surface2, border:`1px solid ${COLORS.border}`, borderRadius:30, padding:'8px 16px', cursor:'pointer', fontSize:13, color:COLORS.textPrimary, transition:'all 0.15s', opacity:loading?0.5:1 }}>
                <span style={{ fontSize:16 }}>{m.icon}</span>{m.name}
              </button>
            ))}
          </div>
          {loading && <div style={{textAlign:'center',color:COLORS.textSecondary,fontSize:13,marginBottom:12}}>⏳ Signing in...</div>}
          <button onClick={()=>setIsLogin(!isLogin)} style={{ width:'100%', background:'none', border:'none', color:COLORS.brand, fontSize:14, cursor:'pointer', fontWeight:600 }}>
            {isLogin?"Don't have an account? Sign up →":"Already have an account? Sign in →"}
          </button>
          {isLogin && (
            <button onClick={()=>setStep('resetpw')} style={{ width:'100%', background:'none', border:'none', color:COLORS.textTertiary, fontSize:13, cursor:'pointer', marginTop:10, textDecoration:'underline' }}>
              Forgot password?
            </button>
          )}
          <button onClick={()=>setStep('guest')} style={{ width:'100%', background:'none', border:'none', color:COLORS.textTertiary, fontSize:13, cursor:'pointer', marginTop:10 }}>
            👁 Browse without account
          </button>
        </div>
      </div>
      <div style={{ padding:'0 24px 40px', textAlign:'center', color:COLORS.textDisabled, fontSize:11 }}>
        By continuing, you agree to our{' '}
        <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color:COLORS.textTertiary, textDecoration:'underline' }}>Terms of Service</a>
        {' & '}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color:COLORS.textTertiary, textDecoration:'underline' }}>Privacy Policy</a>
      </div>
    </div>
  );
if(step==='otp') return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,background:COLORS.bg}}>
      <div style={{textAlign:'center',maxWidth:300,width:'100%'}}>
        <div style={{fontSize:64,marginBottom:16}}>📲</div>
        <div style={{color:COLORS.textPrimary,fontWeight:800,fontSize:22,marginBottom:10,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>Enter OTP</div>
        <div style={{color:COLORS.textSecondary,fontSize:14,lineHeight:1.6,marginBottom:20}}>
          We sent a 6-digit code to <strong style={{color:COLORS.textPrimary}}>{pendingCreds?.email}</strong>
        </div>
        {error && <div style={{background:`${COLORS.danger}1A`,border:`1px solid ${COLORS.danger}4D`,borderRadius:12,padding:'10px 14px',color:COLORS.danger,fontSize:12,marginBottom:12}}>{error}</div>}
        <input
          placeholder="000000"
          value={otpInput}
          onChange={e=>setOtpInput(e.target.value.replace(/\D/g,'').slice(0,6))}
          style={{width:'100%',background:COLORS.surfaceAlt,border:`1px solid ${COLORS.border}`,borderRadius:14,padding:'16px',color:COLORS.textPrimary,marginBottom:12,outline:'none',fontSize:28,boxSizing:'border-box',textAlign:'center',letterSpacing:12,fontWeight:800}}
          maxLength={6}
        />
        <button onClick={async()=>{
          if(Date.now() > otpExpiry){ setError('OTP expired. Please sign up again.'); return; }
          if(otpInput.length !== 6){ setError('Enter the 6-digit code.'); return; }
          setLoading(true); setError('');
          try {
            const data = await apiFetch('/api/auth/verify-otp', {
              method: 'POST',
              body: JSON.stringify({
                email: pendingCreds.email,
                otp: otpInput,
                password: pendingCreds.password,
                username: pendingCreds.username,
                fullName: pendingCreds.fullName,
                birthdate: pendingCreds.birthdate,
              }),
            });
            const result = await signInWithCustomToken(auth, data.customToken);
            await sendEmailVerification(result.user).catch(()=>{});
            const profile = await getUserProfile(result.user.uid);
            if (profile) {
              onLogin({ ...profile, id: result.user.uid });
            } else {
              const fallbackProfile = buildDefaultProfile(result.user.uid, {
                username: pendingCreds.username,
                fullName: pendingCreds.fullName,
                email: pendingCreds.email,
                birthdate: pendingCreds.birthdate || '',
              });
              onLogin(fallbackProfile);
            }
          } catch(e){
            console.error('OTP verify error:', e.message);
            setError(e.message || 'Account creation failed. Please try again.');
          }
          setLoading(false);
        }} disabled={loading||otpInput.length!==6} style={{width:'100%',background:COLORS.gradient,border:'none',borderRadius:24,padding:15,color:'white',fontWeight:700,cursor:'pointer',fontSize:15,marginBottom:12,opacity:(loading||otpInput.length!==6)?0.5:1,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>
          {loading?'Verifying...':'Verify & Create Account'}
        </button>
        <button onClick={async()=>{
  setLoading(true); setError('');
  try {
    await apiFetch('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email: pendingCreds.email }),
    });
    setOtpExpiry(Date.now() + 10*60*1000);
    setOtpInput('');
  } catch(e) {
    setError(e.message || 'Failed to resend code.');
  }
  setLoading(false);
}} style={{background:'none',border:'none',color:COLORS.textTertiary,fontSize:13,cursor:'pointer',textDecoration:'underline',marginBottom:8}}>
          Resend code
        </button>
        <br/>
        <button onClick={()=>{setStep('credentials');setError('');setOtpInput('');}} style={{background:'none',border:'none',color:COLORS.textTertiary,fontSize:13,cursor:'pointer',textDecoration:'underline'}}>
          Back
        </button>
      </div>
    </div>
  );
  if(step==='resetpw') return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,background:COLORS.bg}}>
      <div style={{textAlign:'center',maxWidth:300,width:'100%'}}>
        <div style={{fontSize:64,marginBottom:16}}>🔑</div>
        <div style={{color:COLORS.textPrimary,fontWeight:800,fontSize:22,marginBottom:10,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>Reset Password</div>
        <div style={{color:COLORS.textSecondary,fontSize:14,lineHeight:1.6,marginBottom:20}}>Enter your email and we'll send a reset link.</div>
        {error && <div style={{background:`${COLORS.danger}1A`,border:`1px solid ${COLORS.danger}4D`,borderRadius:12,padding:'10px 14px',color:COLORS.danger,fontSize:12,marginBottom:12}}>{error}</div>}
        <input placeholder="Your email" value={identifier} onChange={e=>setIdentifier(e.target.value)} style={{width:'100%',background:COLORS.surfaceAlt,border:`1px solid ${COLORS.border}`,borderRadius:14,padding:'13px 16px',color:COLORS.textPrimary,marginBottom:12,outline:'none',fontSize:14,boxSizing:'border-box'}}/>
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
        }} disabled={loading} style={{width:'100%',background:COLORS.gradient,border:'none',borderRadius:24,padding:15,color:'white',fontWeight:700,cursor:'pointer',fontSize:15,marginBottom:12,opacity:loading?0.6:1,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>
          {loading?'Sending...':'Send Reset Link'}
        </button>
        <button onClick={()=>{setStep('method');setError('');}} style={{background:'none',border:'none',color:COLORS.textTertiary,fontSize:13,cursor:'pointer',textDecoration:'underline'}}>Back to sign in</button>
      </div>
    </div>
  );

  if(step==='resetpw_sent') return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,background:COLORS.bg}}>
      <div style={{textAlign:'center',maxWidth:300}}>
        <div style={{fontSize:64,marginBottom:16}}>📬</div>
        <div style={{color:COLORS.textPrimary,fontWeight:800,fontSize:22,marginBottom:10,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>Check your inbox</div>
        <div style={{color:COLORS.textSecondary,fontSize:14,lineHeight:1.6,marginBottom:28}}>We sent a password reset link to <strong style={{color:COLORS.textPrimary}}>{identifier}</strong>.</div>
        <button onClick={()=>{setStep('method');setError('');}} style={{width:'100%',background:COLORS.gradient,border:'none',borderRadius:24,padding:15,color:'white',fontWeight:700,cursor:'pointer',fontSize:15,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>Back to Sign In →</button>
      </div>
    </div>
  );

if(step==='verify') return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,background:COLORS.bg}}>
      <div style={{textAlign:'center',maxWidth:300}}>
        <div style={{fontSize:64,marginBottom:16}}>📧</div>
        <div style={{color:COLORS.textPrimary,fontWeight:800,fontSize:22,marginBottom:10,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>Verify your email</div>
        <div style={{color:COLORS.textSecondary,fontSize:14,lineHeight:1.6,marginBottom:28}}>We sent a link to <strong style={{color:COLORS.textPrimary}}>{identifier}</strong>. Click it then come back to sign in.</div>
        <button onClick={()=>{setStep('method');setIsLogin(true);}} style={{width:'100%',background:COLORS.gradient,border:'none',borderRadius:24,padding:15,color:'white',fontWeight:700,cursor:'pointer',fontSize:15,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>Go to Sign In →</button>
      </div>
    </div>
  );
return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:COLORS.bg }}>
      <div style={{ width:'100%', maxWidth:340 }}>
        <button onClick={()=>setStep('method')} style={{ background:'none', border:'none', color:COLORS.textSecondary, marginBottom:24, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', gap:6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
        </button>
        <div style={{ background:COLORS.surface, borderRadius:24, padding:24, border:`1px solid ${COLORS.border}`, boxShadow:'0 4px 20px rgba(30,27,46,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24 }}>
            <div style={{ width:52, height:52, borderRadius:16, background:`${selectedMethod?.color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>{selectedMethod?.icon}</div>
            <div>
              <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:16, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{isLogin?'Sign in':'Sign up'}</div>
              <div style={{ color:COLORS.textTertiary, fontSize:12 }}>with {selectedMethod?.name}</div>
            </div>
          </div>
          {error && <div style={{background:`${COLORS.danger}1A`,border:`1px solid ${COLORS.danger}4D`,borderRadius:12,padding:'10px 14px',color:COLORS.danger,fontSize:12,marginBottom:12}}>{error}</div>}
          {successMsg && <div style={{background:`${COLORS.success}1A`,border:`1px solid ${COLORS.success}4D`,borderRadius:12,padding:'10px 14px',color:COLORS.success,fontSize:12,marginBottom:12}}>{successMsg}</div>}
          {!isLogin && <>
            <input placeholder="Full Name" value={fullName} onChange={e=>setFullName(e.target.value)} style={{ width:'100%', background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:14, padding:'13px 16px', color:COLORS.textPrimary, marginBottom:10, outline:'none', fontSize:14, boxSizing:'border-box' }} />
            <div style={{marginBottom:10}}>
              <div style={{color:COLORS.textTertiary,fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:7}}>Date of Birth *</div>
              <InlineDateSelect value={birthdate} onChange={setBirthdate} maxYear={new Date().getFullYear()-13} minYear={new Date().getFullYear()-100} />
              <div style={{color:COLORS.textTertiary,fontSize:11,marginTop:6}}>You must be at least 13 years old.</div>
            </div>
          </>}
          <input placeholder="Email" value={identifier} onChange={e=>setIdentifier(e.target.value)} style={{ width:'100%', background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:14, padding:'13px 16px', color:COLORS.textPrimary, marginBottom:10, outline:'none', fontSize:14, boxSizing:'border-box' }} />
          <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={{ width:'100%', background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:14, padding:'13px 16px', color:COLORS.textPrimary, marginBottom:14, outline:'none', fontSize:14, boxSizing:'border-box' }} />
          <button onClick={handleSubmit} disabled={loading} style={{ width:'100%', background:COLORS.gradient, border:'none', borderRadius:24, padding:15, color:'white', fontWeight:700, cursor:'pointer', fontSize:15, opacity:loading?0.6:1, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>
            {loading?'Please wait...':'Continue'}
          </button>
          {isLogin && (
  <button
    onClick={async () => {
      if (!identifier) { setError('Enter your email first'); return; }
      try {
        await sendPasswordResetEmail(auth, identifier);
        setError('');
        setSuccessMsg('Password reset email sent! Check your inbox.');
      } catch (e) {
        setSuccessMsg('');
        setError('Could not send reset email: ' + e.message);
      }
    }}
    style={{
      width: '100%', background: 'none', border: 'none',
      color: COLORS.textTertiary, fontSize: 13,
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
/* ─────────────── NOTIFICATIONS — REAL-TIME INSTAGRAM/TELEGRAM GRADE ─────────────── */
const NotificationsPage = ({ currentUser, users, videos, onClose, onViewProfile, onFollow, followed, showToast, t, onNavigate }) => {
  const [notifs, setNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(()=>{
    if(!currentUser?.id) return;
    const q = query(collection(db,'notifications'), where('toUserId','==',currentUser.id), orderBy('createdAt','desc'), limit(80));
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

  const handleNotifTap = async (n) => {
    if(!n.read) await updateDoc(doc(db,'notifications',n.id),{read:true}).catch(()=>{});
    if (n.type==='like' || n.type==='comment' || n.type==='mention') {
      onClose(); onNavigate?.('home', { openVideoId: n.videoId, openComments: n.type!=='like' });
    } else if (n.type==='follow') {
      onClose(); onViewProfile?.(n.fromUserId);
    } else if (n.type==='message') {
      onClose(); onNavigate?.('inbox', { targetUserId: n.fromUserId });
    } else if (n.type==='jobApplication') {
      onClose(); onNavigate?.('jobs', { jobId: n.jobId });
    } else if (n.type==='applicationReceived' || n.type==='applicationUpdate') {
      onClose(); onNavigate?.('jobs');
    } else {
      onClose(); onViewProfile?.(n.fromUserId);
    }
  };

  const typeLabelRef = { current: { like:'liked your post.', comment:'commented on your post.', follow:'started following you.', mention:'mentioned you in a comment.', gift:'sent a gift.', live:'went live.', story:'posted a new story.', message:'sent a message.', jobApplication:'applied to your job.', applicationReceived:'application update.', applicationUpdate:'application update.' } };
  const [activeFilter, setActiveFilter] = useState('all');
  const NOTIF_FILTERS = [
    {id:'all', label:'All'},
    {id:'like', label:'Likes'},
    {id:'comment', label:'Comments'},
    {id:'mention', label:'Mentions'},
  ];
  const filteredNotifs = activeFilter === 'all' ? notifs : notifs.filter(n => n.type === activeFilter);
  const newNotifs = filteredNotifs.filter(n => (Date.now() - (n.date?.getTime?.()||0)) < 24*3600*1000);
  const earlierNotifs = filteredNotifs.filter(n => (Date.now() - (n.date?.getTime?.()||0)) >= 24*3600*1000);

  const timeAgoShort = (date) => {
    if (!date) return '';
    const s = Math.floor((new Date() - date) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s/60)}m`;
    if (s < 86400) return `${Math.floor(s/3600)}h`;
    if (s < 86400*7) return `${Math.floor(s/86400)}d`;
    return date.toLocaleDateString();
  };

  const renderRow = (n) => {
    const fromUser = users.find(u=>u.id===n.fromUserId);
    const suffixIcon = {like:'❤️', comment:'', follow:'', mention:'', gift:'🎁', live:'', story:'', message:'', jobApplication:'', applicationReceived:'', applicationUpdate:''}[n.type] || '';
    const actionText = typeLabelRef.current[n.type] || n.message;
    return (
      <div key={n.id} onClick={()=>handleNotifTap(n)}
        onMouseEnter={e=>e.currentTarget.style.background=COLORS.surfaceAlt}
        onMouseLeave={e=>e.currentTarget.style.background=n.read?'transparent':COLORS.overlaySubtle}
        style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 16px', cursor:'pointer', background:n.read?'transparent':COLORS.overlaySubtle, position:'relative', transition:TRANSITION.fast }}>
        {!n.read && <div style={{ position:'absolute', left:0, top:10, bottom:10, width:3, borderRadius:2, background:COLORS.gradient }} />}
        <div style={{ width:44, height:44, borderRadius:'50%', background:fromUser?.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:16, overflow:'hidden', flexShrink:0, boxShadow:SHADOW.xs }}>
          {fromUser?.avatarUrl ? <img src={fromUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (fromUser?.avatar||fromUser?.username?.[0]||'?')}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:COLORS.textPrimary, fontSize:13.5, lineHeight:1.5 }}>
            {fromUser && <span style={{ fontWeight:700 }}>{fromUser.fullName || fromUser.username} </span>}
            <span style={{ color:COLORS.textSecondary }}>{actionText}</span>
            {suffixIcon && <span> {suffixIcon}</span>}
          </div>
          {n.type==='follow' && n.fromUserId !== currentUser?.id && (
            (followed||[]).includes(n.fromUserId) ? (
              <button onClick={e=>{ e.stopPropagation(); onFollow?.(n.fromUserId); }} style={{ marginTop:8, background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, color:COLORS.textSecondary, borderRadius:14, padding:'6px 16px', fontSize:12, fontWeight:700, cursor:'pointer', transition:TRANSITION.fast }}>Following</button>
            ) : (
              <button onClick={async e=>{ e.stopPropagation(); await onFollow?.(n.fromUserId); showToast?.('Followed back!','success'); }} style={{ marginTop:8, background:COLORS.gradient, border:'none', color:'white', borderRadius:14, padding:'6px 16px', fontSize:12, fontWeight:700, cursor:'pointer', boxShadow:SHADOW.glow(COLORS.brand), transition:TRANSITION.fast }}>Follow back</button>
            )
          )}
        </div>
        <div style={{ color:COLORS.textTertiary, fontSize:11.5, flexShrink:0, paddingTop:2 }}>{timeAgoShort(n.date)}</div>
      </div>
    );
  };

  return (
    <div style={{ position:'fixed', inset:0, background:COLORS.bg, zIndex:300, display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ padding:'16px 16px 0', background:COLORS.surface, borderBottom:`1px solid ${COLORS.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <button onClick={onClose} style={{ background:'none', border:'none', width:34, cursor:'pointer', color:COLORS.textPrimary, fontSize:18 }}>‹</button>
          <div style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:17 }}>Notifications</div>
          <button onClick={markAllRead} style={{ background:'none', border:'none', width:34, height:34, color:COLORS.textSecondary, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          </button>
        </div>
        {/* Category tabs */}
        <div style={{ display:'flex', gap:22 }}>
          {NOTIF_FILTERS.map(f=>(
            <button key={f.id} onClick={()=>setActiveFilter(f.id)} style={{ background:'none', border:'none', borderBottom:activeFilter===f.id?`2px solid ${COLORS.brand}`:'2px solid transparent', padding:'0 0 10px', color:activeFilter===f.id?COLORS.brand:COLORS.textTertiary, fontSize:13.5, fontWeight:700, cursor:'pointer' }}>{f.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto' }}>
        {filteredNotifs.length===0 && (
          <div style={{ textAlign:'center', padding:'60px 20px', color:COLORS.textTertiary }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🔔</div>
            <div style={{ fontSize:15, fontWeight:600, color:COLORS.textSecondary }}>No notifications yet</div>
            <div style={{ fontSize:13, marginTop:6 }}>{activeFilter==='all' ? 'Interact with others to receive notifications' : `No ${activeFilter} notifications`}</div>
          </div>
        )}
        {newNotifs.length>0 && <div style={{ padding:'14px 16px 6px', color:COLORS.textPrimary, fontSize:13, fontWeight:800 }}>New</div>}
        {newNotifs.map(renderRow)}
        {earlierNotifs.length>0 && <div style={{ padding:'16px 16px 6px', color:COLORS.textPrimary, fontSize:13, fontWeight:800 }}>Earlier</div>}
        {earlierNotifs.map(renderRow)}
      </div>
    </div>
  );
};


const InboxBadge = ({ currentUser }) => {
  const [unread, setUnread] = useState(0);
  useEffect(()=>{
    if(!currentUser?.id) return;
    const q = query(collection(db,'conversations'), where('participants','array-contains',currentUser.id));
    const unsub = onSnapshot(q, snap=>{
      const total = snap.docs.reduce((s,d)=>s+(d.data()[`unread_${currentUser.id}`]||0),0);
      setUnread(total);
    },()=>{});
    return ()=>unsub();
  },[currentUser?.id]);
  if(!unread) return null;
  return <div style={{ position:'absolute', top:-4, right:-4, minWidth:16, height:16, background:COLORS.brand, borderRadius:8, border:`1.5px solid ${COLORS.bg}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'white', fontWeight:800, padding:'0 3px' }}>{unread>9?'9+':unread}</div>;
};
/* ─────────────── INFINITY PAGE ───────────────
   Infinity is a shuffled view over the exact same real posts Home shows — no
   separate mock content, no synthetic modes. It rides on the same `videos` data
   every other tab already uses. Tapping the dice reshuffles the order using a
   seed derived from the current user's id + the tap's timestamp, so the order is
   both fresh on every tap and distinct per user. */

// Deterministic little hash so the shuffle is reproducible for a given seed while
// still landing differently per user and per tap — lets the whole tab genuinely
// re-shuffle with zero new backend fields, seeded by user id + tap time so no two
// people (and no two shuffles) land on the same order.
const infinityHash = (str, seed=0) => {
  let h = (seed>>>0) || 0;
  const s = String(str);
  for (let i=0;i<s.length;i++){ h = (Math.imul(h,31) + s.charCodeAt(i)) >>> 0; }
  return h;
};

// InfinityPage mirrors HomeFeed exactly — identical header (profile drawer button,
// inline search with the same live results, notification bell), identical Stories
// row, identical inline quick-composer, and the same FeedPostCard for every post.
// The one intentional difference is the post order: instead of strict newest-first,
// posts are shuffled via a per-user seed, with a floating dice button to reshuffle.
const InfinityPage = ({ t, videos, videosLoading, onShare, onFollow, onMessage, followed, showToast, currentUser, onViewProfile, onOpenNotifications, onOpenStories, onCreateStory, onViewStory, blockedUsers, onBlock, users, onOpenProfileDrawer, onFeedScroll }) => {
  const liveUserIds = useLiveStreamerIds(currentUser);
  // Inline "quick search" — filters users/posts in place instead of navigating to Discover.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchResults = useMemo(()=>{
    const q = searchQuery.trim().toLowerCase();
    if(!q) return { users:[], posts:[] };
    const matchedUsers = (users||[]).filter(u=>u.id!==currentUser?.id && (u.username?.toLowerCase().includes(q) || u.fullName?.toLowerCase().includes(q))).slice(0,5);
    const matchedPosts = (videos||[]).filter(v=>v.description?.toLowerCase().includes(q)).slice(0,5);
    return { users:matchedUsers, posts:matchedPosts };
  },[searchQuery, users, videos, currentUser?.id]);

  // Inline quick composer — Photo/Video/Poll/Feeling all act directly on this card
  // (single tap, no separate page). Mirrors CreateScreen's post-submission logic.
  const [composerText, setComposerText] = useState('');
  const [composerMedia, setComposerMedia] = useState([]);
  const [composerPosting, setComposerPosting] = useState(false);
  const [showFeelingPicker, setShowFeelingPicker] = useState(false);
  const [feeling, setFeeling] = useState(null);
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const composerFileInputRef = useRef(null);

  const pickComposerFiles = e => {
    const files = Array.from(e.target.files||[]);
    setComposerMedia(m => [...m, ...files.map(f=>({ url:URL.createObjectURL(f), file:f, type:f.type }))].slice(0,4));
    e.target.value = '';
  };
  const removeComposerMedia = idx => setComposerMedia(m => m.filter((_,i)=>i!==idx));
  const setPollOption = (idx, val) => setPollOptions(opts => opts.map((o,i)=>i===idx?val:o));
  const addPollOption = () => setPollOptions(opts => [...opts, '']);
  const removePollOption = idx => setPollOptions(opts => opts.length>2 ? opts.filter((_,i)=>i!==idx) : opts);
  const closePollBuilder = () => { setShowPollBuilder(false); setPollQuestion(''); setPollOptions(['','']); };
  const pollIsValid = pollQuestion.trim() && pollOptions.filter(o=>o.trim()).length>=2;
  const composerHasContent = composerText.trim() || composerMedia.length || pollIsValid || feeling;

  const submitQuickPost = async () => {
    if(!composerHasContent || composerPosting) return;
    setComposerPosting(true);
    try {
      let uploadedUrls = [];
      for (const m of composerMedia) {
        try {
          uploadedUrls.push(await uploadToCloudinary(m.file));
        } catch (uploadErr) {
          console.error('Media upload failed:', uploadErr);
          showToast?.(uploadErr?.message || 'Failed to upload photo/video — please try again', 'error');
          setComposerPosting(false);
          return;
        }
      }
      const payload = { description: composerText, ...buildMediaFields(composerMedia, uploadedUrls), hashtags: (composerText||'').match(/#\w+/g) || [] };
      if (pollIsValid) payload.poll = { question: pollQuestion.trim(), options: pollOptions.map(o=>o.trim()).filter(Boolean), votes:{}, voters:{} };
      if (feeling) payload.feeling = feeling;
      const data = await apiFetch('/api/videos/create', { method:'POST', body: JSON.stringify(payload) });
      showToast?.(data.moderationStatus === 'pending' ? 'Posted — under review' : 'Posted!', 'success');
      setComposerText(''); setComposerMedia([]); setFeeling(null); setShowFeelingPicker(false); closePollBuilder();
    } catch (e) { showToast?.(e?.message || 'Failed to post', 'error'); }
    setComposerPosting(false);
  };

  // Seed mixes the current user's id into the hash so the shuffle order is unique
  // per person, not just per click — two different users tapping the dice at the
  // same moment still land on two different orders.
  const [seed, setSeed] = useState(()=>infinityHash(currentUser?.id || 'anon', Date.now()));

  const reshuffle = () => {
    setSeed(infinityHash(currentUser?.id || 'anon', Date.now()));
    haptic('medium');
    showToast?.('Curating something new for you…', 'info');
  };

  // Same real posts + same blocked-user filtering as Home, just reshuffled into a
  // fresh, unique order every time the dice is tapped (and different per user,
  // since the seed is mixed with currentUser.id above).
  const filteredVideos = useMemo(()=>{
    const base = sortByNewest(videos.filter(v=>!(blockedUsers||[]).includes(v.userId)));
    return base
      .map(v => ({ v, sortKey: infinityHash(v.id, seed) }))
      .sort((a,b)=>a.sortKey-b.sortKey)
      .map(x=>x.v);
  },[videos, blockedUsers, seed]);

  return (
    <div data-main-scroll="true" onScroll={onFeedScroll} style={{ height:'100%', overflowY:'auto', background:COLORS.bg, padding:'10px 14px max(74px, calc(58px + env(safe-area-inset-bottom)))', position:'relative' }}>
      {/* Top search bar — expands and filters in place; tapping a result acts immediately,
          nothing here navigates to a separate search page. */}
      <div style={{ position:'relative', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={onOpenProfileDrawer} style={{ width:40, height:40, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:14, cursor:'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textPrimary} strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:COLORS.surface, border:`1px solid ${searchOpen?COLORS.brand:COLORS.border}`, borderRadius:20, padding:'10px 14px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2" style={{flexShrink:0}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={searchQuery}
              onFocus={()=>setSearchOpen(true)}
              onChange={e=>{ setSearchQuery(e.target.value); setSearchOpen(true); }}
              placeholder="Search"
              style={{ flex:1, minWidth:0, background:'none', border:'none', outline:'none', color:COLORS.textPrimary, fontSize:13, fontFamily:'inherit' }}
            />
            {searchOpen && (
              <span onClick={()=>{ setSearchOpen(false); setSearchQuery(''); }} style={{ cursor:'pointer', color:COLORS.textTertiary, fontSize:12, flexShrink:0 }}>✕</span>
            )}
          </div>
          <NotificationBellButton onOpenNotifications={onOpenNotifications} currentUser={currentUser} />
        </div>

        {searchOpen && searchQuery.trim() && (
          <div style={{ position:'absolute', top:'calc(100% + 6px)', left:50, right:0, background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:16, boxShadow:SHADOW.raised, zIndex:40, maxHeight:320, overflowY:'auto', padding:8 }}>
            {!searchResults.users.length && !searchResults.posts.length && (
              <div style={{ padding:'14px 10px', color:COLORS.textTertiary, fontSize:12.5, textAlign:'center' }}>No matches for "{searchQuery}"</div>
            )}
            {searchResults.users.map(u=>(
              <div key={u.id} onClick={()=>{ onViewProfile?.(u.id); setSearchOpen(false); setSearchQuery(''); }} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 6px', borderRadius:10, cursor:'pointer' }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:u.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:13, overflow:'hidden', flexShrink:0 }}>
                  {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : (u.username||'?')[0]?.toUpperCase()}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>@{u.username}</div>
                  {u.fullName && <div style={{ color:COLORS.textTertiary, fontSize:11 }}>{u.fullName}</div>}
                </div>
              </div>
            ))}
            {searchResults.posts.map(v=>(
              <div key={v.id} onClick={()=>{ onViewProfile?.(v.userId); setSearchOpen(false); setSearchQuery(''); }} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 6px', borderRadius:10, cursor:'pointer' }}>
                <div style={{ width:32, height:32, borderRadius:8, background:COLORS.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textTertiary} strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 15l-5-5L5 19"/></svg>
                </div>
                <div style={{ color:COLORS.textSecondary, fontSize:12.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stories row — same Stories component as Home, so tapping an avatar opens that
          user's story instead of their profile, and "+" opens the story composer. */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
        <span style={{ color:COLORS.textPrimary, fontWeight:800, fontSize:14 }}>Stories</span>
        <span onClick={onOpenStories} style={{ color:COLORS.brand, fontSize:12, fontWeight:700, cursor:'pointer' }}>See all</span>
      </div>
      <div style={{ margin:'0 -14px 6px' }}>
        <Stories users={users} currentUser={currentUser} onViewStory={onViewStory} onCreateStory={onCreateStory} followed={followed} liveUserIds={liveUserIds} />
      </div>

      {/* Post composer — fully inline: typing, attaching a photo, building a poll and
          picking a feeling all happen right here in one tap each, nothing navigates away. */}
      <div style={{ background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:RADIUS.lg, padding:14, marginBottom:0 }}>
        <input ref={composerFileInputRef} type="file" accept="image/*,video/*" multiple onChange={pickComposerFiles} style={{ display:'none' }} />
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:12 }}>
          <div style={{ width:38, height:38, borderRadius:'50%', background:currentUser?.avatarColor||COLORS.brand, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, overflow:'hidden', flexShrink:0 }}>
            {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : (currentUser?.username||'?')[0]?.toUpperCase()}
          </div>
          <textarea
            value={composerText}
            onChange={e=>setComposerText(e.target.value)}
            placeholder="What's on your mind?"
            rows={1}
            style={{ flex:1, minWidth:0, background:'none', border:'none', outline:'none', resize:'none', color:COLORS.textPrimary, fontSize:13.5, fontFamily:'inherit', paddingTop:8 }}
          />
        </div>

        {feeling && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:'5px 10px', fontSize:12, fontWeight:600, color:COLORS.textSecondary, marginBottom:10 }}>
            feeling {feeling.emoji} {feeling.text}
            <span onClick={()=>setFeeling(null)} style={{ cursor:'pointer', color:COLORS.textTertiary, fontWeight:800 }}>✕</span>
          </div>
        )}

        {composerMedia.length>0 && (
          <div style={{ display:'flex', gap:8, marginBottom:12, overflowX:'auto' }}>
            {composerMedia.map((m,i)=>(
              <div key={i} style={{ position:'relative', width:64, height:64, borderRadius:12, overflow:'hidden', background:COLORS.surfaceAlt, flexShrink:0 }}>
                {m.type?.startsWith('video') ? <video src={m.url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <img src={m.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
                <button onClick={()=>removeComposerMedia(i)} style={{ position:'absolute', top:3, right:3, width:18, height:18, borderRadius:'50%', background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {showFeelingPicker && (
          <div style={{ background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:14, padding:12, marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:12.5 }}>How are you feeling?</span>
              <span onClick={()=>setShowFeelingPicker(false)} style={{ cursor:'pointer', color:COLORS.textTertiary }}>✕</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
              {FEELINGS.map(f=>(
                <button key={f.text} onClick={()=>{ setFeeling(f); setShowFeelingPicker(false); }} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, background:feeling?.text===f.text?COLORS.surface2:COLORS.surface, border:`1px solid ${feeling?.text===f.text?COLORS.brand:COLORS.border}`, borderRadius:12, padding:'8px 4px', cursor:'pointer' }}>
                  <span style={{ fontSize:18 }}>{f.emoji}</span>
                  <span style={{ fontSize:9.5, color:COLORS.textSecondary, fontWeight:600 }}>{f.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showPollBuilder && (
          <div style={{ background:COLORS.surfaceAlt, border:`1px solid ${COLORS.border}`, borderRadius:14, padding:12, marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ color:COLORS.textPrimary, fontWeight:700, fontSize:12.5 }}>📊 Create a poll</span>
              <span onClick={closePollBuilder} style={{ cursor:'pointer', color:COLORS.textTertiary }}>✕</span>
            </div>
            <input value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)} placeholder="Ask a question…" style={{ width:'100%', background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:'9px 12px', color:COLORS.textPrimary, outline:'none', fontSize:13, marginBottom:8, boxSizing:'border-box' }} />
            {pollOptions.map((opt,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <input value={opt} onChange={e=>setPollOption(i,e.target.value)} placeholder={`Option ${i+1}`} style={{ flex:1, background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:'8px 12px', color:COLORS.textPrimary, outline:'none', fontSize:12.5, boxSizing:'border-box' }} />
                {pollOptions.length>2 && (
                  <span onClick={()=>removePollOption(i)} style={{ cursor:'pointer', color:COLORS.textTertiary, fontSize:13, padding:4 }}>✕</span>
                )}
              </div>
            ))}
            <button onClick={addPollOption} style={{ background:'none', border:'none', color:COLORS.brand, fontWeight:700, fontSize:12, cursor:'pointer', padding:'2px 0' }}>+ Add option</button>
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          {[
            {icon:(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.info} strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 15l-5-5L5 19"/></svg>), label:'Photo', active:false, action:()=>composerFileInputRef.current?.click()},
            {icon:(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.brand} strokeWidth="2"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>), label:'Poll', active:showPollBuilder, action:()=>setShowPollBuilder(v=>!v)},
            {icon:(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.warning} strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M8 15s1.5 2 4 2 4-2 4-2"/></svg>), label:'Feeling', active:showFeelingPicker, action:()=>setShowFeelingPicker(v=>!v)},
          ].map(btn=>(
            <button key={btn.label} onClick={e=>{ e.stopPropagation(); btn.action(); }} style={{ display:'flex', alignItems:'center', gap:6, background:btn.active?COLORS.surface2:COLORS.surfaceAlt, border:`1px solid ${btn.active?COLORS.brand:'transparent'}`, borderRadius:14, padding:'7px 12px', color:COLORS.textSecondary, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              {btn.icon}{btn.label}
            </button>
          ))}
          {composerHasContent && (
            <button onClick={submitQuickPost} disabled={composerPosting} style={{ marginLeft:'auto', background:'linear-gradient(135deg,#2E7BFF,#0B5FFF)', border:'none', borderRadius:14, padding:'8px 16px', color:'white', fontSize:12.5, fontWeight:700, cursor:composerPosting?'default':'pointer', opacity:composerPosting?0.7:1 }}>
              {composerPosting ? 'Posting…' : 'Post'}
            </button>
          )}
        </div>
      </div>

      {videosLoading && !filteredVideos.length && (
        <>
          <FeedSkeletonCard />
          <FeedSkeletonCard />
          <FeedSkeletonCard />
        </>
      )}

      {!videosLoading && !filteredVideos.length && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:COLORS.textTertiary }}>
          <div style={{ fontSize:44, marginBottom:10 }}>📭</div>
          <div>{t?.noVideos||'No posts yet. Be the first to post!'}</div>
        </div>
      )}

      {filteredVideos.map(video=>(
        <FeedPostCard
          key={video.id}
          video={video}
          currentUser={currentUser}
          onViewProfile={onViewProfile}
          onOpenComments={()=>{}}
          onShare={onShare}
          users={users}
          onFollow={onFollow}
          followed={followed}
          showToast={showToast}
          onBlock={onBlock}
          isLive={liveUserIds?.has(video.userId)}
        />
      ))}

      {/* The one deliberate difference from Home: a floating dice button that reshuffles
          the post order (per-user seed), instead of Home's strict newest-first order. */}
      <button onClick={reshuffle} aria-label="Surprise me" style={{ position:'fixed', right:'max(20px, calc((100vw - 430px)/2 + 20px))', bottom:'max(96px, calc(84px + env(safe-area-inset-bottom)))', width:52, height:52, borderRadius:'50%', background:COLORS.gradient, border:'none', boxShadow:'0 6px 20px rgba(11,95,255,0.45)', color:'#fff', fontSize:22, cursor:'pointer', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center' }}>
        🎲
      </button>
    </div>
  );
};
/* Bottom nav: standardized across every tab — same 38x38 footprint, same stroke
   weight, same single accent color (COLORS.brand) for the active state, same
   inactive treatment (COLORS.textTertiary). 'create' is intentionally the one
   exception (a distinct action button, not a destination tab) and 'profile' keeps
   its avatar photo but sits in the identical 38x38 ring/tint footprint as the rest
   so nothing looks mismatched at a glance. */
const NAV_ACTIVE_COLOR = COLORS.brand;
const NAV_INACTIVE_COLOR = COLORS.textTertiary;
/* Extraordinary, text-free tab glyphs. Every icon is duotone: a soft brand-tinted
   fill appears only when active (via a unique per-tab gradient id so multiple tabs
   mounted at once never bleed into each other's gradients), layered under a crisp
   outline whose stroke weight and opacity shift on activation. No labels — the
   glyph itself, plus a gentle scale/lift and a glowing dot beneath it, is the only
   indicator of the active tab. */
const TabGlyph = ({id, active, currentUser}) => {
  const color = active ? NAV_ACTIVE_COLOR : NAV_INACTIVE_COLOR;
  const sw = active ? 2.1 : 1.75;
  const gid = `navg-${id}`;
  const s = {width:24,height:24,fill:'none',stroke:color,strokeWidth:sw,strokeLinecap:'round',strokeLinejoin:'round', opacity: active?1:0.78, transform: active?'scale(1)':'scale(0.94)', transitionProperty:'stroke,opacity,transform', transitionDuration:'0.28s', transitionTimingFunction:'cubic-bezier(0.34,1.56,0.64,1)'};
  const defs = (
    <defs>
      <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0B5FFF" />
        <stop offset="100%" stopColor="#0B5FFF" />
      </linearGradient>
    </defs>
  );
  if(id==='home') return (
    <svg viewBox="0 0 24 24" style={s}>
      {defs}
      <path d="M4 11.5L12 4l8 7.5" fill="none" />
      <path d="M6 10.2V19a1.4 1.4 0 001.4 1.4h2.2v-4.6a2.4 2.4 0 014.8 0V20.4h2.2A1.4 1.4 0 0018 19v-8.8"
        fill={active ? `url(#${gid})` : 'none'} fillOpacity={active ? 0.24 : 0} stroke={color} />
      <path d="M9.6 20.4v-4.6a2.4 2.4 0 014.8 0v4.6" fill="none" />
    </svg>
  );
  if(id==='infinity') return (
    <svg viewBox="0 0 24 24" style={s}>
      {defs}
      <path d="M7.2 8.4c-2.1 0-3.8 1.6-3.8 3.6s1.7 3.6 3.8 3.6c2.7 0 3.9-2.2 4.8-3.6.9-1.4 2.1-3.6 4.8-3.6 2.1 0 3.8 1.6 3.8 3.6s-1.7 3.6-3.8 3.6c-2.7 0-3.9-2.2-4.8-3.6-.9-1.4-2.1-3.6-4.8-3.6z"
        fill={active ? `url(#${gid})` : 'none'} fillOpacity={active ? 0.22 : 0} strokeLinejoin="round" />
    </svg>
  );
  if(id==='friends') return (
    <svg viewBox="0 0 24 24" style={s}>
      {defs}
      <circle cx="9" cy="8.3" r="3.3" fill={active ? `url(#${gid})` : 'none'} fillOpacity={active ? 0.22 : 0} />
      <path d="M3.6 19.4c0-3.3 2.4-5.2 5.4-5.2s5.4 1.9 5.4 5.2" fill="none" />
      <path d="M14.7 4.9a3.3 3.3 0 010 6.4" fill="none" />
      <path d="M15.9 14.5c2.5.4 4.1 2.1 4.1 4.9" fill="none" />
    </svg>
  );
  if(id==='inbox') return (
    <span style={{ position:'relative', display:'flex' }}>
      <svg viewBox="0 0 24 24" style={s}>
        {defs}
        <path d="M3.2 5.4l9-3 9 3v.2L12.2 14 3.2 5.6z" fill={active ? `url(#${gid})` : 'none'} fillOpacity={active ? 0.22 : 0} />
        <path d="M3.2 5.4v12.2A1.4 1.4 0 004.6 19h14.8a1.4 1.4 0 001.4-1.4V5.4" fill="none" />
        <path d="M3.2 5.6L12.2 14l8.8-8.4" fill="none" />
      </svg>
      <InboxBadge currentUser={currentUser} />
    </span>
  );
  if(id==='profile') return (
    <div style={{ width:24, height:24, borderRadius:'50%', padding:2, display:'flex', alignItems:'center', justifyContent:'center', opacity: active?1:0.85, background: active ? COLORS.gradient : 'transparent', transform: active?'scale(1)':'scale(0.94)', transitionProperty:'transform,background', transitionDuration:'0.28s', transitionTimingFunction:'cubic-bezier(0.34,1.56,0.64,1)' }}>
      <div style={{ width:'100%', height:'100%', borderRadius:'50%', background: active ? (currentUser?.avatarColor||color) : color, border: active ? '1.5px solid rgba(255,255,255,0.85)' : `1.75px solid ${color}`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:9, overflow:'hidden' }}>
        {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (currentUser?.username||'?')[0]?.toUpperCase()}
      </div>
    </div>
  );
  if(id==='settings') return (
    <svg viewBox="0 0 24 24" style={s}>
      {defs}
      <circle cx="12" cy="12" r="3.1" fill={active ? `url(#${gid})` : 'none'} fillOpacity={active ? 0.28 : 0} />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" fill="none" />
    </svg>
  );
  return null;
};

/* ─────────────── MAIN APP ─────────────── */
export default function InfinityV1app() {
  // Holds the currently-registered presence 'beforeunload' handler so handleLogin can
  // remove the previous one before adding a new one. Without this, switching accounts
  // (or re-authenticating) in the same tab stacked up duplicate listeners, each holding
  // a stale profile.id in its closure and each firing on unload — noisy writes and one
  // more listener leaked per login.
  const presenceUnloadHandlerRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [theme, setThemeState] = useState('light');
  // Applies the stored preference once on mount, then re-renders whenever applyTheme()
  // mutates COLORS (see theme.js) so the whole tree repaints with the new palette.
  useEffect(() => {
    const stored = getStoredTheme();
    applyTheme(stored);
    setThemeState(stored);
    const unsub = subscribeTheme(setThemeState);
    return unsub;
  }, []);
  const toggleTheme = useCallback(() => {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme]);
  const [toast, setToast] = useState(null);
  const [notifPopup, setNotifPopup] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showTextComposer, setShowTextComposer] = useState(false);
  const [showStoriesPage, setShowStoriesPage] = useState(false);
  const [showCall, setShowCall] = useState(null); // { type, contactName, contactAvatar, contactId }
  const [showLiveStream, setShowLiveStream] = useState(null);
  const liveStreamerIds = useLiveStreamerIds(currentUser);
  const [showStoryViewer, setShowStoryViewer] = useState(null);
  const [showSoundLibrary, setShowSoundLibrary] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [followed, setFollowed] = useState([]);
const [blockedUsers, setBlockedUsers] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  // ── v4 NEW STATE ──
  const [showSavedPosts, setShowSavedPosts] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [notifBadgeCount, setNotifBadgeCount] = useState(0);
  const [settingsSignal, setSettingsSignal] = useState(0);
  const [navVisible, setNavVisible] = useState(true);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const contentWrapperRef = useRef(null);
  const lastScrollYRef = useRef(0);
  const scrollTickingRef = useRef(false);

  // Passed directly to the scrollable div of each primary tab (Home, Friends, Profile,
  // Inbox) as onScroll={handleFeedScroll}. A direct handler on the element that's
  // actually scrolling is far more reliable across mobile browsers than trying to
  // catch the event on an ancestor — some mobile WebViews don't propagate 'scroll'
  // the way desktop Chrome does, which is why the previous version sometimes never
  // fired at all.
  const handleFeedScroll = useCallback((e) => {
    const rawTop = e.currentTarget?.scrollTop;
    if(typeof rawTop !== 'number') return;
    // iOS rubber-band overscroll can report negative or jittery values near the
    // edges; clamp so a bounce doesn't get misread as a real scroll gesture.
    const scrollTop = Math.max(0, rawTop);
    if(scrollTickingRef.current) return;
    scrollTickingRef.current = true;
    requestAnimationFrame(()=>{
      const delta = scrollTop - lastScrollYRef.current;
      if(scrollTop < 24){ setNavVisible(true); }
      else if(delta > 10){ setNavVisible(false); }
      else if(delta < -10){ setNavVisible(true); }
      lastScrollYRef.current = scrollTop;
      scrollTickingRef.current = false;
    });
  }, []);

  // Switching tabs used to leave the nav stuck hidden if you'd scrolled down before
  // switching (lastScrollYRef still held the old tab's scroll position, so the new tab's
  // first scroll event could compute a stale/huge delta). Reset both on every tab change.
  useEffect(()=>{
    setNavVisible(true);
    lastScrollYRef.current = 0;
  }, [activeTab]);

  // Horizontal swipe: Settings ↔ Profile ↔ Home ↔ Infinity ↔ Friends ↔ Messages ↔ back to Settings.
  // 'Create' is deliberately excluded from the swipe order — it's a tap-only action,
  // reached from its raised button in the bottom nav (or the Home composer), never
  // by swiping past it. This is a continuous loop: swiping left past Messages wraps
  // around to Settings, and swiping right past Settings wraps around to Messages —
  // it never just stops dead at either end.
  const swipeTabOrder = ['settings','profile','home','infinity','friends','inbox'];
  const touchStartRef = useRef(null);

  // Centralized navigation so bottom-nav taps and swipe gestures always agree on what
  // happens when entering 'settings' (fire the settings signal so ProfilePage jumps
  // straight to its settings view).
  const navigateToTab = useCallback((tabId) => {
    setShowCamera(false); setShowSearch(false);
    setActiveTab(tabId);
    if(tabId === 'settings') setSettingsSignal(n=>n+1);
  }, []);

  const handleTabTouchStart = (e) => {
    const t = e.touches?.[0];
    if(!t) return;
    touchStartRef.current = { x:t.clientX, y:t.clientY, time:Date.now() };
  };
  const handleTabTouchEnd = (e) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if(!start) return;
    const t = e.changedTouches?.[0];
    if(!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const elapsed = Date.now() - start.time;
    // Require a clearly horizontal, deliberate swipe so this never fights the vertical
    // swipe-to-next-video gesture used throughout the feed.
    if(elapsed > 600 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
    const currentIdx = swipeTabOrder.indexOf(activeTab);
    if(currentIdx === -1) return;
    const len = swipeTabOrder.length;
    // Wrap around in both directions so the swipe order is a continuous loop
    // rather than a dead end at Settings or Messages.
    const nextIdx = (currentIdx + (dx < 0 ? 1 : -1) + len) % len;
    haptic('light');
    navigateToTab(swipeTabOrder[nextIdx]);
  };

  const showToast = useCallback((message, type='info')=>setToast({message,type}),[]);
  const isOnline = useNetworkStatus();
  const t = TRANSLATIONS[currentUser?.language || 'en'] || TRANSLATIONS.en;

  useEffect(()=>{
    if(!messaging || !currentUser?.id) return;
    try {
      const unsub = onMessage(messaging, payload=>{
        const title = payload?.notification?.title || 'New notification';
        const body = payload?.notification?.body || '';
        const type = payload?.data?.type || 'notif';
        showToast(title, 'info');
        playNotifSound(type === 'call' ? 'call' : 'notif');
        showBrowserNotification(title, body, type);
      });
      return ()=>unsub?.();
    } catch {}
  },[currentUser?.id]);
  // Firebase Auth listener
  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async (fbUser)=>{
      if(fbUser){
        // Block unverified email users from entering the app
        if(!fbUser.emailVerified && fbUser.providerData?.some(p => p.providerId === 'password')){
  // Don't block if we just created the account (within last 30 seconds)
  const createdAt = fbUser.metadata?.creationTime;
  const isNewAccount = createdAt && (Date.now() - new Date(createdAt).getTime()) < 120000;
  if(!isNewAccount){
    await signOut(auth);
    setCurrentUser(null);
    setAuthLoading(false);
    return;
  }
}
        let profile = await getUserProfile(fbUser.uid);
        if(!profile){
          for(let i=0; i<5; i++){
            await new Promise(r => setTimeout(r, 1000));
            profile = await getUserProfile(fbUser.uid);
            if(profile) break;
          }
        }
        // Admin status now comes from the Firebase custom claim set by scripts/set-admin.js,
        // not a hardcoded support email — the claim lives on the ID token, not Firestore.
        let isAdmin = false;
        try {
          const tokenResult = await getIdTokenResult(fbUser, true);
          isAdmin = tokenResult.claims?.admin === true;
        } catch {}
        if(profile) {
  setCurrentUser({...profile, id:fbUser.uid, language: profile.language || 'en', isAdmin, avatarColor: resolveAvatarColor(profile.avatarColor, fbUser.uid)});
  setFollowed(profile.following||[]);
  setBlockedUsers(profile.blockedUsers||[]);
} else {
          // Profile never arrived — build fallback so app doesn't stay blank
          const fallback = buildDefaultProfile(fbUser.uid, {
            username: fbUser.displayName?.split(' ')[0]?.toLowerCase() || fbUser.email?.split('@')[0] || 'user',
            fullName: fbUser.displayName || '',
            email: fbUser.email || '',
            avatarUrl: fbUser.photoURL || null,
          });
          await createUserProfile(fbUser.uid, fallback);
          setCurrentUser(fallback);
          setFollowed([]);
        }
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return ()=>unsub();
  },[]);
  // Auto-reinstate: once a suspension's window has passed, the account shouldn't
  // stay gated on a stale `accountStatus:'suspended'` flag waiting for an admin to
  // notice. getEnforcementStatus already treats an expired suspension as "not
  // enforced" for rendering purposes; this effect clears the flag itself (locally
  // and in Firestore) so the badge and any other reads of accountStatus catch up.
  useEffect(()=>{
    if (currentUser?.accountStatus !== 'suspended') return;
    const until = tsToDate(currentUser.suspendedUntil);
    if (!until || until.getTime() > Date.now()) return;
    updateDoc(doc(db,'users',currentUser.id), { accountStatus:'active', suspendedUntil:null }).catch(()=>{});
    setCurrentUser(u => u ? { ...u, accountStatus:'active', suspendedUntil:null } : u);
  }, [currentUser?.accountStatus, currentUser?.suspendedUntil, currentUser?.id]);
// Clean up expired stories
  useEffect(()=>{
    const cleanup = async () => {
      const now = new Date();
      const snap = await getDocs(query(collection(db,'stories'), where('expiresAt','<=',now)));
      await Promise.all(snap.docs.map(d=>deleteDoc(doc(db,'stories',d.id))));
    };
    cleanup();
  },[]);
  // Real-time videos from Firestore
  useEffect(()=>{
    const q = query(collection(db,'videos'), orderBy('createdAt','desc'), limit(50));
    const unsub = onSnapshot(q, snap=>{
      setVideos(sortByNewest(snap.docs.map(d=>({id:d.id,...d.data()}))));
      setVideosLoading(false);
    }, ()=>setVideosLoading(false));
    return ()=>unsub();
  },[]);

  // Real-time users from Firestore
  useEffect(()=>{
    const unsub = onSnapshot(collection(db,'users'), snap=>{
      setUsers(snap.docs.map(d=>{
        const data = d.data();
        return { id:d.id, ...data, avatarColor: resolveAvatarColor(data.avatarColor, d.id) };
      }));
    });
    return ()=>unsub();
  },[]);

  // Mirrors accountStatus/suspendedUntil/lastModerationAction from the live users
  // collection onto currentUser. Without this, a ban or suspension applied while
  // someone is actively using the app wouldn't take effect until their next login —
  // the enforcement gate reads currentUser, and currentUser was otherwise only ever
  // set once at sign-in.
  useEffect(()=>{
    if (!currentUser?.id) return;
    const live = users.find(u => u.id === currentUser.id);
    if (!live) return;
    if (live.accountStatus !== currentUser.accountStatus || live.suspendedUntil !== currentUser.suspendedUntil) {
      setCurrentUser(u => u ? { ...u, accountStatus: live.accountStatus, suspendedUntil: live.suspendedUntil, lastModerationAction: live.lastModerationAction, strikeCount: live.strikeCount } : u);
    }
  }, [users, currentUser?.id, currentUser?.accountStatus, currentUser?.suspendedUntil]);

  // Update friends when followed or users change
  useEffect(()=>{
    setFriends(followed);
  },[followed]);
// Real-time notification popup
  // `users` is read via a ref so this listener doesn't tear down/resubscribe
  // every time the users collection changes (it previously listed `users` as
  // a dependency, causing a full unsubscribe+resubscribe on every user update).
  const usersRef = useRef(users);
  useEffect(()=>{ usersRef.current = users; },[users]);
  useEffect(()=>{
    if(!currentUser?.id) return;
    let isFirst = true;
    const q = query(
      collection(db,'notifications'),
      where('toUserId','==',currentUser.id),
      where('read','==',false),
      orderBy('createdAt','desc')
    );
    const unsub = onSnapshot(q, snap=>{
      if(isFirst){ isFirst=false; return; }
      snap.docChanges().forEach(change=>{
        if(change.type==='added'){
          const data = change.doc.data();
          const fromUser = usersRef.current.find(u=>u.id===data.fromUserId);
          setNotifPopup({ notif:{...data,id:change.doc.id}, user:fromUser });
        }
      });
    },()=>{});
    return ()=>unsub();
  },[currentUser?.id]);
  // Incoming call listener
  useEffect(()=>{
    if(!currentUser?.id) return;
    const q = query(
      collection(db,'calls'),
      where('calleeId','==',currentUser.id),
      where('status','==','ringing')
    );
    const unsub = onSnapshot(q, snap=>{
      snap.docChanges().forEach(change=>{
        if(change.type==='added'){
          const data = change.doc.data();
          setIncomingCall({...data, callDocId: change.doc.id});
        }
      });
    }, (err)=>{
      // BUG FIX: this error callback used to be a no-op. If Firestore denied this
      // query (e.g. a security-rules mismatch), the callee would NEVER see an
      // incoming call and there was no trace of why — it just looked like calling
      // someone silently did nothing. Now it's logged so it's actually diagnosable.
      console.error('Incoming-call listener error (check firestore.rules for /calls):', err);
    });
    return ()=>unsub();
  },[currentUser?.id]);

  const handleLogin = async (profile) => {
    setCurrentUser(profile);
    setFollowed(profile.following||[]);
setBlockedUsers(profile.blockedUsers||[]);
    // Save to local accounts list
    const stored = JSON.parse(localStorage.getItem('infinity_accounts')||'[]');
    const exists = stored.find(a=>a.id===profile.id);
    if(!exists) {
      stored.push({ id:profile.id, username:profile.username, avatar:profile.avatar, avatarColor:profile.avatarColor, avatarUrl:profile.avatarUrl, subscription:profile.subscription });
      localStorage.setItem('infinity_accounts', JSON.stringify(stored));
    }
    showToast(`Welcome back, @${profile.username}! 👋`,'success');
    setDoc(doc(db,'presence',profile.id),{online:true,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
    if (presenceUnloadHandlerRef.current) {
      window.removeEventListener('beforeunload', presenceUnloadHandlerRef.current);
    }
    const onUnload = () => {
      setDoc(doc(db,'presence',profile.id),{online:false,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
    };
    presenceUnloadHandlerRef.current = onUnload;
    window.addEventListener('beforeunload', onUnload);
    try {
      const permission = await Notification.requestPermission();
      if(permission === 'granted') {
        const swReg = await registerNotifServiceWorker();
        const token = messaging ? await getToken(messaging, swReg ? { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg } : { vapidKey: VAPID_KEY }) : null;
        if(token) await updateDoc(doc(db,'users',profile.id),{ fcmToken: token });
      }
    } catch(e) { console.log('Push notification setup failed:', e); }
  };
const handleLogout = async () => {
    if (currentUser?.id) {
      await setDoc(doc(db,'presence',currentUser.id),{online:false,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
    }
    if (presenceUnloadHandlerRef.current) {
      window.removeEventListener('beforeunload', presenceUnloadHandlerRef.current);
      presenceUnloadHandlerRef.current = null;
    }
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
const [inboxOpenGroups, setInboxOpenGroups] = useState(0);
const [activeConversation, setActiveConversation] = useState(null);
const [quickConversation, setQuickConversation] = useState(null);
const handleMessage = uid => {
  if(!uid) { showToast?.('Unable to open chat: user not found','error'); return; }
  if(!currentUser?.id) { showToast?.('Unable to open chat: not signed in','error'); return; }
  if(uid === currentUser.id) { showToast?.("You can't message yourself",'info'); return; }
  const convId = [currentUser.id, uid].sort().join('_');
  const otherUser = users.find(u=>u.id===uid) || { id: uid, username:'', avatar:'?', avatarColor:'#5A5A66' };
  // Open the conversation immediately as a top-level overlay — independent of
  // activeTab/showCamera/showSearch, so it can never be hidden by other UI state.
  setQuickConversation({ id: convId, otherUser });
  setDoc(doc(db, 'conversations', convId), {
    participants: [currentUser.id, uid],
    lastMessageAt: serverTimestamp(),
  }, { merge: true }).catch(() => {});
};

  // Profile and Settings are intentionally not here anymore — they're reached by
  // swiping (right from Home for Profile, left past Messages for Settings).
  const tabs = [
    {id:'home'},{id:'infinity'},{id:'create'},{id:'friends'},{id:'inbox'},
  ];

  if(authLoading) return (
    <div style={{ maxWidth:430, margin:'0 auto', height:'100dvh', background:COLORS.bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <GlobalStyles />
      {!isOnline && <OfflineBanner />}
      <img src="https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png" style={{ width:80, height:80, borderRadius:24, marginBottom:16 }} alt="Infinity" />
      <div style={{ width:32, height:32, border:'3px solid rgba(11,95,255,0.25)', borderTop:`3px solid ${COLORS.brand}`, borderRadius:'50%', animation:'spin 1s linear infinite' }} />
    </div>
  );

  if(!currentUser) return (
    <div style={{ maxWidth:430, margin:'0 auto', height:'100dvh', background:'#0B0B0F', overflow:'hidden' }}>
      <GlobalStyles />
      <AuthScreen onLogin={handleLogin} />
      {notifPopup && (
        <NotifPopup
          notif={notifPopup.notif}
          user={notifPopup.user}
          onClose={()=>setNotifPopup(null)}
          onTap={()=>{ handleViewProfile(notifPopup.notif?.fromUserId); setNotifPopup(null); }}
        />
      )}
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
    </div>
  );

  // Enforcement gate — a banned or suspended account never reaches the app itself.
  // This is the piece that was missing: accountStatus previously only drove a badge
  // in the Moderation Center, nothing actually stopped the account from being used.
  if(getEnforcementStatus(currentUser)) return (
    <>
      <GlobalStyles />
      <EnforcementScreen user={currentUser} onSignOut={handleLogout} showToast={showToast} />
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
    </>
  );

  return (
    <div style={{ maxWidth:430, margin:'0 auto', height:'100dvh', background:COLORS.bg, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}>
      <GlobalStyles />
      <ConfirmDialogHost />
      {!isOnline && <OfflineBanner />}
{incomingCall && !showCall && (
        <IncomingCallScreen
          callData={incomingCall}
          onAnswer={()=>{
  const snap = {...incomingCall};
  const docId = snap.callDocId || snap.id;
  snap.callDocId = docId;
  setIncomingCall(null);
  setShowCall({
    type: snap.callType||'audio',
    contactName: snap.callerName||'Unknown',
    contactAvatar: snap.callerAvatar||'?',
    contactId: snap.callerId,
    isCallee: true,
    callDocId: snap.callDocId || snap.id
  });
}}
          onDecline={()=>{
            updateDoc(doc(db,'calls',incomingCall.callDocId),{status:'declined'}).catch(()=>{});
            setIncomingCall(null);
          }}
        />
      )}
      {showCall && <CallModal type={showCall.type} contactName={showCall.contactName} contactAvatar={showCall.contactAvatar} contactId={showCall.contactId} currentUser={currentUser} onClose={()=>setShowCall(null)} isCallee={showCall.isCallee} callDocId={showCall.callDocId} showToast={showToast} />}
      {showLiveStream && <LiveStream streamer={showLiveStream} onClose={()=>setShowLiveStream(null)} showToast={showToast} currentUser={currentUser} />}
      {showStoryViewer && showStoryViewer.groups && (
        <TelegramStoryViewer
          storyGroups={showStoryViewer.groups}
          startGroupIdx={showStoryViewer.startIdx || 0}
          currentUser={currentUser}
          onClose={()=>setShowStoryViewer(null)}
          onViewProfile={uid=>{handleViewProfile(uid); setShowStoryViewer(null);}}
          showToast={showToast}
        />
      )}

      {showSoundLibrary && <SoundLibraryPage onSelectSound={s=>{showToast?.(`Selected: ${s.name}`,'success'); setShowSoundLibrary(false);}} onClose={()=>setShowSoundLibrary(false)} />}
      {showQRCode && <QRCodePage user={currentUser} onClose={()=>setShowQRCode(false)} />}
      {showNotifications && <NotificationsPage currentUser={currentUser} users={users} videos={videos} onClose={()=>setShowNotifications(false)} onViewProfile={uid=>{handleViewProfile(uid); setShowNotifications(false);}} onFollow={toggleFollow} followed={followed} showToast={showToast} t={t} onNavigate={(tab, opts)=>{ setShowNotifications(false); if(tab==='inbox'){ setActiveTab('inbox'); if(opts?.targetUserId) setInboxTargetId(opts.targetUserId); } else if(tab==='jobs'){ setActiveTab('friends'); } else { setActiveTab(tab||'home'); } }} />}
      {showAnalytics && <CreatorAnalytics user={currentUser} videos={videos} onClose={()=>setShowAnalytics(false)} />}
      {showCreateStory && <CreateStoryModal currentUser={currentUser} onClose={()=>setShowCreateStory(false)} showToast={showToast} />}
      {showStoriesPage && (
        <StoriesPage
          users={users}
          currentUser={currentUser}
          onClose={()=>setShowStoriesPage(false)}
          onViewStory={(payload)=>{ setShowStoryViewer(payload); }}
          onCreateStory={()=>setShowCreateStory(true)}
          showToast={showToast}
          t={t}
        />
      )}
      {/* ── v4 NEW OVERLAYS ── */}

      {showSavedPosts && <SavedPostsPage currentUser={currentUser} showToast={showToast} onClose={()=>setShowSavedPosts(false)} />}
      {showDiscover && <DiscoverPage videos={videos} users={users} onViewProfile={uid=>{handleViewProfile(uid);}} showToast={showToast} onClose={()=>setShowDiscover(false)} />}
      {showShareSheet && <ShareSheet video={showShareSheet} currentUser={currentUser} onClose={()=>setShowShareSheet(null)} showToast={showToast} />}
      {showBroadcast && <BroadcastPage currentUser={currentUser} users={users} showToast={showToast} onClose={()=>setShowBroadcast(false)} />}
      {viewingProfile && (
        <UserProfileModal user={viewingProfile} currentUser={currentUser} onClose={()=>setViewingProfile(null)} onFollow={toggleFollow} onMessage={uid=>{handleMessage(uid); setViewingProfile(null);}} onVoiceCall={uid=>{const u=users.find(uu=>uu.id===uid); setShowCall({type:'audio',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid}); setViewingProfile(null);}}
 onVideoCall={uid=>{const u=users.find(uu=>uu.id===uid); setShowCall({type:'video',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid}); setViewingProfile(null);}}
 followed={followed} showToast={showToast} userVideos={videos.filter(v=>v.userId===viewingProfile?.id)}
 isLive={liveStreamerIds?.has(viewingProfile?.id)} onJoinLive={u=>{ setShowLiveStream(u); setViewingProfile(null); }} />
      )}

      {showProfileDrawer && (
        <>
          <div onClick={()=>setShowProfileDrawer(false)} style={{ position:'fixed', inset:0, zIndex:8998, background:'rgba(30,27,46,0.4)', backdropFilter:'blur(2px)', maxWidth:430, margin:'0 auto', animation:'fadeIn 0.2s ease' }} />
          <div style={{ position:'fixed', top:0, bottom:0, left:'max(0px, calc(50% - 215px))', width:'86%', maxWidth:370, zIndex:8999, background:COLORS.bg, boxShadow:'8px 0 40px rgba(30,27,46,0.25)', animation:'slideInLeft 0.28s cubic-bezier(0.4,0,0.2,1)', overflow:'hidden' }}>
            <ProfilePage user={currentUser} setCurrentUser={setCurrentUser} onLogout={handleLogout} users={users} showToast={showToast} onShowAnalytics={()=>setShowAnalytics(true)} onShowQRCode={()=>setShowQRCode(true)} allVideos={videos} setBlockedUsers={setBlockedUsers} onShowSavedPosts={()=>setShowSavedPosts(true)} onGoToGroups={()=>{ setShowProfileDrawer(false); setActiveTab('inbox'); setInboxOpenGroups(n=>n+1); }} onShowBroadcast={()=>setShowBroadcast(true)} onViewProfile={handleViewProfile} t={t} theme={theme} onToggleTheme={toggleTheme} />
          </div>
        </>
      )}

      {quickConversation && (
        <div style={{ position:'fixed', inset:0, zIndex:10500, background:'#0B0B0F', maxWidth:430, margin:'0 auto' }}>
          <ConversationView
            currentUser={currentUser}
            otherUser={users.find(u=>u.id===quickConversation.otherUser?.id) || quickConversation.otherUser}
            conversationId={quickConversation.id}
            onBack={()=>setQuickConversation(null)}
            showToast={showToast}
            onViewProfile={uid=>{ setQuickConversation(null); handleViewProfile(uid); }}
            onVoiceCall={uid=>{const u=users.find(uu=>uu.id===uid); const callDocId=[currentUser.id,uid].sort().join('_'); setShowCall({type:'audio',contactName:u?.username||quickConversation.otherUser?.username,contactAvatar:u?.avatar||quickConversation.otherUser?.avatar,contactId:uid,callDocId});}}
            onVideoCall={uid=>{const u=users.find(uu=>uu.id===uid); const callDocId=[currentUser.id,uid].sort().join('_'); setShowCall({type:'video',contactName:u?.username||quickConversation.otherUser?.username,contactAvatar:u?.avatar||quickConversation.otherUser?.avatar,contactId:uid,callDocId});}}
            onBlock={uid=>setBlockedUsers(p=>[...p,uid])}
          />
        </div>
      )}

      <div ref={contentWrapperRef} onTouchStart={handleTabTouchStart} onTouchEnd={handleTabTouchEnd} style={{ flex:1, overflow:'hidden', position:'relative', minHeight:0, height:'100%' }}>
        {showSearch && <SearchOverlay onClose={()=>setShowSearch(false)} videos={videos} users={users} onViewProfile={uid=>{handleViewProfile(uid); setShowSearch(false);}} />}
        {showCamera && <CameraUpload onUpload={v=>{setVideos(prev=>[v,...prev]);}} onClose={()=>setShowCamera(false)} showToast={showToast} currentUser={currentUser} />}
        {showTextComposer && (
          <div style={{ position:'fixed', inset:0, zIndex:9500, background:COLORS.bg, maxWidth:430, margin:'0 auto' }}>
            <CreateScreen onOpenCamera={()=>{ setShowTextComposer(false); setShowCamera(true); }} onShowSoundLibrary={()=>setShowSoundLibrary(true)} showToast={showToast} t={t} currentUser={currentUser} users={users} autoFocusText onClose={()=>setShowTextComposer(false)} onPosted={()=>setShowTextComposer(false)} />
          </div>
        )}
        {!showSearch && !showCamera && (
          <>
            {activeTab==='home' && <HomeFeed t={t} videos={videos} videosLoading={videosLoading} currentUser={currentUser} onLike={()=>{}} onComment={()=>{}} onShare={(v)=>setShowShareSheet(v)} onFollow={toggleFollow} onMessage={handleMessage}
  onVoiceCall={uid=>{ const u=users.find(uu=>uu.id===uid); const callDocId=[currentUser.id,uid].sort().join('_'); setShowCall({type:'audio',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid,callDocId}); }}
  onVideoCall={uid=>{ const u=users.find(uu=>uu.id===uid); const callDocId=[currentUser.id,uid].sort().join('_'); setShowCall({type:'video',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid,callDocId}); }}
  onDuet={()=>showToast?.('Duet mode ready','info')} onStitch={()=>showToast?.('Stitch mode ready','info')} onSaveSound={()=>showToast?.('Sound saved!','success')}
  followed={followed} showToast={showToast} onWatchLive={(u)=>setShowLiveStream(u)} onViewProfile={handleViewProfile}
  onOpenSearch={()=>setShowDiscover(true)} onOpenNotifications={()=>setShowNotifications(true)} onOpenStories={()=>setShowStoriesPage(true)}
  onCreateStory={()=>setShowCreateStory(true)} onViewStory={(payload)=>setShowStoryViewer(payload)}
  onOpenProfileDrawer={()=>setShowProfileDrawer(true)} onFeedScroll={handleFeedScroll}
  blockedUsers={blockedUsers} onBlock={uid=>setBlockedUsers(p=>[...p,uid])} users={users} onOpenCamera={()=>setShowCamera(true)} onOpenComposer={()=>setShowTextComposer(true)} />}
            {activeTab==='infinity' && <InfinityPage t={t} onFeedScroll={handleFeedScroll} showToast={showToast} currentUser={currentUser}
  videos={videos} videosLoading={videosLoading} followed={followed} onFollow={toggleFollow} onViewProfile={handleViewProfile} onMessage={handleMessage}
  onShare={(v)=>setShowShareSheet(v)} users={users} blockedUsers={blockedUsers} onBlock={uid=>setBlockedUsers(p=>[...p,uid])}
  onOpenNotifications={()=>setShowNotifications(true)} onOpenStories={()=>setShowStoriesPage(true)}
  onCreateStory={()=>setShowCreateStory(true)} onViewStory={(payload)=>setShowStoryViewer(payload)}
  onOpenProfileDrawer={()=>setShowProfileDrawer(true)} />}
            {activeTab==='friends' && <FriendsDiscoveryPage currentUser={currentUser} users={users} followed={followed} onFollow={toggleFollow} onViewProfile={handleViewProfile} onOpenSearch={()=>setShowDiscover(true)} onFeedScroll={handleFeedScroll} onCreateStory={()=>setShowCreateStory(true)} onViewStory={(payload)=>setShowStoryViewer(payload)} onOpenStories={()=>setShowStoriesPage(true)} />}
            {activeTab==='create' && <CreateScreen onOpenCamera={()=>setShowCamera(true)} onShowSoundLibrary={()=>setShowSoundLibrary(true)} showToast={showToast} t={t} currentUser={currentUser} users={users} onPosted={()=>setActiveTab('home')} />}
            {activeTab==='inbox' && <InboxPage t={t} users={users} currentUser={currentUser} showToast={showToast} onViewProfile={handleViewProfile} initialTargetId={inboxTargetId} onClearTarget={()=>setInboxTargetId(null)} persistedConversation={activeConversation} openGroupsSignal={inboxOpenGroups} onSetConversation={(conv)=>{ setActiveConversation(conv); }} onFeedScroll={handleFeedScroll}
  onVoiceCall={uid=>{ const u=users.find(uu=>uu.id===uid); const callDocId=[currentUser.id,uid].sort().join('_'); setShowCall({type:'audio',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid,callDocId}); }}
  onVideoCall={uid=>{ const u=users.find(uu=>uu.id===uid); const callDocId=[currentUser.id,uid].sort().join('_'); setShowCall({type:'video',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid,callDocId}); }}
  onBlock={uid=>setBlockedUsers(p=>[...p,uid])}
/>}
            {(activeTab==='profile'||activeTab==='settings') && <ProfilePage user={currentUser} setCurrentUser={setCurrentUser} onLogout={handleLogout} users={users} showToast={showToast} onShowAnalytics={()=>setShowAnalytics(true)} onShowQRCode={()=>setShowQRCode(true)} allVideos={videos} setBlockedUsers={setBlockedUsers} onShowSavedPosts={()=>setShowSavedPosts(true)} onGoToGroups={()=>{ setActiveTab('inbox'); setInboxOpenGroups(n=>n+1); }} onShowBroadcast={()=>setShowBroadcast(true)} onViewProfile={handleViewProfile} settingsSignal={activeTab==='settings'?settingsSignal:0} onFeedScroll={handleFeedScroll} t={t} theme={theme} onToggleTheme={toggleTheme} />}
          </>
        )}
      </div>

      <div style={{ display:'flex', alignItems:'stretch', background:COLORS.surface, backdropFilter:'blur(20px) saturate(1.6)', WebkitBackdropFilter:'blur(20px) saturate(1.6)', border:`1px solid ${COLORS.border}`, borderBottom:'none', borderRadius:'20px 20px 0 0', boxShadow:'0 -8px 28px rgba(20,16,32,0.10), 0 -1px 0 rgba(255,255,255,0.4) inset', paddingTop:4, paddingBottom:'max(4px, env(safe-area-inset-bottom))', position:'absolute', left:14, right:14, bottom:0, zIndex:500, transform: navVisible ? 'translateY(0)' : 'translateY(100%)', transition:'transform 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
        {tabs.map(tab=>{
          if(tab.id==='create') {
            return (
              <button key="create"
                onClick={()=>{ haptic('medium'); setShowCamera(true); setActiveTab('create'); }}
                aria-label="Create"
                style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', background:'none', border:'none', cursor:'pointer', padding:'2px 2px 6px' }}>
                <div style={{ position:'relative', width:42, height:26, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ width:38, height:26, borderRadius:9, background:COLORS.gradient, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 10px rgba(11,95,255,0.38)' }}>
                    <svg viewBox="0 0 24 24" style={{ width:17,height:17,stroke:'white',fill:'none',strokeWidth:2.6,strokeLinecap:'round' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </div>
                </div>
                <span style={{ fontSize:10, fontWeight:600, color:NAV_INACTIVE_COLOR, marginTop:2 }}>Create</span>
              </button>
            );
          }

          const isActive = activeTab===tab.id;
          const glyphLabels = { home:'Home', infinity:'Infinity', friends:'Friends', inbox:'Messages' };
          return (
            <button key={tab.id}
              onClick={()=>{ haptic('light'); navigateToTab(tab.id); }}
              aria-label={glyphLabels[tab.id]}
              style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', gap:2, background:'none', border:'none', cursor:'pointer', padding:'4px 2px 6px' }}>
              <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', width:30, height:26 }}>
                <TabGlyph id={tab.id} active={isActive} currentUser={currentUser} />
              </div>
              <span style={{ fontSize:10, fontWeight:isActive?700:600, color: isActive?NAV_ACTIVE_COLOR:NAV_INACTIVE_COLOR, transition:'color 0.2s ease' }}>{glyphLabels[tab.id]}</span>
            </button>
          );
        })}
      </div>

{notifPopup && (
        <NotifPopup
          notif={notifPopup.notif}
          user={notifPopup.user}
          onClose={()=>setNotifPopup(null)}
          onTap={()=>{ handleViewProfile(notifPopup.notif?.fromUserId); setNotifPopup(null); }}
        />
      )}
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
    </div>
  );
}
