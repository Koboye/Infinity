// DaguFixed.jsx - FINAL VERSION WITH FRIENDS VISIBILITY
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';

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
  { id: 'rose', name: '🌹 Rose', coins: 50, animation: '🌹' },
  { id: 'chocolate', name: '🍫 Chocolate', coins: 100, animation: '🍫' },
  { id: 'bear', name: '🧸 Teddy Bear', coins: 250, animation: '🧸' },
  { id: 'cake', name: '🎂 Cake', coins: 500, animation: '🎂' },
  { id: 'diamond', name: '💎 Diamond', coins: 1000, animation: '💎' },
  { id: 'rocket', name: '🚀 Rocket', coins: 5000, animation: '🚀' },
  { id: 'crown', name: '👑 Crown', coins: 10000, animation: '👑' },
  { id: 'galaxy', name: '🌌 Galaxy', coins: 50000, animation: '🌌' },
];

const SOUND_LIBRARY = [
  { id: 's1', name: 'Sunset Dreams', artist: 'Lofi Beats', duration: '3:24', popular: true, usage: 1250000 },
  { id: 's2', name: 'Creative Flow', artist: 'Chill Mix', duration: '2:56', popular: true, usage: 890000 },
  { id: 's3', name: 'Urban Vibes', artist: 'City Music', duration: '3:45', popular: true, usage: 567000 },
  { id: 's4', name: 'Midnight City', artist: 'Electronic', duration: '4:12', popular: false, usage: 234000 },
  { id: 's5', name: 'Summer Love', artist: 'Pop Hits', duration: '3:02', popular: true, usage: 3456000 },
];

const CATEGORIES = [
  { id: 'foryou', label: 'For You', icon: '🔥', color: '#ff2d55' },
  { id: 'following', label: 'Following', icon: '👥', color: '#06d6a0' },
  { id: 'live', label: 'Live', icon: '🔴', color: '#ff2d55' },
  { id: 'trending', label: 'Trending', icon: '📈', color: '#ffd60a' },
];

const EMOJI_LIST = ['😀','😂','😍','🥰','😎','🤔','😭','😱','🔥','❤️','👍','🎉','✨','💯','🙌','👏','🤝','💪','🎵','📸'];

const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num?.toString() || '0';
};

// ============================================
// TOAST
// ============================================
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 2500); return () => clearTimeout(t); }, [onClose]);
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  return (
    <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(20,20,20,0.97)', border: '1px solid #2a2a2a', borderRadius: 30, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8, zIndex: 9999, whiteSpace: 'nowrap', backdropFilter: 'blur(10px)' }}>
      <span>{icons[type] || 'ℹ️'}</span>
      <span style={{ color: 'white', fontSize: 13 }}>{message}</span>
    </div>
  );
};

// ============================================
// USER PROFILE MODAL
// ============================================
const UserProfileModal = ({ user, currentUser, onClose, onFollow, onMessage, onVoiceCall, onVideoCall, followed, showToast }) => {
  const isFollowing = followed?.includes(user?.id);
  const isOwn = user?.id === currentUser?.id;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#0f0f0f', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button onClick={onClose} style={{ background: '#222', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 90, height: 90, borderRadius: '50%', background: user?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 36, margin: '0 auto 12px', border: '3px solid #ff2d55' }}>{user?.avatar}</div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 20 }}>@{user?.username}</div>
          {user?.verified && <div style={{ color: '#1d9bf0', fontSize: 13, marginTop: 2 }}>✓ Verified</div>}
          <div style={{ color: '#888', fontSize: 13, marginTop: 6 }}>{user?.bio}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 20 }}>
          <div style={{ textAlign: 'center' }}><div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>{user?.followers?.length || 0}</div><div style={{ color: '#666', fontSize: 11 }}>Followers</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>{user?.following?.length || 0}</div><div style={{ color: '#666', fontSize: 11 }}>Following</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ color: '#ffd700', fontWeight: 700, fontSize: 18 }}>{user?.level || 1}</div><div style={{ color: '#666', fontSize: 11 }}>Level</div></div>
        </div>
        {!isOwn && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button onClick={() => { onFollow?.(user.id); }} style={{ flex: 1, background: isFollowing ? '#222' : '#ff2d55', border: isFollowing ? '1px solid #333' : 'none', borderRadius: 24, padding: '12px', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              {isFollowing ? '✓ Following' : '+ Follow'}
            </button>
            <button onClick={() => { onMessage?.(user.id); onClose(); }} style={{ flex: 1, background: '#222', border: '1px solid #333', borderRadius: 24, padding: '12px', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>💬 Message</button>
          </div>
        )}
        {!isOwn && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { onVoiceCall?.(user.id); onClose(); }} style={{ flex: 1, background: '#1a2a1a', border: '1px solid #2a3a2a', borderRadius: 20, padding: '10px', color: '#06d6a0', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>🎙️ Voice Call</button>
            <button onClick={() => { onVideoCall?.(user.id); onClose(); }} style={{ flex: 1, background: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 20, padding: '10px', color: '#af52de', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>📹 Video Call</button>
          </div>
        )}
        {user?.subscription && user.subscription !== 'free' && (
          <div style={{ marginTop: 16, background: user.subscription === 'pro' ? 'rgba(255,215,0,0.1)' : 'rgba(175,82,222,0.1)', border: `1px solid ${user.subscription === 'pro' ? '#ffd700' : '#af52de'}`, borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
            <span style={{ color: user.subscription === 'pro' ? '#ffd700' : '#af52de', fontWeight: 600, fontSize: 13 }}>{user.subscription === 'pro' ? '⭐ PRO Member' : '💎 PLUS Member'}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// LIVE STREAM
// ============================================
const LiveStream = ({ streamer, onClose, showToast, currentUser }) => {
  const [viewers, setViewers] = useState(1234);
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [giftAnimations, setGiftAnimations] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const durationInterval = useRef(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
        }
        setCameraActive(true);
      } catch (err) {
        setCameraError('Camera access denied. Using simulated stream.');
        showToast?.('Camera access denied', 'error');
      }
    };
    startCamera();
    durationInterval.current = setInterval(() => setDuration(d => d + 1), 1000);
    const viewerInterval = setInterval(() => setViewers(prev => Math.max(1, prev + Math.floor(Math.random() * 10) - 3)), 5000);
    return () => {
      clearInterval(durationInterval.current);
      clearInterval(viewerInterval);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => { t.enabled = isMuted; });
    }
    setIsMuted(!isMuted);
  };

  const formatDuration = () => {
    const hrs = Math.floor(duration / 3600);
    const mins = Math.floor((duration % 3600) / 60);
    const secs = duration % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    return `${mins}:${secs.toString().padStart(2,'0')}`;
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    setChatMessages(prev => [...prev, { id: Date.now(), username: currentUser?.username, text: message, timestamp: new Date(), isGift: false }]);
    setMessage('');
  };

  const sendGift = (gift) => {
    setGiftAnimations(prev => [...prev, { id: Date.now(), gift, x: Math.random() * 80 + 10, y: Math.random() * 40 + 20 }]);
    setChatMessages(prev => [...prev, { id: Date.now(), username: currentUser?.username, text: `sent ${gift.name}`, timestamp: new Date(), isGift: true, gift }]);
    showToast?.(`Sent ${gift.name}! 🎁`, 'success');
    setTimeout(() => setGiftAnimations(prev => prev.slice(1)), 3000);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 2, position: 'relative', background: '#111' }}>
        {cameraActive ? (
          <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#1a1a1a,#0a0a0a)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 64 }}>📹</div>
            <div style={{ color: 'white', fontSize: 15 }}>LIVE STREAM</div>
            {cameraError && <div style={{ color: '#ff9500', fontSize: 11, textAlign: 'center', padding: '0 20px' }}>{cameraError}</div>}
          </div>
        )}
        <div style={{ position: 'absolute', top: 20, left: 20, background: '#ff2d55', borderRadius: 20, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, zIndex: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', animation: 'pulse 1s infinite' }} />
          <span style={{ color: 'white', fontWeight: 700, fontSize: 12 }}>LIVE</span>
          <span style={{ color: 'white', fontSize: 12 }}>{viewers.toLocaleString()} watching</span>
        </div>
        <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '6px 12px', zIndex: 10 }}>
          <span style={{ color: 'white', fontSize: 12 }}>{formatDuration()}</span>
        </div>
        <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, display: 'flex', gap: 10, zIndex: 10 }}>
          <button onClick={toggleMute} style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 42, height: 42, fontSize: 20, cursor: 'pointer' }}>{isMuted ? '🔇' : '🔊'}</button>
          <button onClick={onClose} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 20px', color: 'white', fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>End Stream</button>
        </div>
        {giftAnimations.map(g => (
          <div key={g.id} style={{ position: 'absolute', left: `${g.x}%`, top: `${g.y}%`, fontSize: 40, animation: 'floatUp 1.5s ease-out forwards', pointerEvents: 'none', zIndex: 20 }}>{g.gift.animation}</div>
        ))}
      </div>
      <div style={{ flex: 1, background: '#0a0a0a', display: 'flex', flexDirection: 'column', borderTop: '1px solid #222' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'white', fontWeight: 700 }}>Live Chat ({chatMessages.length})</span>
          <button onClick={() => setShowGiftPicker(!showGiftPicker)} style={{ background: '#ffd700', border: 'none', borderRadius: 20, padding: '6px 12px', color: '#000', fontWeight: 600, cursor: 'pointer' }}>🎁 Gift</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {chatMessages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', gap: 6, alignItems: 'center', background: msg.isGift ? 'rgba(255,215,0,0.1)' : 'transparent', padding: '4px 8px', borderRadius: 8, marginBottom: 4 }}>
              <span style={{ color: '#ff2d55', fontWeight: 600, fontSize: 11 }}>@{msg.username}</span>
              <span style={{ color: 'white', fontSize: 11 }}>{msg.text}</span>
              {msg.isGift && <span style={{ fontSize: 18 }}>{msg.gift?.animation}</span>}
            </div>
          ))}
        </div>
        <div style={{ padding: 10, borderTop: '1px solid #222', display: 'flex', gap: 8 }}>
          <input value={message} onChange={e => setMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} placeholder="Say something..." style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 24, padding: '9px 14px', color: 'white', outline: 'none', fontSize: 13 }} />
          <button onClick={sendMessage} style={{ background: '#ff2d55', border: 'none', borderRadius: 24, padding: '8px 18px', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Send</button>
        </div>
      </div>
      {showGiftPicker && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, zIndex: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ color: 'white', fontSize: 16 }}>Send a Gift 🎁</h3>
            <button onClick={() => setShowGiftPicker(false)} style={{ background: '#333', border: 'none', borderRadius: '50%', width: 30, height: 30, color: 'white', cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, maxHeight: 260, overflowY: 'auto' }}>
            {VIRTUAL_GIFTS.map(gift => (
              <button key={gift.id} onClick={() => { sendGift(gift); setShowGiftPicker(false); }} style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 12, padding: 10, textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ fontSize: 28 }}>{gift.animation}</div>
                <div style={{ color: 'white', fontSize: 10, marginTop: 4 }}>{gift.name}</div>
                <div style={{ color: '#ffd700', fontSize: 10 }}>{gift.coins}🪙</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// CREATE STORY MODAL
// ============================================
const CreateStoryModal = ({ onClose, onPost, currentUser, showToast }) => {
  const [storyType, setStoryType] = useState('text');
  const [storyText, setStoryText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setShowCamera(true);
    } catch (err) {
      showToast?.('Camera access denied', 'error');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
      canvas.toBlob(blob => {
        const file = new File([blob], 'story-photo.jpg', { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        setCapturedImage(url);
        setSelectedMedia({ file, url, type: 'image/jpeg' });
        stopCamera();
      }, 'image/jpeg');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setSelectedMedia({ file, url, type: file.type });
    }
  };

  const handlePost = () => {
    if (storyType === 'text' && !storyText.trim()) {
      showToast?.('Please enter some text', 'error');
      return;
    }
    if ((storyType === 'photo' || storyType === 'video') && !selectedMedia) {
      showToast?.('Please select media first', 'error');
      return;
    }

    const newStory = {
      id: Date.now(),
      userId: currentUser.id,
      username: currentUser.username,
      avatar: currentUser.avatar,
      avatarColor: currentUser.avatarColor,
      type: storyType,
      text: storyText,
      media: selectedMedia?.url,
      timestamp: new Date(),
      viewed: false
    };

    onPost(newStory);
    if (selectedMedia?.url) URL.revokeObjectURL(selectedMedia.url);
    onClose();
    showToast?.('Story posted! 📸', 'success');
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer' }}>✕</button>
        <h3 style={{ color: 'white', fontSize: 16 }}>Create Story</h3>
        <button onClick={handlePost} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 16px', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Post</button>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid #222' }}>
        <button onClick={() => { setStoryType('text'); setShowCamera(false); }} style={{ flex: 1, background: storyType === 'text' ? '#ff2d55' : '#1a1a1a', border: 'none', borderRadius: 12, padding: '10px', color: 'white', cursor: 'pointer' }}>📝 Text</button>
        <button onClick={() => { setStoryType('photo'); setShowCamera(true); }} style={{ flex: 1, background: storyType === 'photo' ? '#ff2d55' : '#1a1a1a', border: 'none', borderRadius: 12, padding: '10px', color: 'white', cursor: 'pointer' }}>📸 Photo</button>
        <button onClick={() => { setStoryType('video'); setShowCamera(false); }} style={{ flex: 1, background: storyType === 'video' ? '#ff2d55' : '#1a1a1a', border: 'none', borderRadius: 12, padding: '10px', color: 'white', cursor: 'pointer' }}>🎥 Video</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {storyType === 'text' && (
          <textarea
            value={storyText}
            onChange={e => setStoryText(e.target.value)}
            placeholder="What's on your mind?"
            style={{ width: '100%', height: 200, background: '#141414', border: '1px solid #222', borderRadius: 16, padding: 16, color: 'white', fontSize: 16, outline: 'none', resize: 'none' }}
            autoFocus
          />
        )}

        {(storyType === 'photo' || storyType === 'video') && (
          <div>
            {showCamera && !capturedImage && storyType === 'photo' ? (
              <div style={{ position: 'relative' }}>
                <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 16 }} />
                <button onClick={capturePhoto} style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: '#ff2d55', border: 'none', borderRadius: '50%', width: 60, height: 60, fontSize: 28, cursor: 'pointer' }}>📸</button>
                <button onClick={stopCamera} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <div>
                {selectedMedia && (
                  <div style={{ position: 'relative' }}>
                    {selectedMedia.type.startsWith('image/') ? (
                      <img src={selectedMedia.url} alt="preview" style={{ width: '100%', borderRadius: 16 }} />
                    ) : (
                      <video src={selectedMedia.url} controls style={{ width: '100%', borderRadius: 16 }} />
                    )}
                    <button onClick={() => setSelectedMedia(null)} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer' }}>✕</button>
                  </div>
                )}
                <label style={{ display: 'block', textAlign: 'center', padding: 40, background: '#141414', borderRadius: 16, marginTop: 16, cursor: 'pointer' }}>
                  <div style={{ fontSize: 44 }}>📁</div>
                  <div style={{ color: '#888', marginTop: 8 }}>Choose from gallery</div>
                  <input type="file" accept={storyType === 'photo' ? 'image/*' : 'video/*'} onChange={handleFileSelect} style={{ display: 'none' }} />
                </label>
                {storyType === 'photo' && !capturedImage && !selectedMedia && (
                  <button onClick={startCamera} style={{ width: '100%', marginTop: 12, background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: 12, color: 'white', cursor: 'pointer' }}>
                    📸 Take a photo
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Stories = ({ users, stories, currentUser, onViewStory, onAddStory, showToast }) => {
  const [showCreateStory, setShowCreateStory] = useState(false);
  
  // Get unique users who have stories
  const storyUserIds = [...new Set(stories.map(s => s.userId))];
  const usersWithStories = storyUserIds.map(uid => users.find(u => u.id === uid)).filter(Boolean);

  return (
    <>
      <div style={{ padding: '10px 14px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-block', marginRight: 14, textAlign: 'center', cursor: 'pointer' }} onClick={() => setShowCreateStory(true)}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', padding: 2 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>➕</div>
          </div>
          <div style={{ color: '#888', fontSize: 10, marginTop: 3 }}>Your Story</div>
        </div>
        {usersWithStories.map(user => (
          <div key={user.id} style={{ display: 'inline-block', marginRight: 14, textAlign: 'center', cursor: 'pointer' }} onClick={() => onViewStory(user)}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', padding: 2 }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: user.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'white' }}>{user.avatar}</div>
            </div>
            <div style={{ color: 'white', fontSize: 10, marginTop: 3 }}>@{user.username}</div>
          </div>
        ))}
      </div>
      {showCreateStory && (
        <CreateStoryModal 
          onClose={() => setShowCreateStory(false)} 
          onPost={onAddStory} 
          currentUser={currentUser} 
          showToast={showToast}
        />
      )}
    </>
  );
};

// ============================================
// STORY VIEWER
// ============================================
const StoryViewer = ({ stories, user, currentUser, onClose, onNextUser, onPrevUser }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const userStories = stories.filter(s => s.userId === user?.id).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
  const currentStory = userStories[currentIndex];

  useEffect(() => {
    setProgress(0);
    setCurrentIndex(0);
  }, [user?.id]);

  useEffect(() => {
    if (!currentStory) return;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (currentIndex + 1 < userStories.length) {
            setCurrentIndex(i => i + 1);
            return 0;
          } else {
            onNextUser?.();
            return 0;
          }
        }
        return p + 2;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [currentStory, currentIndex, userStories.length]);

  if (!currentStory) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1500 }} onClick={onClose}>
      <div style={{ position: 'absolute', top: 20, left: 0, right: 0, padding: '0 16px', zIndex: 10 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {userStories.map((_, idx) => (
            <div key={idx} style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? '100%' : '0%', height: '100%', background: '#ff2d55', transition: 'width 0.05s linear' }} />
            </div>
          ))}
        </div>
      </div>
      
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 400, minHeight: 500, background: `linear-gradient(135deg,${user?.avatarColor || '#333'},#000)`, borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          {currentStory.type === 'text' && (
            <div style={{ fontSize: 28, fontWeight: 700, color: 'white', textAlign: 'center' }}>{currentStory.text}</div>
          )}
          {currentStory.type === 'photo' && currentStory.media && (
            <img src={currentStory.media} alt="story" style={{ width: '100%', borderRadius: 16, maxHeight: '70vh', objectFit: 'contain' }} />
          )}
          {currentStory.type === 'video' && currentStory.media && (
            <video src={currentStory.media} autoPlay style={{ width: '100%', borderRadius: 16, maxHeight: '70vh' }} />
          )}
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: user?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 18, margin: '0 auto 8px' }}>{user?.avatar}</div>
            <div style={{ color: 'white', fontWeight: 600 }}>@{user?.username}</div>
            <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>{new Date(currentStory.timestamp).toLocaleTimeString()}</div>
          </div>
        </div>
      </div>

      <button onClick={(e) => { e.stopPropagation(); onPrevUser(); }} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: 'white', cursor: 'pointer', fontSize: 20, zIndex: 10 }}>←</button>
      <button onClick={(e) => { e.stopPropagation(); onNextUser(); }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: 'white', cursor: 'pointer', fontSize: 20, zIndex: 10 }}>→</button>
      <button onClick={onClose} style={{ position: 'absolute', top: 40, right: 20, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 38, height: 38, color: 'white', cursor: 'pointer', fontSize: 18, zIndex: 10 }}>✕</button>
    </div>
  );
};

// ============================================
// COMMENT INPUT WITH MEDIA
// ============================================
const CommentInputWithMedia = ({ onAddComment, commentText, setCommentText, showToast }) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setVoiceBlob(blob);
        stream.getTracks().forEach(t => t.stop());
        showToast?.('Voice recorded!', 'success');
      };
      recorder.start();
      recorderRef.current = recorder;
      setIsRecordingVoice(true);
    } catch { showToast?.('Microphone access denied', 'error'); }
  };

  const stopVoiceRecording = () => {
    recorderRef.current?.stop();
    setIsRecordingVoice(false);
  };

  const handleFileAttach = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAttachedFile({ name: file.name, type: file.type, url: URL.createObjectURL(file) });
      showToast?.(`File attached: ${file.name}`, 'success');
    }
  };

  const handleSend = () => {
    if (!commentText.trim() && !voiceBlob && !attachedFile) return;
    onAddComment(commentText, voiceBlob, attachedFile);
    setCommentText('');
    setVoiceBlob(null);
    setAttachedFile(null);
  };

  return (
    <div style={{ padding: '10px 12px', borderTop: '1px solid #1e1e1e' }}>
      {showEmojiPicker && (
        <div style={{ background: '#161616', borderRadius: 14, padding: 10, marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {EMOJI_LIST.map(e => <button key={e} onClick={() => { setCommentText(p => p + e); setShowEmojiPicker(false); }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: 2 }}>{e}</button>)}
        </div>
      )}
      {(voiceBlob || attachedFile) && (
        <div style={{ background: '#161616', borderRadius: 10, padding: 8, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          {voiceBlob && <><span>🎙️</span><audio src={URL.createObjectURL(voiceBlob)} controls style={{ flex: 1, height: 28 }} /></>}
          {attachedFile && <><span>{attachedFile.type.startsWith('image/') ? '🖼️' : '📎'}</span><span style={{ color: '#ccc', fontSize: 11, flex: 1 }}>{attachedFile.name}</span></>}
          <button onClick={() => { setVoiceBlob(null); setAttachedFile(null); }} style={{ background: '#333', border: 'none', borderRadius: '50%', width: 22, height: 22, color: 'white', cursor: 'pointer', fontSize: 12 }}>✕</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={() => setShowEmojiPicker(p => !p)} style={{ background: '#1a1a1a', border: 'none', borderRadius: '50%', width: 34, height: 34, fontSize: 16, cursor: 'pointer' }}>😊</button>
        <button onMouseDown={startVoiceRecording} onMouseUp={stopVoiceRecording} onTouchStart={startVoiceRecording} onTouchEnd={stopVoiceRecording}
          style={{ background: isRecordingVoice ? '#ff2d55' : '#1a1a1a', border: 'none', borderRadius: '50%', width: 34, height: 34, fontSize: 16, cursor: 'pointer' }} title="Hold to record voice">🎙️</button>
        <button onClick={() => fileInputRef.current?.click()} style={{ background: '#1a1a1a', border: 'none', borderRadius: '50%', width: 34, height: 34, fontSize: 16, cursor: 'pointer' }} title="Attach file">📎</button>
        <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" onChange={handleFileAttach} style={{ display: 'none' }} />
        <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Add a comment..." style={{ flex: 1, background: '#161616', border: '1px solid #222', borderRadius: 20, padding: '8px 12px', color: 'white', outline: 'none', fontSize: 13 }} />
        <button onClick={handleSend} disabled={!commentText.trim() && !voiceBlob && !attachedFile} style={{ background: (commentText.trim() || voiceBlob || attachedFile) ? '#ff2d55' : '#222', border: 'none', borderRadius: '50%', width: 34, height: 34, color: 'white', cursor: 'pointer', fontSize: 16 }}>↑</button>
      </div>
    </div>
  );
};

// ============================================
// COMMENT ITEM
// ============================================
const CommentItem = ({ comment, currentUser, onLike, onReply, onPin, showReplyTo, replyText, setReplyText, addReply }) => {
  const [showReplies, setShowReplies] = useState(false);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: comment.avatarColor || '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', flexShrink: 0, fontSize: 13 }}>{comment.avatar || '?'}</div>
        <div style={{ flex: 1 }}>
          <div style={{ background: '#161616', borderRadius: 14, padding: '8px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: '#ff2d55', fontWeight: 600, fontSize: 11 }}>@{comment.username}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onPin(comment.id)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 11 }}>📌</button>
                <button onClick={() => onLike(comment.id)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 11 }}>❤️ {comment.likes || 0}</button>
              </div>
            </div>
            <p style={{ color: '#ddd', fontSize: 13, marginTop: 4 }}>{comment.text}</p>
            {comment.voiceBlob && <audio src={URL.createObjectURL(comment.voiceBlob)} controls style={{ width: '100%', height: 28, marginTop: 4 }} />}
            {comment.attachedFile && (
              <div style={{ marginTop: 6 }}>
                {comment.attachedFile.type?.startsWith('image/') ? <img src={comment.attachedFile.url} alt="" style={{ maxWidth: '100%', borderRadius: 8, maxHeight: 100 }} /> : <span style={{ color: '#888', fontSize: 11 }}>📎 {comment.attachedFile.name}</span>}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button onClick={() => onReply(comment)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 11 }}>Reply</button>
            </div>
          </div>
          {comment.replies?.length > 0 && (
            <button onClick={() => setShowReplies(!showReplies)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, marginTop: 4, marginLeft: 40, cursor: 'pointer' }}>
              {showReplies ? 'Hide' : 'View'} {comment.replies.length} replies
            </button>
          )}
          {showReplies && comment.replies?.map(reply => (
            <div key={reply.id} style={{ display: 'flex', gap: 8, marginTop: 6, marginLeft: 40 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, flexShrink: 0 }}>R</div>
              <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '6px 10px', flex: 1 }}>
                <div style={{ color: '#00C7BE', fontWeight: 600, fontSize: 10 }}>@{reply.username}</div>
                <p style={{ color: '#bbb', fontSize: 12, marginTop: 2 }}>{reply.text}</p>
              </div>
            </div>
          ))}
          {showReplyTo?.id === comment.id && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6, marginLeft: 40 }}>
              <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply..." style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 18, padding: '6px 12px', color: 'white', fontSize: 12, outline: 'none' }} />
              <button onClick={() => addReply(comment.id)} style={{ background: '#ff2d55', border: 'none', borderRadius: 18, padding: '6px 14px', color: 'white', cursor: 'pointer', fontSize: 11 }}>Reply</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// ENHANCED VIDEO CARD
// ============================================
const EnhancedVideoCard = memo(({ video, currentUser, onLike, onComment, onShare, onFollow, onMessage, onVoiceCall, onVideoCall, onDuet, onStitch, onSaveSound, followed, showToast, onViewProfile }) => {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showReplyTo, setShowReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [pinnedComment, setPinnedComment] = useState(null);
  const [hearts, setHearts] = useState([]);
  const videoRef = useRef(null);
  const lastTap = useRef(0);

  const handleDoubleTap = (e) => {
    const now = Date.now();
    if (now - lastTap.current < 300 && !liked) {
      setLiked(true);
      setLikeCount(p => p + 1);
      onLike?.(video.id);
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          const id = Date.now() + i;
          setHearts(prev => [...prev, { id, x, y }]);
          setTimeout(() => setHearts(prev => prev.filter(h => h.id !== id)), 1000);
        }, i * 40);
      }
    }
    lastTap.current = now;
  };

  const addComment = (text, voiceBlob, attachedFile) => {
    if (!text.trim() && !voiceBlob && !attachedFile) return;
    const newComment = { id: Date.now(), username: currentUser?.username, avatar: currentUser?.avatar, avatarColor: currentUser?.avatarColor, text, voiceBlob, attachedFile, likes: 0, replies: [], timestamp: new Date() };
    setComments(prev => [newComment, ...prev]);
    onComment?.(video.id, text);
    showToast?.('Comment added!', 'success');
  };

  const addReply = (commentId) => {
    if (!replyText.trim()) return;
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, replies: [...(c.replies || []), { id: Date.now(), username: currentUser?.username, text: replyText }] } : c));
    setReplyText('');
    setShowReplyTo(null);
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000', overflow: 'hidden' }} onDoubleClick={handleDoubleTap}>
      <video ref={videoRef} src={video.videoUrl} loop playsInline autoPlay muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)', pointerEvents: 'none' }} />
      {hearts.map(h => (<div key={h.id} style={{ position: 'absolute', left: h.x - 25, top: h.y - 25, fontSize: 46, zIndex: 100, pointerEvents: 'none', animation: 'heartBurst 1s ease-out forwards' }}>❤️</div>))}

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 68, padding: '18px 14px', zIndex: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div onClick={() => onViewProfile?.(video.userId)} style={{ position: 'relative', cursor: 'pointer' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: video.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 16, border: '2px solid rgba(255,255,255,0.4)' }}>{video.avatar}</div>
            {video.verified && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, background: '#1d9bf0', borderRadius: '50%', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>✓</div>}
          </div>
          <span onClick={() => onViewProfile?.(video.userId)} style={{ color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>@{video.username}</span>
          <button onClick={() => onFollow?.(video.userId)} style={{ padding: '5px 14px', borderRadius: 20, background: followed?.includes(video.userId) ? 'transparent' : '#ff2d55', border: followed?.includes(video.userId) ? '1px solid rgba(255,255,255,0.4)' : 'none', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{followed?.includes(video.userId) ? 'Following' : '+ Follow'}</button>
          <button onClick={() => setShowActionMenu(!showActionMenu)} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '4px 10px', color: 'white', cursor: 'pointer', fontSize: 16 }}>•••</button>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, marginBottom: 6 }}>{video.description}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🎵</span>
          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{video.song}</span>
          <button onClick={() => onSaveSound?.(video.songId)} style={{ marginLeft: 'auto', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 12, padding: '4px 8px', color: 'white', fontSize: 10, cursor: 'pointer' }}>Save Sound</button>
        </div>
      </div>

      {showActionMenu && (
        <div onClick={() => setShowActionMenu(false)} style={{ position: 'absolute', inset: 0, zIndex: 19 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 160, left: 14, background: '#181818', border: '1px solid #2a2a2a', borderRadius: 18, padding: 6, zIndex: 20, minWidth: 190 }}>
            {[['🎤','Duet',()=>onDuet?.(video.id)],['🧵','Stitch',()=>onStitch?.(video.id)],['💬','Message',()=>onMessage?.(video.userId)],['🎙️','Voice Call',()=>onVoiceCall?.(video.userId)],['📹','Video Call',()=>onVideoCall?.(video.userId)],['⚠️','Report',()=>showToast?.('Reported','warning')],['🚫','Block',()=>showToast?.('Blocked','warning')]].map(([icon,label,fn])=>(
              <button key={label} onClick={()=>{fn();setShowActionMenu(false);}} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: 'none', border: 'none', color: label==='Block'?'#ff2d55':label==='Report'?'#ff9500':'white', cursor: 'pointer', borderRadius: 12, fontSize: 13 }}><span style={{ fontSize: 16 }}>{icon}</span>{label}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', right: 10, bottom: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, zIndex: 6 }}>
        <button onClick={() => { if (!liked) { setLiked(true); setLikeCount(p => p + 1); onLike?.(video.id); } }} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{liked ? '❤️' : '🤍'}</button>
        <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>{formatNumber(likeCount)}</span>
        <button onClick={() => setShowComments(true)} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 24, cursor: 'pointer' }}>💬</button>
        <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>{formatNumber(video.comments + comments.length)}</span>
        <button onClick={() => { onShare?.(video.id); showToast?.('Share options opened', 'info'); }} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 24, cursor: 'pointer' }}>↗️</button>
        <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>{formatNumber(video.shares)}</span>
        <button onClick={() => onViewProfile?.(video.userId)} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 22, cursor: 'pointer' }}>👤</button>
      </div>

      {showComments && (
        <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'white', fontWeight: 700 }}>💬 Comments ({video.comments + comments.length})</span>
            <button onClick={() => setShowComments(false)} style={{ background: '#1a1a1a', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {pinnedComment && (
              <div style={{ background: 'rgba(255,45,85,0.1)', borderRadius: 12, padding: 8, marginBottom: 14, border: '1px solid #ff2d55' }}>
                <div style={{ color: '#ff2d55', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>📌 Pinned</div>
                <CommentItem comment={pinnedComment} currentUser={currentUser} onLike={id => setComments(p => p.map(c => c.id === id ? {...c,likes:(c.likes||0)+1} : c))} onReply={c => setShowReplyTo(c)} onPin={() => {}} />
              </div>
            )}
            {comments.map(comment => (
              <CommentItem key={comment.id} comment={comment} currentUser={currentUser} onLike={id => setComments(p => p.map(c => c.id === id ? {...c,likes:(c.likes||0)+1}:c))} onReply={c => setShowReplyTo(c)} onPin={id => { const c = comments.find(cc=>cc.id===id); if(c){setPinnedComment(c);showToast?.('Pinned!','success');} }} showReplyTo={showReplyTo} replyText={replyText} setReplyText={setReplyText} addReply={addReply} />
            ))}
          </div>
          <CommentInputWithMedia onAddComment={addComment} commentText={commentText} setCommentText={setCommentText} showToast={showToast} />
        </div>
      )}
    </div>
  );
});

// ============================================
// HOME FEED
// ============================================
const HomeFeed = ({ videos, onLike, onComment, onShare, onFollow, onMessage, onVoiceCall, onVideoCall, onDuet, onStitch, onSaveSound, followed, showToast, onLive, currentUser, onViewProfile }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState('foryou');
  
  const categoryVideos = useMemo(() => {
    if (activeCategory === 'following') {
      // Show videos from users that current user follows
      return videos.filter(v => followed.includes(v.userId));
    }
    // Show all videos
    return videos;
  }, [videos, activeCategory, followed]);
  
  const startY = useRef(null);
  const handleTouchStart = e => { startY.current = e.touches[0].clientY; };
  const handleTouchEnd = e => {
    if (startY.current === null) return;
    const dy = startY.current - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 50) {
      if (dy > 0) setCurrentIndex(i => Math.min(categoryVideos.length - 1, i + 1));
      else setCurrentIndex(i => Math.max(0, i - 1));
    }
    startY.current = null;
  };
  
  if (!categoryVideos.length) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 48 }}>📭</div>
        <div style={{ color: '#555', textAlign: 'center', padding: 20 }}>
          {activeCategory === 'following' ? "You're not following anyone yet!" : "No videos available"}
        </div>
        {activeCategory === 'following' && (
          <button onClick={() => setActiveCategory('foryou')} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '10px 20px', color: 'white', cursor: 'pointer' }}>
            Browse For You
          </button>
        )}
      </div>
    );
  }
  
  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div style={{ position: 'absolute', top: 12, left: 0, right: 0, zIndex: 15, display: 'flex', justifyContent: 'center', gap: 6 }}>
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setCurrentIndex(0); if (cat.id === 'live') onLive?.(); }} style={{ background: activeCategory === cat.id ? cat.color : 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 30, padding: '5px 12px', color: 'white', fontSize: 11, fontWeight: activeCategory === cat.id ? 700 : 500, cursor: 'pointer', backdropFilter: 'blur(10px)' }}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>
      {categoryVideos.map((video, idx) => (
        <div key={video.id} style={{ position: 'absolute', inset: 0, opacity: idx === currentIndex ? 1 : 0, transform: `translateY(${(idx - currentIndex) * 100}%)`, transition: 'transform 0.3s', pointerEvents: idx === currentIndex ? 'auto' : 'none' }}>
          <EnhancedVideoCard video={video} currentUser={currentUser} onLike={onLike} onComment={onComment} onShare={onShare} onFollow={onFollow} onMessage={onMessage} onVoiceCall={onVoiceCall} onVideoCall={onVideoCall} onDuet={onDuet} onStitch={onStitch} onSaveSound={onSaveSound} followed={followed} showToast={showToast} onViewProfile={onViewProfile} />
        </div>
      ))}
      {categoryVideos.length > 1 && (
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5, zIndex: 10 }}>
          {categoryVideos.map((_, i) => <button key={i} onClick={() => setCurrentIndex(i)} style={{ width: i === currentIndex ? 18 : 5, height: 5, borderRadius: 3, background: i === currentIndex ? '#ff2d55' : 'rgba(255,255,255,0.3)', border: 'none', cursor: 'pointer', padding: 0 }} />)}
        </div>
      )}
    </div>
  );
};

// ============================================
// WALLET PAGE
// ============================================
const WalletPage = ({ user, setCurrentUser, showToast, onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [amount, setAmount] = useState('');
  const [transactions, setTransactions] = useState([
    { id: 1, type: 'credit', label: 'Gift received from @sam_creates', amount: 250, date: new Date(Date.now() - 86400000), coins: true },
    { id: 2, type: 'debit', label: 'Sent gift 🌹 Rose', amount: 50, date: new Date(Date.now() - 172800000), coins: true },
    { id: 3, type: 'credit', label: 'Top-up via card', amount: 1000, date: new Date(Date.now() - 259200000), coins: false },
    { id: 4, type: 'debit', label: 'Withdrew to bank', amount: 200, date: new Date(Date.now() - 432000000), coins: false },
  ]);

  const doDeposit = () => {
    const n = parseInt(amount);
    if (!n || n <= 0) { showToast?.('Enter valid amount', 'error'); return; }
    setCurrentUser(u => ({ ...u, coins: (u.coins || 0) + n, walletBalance: (u.walletBalance || 0) + n }));
    setTransactions(prev => [{ id: Date.now(), type: 'credit', label: `Top-up ${n} coins`, amount: n, date: new Date(), coins: true }, ...prev]);
    showToast?.(`Added ${n} coins! 🎉`, 'success');
    setAmount('');
  };

  const doWithdraw = () => {
    const n = parseInt(amount);
    if (!n || n <= 0) { showToast?.('Enter valid amount', 'error'); return; }
    if ((user?.coins || 0) < n) { showToast?.('Insufficient coins', 'error'); return; }
    setCurrentUser(u => ({ ...u, coins: (u.coins || 0) - n, walletBalance: (u.walletBalance || 0) - n }));
    setTransactions(prev => [{ id: Date.now(), type: 'debit', label: `Withdrew ${n} coins`, amount: n, date: new Date(), coins: true }, ...prev]);
    showToast?.(`Withdrew ${n} coins`, 'success');
    setAmount('');
  };

  const convertCoins = () => {
    const n = parseInt(amount);
    if (!n || n <= 0 || (user?.coins || 0) < n) { showToast?.('Insufficient coins', 'error'); return; }
    const eth = (n / 10000).toFixed(4);
    setCurrentUser(u => ({ ...u, coins: (u.coins || 0) - n }));
    setTransactions(prev => [{ id: Date.now(), type: 'debit', label: `Converted to ${eth} ETH`, amount: n, date: new Date(), coins: true }, ...prev]);
    showToast?.(`Converted to ${eth} ETH! ✨`, 'success');
    setAmount('');
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a' }}>
      <div style={{ padding: '16px 16px 0' }}>
        <button onClick={onBack} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '8px 14px', color: 'white', cursor: 'pointer', fontSize: 12, marginBottom: 16 }}>← Back</button>
        <h2 style={{ color: 'white', marginBottom: 16, fontSize: 20, fontWeight: 700 }}>💰 Wallet</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ background: 'linear-gradient(135deg,#ffd700,#ff9500)', borderRadius: 20, padding: 18 }}>
            <div style={{ color: 'rgba(0,0,0,0.6)', fontSize: 11 }}>Coins Balance</div>
            <div style={{ color: '#000', fontSize: 28, fontWeight: 800, marginTop: 4 }}>{(user?.coins || 0).toLocaleString()}</div>
            <div style={{ color: 'rgba(0,0,0,0.5)', fontSize: 10, marginTop: 2 }}>🪙 Dagu Coins</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg,#06d6a0,#00b4d8)', borderRadius: 20, padding: 18 }}>
            <div style={{ color: 'rgba(0,0,0,0.6)', fontSize: 11 }}>Cash Balance</div>
            <div style={{ color: '#000', fontSize: 28, fontWeight: 800, marginTop: 4 }}>${(user?.walletBalance || 0).toLocaleString()}</div>
            <div style={{ color: 'rgba(0,0,0,0.5)', fontSize: 10, marginTop: 2 }}>💵 USD</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#161616', borderRadius: 16, padding: 4 }}>
          {['overview','deposit','withdraw','convert'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, background: activeTab === t ? '#ff2d55' : 'none', border: 'none', borderRadius: 12, padding: '8px 4px', color: 'white', cursor: 'pointer', fontSize: 11, fontWeight: activeTab === t ? 700 : 400, textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div>
            <h3 style={{ color: 'white', marginBottom: 12, fontSize: 14 }}>Recent Transactions</h3>
            {transactions.map(tx => (
              <div key={tx.id} style={{ background: '#141414', borderRadius: 14, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: tx.type === 'credit' ? 'rgba(6,214,160,0.15)' : 'rgba(255,45,85,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{tx.type === 'credit' ? '⬆️' : '⬇️'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontSize: 12 }}>{tx.label}</div>
                  <div style={{ color: '#666', fontSize: 10, marginTop: 2 }}>{tx.date.toLocaleDateString()}</div>
                </div>
                <div style={{ color: tx.type === 'credit' ? '#06d6a0' : '#ff2d55', fontWeight: 700, fontSize: 14 }}>{tx.type === 'credit' ? '+' : '-'}{tx.amount}{tx.coins ? '🪙' : '$'}</div>
              </div>
            ))}
          </div>
        )}

        {(activeTab === 'deposit' || activeTab === 'withdraw' || activeTab === 'convert') && (
          <div>
            <div style={{ background: '#141414', borderRadius: 20, padding: 20 }}>
              <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
                {activeTab === 'deposit' ? 'Add coins to your wallet' : activeTab === 'withdraw' ? 'Withdraw coins' : 'Convert coins to ETH (1 ETH = 10,000 🪙)'}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input type="number" placeholder="Enter amount..." value={amount} onChange={e => setAmount(e.target.value)} style={{ flex: 1, background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: '12px', color: 'white', outline: 'none', fontSize: 15 }} />
                <span style={{ color: '#888', alignSelf: 'center' }}>🪙</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[100,500,1000,5000].map(v => (
                  <button key={v} onClick={() => setAmount(String(v))} style={{ flex: 1, background: amount === String(v) ? '#ff2d55' : '#222', border: 'none', borderRadius: 10, padding: '8px', color: 'white', cursor: 'pointer', fontSize: 12 }}>{v}</button>
                ))}
              </div>
              <button onClick={activeTab === 'deposit' ? doDeposit : activeTab === 'withdraw' ? doWithdraw : convertCoins} style={{ width: '100%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: 24, padding: '14px', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                {activeTab === 'deposit' ? '⬆️ Add Coins' : activeTab === 'withdraw' ? '⬇️ Withdraw' : '🔄 Convert to ETH'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// PROFILE PAGE
// ============================================
const ProfilePage = ({ user, setCurrentUser, onLogout, users, showToast, onShowAnalytics, onShowQRCode }) => {
  const [activeSubPage, setActiveSubPage] = useState(null);

  const menuItems = [
    { icon: '⚙️', label: 'Settings', page: 'settings', color: '#fff' },
    { icon: '💰', label: 'Wallet', page: 'wallet', color: '#ffd60a' },
    { icon: '🔒', label: 'Privacy', page: 'privacy', color: '#fff' },
    { icon: '🔄', label: 'Switch', page: 'switch', color: '#fff' },
    { icon: '🏆', label: 'Badges', page: 'badges', color: '#af52de' },
    { icon: '⭐', label: 'Premium', page: 'premium', color: '#ffd700' },
    { icon: '📊', label: 'Analytics', page: 'analytics', color: '#06d6a0' },
    { icon: '📱', label: 'QR Code', page: 'qrcode', color: '#fff' },
  ];

  if (activeSubPage === 'analytics') { onShowAnalytics?.(); setActiveSubPage(null); return null; }
  if (activeSubPage === 'qrcode') { onShowQRCode?.(); setActiveSubPage(null); return null; }
  if (activeSubPage === 'wallet') return <WalletPage user={user} setCurrentUser={setCurrentUser} showToast={showToast} onBack={() => setActiveSubPage(null)} />;

  if (activeSubPage === 'settings') return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a' }}>
      <div style={{ padding: 16 }}>
        <button onClick={() => setActiveSubPage(null)} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '8px 14px', color: 'white', cursor: 'pointer', fontSize: 12, marginBottom: 16 }}>← Back</button>
        <h2 style={{ color: 'white', marginBottom: 16, fontSize: 20, fontWeight: 700 }}>⚙️ Settings</h2>
        <div style={{ background: '#141414', borderRadius: 16, overflow: 'hidden' }}>
          {[['🔔','Notifications',true],['🌙','Dark Mode',false],['🌐','Language',true]].map(([icon,label,on])=>(
            <div key={label} style={{ padding: '14px 16px', borderBottom: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'white' }}>{icon} {label}</span>
              <div style={{ width: 44, height: 24, background: on ? '#ff2d55' : '#2a2a2a', borderRadius: 12, position: 'relative', cursor: 'pointer' }}>
                <div style={{ width: 18, height: 18, background: 'white', borderRadius: '50%', position: 'absolute', top: 3, left: on ? 23 : 3, transition: 'left 0.2s' }} />
              </div>
            </div>
          ))}
          <div style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={onLogout}><span style={{ color: '#ff2d55' }}>🚪 Log Out</span></div>
        </div>
      </div>
    </div>
  );

  if (activeSubPage === 'badges') return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a', padding: 16 }}>
      <button onClick={() => setActiveSubPage(null)} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '8px 14px', color: 'white', cursor: 'pointer', fontSize: 12, marginBottom: 16 }}>← Back</button>
      <h2 style={{ color: 'white', marginBottom: 16, fontSize: 20, fontWeight: 700 }}>🏆 Badges</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[['🌟','First Post','Earned'],['🔥','7 Day Streak','Earned'],['💎','Top Creator','Earned'],['👑','100K Fans','Locked'],['🚀','Viral','Locked'],['🎯','Pro User','Locked']].map(([icon,name,status])=>(
          <div key={name} style={{ background: '#141414', borderRadius: 16, padding: 16, textAlign: 'center', opacity: status==='Locked'?0.4:1 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
            <div style={{ color: 'white', fontSize: 12, fontWeight: 600 }}>{name}</div>
            <div style={{ color: status==='Earned'?'#06d6a0':'#555', fontSize: 10, marginTop: 4 }}>{status}</div>
          </div>
        ))}
      </div>
    </div>
  );

  if (activeSubPage === 'premium') return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a', padding: 16 }}>
      <button onClick={() => setActiveSubPage(null)} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '8px 14px', color: 'white', cursor: 'pointer', fontSize: 12, marginBottom: 16 }}>← Back</button>
      <h2 style={{ color: 'white', marginBottom: 16, fontSize: 20, fontWeight: 700 }}>⭐ Premium</h2>
      {[{name:'Plus',price:'$4.99/mo',color:'#af52de',features:['Ad-free','500 coins/mo','Custom badges']},{name:'Pro',price:'$9.99/mo',color:'#ffd700',features:['All Plus features','2000 coins/mo','Priority support','Analytics']}].map(plan=>(
        <div key={plan.name} style={{ background: '#141414', border: `1px solid ${plan.color}`, borderRadius: 20, padding: 20, marginBottom: 12 }}>
          <div style={{ color: plan.color, fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{plan.name}</div>
          <div style={{ color: 'white', fontSize: 22, fontWeight: 800, marginBottom: 12 }}>{plan.price}</div>
          {plan.features.map(f=><div key={f} style={{ color: '#bbb', fontSize: 13, marginBottom: 6 }}>✓ {f}</div>)}
          <button onClick={()=>showToast?.(`${plan.name} plan activated!`,'success')} style={{ width: '100%', background: plan.color, border: 'none', borderRadius: 20, padding: 12, color: plan.name==='Pro'?'#000':'white', fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>Subscribe to {plan.name}</button>
        </div>
      ))}
    </div>
  );

  if (activeSubPage === 'privacy') return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a', padding: 16 }}>
      <button onClick={() => setActiveSubPage(null)} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '8px 14px', color: 'white', cursor: 'pointer', fontSize: 12, marginBottom: 16 }}>← Back</button>
      <h2 style={{ color: 'white', marginBottom: 16, fontSize: 20, fontWeight: 700 }}>🔒 Privacy</h2>
      <div style={{ background: '#141414', borderRadius: 16, overflow: 'hidden' }}>
        {['Private Account','Show Activity','Allow Messages from Everyone','Allow Comments'].map(label=>(
          <div key={label} style={{ padding: '14px 16px', borderBottom: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'white', fontSize: 13 }}>{label}</span>
            <div style={{ width: 44, height: 24, background: '#ff2d55', borderRadius: 12, position: 'relative', cursor: 'pointer' }}>
              <div style={{ width: 18, height: 18, background: 'white', borderRadius: '50%', position: 'absolute', top: 3, left: 23 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (activeSubPage === 'switch') return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a', padding: 16 }}>
      <button onClick={() => setActiveSubPage(null)} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '8px 14px', color: 'white', cursor: 'pointer', fontSize: 12, marginBottom: 16 }}>← Back</button>
      <h2 style={{ color: 'white', marginBottom: 16, fontSize: 20, fontWeight: 700 }}>🔄 Switch Account</h2>
      {users.map(u=>(
        <div key={u.id} style={{ background: '#141414', borderRadius: 14, padding: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', border: u.id===user?.id?'1px solid #ff2d55':'1px solid transparent' }} onClick={()=>{setCurrentUser(u);showToast?.(`Switched to @${u.username}`,'success');setActiveSubPage(null);}}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 18 }}>{u.avatar}</div>
          <div style={{ flex: 1 }}><div style={{ color: 'white', fontWeight: 600 }}>@{u.username}</div><div style={{ color: '#555', fontSize: 11 }}>{u.subscription} plan</div></div>
          {u.id===user?.id&&<span style={{ color: '#ff2d55', fontSize: 11, fontWeight: 600 }}>Active</span>}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a' }}>
      <div style={{ padding: 20, textAlign: 'center', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: user?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 32, margin: '0 auto 12px', border: '3px solid #ff2d55' }}>{user?.avatar}</div>
        <div style={{ color: 'white', fontWeight: 700, fontSize: 20 }}>@{user?.username}</div>
        <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>{user?.bio}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginTop: 16 }}>
          <div style={{ textAlign: 'center' }}><div style={{ color: 'white', fontWeight: 700 }}>{user?.followers?.length || 0}</div><div style={{ color: '#666', fontSize: 11 }}>Followers</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ color: 'white', fontWeight: 700 }}>{user?.following?.length || 0}</div><div style={{ color: '#666', fontSize: 11 }}>Following</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ color: '#ffd700', fontWeight: 700 }}>{user?.coins || 0}</div><div style={{ color: '#666', fontSize: 11 }}>Coins 🪙</div></div>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {menuItems.map(item => (
            <button key={item.page} onClick={() => setActiveSubPage(item.page)} style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 16, padding: '14px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ color: item.color, fontSize: 10, fontWeight: 600 }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================
// INBOX PAGE
// ============================================
const InboxPage = ({ users, currentUser, showToast }) => {
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversations, setConversations] = useState(() =>
    users.filter(u => u.id !== currentUser?.id).map(u => ({ userId: u.id, messages: [], lastSeen: new Date(Date.now() - Math.random() * 86400000) }))
  );

  const openConvo = (userId) => {
    setActiveConversation(userId);
  };

  const sendMessage = (userId, text, voiceBlob, attachedFile) => {
    setConversations(prev => prev.map(c => c.userId === userId ? {
      ...c,
      messages: [...c.messages, { id: Date.now(), from: currentUser.id, text, voiceBlob, attachedFile, timestamp: new Date() }]
    } : c));
    if (text) showToast?.('Message sent!', 'success');
  };

  if (activeConversation) {
    const convo = conversations.find(c => c.userId === activeConversation);
    const otherUser = users.find(u => u.id === activeConversation);
    return <ConversationView currentUser={currentUser} otherUser={otherUser} messages={convo?.messages || []} onSend={(text, vb, af) => sendMessage(activeConversation, text, vb, af)} onBack={() => setActiveConversation(null)} showToast={showToast} />;
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      <div style={{ padding: '16px 16px', borderBottom: '1px solid #1a1a1a' }}>
        <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>💬 Messages</h2>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {users.filter(u => u.id !== currentUser?.id).map(u => {
          const convo = conversations.find(c => c.userId === u.id);
          const lastMsg = convo?.messages?.[convo.messages.length - 1];
          return (
            <div key={u.id} onClick={() => openConvo(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid #111', cursor: 'pointer' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 20 }}>{u.avatar}</div>
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, background: '#06d6a0', borderRadius: '50%', border: '2px solid #0a0a0a' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>@{u.username}</div>
                <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>{lastMsg ? lastMsg.text || (lastMsg.voiceBlob ? '🎙️ Voice message' : '📎 File') : 'Tap to start chatting'}</div>
              </div>
              <div style={{ color: '#444', fontSize: 10 }}>{convo?.lastSeen?.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ConversationView = ({ currentUser, otherUser, messages, onSend, onBack, showToast }) => {
  const [text, setText] = useState('');
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => chunksRef.current.push(e.data);
      recorder.onstop = () => { setVoiceBlob(new Blob(chunksRef.current, { type: 'audio/webm' })); stream.getTracks().forEach(t => t.stop()); };
      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch { showToast?.('Mic denied', 'error'); }
  };

  const stopVoice = () => { recorderRef.current?.stop(); setIsRecording(false); };

  const handleFileSelect = e => {
    const f = e.target.files[0];
    if (f) setAttachedFile({ name: f.name, type: f.type, url: URL.createObjectURL(f) });
  };

  const handleSend = () => {
    if (!text.trim() && !voiceBlob && !attachedFile) return;
    onSend(text, voiceBlob, attachedFile);
    setText('');
    setVoiceBlob(null);
    setAttachedFile(null);
    setShowEmoji(false);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '7px 12px', color: 'white', cursor: 'pointer', fontSize: 13 }}>←</button>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: otherUser?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>{otherUser?.avatar}</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'white', fontWeight: 600 }}>@{otherUser?.username}</div>
          <div style={{ color: '#06d6a0', fontSize: 11 }}>● Online</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && <div style={{ textAlign: 'center', color: '#444', fontSize: 13, marginTop: 40 }}>Say hello to @{otherUser?.username}! 👋</div>}
        {messages.map(msg => {
          const isMe = msg.from === currentUser?.id;
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{ background: isMe ? '#ff2d55' : '#1a1a1a', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', maxWidth: '75%' }}>
                {msg.text && <div style={{ color: 'white', fontSize: 13 }}>{msg.text}</div>}
                {msg.voiceBlob && <audio src={URL.createObjectURL(msg.voiceBlob)} controls style={{ height: 30, maxWidth: 180 }} />}
                {msg.attachedFile && (
                  msg.attachedFile.type?.startsWith('image/') ? <img src={msg.attachedFile.url} alt="" style={{ maxWidth: 180, borderRadius: 8, marginTop: msg.text?6:0 }} /> : <div style={{ color: '#ddd', fontSize: 11, marginTop: 4 }}>📎 {msg.attachedFile.name}</div>
                )}
                <div style={{ color: isMe ? 'rgba(255,255,255,0.5)' : '#444', fontSize: 9, marginTop: 4, textAlign: 'right' }}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      {showEmoji && (
        <div style={{ background: '#161616', padding: 10, display: 'flex', flexWrap: 'wrap', gap: 6, borderTop: '1px solid #222' }}>
          {EMOJI_LIST.map(e => <button key={e} onClick={() => { setText(p => p + e); }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: 2 }}>{e}</button>)}
        </div>
      )}
      {(voiceBlob || attachedFile) && (
        <div style={{ background: '#161616', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #222' }}>
          {voiceBlob && <><span>🎙️</span><audio src={URL.createObjectURL(voiceBlob)} controls style={{ flex: 1, height: 28 }} /></>}
          {attachedFile && <><span>{attachedFile.type?.startsWith('image/')?'🖼️':'📎'}</span><span style={{ color: '#ccc', fontSize: 11, flex: 1 }}>{attachedFile.name}</span></>}
          <button onClick={() => { setVoiceBlob(null); setAttachedFile(null); }} style={{ background: '#333', border: 'none', borderRadius: '50%', width: 22, height: 22, color: 'white', cursor: 'pointer', fontSize: 12 }}>✕</button>
        </div>
      )}
      <div style={{ padding: '10px 12px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={() => setShowEmoji(p => !p)} style={{ background: '#1a1a1a', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 17, cursor: 'pointer' }}>😊</button>
        <button onMouseDown={startVoice} onMouseUp={stopVoice} onTouchStart={startVoice} onTouchEnd={stopVoice} style={{ background: isRecording ? '#ff2d55' : '#1a1a1a', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 17, cursor: 'pointer' }} title="Hold to record">🎙️</button>
        <button onClick={() => fileInputRef.current?.click()} style={{ background: '#1a1a1a', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 17, cursor: 'pointer' }}>📎</button>
        <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" onChange={handleFileSelect} style={{ display: 'none' }} />
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Message..." style={{ flex: 1, background: '#161616', border: '1px solid #222', borderRadius: 22, padding: '9px 14px', color: 'white', outline: 'none', fontSize: 13 }} />
        <button onClick={handleSend} style={{ background: '#ff2d55', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', cursor: 'pointer', fontSize: 17 }}>↑</button>
      </div>
    </div>
  );
};

// ============================================
// CALL MODAL
// ============================================
const CallModal = ({ type, contactName, contactAvatar, onClose }) => {
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState('calling');
  const [isMuted, setIsMuted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setStatus('connected'), 2000); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (status !== 'connected') return;
    const i = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(i);
  }, [status]);
  const fmt = () => { const m = Math.floor(duration / 60), s = duration % 60; return `${m}:${s.toString().padStart(2,'0')}`; };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#0d0d0d,#1a0a1a)', zIndex: 2500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: 60 }}>
        <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#FF2D55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 40, margin: '0 auto 20px' }}>{contactAvatar || '?'}</div>
        <div style={{ color: 'white', fontSize: 24, fontWeight: 700 }}>@{contactName}</div>
        <div style={{ color: '#888', fontSize: 14, marginTop: 8 }}>{status === 'calling' ? (type === 'video' ? '📹 Video calling...' : '🎙️ Calling...') : fmt()}</div>
      </div>
      <div style={{ display: 'flex', gap: 36 }}>
        <button onClick={onClose} style={{ background: '#ff2d55', border: 'none', borderRadius: '50%', width: 64, height: 64, fontSize: 28, cursor: 'pointer' }}>📵</button>
        {status === 'connected' && <button onClick={() => setIsMuted(!isMuted)} style={{ background: '#333', border: 'none', borderRadius: '50%', width: 64, height: 64, fontSize: 28, cursor: 'pointer' }}>{isMuted ? '🔇' : '🔊'}</button>}
      </div>
    </div>
  );
};

// ============================================
// AUTH SCREEN
// ============================================
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

  const sendOTP = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setOtpCode(code);
    setTimer(60);
    alert(`Your OTP code is: ${code}`);
  };
  const verifyOTP = () => {
    if (otpInput === otpCode) { if (isLogin) onLogin(identifier, 'otp'); else onSignup(identifier, username, fullName, 'otp'); }
    else alert('Invalid OTP');
  };
  useEffect(() => { if (timer > 0) { const i = setInterval(() => setTimer(t => t - 1), 1000); return () => clearInterval(i); } }, [timer]);
  const handleMethodSelect = m => { setSelectedMethod(m); setStep('credentials'); };
  const handleSubmit = () => {
    if (selectedMethod?.id === 'email' || selectedMethod?.id === 'phone') { sendOTP(); setStep('otp'); }
    else { if (isLogin) onLogin(identifier, password); else onSignup(identifier, username, fullName, password); }
  };

  if (step === 'method') return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'linear-gradient(160deg,#0a0a0a 60%,#120007)' }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 56, marginBottom: 10 }}>🎬</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, background: 'linear-gradient(135deg,#ff2d55,#af52de)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Dagu</h1>
          <p style={{ color: '#555', fontSize: 12, marginTop: 8 }}>{isLogin ? 'Welcome back!' : 'Create your account'}</p>
        </div>
        <div style={{ color: '#666', fontSize: 11, marginBottom: 12, textAlign: 'center' }}>{isLogin ? 'Sign in with' : 'Sign up with'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
          {LOGIN_METHODS.slice(0,6).map(m => <button key={m.id} onClick={() => handleMethodSelect(m)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#161616', border: '1px solid #222', borderRadius: 30, padding: '6px 14px', cursor: 'pointer', fontSize: 12, color: '#ccc' }}><span style={{ fontSize: 14 }}>{m.icon}</span>{m.name}</button>)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {LOGIN_METHODS.slice(6).map(m => <button key={m.id} onClick={() => handleMethodSelect(m)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#161616', border: '1px solid #222', borderRadius: 30, padding: '6px 14px', cursor: 'pointer', fontSize: 12, color: '#ccc' }}><span style={{ fontSize: 14 }}>{m.icon}</span>{m.name}</button>)}
        </div>
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={() => setIsLogin(!isLogin)} style={{ background: 'none', border: 'none', color: '#ff2d55', fontSize: 13, cursor: 'pointer' }}>{isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}</button>
        </div>
      </div>
    </div>
  );

  if (step === 'credentials') return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#0a0a0a' }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <button onClick={() => setStep('method')} style={{ background: 'none', border: 'none', color: '#ff2d55', marginBottom: 20, cursor: 'pointer', fontSize: 14 }}>← Back</button>
        <div style={{ background: '#141414', borderRadius: 20, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span style={{ fontSize: 30 }}>{selectedMethod?.icon}</span>
            <div><div style={{ color: 'white', fontWeight: 700 }}>{isLogin?'Sign in':'Sign up'} with {selectedMethod?.name}</div></div>
          </div>
          {!isLogin && <>
            <input placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: 'white', marginBottom: 10, outline: 'none', fontSize: 13, boxSizing:'border-box' }} />
            <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: 'white', marginBottom: 10, outline: 'none', fontSize: 13, boxSizing:'border-box' }} />
          </>}
          <input placeholder={selectedMethod?.id === 'email' ? 'Email' : selectedMethod?.id === 'phone' ? 'Phone' : `${selectedMethod?.name} ID`} value={identifier} onChange={e => setIdentifier(e.target.value)} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: 'white', marginBottom: 10, outline: 'none', fontSize: 13, boxSizing:'border-box' }} />
          {selectedMethod?.id !== 'email' && selectedMethod?.id !== 'phone' && (
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: 'white', marginBottom: 10, outline: 'none', fontSize: 13, boxSizing:'border-box' }} />
          )}
          <button onClick={handleSubmit} disabled={!identifier || (!isLogin && (!username || !fullName))} style={{ width: '100%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: 24, padding: 14, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: (!identifier || (!isLogin && (!username || !fullName))) ? 0.5 : 1 }}>Continue</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#0a0a0a' }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ background: '#141414', borderRadius: 20, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>📱</div>
          <div style={{ color: 'white', fontWeight: 700, marginBottom: 6 }}>Verification Code</div>
          <div style={{ color: '#555', fontSize: 12, marginBottom: 20 }}>Sent to {identifier}</div>
          <input placeholder="000000" maxLength={6} value={otpInput} onChange={e => setOtpInput(e.target.value)} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 12, padding: 14, color: 'white', textAlign: 'center', fontSize: 22, letterSpacing: 6, marginBottom: 16, outline: 'none', boxSizing:'border-box' }} />
          <button onClick={verifyOTP} disabled={otpInput.length !== 6} style={{ width: '100%', background: otpInput.length === 6 ? '#ff2d55' : '#1a1a1a', border: 'none', borderRadius: 24, padding: 13, color: 'white', fontWeight: 600, cursor: otpInput.length === 6 ? 'pointer' : 'default' }}>Verify & {isLogin ? 'Login' : 'Sign Up'}</button>
          {timer > 0 && <div style={{ color: '#555', fontSize: 11, marginTop: 10 }}>Resend in {timer}s</div>}
        </div>
      </div>
    </div>
  );
};

// ============================================
// SEARCH OVERLAY
// ============================================
const SearchOverlay = ({ onClose, videos, users, onViewProfile }) => {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const results = useMemo(() => {
    if (!query.trim()) return { videos: [], users: [], hashtags: [] };
    const q = query.toLowerCase();
    return {
      videos: videos.filter(v => v.username.toLowerCase().includes(q) || v.description.toLowerCase().includes(q)).slice(0,6),
      users: users.filter(u => u.username.toLowerCase().includes(q)).slice(0,6),
      hashtags: [...new Set(videos.flatMap(v => v.hashtags||[]).filter(h => h.toLowerCase().includes(q)))].slice(0,6),
    };
  }, [query, videos, users]);
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px', borderBottom: '1px solid #1a1a1a', display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#161616', borderRadius: 24, padding: '9px 14px' }}>
          <span style={{ marginRight: 8 }}>🔍</span>
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search videos, users, tags..." style={{ flex: 1, background: 'none', border: 'none', color: 'white', outline: 'none', fontSize: 13 }} />
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer' }}>✕</button>
      </div>
      {query && (
        <>
          <div style={{ display: 'flex', gap: 4, padding: '8px 14px', borderBottom: '1px solid #1a1a1a' }}>
            {['all','videos','users','hashtags'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? 'rgba(255,45,85,0.15)' : 'none', border: 'none', padding: '5px 12px', color: tab===t?'#ff2d55':'#666', cursor: 'pointer', borderRadius: 20, fontSize: 12, fontWeight: tab===t?700:400, textTransform: 'capitalize' }}>{t}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {(tab === 'all' || tab === 'users') && results.users.map(u => (
              <div key={u.id} onClick={() => { onViewProfile?.(u.id); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#141414', borderRadius: 12, marginBottom: 8, cursor: 'pointer' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>{u.avatar}</div>
                <div style={{ flex: 1 }}><div style={{ color: 'white', fontWeight: 600, fontSize: 13 }}>@{u.username}</div><div style={{ color: '#555', fontSize: 11 }}>{u.bio?.substring(0,45)}</div></div>
              </div>
            ))}
            {(tab === 'all' || tab === 'videos') && results.videos.map(v => (
              <div key={v.id} style={{ padding: '10px 12px', background: '#141414', borderRadius: 12, marginBottom: 8 }}>
                <div style={{ color: '#ff2d55', fontSize: 11 }}>@{v.username}</div>
                <div style={{ color: 'white', fontSize: 13, marginTop: 2 }}>{v.description}</div>
              </div>
            ))}
            {(tab === 'all' || tab === 'hashtags') && results.hashtags.map(h => (
              <div key={h} style={{ padding: '11px 14px', background: '#141414', borderRadius: 12, marginBottom: 8, color: '#ff2d55', fontSize: 15, fontWeight: 600 }}>{h}</div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ============================================
// CAMERA UPLOAD
// ============================================
const CameraUpload = ({ onUpload, onClose, showToast }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setShowCamera(true);
    } catch { showToast?.('Camera access denied', 'error'); }
  };
  const stopCamera = () => { if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; } setShowCamera(false); };
  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
      canvas.toBlob(blob => { const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' }); setSelectedFile({ file, url: URL.createObjectURL(blob), type: 'image/jpeg' }); stopCamera(); }, 'image/jpeg');
    }
  };
  const handleFileSelect = e => { const f = e.target.files[0]; if (f) setSelectedFile({ file: f, url: URL.createObjectURL(f), type: f.type }); };
  const handleUpload = () => {
    if (!selectedFile) { showToast?.('Select media first', 'error'); return; }
    setUploading(true);
    setTimeout(() => { onUpload?.({ id: `v${Date.now()}`, videoUrl: selectedFile.url, description: description || 'New post! 🔥', createdAt: new Date().toISOString() }); setUploading(false); onClose?.(); showToast?.('Posted! 🚀', 'success'); }, 1200);
  };
  useEffect(() => { return () => stopCamera(); }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a1a' }}>
        <button onClick={onClose} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '8px 14px', color: 'white', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        <h3 style={{ color: 'white', fontSize: 15, fontWeight: 700 }}>Create Post</h3>
        <button onClick={handleUpload} disabled={uploading} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 14px', color: 'white', fontWeight: 700, cursor: uploading ? 'default' : 'pointer', fontSize: 13 }}>{uploading ? '...' : 'Post'}</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button onClick={stopCamera} style={{ flex: 1, background: !showCamera ? '#ff2d55' : '#161616', border: 'none', borderRadius: 12, padding: 11, color: 'white', cursor: 'pointer', fontSize: 12 }}>📱 Gallery</button>
          <button onClick={startCamera} style={{ flex: 1, background: showCamera ? '#ff2d55' : '#161616', border: 'none', borderRadius: 12, padding: 11, color: 'white', cursor: 'pointer', fontSize: 12 }}>📷 Camera</button>
        </div>
        <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 16, marginBottom: 14, minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {showCamera ? (
            <div style={{ position: 'relative', width: '100%' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 16 }} />
              <button onClick={capturePhoto} style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: '#ff2d55', border: 'none', borderRadius: '50%', width: 58, height: 58, fontSize: 26, cursor: 'pointer' }}>📸</button>
              <button onClick={stopCamera} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
          ) : selectedFile?.type?.startsWith('image/') ? (
            <img src={selectedFile.url} alt="" style={{ width: '100%', borderRadius: 16 }} />
          ) : selectedFile?.type?.startsWith('video/') ? (
            <video src={selectedFile.url} controls style={{ width: '100%', borderRadius: 16 }} />
          ) : (
            <label style={{ textAlign: 'center', cursor: 'pointer', padding: 40 }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>📁</div>
              <div style={{ color: '#555', fontSize: 13 }}>Tap to choose from gallery</div>
              <input type="file" accept="video/*,image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
            </label>
          )}
        </div>
        <textarea placeholder="Write a caption..." value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 12, color: 'white', minHeight: 80, outline: 'none', fontSize: 13, resize: 'none', boxSizing: 'border-box' }} />
      </div>
    </div>
  );
};

// ============================================
// FRIENDS FEED
// ============================================
const FriendsFeed = ({ friends, videos, currentUser, onMessage, onVoiceCall, onVideoCall, onViewProfile, showToast }) => {
  const [search, setSearch] = useState('');
  const friendsVideos = useMemo(() => videos.filter(v => friends.includes(v.userId)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)), [friends, videos]);
  const filtered = useMemo(() => !search ? friendsVideos : friendsVideos.filter(v => v.username.toLowerCase().includes(search.toLowerCase()) || v.description.toLowerCase().includes(search.toLowerCase())), [friendsVideos, search]);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#161616', borderRadius: 24, padding: '8px 14px' }}><span>🔍</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search friend videos..." style={{ flex: 1, background: 'none', border: 'none', color: 'white', outline: 'none', fontSize: 13 }} /></div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? <div style={{ textAlign: 'center', padding: 60, color: '#555' }}><div style={{ fontSize: 44, marginBottom: 12 }}>👥</div><div>No friend videos yet</div><div style={{ fontSize: 12, marginTop: 8, color: '#666' }}>Follow more people to see their posts!</div></div> : (
          <div style={{ padding: 14 }}>
            {filtered.map(video => (
              <div key={video.id} style={{ background: '#141414', borderRadius: 16, marginBottom: 14, overflow: 'hidden', border: '1px solid #1e1e1e' }}>
                <div style={{ background: '#000', minHeight: 160 }}><video src={video.videoUrl} style={{ width: '100%', maxHeight: 200 }} controls /></div>
                <div style={{ padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div onClick={() => onViewProfile?.(video.userId)} style={{ width: 38, height: 38, borderRadius: '50%', background: video.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 14, cursor: 'pointer' }}>{video.avatar}</div>
                    <div style={{ flex: 1 }}><div style={{ color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }} onClick={() => onViewProfile?.(video.userId)}>@{video.username}</div><div style={{ color: '#555', fontSize: 11 }}>{formatNumber(video.views)} views</div></div>
                    <button onClick={() => onMessage?.(video.userId)} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '6px 12px', color: 'white', fontSize: 11, cursor: 'pointer' }}>💬</button>
                  </div>
                  <p style={{ color: '#bbb', fontSize: 12 }}>{video.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// SOUND LIBRARY PAGE
// ============================================
const SoundLibraryPage = ({ onSelectSound, onClose }) => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => !search ? SOUND_LIBRARY : SOUND_LIBRARY.filter(s => s.name.toLowerCase().includes(search.toLowerCase())), [search]);
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: 'white', fontSize: 18 }}>🎵 Sounds</h2>
        <button onClick={onClose} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '8px 14px', color: 'white', cursor: 'pointer' }}>Close</button>
      </div>
      <div style={{ padding: '10px 16px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sounds..." style={{ width: '100%', background: '#161616', border: 'none', borderRadius: 20, padding: '10px 16px', color: 'white', outline: 'none', fontSize: 13, boxSizing: 'border-box' }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px' }}>
        {filtered.map(sound => (
          <div key={sound.id} onClick={() => onSelectSound(sound)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: '#141414', borderRadius: 14, marginBottom: 8, cursor: 'pointer' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#ff2d55,#af52de)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎵</div>
            <div style={{ flex: 1 }}><div style={{ color: 'white', fontWeight: 600, fontSize: 13 }}>{sound.name}</div><div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{sound.artist} · {sound.duration}</div></div>
            {sound.popular && <span style={{ color: '#ffd700', fontSize: 11 }}>🔥</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// ANALYTICS PAGE
// ============================================
const CreatorAnalytics = ({ user, videos, onClose }) => {
  const userVideos = videos.filter(v => v.userId === user?.id);
  const totalViews = userVideos.reduce((s,v)=>s+v.views,0);
  const totalLikes = userVideos.reduce((s,v)=>s+v.likes,0);
  const weeklyData = [1200,1450,1800,2100,2500,2900,3400];
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 200, overflow: 'auto' }}>
      <div style={{ padding: '70px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: 'white', fontSize: 24 }}>📊 Analytics</h2>
          <button onClick={onClose} style={{ background: '#1a1a1a', border: 'none', borderRadius: 20, padding: '8px 16px', color: 'white', cursor: 'pointer' }}>Close</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 20 }}>
          {[['Total Views',formatNumber(totalViews),'#06d6a0'],['Total Likes',formatNumber(totalLikes),'#ff2d55'],['Videos',String(userVideos.length),'#af52de'],['Coins',String(user?.coins||0),'#ffd700']].map(([label,val,color])=>(
            <div key={label} style={{ background: '#1a1a1a', borderRadius: 16, padding: 18 }}>
              <div style={{ color: '#888', fontSize: 11 }}>{label}</div>
              <div style={{ color: color, fontSize: 26, fontWeight: 700, marginTop: 4 }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <h3 style={{ color: 'white', marginBottom: 14, fontSize: 14 }}>📈 Weekly Growth</h3>
          <div style={{ height: 120, display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            {weeklyData.map((v,i) => <div key={i} style={{ flex: 1, height: `${(v/4000)*100}%`, background: 'linear-gradient(180deg,#ff2d55,#af52de)', borderRadius: 6 }} />)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><span key={d} style={{ color: '#555', fontSize: 10 }}>{d}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// QR CODE PAGE
// ============================================
const QRCodePage = ({ user, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ background: '#141414', borderRadius: 28, padding: 32, textAlign: 'center', maxWidth: 300, width: '100%', margin: '0 20px' }}>
      <button onClick={onClose} style={{ position: 'absolute', marginLeft: 100, marginTop: -16, background: '#222', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer' }}>✕</button>
      <div style={{ fontSize: 70, marginBottom: 14 }}>📱</div>
      <div style={{ width: 180, height: 180, background: 'white', margin: '0 auto 20px', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundImage: 'repeating-linear-gradient(45deg,#000 0,#000 2px,#fff 2px,#fff 8px)' }}>
        <div style={{ width: 140, height: 140, background: 'white', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <div style={{ fontSize: 36 }}>🎬</div>
          <div style={{ fontSize: 11, fontWeight: 'bold', marginTop: 6 }}>@{user?.username}</div>
        </div>
      </div>
      <h3 style={{ color: 'white', marginBottom: 6 }}>Scan to Follow</h3>
      <p style={{ color: '#888', fontSize: 12 }}>@{user?.username} on Dagu</p>
      <button style={{ marginTop: 16, width: '100%', background: '#ff2d55', border: 'none', borderRadius: 24, padding: 12, color: 'white', fontWeight: 600, cursor: 'pointer' }}>Share Profile</button>
    </div>
  </div>
);

// ============================================
// MAIN APP
// ============================================
export default function DaguFixedApp() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [videos, setVideos] = useState([]);
  const [stories, setStories] = useState([]);
  const [friends, setFriends] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showCall, setShowCall] = useState(null);
  const [showLiveStream, setShowLiveStream] = useState(null);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [showSoundLibrary, setShowSoundLibrary] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [followed, setFollowed] = useState([]);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [storyViewerUser, setStoryViewerUser] = useState(null);

  const showToast = useCallback((message, type = 'info') => setToast({ message, type }), []);

  // Initialize demo data
  useEffect(() => {
    const demoUsers = [
      { id: 'u1', username: 'alex_wonders', email: 'alex@example.com', avatar: 'A', avatarColor: '#FF2D55', verified: true, bio: '✨ Content creator & storyteller', followers: ['u2'], following: ['u2'], coins: 5000, walletBalance: 5000, level: 10, streak: 30, subscription: 'pro' },
      { id: 'u2', username: 'jordan_taylor', email: 'jordan@example.com', avatar: 'J', avatarColor: '#00C7BE', verified: false, bio: '📱 Making content every day', followers: ['u1'], following: ['u1'], coins: 1000, walletBalance: 1000, level: 3, streak: 5, subscription: 'free' },
      { id: 'u3', username: 'sam_creates', email: 'sam@example.com', avatar: 'S', avatarColor: '#AF52DE', verified: true, bio: '🎨 Artist & Creator', followers: [], following: [], coins: 3000, walletBalance: 3000, level: 7, streak: 12, subscription: 'plus' },
    ];
    setUsers(demoUsers);
    setFriends(['u2']);
    setFollowed(['u2']);
    setVideos([
      { id: 'v1', userId: 'u2', username: 'jordan_taylor', avatar: 'J', avatarColor: '#00C7BE', verified: false, description: 'Check this out! 🔥 #fyp #trending', song: 'Sunset Dreams', songId: 's1', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', likes: 1502, comments: 89, shares: 45, views: 10000, hashtags: ['#fyp','#trending'], category: 'foryou', createdAt: new Date() },
      { id: 'v2', userId: 'u1', username: 'alex_wonders', avatar: 'A', avatarColor: '#FF2D55', verified: true, description: 'Golden hour magic ✨ #viral #lifestyle', song: 'Creative Flow', songId: 's2', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', likes: 5001, comments: 234, shares: 120, views: 50000, hashtags: ['#viral','#lifestyle'], category: 'foryou', createdAt: new Date() },
      { id: 'v3', userId: 'u3', username: 'sam_creates', avatar: 'S', avatarColor: '#AF52DE', verified: true, description: 'Art process ✏️ #art #creative', song: 'Urban Vibes', songId: 's3', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFunflies.mp4', likes: 3200, comments: 156, shares: 89, views: 25000, hashtags: ['#art','#creative'], category: 'foryou', createdAt: new Date() },
    ]);
  }, []);

  const handleLogin = (identifier, password) => {
    let user = users.find(u => u.email === identifier);
    
    if (user) {
      setCurrentUser(user);
      showToast(`Welcome back, @${user.username}! 👋`, 'success');
    } else {
      // Create NEW user
      const newUsername = identifier.split('@')[0];
      const newUser = { 
        id: `u${Date.now()}`, 
        username: newUsername, 
        email: identifier, 
        avatar: newUsername[0].toUpperCase(), 
        avatarColor: `hsl(${Math.random()*360},70%,60%)`, 
        verified: false, 
        bio: 'New to Dagu! 🎬', 
        followers: [], 
        following: [], 
        coins: 500, 
        walletBalance: 500, 
        level: 1, 
        streak: 1, 
        subscription: 'free' 
      };
      setUsers(prev => [...prev, newUser]);
      setCurrentUser(newUser);
      showToast(`Welcome to Dagu, @${newUsername}! 🎉`, 'success');
    }
  };

  const handleSignup = (identifier, username, fullName, password) => {
    const newUser = { 
      id: `u${Date.now()}`, 
      username, 
      email: identifier, 
      avatar: username[0].toUpperCase(), 
      avatarColor: `hsl(${Math.random()*360},70%,60%)`, 
      verified: false, 
      bio: 'New to Dagu! 🎬', 
      followers: [], 
      following: [], 
      coins: 500, 
      walletBalance: 500, 
      level: 1, 
      streak: 1, 
      subscription: 'free' 
    };
    setUsers(prev => [...prev, newUser]);
    setCurrentUser(newUser);
    showToast(`Welcome to Dagu, @${username}! 🎉`, 'success');
  };

  const handleLogout = () => { setCurrentUser(null); showToast('Logged out', 'info'); };
  
  const toggleFollow = (userId) => {
    setFollowed(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
    showToast(followed.includes(userId) ? 'Unfollowed' : 'Followed!', 'success');
  };
  
  const handleViewProfile = (userId) => {
    const user = users.find(u => u.id === userId);
    if (user) setViewingProfile(user);
  };

  const handleMessage = (userId) => {
    setActiveTab('inbox');
  };

  const handleAddStory = (story) => {
    setStories(prev => [story, ...prev]);
  };

  const handleViewStory = (user) => {
    const userStories = stories.filter(s => s.userId === user.id);
    if (userStories.length > 0) {
      setStoryViewerUser(user);
      setShowStoryViewer(true);
    } else {
      showToast('No stories to view', 'info');
    }
  };

  const handleAddVideo = (newVideo) => {
    setVideos(prev => [newVideo, ...prev]);
  };

  const getStoryUsers = () => {
    const userIds = [...new Set(stories.map(s => s.userId))];
    return userIds.map(uid => users.find(u => u.id === uid)).filter(Boolean);
  };

  const storyUserList = getStoryUsers();
  const currentStoryIndex = storyUserList.findIndex(u => u?.id === storyViewerUser?.id);

  const goToNextStoryUser = () => {
    if (currentStoryIndex < storyUserList.length - 1) {
      setStoryViewerUser(storyUserList[currentStoryIndex + 1]);
    } else {
      setShowStoryViewer(false);
      setStoryViewerUser(null);
    }
  };

  const goToPrevStoryUser = () => {
    if (currentStoryIndex > 0) {
      setStoryViewerUser(storyUserList[currentStoryIndex - 1]);
    }
  };

  if (!currentUser) {
    return (
      <div style={{height:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0a0a'}}>
        <AuthScreen onLogin={handleLogin} onSignup={handleSignup} />
      </div>
    );
  }

  const tabs = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'friends', icon: '👥', label: 'Friends' },
    { id: 'create', icon: '➕', label: 'Create' },
    { id: 'inbox', icon: '💬', label: 'Inbox' },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ];

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        ::-webkit-scrollbar{display:none}
        @keyframes heartBurst{0%{transform:scale(0.4) translateY(0);opacity:1}100%{transform:scale(1.5) translateY(-60px);opacity:0}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes floatUp{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-100px) scale(1.5);opacity:0}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        button:active{transform:scale(0.95)}
      `}</style>

      {/* Modals */}
      {showCall && <CallModal type={showCall.type} contactName={showCall.contactName} contactAvatar={showCall.contactAvatar} onClose={() => setShowCall(null)} />}
      {showLiveStream && <LiveStream streamer={showLiveStream} onClose={() => setShowLiveStream(null)} showToast={showToast} currentUser={currentUser} />}
      {showStoryViewer && storyViewerUser && (
        <StoryViewer 
          stories={stories} 
          user={storyViewerUser} 
          currentUser={currentUser} 
          onClose={() => { setShowStoryViewer(false); setStoryViewerUser(null); }} 
          onNextUser={goToNextStoryUser}
          onPrevUser={goToPrevStoryUser}
        />
      )}
      {showSoundLibrary && <SoundLibraryPage onSelectSound={s => { showToast?.(`Selected: ${s.name}`, 'success'); setShowSoundLibrary(false); }} onClose={() => setShowSoundLibrary(false)} />}
      {showQRCode && <QRCodePage user={currentUser} onClose={() => setShowQRCode(false)} />}
      {showAnalytics && <CreatorAnalytics user={currentUser} videos={videos} onClose={() => setShowAnalytics(false)} />}
      {viewingProfile && <UserProfileModal user={viewingProfile} currentUser={currentUser} onClose={() => setViewingProfile(null)} onFollow={toggleFollow} onMessage={uid => { handleMessage(uid); setViewingProfile(null); }} onVoiceCall={uid => { const u = users.find(uu=>uu.id===uid); setShowCall({ type:'audio', contactName:u?.username, contactAvatar:u?.avatar }); setViewingProfile(null); }} onVideoCall={uid => { const u = users.find(uu=>uu.id===uid); setShowCall({ type:'video', contactName:u?.username, contactAvatar:u?.avatar }); setViewingProfile(null); }} followed={followed} showToast={showToast} />}

      {/* Stories Row */}
      {activeTab === 'home' && !showStoryViewer && !showLiveStream && (
        <Stories users={users} stories={stories} currentUser={currentUser} onViewStory={handleViewStory} onAddStory={handleAddStory} showToast={showToast} />
      )}

      {/* Top Bar */}
      {activeTab !== 'profile' && (
        <div style={{ padding: '10px 14px', background: '#0a0a0a', borderBottom: '1px solid #141414', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button onClick={() => setShowSearch(true)} style={{ flex: 1, background: '#141414', border: '1px solid #1e1e1e', borderRadius: 24, padding: '9px 14px', color: '#555', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <span>🔍</span> Search videos, users...
          </button>
          <button onClick={() => setShowSoundLibrary(true)} style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎵</button>
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} videos={videos} users={users} onViewProfile={uid => { handleViewProfile(uid); setShowSearch(false); }} />}
        {showCamera && <CameraUpload onUpload={handleAddVideo} onClose={() => setShowCamera(false)} showToast={showToast} />}

        {!showSearch && !showCamera && (
          <>
            {activeTab === 'home' && (
              <HomeFeed
                videos={videos} currentUser={currentUser}
                onLike={() => {}} onComment={() => {}} onShare={() => {}}
                onFollow={toggleFollow}
                onMessage={handleMessage}
                onVoiceCall={uid => { const u = users.find(uu=>uu.id===uid); setShowCall({ type:'audio', contactName:u?.username, contactAvatar:u?.avatar }); }}
                onVideoCall={uid => { const u = users.find(uu=>uu.id===uid); setShowCall({ type:'video', contactName:u?.username, contactAvatar:u?.avatar }); }}
                onDuet={() => showToast?.('Duet mode ready', 'info')}
                onStitch={() => showToast?.('Stitch mode ready', 'info')}
                onSaveSound={() => showToast?.('Sound saved!', 'success')}
                followed={followed} showToast={showToast}
                onLive={() => setShowLiveStream(currentUser)}
                onViewProfile={handleViewProfile}
              />
            )}
            {activeTab === 'friends' && (
              <FriendsFeed 
                friends={followed} 
                videos={videos} 
                currentUser={currentUser}
                onMessage={handleMessage}
                onVoiceCall={uid => { const u = users.find(uu=>uu.id===uid); setShowCall({ type:'audio', contactName:u?.username, contactAvatar:u?.avatar }); }}
                onVideoCall={uid => { const u = users.find(uu=>uu.id===uid); setShowCall({ type:'video', contactName:u?.username, contactAvatar:u?.avatar }); }}
                onViewProfile={handleViewProfile}
                showToast={showToast}
              />
            )}
            {activeTab === 'create' && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 52, marginBottom: 8 }}>🎬</div>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>Create & Share</div>
                  <div style={{ color: '#555', fontSize: 12, marginTop: 4 }}>Express yourself with video</div>
                </div>
                <button onClick={() => setShowCamera(true)} style={{ width: '100%', maxWidth: 280, background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: 24, padding: '18px 20px', color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>📷 Open Camera</button>
                <button onClick={() => setShowSoundLibrary(true)} style={{ width: '100%', maxWidth: 280, background: '#141414', border: '1px solid #1e1e1e', borderRadius: 24, padding: '16px 20px', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>🎵 Add Sound</button>
                <button onClick={() => setShowLiveStream(currentUser)} style={{ width: '100%', maxWidth: 280, background: 'rgba(255,45,85,0.15)', border: '1px solid #ff2d55', borderRadius: 24, padding: '16px 20px', color: '#ff2d55', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>🔴 Go Live</button>
              </div>
            )}
            {activeTab === 'inbox' && (
              <InboxPage users={users} currentUser={currentUser} showToast={showToast} />
            )}
            {activeTab === 'profile' && (
              <ProfilePage
                user={currentUser}
                setCurrentUser={setCurrentUser}
                onLogout={handleLogout}
                users={users}
                showToast={showToast}
                onShowAnalytics={() => setShowAnalytics(true)}
                onShowQRCode={() => setShowQRCode(true)}
              />
            )}
          </>
        )}
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', background: 'rgba(8,8,8,0.97)', borderTop: '1px solid #161616', padding: '8px 4px 18px', flexShrink: 0, backdropFilter: 'blur(12px)' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'create') setShowCamera(true); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}>
            <span style={{ fontSize: tab.id === 'create' ? 26 : 20, transform: activeTab === tab.id ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.15s' }}>{tab.icon}</span>
            <span style={{ fontSize: 10, color: activeTab === tab.id ? '#ff2d55' : '#444', fontWeight: activeTab === tab.id ? 700 : 400 }}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Live Button */}
      {activeTab === 'home' && (
        <button onClick={() => setShowLiveStream(currentUser)} style={{ position: 'absolute', right: 18, bottom: 86, background: '#ff2d55', border: 'none', borderRadius: '50%', width: 50, height: 50, fontSize: 22, cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,45,85,0.5)', zIndex: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔴</button>
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
