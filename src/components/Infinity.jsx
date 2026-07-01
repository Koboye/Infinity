// DaguV3.jsx — FULLY REAL: Firebase Auth + Firestore + Cloudinary + EmailJS
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, increment, serverTimestamp, arrayUnion, arrayRemove, limit, startAfter } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

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
let messaging = null;
try { messaging = getMessaging(app); } catch(e) { console.log('Messaging not supported:', e); }
const VAPID_KEY = 'BHfW8XbTCAHaG6K4QN5qWiQGsfNFrqrjp2Mf_agxVxnk83OG9X7neXfDkgLovMdOKEwkXgaw2t65_HqcLywlbAo';
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/* ─────────────── CLOUDINARY CONFIG ─────────────── */
const CLOUDINARY_CLOUD = 'dotvhzjmc';
const CLOUDINARY_PRESET = 'g3c7dwdg';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/upload`;
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
const SUPPORT_EMAIL = 'getachewshambel11@gmail.com';
// App creator UID — only this user can grant posting permissions for Jobs & Market
const APP_CREATOR_UID = 'REPLACE_WITH_CREATOR_UID'; // Set this to the actual Firebase UID of the app creator

/* ─────────────── CONSTANTS ─────────────── */
const LOGIN_METHODS = [
  { id: 'google', name: 'Google', icon: '🌐', color: '#4285f4' },
  { id: 'email', name: 'Email', icon: '📧', color: '#FF2156' },
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
  { id: 'jobs', label: 'Jobs' },
  { id: 'skills', label: 'Market' },
];

// Keywords/patterns that frequently indicate a fake or scammy Jobs/Market post.
// Posts matching these get auto-flagged as "pending review" for the creator,
// while normal posts from permitted users go live immediately.
const FAKE_POST_PATTERNS = [
  /work\s*from\s*home.*(\$|usd|etb)?\s*\d{3,}.*(day|hour|week)/i,
  /send\s+(money|payment|deposit|registration\s*fee)/i,
  /no\s+experience.*(guarantee|guaranteed).*(income|money|salary)/i,
  /telegram.*(only|contact).*(\+?\d{6,})/i,
  /click\s+(this|the)\s+link/i,
  /western\s*union|moneygram|crypto\s*wallet|bitcoin\s*wallet/i,
  /100%\s*(guarantee|free\s*money)/i,
];

const isLikelyFakePost = (item) => {
  const text = `${item.title||''} ${item.description||''} ${item.company||''}`;
  return FAKE_POST_PATTERNS.some(re => re.test(text));
};


const EMOJI_LIST = ['😀','😂','😍','🥰','😎','🤔','😭','😱','🔥','❤️','👍','🎉','✨','💯','🙌','👏','🤝','💪','🎵','📸'];
const TRANSLATIONS = {
  en: { home:'For You', friends:'Friends', inbox:'Messages', profile:'Profile', create:'Create', foryou:'For You', skills:'Skills', jobs:'Jobs', post:'Post', cancel:'Cancel', save:'Save', follow:'+ Follow', unfollow:'Following', message:'Message', settings:'Settings', logout:'Log Out', editProfile:'Edit Profile', search:'Search anything...', noVideos:'No videos yet. Be the first to post!', addComment:'Add a comment...', noMessages:'No messages yet', startChat:'Go to a profile and tap Message to start', notifications:'Notifications', markRead:'Mark all read', wallet:'Wallet', analytics:'Analytics', badges:'Badges', premium:'Premium', live:'Go Live', report:'Report', block:'Block', duet:'Duet', stitch:'Stitch', voiceCall:'Voice Call', videoCall:'Video Call', pinned:'Pinned', reply:'Reply', pin:'Pin', retake:'Retake', newPost:'New Post', sounds:'Sounds', close:'Close', back:'Back', comments:'Comments' },
am: { home:'ለእርስዎ', friends:'ጓደኞች', inbox:'መልዕክቶች', profile:'መገለጫ', create:'ፍጠር', foryou:'ለእርስዎ', skills:'ችሎታዎች', jobs:'ስራዎች', post:'ለጥፍ', cancel:'ሰርዝ', save:'አስቀምጥ', follow:'+ ተከተል', unfollow:'እየተከተሉ ነው', message:'መልዕክት', settings:'ቅንብሮች', logout:'ውጣ', editProfile:'መገለጫ አርትዕ', search:'ፈልግ...', noVideos:'ምንም ቪዲዮ የለም።', addComment:'አስተያየት ጨምር...', noMessages:'ምንም መልዕክቶች የሉም', startChat:'ወደ መገለጫ ሂድ እና መልዕክት ላክ', notifications:'ማሳወቂያዎች', markRead:'ሁሉንም እንደተነበበ ምልክት አድርግ', wallet:'ቦርሳ', analytics:'ትንተና', badges:'ሽልማቶች', premium:'ፕሪሚየም', live:'ቀጥታ', report:'ሪፖርት', block:'አግድ', duet:'ዱዌት', stitch:'ስቲች', voiceCall:'የድምፅ ጥሪ', videoCall:'ቪዲዮ ጥሪ', pinned:'ተሰክቷል', reply:'መልስ', pin:'ስክ', retake:'እንደገና', newPost:'አዲስ ለጥፍ', sounds:'ድምፆች', close:'ዝጋ', back:'ተመለስ', comments:'አስተያየቶች', posts:'ልጥፎች', followers:'ተከታዮች', following:'እየተከተሉ', language:'ቋንቋ', privacy:'ግላዊነት', wallet:'ቦርሳ', deposit:'ጨምር', withdraw:'አውጣ', convert:'ቀይር', transactions:'ግብይቶች', noTransactions:'ምንም ግብይቶች የሉም', coins:'ሳንቲሞች', cash:'ገንዘብ', openCamera:'ካሜራ ክፈት', uploadGallery:'ከጋለሪ ጫን', writeText:'ጽሁፍ ጻፍ', recordAudio:'ድምፅ ቅዳ', addSound:'ድምፅ ጨምር', createShare:'ፍጠር እና አጋራ', expressYourself:'እራስህን ግለፅ', noPosts:'ምንም ልጥፍ የለም', noSaved:'ምንም አልተቀመጠም', noDrafts:'ምንም ረቂቆች የሉም', createFirst:'የመጀመሪያ ቪዲዮህን ፍጠር!', online:'ኦንላይን', offline:'ኦፍላይን', typing:'እየተየፉ ነው...', startConvo:'ወግ ጀምር! 👋', verified:'የተረጋገጠ', trending:'አዝማሚያ', noResults:'ምንም ውጤት የለም', shareProfile:'መገለጫ አጋራ', scanToFollow:'ለመከተል ቅዱ', weeklyViews:'ሳምንታዊ እይታዎች', topVideos:'ምርጥ ቪዲዮዎች', totalViews:'ጠቅላላ እይታዎች', totalLikes:'ጠቅላላ ወደዶዎች', editProfile:'መገለጫ አርትዕ', changePassword:'የይለፍ ቃል ቀይር', emailPhone:'ኢሜይል እና ስልክ', switchAccount:'አካውንት ቀይር', blockedUsers:'የታገዱ ተጠቃሚዎች', helpCenter:'የእርዳታ ማዕከል', reportProblem:'ችግር ሪፖርት አድርግ', termsOfService:'የአገልግሎት ውሎች', privacyPolicy:'የግላዊነት ፖሊሲ', resetAccount:'አካውንት ዳግም አስጀምር', deleteAccount:'አካውንት ሰርዝ', logOut:'ውጣ', version:'ስሪት', madeWith:'ተሰርቷል', noNotifications:'ምንም ማሳወቂያዎች የሉም', markAllRead:'ሁሉንም እንደተነበበ ምልክት አድርግ' },  ar: { home:'لك', friends:'أصدقاء', inbox:'رسائل', profile:'الملف', create:'إنشاء', foryou:'لك', skills:'مهارات', jobs:'وظائف', post:'نشر', cancel:'إلغاء', save:'حفظ', follow:'+ متابعة', unfollow:'تتابع', message:'رسالة', settings:'الإعدادات', logout:'تسجيل الخروج', editProfile:'تعديل الملف', search:'ابحث...', noVideos:'لا توجد مقاطع بعد.', addComment:'أضف تعليقاً...', noMessages:'لا رسائل بعد', startChat:'اذهب إلى ملف وأرسل رسالة', notifications:'الإشعارات', markRead:'تعليم الكل كمقروء', wallet:'المحفظة', analytics:'التحليلات', badges:'الشارات', premium:'مميز', live:'بث مباشر', report:'إبلاغ', block:'حظر', duet:'ثنائي', stitch:'خياطة', voiceCall:'مكالمة صوتية', videoCall:'مكالمة فيديو', pinned:'مثبت', reply:'رد', pin:'تثبيت', retake:'إعادة', newPost:'منشور جديد', sounds:'أصوات', close:'إغلاق', back:'رجوع', comments:'تعليقات' },
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
  '#dagu', '#infinity', '#trending', '#viral', '#fyp', '#ethiopia', '#addisababa',
  '#africa', '#music', '#dance', '#comedy', '#fashion', '#food', '#travel', '#tech',
];

const SUPPORTED_LANGUAGES = [
  ['English','en'],['አማርኛ','am'],['العربية','ar'],['Français','fr'],['Español','es'],
  ['Português','pt'],['हिन्दी','hi'],['中文','zh'],['Kiswahili','sw'],['Deutsch','de'],
  ['Русский','ru'],['Türkçe','tr'],['日本語','ja'],['한국어','ko'],['Italiano','it'],
];

const REPORT_REASONS = [
  'Spam or misleading','Inappropriate content','Hate speech or harassment',
  'Violence or dangerous acts','Misinformation','Intellectual property violation',
  'Nudity or sexual content','Suicide or self-harm','Impersonation','Other',
];

const BADGE_DEFINITIONS = [
  { id:'pioneer', icon:'🌟', name:'Pioneer', desc:'One of the first 1000 users' },
  { id:'creator', icon:'🎬', name:'Creator', desc:'Posted 10+ videos' },
  { id:'popular', icon:'🔥', name:'Trending', desc:'A video got 10K+ views' },
  { id:'social', icon:'🤝', name:'Social Butterfly', desc:'100+ followers' },
  { id:'verified', icon:'✅', name:'Verified', desc:'Identity verified' },
  { id:'premium', icon:'💎', name:'Premium', desc:'Premium subscriber' },
  { id:'streaker', icon:'⚡', name:'Streaker', desc:'7-day posting streak' },
  { id:'whale', icon:'🐋', name:'Whale', desc:'Spent 10,000+ coins' },
];

const STICKER_PACKS = [
  { id:'fun', name:'Fun', stickers:['😂','🤣','😎','🥳','🎉','🎊','✨','🔥','💯','👏'] },
  { id:'love', name:'Love', stickers:['❤️','🥰','😍','💕','💖','💗','💘','💝','😘','🫶'] },
  { id:'reactions', name:'Reactions', stickers:['👍','👎','😮','😡','😢','😱','🙌','🫡','💪','🤔'] },
  { id:'food', name:'Food', stickers:['🍕','🍔','🍟','🌮','🍜','🍣','🍦','🎂','☕','🧋'] },
];

/* ─────────────── POLL COMPONENT (v4 — like Instagram/Telegram polls) ─────────────── */
const PollWidget = ({ poll, currentUser, videoId, showToast }) => {
  const [voted, setVoted] = useState(null);
  const [localVotes, setLocalVotes] = useState(poll?.votes || {});
  const totalVotes = Object.values(localVotes).reduce((s, v) => s + (v || 0), 0);

  const handleVote = async (optionIdx) => {
    if (voted !== null) return;
    setVoted(optionIdx);
    const newVotes = { ...localVotes, [optionIdx]: (localVotes[optionIdx] || 0) + 1 };
    setLocalVotes(newVotes);
    try {
      await updateDoc(doc(db, 'videos', videoId), {
        [`poll.votes.${optionIdx}`]: increment(1),
        [`poll.voters.${currentUser?.id}`]: optionIdx
      });
    } catch (e) { console.log('Poll vote error:', e); }
    showToast?.('Vote counted! 🗳️', 'success');
  };

  if (!poll?.options) return null;
  return (
    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 14, marginTop: 8 }}>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>📊 Poll</div>
      <div style={{ color: 'white', fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{poll.question}</div>
      {poll.options.map((opt, i) => {
        const pct = totalVotes > 0 ? Math.round(((localVotes[i] || 0) / totalVotes) * 100) : 0;
        return (
          <div key={i} onClick={() => handleVote(i)} style={{ marginBottom: 8, cursor: voted === null ? 'pointer' : 'default' }}>
            <div style={{ position: 'relative', background: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden', border: voted === i ? '1.5px solid #FF2156' : '1.5px solid rgba(255,255,255,0.1)' }}>
              {voted !== null && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: voted === i ? 'rgba(255,45,85,0.25)' : 'rgba(255,255,255,0.06)', transition: 'width 0.4s ease' }} />}
              <div style={{ position: 'relative', padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'white', fontSize: 13 }}>{opt}</span>
                {voted !== null && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700 }}>{pct}%</span>}
              </div>
            </div>
          </div>
        );
      })}
      {voted !== null && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>{totalVotes} votes</div>}
    </div>
  );
};

/* ─────────────── BOOKMARK / SAVE BUTTON (v4) ─────────────── */
const BookmarkButton = ({ videoId, currentUser, showToast }) => {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!currentUser?.id) return;
    getDoc(doc(db, 'saves', `${videoId}_${currentUser.id}`)).then(d => setSaved(d.exists())).catch(() => {});
  }, [videoId, currentUser?.id]);

  const toggle = async (e) => {
    e.stopPropagation();
    if (saved) {
      await deleteDoc(doc(db, 'saves', `${videoId}_${currentUser.id}`));
      setSaved(false);
      showToast?.('Removed from saved', 'info');
    } else {
      await setDoc(doc(db, 'saves', `${videoId}_${currentUser.id}`), { videoId, userId: currentUser.id, createdAt: serverTimestamp() });
      setSaved(true);
      showToast?.('Saved to collection ✨', 'success');
    }
  };

  return (
    <button onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill={saved ? '#FFD60A' : 'none'} stroke={saved ? '#FFD60A' : 'white'} strokeWidth="2">
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
      </svg>
      <span style={{ color: saved ? '#FFD60A' : 'rgba(255,255,255,0.6)', fontSize: 11 }}>Save</span>
    </button>
  );
};

/* ─────────────── SHARE SHEET (v4 — like TikTok/WhatsApp share) ─────────────── */
const ShareSheet = ({ video, currentUser, onClose, showToast }) => {
  const shareUrl = `https://infinity-now.vercel.app/video/${video?.id}`;
  const options = [
    { icon: '📋', label: 'Copy Link', action: async () => { try { await navigator.clipboard.writeText(shareUrl); showToast?.('Link copied!', 'success'); } catch { showToast?.('Copy failed', 'error'); } onClose(); } },
    { icon: '📲', label: 'Share', action: async () => { try { await navigator.share({ title: `@${video?.username} on Infinity`, text: video?.description, url: shareUrl }); } catch {} onClose(); } },
    { icon: '💬', label: 'Send in Chat', action: () => { showToast?.('Open Messages tab to share', 'info'); onClose(); } },
    { icon: '📸', label: 'Add to Story', action: () => { showToast?.('Open Create to add to story', 'info'); onClose(); } },
    { icon: '🔗', label: 'WhatsApp', action: () => { window.open(`https://wa.me/?text=${encodeURIComponent(video?.description + ' ' + shareUrl)}`); onClose(); } },
    { icon: '✈️', label: 'Telegram', action: () => { window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(video?.description||'')}`); onClose(); } },
    { icon: '🐦', label: 'X (Twitter)', action: () => { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent((video?.description||'') + ' ' + shareUrl)}`); onClose(); } },
  ];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#15151C', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: '20px 16px max(34px, env(safe-area-inset-bottom))', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto 20px' }} />
        <div style={{ color: 'white', fontWeight: 800, fontSize: 17, marginBottom: 18 }}>Share</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
          {options.map(opt => (
            <button key={opt.label} onClick={opt.action} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
              <span style={{ fontSize: 26 }}>{opt.icon}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 600, textAlign: 'center' }}>{opt.label}</span>
            </button>
          ))}
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
          <button key={pack.id} onClick={() => setActivePack(i)} style={{ background: i === activePack ? 'rgba(255,45,85,0.2)' : 'transparent', border: i === activePack ? '1px solid rgba(255,45,85,0.4)' : '1px solid transparent', borderRadius: 20, padding: '4px 12px', color: i === activePack ? '#FF2156' : 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
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
      <button key={tag} onClick={() => onSearch?.(tag)} style={{ background: 'rgba(255,45,85,0.1)', border: '1px solid rgba(255,45,85,0.2)', borderRadius: 20, padding: '6px 14px', color: '#FF2156', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
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
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
    const avatarColor = `hsl(${Math.floor(Math.random() * 360)},70%,60%)`;
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
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0B0B0F' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.02)' }}>
          <button onClick={() => setActiveGroup(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 18 }}>←</button>
          <div onClick={()=>setShowGroupInfo(true)} style={{ display:'flex', alignItems:'center', gap:10, flex:1, cursor:'pointer' }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: activeGroup.avatarColor || '#FF2156', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 16 }}>{activeGroup.avatar || '👥'}</div>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{activeGroup.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{(activeGroup.members || []).length} members · tap for info</div>
            </div>
          </div>
          <button onClick={()=>setGroupCallOpen('audio')} style={{ background:'rgba(52,199,89,0.15)', border:'1px solid rgba(52,199,89,0.25)', borderRadius:'50%', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2ED573" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-5.99-5.99 19.79 19.79 0 01-3.07-8.67A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
          </button>
          <button onClick={()=>setGroupCallOpen('video')} style={{ background:'rgba(175,82,222,0.15)', border:'1px solid rgba(175,82,222,0.25)', borderRadius:'50%', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9D4EDD" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          </button>
        </div>
        {/* Group Info Panel */}
        {showGroupInfo && (
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.85)', zIndex:50, display:'flex', alignItems:'flex-end' }} onClick={()=>setShowGroupInfo(false)}>
            <div onClick={e=>e.stopPropagation()} style={{ width:'100%', background:'#15151C', borderTopLeftRadius:28, borderTopRightRadius:28, padding:'20px 20px 40px', maxHeight:'70%', overflowY:'auto' }}>
              <div style={{ width:36, height:4, background:'rgba(255,255,255,0.12)', borderRadius:2, margin:'0 auto 20px' }} />
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
                <div style={{ width:52, height:52, borderRadius:'50%', background:activeGroup.avatarColor||'#FF2156', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:22 }}>{activeGroup.avatar||'👥'}</div>
                <div>
                  <div style={{ color:'white', fontWeight:800, fontSize:18 }}>{activeGroup.name}</div>
                  <div style={{ color:'rgba(255,255,255,0.4)', fontSize:12 }}>Created by group admin</div>
                </div>
              </div>
              <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Members ({groupMembers.length})</div>
              {groupMembers.map(u=>(
                <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ width:44, height:44, borderRadius:'50%', background:u.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:18, overflow:'hidden', flexShrink:0 }}>
                    {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : u.avatar}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:'white', fontSize:14, fontWeight:700, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                      @{u.username}
                      {u.id===currentUser?.id && <span style={{ color:'#2ED573', fontSize:10 }}>You</span>}
                      {activeGroup.admin===u.id && <span style={{ background:'rgba(255,204,0,0.15)', border:'1px solid rgba(255,204,0,0.3)', borderRadius:10, padding:'1px 7px', color:'#FFD60A', fontSize:9, fontWeight:800 }}>ADMIN</span>}
                    </div>
                    {u.bio && <div style={{ color:'rgba(255,255,255,0.4)', fontSize:11, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.bio}</div>}
                    <div style={{ color:'rgba(255,255,255,0.25)', fontSize:10, marginTop:1 }}>{u.followers?.length||0} followers</div>
                  </div>
                  {currentUser?.id===activeGroup?.admin && u.id!==currentUser?.id && (
                    <button onClick={e=>{e.stopPropagation(); const nm=(activeGroup.members||[]).filter(id=>id!==u.id); updateDoc(doc(db,'groups',activeGroup.id),{members:nm}).then(()=>{setActiveGroup(g=>({...g,members:nm})); showToast?.('Member removed','info');}).catch(()=>{});}} style={{ background:'rgba(255,59,48,0.1)', border:'1px solid rgba(255,59,48,0.2)', borderRadius:10, padding:'5px 10px', color:'#FF453A', fontSize:11, cursor:'pointer', flexShrink:0 }}>Remove</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Group Call Overlay */}
        {groupCallOpen && (
          <div style={{ position:'absolute', inset:0, background:'#0B0B0F', zIndex:60, display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'20px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color:'white', fontWeight:800, fontSize:18 }}>{groupCallOpen==='video'?'📹':'📞'} Group {groupCallOpen==='video'?'Video':'Voice'} Call</div>
              <button onClick={()=>setGroupCallOpen(null)} style={{ background:'rgba(255,45,85,0.15)', border:'1px solid rgba(255,45,85,0.3)', borderRadius:'50%', width:36, height:36, color:'#FF2156', cursor:'pointer', fontSize:18 }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexWrap:'wrap', gap:12, alignContent:'flex-start', justifyContent:'center' }}>
              {groupMembers.map(u=>(
                <div key={u.id} style={{ width:'calc(50% - 6px)', background:'rgba(255,255,255,0.06)', borderRadius:20, padding:'18px 12px', display:'flex', flexDirection:'column', alignItems:'center', gap:8, border:'1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ width:56, height:56, borderRadius:'50%', background:u.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:22, overflow:'hidden', border:'2px solid rgba(52,199,89,0.4)' }}>
                    {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : u.avatar}
                  </div>
                  <div style={{ color:'white', fontSize:12, fontWeight:700 }}>@{u.username}</div>
                  {u.id===currentUser?.id && <div style={{ color:'#2ED573', fontSize:10 }}>You</div>}
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#2ED573', animation:'pulse 1.5s ease infinite' }} />
                </div>
              ))}
            </div>
            <div style={{ padding:'16px 20px 32px', display:'flex', justifyContent:'center', gap:20, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={()=>showToast?.('Muted','info')} style={{ width:56, height:56, borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'none', color:'white', fontSize:22, cursor:'pointer' }}>🎤</button>
              {groupCallOpen==='video' && <button onClick={()=>showToast?.('Camera toggled','info')} style={{ width:56, height:56, borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'none', color:'white', fontSize:22, cursor:'pointer' }}>📷</button>}
              <button onClick={()=>setGroupCallOpen(null)} style={{ width:56, height:56, borderRadius:'50%', background:'#FF2156', border:'none', color:'white', fontSize:22, cursor:'pointer' }}>📵</button>
            </div>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
          {groupMessages.map(msg => {
            const isMine = msg.senderId === currentUser.id;
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                {!isMine && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: msg.senderAvatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 'bold', marginRight: 8, flexShrink: 0, overflow: 'hidden' }}>
                    {msg.senderAvatarUrl ? <img src={msg.senderAvatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : msg.senderAvatar}
                  </div>
                )}
                <div style={{ maxWidth: '72%' }}>
                  {!isMine && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginBottom: 3 }}>@{msg.senderName}</div>}
                  <div style={{ background: isMine ? 'linear-gradient(135deg,#FF2156,#9D4EDD)' : 'rgba(255,255,255,0.09)', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', color: 'white', fontSize: 14 }}>
                    {msg.text}
                    {!isMine && <MessageTranslate text={msg.text} targetLang={currentUser?.language || 'en'} isMine={isMine} />}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8 }}>
          <input value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendGroupMsg()} placeholder="Message group..." style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: '11px 16px', color: 'white', outline: 'none', fontSize: 13 }} />
          <button onClick={sendGroupMsg} style={{ background: 'linear-gradient(135deg,#FF2156,#9D4EDD)', border: 'none', borderRadius: '50%', width: 42, height: 42, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    );
  }

  if (showCreate) return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0B0B0F', padding: 16 }}>
      <button onClick={() => setShowCreate(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 20, padding: '8px 16px', color: 'white', cursor: 'pointer', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>← Back</button>
      <div style={{ color: 'white', fontWeight: 800, fontSize: 22, marginBottom: 20 }}>New Group</div>
      <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '13px 16px', color: 'white', outline: 'none', fontSize: 14, boxSizing: 'border-box', marginBottom: 16 }} />
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 10, fontWeight: 600, textTransform: 'uppercase' }}>Add Members</div>
      {users.filter(u => u.id !== currentUser?.id).map(u => (
        <div key={u.id} onClick={() => setSelectedMembers(p => p.includes(u.id) ? p.filter(id => id !== u.id) : [...p, u.id])} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 16, overflow: 'hidden', flexShrink: 0 }}>
            {u.avatarUrl ? <img src={u.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : u.avatar}
          </div>
          <div style={{ flex: 1 }}><div style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>@{u.username}</div></div>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: selectedMembers.includes(u.id) ? '#FF2156' : 'rgba(255,255,255,0.1)', border: selectedMembers.includes(u.id) ? 'none' : '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
            {selectedMembers.includes(u.id) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
          </div>
        </div>
      ))}
      <button onClick={createGroup} style={{ width: '100%', background: 'linear-gradient(135deg,#FF2156,#9D4EDD)', border: 'none', borderRadius: 24, padding: 15, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 15, marginTop: 20 }}>Create Group ({selectedMembers.length} members)</button>
    </div>
  );

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0B0B0F' }}>
      <div style={{ padding: '16px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 18 }}>←</button>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>Groups</div>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ background: 'linear-gradient(135deg,#FF2156,#9D4EDD)', border: 'none', borderRadius: 20, padding: '8px 16px', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ New</button>
      </div>
      <div style={{ padding: 12 }}>
        {groups.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.2)' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>No groups yet</div>
            <div style={{ fontSize: 12 }}>Create a group to chat with multiple friends</div>
          </div>
        )}
        {groups.map(g => (
          <div key={g.id} onClick={() => setActiveGroup(g)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 18, marginBottom: 8, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: g.avatarColor || '#FF2156', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 20, flexShrink: 0 }}>{g.avatar || '👥'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>{g.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>{g.lastMessage || 'No messages yet'} · {(g.members || []).length} members</div>
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
    const q = query(collection(db, 'saves'), where('userId', '==', currentUser.id), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, async snap => {
      const items = await Promise.all(snap.docs.map(async d => {
        const vDoc = await getDoc(doc(db, 'videos', d.data().videoId)).catch(() => null);
        return vDoc?.exists() ? { id: vDoc.id, ...vDoc.data() } : null;
      }));
      setSaved(items.filter(Boolean));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [currentUser?.id]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0B0B0F', zIndex: 300, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ color: 'white', fontWeight: 800, fontSize: 20 }}>Saved</div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {loading && <div style={{ textAlign: 'center', padding: 40 }}><div style={{ width: 28, height: 28, border: '3px solid rgba(255,45,85,0.3)', borderTop: '3px solid #FF2156', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} /></div>}
        {!loading && saved.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.25)' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🔖</div>
            <div style={{ fontSize: 14 }}>No saved posts yet</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Tap the bookmark icon on any post to save it</div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
          {saved.map(v => (
            <div key={v.id} style={{ aspectRatio: '9/16', position: 'relative', overflow: 'hidden', borderRadius: 8, background: '#24242E' }}>
              {v.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i) || v.mediaType?.startsWith('image')
                ? <img src={v.videoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <video src={v.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />}
              <div style={{ position: 'absolute', bottom: 4, left: 4, color: 'white', fontSize: 10, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>{v.likes || 0} ❤️</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─────────────── MESSAGE TRANSLATOR BUTTON (v4 — like Telegram live translate) ─────────────── */
const TranslateButton = ({ text, targetLang, onTranslated }) => {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  if (!text || text.length < 5 || targetLang === 'en') return null;
  const handle = async () => {
    setLoading(true);
    const result = await liveTranslate(text, targetLang);
    onTranslated(result);
    setLoading(false);
    setDone(true);
  };
  if (done) return null;
  return (
    <button onClick={handle} disabled={loading} style={{ background: 'rgba(0,122,255,0.12)', border: '1px solid rgba(0,122,255,0.25)', borderRadius: 12, padding: '3px 10px', color: '#0A84FF', fontSize: 11, cursor: 'pointer', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
      {loading ? '...' : '🌐 Translate'}
    </button>
  );
};

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
  const [bgColor, setBgColor] = useState('#FF2156');
  const [posting, setPosting] = useState(false);
  const colors = ['#FF2156','#9D4EDD','#0A84FF','#FFB100','#2ED573','#00A9D6','#FF453A'];

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
    <div style={{ position: 'fixed', inset: 0, background: '#0B0B0F', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 24, display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Infinity..." autoFocus style={{ flex: 1, background: 'none', border: 'none', color: 'white', outline: 'none', fontSize: 14 }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 16 }}>✕</button>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14, padding: 4 }}>Cancel</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {filters.map(([id, label]) => (
            <button key={id} onClick={() => setActiveFilter(id)} style={{ background: activeFilter === id ? 'rgba(255,45,85,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${activeFilter === id ? 'rgba(255,45,85,0.4)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 20, padding: '6px 14px', color: activeFilter === id ? '#FF2156' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: activeFilter === id ? 700 : 400, cursor: 'pointer' }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {!search && (
          <>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Trending</div>
            <TrendingHashtags onSearch={t => setSearch(t)} />
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '20px 0 10px' }}>Suggested Creators</div>
            {users.slice(0, 6).map(u => (
              <div key={u.id} onClick={() => { onViewProfile?.(u.id); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 18, overflow: 'hidden', flexShrink: 0 }}>
                  {u.avatarUrl ? <img src={u.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : u.avatar}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>@{u.username}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{formatNumber(u.followers?.length || 0)} followers</div>
                </div>
              </div>
            ))}
          </>
        )}
        {search && filteredUsers.length > 0 && (
          <>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>People</div>
            {filteredUsers.map(u => (
              <div key={u.id} onClick={() => { onViewProfile?.(u.id); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 18, overflow: 'hidden', flexShrink: 0 }}>
                  {u.avatarUrl ? <img src={u.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : u.avatar}
                </div>
                <div>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>@{u.username}</div>
                  {u.verified && <span style={{ color: '#2F9BFF', fontSize: 11 }}>✓ Verified</span>}
                </div>
              </div>
            ))}
          </>
        )}
        {search && filteredTags.length > 0 && (activeFilter === 'all' || activeFilter === 'hashtag') && (
          <>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '16px 0 10px' }}>Hashtags</div>
            {filteredTags.map(tag => (
              <div key={tag} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 14, marginBottom: 6, cursor: 'pointer', color: '#FF2156', fontWeight: 700, fontSize: 14 }}>{tag}</div>
            ))}
          </>
        )}
        {search && (activeFilter === 'all' || activeFilter === 'video') && filteredVideos.length > 0 && (
          <>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '16px 0 10px' }}>Videos</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {filteredVideos.slice(0, 8).map(v => (
                <div key={v.id} style={{ aspectRatio: '9/16', position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#24242E' }}>
                  {v.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i) || v.mediaType?.startsWith('image')
                    ? <img src={v.videoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <video src={v.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent,rgba(0,0,0,0.7))', padding: '20px 8px 8px' }}>
                    <div style={{ color: 'white', fontSize: 11, fontWeight: 600 }}>@{v.username}</div>
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

/* ─────────────── DARK/LIGHT MODE TOGGLE HOOK (v4) ─────────────── */
const useTheme = (user) => {
  const [theme, setTheme] = useState(user?.theme || 'dark');
  const toggleTheme = async (newTheme) => {
    setTheme(newTheme);
    if (user?.id) {
      await updateDoc(doc(db, 'users', user.id), { theme: newTheme }).catch(() => {});
    }
  };
  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#0B0B0F' : '#f5f5f7',
    surface: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
    text: isDark ? '#ffffff' : '#1C1C24',
    subtext: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
    border: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
    card: isDark ? '#15151C' : '#ffffff',
  };
  return { theme, toggleTheme, isDark, colors };
};

/* ─────────────── SEND NOTIFICATION HELPER (v4 — already defined below, re-export alias) ─────────────── */
const sendNotification = async (toUserId, fromUserId, type, message, extra = {}) => {
  if (!toUserId || toUserId === fromUserId) return;
  try {
    await addDoc(collection(db, 'notifications'), {
      toUserId, fromUserId, type, message,
      read: false, createdAt: serverTimestamp(), ...extra,
    });
  } catch (e) { console.log('Notification error:', e); }
};

const formatNumber = (num) => {
  const n = Number(num) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
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
// Shared defaults for a brand-new user profile. Used by createUserProfile (Firestore)
// and by the local/in-memory fallback profiles used when a Firestore write hasn't
// propagated yet. Keeping this in one place avoids the 3-way drift that existed
// between createUserProfile and the two inline fallback objects in <AuthScreen>
// and the onAuthStateChanged handler.
const buildDefaultProfile = (uid, data = {}) => ({
  id: uid,
  username: data.username || '',
  fullName: data.fullName || '',
  email: data.email || '',
  avatar: (data.username || data.fullName || data.email || 'U')[0].toUpperCase(),
  avatarColor: data.avatarColor || `hsl(${Math.floor(Math.random()*360)},70%,60%)`,
  avatarUrl: data.avatarUrl || null,
  bio: data.bio || 'New to Infinity! 🎬',
  link: '',
  gender: '',
  birthdate: data.birthdate || '',
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

const createUserProfile = async (uid, data) => {
  await setDoc(doc(db, 'users', uid), {
    ...buildDefaultProfile(uid, data),
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
    /* ── DESIGN TOKENS (reference) ──────────────────────────────────────
       Brand accent     #FF2156   |  Secondary/purple  #9D4EDD
       Success          #2ED573   |  Warning            #FFB100
       Danger           #FF453A   |  Info               #0A84FF
       Indigo           #5E5CE6   |  Gold/coins          #FFD60A
       Teal (gradient)  #00E6B4 → #00A9D6   |  Verified check  #2F9BFF
       Surface scale    base #0B0B0F → elev-1 #15151C → elev-2 #1C1C24 → elev-3 #24242E
       Borders/dividers #34343E   |  Muted text/icon    #5A5A66
       These values are the single source of truth for the app's palette —
       update here first if the brand colors ever need to evolve.
    ──────────────────────────────────────────────────────────────────── */
    :root{
      --accent:#FF2156; --accent-2:#9D4EDD;
      --success:#2ED573; --warning:#FFB100; --danger:#FF453A; --info:#0A84FF; --indigo:#5E5CE6;
      --gold:#FFD60A; --teal:#00E6B4; --teal-2:#00A9D6; --verified:#2F9BFF;
      --bg-base:#0B0B0F; --bg-elev-1:#15151C; --bg-elev-2:#1C1C24; --bg-elev-3:#24242E;
      --border-strong:#34343E; --text-muted:#5A5A66;
    }
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    html{scroll-behavior:smooth}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;overscroll-behavior:none;touch-action:manipulation;background:#0B0B0F}
    ::-webkit-scrollbar{display:none}
    *{scrollbar-width:none;-ms-overflow-style:none}
    ::selection{background:rgba(255,33,86,0.35);color:#fff}
    @keyframes heartBurst{0%{transform:scale(0.4) translateY(0);opacity:1}100%{transform:scale(1.8) translateY(-80px);opacity:0}}
    @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
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
    @keyframes scaleIn{from{transform:scale(0.95);opacity:0}to{transform:scale(1);opacity:1}}
    @keyframes likeHeart{0%{transform:scale(1)}15%{transform:scale(1.4)}30%{transform:scale(0.9)}45%{transform:scale(1.2)}60%{transform:scale(1)}}
    @keyframes progressBar{from{width:0%}to{width:100%}}
    @keyframes bounceIn{0%{transform:scale(0.3);opacity:0}50%{transform:scale(1.1)}70%{transform:scale(0.9)}100%{transform:scale(1);opacity:1}}
    @keyframes swipeHint{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    button{touch-action:manipulation}
    button:active{transform:scale(0.94)!important;transition:transform 0.1s}
    input,textarea{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}
    input:focus,textarea:focus{outline:none;box-shadow:0 0 0 2px rgba(255,33,86,0.22);border-radius:inherit;transition:box-shadow 0.15s ease}
    .tab-active-indicator{animation:tabPop 0.25s ease}
    .story-avatar-ring{background:conic-gradient(#FF2156,#FFB100,#FFD60A,#9D4EDD,#FF2156);padding:2.5px;border-radius:50%}
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

const VideoSkeleton = () => (
  <div style={{ position:'absolute', inset:0, background:'#15151C', display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:20 }}>
    <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:14 }}>
      <div className="skeleton" style={{ width:44, height:44, borderRadius:'50%' }} />
      <div style={{ flex:1 }}>
        <div className="skeleton" style={{ height:13, borderRadius:6, width:'50%', marginBottom:8 }} />
        <div className="skeleton" style={{ height:11, borderRadius:6, width:'30%' }} />
      </div>
    </div>
    <div className="skeleton" style={{ height:11, borderRadius:6, width:'80%', marginBottom:6 }} />
    <div className="skeleton" style={{ height:11, borderRadius:6, width:'60%' }} />
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
const registerNotifServiceWorker = async () => {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
  try {
    // Inline SW that handles push events when app is closed
    const swCode = `
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'Dagu';
  const options = {
    body: data.body || 'You have a new notification',
    icon: 'https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png',
    badge: 'https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png',
    vibrate: [200, 100, 200],
    data: data,
    actions: data.type === 'call' ? [
      { action: 'answer', title: '✅ Answer' },
      { action: 'decline', title: '❌ Decline' }
    ] : [
      { action: 'open', title: 'Open' }
    ],
    tag: data.type || 'notif',
    renotify: true,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});
`;
    const blob = new Blob([swCode], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(blob);
    await navigator.serviceWorker.register(swUrl, { scope: '/' });
  } catch(e) { console.log('SW registration skipped:', e.message); }
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
        <div style={{ width:44, height:44, borderRadius:'50%', background:user?.avatarColor||'#FF2156', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:18, overflow:'hidden' }}>
          {user?.avatarUrl ? <img src={user.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : (user?.avatar||'?')}
        </div>
        <div style={{ position:'absolute', bottom:-2, right:-2, width:18, height:18, borderRadius:'50%', background:'#1C1C24', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, border:'1.5px solid rgba(255,255,255,0.1)' }}>{icons[notif?.type]||'🔔'}</div>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ color:'white', fontSize:13, fontWeight:600, lineHeight:1.35, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          <span style={{ color:'#FF2156' }}>@{user?.username||'someone'}</span>{' '}{notif?.message}
        </div>
        <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, marginTop:2 }}>Just now · Swipe to dismiss</div>
      </div>
      <button onClick={e=>{e.stopPropagation();onClose();}} style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:'50%', width:26, height:26, color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:'rgba(255,255,255,0.06)', borderRadius:'0 0 20px 20px', overflow:'hidden' }}>
        <div style={{ height:'100%', background:'linear-gradient(90deg,#FF2156,#9D4EDD)', animation:'notifBar 4.5s linear forwards' }}/>
      </div>
    </div>
  );
};
/* ─────────────── TOAST ─────────────── */
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 2800); return () => clearTimeout(t); }, [onClose]);
  const configs = {
    success: { bg: 'linear-gradient(135deg,#00E6B4,#00A9D6)', icon: '✓' },
    error: { bg: 'linear-gradient(135deg,#FF2156,#FF8552)', icon: '✕' },
    info: { bg: 'linear-gradient(135deg,#0A84FF,#5E5CE6)', icon: 'i' },
    warning: { bg: 'linear-gradient(135deg,#FFB100,#FF8552)', icon: '!' },
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

  const copyLink = () => {
    navigator.clipboard.writeText(url)
      .then(() => showToast?.('Link copied!', 'success'))
      .catch(() => showToast?.('Copied!', 'success'));
    updateDoc(doc(db, 'videos', video.id), { shares: increment(1) }).catch(() => {});
    onClose();
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Infinity', text: shareText, url });
        updateDoc(doc(db, 'videos', video.id), { shares: increment(1) }).catch(() => {});
        onClose();
        return;
      } catch (e) {
        if (e.name === 'AbortError') { onClose(); return; }
      }
    }
    copyLink();
  };

  const shareApps = [
    { name: 'More', emoji: '⬆️', color: '#5A5A66', fn: nativeShare },
    { name: 'WhatsApp', emoji: '💬', color: '#25D366', fn: () => { window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + url)}`); updateDoc(doc(db, 'videos', video.id), { shares: increment(1) }).catch(() => {}); onClose(); } },
    { name: 'Telegram', emoji: '✈️', color: '#26A5E4', fn: () => { window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`); onClose(); } },
    { name: 'X (Twitter)', emoji: '𝕏', color: '#000', fn: () => { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`); onClose(); } },
    { name: 'Facebook', emoji: 'f', color: '#1877F2', fn: () => { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`); onClose(); } },
    { name: 'Instagram', emoji: '📸', color: '#E1306C', fn: () => { copyLink(); showToast?.('Link copied — paste in Instagram!', 'info'); } },
    { name: 'TikTok', emoji: '🎵', color: '#010101', fn: () => { copyLink(); showToast?.('Link copied — paste in TikTok!', 'info'); } },
    { name: 'Copy Link', emoji: '🔗', color: '#34343E', fn: copyLink },
  ];

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 4000, display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', background: '#1C1C24', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 36, animation: 'slideUp 0.3s ease' }}
      >
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 8 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '4px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 16, fontFamily: "'Inter',sans-serif" }}>Share to</span>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: 'white', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        {/* Video preview strip */}
        <div style={{ padding: '0 20px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ width: 52, height: 72, borderRadius: 10, overflow: 'hidden', background: '#34343E', flexShrink: 0 }}>
            {video?.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i)
              ? <img src={video.videoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <video src={video?.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'white', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{video?.username}</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video?.description}</div>
          </div>
        </div>

        {/* App icons — scrollable row */}
        <div style={{ overflowX: 'auto', display: 'flex', gap: 0, padding: '18px 16px 8px', position: 'relative' }}>
          <div style={{
  position:'absolute', top:0, right:0, bottom:0, width:32,
  background:'linear-gradient(to right, transparent, #1C1C24)',
  pointerEvents:'none', borderRadius:'0 0 0 0'
}} />
          {shareApps.map(app => (
            <button
              key={app.name}
              onClick={app.fn}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: '0 10px' }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: app.color === '#000' || app.color === '#010101' ? '#1C1C24' : app.color + '22',
                border: `1.5px solid ${app.color}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: app.name === 'X (Twitter)' || app.name === 'Facebook' ? 20 : 26,
                color: app.color === '#000' || app.color === '#010101' ? '#fff' : app.color,
                fontWeight: 900,
              }}>
                {app.emoji}
              </div>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, textAlign: 'center', maxWidth: 60 }}>{app.name}</span>
            </button>
          ))}
        </div>

        {/* Copy link bar */}
        <div style={{ margin: '12px 16px 0', background: '#24242E', borderRadius: 14, display: 'flex', alignItems: 'center', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ padding: '6px 8px 6px 14px', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
          </div>
          <span style={{ flex: 1, color: 'rgba(255,255,255,0.3)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{url}</span>
          <button onClick={copyLink} style={{ background: '#FF2156', border: 'none', padding: '14px 20px', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
            Copy
          </button>
        </div>
      </div>
    </div>
  );
};

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
  const timerRef = useRef(null);
  const DURATION = 5000;

  const currentGroup = storyGroups[groupIdx];
  const currentStory = currentGroup?.stories[storyIdx];

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
    if (paused) return;
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) goNext();
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [storyIdx, groupIdx, paused]);

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
      onClose();
    }
  }, [storyIdx, groupIdx, storyGroups]);

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
    if (!replyText.trim()) return;
    try {
      await addDoc(collection(db, 'messages'), {
        senderId: currentUser.id,
        receiverId: currentGroup.userId,
        text: `↩ Story reply: ${replyText}`,
        createdAt: serverTimestamp(),
        read: false,
      });
      showToast?.('Reply sent ✓', 'success');
    } catch { showToast?.('Failed to send', 'error'); }
    setReplyText('');
  };

  const toggleLike = () => {
    const key = currentStory?.id;
    setLiked(p => ({ ...p, [key]: !p[key] }));
    if (!liked[key]) showToast?.('❤️ Liked!', 'success');
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
          <div style={{ width:42, height:42, borderRadius:'50%', background:currentGroup.avatarColor||'#FF2156',
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
            : <div style={{ width:'100%', height:'100%', background:currentStory.bgColor||'#FF2156', display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
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
                <button key={emoji} onClick={e=>{e.stopPropagation(); toggleLike(); showToast?.(emoji+' Reacted!','success');}}
                  style={{ background:'rgba(255,255,255,0.1)', backdropFilter:'blur(12px)', border:'none', borderRadius:'50%', width:38, height:38, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transform: liked[currentStory?.id] && emoji==='❤️' ? 'scale(1.3)' : 'scale(1)', transition:'transform 0.15s' }}>
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
                  style={{ background:'#FF2156', border:'none', borderRadius:'50%', width:32, height:32, color:'white', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>➤</button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(12px)', borderRadius:20, padding:'12px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:18 }}>👁</span>
              <span style={{ color:'white', fontWeight:700, fontSize:15 }}>{currentStory.seenBy?.length || 0} views</span>
            </div>
            {(currentStory.seenBy?.length || 0) > 0 && (
              <div style={{ display:'flex', gap:-8 }}>
                {(currentStory.seenBy || []).slice(0,6).map((uid,i)=>{
                  const viewer = [{ id: currentUser?.id }].find(u=>u.id===uid) || { id:uid };
                  return (
                    <div key={uid} style={{ width:28, height:28, borderRadius:'50%', background:'#FF2156', border:'2px solid #000', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:11, fontWeight:'bold', marginLeft: i>0?-8:0 }}>
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
    </div>
  );
};

/* ─────────────── STORIES ROW ─────────────── */
const Stories = ({ users, currentUser, onViewStory, onCreateStory, onLive, followed }) => {
  const [storyUsers, setStoryUsers] = useState([]);

  useEffect(() => {
    // Load all users who have recent stories (not just followed)
    const loadStories = async () => {
      try {
        const now = new Date();
        const snap = await getDocs(query(collection(db, 'stories'), orderBy('createdAt', 'desc')));
        const byUser = {};
        snap.docs.forEach(d => {
          const data = d.data();
          const exp = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
          if (exp < now) return; // skip expired
          if (!byUser[data.userId]) byUser[data.userId] = { userId: data.userId, stories: [] };
          byUser[data.userId].stories.push({ id: d.id, ...data });
        });
        // Merge user profile info
        const result = Object.values(byUser).map(g => {
          const u = users.find(u => u.id === g.userId);
          return { ...g, username: u?.username || g.stories[0]?.username || 'user', avatarColor: u?.avatarColor || g.stories[0]?.avatarColor, avatarUrl: u?.avatarUrl || g.stories[0]?.avatarUrl };
        });
        setStoryUsers(result);
      } catch (e) {
        // Fallback: no orderBy
        try {
          const snap = await getDocs(collection(db, 'stories'));
          const byUser = {};
          snap.docs.forEach(d => {
            const data = d.data();
            if (!byUser[data.userId]) byUser[data.userId] = { userId: data.userId, stories: [] };
            byUser[data.userId].stories.push({ id: d.id, ...data });
          });
          const result = Object.values(byUser).map(g => {
            const u = users.find(u => u.id === g.userId);
            return { ...g, username: u?.username || g.stories[0]?.username || 'user', avatarColor: u?.avatarColor || g.stories[0]?.avatarColor, avatarUrl: u?.avatarUrl || g.stories[0]?.avatarUrl };
          });
          setStoryUsers(result);
        } catch {}
      }
    };
    loadStories();
  }, [users]);

  const myStories = storyUsers.find(g => g.userId === currentUser?.id);
  const otherStories = storyUsers.filter(g => g.userId !== currentUser?.id);

  const handleMyStory = async () => {
    if (myStories) { onViewStory?.({ groups: storyUsers, startIdx: storyUsers.findIndex(g => g.userId === currentUser?.id) }); }
    else onCreateStory?.();
  };

  return (
    <div style={{ display:'flex', gap:14, padding:'14px 16px', overflowX:'auto', borderBottom:'1px solid rgba(255,255,255,0.06)', scrollbarWidth:'none' }}>
      {/* My Story */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, flexShrink:0 }}>
        <button onClick={handleMyStory} style={{ width:66, height:66, borderRadius:'50%', padding:0, background:'none', border:'none', cursor:'pointer', position:'relative' }}>
          <div style={{ width:'100%', height:'100%', borderRadius:'50%',
            background: myStories ? 'linear-gradient(135deg,#FF2156,#9D4EDD,#FFB100)' : 'rgba(255,255,255,0.05)',
            padding: myStories ? 2 : 0,
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:'100%', height:'100%', borderRadius:'50%', background: myStories ? '#0B0B0F' : 'transparent', padding: myStories ? 2 : 0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:currentUser?.avatarColor||'#FF2156',
                border: !myStories ? '1.5px dashed rgba(255,255,255,0.3)' : 'none',
                display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:20, overflow:'hidden' }}>
                {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : currentUser?.avatar}
              </div>
            </div>
          </div>
          <div onClick={e=>{e.stopPropagation(); onCreateStory?.();}} style={{ position:'absolute', bottom:0, right:0, width:20, height:20, background:'#FF2156', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #0B0B0F', fontSize:12, color:'white', fontWeight:800 }}>+</div>
        </button>
        <span style={{ color:'rgba(255,255,255,0.5)', fontSize:11 }}>Your story</span>
      </div>

      {/* Other users' stories — ALL users, not just followed */}
      {otherStories.map((group, idx) => (
        <div key={group.userId} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, flexShrink:0 }}>
          <button onClick={() => onViewStory?.({ groups: storyUsers, startIdx: storyUsers.findIndex(g => g.userId === group.userId) })}
            style={{ padding:0, background:'none', border:'none', cursor:'pointer' }}>
            <div style={{ width:66, height:66, borderRadius:'50%', background:'linear-gradient(135deg,#FF2156,#9D4EDD,#FFB100)', padding:2, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:'#0B0B0F', padding:2, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:group.avatarColor||'#FF2156', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:20, overflow:'hidden' }}>
                  {group.avatarUrl ? <img src={group.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (group.username||'?')[0].toUpperCase()}
                </div>
              </div>
            </div>
          </button>
          <span style={{ color:'rgba(255,255,255,0.5)', fontSize:11, maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'center' }}>{group.username.split('_')[0]}</span>
        </div>
      ))}
    </div>
  );
};

/* ─────────────── CREATE STORY MODAL ─────────────── */
const CreateStoryModal = ({ currentUser, onClose, showToast }) => {
  const [mode, setMode] = useState(null);
  const [storyText, setStoryText] = useState('');
  const [bgColor, setBgColor] = useState('#FF2156');
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
  const colors = ['#FF2156','#9D4EDD','#0A84FF','#FFB100','#2ED573','#00A9D6','#FF453A','#5E5CE6'];

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
        avatarColor: currentUser.avatarColor || '#FF2156',
        avatarUrl: currentUser.avatarUrl || null,
        text: storyText || '',
        bgColor: bgColor || '#FF2156',
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
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', background:'#15151C', borderTopLeftRadius:32, borderTopRightRadius:32, padding:'20px 20px 44px', border:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width:36, height:4, background:'rgba(255,255,255,0.15)', borderRadius:2, margin:'0 auto 24px' }} />
        <div style={{ color:'white', fontWeight:800, fontSize:20, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Create Story</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[{id:'camera',icon:'📷',label:'Camera',sub:'Photo or video',color:'#FF2156'},{id:'file',icon:'🖼️',label:'Gallery',sub:'From device',color:'#9D4EDD'},{id:'text',icon:'✏️',label:'Text',sub:'Write a story',color:'#0A84FF'},{id:'audio',icon:'🎙️',label:'Audio',sub:'Voice story',color:'#2ED573'}].map(opt=>(
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
        <button onClick={handlePost} disabled={uploading} style={{ background:'linear-gradient(135deg,#FF2156,#9D4EDD)', border:'none', borderRadius:20, padding:'8px 16px', color:'white', fontWeight:700, cursor:'pointer', fontSize:13, opacity:uploading?0.6:1 }}>{uploading?'Posting...':'Post'}</button>
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
              <button onMouseDown={startAudio} onMouseUp={stopAudio} onTouchStart={startAudio} onTouchEnd={stopAudio} style={{ background:isRecording?'#FF2156':'#34343E', border:'none', borderRadius:'50%', width:90, height:90, fontSize:36, cursor:'pointer' }}>{isRecording?'⏹':'🎙️'}</button>
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
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', background:'#15151C', borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ width:36, height:4, background:'rgba(255,255,255,0.12)', borderRadius:2, margin:'16px auto 0' }} />
        <div style={{ display:'flex', justifyContent:'flex-end', padding:'10px 16px 0' }}>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:'50%', width:34, height:34, color:'white', cursor:'pointer', fontSize:16 }}>✕</button>
        </div>
        <div style={{ textAlign:'center', padding:'4px 20px 20px' }}>
          <div style={{ width:90, height:90, borderRadius:'50%', padding:2.5, margin:'0 auto 14px', background:'conic-gradient(#FF2156,#FFB100,#9D4EDD,#FF2156)' }}>
            <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:'#0d0d0d', padding:2 }}>
              <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:user?.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:32, overflow:'hidden' }}>
                {avatarSrc ? <img src={avatarSrc} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : user?.avatar}
              </div>
            </div>
          </div>
          <div style={{ color:'white', fontWeight:800, fontSize:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>@{user?.username}</div>
          {user?.verified && <div style={{ display:'inline-flex', alignItems:'center', gap:4, color:'#2F9BFF', fontSize:12, marginTop:4, background:'rgba(29,155,240,0.1)', borderRadius:20, padding:'3px 10px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#2F9BFF"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
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
  style={{ flex:1, background:isFollowing?'rgba(255,255,255,0.06)':'linear-gradient(135deg,#FF2156,#9D4EDD)', border:isFollowing?'1px solid rgba(255,45,85,0.4)':'none', borderRadius:14, padding:'12px', color:isFollowing?'#FF2156':'white', fontWeight:700, cursor:'pointer', fontSize:14 }}>
  {isFollowing ? 'Following' : '+ Follow'}
</button>
<button
  onClick={async () => {
    await addDoc(collection(db, 'reports'), {
      reportedUserId: user.id,
      reportedBy: currentUser.id,
      type: 'user',
      createdAt: serverTimestamp()
    });
    showToast?.('User reported', 'success');
  }}
  style={{
    background: 'rgba(255,150,0,0.1)', border: '1px solid rgba(255,150,0,0.3)',
    borderRadius: 14, padding: '12px', color: '#FFB100',
    fontWeight: 600, cursor: 'pointer', fontSize: 13
  }}
>Report</button>
            <button onClick={()=>{onMessage?.(user.id); onClose();}} style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'12px', color:'white', fontWeight:600, cursor:'pointer', fontSize:14 }}>Message</button>
            <button onClick={()=>{onVoiceCall?.(user.id); onClose();}} style={{ background:'rgba(52,199,89,0.12)', border:'1px solid rgba(52,199,89,0.2)', borderRadius:14, padding:'12px 14px', color:'#2ED573', cursor:'pointer', fontSize:18 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2ED573" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
            </button>
            <button onClick={()=>{onVideoCall?.(user.id); onClose();}} style={{ background:'rgba(175,82,222,0.12)', border:'1px solid rgba(175,82,222,0.2)', borderRadius:14, padding:'12px 14px', color:'#9D4EDD', cursor:'pointer', fontSize:18 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9D4EDD" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
            </button>
          </div>
        )}
        <div style={{ display:'flex', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          {[{id:'posts',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>},{id:'saved',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>},{id:'drafts',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, background:'none', border:'none', borderTop:tab===t.id?'2px solid #FF2156':'2px solid transparent', padding:'14px 0', color:tab===t.id?'white':'rgba(255,255,255,0.3)', cursor:'pointer', display:'flex', justifyContent:'center' }}>{t.icon}</button>
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
                {mockVideos.map(v => {
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
    </div>
  );
};
const LiveCameraView = () => {
  const videoRef = useRef(null);
  useEffect(()=>{
    let stream;
    navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:true})
      .then(s=>{
        stream = s;
        if(videoRef.current){ 
          videoRef.current.srcObject = s; 
          videoRef.current.play().catch(()=>{});
        }
      }).catch(()=>{});
    return ()=>{ stream?.getTracks().forEach(t=>t.stop()); };
  },[]);
  return <video ref={videoRef} autoPlay playsInline muted style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>;
};
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
    <div style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(10px)', borderRadius:20, padding:'6px 12px', display:'inline-flex', flexDirection:'column', gap:2, maxWidth:'85%', alignSelf:'flex-start' }}>
      <div style={{ display:'flex', gap:7, alignItems:'baseline' }}>
        <span style={{ color:'#FF2156', fontSize:11, fontWeight:700 }}>@{msg.user}</span>
        <span style={{ color:'white', fontSize:11 }}>{(translated && !showOriginal) ? translated : msg.text}</span>
      </div>
      {eligible && (
        <button onClick={toggle} disabled={loading} style={{ alignSelf:'flex-start', background:'none', border:'none', color:'#2F9BFF', fontSize:10, cursor:'pointer', padding:0, marginTop:1 }}>
          {loading ? '...' : translated ? (showOriginal ? '🌐 See translation' : '🌐 See original') : '🌐 Translate'}
        </button>
      )}
    </div>
  );
};

const LiveStream = ({ streamer, onClose, showToast, currentUser }) => {
  const [viewers, setViewers] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [floatingGifts, setFloatingGifts] = useState([]);
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
          <div style={{ background:'#FF2156', borderRadius:20, padding:'4px 12px', display:'flex', alignItems:'center', gap:6 }}>
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
      <LiveCameraView />
      <div style={{ flex:1, display:'flex', alignItems:'flex-end', padding:'0 14px 10px', zIndex:10 }}>
        <div style={{ flex:1, maxHeight:200, overflowY:'hidden', display:'flex', flexDirection:'column', gap:6 }}>
          {chatMessages.slice(-8).map(m=>{
            const targetLang = currentUser?.language || 'en';
            return <LiveChatMessage key={m.id} msg={m} targetLang={targetLang} />;
          })}
        </div>
      </div>
      <div style={{ display:'flex', gap:10, padding:'10px 14px 28px', borderTop:'1px solid rgba(255,255,255,0.06)', zIndex:10 }}>
        <input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()} placeholder="Say something..." style={{ flex:1, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:28, padding:'10px 16px', color:'white', outline:'none', fontSize:13 }} />
        <button onClick={sendMessage} style={{ background:'linear-gradient(135deg,#FF2156,#9D4EDD)', border:'none', borderRadius:'50%', width:42, height:42, color:'white', cursor:'pointer', fontSize:16 }}>↑</button>
      </div>
    </div>
  );
};
/* ─────────────── COMMENT ITEM ─────────────── */
const CommentItem = ({ comment, currentUser, onLike, onReply, onPin, onViewProfile, onDelete }) => {
  const isMine = comment.userId === currentUser?.id;
  return (
    <div style={{ display:'flex', justifyContent:isMine?'flex-end':'flex-start', alignItems:'flex-end', gap:8, marginBottom:12 }}>
      {!isMine && (
        <div onClick={()=>onViewProfile?.(comment.userId)} style={{ width:28, height:28, borderRadius:'50%', background:comment.avatarColor||'#34343E', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:11, flexShrink:0, overflow:'hidden', cursor:'pointer' }}>
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
        <div style={{ background:isMine?'linear-gradient(135deg,#FF2156,#9D4EDD)':'rgba(255,255,255,0.09)', borderRadius:isMine?'20px 20px 4px 20px':'20px 20px 20px 4px', padding:'10px 14px' }}>
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
          {isMine && (
            <button onClick={()=>onDelete?.(comment.id)} title="Delete" style={{ background:'none', border:'none', color:'rgba(255,69,58,0.55)', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          )}
        </div>
      </div>
      {isMine && (
        <div style={{ width:28, height:28, borderRadius:'50%', background:currentUser?.avatarColor||'#FF2156', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:11, flexShrink:0, overflow:'hidden' }}>
          {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (currentUser?.avatar||'U')}
        </div>
      )}
    </div>
  );
};
const CommentInputBar = ({ currentUser, commentText, setCommentText, onSend, showToast, videoId }) => {
  // Voice support integrated via VoiceRecorderButton
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
    const commentRef = await addDoc(collection(db,'comments'),{ videoId, userId:currentUser.id, username:currentUser.username, avatar:currentUser.avatar||(currentUser.username||'U')[0].toUpperCase(), avatarColor:currentUser.avatarColor||'#FF2156', avatarUrl:currentUser.avatarUrl||null, text:commentText, mediaUrl, mediaType, likes:0, createdAt:serverTimestamp() });
    await updateDoc(doc(db,'videos',videoId),{comments:increment(1)});
    const parentVideo = (await getDoc(doc(db,'videos',videoId))).data();
    if(parentVideo?.userId) await sendNotification(parentVideo.userId, currentUser.id, 'comment', `commented: "${commentText.substring(0,40)}"`, {videoId});
    setCommentText(''); clearAttach();
  };

  return (
    <div style={{padding:'10px 14px',paddingBottom:'max(24px, env(safe-area-inset-bottom))',borderTop:'1px solid rgba(255,255,255,0.06)',background:'#0B0B0F'}}>
      {(previewFile||audioBlob)&&(
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,background:'rgba(255,255,255,0.05)',borderRadius:14,padding:'8px 12px'}}>
          {previewFile?.type?.startsWith('image')&&<img src={previewFile.url} alt="" style={{height:44,width:44,objectFit:'cover',borderRadius:8}}/>}
          {previewFile?.type?.startsWith('video')&&<video src={previewFile.url} style={{height:44,width:60,objectFit:'cover',borderRadius:8}}/>}
          {audioBlob&&!previewFile&&<audio src={URL.createObjectURL(audioBlob)} controls style={{height:28,flex:1}}/>}
          <button onClick={clearAttach} style={{marginLeft:'auto',background:'rgba(255,45,85,0.2)',border:'none',borderRadius:'50%',width:22,height:22,color:'#FF2156',cursor:'pointer',fontSize:13}}>✕</button>
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
        <button onClick={handleSend} style={{background:'linear-gradient(135deg,#FF2156,#9D4EDD)',border:'none',borderRadius:'50%',width:36,height:36,color:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>          <svg width="15" height="15" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1"><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
};
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
      <div style={{ height:'100%', background:'linear-gradient(90deg,#FF2156,#9D4EDD)', width:`${progress}%`, transition:'width 0.5s linear' }} />
    </div>
  );
};
/* ─────────────── ENHANCED VIDEO CARD ─────────────── */
const EnhancedVideoCard = memo(({ video, currentUser, isActive, onLike, onComment, onShare, onFollow, onMessage, onVoiceCall, onVideoCall, onDuet, onStitch, onSaveSound, followed, showToast, onViewProfile, onBlock, onLive }) => {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video?.likes||0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [pinnedComment, setPinnedComment] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const [displayDesc, setDisplayDesc] = useState(video?.description || '');
  const [showOriginalDesc, setShowOriginalDesc] = useState(false);
  const [translatedDesc, setTranslatedDesc] = useState(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const tapTimer = useRef(null);
  const videoRef = useRef(null);
  const menuButtonRef = useRef(null);
  const [showReactions, setShowReactions] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const longPressTimer = useRef(null);
  const REACTIONS = ['❤️','😂','😮','😢','😡','🔥','👏','💎'];
  const [showLongPressMenu, setShowLongPressMenu] = useState(false);
  const [showFullText, setShowFullText] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const slideStartX = useRef(null);
  const images = useMemo(()=>{
    if(Array.isArray(video?.images) && video.images.length) return video.images;
    if(video?.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i) || video?.mediaType?.startsWith('image')) return [video.videoUrl];
    return null;
  },[video?.images, video?.videoUrl, video?.mediaType]);
  const handleSlideTouchStart = e => { if(images && images.length>1) slideStartX.current = e.touches[0].clientX; };
  const handleSlideTouchEnd = e => {
    if(slideStartX.current===null || !images || images.length<=1) return;
    const dx = e.changedTouches[0].clientX - slideStartX.current;
    if(Math.abs(dx) > 40){
      if(dx<0) setSlideIndex(i=>Math.min(images.length-1,i+1));
      else setSlideIndex(i=>Math.max(0,i-1));
    }
    slideStartX.current = null;
  };

  // Helper: download/save post media (current slide for multi-image posts)
  const handleDownloadPost = async () => {
    const target = images ? images[slideIndex] : video?.videoUrl;
    if (!target) { showToast?.('No media to download', 'error'); return; }
    try {
      const response = await fetch(target);
      const blob = await response.blob();
      const isImage = !!images || /\.(jpg|jpeg|png|gif|webp)/i.test(target) || video.mediaType?.startsWith('image');
      const ext = isImage ? 'jpg' : 'mp4';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `dagu_post_${video.id || Date.now()}.${ext}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast?.('Post downloaded! 📥', 'success');
    } catch (e) {
      // Fallback: open in new tab
      window.open(target, '_blank');
      showToast?.('Opened in browser — long-press to save 📥', 'info');
    }
    setShowLongPressMenu(false);
  };

  useEffect(()=>()=>{ if(tapTimer.current) clearTimeout(tapTimer.current); },[]);

  // Load real likes state + comments from Firestore
  useEffect(()=>{
    if(!video?.id || !currentUser?.id) return;
    // Check if current user liked this video
    getDoc(doc(db,'likes',`${video.id}_${currentUser.id}`)).then(snap=>{
      if(snap.exists()) setLiked(true);
    }).catch(()=>{});
    const viewKey = `viewed_${video.id}`;
    if(!sessionStorage.getItem(viewKey)){
      sessionStorage.setItem(viewKey,'1');
      updateDoc(doc(db,'videos',video.id),{ views: increment(1) }).catch(()=>{});
    }
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
  useEffect(()=>{
  const el = videoRef.current;
  if(!el) return;
  el.playbackRate = video?.playbackRate || 1;
  if(isActive){
    el.muted = false;
    el.volume = 1;
    if(isPlaying) el.play().catch(()=>{ el.muted=true; el.play().catch(()=>{}); });
  } else {
    el.muted = true;
    el.pause();
  }
},[isActive, isPlaying, video?.playbackRate]);
useEffect(() => {
  if (!isActive) { setShowFullText(false); setSlideIndex(0); }
}, [isActive]);
useEffect(() => {
  if (!isActive || !video?.description) return;
  setDisplayDesc(video.description);
  setTranslatedDesc(null);
  setShowOriginalDesc(false);

  const targetLang = currentUser?.language || 'en';
  if (targetLang === 'en') return; // assume source captions are already English by default
  const translate = async () => {
  try {
    const cacheKey = `${video.id}_${targetLang}`;
    const cacheRef = doc(db, 'translations', cacheKey);
    const cached = await getDoc(cacheRef);
    if (cached.exists()) {
      const cachedText = cached.data().text || video.description;
      if (cachedText !== video.description) setTranslatedDesc(cachedText);
      return;
    }
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(video.description)}`
    );
    const data = await res.json();
    const translated = data?.[0]?.map(s => s?.[0]).filter(Boolean).join('');
    if (translated && translated !== video.description) {
      setTranslatedDesc(translated);
      setDoc(cacheRef, { text: translated, lang: targetLang }, { merge: true }).catch(() => {});
    }
  } catch {}
};
translate();
}, [isActive, video?.description, currentUser?.language]);
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
    // Don't fire tap if user clicked a button/link/input
    if(e.target.closest('button,a,input,textarea,[data-notap]')) return;
    if(videoRef.current && videoRef.current.muted) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1;
    }
    if(tapTimer.current){
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      haptic('medium');
      handleDoubleTap();
    } else {
      tapTimer.current = setTimeout(()=>{
        tapTimer.current = null;
        haptic('light');
        const isImagePost = video?.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i) || video?.mediaType?.startsWith('image');
        if(!isImagePost && videoRef.current){
          if(isPlaying){ videoRef.current.pause(); setIsPlaying(false); }
          else { videoRef.current.play().catch(()=>{}); setIsPlaying(true); }
        }
      }, 250);
    }
  };
const handleLongPressStart = () => {
    longPressTimer.current = setTimeout(()=>{ haptic('heavy'); setShowLongPressMenu(true); }, 500);
  };
  const handleLongPressEnd = () => { clearTimeout(longPressTimer.current); };
  const handleReact = (emoji) => {
    setShowReactions(false);
    haptic('medium');
    const id = Date.now();
    setFloatingReactions(prev=>[...prev, { id, emoji, x: Math.random()*60+20 }]);
    setTimeout(()=>setFloatingReactions(prev=>prev.filter(r=>r.id!==id)), 1500);
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
      avatarColor: currentUser.avatarColor || '#FF2156',
      avatarUrl: currentUser.avatarUrl||null,
      text: txt,
      likes: 0,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db,'videos',video.id),{ comments:increment(1) });
  };

  const reportReasons = ['Spam','Inappropriate content','Hate speech','Misinformation','Copyright violation','Other'];

  const t = TRANSLATIONS[currentUser?.language || 'en'] || TRANSLATIONS.en;

  return (
    <div style={{ position:'absolute', inset:0, background:'#000' }}
      onClick={handleTap}
      onTouchStart={handleLongPressStart}
      onTouchEnd={handleLongPressEnd}
      onMouseDown={handleLongPressStart}
      onMouseUp={handleLongPressEnd}
      onTouchStartCapture={handleSlideTouchStart}
      onTouchEndCapture={handleSlideTouchEnd}>
      {images ?
        <div style={{ position:'absolute', inset:0, display:'flex', width:`${images.length*100}%`, height:'100%', transform:`translateX(-${slideIndex*(100/images.length)}%)`, transition:'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)' }}>
          {images.map((img,i)=>(
            <div key={i} style={{ width:`${100/images.length}%`, height:'100%', flexShrink:0 }}>
              <img src={img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform 0.3s ease', transform: showComments ? 'translateY(-18%)' : 'translateY(0)' }} />
            </div>
          ))}
        </div> :
  <video
    src={video?.videoUrl}
    style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform 0.3s ease', transform: showComments ? 'translateY(-18%)' : 'translateY(0)' }}
    loop
    autoPlay
    playsInline
    ref={el=>{
      if(el){
        videoRef.current = el;
        if(isActive && isPlaying){
          el.muted = false;
          el.volume = 1;
          el.play().catch(()=>{ el.muted=true; el.play().catch(()=>{}); });
        } else {
          el.muted = true;
          el.pause();
        }
      }
    }}
  />
}
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.1) 40%,rgba(0,0,0,0.3) 100%)' }} />

      {images && images.length>1 && (
        <div style={{ position:'absolute', top:10, left:0, right:0, zIndex:9, display:'flex', justifyContent:'center', gap:5, pointerEvents:'none' }}>
          {images.map((_,i)=>(
            <div key={i} style={{ flex:1, maxWidth:36, height:3, borderRadius:2, background: i===slideIndex ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)', transition:'background 0.2s' }} />
          ))}
        </div>
      )}
      
      {!isPlaying && !images && <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:15,pointerEvents:'none'}}><div style={{width:72,height:72,borderRadius:'50%',background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="32" height="32" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg></div></div>}
      <VideoProgressBar videoRef={videoRef} isActive={isActive} isImage={!!images} />
      {heartAnim && (
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:50, pointerEvents:'none' }}>
          <div style={{ fontSize:80, animation:'heartBurst 0.9s ease forwards' }}>❤️</div>
        </div>
      )}
      {/* TikTok-style bottom overlay: avatar, username, follow, truncated caption with See more */}
      {(() => {
        const desc = (translatedDesc && !showOriginalDesc) ? translatedDesc : displayDesc;
        const CHAR_LIMIT = 90;
        const isLong = desc && desc.length > CHAR_LIMIT;
        const shownText = isLong && !showFullText ? desc.slice(0, CHAR_LIMIT).trimEnd() + '…' : desc;
        return (
          <div style={{ position:'absolute', bottom:0, left:14, right:70, zIndex:8, paddingBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <button onClick={()=>onViewProfile?.(video.userId)} style={{ position:'relative', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                <div style={{ width:42, height:42, borderRadius:'50%', background:video.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:16, border:'2px solid rgba(255,255,255,0.5)', overflow:'hidden' }}>
                  {video.avatarUrl ? <img src={video.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : video.avatar}
                </div>
                {video.verified && <div style={{ position:'absolute', bottom:-2, right:-2, width:14, height:14, background:'#2F9BFF', borderRadius:'50%', fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>✓</div>}
              </button>
              <span onClick={e=>{e.stopPropagation();onViewProfile?.(video.userId);}} style={{ color:'white', fontWeight:700, fontSize:15, cursor:'pointer', fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>@{video.username}</span>
              <button data-notap='1' onClick={e=>{e.stopPropagation();onFollow?.(video.userId);}} style={{ padding:'5px 14px', borderRadius:20, background:followed?.includes(video.userId)?'rgba(255,255,255,0.08)':'rgba(255,45,85,0.9)', border:followed?.includes(video.userId)?'1px solid rgba(255,255,255,0.4)':'none', color:'white', fontSize:12, fontWeight:700, cursor:'pointer', backdropFilter:'blur(4px)' }}>{followed?.includes(video.userId)?'Unfollow':'+ Follow'}</button>
            </div>
            {desc && (
              <p style={{ color:'rgba(255,255,255,0.9)', fontSize:13, marginBottom:4, lineHeight:1.5, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                {shownText}
                {isLong && !showFullText && (
                  <span data-notap='1' onClick={e=>{e.stopPropagation(); setShowFullText(true);}} style={{ color:'rgba(255,255,255,0.55)', fontWeight:700, cursor:'pointer', marginLeft:4 }}>See more</span>
                )}
              </p>
            )}
            {translatedDesc && (
              <button data-notap='1' onClick={e=>{e.stopPropagation(); setShowOriginalDesc(s=>!s);}} style={{ background:'rgba(0,122,255,0.15)', border:'1px solid rgba(0,122,255,0.3)', borderRadius:12, padding:'3px 10px', color:'#2F9BFF', fontSize:11, cursor:'pointer', marginBottom:8, display:'inline-flex', alignItems:'center', gap:4 }}>
                🌐 {showOriginalDesc ? 'See translation' : 'See original'}
              </button>
            )}
            {!translatedDesc && currentUser?.language && currentUser.language !== 'en' && desc && desc.length > 4 && (
              <TranslateButton text={desc} targetLang={currentUser.language} onTranslated={t=>{ setTranslatedDesc(t); setShowOriginalDesc(false); }} />
            )}
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:'linear-gradient(135deg,#FF2156,#9D4EDD)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>♪</div>
              <span style={{ color:'rgba(255,255,255,0.65)', fontSize:12 }}>{video.song}</span>
              <button onClick={()=>onSaveSound?.()} style={{ marginLeft:8, background:'rgba(255,255,255,0.1)', border:'none', borderRadius:10, padding:'3px 8px', color:'rgba(255,255,255,0.7)', fontSize:10, cursor:'pointer', backdropFilter:'blur(8px)' }}>Save</button>
            </div>
          </div>
        );
      })()}

      {/* Full caption sheet — TikTok "See more" expanded view */}
      {showFullText && (
        <div data-notap='1' onClick={e=>{e.stopPropagation(); setShowFullText(false);}} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.75)', zIndex:60, display:'flex', alignItems:'flex-end' }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxHeight:'60%', background:'#121214', borderTopLeftRadius:24, borderTopRightRadius:24, padding:'16px 18px 28px', display:'flex', flexDirection:'column', animation:'slideUp 0.25s ease' }}>
            <div style={{ width:36, height:4, background:'rgba(255,255,255,0.15)', borderRadius:2, margin:'0 auto 14px' }} />
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:video.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:14, overflow:'hidden', flexShrink:0 }}>
                {video.avatarUrl ? <img src={video.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : video.avatar}
              </div>
              <span style={{ color:'white', fontWeight:700, fontSize:14 }}>@{video.username}</span>
              <button onClick={()=>setShowFullText(false)} style={{ marginLeft:'auto', background:'rgba(255,255,255,0.07)', border:'none', borderRadius:'50%', width:30, height:30, color:'white', fontSize:16, cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ overflowY:'auto', flex:1 }}>
              <p style={{ color:'rgba(255,255,255,0.92)', fontSize:14, lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-word', margin:0 }}>
                {(translatedDesc && !showOriginalDesc) ? translatedDesc : displayDesc}
              </p>
            </div>
          </div>
        </div>
      )}


      {showActionMenu && (
        <div onClick={e=>{e.stopPropagation();setShowActionMenu(false);}} style={{ position:'fixed', inset:0, zIndex:9990 }}>
          <div onClick={e=>e.stopPropagation()} style={{ position:'fixed', bottom:10, right:14, background:'rgba(18,18,18,0.97)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:22, padding:6, zIndex:9991, minWidth:210, animation:'popIn 0.2s ease' }}>
            {[
              {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>, label:t?.duet||'Duet', fn:()=>onDuet?.(video.id)},
              {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M15 14l5-5-5-5"/><path d="M4 20v-7a4 4 0 014-4h12"/></svg>, label:t?.stitch||'Stitch', fn:()=>onStitch?.(video.id)},
              {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF2156" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>, label:'Live', fn:()=>onLive?.()},
{icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>, label:t?.message||'Message', fn:()=>onMessage?.(video.userId)},
              {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-5.99-5.99 19.79 19.79 0 01-3.07-8.67A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>, label:t?.voiceCall||'Voice Call', fn:()=>onVoiceCall?.(video.userId)},
              {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>, label:t?.videoCall||'Video Call', fn:()=>onVideoCall?.(video.userId)},
              {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2ED573" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>, label:'Download Post', fn:handleDownloadPost},
              {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFD60A" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>, label:'Save Post', fn:()=>{ /* bookmark */ document.querySelector(`[data-bookmark-${video.id}]`)?.click(); showToast?.('Post saved! 🔖','success'); setShowActionMenu(false); }},
              {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFB100" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, label:t?.report||'Report', fn:()=>{ setShowReportModal(true); setShowActionMenu(false); }},
             {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF2156" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>, label:t?.block||'Block', fn:async()=>{ if(!currentUser?.id) return; await updateDoc(doc(db,'users',currentUser.id),{ blockedUsers: arrayUnion(video.userId) }).catch(()=>{}); showToast?.('User blocked','warning'); onBlock?.(video.userId); }},
            ].map(({icon,label,fn})=>(
              <button key={label} onClick={e=>{e.stopPropagation();fn(); setShowActionMenu(false);}} style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'11px 14px', background:'none', border:'none', color:label==='Block'?'#FF2156':label==='Report'?'#FFB100':'white', cursor:'pointer', borderRadius:16, fontSize:14, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>
                <span>{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showReportModal && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.9)', zIndex:50, display:'flex', alignItems:'flex-end' }} onClick={()=>setShowReportModal(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ width:'100%', background:'#15151C', borderTopLeftRadius:28, borderTopRightRadius:28, padding:'20px 20px 40px', animation:'slideUp 0.3s ease' }}>
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

      {/* Long-press: Download / Save Post sheet */}
      {showLongPressMenu && (
        <div onClick={e=>{e.stopPropagation();setShowLongPressMenu(false);}} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9995, display:'flex', alignItems:'flex-end' }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:430, margin:'0 auto', background:'#1a1a1e', borderTopLeftRadius:28, borderTopRightRadius:28, padding:'12px 0 40px', animation:'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ width:36, height:4, background:'rgba(255,255,255,0.15)', borderRadius:2, margin:'0 auto 16px' }} />
            <div style={{ padding:'0 20px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:40, height:40, borderRadius:10, overflow:'hidden', background:'#34343E', flexShrink:0 }}>
                  {images
                    ? <img src={images[0]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <video src={video?.videoUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted />}
                </div>
                <div>
                  <div style={{ color:'white', fontWeight:700, fontSize:13 }}>@{video?.username}</div>
                  <div style={{ color:'rgba(255,255,255,0.4)', fontSize:11, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:260 }}>{video?.description}</div>
                </div>
              </div>
            </div>
            {[
              { icon:'📥', label:'Download Post', color:'#2ED573', fn: handleDownloadPost },
              { icon:'🔖', label:'Save Post', color:'#FFD60A', fn: async()=>{
                  if(!currentUser?.id){ showToast?.('Sign in to save posts','error'); setShowLongPressMenu(false); return; }
                  await setDoc(doc(db,'saves',`${video.id}_${currentUser.id}`),{ videoId:video.id, userId:currentUser.id, createdAt:serverTimestamp() });
                  showToast?.('Saved to collection ✨','success');
                  setShowLongPressMenu(false);
                }
              },
              { icon:'🔗', label:'Copy Link', color:'#0A84FF', fn:()=>{
                  navigator.clipboard.writeText(`https://infinity-now.vercel.app/?post=${video.id}`).then(()=>showToast?.('Link copied!','success')).catch(()=>showToast?.('Copied!','success'));
                  setShowLongPressMenu(false);
                }
              },
              { icon:'🚩', label:'Report Post', color:'#FFB100', fn:()=>{ setShowReportModal(true); setShowLongPressMenu(false); } },
            ].map(({ icon, label, color, fn }) => (
              <button key={label} onClick={fn} style={{ width:'100%', padding:'15px 22px', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:14, borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize:22, width:30, textAlign:'center' }}>{icon}</span>
                <span style={{ color, fontSize:15, fontWeight:600, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{label}</span>
              </button>
            ))}
            <button onClick={()=>setShowLongPressMenu(false)} style={{ width:'100%', padding:'15px 22px', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize:14, fontWeight:500, textAlign:'center', marginTop:4 }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ position:'absolute', right:12, bottom:0, display:'flex', flexDirection:'column', alignItems:'center', gap:6, zIndex:6, paddingBottom:10 }}>
       <button data-notap='1' onClick={e=>{e.stopPropagation();e.preventDefault();haptic('medium');handleLike();}}
          style={{ background:'rgba(0,0,0,0.3)', border:'none', borderRadius:'50%', width:52, height:52, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
            transform: liked ? 'scale(1)' : 'scale(1)',
            transition:'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <svg width="26" height="26" viewBox="0 0 24 24"
            fill={liked?'#FF2156':'none'} stroke={liked?'#FF2156':'rgba(255,255,255,0.9)'} strokeWidth="1.8"
            style={{ animation: liked ? 'likeHeart 0.4s ease' : 'none', filter: liked ? 'drop-shadow(0 0 6px rgba(255,45,85,0.6))' : 'none' }}>
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        </button>
        <span style={{ color: liked?'#FF2156':'rgba(255,255,255,0.85)', fontSize:11, fontWeight:700, letterSpacing:0.2, transition:'color 0.2s' }}>{formatNumber(likeCount)}</span>
        <button data-notap='1' onClick={e=>{e.stopPropagation();e.preventDefault();setShowComments(true);}} style={{ background:'rgba(0,0,0,0.3)', border:'none', borderRadius:'50%', width:48, height:48, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', marginTop:4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        </button>
        <span style={{ color:'rgba(255,255,255,0.85)', fontSize:11, fontWeight:600 }}>{formatNumber(video.comments||comments.length)}</span>
        <button data-notap='1' onClick={e=>{e.stopPropagation();e.preventDefault();setShowShare(true);}} style={{ background:'rgba(0,0,0,0.3)', border:'none', borderRadius:'50%', width:48, height:48, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', marginTop:4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
        <span style={{ color:'rgba(255,255,255,0.85)', fontSize:11, fontWeight:600 }}>{formatNumber(video.shares||0)}</span>
        <button data-notap='1' onClick={e=>{e.stopPropagation();e.preventDefault();setShowActionMenu(v=>!v);}} style={{ background:'rgba(0,0,0,0.3)', border:'none', borderRadius:'50%', width:48, height:48, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', marginTop:4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </button>
      </div>

      {floatingReactions.map(r=>(
        <div key={r.id} style={{ position:'absolute', bottom:200, left:`${r.x}%`, zIndex:60, pointerEvents:'none', fontSize:36, animation:'floatUp 1.5s ease forwards' }}>{r.emoji}</div>
      ))}
      {showReactions && (
        <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', bottom:160, left:'50%', transform:'translateX(-50%)', zIndex:55, background:'rgba(20,20,20,0.95)', backdropFilter:'blur(20px)', borderRadius:50, padding:'8px 12px', display:'flex', gap:4, border:'1px solid rgba(255,255,255,0.12)', animation:'popInBounce 0.3s ease' }}>
          {REACTIONS.map(emoji=>(
            <button key={emoji} onClick={()=>handleReact(emoji)} style={{ background:'none', border:'none', fontSize:28, cursor:'pointer', padding:'4px 6px', borderRadius:30, transition:'transform 0.15s' }}
              onMouseEnter={e=>e.currentTarget.style.transform='scale(1.4)'}
              onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
            >{emoji}</button>
          ))}
        </div>
      )}

      {showComments && (
  <>
  <div onClick={()=>setShowComments(false)} style={{position:'fixed',inset:0,zIndex:9499,background:'rgba(0,0,0,0.5)'}}/>
  <div
    onClick={e => e.stopPropagation()}
    onTouchStart={e => e.stopPropagation()}
    onTouchEnd={e => e.stopPropagation()}
    style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:430, height:'60%', background:'#15151C', borderTopLeftRadius:28, borderTopRightRadius:28, zIndex:9500, display:'flex', flexDirection:'column', animation:'slideUp 0.3s ease', boxShadow:'0 -8px 40px rgba(0,0,0,0.7)' }}>
          <div style={{ padding:'16px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:'white', fontWeight:700, fontSize:16, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{t?.comments||'Comments'}</span>
            <button onClick={()=>setShowComments(false)} style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:'50%', width:32, height:32, color:'white', cursor:'pointer', fontSize:16 }}>✕</button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'14px 16px' }}>
            {pinnedComment && (
              <div style={{ background:'rgba(255,45,85,0.08)', borderRadius:14, padding:'10px 12px', marginBottom:16, border:'1px solid rgba(255,45,85,0.2)' }}>
                <div style={{ color:'#FF2156', fontSize:11, fontWeight:700, marginBottom:8 }}>📌 Pinned</div>
                <CommentItem comment={pinnedComment} currentUser={currentUser} onLike={()=>{}} onReply={()=>{}} onPin={()=>{}} />
              </div>
            )}
            {comments.length===0 && <div style={{textAlign:'center',padding:40,color:'rgba(255,255,255,0.3)',fontSize:13}}>No comments yet. Be the first! 💬</div>}
            {comments.map(comment=>(
              <CommentItem key={comment.id} comment={comment} currentUser={currentUser} onLike={async id=>{await updateDoc(doc(db,'comments',id),{likes:increment(1)});}} onReply={(c)=>setCommentText(`@${c.username} `)} onPin={id=>{const c=comments.find(cc=>cc.id===id); if(c){setPinnedComment(c); showToast?.('Pinned!','success');}}} onViewProfile={onViewProfile} onDelete={async id=>{ await deleteDoc(doc(db,'comments',id)); await updateDoc(doc(db,'videos',video.id),{comments:increment(-1)}); showToast?.('Comment deleted','success'); }} />
            ))}
          </div>
          <CommentInputBar currentUser={currentUser} commentText={commentText} setCommentText={setCommentText} onSend={() => { addComment(); }} showToast={showToast} videoId={video.id} />
        </div>
  </>
      )}
      {showShare && <ShareModal video={video} onClose={()=>setShowShare(false)} showToast={showToast} />}
    </div>
  );
});
const NotifBellButton = ({ onOpenNotifications, currentUser }) => {
  const [unread, setUnread] = useState(0);
  useEffect(()=>{
    if(!currentUser?.id) return;
    const q = query(collection(db,'notifications'), where('toUserId','==',currentUser.id), where('read','==',false));
    const unsub = onSnapshot(q, snap=>setUnread(snap.size), ()=>{});
    return ()=>unsub();
  },[currentUser?.id]);
  return (
    <button onClick={onOpenNotifications} style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'50%', width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', position:'relative' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
      {unread>0 && <div style={{ position:'absolute', top:-4, right:-4, minWidth:18, height:18, background:'#FF2156', borderRadius:9, border:'1.5px solid #000', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'white', fontWeight:800, padding:'0 3px' }}>{unread>9?'9+':unread}</div>}
    </button>
  );
};

      
/* ─────────────── JOBS & SKILLS PAGE ─────────────── */
const JobsMarketPage = ({ currentUser, showToast, mode, onViewProfile }) => {
  const [tab, setTab] = useState(mode === 'skills' || mode === 'market' ? 'market' : 'jobs');
  const [showPost, setShowPost] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [showApplicants, setShowApplicants] = useState(false);
  const [showReviewQueue, setShowReviewQueue] = useState(false);
  const [myPermissions, setMyPermissions] = useState(null); // null=loading, {}=loaded
  const [hasPostPerm, setHasPostPerm] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  // Job form
  const [jobForm, setJobForm] = useState({ title:'', company:'', location:'', type:'Full-time', salary:'', description:'', skills:'', contactEmail:'' });
  // Market form
  const [mktForm, setMktForm] = useState({ title:'', category:'', price:'', description:'', tags:'', condition:'New', contactEmail:'' });

  const jobTypes = ['Full-time','Part-time','Contract','Freelance','Internship','Remote'];
  const mktCategories = ['Electronics','Clothing','Books','Services','Food','Vehicles','Furniture','Art','Health','Other'];
  const jobFilters = [['all','All'],['Full-time','Full-time'],['Part-time','Part-time'],['Remote','Remote'],['Freelance','Freelance'],['Internship','Intern']];
  const mktFilters = [['all','All'],['Electronics','📱'],['Clothing','👕'],['Books','📚'],['Services','🛠️'],['Food','🍔'],['Vehicles','🚗']];

  // Load permissions for current user
  useEffect(() => {
    if (!currentUser?.id) return;
    if (currentUser.id === APP_CREATOR_UID) { setHasPostPerm(true); setMyPermissions({}); return; }
    const unsub = onSnapshot(doc(db, 'postPermissions', currentUser.id), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setMyPermissions(d);
        setHasPostPerm(d.canPostJobs === true || d.canPostMarket === true);
      } else {
        setMyPermissions({});
        setHasPostPerm(false);
      }
    }, () => { setMyPermissions({}); setHasPostPerm(false); });
    return () => unsub();
  }, [currentUser?.id]);

  // Check if request already sent
  useEffect(() => {
    if (!currentUser?.id) return;
    getDoc(doc(db, 'permissionRequests', currentUser.id)).then(snap => setRequestSent(snap.exists())).catch(() => {});
  }, [currentUser?.id]);

  // Load items
  useEffect(() => {
    setLoading(true);
    const col = tab === 'jobs' ? 'jobs' : 'marketItems';
    const q = query(collection(db, col), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [tab]);

  const canPost = () => {
    if (currentUser?.id === APP_CREATOR_UID) return true;
    if (tab === 'jobs') return myPermissions?.canPostJobs === true;
    if (tab === 'market') return myPermissions?.canPostMarket === true;
    return false;
  };

  const requestPermission = async () => {
    if (!currentUser?.id) return;
    await setDoc(doc(db, 'permissionRequests', currentUser.id), {
      userId: currentUser.id,
      username: currentUser.username,
      avatarUrl: currentUser.avatarUrl || null,
      avatarColor: currentUser.avatarColor || '#FF2156',
      requestedAt: serverTimestamp(),
      type: tab,
      status: 'pending'
    });
    // Notify app creator
    await addDoc(collection(db, 'notifications'), {
      toUserId: APP_CREATOR_UID,
      fromUserId: currentUser.id,
      type: 'permissionRequest',
      message: `@${currentUser.username} requested permission to post in ${tab}`,
      requestType: tab,
      read: false,
      createdAt: serverTimestamp()
    });
    setRequestSent(true);
    showToast?.('Permission request sent! ✅', 'success');
  };

  const postJob = async () => {
    if (!jobForm.title.trim() || !jobForm.company.trim()) { showToast?.('Title and company required', 'error'); return; }
    if (!canPost()) { showToast?.('You need permission to post jobs', 'error'); return; }
    const flagged = isLikelyFakePost(jobForm);
    const ref = await addDoc(collection(db, 'jobs'), {
      ...jobForm, userId: currentUser?.id, username: currentUser?.username,
      avatarUrl: currentUser?.avatarUrl || null, avatarColor: currentUser?.avatarColor || '#FF2156',
      createdAt: serverTimestamp(), applicantCount: 0, saved: [], status: 'active',
      reviewFlag: flagged ? 'pending' : null
    });
    if (flagged) {
      await addDoc(collection(db, 'notifications'), {
        toUserId: APP_CREATOR_UID, fromUserId: currentUser?.id, type: 'reviewFlag',
        message: `⚠️ New job post by @${currentUser?.username} was auto-flagged for review: "${jobForm.title}"`,
        itemType: 'jobs', itemId: ref.id, read: false, createdAt: serverTimestamp()
      });
    }
    showToast?.('Job posted! 🎉', 'success');
    setShowPost(false);
    setJobForm({ title:'', company:'', location:'', type:'Full-time', salary:'', description:'', skills:'', contactEmail:'' });
  };

  const postMarket = async () => {
    if (!mktForm.title.trim() || !mktForm.price.trim()) { showToast?.('Title and price required', 'error'); return; }
    if (!canPost()) { showToast?.('You need permission to post in market', 'error'); return; }
    const flagged = isLikelyFakePost(mktForm);
    const ref = await addDoc(collection(db, 'marketItems'), {
      ...mktForm, userId: currentUser?.id, username: currentUser?.username,
      avatarUrl: currentUser?.avatarUrl || null, avatarColor: currentUser?.avatarColor || '#FF2156',
      createdAt: serverTimestamp(), saved: [], status: 'available',
      reviewFlag: flagged ? 'pending' : null
    });
    if (flagged) {
      await addDoc(collection(db, 'notifications'), {
        toUserId: APP_CREATOR_UID, fromUserId: currentUser?.id, type: 'reviewFlag',
        message: `⚠️ New market listing by @${currentUser?.username} was auto-flagged for review: "${mktForm.title}"`,
        itemType: 'marketItems', itemId: ref.id, read: false, createdAt: serverTimestamp()
      });
    }
    showToast?.('Listed in market! 🛒', 'success');
    setShowPost(false);
    setMktForm({ title:'', category:'', price:'', description:'', tags:'', condition:'New', contactEmail:'' });
  };

  // Report a Job/Market listing as fake/suspicious — sends to creator review queue
  const reportListing = async (item) => {
    if (!currentUser?.id) return;
    const col = tab === 'jobs' ? 'jobs' : 'marketItems';
    await updateDoc(doc(db, col, item.id), { reviewFlag: 'pending' }).catch(()=>{});
    await addDoc(collection(db, 'reports'), {
      itemType: col, itemId: item.id, itemTitle: item.title,
      reportedBy: currentUser.id, reason: 'Reported as possibly fake', createdAt: serverTimestamp()
    });
    await addDoc(collection(db, 'notifications'), {
      toUserId: APP_CREATOR_UID, fromUserId: currentUser.id, type: 'reviewFlag',
      message: `🚩 @${currentUser.username} reported a ${tab==='jobs'?'job':'listing'} as possibly fake: "${item.title}"`,
      itemType: col, itemId: item.id, read: false, createdAt: serverTimestamp()
    });
    showToast?.('Reported for review ✅', 'success');
  };


  const applyJob = async (item) => {
    if (!currentUser?.id) return;
    const appId = `${item.id}_${currentUser.id}`;
    const exists = await getDoc(doc(db, 'jobApplications', appId));
    if (exists.exists()) { showToast?.('Already applied!', 'info'); return; }
    // Save application with full user profile snapshot
    await setDoc(doc(db, 'jobApplications', appId), {
      jobId: item.id, jobTitle: item.title, company: item.company,
      applicantId: currentUser.id, applicantUsername: currentUser.username,
      applicantAvatarUrl: currentUser.avatarUrl || null, applicantAvatarColor: currentUser.avatarColor || '#FF2156',
      applicantBio: currentUser.bio || '', applicantFollowers: (currentUser.followers||[]).length,
      applicantJoinedAt: currentUser.createdAt || null,
      appliedAt: serverTimestamp(), status: 'pending'
    });
    // Increment counter on job
    await updateDoc(doc(db, 'jobs', item.id), { applicantCount: increment(1) }).catch(() => {});
    // Notify job poster
    await addDoc(collection(db, 'notifications'), {
      toUserId: item.userId, fromUserId: currentUser.id, type: 'jobApplication',
      message: `applied for your job: ${item.title}`, jobId: item.id,
      read: false, createdAt: serverTimestamp()
    });
    // Notify applicant of next steps
    await addDoc(collection(db, 'notifications'), {
      toUserId: currentUser.id, fromUserId: item.userId, type: 'applicationReceived',
      message: `Your application for "${item.title}" at ${item.company} was received. The employer will review and contact you.`,
      jobId: item.id, read: false, createdAt: serverTimestamp()
    });
    showToast?.('Applied! ✅ You will be notified of next steps.', 'success');
  };

  const loadApplicants = async (item) => {
    setSelectedItem(item);
    setShowApplicants(true);
    const q = query(collection(db, 'jobApplications'), where('jobId', '==', item.id));
    const snap = await getDocs(q);
    setApplicants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const updateApplicantStatus = async (appId, status, applicantId, jobTitle) => {
    await updateDoc(doc(db, 'jobApplications', appId), { status });
    // Notify applicant of status update
    const msgs = { shortlisted: `🎉 Great news! You've been shortlisted for "${jobTitle}". Expect a follow-up soon.`, rejected: `Your application for "${jobTitle}" was not selected this time. Keep applying!`, hired: `🎊 Congratulations! You've been selected for "${jobTitle}". Please check your contact email.` };
    if (msgs[status]) {
      await addDoc(collection(db, 'notifications'), {
        toUserId: applicantId, fromUserId: currentUser.id, type: 'applicationUpdate',
        message: msgs[status], read: false, createdAt: serverTimestamp()
      });
    }
    showToast?.(`Marked as ${status} ✅`, 'success');
    // Refresh list
    setApplicants(prev => prev.map(a => a.id === appId ? { ...a, status } : a));
  };

  const saveItem = async (item) => {
    const col = tab === 'jobs' ? 'jobs' : 'marketItems';
    const isSaved = (item.saved || []).includes(currentUser?.id);
    await updateDoc(doc(db, col, item.id), { saved: isSaved ? arrayRemove(currentUser?.id) : arrayUnion(currentUser?.id) }).catch(() => {});
    showToast?.(isSaved ? 'Removed' : 'Saved! 🔖', isSaved ? 'info' : 'success');
  };

  const filters = tab === 'jobs' ? jobFilters : mktFilters;
  const isCreator = currentUser?.id === APP_CREATOR_UID;
  const displayItems = items.filter(it => {
    // Pending-review items only visible to their owner and the app creator
    if (it.reviewFlag === 'pending' && it.userId !== currentUser?.id && !isCreator) return false;
    const matchFilter = filter === 'all' || (tab === 'jobs' ? it.type === filter : it.category === filter);
    const matchSearch = !search || it.title?.toLowerCase().includes(search.toLowerCase()) || it.company?.toLowerCase().includes(search.toLowerCase()) || it.description?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const inputStyle = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'12px 14px', color:'white', outline:'none', fontSize:13, boxSizing:'border-box', fontFamily:"'Inter',-apple-system,sans-serif" };
  const labelStyle = { color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, marginBottom:6, display:'block' };

  // Applicants Modal
  if (showApplicants && selectedItem) return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#0B0B0F' }}>
      <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={()=>{ setShowApplicants(false); setApplicants([]); }} style={{ background:'none', border:'none', color:'white', fontSize:20, cursor:'pointer' }}>←</button>
        <div>
          <div style={{ color:'white', fontWeight:800, fontSize:16 }}>{selectedItem.title}</div>
          <div style={{ color:'rgba(255,255,255,0.4)', fontSize:12 }}>{applicants.length} applicant{applicants.length!==1?'s':''}</div>
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:14 }}>
        {applicants.length === 0 && <div style={{ textAlign:'center', padding:60, color:'rgba(255,255,255,0.3)' }}><div style={{ fontSize:40, marginBottom:12 }}>📋</div><div>No applicants yet</div></div>}
        {applicants.map(app => (
          <div key={app.id} style={{ background:'rgba(255,255,255,0.03)', borderRadius:18, padding:16, marginBottom:12, border:'1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <div onClick={()=>{ setShowApplicants(false); onViewProfile?.(app.applicantId); }} style={{ width:48, height:48, borderRadius:'50%', background:app.applicantAvatarColor||'#FF2156', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:20, overflow:'hidden', cursor:'pointer', flexShrink:0 }}>
                {app.applicantAvatarUrl ? <img src={app.applicantAvatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (app.applicantUsername||'?')[0].toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:'white', fontWeight:700, fontSize:15 }}>@{app.applicantUsername}</div>
                <div style={{ color:'rgba(255,255,255,0.4)', fontSize:12 }}>{app.applicantFollowers||0} followers</div>
                {app.applicantBio && <div style={{ color:'rgba(255,255,255,0.5)', fontSize:12, marginTop:2 }}>{app.applicantBio}</div>}
              </div>
              <div style={{ background: app.status==='hired'?'rgba(52,199,89,0.15)':app.status==='shortlisted'?'rgba(255,204,0,0.15)':app.status==='rejected'?'rgba(255,59,48,0.15)':'rgba(255,255,255,0.08)', border:`1px solid ${app.status==='hired'?'rgba(52,199,89,0.4)':app.status==='shortlisted'?'rgba(255,204,0,0.4)':app.status==='rejected'?'rgba(255,59,48,0.4)':'rgba(255,255,255,0.15)'}`, borderRadius:20, padding:'4px 10px', color:app.status==='hired'?'#2ED573':app.status==='shortlisted'?'#FFD60A':app.status==='rejected'?'#FF453A':'rgba(255,255,255,0.5)', fontSize:11, fontWeight:700 }}>{app.status||'pending'}</div>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
              <span style={{ background:'rgba(255,255,255,0.05)', borderRadius:20, padding:'3px 10px', color:'rgba(255,255,255,0.4)', fontSize:11 }}>📅 {app.appliedAt?.toDate?.()?.toLocaleDateString?.() || 'N/A'}</span>
              <span style={{ background:'rgba(255,255,255,0.05)', borderRadius:20, padding:'3px 10px', color:'rgba(255,255,255,0.4)', fontSize:11 }}>🕐 {app.appliedAt?.toDate?.()?.toLocaleTimeString?.([],{hour:'2-digit',minute:'2-digit'}) || ''}</span>
            </div>
            {currentUser?.id === selectedItem.userId && (
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>updateApplicantStatus(app.id,'shortlisted',app.applicantId,selectedItem.title)} style={{ flex:1, background:'rgba(255,204,0,0.12)', border:'1px solid rgba(255,204,0,0.3)', borderRadius:14, padding:'9px 0', color:'#FFD60A', fontSize:12, fontWeight:700, cursor:'pointer' }}>⭐ Shortlist</button>
                <button onClick={()=>updateApplicantStatus(app.id,'hired',app.applicantId,selectedItem.title)} style={{ flex:1, background:'rgba(52,199,89,0.12)', border:'1px solid rgba(52,199,89,0.3)', borderRadius:14, padding:'9px 0', color:'#2ED573', fontSize:12, fontWeight:700, cursor:'pointer' }}>✅ Hire</button>
                <button onClick={()=>updateApplicantStatus(app.id,'rejected',app.applicantId,selectedItem.title)} style={{ flex:1, background:'rgba(255,59,48,0.1)', border:'1px solid rgba(255,59,48,0.2)', borderRadius:14, padding:'9px 0', color:'#FF453A', fontSize:12, fontWeight:700, cursor:'pointer' }}>✕ Pass</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Review Queue Modal — creator-only, lists flagged jobs & market items
  if (showReviewQueue) {
    const pending = items.filter(it => it.reviewFlag === 'pending');
    const col = tab === 'jobs' ? 'jobs' : 'marketItems';
    const approveItem = async (item) => {
      await updateDoc(doc(db, col, item.id), { reviewFlag: null }).catch(()=>{});
      showToast?.('Post approved ✅', 'success');
    };
    const removeItem = async (item) => {
      await deleteDoc(doc(db, col, item.id)).catch(()=>{});
      await addDoc(collection(db, 'notifications'), {
        toUserId: item.userId, fromUserId: currentUser.id, type: 'postRemoved',
        message: `Your ${tab==='jobs'?'job post':'market listing'} "${item.title}" was removed for violating posting guidelines.`,
        read: false, createdAt: serverTimestamp()
      });
      showToast?.('Post removed', 'info');
    };
    return (
      <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#0B0B0F' }}>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={()=>setShowReviewQueue(false)} style={{ background:'none', border:'none', color:'white', fontSize:20, cursor:'pointer' }}>←</button>
          <div style={{ color:'white', fontWeight:800, fontSize:16 }}>Review Queue — {tab==='jobs'?'Jobs':'Market'}</div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:14 }}>
          {pending.length === 0 && (
            <div style={{ textAlign:'center', padding:60, color:'rgba(255,255,255,0.3)' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
              <div>Nothing pending review</div>
            </div>
          )}
          {pending.map(item => (
            <div key={item.id} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,149,0,0.25)', borderRadius:18, padding:14, marginBottom:12 }}>
              <div style={{ color:'white', fontWeight:800, fontSize:15, marginBottom:4 }}>{item.title}</div>
              <div style={{ color:'rgba(255,255,255,0.5)', fontSize:12, marginBottom:8 }}>by @{item.username}{item.company ? ' · '+item.company : ''}</div>
              {item.description && <div style={{ color:'rgba(255,255,255,0.5)', fontSize:12, lineHeight:1.5, marginBottom:10 }}>{item.description.length>200?item.description.slice(0,200)+'...':item.description}</div>}
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>approveItem(item)} style={{ flex:1, background:'rgba(52,199,89,0.12)', border:'1px solid rgba(52,199,89,0.3)', borderRadius:14, padding:'9px 0', color:'#2ED573', fontSize:12, fontWeight:700, cursor:'pointer' }}>✅ Approve</button>
                <button onClick={()=>removeItem(item)} style={{ flex:1, background:'rgba(255,59,48,0.1)', border:'1px solid rgba(255,59,48,0.2)', borderRadius:14, padding:'9px 0', color:'#FF453A', fontSize:12, fontWeight:700, cursor:'pointer' }}>🗑️ Remove</button>
                <button onClick={()=>onViewProfile?.(item.userId)} style={{ width:38, height:38, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, color:'rgba(255,255,255,0.4)', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>👤</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Post Form Modal
  if (showPost) return (
    <div style={{ height:'100%', overflow:'auto', background:'#0B0B0F', padding:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button onClick={()=>setShowPost(false)} style={{ background:'rgba(255,255,255,0.05)', border:'none', borderRadius:20, padding:'8px 16px', color:'white', cursor:'pointer', fontSize:13 }}>← Back</button>
        <div style={{ color:'white', fontWeight:800, fontSize:18 }}>{tab==='jobs'?'Post a Job':'List in Market'}</div>
      </div>
      {tab === 'jobs' ? (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div><label style={labelStyle}>Job Title *</label><input value={jobForm.title} onChange={e=>setJobForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Senior Designer" style={inputStyle} /></div>
          <div><label style={labelStyle}>Company *</label><input value={jobForm.company} onChange={e=>setJobForm(f=>({...f,company:e.target.value}))} placeholder="Company name" style={inputStyle} /></div>
          <div><label style={labelStyle}>Location</label><input value={jobForm.location} onChange={e=>setJobForm(f=>({...f,location:e.target.value}))} placeholder="City, Country or Remote" style={inputStyle} /></div>
          <div><label style={labelStyle}>Type</label><div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>{jobTypes.map(t=><button key={t} onClick={()=>setJobForm(f=>({...f,type:t}))} style={{ background:jobForm.type===t?'rgba(255,45,85,0.15)':'rgba(255,255,255,0.04)', border:`1px solid ${jobForm.type===t?'rgba(255,45,85,0.4)':'rgba(255,255,255,0.08)'}`, borderRadius:20, padding:'7px 14px', color:jobForm.type===t?'#FF2156':'rgba(255,255,255,0.5)', fontSize:12, fontWeight:jobForm.type===t?700:400, cursor:'pointer' }}>{t}</button>)}</div></div>
          <div><label style={labelStyle}>Salary / Compensation</label><input value={jobForm.salary} onChange={e=>setJobForm(f=>({...f,salary:e.target.value}))} placeholder="e.g. $2,000/mo or Negotiable" style={inputStyle} /></div>
          <div><label style={labelStyle}>Description</label><textarea value={jobForm.description} onChange={e=>setJobForm(f=>({...f,description:e.target.value}))} placeholder="Job description, requirements, responsibilities..." rows={4} style={{ ...inputStyle, resize:'none', lineHeight:1.5 }} /></div>
          <div><label style={labelStyle}>Required Skills</label><input value={jobForm.skills} onChange={e=>setJobForm(f=>({...f,skills:e.target.value}))} placeholder="e.g. React, Figma, Python" style={inputStyle} /></div>
          <div><label style={labelStyle}>Contact Email</label><input value={jobForm.contactEmail} onChange={e=>setJobForm(f=>({...f,contactEmail:e.target.value}))} placeholder="For applicants to reach you" style={inputStyle} /></div>
          <button onClick={postJob} style={{ width:'100%', background:'linear-gradient(135deg,#FF2156,#9D4EDD)', border:'none', borderRadius:20, padding:'15px 0', color:'white', fontWeight:800, fontSize:15, cursor:'pointer', marginTop:8 }}>Post Job 💼</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div><label style={labelStyle}>Title *</label><input value={mktForm.title} onChange={e=>setMktForm(f=>({...f,title:e.target.value}))} placeholder="What are you selling?" style={inputStyle} /></div>
          <div><label style={labelStyle}>Category</label><div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>{mktCategories.map(c=><button key={c} onClick={()=>setMktForm(f=>({...f,category:c}))} style={{ background:mktForm.category===c?'rgba(0,122,255,0.15)':'rgba(255,255,255,0.04)', border:`1px solid ${mktForm.category===c?'rgba(0,122,255,0.4)':'rgba(255,255,255,0.08)'}`, borderRadius:20, padding:'7px 14px', color:mktForm.category===c?'#0A84FF':'rgba(255,255,255,0.5)', fontSize:12, fontWeight:mktForm.category===c?700:400, cursor:'pointer' }}>{c}</button>)}</div></div>
          <div><label style={labelStyle}>Condition</label><div style={{ display:'flex', gap:6 }}>{['New','Like New','Good','Fair'].map(c=><button key={c} onClick={()=>setMktForm(f=>({...f,condition:c}))} style={{ flex:1, background:mktForm.condition===c?'rgba(52,199,89,0.15)':'rgba(255,255,255,0.04)', border:`1px solid ${mktForm.condition===c?'rgba(52,199,89,0.4)':'rgba(255,255,255,0.08)'}`, borderRadius:14, padding:'8px 0', color:mktForm.condition===c?'#2ED573':'rgba(255,255,255,0.5)', fontSize:12, fontWeight:mktForm.condition===c?700:400, cursor:'pointer' }}>{c}</button>)}</div></div>
          <div><label style={labelStyle}>Price *</label><input value={mktForm.price} onChange={e=>setMktForm(f=>({...f,price:e.target.value}))} placeholder="e.g. $50 or Free" style={inputStyle} /></div>
          <div><label style={labelStyle}>Description</label><textarea value={mktForm.description} onChange={e=>setMktForm(f=>({...f,description:e.target.value}))} placeholder="Describe the item, features, specs..." rows={3} style={{ ...inputStyle, resize:'none', lineHeight:1.5 }} /></div>
          <div><label style={labelStyle}>Tags</label><input value={mktForm.tags} onChange={e=>setMktForm(f=>({...f,tags:e.target.value}))} placeholder="electronics, phone, apple..." style={inputStyle} /></div>
          <div><label style={labelStyle}>Contact Email</label><input value={mktForm.contactEmail} onChange={e=>setMktForm(f=>({...f,contactEmail:e.target.value}))} placeholder="Buyers will contact you here" style={inputStyle} /></div>
          <button onClick={postMarket} style={{ width:'100%', background:'linear-gradient(135deg,#0A84FF,#2ED573)', border:'none', borderRadius:20, padding:'15px 0', color:'white', fontWeight:800, fontSize:15, cursor:'pointer', marginTop:8 }}>List Item 🛒</button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#0B0B0F', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'14px 16px 0', background:'#0B0B0F', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <div style={{ display:'flex', gap:20 }}>
            {[['jobs','💼 Jobs'],['market','🛒 Market']].map(([id,label])=>(
              <button key={id} onClick={()=>{ setTab(id); setFilter('all'); setSearch(''); }} style={{ background:'none', border:'none', color:tab===id?'white':'rgba(255,255,255,0.4)', fontWeight:tab===id?800:500, fontSize:16, cursor:'pointer', paddingBottom:8, borderBottom:tab===id?'2.5px solid #FF2156':'2.5px solid transparent', fontFamily:"'Inter',-apple-system,sans-serif", transition:'all 0.2s' }}>{label}</button>
            ))}
          </div>
          {canPost() ? (
            <button onClick={()=>setShowPost(true)} style={{ background:'linear-gradient(135deg,#FF2156,#9D4EDD)', border:'none', borderRadius:20, padding:'8px 16px', color:'white', fontWeight:700, fontSize:12, cursor:'pointer' }}>+ Post</button>
          ) : (
            myPermissions !== null && (
              requestSent
                ? <span style={{ color:'rgba(255,255,255,0.3)', fontSize:11 }}>Request pending...</span>
                : <button onClick={requestPermission} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:20, padding:'8px 14px', color:'rgba(255,255,255,0.7)', fontWeight:600, fontSize:12, cursor:'pointer' }}>Request to Post</button>
            )
          )}
          {isCreator && (
            <button onClick={()=>setShowReviewQueue(true)} style={{ marginLeft:8, background:'rgba(255,149,0,0.12)', border:'1px solid rgba(255,149,0,0.3)', borderRadius:20, padding:'8px 14px', color:'#FFB100', fontWeight:700, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              🔍 Review{items.some(it=>it.reviewFlag==='pending') ? ` (${items.filter(it=>it.reviewFlag==='pending').length})` : ''}
            </button>
          )}
        </div>
        {/* Search */}
        <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:22, display:'flex', alignItems:'center', padding:'9px 14px', gap:8, marginBottom:10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==='jobs'?'Search jobs...':'Search market...'} style={{ flex:1, background:'none', border:'none', color:'white', outline:'none', fontSize:13 }} />
          {search && <button onClick={()=>setSearch('')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:14 }}>✕</button>}
        </div>
        {/* Filters */}
        <div style={{ display:'flex', gap:7, overflowX:'auto', paddingBottom:10 }}>
          {filters.map(([id,label])=>(
            <button key={id} onClick={()=>setFilter(id)} style={{ background:filter===id?'rgba(255,45,85,0.15)':'rgba(255,255,255,0.04)', border:`1px solid ${filter===id?'rgba(255,45,85,0.4)':'rgba(255,255,255,0.08)'}`, borderRadius:20, padding:'5px 13px', color:filter===id?'#FF2156':'rgba(255,255,255,0.5)', fontSize:12, fontWeight:filter===id?700:400, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>{label}</button>
          ))}
        </div>
      </div>
      {/* List */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 12px 16px' }}>
        {loading && <div style={{ textAlign:'center', padding:40 }}><div style={{ width:28, height:28, border:'3px solid rgba(255,45,85,0.3)', borderTop:'3px solid #FF2156', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto' }} /></div>}
        {!loading && displayItems.length === 0 && (
          <div style={{ textAlign:'center', padding:60, color:'rgba(255,255,255,0.2)' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>{tab==='jobs'?'💼':'🛒'}</div>
            <div style={{ fontSize:14 }}>No {tab==='jobs'?'jobs':'listings'} yet</div>
            {!canPost() && !requestSent && <button onClick={requestPermission} style={{ marginTop:16, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:20, padding:'10px 20px', color:'white', fontSize:13, cursor:'pointer' }}>Request to Post</button>}
          </div>
        )}
        {displayItems.map(item => {
          const isOwner = item.userId === currentUser?.id;
          const isSaved = (item.saved||[]).includes(currentUser?.id);
          return (
            <div key={item.id} style={{ background:'rgba(255,255,255,0.03)', borderRadius:20, padding:16, marginBottom:12, border: item.reviewFlag==='pending' ? '1px solid rgba(255,149,0,0.35)' : '1px solid rgba(255,255,255,0.07)' }}>
              {item.reviewFlag === 'pending' && (
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10, background:'rgba(255,149,0,0.1)', border:'1px solid rgba(255,149,0,0.25)', borderRadius:12, padding:'6px 10px', color:'#FFB100', fontSize:11, fontWeight:700 }}>
                  ⏳ {isOwner ? 'Pending review — only visible to you until cleared' : 'Under review by moderators'}
                </div>
              )}
              <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                <div onClick={()=>onViewProfile?.(item.userId)} style={{ width:44, height:44, borderRadius:14, background:item.avatarColor||'#FF2156', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:18, flexShrink:0, overflow:'hidden', cursor:'pointer' }}>
                  {item.avatarUrl ? <img src={item.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : (item.username||'?')[0].toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                    <div style={{ color:'white', fontWeight:800, fontSize:15 }}>{item.title}</div>
                    {item.status === 'available' && tab==='market' && <span style={{ background:'rgba(52,199,89,0.12)', border:'1px solid rgba(52,199,89,0.25)', borderRadius:20, padding:'1px 8px', color:'#2ED573', fontSize:10, fontWeight:700 }}>Available</span>}
                    {item.status === 'active' && tab==='jobs' && <span style={{ background:'rgba(0,122,255,0.12)', border:'1px solid rgba(0,122,255,0.25)', borderRadius:20, padding:'1px 8px', color:'#0A84FF', fontSize:10, fontWeight:700 }}>Hiring</span>}
                  </div>
                  {tab==='jobs' ? (
                    <>
                      <div style={{ color:'rgba(255,255,255,0.6)', fontSize:13, marginBottom:4 }}>{item.company}{item.location?' · '+item.location:''}</div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
                        <span style={{ background:'rgba(255,45,85,0.12)', border:'1px solid rgba(255,45,85,0.25)', borderRadius:20, padding:'2px 10px', color:'#FF2156', fontSize:11, fontWeight:700 }}>{item.type}</span>
                        {item.salary && <span style={{ background:'rgba(52,199,89,0.1)', border:'1px solid rgba(52,199,89,0.25)', borderRadius:20, padding:'2px 10px', color:'#2ED573', fontSize:11 }}>{item.salary}</span>}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ color:'rgba(255,255,255,0.6)', fontSize:13, marginBottom:4 }}>by @{item.username}</div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
                        <span style={{ background:'rgba(0,122,255,0.12)', border:'1px solid rgba(0,122,255,0.25)', borderRadius:20, padding:'2px 10px', color:'#0A84FF', fontSize:11, fontWeight:700 }}>{item.price}</span>
                        {item.category && <span style={{ background:'rgba(255,255,255,0.07)', borderRadius:20, padding:'2px 10px', color:'rgba(255,255,255,0.5)', fontSize:11 }}>{item.category}</span>}
                        {item.condition && <span style={{ background:'rgba(255,204,0,0.08)', border:'1px solid rgba(255,204,0,0.2)', borderRadius:20, padding:'2px 10px', color:'#FFD60A', fontSize:11 }}>{item.condition}</span>}
                      </div>
                    </>
                  )}
                  {item.description && <div style={{ color:'rgba(255,255,255,0.5)', fontSize:12, lineHeight:1.5, marginBottom:8 }}>{item.description.length>150?item.description.slice(0,150)+'...':item.description}</div>}
                  {item.skills && tab==='jobs' && <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, marginBottom:8 }}>🛠️ {item.skills}</div>}
                  {item.tags && tab==='market' && <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, marginBottom:8 }}>#{item.tags.split(',').map(t=>t.trim()).join(' #')}</div>}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {tab==='jobs' ? (
                      isOwner ? (
                        <button onClick={()=>loadApplicants(item)} style={{ flex:1, background:'rgba(255,45,85,0.12)', border:'1px solid rgba(255,45,85,0.3)', borderRadius:14, padding:'9px 0', color:'#FF2156', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                          📋 {item.applicantCount||0} Applicants
                        </button>
                      ) : (
                        <button onClick={()=>applyJob(item)} style={{ flex:1, background:'linear-gradient(135deg,#FF2156,#9D4EDD)', border:'none', borderRadius:14, padding:'9px 0', color:'white', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                          Apply Now
                        </button>
                      )
                    ) : (
                      <button onClick={()=>{ if(item.contactEmail) { navigator.clipboard?.writeText?.(item.contactEmail); showToast?.('Contact email copied!','success'); } else showToast?.('Contact via profile','info'); }} style={{ flex:1, background:'linear-gradient(135deg,#0A84FF,#2ED573)', border:'none', borderRadius:14, padding:'9px 0', color:'white', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                        Contact Seller
                      </button>
                    )}
                    <button onClick={()=>saveItem(item)} style={{ width:38, height:38, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, color:isSaved?'#FFD60A':'rgba(255,255,255,0.4)', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>{isSaved?'🔖':'📌'}</button>
                    <button onClick={()=>onViewProfile?.(item.userId)} style={{ width:38, height:38, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, color:'rgba(255,255,255,0.4)', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>👤</button>
                    {!isOwner && item.reviewFlag !== 'pending' && (
                      <button onClick={()=>reportListing(item)} title="Report as fake" style={{ width:38, height:38, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, color:'rgba(255,255,255,0.4)', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>🚩</button>
                    )}
                  </div>
                  {item.contactEmail && !isOwner && tab==='jobs' && <div style={{ color:'rgba(255,255,255,0.3)', fontSize:11, marginTop:6 }}>📧 {item.contactEmail}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─────────────── HOME FEED ─────────────── */

const SuggestedUsers = ({ currentUser, users, followed, onFollow, onViewProfile }) => {
  const suggestions = useMemo(()=>
    users
      .filter(u=>u.id!==currentUser?.id && !(followed||[]).includes(u.id))
      .sort((a,b)=>(b.followers?.length||0)-(a.followers?.length||0))
      .slice(0,10)
  ,[users, followed, currentUser]);

  if(!suggestions.length) return null;

  return (
    <div style={{padding:'12px 0 8px'}}>
      <div style={{color:'rgba(255,255,255,0.4)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,padding:'0 16px',marginBottom:10}}>
        Suggested for you
      </div>
      <div style={{display:'flex',gap:10,overflowX:'auto',padding:'0 16px 4px'}}>
        {suggestions.map(u=>(
          <div key={u.id} style={{flexShrink:0,textAlign:'center',background:'rgba(255,255,255,0.04)',borderRadius:20,padding:'14px 10px',width:110,border:'1px solid rgba(255,255,255,0.06)'}}>
            <div onClick={()=>onViewProfile?.(u.id)} style={{width:52,height:52,borderRadius:'50%',background:u.avatarColor,margin:'0 auto 8px',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'bold',fontSize:20,overflow:'hidden',cursor:'pointer'}}>
              {u.avatarUrl?<img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:u.avatar}
            </div>
            <div style={{color:'white',fontSize:11,fontWeight:700,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>@{u.username}</div>
            <div style={{color:'rgba(255,255,255,0.3)',fontSize:10,marginBottom:8}}>{formatNumber(u.followers?.length||0)} followers</div>
            <button onClick={()=>onFollow?.(u.id)} style={{background:'linear-gradient(135deg,#FF2156,#9D4EDD)',border:'none',borderRadius:20,padding:'5px 0',color:'white',fontSize:11,fontWeight:700,cursor:'pointer',width:'100%'}}>
              Follow
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
/* ─────────────── FEATURED JOBS & MARKET CAROUSEL (For You) ─────────────── */
const FeaturedJobsMarket = ({ onOpenCategory }) => {
  const [jobs, setJobs] = useState([]);
  const [market, setMarket] = useState([]);

  useEffect(() => {
    const qJobs = query(collection(db, 'jobs'), orderBy('createdAt','desc'), limit(20));
    const unsubJobs = onSnapshot(qJobs, snap => {
      setJobs(snap.docs.map(d=>({id:d.id,...d.data()})).filter(it=>it.status==='active' && it.reviewFlag!=='pending').slice(0,5));
    }, ()=>{});
    const qMkt = query(collection(db, 'marketItems'), orderBy('createdAt','desc'), limit(20));
    const unsubMkt = onSnapshot(qMkt, snap => {
      setMarket(snap.docs.map(d=>({id:d.id,...d.data()})).filter(it=>it.status==='available' && it.reviewFlag!=='pending').slice(0,5));
    }, ()=>{});
    return () => { unsubJobs(); unsubMkt(); };
  }, []);

  const items = useMemo(()=>[
    ...jobs.map(j=>({...j, _kind:'jobs'})),
    ...market.map(m=>({...m, _kind:'skills'})),
  ], [jobs, market]);

  if (!items.length) return null;

  return (
    <div data-notap='1' style={{ position:'absolute', top:54, left:0, right:0, zIndex:9, padding:'0 0 4px' }}>
      <div style={{ display:'flex', overflowX:'auto', gap:8, padding:'0 12px', WebkitOverflowScrolling:'touch' }}>
        {items.map(item=>(
          <button key={item._kind+item.id} data-notap='1' onClick={e=>{e.stopPropagation(); onOpenCategory?.(item._kind);}}
            style={{ flexShrink:0, display:'flex', alignItems:'center', gap:8, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:18, padding:'7px 12px 7px 8px', cursor:'pointer', maxWidth:220 }}>
            <span style={{ fontSize:16 }}>{item._kind==='jobs'?'💼':'🛒'}</span>
            <div style={{ textAlign:'left', minWidth:0 }}>
              <div style={{ color:'white', fontSize:11.5, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title}</div>
              <div style={{ color:'rgba(255,255,255,0.55)', fontSize:10, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {item._kind==='jobs' ? (item.company||'Hiring') : (item.price||'For sale')}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};


/* ─────────────── HOME FEED (COUPLES ENHANCED) ─────────────── */
const HomeFeedIcon = ({ type, color = '#666' }) => {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (type) {
    case 'photo':
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>;
    case 'video':
      return <svg {...common}><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/></svg>;
    case 'poll':
      return <svg {...common}><path d="M4 20V10M12 20V4M20 20v-7"/></svg>;
    case 'feeling':
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
    default:
      return null;
  }
};

const HomeFeedHeart = ({ size = 18, filled = true, color = 'white' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth="2">
    <path d="M12 21s-6.7-4.35-9.3-8.1C.8 10.2 1.4 6.6 4.4 5.1c2.4-1.2 5 .1 6 2.3.9-2.2 3.6-3.5 6-2.3 3 1.5 3.6 5.1 1.7 7.8C18.7 16.65 12 21 12 21z" />
  </svg>
);

const homeFeedTimeAgo = (val) => {
  const d = val?.toDate ? val.toDate() : (val instanceof Date ? val : (val?.seconds ? new Date(val.seconds * 1000) : null));
  if (!d) return '';
  const diff = Math.max(0, Date.now() - d.getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const HomeFeedStoryAvatar = ({ label, src, isYou, hasRing, onClick }) => (
  <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, cursor: 'pointer', width: 64 }}>
    <div style={{ position: 'relative', width: 58, height: 58 }}>
      <div style={{ width: 58, height: 58, borderRadius: '50%', padding: hasRing ? 2.5 : 0, background: hasRing ? 'linear-gradient(135deg,#FF8FB3,#7C6DFF)' : 'transparent', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: hasRing ? '2px solid white' : '2px solid #F0F0F0', background: '#eee' }}>
          <ProgressiveImage src={src} alt={label} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
      {isYou && (
        <div style={{ position: 'absolute', bottom: -1, right: -1, width: 19, height: 19, borderRadius: '50%', background: '#FF4F7E', border: '2.5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>+</div>
      )}
    </div>
    <span style={{ fontSize: 11.5, color: '#444', fontWeight: 500, maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
  </div>
);

const HomeFeed = ({ t, videos, onLike, onComment, onShare, onFollow, onMessage, onVoiceCall, onVideoCall, onDuet, onStitch, onSaveSound, followed, showToast, onLive, currentUser, onViewProfile, onOpenSearch, onOpenNotifications, blockedUsers, onBlock, users }) => {
  const firstName = currentUser?.displayName?.split(' ')[0] || currentUser?.username || 'there';

  const storyUsers = useMemo(() => (
    (users || []).filter(u => u.id !== currentUser?.id && !(blockedUsers || []).includes(u.id)).slice(0, 6)
  ), [users, currentUser, blockedUsers]);

  const feedPosts = useMemo(() => (
    (videos || []).filter(v => !(blockedUsers || []).includes(v.userId))
  ), [videos, blockedUsers]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: '#fff', fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>

      {/* ── Search bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 14px' }}>
        <button onClick={onOpenSearch} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#F3F4F6', border: 'none', borderRadius: 22, padding: '10px 16px', cursor: 'pointer' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.3"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.2" y2="16.2" /></svg>
          <span style={{ color: '#9CA3AF', fontSize: 14 }}>{t?.search || 'Search'}</span>
        </button>
        <button onClick={onOpenNotifications} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,#FF8FB3,#FF4F7E)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <HomeFeedHeart size={18} filled color="white" />
        </button>
      </div>

      {/* ── Stories row ── */}
      <div style={{ display: 'flex', gap: 14, padding: '2px 16px 20px', overflowX: 'auto' }}>
        <HomeFeedStoryAvatar label={t?.yourStory || 'Your story'} src={currentUser?.avatar || currentUser?.photoURL} isYou />
        {storyUsers.map(u => (
          <HomeFeedStoryAvatar
            key={u.id}
            label={u.displayName || u.username}
            src={u.avatar || u.photoURL}
            hasRing={followed?.includes(u.id)}
            onClick={() => onViewProfile?.(u.id)}
          />
        ))}
      </div>

      {/* ── Create post box ── */}
      <div style={{ margin: '0 16px 18px', padding: '14px 16px', border: '1px solid #EFEFEF', borderRadius: 18, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#eee' }}>
            <ProgressiveImage src={currentUser?.avatar || currentUser?.photoURL} alt="me" style={{ width: '100%', height: '100%' }} />
          </div>
          <div style={{ flex: 1, color: '#9CA3AF', fontSize: 14.5 }}>
            {(t?.whatsOnYourMind || "What's on your mind, {name}?").replace('{name}', firstName)}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F5F5F5', paddingTop: 12 }}>
          {[
            { icon: 'photo', label: t?.photo || 'Photo', color: '#4FA6FF' },
            { icon: 'video', label: t?.video || 'Video', color: '#FF4F7E' },
            { icon: 'poll', label: t?.poll || 'Poll', color: '#FFB03A' },
            { icon: 'feeling', label: t?.feeling || 'Feeling', color: '#FF7EB3' },
          ].map(a => (
            <button key={a.icon} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 13, fontWeight: 500 }}>
              <HomeFeedIcon type={a.icon} color={a.color} />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Feed posts ── */}
      {feedPosts.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#B0B0B0', padding: '60px 20px' }}>
          {t?.noVideos || 'No posts yet. Be the first to share!'}
        </div>
      ) : feedPosts.map(post => {
        const author = (users || []).find(u => u.id === post.userId) || {};
        const isLiked = (post.likedBy || []).includes(currentUser?.id);
        return (
          <div key={post.id} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px 10px', gap: 10 }}>
              <div onClick={() => onViewProfile?.(author.id)} style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', background: '#eee' }}>
                <ProgressiveImage src={author.avatar || author.photoURL} alt={author.username} style={{ width: '100%', height: '100%' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 700, color: '#111' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{author.displayName || author.username || 'Someone'}</span>
                  <span style={{ color: '#FF4F7E', fontSize: 13 }}>♥</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#B0B0B0' }}>{homeFeedTimeAgo(post.createdAt) || 'now'}</div>
              </div>
              <button style={{ background: 'none', border: 'none', color: '#B0B0B0', cursor: 'pointer', fontSize: 20, padding: 4 }}>⋯</button>
            </div>

            {post.caption && (
              <div style={{ padding: '0 16px 10px', fontSize: 14, color: '#333', lineHeight: 1.45 }}>{post.caption}</div>
            )}

            {(post.mediaUrl || post.thumbnail) && (
              <div style={{ width: '100%', aspectRatio: '4 / 3', background: '#f2f2f2', overflow: 'hidden' }}>
                <ProgressiveImage src={post.mediaUrl || post.thumbnail} alt="post" style={{ width: '100%', height: '100%' }} />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '12px 16px 0' }}>
              <button onClick={() => onLike?.(post.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer' }}>
                <HomeFeedHeart size={21} filled={isLiked} color={isLiked ? '#FF4F7E' : '#333'} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{formatNumber(post.likes || 0)}</span>
              </button>
              <button onClick={() => onComment?.(post)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer' }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{formatNumber(post.comments || 0)}</span>
              </button>
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2"><path d="M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{formatNumber(post.saves || 0)}</span>
              </button>
              <button onClick={() => onShare?.(post)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2"><path d="M12 5v13M6 11l6-6 6 6M5 21h14" /></svg>
              </button>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333', fontSize: 20, padding: '0 4px' }}>⋯</button>
            </div>
          </div>
        );
      })}
      <div style={{ height: 12 }} />
    </div>
  );
};

/* ─────────────── FRIENDS FEED ─────────────── */
const FriendsFeed = ({ t, friends, videos, currentUser, onMessage, onVoiceCall, onVideoCall, onViewProfile, showToast, users, onCreateStory, onViewStory, onFollow, followed, blockedUsers, onBlock, onLive, onOpenSearch }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const startY = useRef(null);
  const [refreshing, setRefreshing] = useState(false);
const pullStartY = useRef(null);
const [pullDist, setPullDist] = useState(0);
const handlePullStart = e => { pullStartY.current = e.touches[0].clientY; };
const handlePullMove = e => {
  if(pullStartY.current===null) return;
  const dy = e.touches[0].clientY - pullStartY.current;
  if(dy > 0 && dy < 100) setPullDist(dy);
};
const handlePullEnd = async () => {
  if(pullDist > 60){
    haptic('medium');
    setRefreshing(true);
    await new Promise(r=>setTimeout(r, 1200));
    setRefreshing(false);
  }
  setPullDist(0);
  pullStartY.current = null;
};

  const friendsVideos = useMemo(()=>
  videos
    .filter(v => (friends.includes(v.userId) || v.userId===currentUser?.id))
    .filter(v => !(blockedUsers||[]).includes(v.userId))
    .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)),
[friends, videos, currentUser?.id, blockedUsers]);

  const filtered = friendsVideos;

  const startTime = useRef(null);
  const handleTouchStart = e => {
    startY.current = e.touches[0].clientY;
    startTime.current = Date.now();
  };
  const handleTouchMove = e => { startY.current && void e; };
  const handleTouchEnd = e => {
    if(startY.current===null) return;
    const dy = startY.current - e.changedTouches[0].clientY;
    const dt = Date.now() - (startTime.current||Date.now());
    const velocity = Math.abs(dy) / Math.max(dt, 1);
    const threshold = velocity > 0.3 ? 20 : 50;
    if(Math.abs(dy) > threshold){
      haptic('light');
      if(dy>0) setCurrentIndex(i=>Math.min(filtered.length-1,i+1));
      else setCurrentIndex(i=>Math.max(0,i-1));
    }
    startY.current = null;
  };

  if(filtered.length===0) return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#0B0B0F' }}>
      {/* Top bar */}
      <div style={{ position:'relative', zIndex:15, padding:'14px 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ color:'white', fontWeight:800, fontSize:18, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif", textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>{t?.friends||'Friends'}</div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <button onClick={onOpenSearch} style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'50%', width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>

        </div>
      </div>
      <Stories users={users} currentUser={currentUser} onViewStory={onViewStory} onCreateStory={onCreateStory} followed={followed} />
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'rgba(255,255,255,0.2)' }}>
        <div style={{ fontSize:44 }}>👥</div>
        <div style={{ fontSize:14 }}>{search ? 'No results found' : 'Follow people to see their videos here'}</div>
      </div>
    </div>
  );

  return (
    <div style={{ height:'100%', position:'relative', overflow:'hidden' }}
      onTouchStart={e=>{ handleTouchStart(e); handlePullStart(e); }}
      onTouchMove={e=>{ handleTouchMove(e); handlePullMove(e); }}
      onTouchEnd={e=>{ handleTouchEnd(e); handlePullEnd(); }}>
      {(pullDist > 10 || refreshing) && (
        <div style={{ position:'absolute', top: refreshing ? 16 : pullDist - 40, left:'50%', transform:'translateX(-50%)', zIndex:25, width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(10px)', transition: refreshing?'top 0.3s':'' }}>
          <div style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid #FF2156', borderRadius:'50%', animation: refreshing ? 'spin 0.8s linear infinite' : '', transform: !refreshing ? `rotate(${pullDist*3}deg)` : '' }} />
        </div>
      )}
     
      {/* Fullscreen video cards — same as HomeFeed */}
      {filtered.map((video,idx)=>(
  Math.abs(idx-currentIndex) > 1 ? null :
  <div key={video.id} style={{ position:'absolute', inset:0, transform:`translateY(${(idx-currentIndex)*100}%)`, transition:'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)', pointerEvents:idx===currentIndex?'auto':'none' }}>
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
            onBlock={onBlock}
            onLive={onLive}
          />
        </div>
      ))}

      {/* Top overlay: Friends label + icons — matches Home style */}
      <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:15, padding:'14px 16px 12px', background:'linear-gradient(to bottom,rgba(0,0,0,0.7) 0%,transparent 100%)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ color:'white', fontWeight:800, fontSize:18, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif", textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>{t?.friends||'Friends'}</div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <button onClick={onOpenSearch} style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'50%', width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>

          </div>
        </div>
      </div>

      {/* Stories row — always at top, below search */}
      <div style={{ position:'absolute', top:60, left:0, right:0, zIndex:14 }}>
        <Stories users={users} currentUser={currentUser} onViewStory={onViewStory} onCreateStory={onCreateStory} followed={followed} />
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
const CreateScreen = ({ onOpenCamera, onShowSoundLibrary, showToast, t }) => (
  <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, gap:12, background:'#0B0B0F' }}>
    <div style={{ textAlign:'center', marginBottom:12 }}>
      <div style={{ width:72, height:72, borderRadius:'50%', background:'linear-gradient(135deg,#FF2156,#9D4EDD)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:32 }}>🎬</div>
      <div style={{ color:'white', fontWeight:800, fontSize:24, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{t?.createShare||'Create & Share'}</div>
<div style={{ color:'rgba(255,255,255,0.35)', fontSize:14, marginTop:4 }}>{t?.expressYourself||'Express yourself'}</div>
    </div>
    {[
      {icon:'📷',label:'Open Camera',sub:'Record or take photo',action:onOpenCamera,grad:true},
      {icon:'🖼️',label:'Upload from Gallery',sub:'Choose from your device',action:onOpenCamera,grad:false},
      {icon:'✏️',label:'Write Text Story',sub:'Share a thought',action:onOpenCamera,grad:false},
      {icon:'🎙️',label:'Record Audio',sub:'Voice post',action:onOpenCamera,grad:false},
      {icon:'🎵',label:'Add Sound',sub:'Browse music library',action:onShowSoundLibrary,grad:false},
    ].map(btn=>(
      <button key={btn.label} onClick={btn.action} style={{ width:'100%', maxWidth:320, background:btn.grad?'linear-gradient(135deg,#FF2156,#9D4EDD)':'rgba(255,255,255,0.04)', border:btn.grad?'none':'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'16px 20px', color:'white', fontSize:14, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:14, textAlign:'left' }}>
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
    <div style={{ height:'100%', overflow:'auto', background:'#0B0B0F' }}>
      <div style={{ padding:'16px 16px 0' }}>
        <button onClick={onBack} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'8px 16px', color:'white', cursor:'pointer', fontSize:13, marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <div style={{ color:'white', fontWeight:800, fontSize:22, marginBottom:16, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Wallet</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          <div style={{ background:'linear-gradient(135deg,#FFD60A,#FFB100)', borderRadius:22, padding:20 }}>
            <div style={{ color:'rgba(0,0,0,0.55)', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Coins</div>
            <div style={{ color:'#000', fontSize:30, fontWeight:800, marginTop:4, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{(user?.coins||0).toLocaleString()}</div>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:10, marginTop:2 }}>🪙 Infinity Coins</div>
          </div>
          <div style={{ background:'linear-gradient(135deg,#00E6B4,#00A9D6)', borderRadius:22, padding:20 }}>
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
                <div style={{ color:tx.type==='credit'?'#00E6B4':'#FF2156', fontWeight:700, fontSize:15 }}>{tx.type==='credit'?'+':'-'}{tx.amount}{tx.coins?'🪙':'$'}</div>
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
            <button onClick={activeTab==='deposit'?doDeposit:activeTab==='withdraw'?doWithdraw:convertCoins} style={{ width:'100%', background:'linear-gradient(135deg,#FF2156,#9D4EDD)', border:'none', borderRadius:24, padding:'14px', color:'white', fontWeight:700, cursor:'pointer', fontSize:14, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>
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
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor||'#FF2156');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl||null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const colors = ['#FF2156','#9D4EDD','#0A84FF','#FFB100','#2ED573','#00A9D6','#FF453A','#5E5CE6','#00A9D6','#FF7A6B'];

  const handleAvatarChange = (e) => {
    const f = e.target.files[0];
    if(f){setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f));}
  };

  const handleSave = async () => {
    setUploading(true);
    try {
      let avatarUrl = user?.avatarUrl || null;
      if (username !== user.username) {
  const snap = await getDocs(query(collection(db, 'users'), where('username', '==', username)));
  if (!snap.empty) {
    showToast?.('Username already taken', 'error');
    setUploading(false);
    return;
  }
}
      if(avatarFile) avatarUrl = await uploadToCloudinary(avatarFile);
      const updates = {username, bio, link, gender, avatarColor, avatarUrl, avatar: username[0].toUpperCase()};
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
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', background:'#15151C', borderTopLeftRadius:32, borderTopRightRadius:32, padding:'20px 20px 44px', maxHeight:'92vh', overflowY:'auto', border:'1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ width:36, height:4, background:'rgba(255,255,255,0.12)', borderRadius:2, margin:'0 auto 20px' }} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <span style={{ color:'white', fontWeight:800, fontSize:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Edit Profile</span>
          <button onClick={handleSave} disabled={uploading} style={{ background:'linear-gradient(135deg,#FF2156,#9D4EDD)', border:'none', borderRadius:20, padding:'9px 20px', color:'white', fontWeight:700, cursor:'pointer', fontSize:14, opacity:uploading?0.6:1 }}>{uploading?'Saving...':'Save'}</button>
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
          <div style={{ width:46, height:26, background:on?'#FF2156':'rgba(255,255,255,0.1)', borderRadius:13, position:'relative', transition:'background 0.2s' }}>
            <div style={{ width:20, height:20, background:'white', borderRadius:'50%', position:'absolute', top:3, left:on?23:3, transition:'left 0.2s' }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─────────────── PROFILE PAGE ─────────────── */
const ProfilePage = ({ user, setCurrentUser, onLogout, users, showToast, onShowAnalytics, onShowQRCode, allVideos, setBlockedUsers, onShowSavedPosts, onGoToGroups, onShowBroadcast, onViewProfile }) => {
  const [activeSubPage, setActiveSubPage] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [profileTab, setProfileTab] = useState('posts');
  const [showHamburger, setShowHamburger] = useState(false);
  const [showFollowersList, setShowFollowersList] = useState(null);
  const myVideos = allVideos?.filter(v=>v.userId===user?.id)||[];
  const saveProfile = data=>setCurrentUser(u=>({...u,...data}));

  if(activeSubPage==='analytics'){onShowAnalytics?.(); setActiveSubPage(null); return null;}
  if(activeSubPage==='qrcode'){onShowQRCode?.(); setActiveSubPage(null); return null;}
  if(activeSubPage==='changepw') return (
    <div style={{height:'100%',overflow:'auto',background:'#0B0B0F',padding:16}}>
      <button onClick={()=>setActiveSubPage('settings')} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:20,padding:'8px 16px',color:'white',cursor:'pointer',fontSize:13,marginBottom:20,display:'flex',alignItems:'center',gap:6}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{color:'white',fontWeight:800,fontSize:22,marginBottom:8,fontFamily:"'Inter',sans-serif"}}>Change Password</div>
      <div style={{color:'rgba(255,255,255,0.4)',fontSize:13,marginBottom:24}}>A reset link will be sent to {user?.email}</div>
      <button onClick={async()=>{
        if(user?.email){ await sendPasswordResetEmail(auth,user.email); showToast?.('Reset link sent to '+user.email,'success'); setActiveSubPage('settings'); }
        else showToast?.('No email on account','error');
      }} style={{width:'100%',background:'linear-gradient(135deg,#FF2156,#9D4EDD)',border:'none',borderRadius:24,padding:15,color:'white',fontWeight:700,cursor:'pointer',fontSize:15}}>
        Send Reset Link to {user?.email}
      </button>
    </div>
  );

  if(activeSubPage==='emailphone') return (
    <div style={{height:'100%',overflow:'auto',background:'#0B0B0F',padding:16}}>
      <button onClick={()=>setActiveSubPage('settings')} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:20,padding:'8px 16px',color:'white',cursor:'pointer',fontSize:13,marginBottom:20,display:'flex',alignItems:'center',gap:6}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{color:'white',fontWeight:800,fontSize:22,marginBottom:24,fontFamily:"'Inter',sans-serif"}}>Email & Phone</div>
      <div style={{background:'rgba(255,255,255,0.03)',borderRadius:20,overflow:'hidden',border:'1px solid rgba(255,255,255,0.06)'}}>
        <div style={{padding:'16px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
          <div style={{color:'rgba(255,255,255,0.4)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:6}}>Email Address</div>
          <div style={{color:'white',fontSize:14}}>{user?.email||'Not set'}</div>
        </div>
        <div style={{padding:'16px'}}>
          <div style={{color:'rgba(255,255,255,0.4)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:6}}>Phone Number</div>
          <div style={{color:'rgba(255,255,255,0.3)',fontSize:14}}>Not added</div>
        </div>
      </div>
      <div style={{marginTop:16,color:'rgba(255,255,255,0.25)',fontSize:12,lineHeight:1.6}}>
        To change your email address, please contact support. Your email is used for login and notifications.
      </div>
    </div>
  );

  if(activeSubPage==='language') return (
    <div style={{height:'100%',overflow:'auto',background:'#0B0B0F',padding:16}}>
      <button onClick={()=>setActiveSubPage('settings')} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:20,padding:'8px 16px',color:'white',cursor:'pointer',fontSize:13,marginBottom:20,display:'flex',alignItems:'center',gap:6}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{color:'white',fontWeight:800,fontSize:22,marginBottom:24,fontFamily:"'Inter',sans-serif"}}>Language</div>
      <div style={{background:'rgba(255,255,255,0.03)',borderRadius:20,overflow:'hidden',border:'1px solid rgba(255,255,255,0.06)'}}>
        <div style={{background:'rgba(6,214,160,0.08)',border:'1px solid rgba(6,214,160,0.2)',borderRadius:14,padding:'10px 14px',marginBottom:16,color:'#00E6B4',fontSize:12,lineHeight:1.5}}>
  ✓ Select your language. All app text will update immediately.
          </div>
        {[['English','English','en'],['አማርኛ','Amharic','am'],['العربية','Arabic','ar'],['Français','French','fr'],['Español','Spanish','es'],['Português','Portuguese','pt'],['हिन्दी','Hindi','hi'],['中文','Chinese','zh'],['Kiswahili','Swahili','sw'],['Deutsch','German','de'],['Русский','Russian','ru'],['Türkçe','Turkish','tr'],['日本語','Japanese','ja'],['한국어','Korean','ko'],['Italiano','Italian','it']].map(([label,sub,code],i,arr)=>{
          const selected = (user?.language||'en')===code;
          return (
            <div key={code} onClick={async()=>{ await updateDoc(doc(db,'users',user.id),{language:code}); setCurrentUser(u=>({...u,language:code})); showToast?.(`Language set to ${label}`,'success'); }} style={{padding:'15px 16px',borderBottom:i<arr.length-1?'1px solid rgba(255,255,255,0.05)':'',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}>
              <div>
                <div style={{color:'white',fontSize:14,fontWeight:selected?700:400}}>{label}</div>
                <div style={{color:'rgba(255,255,255,0.3)',fontSize:11,marginTop:2}}>{sub}</div>
              </div>
              {selected && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF2156" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
          );
        })}
      </div>
    </div>
  );

if(activeSubPage==='wallet') return <WalletPage user={user} setCurrentUser={setCurrentUser} showToast={showToast} onBack={()=>setActiveSubPage(null)} />;

  if(activeSubPage==='unblock') return (
    <div style={{ height:'100%', overflow:'auto', background:'#0B0B0F', padding:16 }}>
      <button onClick={()=>setActiveSubPage('settings')} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'8px 16px', color:'white', cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{ color:'white', fontWeight:800, fontSize:22, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Blocked Users</div>
      {(user?.blockedUsers||[]).length===0 && (
        <div style={{ textAlign:'center', padding:48, color:'rgba(255,255,255,0.25)' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🚫</div>
          <div>No blocked users</div>
        </div>
      )}
      {(user?.blockedUsers||[]).map(uid=>{
        const u = users.find(uu=>uu.id===uid);
        return (
          <div key={uid} style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(255,255,255,0.03)', borderRadius:18, padding:'14px 16px', marginBottom:10, border:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width:46, height:46, borderRadius:'50%', background:u?.avatarColor||'#34343E', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:18, overflow:'hidden', flexShrink:0 }}>
              {u?.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (u?.avatar||'?')}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ color:'white', fontWeight:700, fontSize:14 }}>@{u?.username||uid}</div>
              <div style={{ color:'rgba(255,255,255,0.3)', fontSize:12, marginTop:2 }}>{u?.bio?.substring(0,40)||'Blocked user'}</div>
            </div>
            <button onClick={async()=>{
              await updateDoc(doc(db,'users',user.id),{ blockedUsers: arrayRemove(uid) });
              setCurrentUser(cu=>({...cu, blockedUsers:(cu.blockedUsers||[]).filter(id=>id!==uid)}));
              setBlockedUsers(p=>p.filter(id=>id!==uid));
              showToast?.('User unblocked','success');
            }} style={{ background:'rgba(255,45,85,0.1)', border:'1px solid rgba(255,45,85,0.3)', borderRadius:20, padding:'8px 16px', color:'#FF2156', fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0 }}>Unblock</button>
          </div>
        );
      })}
    </div>
  );

if(activeSubPage==='settings') return (
    <div style={{ height:'100%', overflow:'auto', background:'#0B0B0F' }}>
      <div style={{ padding:'16px' }}>
        <button onClick={()=>setActiveSubPage(null)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'8px 16px', color:'white', cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
        </button>
        <div style={{ color:'white', fontWeight:800, fontSize:22, marginBottom:24, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Settings</div>
        <div style={{ color:'rgba(255,255,255,0.3)', fontSize:11, fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:1.2 }}>Account</div>
        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:20, overflow:'hidden', marginBottom:20, border:'1px solid rgba(255,255,255,0.06)' }}>
          {[
            {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,label:'Edit Profile',action:()=>{setShowEditProfile(true); setActiveSubPage(null);}},
            {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,label:'Change Password',action:()=>setActiveSubPage('changepw')},
            {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,label:'Email & Phone',action:()=>setActiveSubPage('emailphone')},
            {icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,label:'Language',action:()=>setActiveSubPage('language')},
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
        {/* ── v4 APPEARANCE SECTION ── */}
        <div style={{ color:'rgba(255,255,255,0.3)', fontSize:11, fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:1.2 }}>Appearance</div>
        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:20, overflow:'hidden', marginBottom:20, border:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ padding:'15px 16px', display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🌙</div>
            <span style={{ color:'white', flex:1, fontSize:14 }}>Dark Mode</span>
            <div onClick={()=>{ /* theme stored locally */ showToast?.('Theme toggle coming soon','info'); }} style={{ width:46, height:26, background:'#FF2156', borderRadius:13, position:'relative', cursor:'pointer' }}>
              <div style={{ width:20, height:20, background:'white', borderRadius:'50%', position:'absolute', top:3, left:23, transition:'left 0.2s' }} />
            </div>
          </div>
          <div style={{ padding:'15px 16px', borderTop:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', gap:14, cursor:'pointer' }} onClick={()=>setActiveSubPage('language')}>
            <div style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🌐</div>
            <span style={{ color:'white', flex:1, fontSize:14 }}>Language & Translation</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
          <div style={{ padding:'15px 16px', borderTop:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', gap:14, cursor:'pointer' }} onClick={()=>showToast?.('Notification settings','info')}>
            <div style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🔔</div>
            <span style={{ color:'white', flex:1, fontSize:14 }}>Notification Preferences</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
        <div style={{ color:'rgba(255,255,255,0.3)', fontSize:11, fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:1.2 }}>Support</div>
        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:20, overflow:'hidden', marginBottom:20, border:'1px solid rgba(255,255,255,0.06)' }}>
          {[
            {label:'Blocked Users',action:()=>setActiveSubPage('unblock')},
            {label:'Help Center',action:()=>showToast?.('Help center','info')},
            {label:'Report a Problem',action:async()=>{
              await sendEmailJS({to_email:SUPPORT_EMAIL,from_name:user?.username,message:`User ${user?.username} (${user?.email}) reported a problem.`});
              showToast?.('Report sent!','success');
            }},
            {label:'Terms of Service', action:()=>window.open('https://yoursite.com/terms','_blank')},
{label:'Privacy Policy', action:()=>window.open('https://yoursite.com/privacy','_blank')},
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
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFB100" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
  <span style={{ color:'#FFB100', fontSize:14 }}>Reset Account</span>
</div>

<div onClick={onLogout} style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFB100" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span style={{ color:'#FFB100', fontSize:14 }}>Log Out</span>
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF2156" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          <span style={{ color:'#FF2156', fontSize:14 }}>Delete Account</span>
        </div>
        <div style={{ textAlign:'center', color:'rgba(255,255,255,0.15)', fontSize:11, marginBottom:16 }}>Infinity v3.0.0 • Made with ❤️</div>
      </div>
    </div>
  );

  if(activeSubPage==='privacy') return (
    <div style={{ height:'100%', overflow:'auto', background:'#0B0B0F', padding:16 }}>
      <button onClick={()=>setActiveSubPage(null)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'8px 16px', color:'white', cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{ color:'white', fontWeight:800, fontSize:22, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Privacy</div>
      <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:20, overflow:'hidden', border:'1px solid rgba(255,255,255,0.06)' }}>
        {['Private Account','Show Activity','Allow Messages from Everyone','Allow Comments','Allow Duets','Show Liked Videos'].map((label,i,arr)=>(
          <div key={label} style={{ padding:'14px 16px', borderBottom:i<arr.length-1?'1px solid rgba(255,255,255,0.05)':'', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:'white', fontSize:13 }}>{label}</span>
            <div style={{ width:46, height:26, background:'#FF2156', borderRadius:13, position:'relative', cursor:'pointer' }}>
              <div style={{ width:20, height:20, background:'white', borderRadius:'50%', position:'absolute', top:3, left:23 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if(activeSubPage==='switch') return (
    <div style={{ height:'100%', overflow:'auto', background:'#0B0B0F', padding:16 }}>
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
          {u.id===user?.id && <span style={{ color:'#FF2156', fontSize:12, fontWeight:700 }}>Active</span>}
        </div>
      ))}
      <button style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px dashed rgba(255,255,255,0.15)', borderRadius:18, padding:16, color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:14, marginTop:4 }}>+ Add Account</button>
    </div>
  );

  if(activeSubPage==='badges') return (
    <div style={{ height:'100%', overflow:'auto', background:'#0B0B0F', padding:16 }}>
      <button onClick={()=>setActiveSubPage(null)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'8px 16px', color:'white', cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{ color:'white', fontWeight:800, fontSize:22, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Badges</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
        {[['🌟','First Post',myVideos.length>0],['🔥','7 Day Streak',(user?.streak||0)>=7],['💎','Top Creator',(user?.followers?.length||0)>=100],['👑','100K Fans',(user?.followers?.length||0)>=100000],['🚀','Viral',myVideos.some(v=>v.views>=10000)],['🎯','Pro User',user?.subscription==='pro']].map(([icon,name,earned])=>(
          <div key={name} style={{ background:'rgba(255,255,255,0.03)', borderRadius:20, padding:18, textAlign:'center', opacity:earned?1:0.4, border:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize:38, marginBottom:8 }}>{icon}</div>
            <div style={{ color:'white', fontSize:12, fontWeight:700, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{name}</div>
            <div style={{ color:earned?'#00E6B4':'rgba(255,255,255,0.3)', fontSize:10, marginTop:4 }}>{earned?'Earned':'Locked'}</div>
          </div>
        ))}
      </div>
    </div>
  );

  if(activeSubPage==='premium') return (
    <div style={{ height:'100%', overflow:'auto', background:'#0B0B0F', padding:16 }}>
      <button onClick={()=>setActiveSubPage(null)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'8px 16px', color:'white', cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
      </button>
      <div style={{ color:'white', fontWeight:800, fontSize:22, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Premium</div>
      {[{name:'Plus',price:'$4.99/mo',color:'#9D4EDD',features:['Ad-free experience','500 coins/month','Custom profile badge','Priority in search']},{name:'Pro',price:'$9.99/mo',color:'#FFD60A',features:['All Plus features','2000 coins/month','Advanced analytics','Priority support','Custom username']}].map(plan=>(
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
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFD60A" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,label:'Wallet',page:'wallet',color:'#FFD60A'},
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9D4EDD" strokeWidth="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,label:'Badges',page:'badges',color:'#9D4EDD'},
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFD60A" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,label:'Premium',page:'premium',color:'#FFD60A'},
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00E6B4" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,label:'Analytics',page:'analytics',color:'#00E6B4'},
    {icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,label:'QR Code',page:'qrcode',color:'#fff'},
  ];

  return (
    <div style={{ height:'100%', overflow:'auto', background:'#0B0B0F' }}>
      <div style={{ position:'relative', paddingBottom:20 }}>
        <div style={{ height:160, position:'absolute', top:0, left:0, right:0, overflow:'hidden' }}>
          {user?.avatarUrl
            ? <img src={user.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', filter:'blur(20px) brightness(0.6) saturate(1.6)', transform:'scale(1.2)' }} />
            : <div style={{ width:'100%', height:'100%', background:`linear-gradient(135deg,${user?.avatarColor||'#FF2156'},rgba(175,82,222,0.8))` }} />
          }
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom,rgba(10,10,10,0.1),rgba(10,10,10,0.7))' }} />
        </div>
        <div style={{ position:'relative', padding:'52px 20px 0', textAlign:'center' }}>
          <div style={{ position:'absolute', top:10, right:16, display:'flex', gap:8 }}>
            <button onClick={()=>setShowHamburger(true)} style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'50%', width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
          </div>
          {showHamburger && (
            <div onClick={()=>setShowHamburger(false)} style={{position:'fixed',inset:0,zIndex:5000,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}}>
              <div onClick={e=>e.stopPropagation()} style={{position:'absolute',top:60,right:16,background:'#1C1C24',borderRadius:20,padding:'8px 0',minWidth:220,border:'1px solid rgba(255,255,255,0.1)',boxShadow:'0 20px 60px rgba(0,0,0,0.8)',animation:'popIn 0.2s ease'}}>
                {[
                  {icon:'⚙️',label:'Settings',action:()=>{setActiveSubPage('settings');setShowHamburger(false);}},
                  {icon:'🔒',label:'Privacy',action:()=>{setActiveSubPage('privacy');setShowHamburger(false);}},
                  {icon:'💳',label:'Wallet',action:()=>{setActiveSubPage('wallet');setShowHamburger(false);}},
                  {icon:'📊',label:'Analytics',action:()=>{onShowAnalytics?.();setShowHamburger(false);}},
                  {icon:'🏅',label:'Badges',action:()=>{setActiveSubPage('badges');setShowHamburger(false);}},
                  {icon:'👑',label:'Premium',action:()=>{setActiveSubPage('premium');setShowHamburger(false);}},
                  {icon:'📱',label:'QR Code',action:()=>{onShowQRCode?.();setShowHamburger(false);}},
                  {icon:'🔖',label:'Saved Posts',action:()=>{onShowSavedPosts?.();setShowHamburger(false);}},
                  {icon:'👥',label:'My Groups',action:()=>{onGoToGroups?.();setShowHamburger(false);}},
                  {icon:'📡',label:'Broadcast Status',action:()=>{onShowBroadcast?.();setShowHamburger(false);}},
                  {icon:'🔄',label:'Switch Account',action:()=>{setActiveSubPage('switch');setShowHamburger(false);}},
                  {icon:'🚫',label:'Blocked Users',action:()=>{setActiveSubPage('unblock');setShowHamburger(false);}},
                  {icon:'🚪',label:'Log Out',action:()=>{setShowHamburger(false);onLogout?.();},danger:true},
                ].map((item,i,arr)=>(
                  <div key={item.label} onClick={item.action} style={{display:'flex',alignItems:'center',gap:14,padding:'13px 18px',borderBottom:i<arr.length-1?'1px solid rgba(255,255,255,0.05)':'',cursor:'pointer',color:item.danger?'#FF2156':'white',fontSize:14}}>
                    <span style={{fontSize:18}}>{item.icon}</span>{item.label}
                  </div>
                ))}
              </div>
            </div>
          )}
          {showFollowersList && (
            <div onClick={()=>setShowFollowersList(null)} style={{position:'fixed',inset:0,zIndex:5000,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end'}}>
              <div onClick={e=>e.stopPropagation()} style={{width:'100%',background:'#15151C',borderTopLeftRadius:28,borderTopRightRadius:28,maxHeight:'70vh',display:'flex',flexDirection:'column',animation:'slideUp 0.3s ease'}}>
                <div style={{padding:'16px 16px 12px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{color:'white',fontWeight:800,fontSize:18}}>{showFollowersList==='followers'?'Followers':'Following'}</span>
                  <button onClick={()=>setShowFollowersList(null)} style={{background:'rgba(255,255,255,0.08)',border:'none',borderRadius:'50%',width:32,height:32,color:'white',cursor:'pointer',fontSize:16}}>✕</button>
                </div>
                <div style={{overflowY:'auto',flex:1,padding:'8px 0'}}>
                  {(showFollowersList==='followers'?(user?.followers||[]):(user?.following||[])).map(uid=>{
                    const u=users.find(uu=>uu.id===uid);
                    if(!u) return null;
                    return (
                      <div key={uid} onClick={()=>{ onViewProfile?.(uid); setShowFollowersList(null); }} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer'}}>
                        <div style={{width:46,height:46,borderRadius:'50%',background:u.avatarColor,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'bold',fontSize:18,overflow:'hidden',flexShrink:0}}>
                          {u.avatarUrl?<img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:u.avatar}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{color:'white',fontWeight:700,fontSize:14}}>@{u.username}</div>
                          <div style={{color:'rgba(255,255,255,0.35)',fontSize:12,marginTop:2}}>{u.bio?.substring(0,40)}</div>
                        </div>
                      </div>
                    );
                  })}
                  {((showFollowersList==='followers'?(user?.followers||[]):(user?.following||[])).length===0)&&(
                    <div style={{textAlign:'center',padding:40,color:'rgba(255,255,255,0.25)'}}>
                      <div style={{fontSize:36,marginBottom:8}}>👥</div>
                      <div>No {showFollowersList} yet</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div style={{ position:'relative', display:'inline-block', marginBottom:14 }}>
            <div onClick={()=>setShowAvatarViewer(true)} style={{cursor:'pointer'}}>
              <div style={{ width:96, height:96, borderRadius:'50%', padding:3, background:'conic-gradient(#FF2156,#FFB100,#9D4EDD,#FF2156)', margin:'0 auto', cursor:'pointer' }}>
                <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:'#0B0B0F', padding:2, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:user?.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:36, overflow:'hidden' }}>
                    {user?.avatarUrl ? <img src={user.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : user?.avatar}
                  </div>
                </div>
              </div>
            </div>
            <button onClick={(e)=>{e.stopPropagation(); setShowEditProfile(true);}} style={{ position:'absolute', bottom:2, right:2, background:'linear-gradient(135deg,#FF2156,#9D4EDD)', border:'2px solid #0B0B0F', borderRadius:'50%', width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>
          <div style={{ color:'white', fontWeight:800, fontSize:22, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>@{user?.username}</div>
          {user?.verified && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:4, color:'#2F9BFF', fontSize:12, marginTop:4, background:'rgba(29,155,240,0.1)', borderRadius:20, padding:'3px 10px' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#2F9BFF"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Verified
            </div>
          )}
          <div style={{ color:'rgba(255,255,255,0.5)', fontSize:13, marginTop:8, lineHeight:1.6, maxWidth:260, margin:'8px auto 0' }}>{user?.bio||'No bio yet'}</div>
          {user?.link && <a href={user.link} target="_blank" rel="noopener noreferrer" style={{ color:'#0A84FF', fontSize:13, display:'block', marginTop:4 }}>{user.link}</a>}
          <button onClick={(e)=>{e.stopPropagation(); setShowEditProfile(true);}} style={{ marginTop:16, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:14, padding:'10px 32px', color:'white', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Edit Profile</button>
          <div style={{ display:'flex', justifyContent:'center', gap:0, marginTop:20, background:'rgba(255,255,255,0.03)', borderRadius:20, padding:'14px 0', border:'1px solid rgba(255,255,255,0.06)' }}>
            {[['Posts',myVideos.length,null],['Followers',user?.followers?.length||0,'followers'],['Following',user?.following?.length||0,'following']].map(([label,val,listKey],i)=>(
              <div key={label} onClick={()=>listKey&&setShowFollowersList(listKey)} style={{ flex:1, textAlign:'center', borderRight:i<2?'1px solid rgba(255,255,255,0.06)':'', cursor:listKey?'pointer':'default' }}>
                <div style={{ color:'white', fontWeight:800, fontSize:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{formatNumber(val)}</div>
                <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, marginTop:12, justifyContent:'center', flexWrap:'wrap' }}>
            <div style={{ background:'linear-gradient(135deg,rgba(255,149,0,0.15),rgba(255,45,85,0.1))', border:'1px solid rgba(255,149,0,0.3)', borderRadius:20, padding:'7px 16px', display:'flex', alignItems:'center', gap:6, backdropFilter:'blur(10px)' }}>
              <span style={{ fontSize:16, animation:(user?.streak||1)>=7?'pulse 1.5s infinite':'' }}>🔥</span>
              <span style={{ color:'#FFB100', fontSize:12, fontWeight:800 }}>{user?.streak||1} day streak</span>
              {(user?.streak||1)>=7 && <span style={{ background:'rgba(255,149,0,0.2)', color:'#FFB100', fontSize:9, fontWeight:800, borderRadius:10, padding:'2px 6px' }}>HOT</span>}
            </div>
            <div style={{ background:'linear-gradient(135deg,rgba(255,215,0,0.12),rgba(255,149,0,0.08))', border:'1px solid rgba(255,215,0,0.25)', borderRadius:20, padding:'7px 16px', display:'flex', alignItems:'center', gap:6, backdropFilter:'blur(10px)' }}>
              <span style={{ fontSize:16 }}>🪙</span>
              <span style={{ color:'#FFD60A', fontSize:12, fontWeight:800 }}>{(user?.coins||0).toLocaleString()}</span>
              <span style={{ color:'rgba(255,215,0,0.5)', fontSize:10 }}>coins</span>
            </div>
            {user?.subscription !== 'free' && (
              <div style={{ background:'linear-gradient(135deg,rgba(175,82,222,0.15),rgba(255,45,85,0.1))', border:'1px solid rgba(175,82,222,0.3)', borderRadius:20, padding:'7px 16px', display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:14 }}>👑</span>
                <span style={{ background:'linear-gradient(135deg,#9D4EDD,#FF2156)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', fontSize:12, fontWeight:800, textTransform:'capitalize' }}>{user.subscription}</span>
              </div>
            )}
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
          <button key={t.id} onClick={()=>setProfileTab(t.id)} style={{ flex:1, background:'none', border:'none', borderTop:profileTab===t.id?'2px solid #FF2156':'2px solid transparent', padding:'14px 0', color:profileTab===t.id?'white':'rgba(255,255,255,0.3)', cursor:'pointer', display:'flex', justifyContent:'center' }}>{t.icon}</button>
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
                <div key={v.id} style={{ aspectRatio:'9/16', background:'#1C1C24', position:'relative', overflow:'hidden' }}>
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
      if (window.confirm('Delete this post?')) {
        await deleteDoc(doc(db, 'videos', v.id));
        showToast?.('Post deleted', 'success');
      }
    }}
    style={{
      position: 'absolute', top: 4, right: 4,
      background: 'rgba(255,45,85,0.8)', border: 'none',
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
        {profileTab==='saved' && <div style={{ textAlign:'center', padding:48, color:'rgba(255,255,255,0.2)' }}><div style={{ fontSize:40, marginBottom:12 }}>🔖</div><div>No saved posts</div></div>}
        {profileTab==='drafts' && <div style={{ textAlign:'center', padding:48, color:'rgba(255,255,255,0.2)' }}><div style={{ fontSize:40, marginBottom:12 }}>📝</div><div>No drafts yet</div></div>}
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
      const fd = new FormData();
      fd.append('file', blobRef.current, 'voice.webm');
      fd.append('upload_preset', CLOUDINARY_PRESET);
      fd.append('resource_type', 'video');
      const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.secure_url) {
        onSend({ type: 'voice', url: data.secure_url, duration });
        showToast?.('Voice message sent 🎤', 'success');
      }
    } catch { showToast?.('Failed to send voice', 'error'); }
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
        <button onClick={cancelRecording} style={{ background:'rgba(255,45,85,0.15)', border:'none', borderRadius:'50%', width:32, height:32, color:'#FF2156', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>✕</button>
        <audio src={audioUrl} controls style={{ flex:1, height:28, minWidth:0 }} />
        <span style={{ color:'rgba(255,255,255,0.4)', fontSize:12, flexShrink:0 }}>{fmtTime(duration)}</span>
        <button onClick={sendVoice} style={{ background:'#FF2156', border:'none', borderRadius:'50%', width:36, height:36, color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    );
  }

  // recording or paused
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, background:'rgba(255,45,85,0.06)', borderRadius:24, padding:'8px 12px', border:'1px solid rgba(255,45,85,0.15)' }}>
      <button onClick={cancelRecording} style={{ background:'rgba(255,45,85,0.15)', border:'none', borderRadius:'50%', width:30, height:30, color:'#FF2156', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
      {/* Waveform visualization */}
      <div style={{ flex:1, display:'flex', alignItems:'center', gap:1.5, height:28 }}>
        {waveform.length > 0 ? waveform.map((h,i)=>(
          <div key={i} style={{ flex:1, background: state==='recording'?'#FF2156':'rgba(255,255,255,0.3)', borderRadius:2, height:`${Math.round(h*100)}%`, minHeight:2, transition:'height 0.05s', opacity: state==='paused'?0.5:1 }} />
        )) : Array.from({length:30}).map((_,i)=>(
          <div key={i} style={{ flex:1, background:'rgba(255,255,255,0.15)', borderRadius:2, height:'20%' }} />
        ))}
      </div>
      <span style={{ color: state==='paused'?'rgba(255,255,255,0.4)':'#FF2156', fontSize:12, fontWeight:700, fontVariantNumeric:'tabular-nums', flexShrink:0 }}>{fmtTime(duration)}</span>
      {state === 'recording'
        ? <button onClick={pauseRecording} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:30, height:30, color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>⏸</button>
        : <button onClick={resumeRecording} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:30, height:30, color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>▶</button>}
      <button onClick={stopRecording} style={{ background:'#FF2156', border:'none', borderRadius:'50%', width:34, height:34, color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  );
};

/* ─────────────── INBOX (REAL-TIME FIRESTORE) ─────────────── */
const ConversationView = ({ currentUser, otherUser, conversationId, onBack, showToast, onViewProfile, onVoiceCall, onVideoCall }) => {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
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
  const msgs = snap.docs.map(d => ({
    id: d.id, ...d.data(),
    ts: d.data().createdAt?.toDate?.() || null
  }));
  setMessages(msgs);
  setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
}, () => {
  if (usedFallback) return;
  usedFallback = true;
  unsub = onSnapshot(q2, (snap2) => {
    const msgs = snap2.docs.map(d => ({
      id: d.id, ...d.data(),
      ts: d.data().createdAt?.toDate?.() || null
    })).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    setMessages(msgs);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    // Mark incoming messages as seen
    const unseen2 = snap2.docs.filter(d =>
      d.data().from === otherUser.id && d.data().status !== 'seen'
    );
    unseen2.forEach(d => updateDoc(d.ref, { status: 'seen' }).catch(()=>{}));
    // Also mark on primary path
    snap2.docs.filter(d => d.data().to === currentUser?.id && d.data().status !== 'seen')
      .forEach(d => updateDoc(d.ref, { status: 'seen' }).catch(()=>{}));
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
    return ()=>{ unsub(); typingUnsub(); presenceUnsub(); };
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
  createdAt: serverTimestamp(),
  status: 'sent'
});
      // Update conversation metadata
      await setDoc(doc(db,'conversations', conversationId),{ 
        participants: [currentUser.id, otherUser.id], 
        lastMessage: mediaUrl ? (mediaType?.startsWith('audio') ? '🎙️ Voice message' : '📎 Attachment') : msg, 
        lastMessageAt: serverTimestamp(), 
        [`unread_${otherUser.id}`]: increment(1) 
      },{ merge:true });
      clearAttach();
      addDoc(collection(db,'notifications'),{
        toUserId: otherUser.id,
        fromUserId: currentUser.id,
        type: 'message',
        message: 'sent you a message',
        read: false,
        createdAt: serverTimestamp(),
      }).catch(()=>{});
    } catch(e){
      showToast?.('Failed to send: ' + e.message, 'error');
      if(msg) setText(msg);
      clearAttach();
    }
  };


  if(!otherUser?.id || !conversationId || !currentUser?.id) {
  return (
    <div style={{height:'100%',background:'#0B0B0F',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12}}>
      <div style={{width:32,height:32,border:'3px solid rgba(255,45,85,0.3)',borderTop:'3px solid #FF2156',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
      <div style={{color:'rgba(255,255,255,0.3)',fontSize:13}}>Loading conversation...</div>
      <button onClick={onBack} style={{background:'rgba(255,255,255,0.07)',border:'none',borderRadius:20,padding:'8px 20px',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:12,marginTop:8}}>← Back</button>
    </div>
  );
}

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'#0B0B0F'}}>
      <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:12}}>
        <button onClick={onBack} style={{background:'none',border:'none',color:'white',cursor:'pointer',padding:'4px 0'}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div onClick={()=>onViewProfile?.(otherUser?.id)} style={{width:40,height:40,borderRadius:'50%',background:otherUser?.avatarColor||'#5A5A66',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'bold',overflow:'hidden',cursor:'pointer'}}>
          {otherUser?.avatarUrl?<img src={otherUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:(otherUser?.avatar||'?')}
        </div>
        <div onClick={()=>onViewProfile?.(otherUser?.id)} style={{cursor:'pointer'}}>
          <div style={{color:'white',fontWeight:700,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>@{otherUser?.username||'user'}</div>
          <div style={{color: presenceData?.online ? '#00E6B4':'rgba(255,255,255,0.3)', fontSize:11, display:'flex', alignItems:'center', gap:4}}>
            <div style={{width:6,height:6,borderRadius:'50%', background: presenceData?.online ? '#00E6B4':'rgba(255,255,255,0.3)'}}/>
            {presenceData?.online ? 'Online' : presenceData?.lastSeen ? `last seen ${timeAgo(presenceData.lastSeen.toDate())}` : 'Offline'}
          </div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:10}}>
          <button onClick={()=>onViewProfile?.(otherUser?.id)} title="View profile" style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'50%',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </button>
          <button onClick={()=>onVoiceCall?.(otherUser?.id)} style={{background:'rgba(52,199,89,0.12)',border:'1px solid rgba(52,199,89,0.2)',borderRadius:'50%',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2ED573" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-5.99-5.99 19.79 19.79 0 01-3.07-8.67A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
          </button>
          <button onClick={()=>onVideoCall?.(otherUser?.id)} style={{background:'rgba(175,82,222,0.12)',border:'1px solid rgba(175,82,222,0.2)',borderRadius:'50%',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9D4EDD" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          </button>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
        {messages.length===0&&<div style={{textAlign:'center',padding:40,color:'rgba(255,255,255,0.2)'}}>Start a conversation! 👋</div>}
        {messages.map(msg=>{
          const isMine = msg.from===currentUser?.id;
          return (
            <div key={msg.id}
              onTouchStart={()=>{ msgLongTimer.current=setTimeout(()=>{ haptic('heavy'); setShowMsgReactions(msg.id); },500); }}
              onTouchEnd={()=>clearTimeout(msgLongTimer.current)}
              onMouseDown={()=>{ msgLongTimer.current=setTimeout(()=>setShowMsgReactions(msg.id),500); }}
              onMouseUp={()=>clearTimeout(msgLongTimer.current)}
              style={{display:'flex',justifyContent:isMine?'flex-end':'flex-start',alignItems:'flex-end',gap:8,marginBottom:10,position:'relative'}}>
  {!isMine && (
    <div onClick={()=>onViewProfile?.(otherUser?.id)} style={{width:26,height:26,borderRadius:'50%',background:otherUser?.avatarColor||'#5A5A66',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'bold',fontSize:10,flexShrink:0,cursor:'pointer',overflow:'hidden'}}>
      {otherUser?.avatarUrl ? <img src={otherUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : otherUser?.avatar}
    </div>
  )}
              <div style={{maxWidth:'72%'}}>
                {msg.text&&<div style={{background: msg.deleted ? 'rgba(255,255,255,0.04)' : isMine?'linear-gradient(135deg,#FF2156,#9D4EDD)':'rgba(255,255,255,0.09)', borderRadius:isMine?'18px 18px 4px 18px':'18px 18px 18px 4px',padding:'9px 14px',marginBottom:msg.mediaUrl?4:0}}>
  <span style={{color: msg.deleted ? 'rgba(255,255,255,0.3)':'white', fontSize:14, lineHeight:1.4, fontStyle: msg.deleted?'italic':'normal'}}>{msg.text}</span>
  {!msg.deleted && !isMine && <MessageTranslate text={msg.text} targetLang={currentUser?.language || 'en'} isMine={isMine} />}
</div>}
                <div style={{ color:'rgba(255,255,255,0.25)', fontSize:10, marginTop:3, textAlign:isMine?'right':'left', paddingLeft:isMine?0:2, paddingRight:isMine?2:0, display:'flex', alignItems:'center', justifyContent:isMine?'flex-end':'flex-start', gap:3 }}>
  <span>{msg.ts ? msg.ts.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : ''}</span>
  {isMine && (
    <span style={{ fontSize:12, color: msg.status==='seen' ? '#2F9BFF' : 'rgba(255,255,255,0.35)', letterSpacing:-2 }}>
      {msg.status === 'sent' ? '✓' : '✓✓'}
    </span>
  )}
</div>
                {/* Reaction picker */}
              {showMsgReactions===msg.id && (
                <div onClick={e=>e.stopPropagation()} style={{position:'absolute',bottom:'100%',left:isMine?'auto':'0',right:isMine?'0':'auto',background:'rgba(20,20,20,0.97)',backdropFilter:'blur(20px)',borderRadius:40,padding:'6px 10px',display:'flex',gap:4,zIndex:100,border:'1px solid rgba(255,255,255,0.12)',animation:'popInBounce 0.25s ease',marginBottom:4,boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
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
                  <button onClick={()=>setShowMsgReactions(null)} style={{background:'rgba(255,255,255,0.08)',border:'none',borderRadius:'50%',width:28,height:28,color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',marginLeft:4}}>✕</button>
                </div>
              )}

              {/* Show reactions below bubble */}
              {msg.reactions && Object.keys(msg.reactions).length>0 && (
                <div style={{display:'flex',gap:3,marginTop:3,justifyContent:isMine?'flex-end':'flex-start',flexWrap:'wrap'}}>
                  {[...new Set(Object.values(msg.reactions))].map(emoji=>(
                    <span key={emoji} onClick={async()=>{
                      await updateDoc(doc(db,'messages',conversationId,'msgs',msg.id),{[`reactions.${currentUser.id}`]:emoji});
                      haptic('light');
                    }} style={{background:'rgba(255,255,255,0.08)',borderRadius:20,padding:'2px 7px',fontSize:12,border:'1px solid rgba(255,255,255,0.1)',cursor:'pointer',display:'flex',alignItems:'center',gap:3}}>
                      {emoji}
                      <span style={{color:'rgba(255,255,255,0.4)',fontSize:10}}>{Object.values(msg.reactions).filter(r=>r===emoji).length}</span>
                    </span>
                  ))}
                </div>
              )}
                {msg.mediaUrl&&msg.mediaType?.startsWith('image')&&<img src={msg.mediaUrl} alt="" style={{maxWidth:'100%',borderRadius:14,display:'block'}}/>}
                {msg.mediaUrl&&msg.mediaType?.startsWith('video')&&<video src={msg.mediaUrl} controls style={{maxWidth:'100%',borderRadius:14,display:'block'}}/>}
                {(msg.mediaUrl&&msg.mediaType?.startsWith('audio')) || msg.type==='voice'&&(msg.voiceUrl||msg.mediaUrl) ? (
                  <div style={{display:'flex',alignItems:'center',gap:10,background:isMine?'linear-gradient(135deg,#FF2156,#9D4EDD)':'rgba(255,255,255,0.09)',borderRadius:20,padding:'10px 14px',minWidth:200}}>
                    <button onClick={e=>{
                      e.stopPropagation();
                      const url = msg.voiceUrl || msg.mediaUrl;
                      if (!url) return;
                      const audio = new Audio(url);
                      audio.play().catch(()=>{});
                    }} style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:'50%',width:34,height:34,color:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                    <div style={{flex:1,display:'flex',alignItems:'center',gap:1.5,height:24}}>
                      {Array.from({length:24}).map((_,i)=>(
                        <div key={i} style={{flex:1,background:isMine?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.4)',borderRadius:2,height:`${20+Math.sin(i*0.8)*14}%`,minHeight:3}}/>
                      ))}
                    </div>
                    <span style={{color:isMine?'rgba(255,255,255,0.7)':'rgba(255,255,255,0.5)',fontSize:11,flexShrink:0}}>{msg.duration ? `0:${String(msg.duration).padStart(2,'0')}` : '🎙️'}</span>
                  </div>
                ) : null}
              </div>
              {isMine && (
                <button onClick={async()=>{
  const choice = window.confirm('Delete for everyone?');
  if(choice){
    await updateDoc(doc(db,'messages',conversationId,'msgs',msg.id), { 
      text: '🚫 Message deleted', 
      mediaUrl: null, 
      deleted: true 
    });
  }
}} style={{background:'none',border:'none',color:'rgba(255,45,85,0.4)',fontSize:10,cursor:'pointer',padding:'0 2px',alignSelf:'flex-end',marginBottom:2}}>✕</button>
              )}
            </div>
          );
        })}
        {otherTyping && (
  <div style={{ display:'flex', alignItems:'flex-end', gap:8, marginBottom:8, animation:'fadeIn 0.3s ease' }}>
    <div style={{ width:28, height:28, borderRadius:'50%', background:otherUser?.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:11, overflow:'hidden', flexShrink:0 }}>
      {otherUser?.avatarUrl ? <img src={otherUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : otherUser?.avatar}
    </div>
    <div style={{ background:'rgba(255,255,255,0.09)', borderRadius:'18px 18px 18px 4px', padding:'12px 16px', display:'flex', gap:5, alignItems:'center', border:'1px solid rgba(255,255,255,0.06)' }}>
      {[0,1,2].map(i=>(
        <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'rgba(255,255,255,0.6)',
          animation:`pulse 1.4s ease ${i*0.22}s infinite`,
          transform:`scaleY(${1})` }}/>
      ))}
    </div>
    <span style={{ color:'rgba(255,255,255,0.25)', fontSize:10, marginBottom:4 }}>typing...</span>
  </div>
)}
        <div ref={bottomRef}/>
      </div>

      {(previewFile||audioBlob)&&(
        <div style={{padding:'0 14px 6px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,0.05)',borderRadius:14,padding:'8px 12px'}}>
            {previewFile?.type?.startsWith('image')&&<img src={previewFile.url} alt="" style={{height:44,width:44,objectFit:'cover',borderRadius:8}}/>}
            {previewFile?.type?.startsWith('video')&&<video src={previewFile.url} style={{height:44,width:60,objectFit:'cover',borderRadius:8}}/>}
            {audioBlob&&!previewFile&&<audio src={URL.createObjectURL(audioBlob)} controls style={{height:28,flex:1}}/>}
            <button onClick={clearAttach} style={{marginLeft:'auto',background:'rgba(255,45,85,0.2)',border:'none',borderRadius:'50%',width:22,height:22,color:'#FF2156',cursor:'pointer',fontSize:13}}>✕</button>
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
      <div style={{padding:'10px 14px',paddingBottom:'max(28px, env(safe-area-inset-bottom))',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',gap:8,alignItems:'center'}}>        <button onClick={()=>fileInputRef.current?.click()} style={{background:'rgba(255,255,255,0.07)',border:'none',borderRadius:'50%',width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" onChange={pickFile} style={{display:'none'}}/>
        <input value={text} onChange={e=>{
          setText(e.target.value);
          setDoc(doc(db,'typing',conversationId),{[currentUser.id]:serverTimestamp()},{merge:true}).catch(()=>{});
        }} onKeyDown={e=>e.key==='Enter'&&handleSend()} placeholder={isRecording?`🔴 ${fmt(recordSecs)}`:'Message...'} style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:28,padding:'11px 16px',color:'white',outline:'none',fontSize:13}}/>
        {!text.trim() && !previewFile && !audioBlob && (
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
                });
                await setDoc(doc(db,'conversations',conversationId), {
                  participants:[currentUser.id,otherUser?.id],
                  lastMessage:'🎤 Voice message',
                  lastMessageAt:serverTimestamp(),
                },{merge:true});
                await sendNotification(otherUser?.id, currentUser.id, 'message', `🎤 ${currentUser.username} sent a voice message`);
              } catch(e) { showToast?.('Failed to send voice','error'); }
            }}
          />
        )}
        <button onClick={()=>setShowEmoji(v=>!v)} style={{background:'rgba(255,255,255,0.07)',border:'none',borderRadius:'50%',width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,fontSize:18}}>😊</button>
        <button onClick={handleSend} style={{background:'linear-gradient(135deg,#FF2156,#9D4EDD)',border:'none',borderRadius:'50%',width:42,height:42,color:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>          <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1"><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
};

const InboxPage = ({ t, users, currentUser, showToast, onViewProfile, initialTargetId, onClearTarget, persistedConversation, onSetConversation, onVoiceCall, onVideoCall, openGroupsSignal }) => {
  const [activeConversation, setActiveConversation] = useState(persistedConversation || null);
  const [conversations, setConversations] = useState([]);
  const [showGroupsView, setShowGroupsView] = useState(false);
  const [inboxSearch, setInboxSearch] = useState('');
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
    const q = query(
      collection(db,'conversations'),
      where('participants','array-contains',currentUser.id),
      orderBy('lastMessageAt','desc')
    );
    const unsub = onSnapshot(q, snap=>{
      setConversations(snap.docs.map(d=>({id:d.id,...d.data()})));
      // Mark messages as delivered for this user
snap.docs.forEach(async conv => {
  const convId = conv.id;
  const msgSnap = await getDocs(
    query(collection(db,'messages',convId,'msgs'), 
    where('to','==',currentUser.id), 
    where('status','==','sent'))
  );
  msgSnap.docs.forEach(d => updateDoc(d.ref, { status: 'delivered' }).catch(()=>{}));
});
    }, (error)=>{
      console.error('Conversations index error:', error);
      // Fallback without orderBy
      const q2 = query(collection(db,'conversations'), where('participants','array-contains',currentUser.id));
      onSnapshot(q2, snap2=>{
        const sorted = snap2.docs
          .map(d=>({id:d.id,...d.data()}))
          .sort((a,b)=>(b.lastMessageAt?.seconds||0)-(a.lastMessageAt?.seconds||0));
        setConversations(sorted);
        // Mark messages as delivered for this user
      snap2.docs.forEach(async conv => {
        const convId = conv.id;
        try {
          const msgSnap = await getDocs(
            query(collection(db,'messages',convId,'msgs'),
            where('to','==',currentUser.id),
            where('status','==','sent'))
          );
          msgSnap.docs.forEach(d => updateDoc(d.ref, { status: 'delivered' }).catch(()=>{}));
        } catch(e) {}
      });
      });
    });
    return ()=>unsub();
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
    }, { merge: true }).catch(() => {});
  };

  const convUsers = useMemo(()=>{
    if(!currentUser?.id) return [];
    return users.filter(u=>{
      if(u.id===currentUser.id) return false;
      const convId = getConversationId(currentUser.id, u.id);
      return conversations.some(c=>c.id===convId);
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
      <ConversationView
        currentUser={currentUser}
        otherUser={otherUser}
        conversationId={activeConversation.id}
        onBack={()=>{ setActiveConversation(null); onSetConversation?.(null); onClearTarget?.(); }}
        showToast={showToast}
        onViewProfile={uid=>{ onViewProfile?.(uid); }}
        onVoiceCall={onVoiceCall}
        onVideoCall={onVideoCall}
      />
    );
  }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#0B0B0F' }}>
      <div style={{ padding:'14px 16px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={{ color:'white', fontWeight:800, fontSize:22, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{t?.inbox||'Messages'}</div>
          <button onClick={()=>setShowGroupsView(true)} style={{ background:'rgba(255,45,85,0.1)', border:'1px solid rgba(255,45,85,0.2)', borderRadius:20, padding:'6px 14px', color:'#FF2156', fontSize:12, fontWeight:700, cursor:'pointer' }}>👥 Groups</button>
        </div>
        {/* Inline search — Telegram standard */}
        <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,0.06)', borderRadius:14, padding:'9px 12px', gap:8, border:'1px solid rgba(255,255,255,0.08)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            placeholder="Search messages..."
            value={inboxSearch||''}
            onChange={e=>setInboxSearch?.(e.target.value)}
            style={{ flex:1, background:'none', border:'none', color:'white', outline:'none', fontSize:14 }} />
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto' }}>
        {(() => {
          const filteredConvUsers = inboxSearch
            ? convUsers.filter(u => u.username?.toLowerCase().includes(inboxSearch.toLowerCase()) || u.fullName?.toLowerCase().includes(inboxSearch.toLowerCase()))
            : convUsers;
          if (filteredConvUsers.length === 0) return (
            <div style={{textAlign:'center',padding:60,color:'rgba(255,255,255,0.2)'}}>
              <div style={{fontSize:44,marginBottom:12}}>💬</div>
              <div style={{fontSize:14}}>{inboxSearch ? `No chats matching "${inboxSearch}"` : t?.noMessages||'No messages yet'}</div>
              {!inboxSearch && <div style={{fontSize:12,marginTop:6,color:'rgba(255,255,255,0.12)'}}>{t?.startChat||'Go to a profile and tap Message to start'}</div>}
            </div>
          );
          return filteredConvUsers.map(u=>{
          const convId = getConversationId(currentUser.id, u.id);
          const conv = conversations.find(c=>c.id===convId);
          return (
            <div key={u.id} onClick={()=>openConversation(u.id)} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}>
              <div style={{ position:'relative' }}>
                <div style={{ width:52, height:52, borderRadius:'50%', background:u.avatarColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:22, overflow:'hidden' }}>
                  {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : u.avatar}
                </div>
                <div style={{ position:'absolute', bottom:1, right:1, width:13, height:13, background:'#00E6B4', borderRadius:'50%', border:'2px solid #0B0B0F' }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:'white', fontWeight:700, fontSize:14, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>@{u.username}</div>
                <div style={{ color:'rgba(255,255,255,0.35)', fontSize:12, marginTop:2 }}>{conv?.lastMessage||'Tap to start chatting'}</div>
              </div>
              <div style={{ color:'rgba(255,255,255,0.2)', fontSize:11 }}>{conv?.lastMessageAt?'Now':''}</div>
            </div>
          );
        });
        })()}
      </div>
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
      <div style={{width:120,height:120,borderRadius:'50%',background:callData.callerColor||'#FF2156',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'bold',fontSize:48,margin:'0 auto 20px',border:'4px solid rgba(255,255,255,0.2)',boxShadow:'0 0 0 12px rgba(255,255,255,0.05),0 0 0 24px rgba(255,255,255,0.03)'}}>
        {callData.callerAvatar||'?'}
      </div>
      <div style={{color:'white',fontSize:28,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>@{callData.callerName}</div>
      <div style={{color:'rgba(255,255,255,0.4)',fontSize:14,marginTop:8,animation:'pulse 1.5s infinite'}}>Calling...</div>
    </div>
    <div style={{display:'flex',justifyContent:'space-around',width:'100%',alignItems:'center'}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
        <button onClick={onDecline} style={{width:70,height:70,borderRadius:'50%',background:'#FF2156',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:'0 8px 30px rgba(255,45,85,0.5)'}}>
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

const CallModal = ({ type, contactName, contactAvatar, contactId, currentUser, onClose, isCallee: isCalleeProp, callDocId: callDocIdProp }) => {
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState('calling');
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
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
          await setDoc(doc(db, 'calls', callDocId.current), {
            offer: { type: offer.type, sdp: offer.sdp },
            callType: type, callerId: currentUser?.id, callerName: currentUser?.username,
            callerAvatar: currentUser?.avatar, callerColor: currentUser?.avatarColor,
            calleeId: contactId, calleeName: contactName, status: 'ringing', createdAt: serverTimestamp(),
          }).catch(()=>{});
unsubAnswerRef.current = onSnapshot(doc(db, 'calls', callDocId.current), async (snap) => {
            const data = snap.data();
            if (data?.answer && pc.signalingState === 'have-local-offer') {
              try { await pc.setRemoteDescription(new RTCSessionDescription(data.answer)); setStatus('connected'); } catch {}
            }
            if (data?.status === 'declined') { setStatus('declined'); setTimeout(onClose, 1500); }
          });
unsubCandidatesRef.current = onSnapshot(collection(db, 'calls', callDocId.current, 'calleeCandidates'), (snap) => {
            snap.docChanges().forEach(async (change) => {
              if (change.type === 'added') {
                try { await pc.addIceCandidate(new RTCIceCandidate(change.doc.data())); } catch {}
              }
            });
          });
        }
        setTimeout(() => setStatus(s => s === 'calling' ? 'connected' : s), 8000);
      } catch (e) {
        console.error('Call error:', e);
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

  return (
    <div style={{ position:'fixed', inset:0, background:'#0B0B0F', zIndex:2500, display:'flex', flexDirection:'column' }}>
      {type === 'video' ? (
        <video ref={remoteVideoRef} autoPlay playsInline style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', background:'#15151C' }} />
      ) : (
        <audio ref={remoteVideoRef} autoPlay playsInline style={{ display:'none' }} />
      )}
      {status !== 'connected' && (
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(160deg,#0a0a1a,#1a0a0a)', zIndex:1 }}>
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 30%,rgba(255,45,85,0.2),transparent 60%)' }} />
        </div>
      )}
      {type === 'video' && (
        <video ref={localVideoRef} autoPlay playsInline muted style={{ position:'absolute', top:60, right:16, width:100, height:140, objectFit:'cover', borderRadius:16, border:'2px solid rgba(255,255,255,0.2)', zIndex:10, background:'#24242E' }} />
      )}
      <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:20, padding:'56px 20px 20px', textAlign:'center' }}>
        {type !== 'video' && (
          <div style={{ width:110, height:110, borderRadius:'50%', padding:3, background:'conic-gradient(#FF2156,#9D4EDD,#FF2156)', margin:'0 auto 20px', animation:status==='calling'?'storyRing 4s linear infinite':'' }}>
            <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:'#1a0a0a', padding:2, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:'#FF2156', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:42 }}>
                {contactAvatar || '?'}
              </div>
            </div>
          </div>
        )}
        <div style={{ color:'white', fontSize:22, fontWeight:800, fontFamily:"'Inter',sans-serif" }}>@{contactName}</div>
        <div style={{ color:'rgba(255,255,255,0.5)', fontSize:13, marginTop:6 }}>{statusLabel}</div>
      </div>
      <div style={{ position:'absolute', bottom:60, left:0, right:0, zIndex:20, display:'flex', justifyContent:'center', gap:20 }}>
        <button onClick={toggleMute} style={{ background:isMuted?'rgba(255,45,85,0.9)':'rgba(255,255,255,0.12)', border:'none', borderRadius:'50%', width:60, height:60, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            {isMuted
              ? <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
              : <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
            }
          </svg>
        </button>
        <button onClick={onClose} style={{ background:'#FF2156', border:'none', borderRadius:'50%', width:70, height:70, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 0 30px rgba(255,45,85,0.5)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91"/>
            <line x1="23" y1="1" x2="1" y2="23"/>
          </svg>
        </button>
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

/* ─────────────── SEARCH OVERLAY — TELEGRAM STANDARDS ─────────────── */
const SearchOverlay = ({ onClose, videos, users, onViewProfile }) => {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dagu_recent_searches') || '[]'); } catch { return []; }
  });
  const [trendingSearches] = useState(['#viral', '#ethiopia', '#music', '#dance', '#comedy', '#travel', '#food', '#fashion']);

  const addRecentSearch = (term) => {
    if (!term.trim()) return;
    const updated = [term, ...recentSearches.filter(r => r !== term)].slice(0, 8);
    setRecentSearches(updated);
    try { localStorage.setItem('dagu_recent_searches', JSON.stringify(updated)); } catch {}
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try { localStorage.removeItem('dagu_recent_searches'); } catch {}
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
    <div style={{ position:'absolute', inset:0, background:'#0B0B0F', zIndex:200, display:'flex', flexDirection:'column' }}>
      {/* ── Header ── */}
      <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:10, alignItems:'center', background:'rgba(10,10,10,0.98)', backdropFilter:'blur(20px)' }}>
        <div style={{ flex:1, display:'flex', alignItems:'center', background:'rgba(255,255,255,0.07)', borderRadius:14, padding:'11px 14px', gap:10, border:'1.5px solid rgba(255,255,255,0.1)', transition:'border-color 0.2s' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input autoFocus value={query}
            onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter' && query.trim()) addRecentSearch(query.trim()); }}
            placeholder="Search users, posts, hashtags..."
            style={{ flex:1, background:'none', border:'none', color:'white', outline:'none', fontSize:15, fontWeight:500 }} />
          {query && <button onClick={()=>setQuery('')} style={{ background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'50%', width:20, height:20, color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>}
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.55)', fontSize:14, cursor:'pointer', fontWeight:600, padding:'4px 8px' }}>Cancel</button>
      </div>

      {/* ── Filter tabs (when searching) ── */}
      {query.trim() && (
        <div style={{ display:'flex', padding:'8px 12px', gap:6, borderBottom:'1px solid rgba(255,255,255,0.06)', overflowX:'auto', scrollbarWidth:'none' }}>
          {SEARCH_TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ flexShrink:0, background:tab===t.id?'rgba(255,45,85,0.15)':'rgba(255,255,255,0.04)', border:tab===t.id?'1px solid rgba(255,45,85,0.4)':'1px solid rgba(255,255,255,0.07)', padding:'6px 14px', color:tab===t.id?'#FF2156':'rgba(255,255,255,0.45)', cursor:'pointer', borderRadius:20, fontSize:12, fontWeight:700, transition:'all 0.15s' }}>{t.label}</button>
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
                  <span style={{ color:'rgba(255,255,255,0.35)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>Recent</span>
                  <button onClick={clearRecentSearches} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:12, cursor:'pointer' }}>Clear</button>
                </div>
                {recentSearches.map((term,i)=>(
                  <div key={i} onClick={()=>setQuery(term)} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><polyline points="12 8 12 12 14 14"/><circle cx="12" cy="12" r="10"/></svg>
                    </div>
                    <span style={{ color:'rgba(255,255,255,0.75)', fontSize:14, flex:1 }}>{term}</span>
                    <button onClick={e=>{e.stopPropagation(); const u=[...recentSearches]; u.splice(i,1); setRecentSearches(u); try{localStorage.setItem('dagu_recent_searches',JSON.stringify(u));}catch{}}} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.2)', cursor:'pointer', fontSize:16 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginBottom:8 }}>
              <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>🔥 Trending</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {trendingSearches.map((tag,i)=>(
                  <button key={i} onClick={()=>{ setQuery(tag); addRecentSearch(tag); }} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'8px 14px', color:'rgba(255,255,255,0.7)', fontSize:13, cursor:'pointer', fontWeight:600 }}>{tag}</button>
                ))}
              </div>
            </div>
            <div style={{ marginTop:24 }}>
              <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>Suggested People</div>
              {users.slice(0,5).map(u=>(
                <div key={u.id} onClick={()=>{onViewProfile?.(u.id); addRecentSearch('@'+u.username); onClose();}} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}>
                  <div style={{ width:44, height:44, borderRadius:'50%', background:u.avatarColor||'#FF2156', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:18, overflow:'hidden', flexShrink:0 }}>
                    {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : u.avatar}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:'white', fontWeight:700, fontSize:14 }}>@{u.username}</div>
                    <div style={{ color:'rgba(255,255,255,0.35)', fontSize:12, marginTop:1 }}>{u.bio?.substring(0,40)||'No bio'}</div>
                  </div>
                  {u.verified && <svg width="16" height="16" viewBox="0 0 24 24" fill="#2F9BFF"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Search results ── */}
        {query.trim() && (
          <div style={{ padding:'8px 14px' }}>
            {totalResults === 0 && (
              <div style={{ textAlign:'center', padding:'60px 20px', color:'rgba(255,255,255,0.25)' }}>
                <div style={{ fontSize:44, marginBottom:12 }}>🔍</div>
                <div style={{ fontSize:15, fontWeight:600 }}>No results for "{query}"</div>
                <div style={{ fontSize:13, marginTop:6 }}>Try different keywords</div>
              </div>
            )}

            {/* People */}
            {(tab==='all'||tab==='users') && results.users.length > 0 && (
              <div style={{ marginBottom:20 }}>
                {tab==='all' && <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>People</div>}
                {results.users.map(u=>(
                  <div key={u.id} onClick={()=>{onViewProfile?.(u.id); addRecentSearch('@'+u.username); onClose();}} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 12px', background:'rgba(255,255,255,0.03)', borderRadius:16, marginBottom:6, cursor:'pointer', border:'1px solid rgba(255,255,255,0.05)', transition:'background 0.1s' }}>
                    <div style={{ position:'relative', flexShrink:0 }}>
                      <div style={{ width:48, height:48, borderRadius:'50%', background:u.avatarColor||'#FF2156', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:20, overflow:'hidden' }}>
                        {u.avatarUrl ? <img src={u.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : u.avatar}
                      </div>
                      {u.isOnline && <div style={{ position:'absolute', bottom:1, right:1, width:12, height:12, background:'#2ED573', borderRadius:'50%', border:'2px solid #0B0B0F' }} />}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ color:'white', fontWeight:700, fontSize:14 }}>@{u.username}</span>
                        {u.verified && <svg width="14" height="14" viewBox="0 0 24 24" fill="#2F9BFF"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                      </div>
                      <div style={{ color:'rgba(255,255,255,0.35)', fontSize:12, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.bio?.substring(0,50)||'No bio'}</div>
                      <div style={{ color:'rgba(255,255,255,0.2)', fontSize:11, marginTop:1 }}>{(u.followers?.length||0).toLocaleString()} followers</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                ))}
              </div>
            )}

            {/* Videos */}
            {(tab==='all'||tab==='videos') && results.videos.length > 0 && (
              <div style={{ marginBottom:20 }}>
                {tab==='all' && <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Videos</div>}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {results.videos.slice(0,6).map(v=>(
                    <div key={v.id} style={{ aspectRatio:'9/16', position:'relative', borderRadius:14, overflow:'hidden', background:'#1C1C24', cursor:'pointer' }}>
                      {v.videoUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i) || v.mediaType?.startsWith('image')
                        ? <img src={v.videoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : <video src={v.videoUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted />}
                      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(transparent,rgba(0,0,0,0.8))', padding:'20px 8px 8px' }}>
                        <div style={{ color:'white', fontSize:11, fontWeight:700 }}>@{v.username}</div>
                        <div style={{ color:'rgba(255,255,255,0.6)', fontSize:10, marginTop:1 }}>{v.likes||0} ❤️</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hashtags */}
            {(tab==='all'||tab==='hashtags') && results.hashtags.length > 0 && (
              <div style={{ marginBottom:20 }}>
                {tab==='all' && <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Hashtags</div>}
                {results.hashtags.map((h,i)=>(
                  <div key={i} onClick={()=>{ setQuery(h); addRecentSearch(h); }} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 12px', background:'rgba(255,255,255,0.03)', borderRadius:14, marginBottom:6, cursor:'pointer', border:'1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ width:40, height:40, borderRadius:12, background:'rgba(255,45,85,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>#</div>
                    <div>
                      <div style={{ color:'#FF2156', fontWeight:700, fontSize:14 }}>{h}</div>
                      <div style={{ color:'rgba(255,255,255,0.3)', fontSize:12 }}>{videos.filter(v=>v.hashtags?.includes(h)).length} posts</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Posts text search */}
            {(tab==='all'||tab==='posts') && results.posts.length > 0 && (
              <div style={{ marginBottom:20 }}>
                {tab==='all' && <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Posts</div>}
                {results.posts.map(v=>(
                  <div key={v.id} style={{ padding:'12px 14px', background:'rgba(255,255,255,0.03)', borderRadius:14, marginBottom:6, border:'1px solid rgba(255,255,255,0.05)', cursor:'pointer' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:users.find(u=>u.id===v.userId)?.avatarColor||'#FF2156', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:12, fontWeight:'bold' }}>
                        {users.find(u=>u.id===v.userId)?.avatarUrl ? <img src={users.find(u=>u.id===v.userId).avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : v.username?.[0]?.toUpperCase()}
                      </div>
                      <span style={{ color:'#FF2156', fontSize:12, fontWeight:700 }}>@{v.username}</span>
                      <span style={{ color:'rgba(255,255,255,0.2)', fontSize:11, marginLeft:'auto' }}>{v.likes||0} ❤️</span>
                    </div>
                    <div style={{ color:'rgba(255,255,255,0.8)', fontSize:13, lineHeight:1.5 }}>{v.description?.substring(0,100)}{v.description?.length>100?'...':''}</div>
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
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video:{ facingMode: facing }, audio: true });
      streamRef.current = s;
      if(videoRef.current) videoRef.current.srcObject = s;
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
    } catch { showToast?.('Camera denied','error'); }
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
    timerRef.current = setInterval(() => setRecordSeconds(s => { if(s>=MAX_RECORD_SECONDS-1){ stopRecording(); return MAX_RECORD_SECONDS; } return s+1; }), 1000);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
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
          avatar: currentUser.avatar || (currentUser.username||'U')[0].toUpperCase(),
          avatarColor: currentUser.avatarColor || '#FF2156',
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
          avatar: currentUser.avatar || (currentUser.username||'U')[0].toUpperCase(),
          avatarColor: currentUser.avatarColor || '#FF2156',
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
      const ref = await addDoc(collection(db,'videos'), videoData);
      onUpload?.({ id:ref.id, ...videoData, createdAt:{ toDate: ()=>new Date() } });
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
        <button onClick={handleUpload} disabled={uploading} style={{ background:'linear-gradient(135deg,#FF2156,#9D4EDD)', border:'none', borderRadius:20, padding:'8px 18px', color:'white', fontWeight:700, cursor:'pointer', fontSize:13, opacity:uploading?0.7:1 }}>
          {uploading ? `${uploadProgress}%` : 'Post ✓'}
        </button>
      </div>
      {uploading && <div style={{ height:3, background:'rgba(255,255,255,0.1)' }}><div style={{ height:'100%', background:'linear-gradient(90deg,#FF2156,#9D4EDD)', width:`${uploadProgress}%`, transition:'width 0.3s' }} /></div>}
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
            <div style={{ width:56, height:56, borderRadius:14, overflow:'hidden', border: i===activeFilter?'2px solid #FF2156':'2px solid transparent' }}>
              <img src={selectedFile.type==='image/multi' ? selectedFile.urls[0] : selectedFile.type.startsWith('image/')?selectedFile.url:'https://picsum.photos/56'} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', filter: f.css||'none' }} />
            </div>
            <div style={{ color: i===activeFilter?'#FF2156':'rgba(255,255,255,0.5)', fontSize:9, marginTop:4, fontWeight:700 }}>{f.name}</div>
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
          <button onClick={()=>setShowFilters(!showFilters)} style={{ background: showFilters?'rgba(255,45,85,0.5)':'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%', width:40, height:40, color:'white', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>✨</button>
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
          <div style={{ position:'absolute', top:60, left:'50%', transform:'translateX(-50%)', background:'rgba(255,45,85,0.9)', borderRadius:20, padding:'6px 16px', display:'flex', alignItems:'center', gap:8 }}>
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
              style={{ writingMode:'vertical-lr', WebkitAppearance:'slider-vertical', height:120, width:24, accentColor:'#FF2156' }}
            />
          </div>
        )}
        {/* Live filter strip */}
        {showFilters && (
          <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', bottom:0, left:0, right:0, padding:'10px 0 10px 16px', background:'linear-gradient(transparent,rgba(0,0,0,0.7))', overflowX:'auto', display:'flex', gap:10 }}>
            {FILTERS.map((f,i)=>(
              <div key={f.name} onClick={()=>setActiveFilter(i)} style={{ flexShrink:0, textAlign:'center', cursor:'pointer' }}>
                <div style={{ width:52, height:52, borderRadius:12, background:'rgba(255,255,255,0.15)', border: i===activeFilter?'2px solid #FF2156':'2px solid transparent', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
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
            <button key={m} onClick={()=>setCameraMode(m)} style={{ background:'none', border:'none', color: cameraMode===m?'white':'rgba(255,255,255,0.35)', fontSize:13, fontWeight:700, cursor:'pointer', textTransform:'uppercase', letterSpacing:1, borderBottom: cameraMode===m?'2px solid #FF2156':'2px solid transparent', paddingBottom:4 }}>{m}</button>
          ))}
        </div>

        {/* Speed selector (video only, before recording) */}
        {cameraMode==='video' && !recording && (
          <div style={{ display:'flex', justifyContent:'center', gap:10, marginBottom:24 }}>
            {[0.5,1,2,3].map(sp=>(
              <button key={sp} onClick={()=>setRecordSpeed(sp)} style={{ background: recordSpeed===sp?'rgba(255,45,85,0.25)':'rgba(255,255,255,0.08)', border: recordSpeed===sp?'1px solid #FF2156':'1px solid rgba(255,255,255,0.1)', borderRadius:16, padding:'5px 12px', color: recordSpeed===sp?'#FF2156':'rgba(255,255,255,0.6)', fontSize:12, fontWeight:700, cursor:'pointer' }}>{sp}x</button>
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
            <button onClick={recording?stopRecording:startRecording} style={{ width:76, height:76, borderRadius:'50%', background: recording?'#FF2156':'white', border:'5px solid rgba(255,255,255,0.3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
              {recording && (
                <svg width="86" height="86" viewBox="0 0 86 86" style={{ position:'absolute', top:-5, left:-5, transform:'rotate(-90deg)', pointerEvents:'none' }}>
                  <circle cx="43" cy="43" r="40" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                  <circle cx="43" cy="43" r="40" fill="none" stroke="#FF2156" strokeWidth="3"
                    strokeDasharray={`${2*Math.PI*40}`}
                    strokeDashoffset={`${2*Math.PI*40*(1 - recordSeconds/MAX_RECORD_SECONDS)}`}
                    style={{ transition:'stroke-dashoffset 1s linear' }} />
                </svg>
              )}
              {recording
                ? <div style={{ width:24, height:24, borderRadius:4, background:'white' }} />
                : <div style={{ width:76, height:76, borderRadius:'50%', background:'#FF2156' }} />
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
    <div style={{ position:'fixed', inset:0, background:'#0B0B0F', zIndex:200, display:'flex', flexDirection:'column' }}>
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
            <div style={{ width:48, height:48, borderRadius:16, background:'linear-gradient(135deg,#FF2156,#9D4EDD)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🎵</div>
            <div style={{ flex:1 }}>
              <div style={{ color:'white', fontWeight:700, fontSize:13, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>{sound.name}</div>
              <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, marginTop:2 }}>{sound.artist} · {sound.duration}</div>
            </div>
            {sound.popular && <span style={{ color:'#FFB100', fontSize:11, fontWeight:700 }}>🔥 {formatNumber(sound.usage)}</span>}
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
    <div style={{ position:'fixed', inset:0, background:'#0B0B0F', zIndex:200, overflow:'auto' }}>
      <div style={{ padding:'60px 20px 20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ color:'white', fontSize:24, fontWeight:800, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Analytics</h2>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'none', borderRadius:20, padding:'8px 18px', color:'white', cursor:'pointer', fontSize:13 }}>Close</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:20 }}>
          {[['Total Views',formatNumber(totalViews),'#00E6B4'],['Total Likes',formatNumber(totalLikes),'#FF2156'],['Posts',String(userVideos.length),'#9D4EDD'],['Coins',String(user?.coins||0),'#FFD60A']].map(([label,val,color])=>(
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
                <div style={{ width:'100%', height:`${Math.max((v/maxVal)*100,4)}%`, background:`linear-gradient(180deg,#FF2156,#9D4EDD)`, borderRadius:6 }} />
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
              <div style={{ color:'#00E6B4', fontSize:12, fontWeight:700 }}>{formatNumber(v.views||0)} views</div>
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
    <div style={{ background:'#15151C', borderRadius:28, padding:32, textAlign:'center', maxWidth:300, width:'100%', margin:'0 20px', border:'1px solid rgba(255,255,255,0.08)', position:'relative' }}>
      <button onClick={onClose} style={{ position:'absolute', top:14, right:14, background:'rgba(255,255,255,0.08)', border:'none', borderRadius:'50%', width:32, height:32, color:'white', cursor:'pointer', fontSize:16 }}>✕</button>
      <div style={{ color:'white', fontWeight:800, fontSize:18, marginBottom:20, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>My QR Code</div>
      <div style={{ width:180, height:180, margin:'0 auto 20px', borderRadius:20, overflow:'hidden', background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
  <img
    src={`https://chart.googleapis.com/chart?chs=160x160&cht=qr&chl=${encodeURIComponent('https://infinity-now.vercel.app/user/' + user?.username)}&choe=UTF-8`}
    alt="QR Code"
    style={{ width:160, height:160 }}
  />
</div>
      <h3 style={{ color:'white', marginBottom:4, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>@{user?.username}</h3>
      <p style={{ color:'rgba(255,255,255,0.35)', fontSize:12, marginBottom:20 }}>Scan to follow on Infinity</p>
      <button onClick={()=>navigator.share?.({title:'Infinity',text:`Follow @${user?.username} on Infinity`,url:`https://infinity-now.vercel.app`
})} style={{ width:'100%', background:'linear-gradient(135deg,#FF2156,#9D4EDD)', border:'none', borderRadius:20, padding:13, color:'white', fontWeight:700, cursor:'pointer', fontSize:14, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>Share Profile</button>
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
      setVideos(snap.docs.map(d=>({id:d.id,...d.data()})));
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
        <button onClick={onSignIn} style={{ background:'linear-gradient(135deg,#FF2156,#9D4EDD)', border:'none', borderRadius:28, padding:'14px 36px', color:'white', fontWeight:800, fontSize:15, cursor:'pointer', boxShadow:'0 4px 24px rgba(255,45,85,0.5)' }}>
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
  const [birthdate, setBirthdate] = useState('');
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
    profile = { ...emailSnap.docs[0].data(), id: emailSnap.docs[0].id };
    onLogin({...profile, id: fbUser.uid});
    setLoading(false);
    return;
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
      if(!username){ setError('Username required'); setLoading(false); return; }
      if(!fullName){ setError('Full name required'); setLoading(false); return; }
      if(!birthdate){ setError('Date of birth is required'); setLoading(false); return; }
      const ageMs = Date.now() - new Date(birthdate).getTime();
      if(ageMs < 13*365.25*24*60*60*1000){ setError('You must be at least 13 years old to sign up'); setLoading(false); return; }

      const usersSnap = await getDocs(query(collection(db,'users'), where('username','==',username)));
      if(!usersSnap.empty){ setError('Username already taken'); setLoading(false); return; }

      const emailSnap = await getDocs(query(collection(db,'users'), where('email','==',identifier)));
      if(!emailSnap.empty){
        await deleteDoc(doc(db,'users',emailSnap.docs[0].id));
      }

      // ⚠️ SECURITY NOTE: This OTP is generated and verified entirely client-side
      // (compared against React state in the 'otp' step below). Anyone with devtools
      // access can read `pendingOtp` from component state or React DevTools and bypass
      // this check entirely — it provides NO real protection against fake signups.
      // A proper fix requires server-side verification (e.g. a Cloud Function that
      // generates/stores the OTP and validates it before allowing account creation,
      // or using Firebase's built-in email-link/phone auth flows instead of a
      // custom OTP). Treat this as a UX speed-bump only, not a security control.
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
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#0B0B0F', overflow:'auto' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 24px 20px', position:'relative' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 30%,rgba(255,45,85,0.2),rgba(175,82,222,0.1),transparent 65%)' }} />
        <div style={{ position:'relative', textAlign:'center', marginBottom:40 }}>
          <img src="https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png" style={{ width:80, height:80, borderRadius:24, objectFit:'cover', margin:'0 auto 20px', display:'block', boxShadow:'0 20px 60px rgba(255,45,85,0.4)' }} />
          <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, marginTop:10 }}>{isLogin?'Welcome back! 👋':'Join the community 🎉'}</p>
        </div>
        <div style={{ position:'relative', width:'100%', maxWidth:340 }}>
          <div style={{ color:'rgba(255,255,255,0.3)', fontSize:11, marginBottom:14, textAlign:'center', fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>{isLogin?'Sign in with':'Sign up with'}</div>
          {error && error.trim().length > 1 && <div style={{background:'rgba(255,45,85,0.1)',border:'1px solid rgba(255,45,85,0.3)',borderRadius:12,padding:'10px 14px',color:'#FF2156',fontSize:12,marginBottom:12,textAlign:'center'}}>{error}</div>}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginBottom:24 }}>
            {LOGIN_METHODS.map(m=>(
              <button key={m.id} onClick={()=>handleMethodSelect(m)} disabled={loading} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.05)', border:`1px solid rgba(255,255,255,0.1)`, borderRadius:30, padding:'8px 16px', cursor:'pointer', fontSize:13, color:'rgba(255,255,255,0.8)', transition:'all 0.15s', opacity:loading?0.5:1 }}>
                <span style={{ fontSize:16 }}>{m.icon}</span>{m.name}
              </button>
            ))}
          </div>
          {loading && <div style={{textAlign:'center',color:'rgba(255,255,255,0.5)',fontSize:13,marginBottom:12}}>⏳ Signing in...</div>}
          <button onClick={()=>setIsLogin(!isLogin)} style={{ width:'100%', background:'none', border:'none', color:'#FF2156', fontSize:14, cursor:'pointer', fontWeight:600 }}>
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
    <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,background:'#0B0B0F'}}>
      <div style={{textAlign:'center',maxWidth:300,width:'100%'}}>
        <div style={{fontSize:64,marginBottom:16}}>📲</div>
        <div style={{color:'white',fontWeight:800,fontSize:22,marginBottom:10,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>Enter OTP</div>
        <div style={{color:'rgba(255,255,255,0.5)',fontSize:14,lineHeight:1.6,marginBottom:20}}>
          We sent a 6-digit code to <strong style={{color:'white'}}>{pendingCreds?.email}</strong>
        </div>
        {error && <div style={{background:'rgba(255,45,85,0.1)',border:'1px solid rgba(255,45,85,0.3)',borderRadius:12,padding:'10px 14px',color:'#FF2156',fontSize:12,marginBottom:12}}>{error}</div>}
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
            await sendEmailVerification(result.user);
            const existingProfile = await getUserProfile(result.user.uid);
            if(existingProfile){ onLogin({...existingProfile, id: result.user.uid}); setLoading(false); return; }

await createUserProfile(result.user.uid, {
  username: pendingCreds.username,
  fullName: pendingCreds.fullName,
  email: pendingCreds.email,
  birthdate: pendingCreds.birthdate || '',
});
// Wait for Firestore write to propagate
await new Promise(r => setTimeout(r, 1500));
const profile = await getUserProfile(result.user.uid);
if(profile) {
  onLogin({...profile, id: result.user.uid});
} else {
  // Profile exists in Auth, build it from what we know and log in directly
  const fallbackProfile = buildDefaultProfile(result.user.uid, {
    username: pendingCreds.username,
    fullName: pendingCreds.fullName,
    email: pendingCreds.email,
    birthdate: pendingCreds.birthdate || '',
  });
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
        }} disabled={loading||otpInput.length!==6} style={{width:'100%',background:'linear-gradient(135deg,#FF2156,#9D4EDD)',border:'none',borderRadius:24,padding:15,color:'white',fontWeight:700,cursor:'pointer',fontSize:15,marginBottom:12,opacity:(loading||otpInput.length!==6)?0.5:1,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>
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
    <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,background:'#0B0B0F'}}>
      <div style={{textAlign:'center',maxWidth:300,width:'100%'}}>
        <div style={{fontSize:64,marginBottom:16}}>🔑</div>
        <div style={{color:'white',fontWeight:800,fontSize:22,marginBottom:10,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>Reset Password</div>
        <div style={{color:'rgba(255,255,255,0.5)',fontSize:14,lineHeight:1.6,marginBottom:20}}>Enter your email and we'll send a reset link.</div>
        {error && <div style={{background:'rgba(255,45,85,0.1)',border:'1px solid rgba(255,45,85,0.3)',borderRadius:12,padding:'10px 14px',color:'#FF2156',fontSize:12,marginBottom:12}}>{error}</div>}
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
        }} disabled={loading} style={{width:'100%',background:'linear-gradient(135deg,#FF2156,#9D4EDD)',border:'none',borderRadius:24,padding:15,color:'white',fontWeight:700,cursor:'pointer',fontSize:15,marginBottom:12,opacity:loading?0.6:1,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>
          {loading?'Sending...':'Send Reset Link'}
        </button>
        <button onClick={()=>{setStep('method');setError('');}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:13,cursor:'pointer',textDecoration:'underline'}}>Back to sign in</button>
      </div>
    </div>
  );

  if(step==='resetpw_sent') return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,background:'#0B0B0F'}}>
      <div style={{textAlign:'center',maxWidth:300}}>
        <div style={{fontSize:64,marginBottom:16}}>📬</div>
        <div style={{color:'white',fontWeight:800,fontSize:22,marginBottom:10,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>Check your inbox</div>
        <div style={{color:'rgba(255,255,255,0.5)',fontSize:14,lineHeight:1.6,marginBottom:28}}>We sent a password reset link to <strong style={{color:'white'}}>{identifier}</strong>.</div>
        <button onClick={()=>{setStep('method');setError('');}} style={{width:'100%',background:'linear-gradient(135deg,#FF2156,#9D4EDD)',border:'none',borderRadius:24,padding:15,color:'white',fontWeight:700,cursor:'pointer',fontSize:15,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>Back to Sign In →</button>
      </div>
    </div>
  );

if(step==='verify') return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,background:'#0B0B0F'}}>
      <div style={{textAlign:'center',maxWidth:300}}>
        <div style={{fontSize:64,marginBottom:16}}>📧</div>
        <div style={{color:'white',fontWeight:800,fontSize:22,marginBottom:10,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>Verify your email</div>
        <div style={{color:'rgba(255,255,255,0.5)',fontSize:14,lineHeight:1.6,marginBottom:28}}>We sent a link to <strong style={{color:'white'}}>{identifier}</strong>. Click it then come back to sign in.</div>
        <button onClick={()=>{setStep('method');setIsLogin(true);}} style={{width:'100%',background:'linear-gradient(135deg,#FF2156,#9D4EDD)',border:'none',borderRadius:24,padding:15,color:'white',fontWeight:700,cursor:'pointer',fontSize:15,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"}}>Go to Sign In →</button>
      </div>
    </div>
  );
return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'#0B0B0F' }}>
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
          {error && <div style={{background:'rgba(255,45,85,0.1)',border:'1px solid rgba(255,45,85,0.3)',borderRadius:12,padding:'10px 14px',color:'#FF2156',fontSize:12,marginBottom:12}}>{error}</div>}
          {!isLogin && <>
            <input placeholder="Full Name" value={fullName} onChange={e=>setFullName(e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'13px 16px', color:'white', marginBottom:10, outline:'none', fontSize:14, boxSizing:'border-box' }} />
            <input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'13px 16px', color:'white', marginBottom:10, outline:'none', fontSize:14, boxSizing:'border-box' }} />
            <div style={{marginBottom:10}}>
              <div style={{color:'rgba(255,255,255,0.4)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:7}}>Date of Birth *</div>
              <div style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,padding:'8px 4px',display:'flex',gap:0,position:'relative'}}>
                <div style={{position:'absolute',top:'50%',left:8,right:8,height:36,background:'rgba(255,45,85,0.08)',borderRadius:10,transform:'translateY(-50%)',pointerEvents:'none',border:'1px solid rgba(255,45,85,0.2)'}}/>
                {[
                  {label:'Month',items:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],val:birthdate?parseInt(birthdate.split('-')[1])-1:0,set:(i)=>{ const p=birthdate||'2000-01-01'; const parts=p.split('-'); parts[1]=String(i+1).padStart(2,'0'); setBirthdate(parts.join('-')); }},
                  {label:'Day',items:Array.from({length:31},(_,i)=>String(i+1)),val:birthdate?parseInt(birthdate.split('-')[2])-1:0,set:(i)=>{ const p=birthdate||'2000-01-01'; const parts=p.split('-'); parts[2]=String(i+1).padStart(2,'0'); setBirthdate(parts.join('-')); }},
                  {label:'Year',items:Array.from({length:100},(_,i)=>String(new Date().getFullYear()-13-i)),val:birthdate?Array.from({length:100},(_,i)=>String(new Date().getFullYear()-13-i)).indexOf(birthdate.split('-')[0]):0,set:(i)=>{ const p=birthdate||'2000-01-01'; const parts=p.split('-'); parts[0]=String(new Date().getFullYear()-13-i); setBirthdate(parts.join('-')); }},
                ].map(col=>(
                  <div key={col.label} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center'}}>
                    <div style={{color:'rgba(255,255,255,0.3)',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:4}}>{col.label}</div>
                    <div style={{height:108,overflowY:'auto',width:'100%',scrollSnapType:'y mandatory',WebkitOverflowScrolling:'touch'}}>
                      {col.items.map((item,i)=>(
                        <div key={item} onClick={()=>col.set(i)} style={{height:36,display:'flex',alignItems:'center',justifyContent:'center',fontSize:i===col.val?15:12,fontWeight:i===col.val?800:400,color:i===col.val?'white':'rgba(255,255,255,0.3)',cursor:'pointer',scrollSnapAlign:'start',transition:'all 0.15s'}}>
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>}
          <input placeholder="Email" value={identifier} onChange={e=>setIdentifier(e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'13px 16px', color:'white', marginBottom:10, outline:'none', fontSize:14, boxSizing:'border-box' }} />
          <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'13px 16px', color:'white', marginBottom:14, outline:'none', fontSize:14, boxSizing:'border-box' }} />
          <button onClick={handleSubmit} disabled={loading||!identifier||!password||(!isLogin&&(!username||!fullName||!birthdate))} style={{ width:'100%', background:'linear-gradient(135deg,#FF2156,#9D4EDD)', border:'none', borderRadius:24, padding:15, color:'white', fontWeight:700, cursor:'pointer', fontSize:15, opacity:(loading||!identifier||!password)?0.5:1, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>
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
/* ─────────────── NOTIFICATIONS — REAL-TIME INSTAGRAM/TELEGRAM GRADE ─────────────── */
const NotificationsPage = ({ currentUser, users, videos, onClose, onViewProfile, t, onNavigate }) => {
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

  const icons = { like:'❤️', comment:'💬', follow:'👤', mention:'@', gift:'🎁', live:'🔴', story:'📖', call:'📞', message:'✉️', jobApplication:'💼', applicationReceived:'✅', applicationUpdate:'📋', permissionRequest:'🔑' };
  const typeLabel = { like:'liked your post', comment:'commented', follow:'followed you', mention:'mentioned you', gift:'sent a gift', live:'went live', message:'sent a message', jobApplication:'applied to your job', applicationReceived:'application update', applicationUpdate:'application update' };

  const [activeFilter, setActiveFilter] = useState('all');
  const NOTIF_FILTERS = [
    {id:'all', label:'All'},
    {id:'like', label:'Likes'},
    {id:'comment', label:'Comments'},
    {id:'follow', label:'Follows'},
    {id:'message', label:'Messages'},
    {id:'story', label:'Stories'},
  ];
  const filteredNotifs = activeFilter === 'all' ? notifs : notifs.filter(n => n.type === activeFilter);

  const timeAgoShort = (date) => {
    if (!date) return '';
    const s = Math.floor((new Date() - date) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s/60)}m`;
    if (s < 86400) return `${Math.floor(s/3600)}h`;
    if (s < 86400*7) return `${Math.floor(s/86400)}d`;
    return date.toLocaleDateString();
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'#0B0B0F', zIndex:300, display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ padding:'16px 16px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={{ color:'white', fontWeight:800, fontSize:22, fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>
            Notifications
            {unreadCount > 0 && <span style={{ marginLeft:8, background:'#FF2156', color:'white', fontSize:12, fontWeight:700, borderRadius:20, padding:'2px 8px' }}>{unreadCount}</span>}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {unreadCount>0 && <button onClick={markAllRead} style={{ background:'rgba(255,45,85,0.1)', border:'1px solid rgba(255,45,85,0.2)', borderRadius:20, padding:'6px 12px', color:'#FF2156', fontSize:11, fontWeight:700, cursor:'pointer' }}>Mark all read</button>}
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.07)', border:'none', borderRadius:'50%', width:34, height:34, color:'white', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          </div>
        </div>
        {/* Category filters */}
        <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', paddingBottom:12 }}>
          {NOTIF_FILTERS.map(f=>(
            <button key={f.id} onClick={()=>setActiveFilter(f.id)} style={{ flexShrink:0, background:activeFilter===f.id?'rgba(255,45,85,0.15)':'rgba(255,255,255,0.04)', border:`1px solid ${activeFilter===f.id?'rgba(255,45,85,0.4)':'rgba(255,255,255,0.07)'}`, borderRadius:20, padding:'6px 14px', color:activeFilter===f.id?'#FF2156':'rgba(255,255,255,0.45)', fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 0.15s' }}>{f.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto' }}>
        {filteredNotifs.length===0 && (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'rgba(255,255,255,0.2)' }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🔔</div>
            <div style={{ fontSize:15, fontWeight:600 }}>No notifications yet</div>
            <div style={{ fontSize:13, marginTop:6 }}>{activeFilter==='all' ? 'Interact with others to receive notifications' : `No ${activeFilter} notifications`}</div>
          </div>
        )}
        {filteredNotifs.map(n=>{
          const fromUser = users.find(u=>u.id===n.fromUserId);
          const iconBg = {like:'rgba(255,45,85,0.15)',comment:'rgba(0,122,255,0.15)',follow:'rgba(175,82,222,0.15)',mention:'rgba(255,149,0,0.15)',gift:'rgba(255,215,0,0.15)',live:'rgba(255,45,85,0.15)',story:'rgba(175,82,222,0.15)',message:'rgba(52,199,89,0.15)',call:'rgba(52,199,89,0.15)'}[n.type]||'rgba(255,255,255,0.06)';
          return (
            <div key={n.id} onClick={()=>handleNotifTap(n)} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 16px', borderBottom:'1px solid rgba(255,255,255,0.04)', cursor:'pointer', background:n.read?'transparent':'rgba(255,45,85,0.03)', transition:'background 0.1s' }}>
              {/* Avatar with type badge */}
              <div style={{ position:'relative', flexShrink:0 }}>
                <div style={{ width:48, height:48, borderRadius:'50%', background:fromUser?.avatarColor||'#34343E', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:19, overflow:'hidden', border:!n.read?'2px solid rgba(255,45,85,0.4)':'2px solid transparent' }}>
                  {fromUser?.avatarUrl ? <img src={fromUser.avatarUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" /> : (fromUser?.avatar||'?')}
                </div>
                <div style={{ position:'absolute', bottom:-2, right:-2, width:22, height:22, borderRadius:'50%', background:iconBg, border:'2px solid #0B0B0F', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>{icons[n.type]||'🔔'}</div>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:'white', fontSize:13.5, lineHeight:1.5 }}>
                  {fromUser && <span style={{ fontWeight:700 }}>@{fromUser.username} </span>}
                  <span style={{ color:'rgba(255,255,255,0.75)' }}>{n.message}</span>
                </div>
                <div style={{ color:'rgba(255,255,255,0.28)', fontSize:11, marginTop:3 }}>{timeAgoShort(n.date)}</div>
              </div>
              {/* Action area */}
              <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:8 }}>
                {!n.read && <div style={{ width:9, height:9, borderRadius:'50%', background:'#FF2156', flexShrink:0 }} />}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
          );
        })}
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
  return <div style={{ position:'absolute', top:-4, right:-4, minWidth:16, height:16, background:'#FF2156', borderRadius:8, border:'1.5px solid #0B0B0F', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'white', fontWeight:800, padding:'0 3px' }}>{unread>9?'9+':unread}</div>;
};
const TabIcon = ({id, active, currentUser}) => {
  const color = active ? '#FF2156' : 'rgba(255,255,255,0.35)';
  const sw = active ? 2.2 : 1.8;
  const s = {width:26,height:26,fill:'none',stroke:color,strokeWidth:sw,strokeLinecap:'round',strokeLinejoin:'round'};
  if(id==='home') return (
    <div style={{ position:'relative' }}>
      <svg viewBox="0 0 24 24" style={s}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      {active && <div style={{ position:'absolute', bottom:-8, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:'#FF2156' }} />}
    </div>
  );
  if(id==='friends') return (
    <div style={{ position:'relative' }}>
      <svg viewBox="0 0 24 24" style={s}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
      {active && <div style={{ position:'absolute', bottom:-8, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:'#FF2156' }} />}
    </div>
  );
  if(id==='create') return (
    <div style={{ width:52, height:34, background:'linear-gradient(135deg,#FF2156,#9D4EDD)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(255,45,85,0.4)' }}>
      <svg viewBox="0 0 24 24" style={{ width:22,height:22,stroke:'white',fill:'none',strokeWidth:2.5,strokeLinecap:'round' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </div>
  );
  if(id==='inbox') return (
    <div style={{ position:'relative' }}>
      <svg viewBox="0 0 24 24" style={s}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      <InboxBadge currentUser={currentUser} />
      {active && <div style={{ position:'absolute', bottom:-8, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:'#FF2156' }} />}
    </div>
  );
  if(id==='profile') return (
    <div style={{ position:'relative' }}>
      <svg viewBox="0 0 24 24" style={{...s,fill:active?'rgba(255,45,85,0.15)':''}}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      {active && <div style={{ position:'absolute', bottom:-8, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:'#FF2156' }} />}
    </div>
  );
  return null;
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
  const [notifPopup, setNotifPopup] = useState(null);
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
const [blockedUsers, setBlockedUsers] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  // ── v4 NEW STATE ──
  const [showSavedPosts, setShowSavedPosts] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [notifBadgeCount, setNotifBadgeCount] = useState(0);

  const showToast = useCallback((message, type='info')=>setToast({message,type}),[]);
  const isOnline = useNetworkStatus();
  const t = TRANSLATIONS[currentUser?.language || 'en'] || TRANSLATIONS.en;
  const { theme, toggleTheme, isDark } = useTheme(currentUser);

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
        if(profile) {
  setCurrentUser({...profile, id:fbUser.uid, language: profile.language || 'en'});
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
    },()=>{});
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
    window.addEventListener('beforeunload',()=>{
      setDoc(doc(db,'presence',profile.id),{online:false,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
    });
    try {
      const permission = await Notification.requestPermission();
      if(permission === 'granted') {
        await registerNotifServiceWorker();
        const token = messaging ? await getToken(messaging, { vapidKey: VAPID_KEY }) : null;
        if(token) await updateDoc(doc(db,'users',profile.id),{ fcmToken: token });
      }
    } catch(e) { console.log('Push notification setup failed:', e); }
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

  const tabs = [
    {id:'home'},{id:'friends'},{id:'create'},{id:'inbox'},{id:'profile'},
  ];

  if(authLoading) return (
    <div style={{ maxWidth:430, margin:'0 auto', height:'100dvh', background:'#0B0B0F', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <GlobalStyles />
      {!isOnline && <OfflineBanner />}
      <img src="https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png" style={{ width:80, height:80, borderRadius:24, marginBottom:16 }} alt="Infinity" />
      <div style={{ width:32, height:32, border:'3px solid rgba(255,45,85,0.3)', borderTop:'3px solid #FF2156', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
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

  return (
    <div style={{ maxWidth:430, margin:'0 auto', height:'100dvh', background:'#0B0B0F', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}>
      <GlobalStyles />
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
      {showCall && <CallModal type={showCall.type} contactName={showCall.contactName} contactAvatar={showCall.contactAvatar} contactId={showCall.contactId} currentUser={currentUser} onClose={()=>setShowCall(null)} isCallee={showCall.isCallee} callDocId={showCall.callDocId} />}
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
      {showNotifications && <NotificationsPage currentUser={currentUser} users={users} videos={videos} onClose={()=>setShowNotifications(false)} onViewProfile={uid=>{handleViewProfile(uid); setShowNotifications(false);}} t={t} onNavigate={(tab, opts)=>{ setShowNotifications(false); if(tab==='inbox'){ setActiveTab('inbox'); if(opts?.targetUserId) setInboxTargetId(opts.targetUserId); } else if(tab==='jobs'){ setActiveTab('friends'); } else { setActiveTab(tab||'home'); } }} />}
      {showAnalytics && <CreatorAnalytics user={currentUser} videos={videos} onClose={()=>setShowAnalytics(false)} />}
      {showCreateStory && <CreateStoryModal currentUser={currentUser} onClose={()=>setShowCreateStory(false)} showToast={showToast} />}
      {/* ── v4 NEW OVERLAYS ── */}

      {showSavedPosts && <SavedPostsPage currentUser={currentUser} showToast={showToast} onClose={()=>setShowSavedPosts(false)} />}
      {showDiscover && <DiscoverPage videos={videos} users={users} onViewProfile={uid=>{handleViewProfile(uid);}} showToast={showToast} onClose={()=>setShowDiscover(false)} />}
      {showShareSheet && <ShareSheet video={showShareSheet} currentUser={currentUser} onClose={()=>setShowShareSheet(null)} showToast={showToast} />}
      {showBroadcast && <BroadcastPage currentUser={currentUser} users={users} showToast={showToast} onClose={()=>setShowBroadcast(false)} />}
      {viewingProfile && (
        <UserProfileModal user={viewingProfile} currentUser={currentUser} onClose={()=>setViewingProfile(null)} onFollow={toggleFollow} onMessage={uid=>{handleMessage(uid); setViewingProfile(null);}} onVoiceCall={uid=>{const u=users.find(uu=>uu.id===uid); setShowCall({type:'audio',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid}); setViewingProfile(null);}}
 onVideoCall={uid=>{const u=users.find(uu=>uu.id===uid); setShowCall({type:'video',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid}); setViewingProfile(null);}}
 followed={followed} showToast={showToast} userVideos={videos.filter(v=>v.userId===viewingProfile?.id)} />
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
          />
        </div>
      )}

      <div style={{ flex:1, overflow:'hidden', position:'relative', minHeight:0 }}>
        {showSearch && <SearchOverlay onClose={()=>setShowSearch(false)} videos={videos} users={users} onViewProfile={uid=>{handleViewProfile(uid); setShowSearch(false);}} />}
        {showCamera && <CameraUpload onUpload={v=>{setVideos(prev=>[v,...prev]);}} onClose={()=>setShowCamera(false)} showToast={showToast} currentUser={currentUser} />}
        {!showSearch && !showCamera && (
          <>
            {activeTab==='home' && <HomeFeed t={t} videos={videos} currentUser={currentUser} onLike={()=>{}} onComment={()=>{}} onShare={(v)=>setShowShareSheet(v)} onFollow={toggleFollow} onMessage={handleMessage}
  onVoiceCall={uid=>{ const u=users.find(uu=>uu.id===uid); const callDocId=[currentUser.id,uid].sort().join('_'); setShowCall({type:'audio',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid,callDocId}); }}
  onVideoCall={uid=>{ const u=users.find(uu=>uu.id===uid); const callDocId=[currentUser.id,uid].sort().join('_'); setShowCall({type:'video',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid,callDocId}); }}
  onDuet={()=>showToast?.('Duet mode ready','info')} onStitch={()=>showToast?.('Stitch mode ready','info')} onSaveSound={()=>showToast?.('Sound saved!','success')}
  followed={followed} showToast={showToast} onLive={()=>setShowLiveStream(currentUser)} onViewProfile={handleViewProfile}
  onOpenSearch={()=>setShowDiscover(true)} onOpenNotifications={()=>setShowNotifications(true)}
  blockedUsers={blockedUsers} onBlock={uid=>setBlockedUsers(p=>[...p,uid])} users={users} />}
            {activeTab==='friends' && <FriendsFeed t={t} friends={friends} videos={videos} currentUser={currentUser} onMessage={handleMessage}
  onVoiceCall={uid=>{ const u=users.find(uu=>uu.id===uid); const callDocId=[currentUser.id,uid].sort().join('_'); setShowCall({type:'audio',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid,callDocId}); }}
  onVideoCall={uid=>{ const u=users.find(uu=>uu.id===uid); const callDocId=[currentUser.id,uid].sort().join('_'); setShowCall({type:'video',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid,callDocId}); }}
  blockedUsers={blockedUsers} onViewProfile={handleViewProfile} showToast={showToast} users={users}
  onCreateStory={()=>setShowCreateStory(true)} onViewStory={setShowStoryViewer} onFollow={toggleFollow} followed={followed}
  onLive={()=>setShowLiveStream(currentUser)} onBlock={uid=>setBlockedUsers(p=>[...p,uid])}
  onOpenSearch={()=>setShowDiscover(true)} />}
            {activeTab==='create' && <CreateScreen onOpenCamera={()=>setShowCamera(true)} onShowSoundLibrary={()=>setShowSoundLibrary(true)} showToast={showToast} t={t} />}
            {activeTab==='inbox' && <InboxPage t={t} users={users} currentUser={currentUser} showToast={showToast} onViewProfile={handleViewProfile} initialTargetId={inboxTargetId} onClearTarget={()=>setInboxTargetId(null)} persistedConversation={activeConversation} openGroupsSignal={inboxOpenGroups} onSetConversation={(conv)=>{ setActiveConversation(conv); }}
  onVoiceCall={uid=>{ const u=users.find(uu=>uu.id===uid); const callDocId=[currentUser.id,uid].sort().join('_'); setShowCall({type:'audio',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid,callDocId}); }}
  onVideoCall={uid=>{ const u=users.find(uu=>uu.id===uid); const callDocId=[currentUser.id,uid].sort().join('_'); setShowCall({type:'video',contactName:u?.username,contactAvatar:u?.avatar,contactId:uid,callDocId}); }}
/>}
            {activeTab==='profile' && <ProfilePage user={currentUser} setCurrentUser={setCurrentUser} onLogout={handleLogout} users={users} showToast={showToast} onShowAnalytics={()=>setShowAnalytics(true)} onShowQRCode={()=>setShowQRCode(true)} allVideos={videos} setBlockedUsers={setBlockedUsers} onShowSavedPosts={()=>setShowSavedPosts(true)} onGoToGroups={()=>{ setActiveTab('inbox'); setInboxOpenGroups(n=>n+1); }} onShowBroadcast={()=>setShowBroadcast(true)} onViewProfile={handleViewProfile} />}
          </>
        )}
      </div>

      <div style={{ display:'flex', background:'rgba(6,6,8,0.98)', borderTop:'1px solid rgba(255,255,255,0.05)', padding:`10px 4px max(26px, env(safe-area-inset-bottom))`, flexShrink:0, backdropFilter:'blur(30px)', WebkitBackdropFilter:'blur(30px)' }}>
        {tabs.map(tab=>{
          const isActive = activeTab===tab.id;
          const tabLabels = { home: t?.home||'Home', friends: t?.friends||'Friends', create: t?.create||'Create', inbox: t?.inbox||'Inbox', profile: t?.profile||'Profile' };
          return (
            <button key={tab.id}
              onClick={()=>{ haptic('light'); if(tab.id==='create'){ setShowCamera(true); } else { setShowCamera(false); setShowSearch(false); setActiveTab(tab.id); } }}
              style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, background:'none', border:'none', cursor:'pointer', padding: tab.id==='create'?'0':'6px 0', position:'relative',
                transform: isActive && tab.id!=='create' ? 'translateY(-1px)' : 'translateY(0)',
                transition:'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div style={{ position:'relative' }}>
                <TabIcon id={tab.id} active={isActive} currentUser={currentUser} />
                {isActive && tab.id!=='create' && (
                  <div style={{ position:'absolute', bottom:-6, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:'#FF2156', animation:'bounceIn 0.3s ease' }} />
                )}
              </div>
              {tab.id !== 'create' && (
                <span style={{ fontSize:9, color:isActive?'#FF2156':'rgba(255,255,255,0.28)', fontWeight:isActive?800:400, transition:'color 0.2s', letterSpacing:0.3 }}>
                  {tabLabels[tab.id]}
                </span>
              )}
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
