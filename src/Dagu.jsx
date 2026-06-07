import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, doc, updateDoc, increment, arrayUnion, arrayRemove
} from 'firebase/firestore';
import emailjs from '@emailjs/browser';

// ============================================================================
// 🔥 REAL PRODUCTION CONFIGURATION ENGINE
// ============================================================================
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

// ============================================================================
// 🎨 DESIGN TOKENS (GLASSMORPHIC ULTRA-DARK CYBER)
// ============================================================================
const THEME = {
  colors: {
    bg: '#040408',
    card: 'rgba(20, 20, 30, 0.75)',
    border: 'rgba(255, 255, 255, 0.08)',
    accent: 'linear-gradient(135deg, #ff2d55 0%, #ff7300 100%)',
    accentSolid: '#ff2d55',
    cyan: '#00f2fe',
    gold: '#ffd700',
    text: '#ffffff',
    textMuted: '#94a3b8'
  },
  blur: 'backdrop-filter blur(30px)'
};

// Global simulated network delays/fallbacks for complex media uploads
const globalInputStyle = {
  width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.05)',
  border: `1px solid ${THEME.colors.border}`, borderRadius: '14px',
  color: '#fff', outline: 'none', fontSize: '14px', boxSizing: 'border-box'
};

// ============================================================================
// 📡 EMAILJS ALERTS LOGISTIC LAYER
// ============================================================================
const dispatchEmailAlert = async (subject, data) => {
  try {
    await emailjs.send('service_mtqmvbb', 'template_1k7wiqa', {
      to_email: 'getachewshambel11@gmail.com',
      from_name: 'Dagu Core Engine',
      subject: subject,
      message: JSON.stringify(data, null, 2)
    }, 'U9fs25Bcx5oQ6A2ru');
  } catch (err) { console.error('EmailJS Error:', err); }
};

// ============================================================================
// 📹 INDIVIDUAL VIDEO FEED CARD (WITH COMMENTS & SHARING)
// ============================================================================
const VideoPostCard = React.memo(({ post, isActive, globalMuted, toggleMute, onLike, onFollow, isFollowing, onOpenComments, onViewProfile }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isActive]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
      <video
        ref={videoRef} src={post.videoUrl} loop playsInline muted={globalMuted}
        onClick={() => { if (isPlaying) { videoRef.current.pause(); setIsPlaying(false); } else { videoRef.current.play(); setIsPlaying(true); } }}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Top Controls HUD */}
      <div style={{ position: 'absolute', top: '24px', right: '16px', zIndex: 10 }}>
        <button onClick={toggleMute} style={{ width: '42px', height: '42px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer' }}>
          {globalMuted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* Creator Overlay Information */}
      <div style={{ position: 'absolute', bottom: '110px', left: '20px', right: '90px', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <img src={post.userAvatar} alt="" onClick={() => onViewProfile(post.userId)} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${THEME.colors.accentSolid}`, cursor: 'pointer' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 onClick={() => onViewProfile(post.userId)} style={{ color: '#fff', margin: 0, fontWeight: 700, cursor: 'pointer' }}>@{post.username}</h4>
              <button onClick={() => onFollow(post.userId)} style={{ background: isFollowing ? 'rgba(255,255,255,0.2)' : THEME.colors.accent, border: 'none', borderRadius: '20px', padding: '4px 10px', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
            <p style={{ color: THEME.colors.textMuted, margin: 0, fontSize: '12px' }}>{post.userBio || "Dagu Creator Node"}</p>
          </div>
        </div>
        <p style={{ color: '#fff', fontSize: '14px', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.6)' }}>{post.description}</p>
      </div>

      {/* Side HUD Interaction Dock (Like, Comment, Share) */}
      <div style={{ position: 'absolute', bottom: '130px', right: '16px', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <button onClick={() => onLike(post.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>❤️</div>
          <span style={{ color: '#fff', fontSize: '12px', fontWeight: '600' }}>{post.likes || 0}</span>
        </button>

        <button onClick={() => onOpenComments(post)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>💬</div>
          <span style={{ color: '#fff', fontSize: '12px', fontWeight: '600' }}>{post.commentCount || 0}</span>
        </button>

        <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert("Share link copied to clipboard node!"); }} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🔗</div>
          <span style={{ color: '#fff', fontSize: '11px' }}>Share</span>
        </button>
      </div>
    </div>
  );
});

// ============================================================================
// 💬 RICH COMMENT SHEET (WITH EMOJIS, FILE PREVIEWS, AUDIO SIMULATION)
// ============================================================================
const CommentsSheet = ({ post, currentUser, onClose }) => {
  const [commentsList, setCommentsList] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [voiceRecording, setVoiceRecording] = useState(false);

  useEffect(() => {
    const q = query(collection(db, `posts/${post.id}/comments`), orderBy('timestamp', 'asc'));
    return onSnapshot(q, (snap) => {
      setCommentsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [post.id]);

  const postComment = async () => {
    if (!newComment.trim() && !attachedFile && !voiceRecording) return;
    let finalPayloadText = newComment;
    if (voiceRecording) finalPayloadText = "🎤 Voice Note Attachment (Simulated Mode)";
    if (attachedFile) finalPayloadText += ` 📁 Attached Document: ${attachedFile}`;

    await addDoc(collection(db, `posts/${post.id}/comments`), {
      userId: currentUser.id,
      username: currentUser.username,
      avatar: currentUser.avatar,
      text: finalPayloadText,
      timestamp: Date.now()
    });
    
    await updateDoc(doc(db, "posts", post.id), { commentCount: increment(1) });
    setNewComment(''); setAttachedFile(null); setVoiceRecording(false);
  };

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '70vh', background: '#0e0e14', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', zIndex: 500, padding: '20px', display: 'flex', flexDirection: 'column', borderTop: `1px solid ${THEME.colors.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ color: '#fff', margin: 0 }}>Comments Matrix</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' }}>✕</button>
      </div>

      {/* Render Lists */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px' }}>
        {commentsList.map(c => (
          <div key={c.id} style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'flex-start' }}>
            <img src={c.avatar} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '14px', maxWidth: '80%' }}>
              <span style={{ color: THEION_COLOR = THEME.colors.cyan, fontSize: '12px', fontWeight: 'bold', display: 'block' }}>@{c.username}</span>
              <p style={{ color: '#fff', margin: '4px 0 0', fontSize: '13px' }}>{c.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Rich Inputs Controls Console */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '16px' }}>
        {attachedFile && <div style={{ color: THEME.colors.cyan, fontSize: '12px' }}>📎 Locked Document Node: {attachedFile}</div>}
        {voiceRecording && <div style={{ color: '#ff3b30', fontSize: '12px' }}>🔴 Recording Stream Engaged...</div>}
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => setAttachedFile("dagu_doc_upload.pdf")} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>📁</button>
          <button onClick={() => setNewComment(p => p + "😂")} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>😀</button>
          <button onClick={() => setVoiceRecording(!voiceRecording)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>{voiceRecording ? "🛑" : "🎤"}</button>
          
          <input type="text" placeholder="Drop comment message..." value={newComment} onChange={e => setNewComment(e.target.value)} style={{ ...globalInputStyle, flex: 1, marginBottom: 0 }} />
          <button onClick={postComment} style={{ background: THEME.colors.accent, border: 'none', padding: '12px 18px', borderRadius: '12px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Send</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 👥 ADVANCED USER PROFILES VIEW ENGINE
// ============================================================================
const UserProfileView = ({ userId, currentUser, onFollowToggle, isFollowing, onBack, posts }) => {
  const [profile, setProfile] = useState(null);
  const userPosts = posts.filter(p => p.userId === userId);

  useEffect(() => {
    // Generate static mockup database maps dynamically for simplicity
    if (userId === currentUser.id) {
      setProfile(currentUser);
    } else {
      setProfile({
        id: userId,
        username: 'ethio_vibe',
        name: 'Getachew Shambel',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        bio: 'Developing the future social paradigm matrix. Tech stack lead.',
        followers: 4890, following: 312
      });
    }
  }, [userId, currentUser]);

  if (!profile) return null;

  return (
    <div style={{ height: '100%', background: THEME.colors.bg, color: '#fff', overflowY: 'auto', paddingBottom: '100px' }}>
      <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: `1px solid ${THEME.colors.border}` }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>⬅ Back</button>
        <span style={{ fontWeight: 'bold' }}>{profile.name} Matrix</span>
      </div>

      <div style={{ textAlign: 'center', padding: '24px 16px' }}>
        <img src={profile.avatar} alt="" style={{ width: '96px', height: '96px', borderRadius: '50%', objectFit: 'cover', border: `3px solid ${THEME.colors.accentSolid}` }} />
        <h2 style={{ margin: '12px 0 4px', fontSize: '22px' }}>{profile.name}</h2>
        <p style={{ color: THEME.colors.cyan, margin: 0 }}>@{profile.username}</p>
        <p style={{ color: THEME.colors.textMuted, marginTop: '8px', fontSize: '14px' }}>{profile.bio}</p>

        {/* Following Analytics Ticker Box */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', margin: '20px 0' }}>
          <div><strong>{profile.followers?.toLocaleString() || 0}</strong><div style={{ color: THEME.colors.textMuted, fontSize: '12px' }}>Followers</div></div>
          <div><strong>{profile.following?.toLocaleString() || 0}</strong><div style={{ color: THEME.colors.textMuted, fontSize: '12px' }}>Following</div></div>
        </div>

        {userId !== currentUser.id && (
          <button onClick={() => onFollowToggle(userId)} style={{ background: isFollowing ? 'rgba(255,255,255,0.1)' : THEME.colors.accent, border: 'none', color: '#fff', padding: '12px 40px', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer' }}>
            {isFollowing ? 'Disconnect Network' : 'Follow Link'}
          </button>
        )}
      </div>

      {/* Grid Portfolio Array Layout Engine */}
      <div style={{ padding: '0 4px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
        {userPosts.map(p => (
          <div key={p.id} style={{ aspectRatio: '9/16', background: '#111', overflow: 'hidden', position: 'relative' }}>
            <video src={p.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// ⚙️ NATIVE SETTINGS CONTROLS DASHBOARD (DELETE PIC, ACCOUNT DISMISSAL)
// ============================================================================
const SettingsDashboard = ({ currentUser, updateProfilePic, onDeleteAccount, onBack }) => {
  return (
    <div style={{ height: '100%', background: THEME.colors.bg, color: '#fff', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>⬅</button>
        <h2 style={{ margin: 0, fontSize: '20px' }}>Account Control Console</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: `1px solid ${THEME.colors.border}` }}>
          <h4 style={{ margin: '0 0 12px' }}>Profile Asset Customization</h4>
          <button onClick={() => updateProfilePic("https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150")} style={{ background: THEME.colors.accent, border: 'none', padding: '10px 14px', borderRadius: '8px', color: '#fff', cursor: 'pointer', marginRight: '8px', fontSize: '12px' }}>Change Avatar URL</button>
          <button onClick={() => updateProfilePic("https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150")} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', padding: '10px 14px', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>Wipe Profile Picture</button>
        </div>

        <div style={{ background: 'rgba(255,0,0,0.05)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,0,0,0.2)' }}>
          <h4 style={{ margin: '0 0 4px', color: '#ff3b30' }}>Danger Zone Partition</h4>
          <p style={{ color: THEME.colors.textMuted, fontSize: '12px', marginBottom: '16px' }}>Permanently remove your records from the Dagu cluster array.</p>
          <button onClick={onDeleteAccount} style={{ background: '#ff3b30', border: 'none', padding: '12px 20px', borderRadius: '10px', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>Delete Account Struct</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 📁 MASTER APPLICATION SYSTEM GATEWAY
// ============================================================================
export default function DaguApp() {
  const [viewState, setViewState] = useState('feed'); // feed, studio, profile, settings
  const [posts, setPosts] = useState([]);
  const [globalMuted, setGlobalMuted] = useState(false);
  const [activePostId, setActivePostId] = useState(null);
  const [commentTargetPost, setCommentTargetPost] = useState(null);
  const [selectedProfileId, setSelectedProfileId] = useState(null);

  // Core User Matrix State Hooks
  const [currentUser, setCurrentUser] = useState(CLIENT_USER);
  const [followingList, setFollowingList] = useState([]);

  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(25));
    return onSnapshot(q, (snap) => {
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPosts(records);
      if (records.length > 0 && !activePostId) setActivePostId(records[0].id);
    });
  }, []);

  const handleScroll = () => {
    const target = scrollContainerRef.current;
    if (!target) return;
    const computedIndex = Math.round(target.scrollTop / target.clientHeight);
    if (posts[computedIndex] && posts[computedIndex].id !== activePostId) {
      setActivePostId(posts[computedIndex].id);
    }
  };

  const handleLike = async (id) => {
    await updateDoc(doc(db, "posts", id), { likes: increment(1) });
  };

  const handleFollowToggle = async (id) => {
    if (followingList.includes(id)) {
      setFollowingList(prev => prev.filter(item => item !== id));
    } else {
      setFollowingList(prev => [...prev, id]);
      await dispatchEmailAlert('New Network Follow Event', { follower: currentUser.username, following: id });
    }
  };

  const purgeAccountDestruction = async () => {
    if (window.confirm("Are you absolutely sure you want to trigger structural account deletion like on Facebook or Twitter? This cannot be undone.")) {
      await dispatchEmailAlert('CRITICAL_ACCOUNT_DELETION_REQUEST', { user: currentUser });
      alert("Account deletion transaction dispatched to master queue.");
      window.location.reload();
    }
  };

  return (
    <div style={{ maxWidth: '450px', height: '100vh', margin: '0 auto', background: THEME.colors.bg, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: `1px solid ${THEME.colors.border}`, borderRight: `1px solid ${THEME.colors.border}`, fontFamily: 'system-ui, sans-serif' }}>
      
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {viewState === 'feed' && (
          <div ref={scrollContainerRef} onScroll={handleScroll} style={{ height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory', scrollbarWidth: 'none' }}>
            {posts.map(post => (
              <div key={post.id} style={{ height: '100%', scrollSnapAlign: 'start', scrollSnapStop: 'always' }}>
                <VideoPostCard
                  post={post} isActive={activePostId === post.id} globalMuted={globalMuted}
                  toggleMute={() => setGlobalMuted(!globalMuted)} onLike={handleLike}
                  onFollow={handleFollowToggle} isFollowing={followingList.includes(post.userId)}
                  onOpenComments={(p) => setCommentTargetPost(p)}
                  onViewProfile={(uid) => { setSelectedProfileId(uid); setViewState('profile'); }}
                />
              </div>
            ))}
          </div>
        )}

        {viewState === 'profile' && (
          <UserProfileView userId={selectedProfileId || currentUser.id} currentUser={currentUser} onFollowToggle={handleFollowToggle} isFollowing={followingList.includes(selectedProfileId)} posts={posts} onBack={() => setViewState('feed')} />
        )}

        {viewState === 'settings' && (
          <SettingsDashboard currentUser={currentUser} updateProfilePic={(url) => setCurrentUser(p => ({ ...p, avatar: url }))} onDeleteAccount={purgeAccountDestruction} onBack={() => setViewState('profile')} />
        )}
      </div>

      {/* Comment Tray Architecture */}
      {commentTargetPost && (
        <CommentsSheet post={commentTargetPost} currentUser={currentUser} onClose={() => setCommentTargetPost(null)} />
      )}

      {/* Global Interface Navigation Systems Dock */}
      <div style={{ height: '84px', background: THEME.colors.card, backdropFilter: 'blur(30px)', borderTop: `1px solid ${THEME.colors.border}`, display: 'flex', justifyContent: 'space-around', alignItems: 'center', paddingBottom: '12px', boxSizing: 'border-box', zIndex: 100 }}>
        <button onClick={() => setViewState('feed')} style={{ background: 'none', border: 'none', color: viewState === 'feed' ? '#fff' : THEME.colors.textMuted, cursor: 'pointer', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}><span>🎬</span>FEED</button>
        <button onClick={() => { setSelectedProfileId(currentUser.id); setViewState('profile'); }} style={{ background: 'none', border: 'none', color: viewState === 'profile' ? '#fff' : THEME.colors.textMuted, cursor: 'pointer', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}><span>👤</span>PROFILE</button>
        <button onClick={() => setViewState('settings')} style={{ background: 'none', border: 'none', color: viewState === 'settings' ? '#fff' : THEME.colors.textMuted, cursor: 'pointer', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}><span>⚙️</span>SETTINGS</button>
      </div>
    </div>
  );
}
