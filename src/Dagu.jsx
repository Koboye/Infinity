// Dagu.jsx - COMPLETE FIXED VERSION
// Fixes applied:
// 1. AuthScreen is the login/register gate — always shown when not logged in
// 2. User document stored with setDoc(uid) for reliable retrieval
// 3. onAuthStateChanged properly waits for user doc before rendering app
// 4. All collections unified: "posts" (not "videos")
// 5. Profile edit saves correctly
// 6. InboxPage only loads when active (performance fix)
// 7. MyProfile tab shows edit profile inline (not via Settings detour)
// 8. Bottom nav "Create" opens modal without replacing feed
// 9. messageUserId properly opens correct chat on inbox mount
// 10. Stories 24h expiry filter added

import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { auth, db, storage, googleProvider } from './firebase';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, signInWithPopup
} from 'firebase/auth';
import {
  collection, addDoc, getDocs, onSnapshot, doc,
  updateDoc, getDoc, arrayUnion, arrayRemove, serverTimestamp,
  query, orderBy, where, limit, increment, deleteDoc, setDoc
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// ─── HELPERS ────────────────────────────────────────────────────────────────

const formatNumber = (num) => {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const timeAgo = (timestamp) => {
  if (!timestamp) return 'Just now';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

const EMOJIS = ['😀','😂','😍','🥰','😎','🤔','😭','😱','🔥','❤️','👍','🎉','✨','💯','🙌','👏','🤝','💪','🎵','📸','🐶','🐱','🍕','🏀','🚗','✈️','⭐','💔','✅','❌','😘','🥺','🤣','😊','😇','🥳','😤','😴','💀','👀'];

const VIDEO_FILTERS = [
  { id: 'none',    name: 'Normal',  icon: '✨', css: 'none' },
  { id: 'vivid',   name: 'Vivid',   icon: '🌈', css: 'saturate(1.5) contrast(1.1)' },
  { id: 'warm',    name: 'Warm',    icon: '🔥', css: 'sepia(0.4) saturate(1.3)' },
  { id: 'cool',    name: 'Cool',    icon: '❄️', css: 'hue-rotate(30deg) saturate(1.2)' },
  { id: 'bw',      name: 'B&W',     icon: '⚫', css: 'grayscale(1)' },
  { id: 'vintage', name: 'Vintage', icon: '📻', css: 'sepia(0.6) contrast(1.1)' },
  { id: 'neon',    name: 'Neon',    icon: '💡', css: 'brightness(1.2) saturate(1.5) hue-rotate(180deg)' },
  { id: 'pastel',  name: 'Pastel',  icon: '🌸', css: 'saturate(0.8) brightness(1.1)' },
];

// ─── TOAST ──────────────────────────────────────────────────────────────────

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: '#06d6a0', error: '#ff2d55', info: '#af52de', warning: '#ff9500' };
  return (
    <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', border: `1px solid ${colors[type] || '#333'}`, borderRadius: 30, padding: '12px 24px', zIndex: 10000, whiteSpace: 'nowrap' }}>
      <span style={{ color: colors[type] || '#fff', fontSize: 14 }}>{message}</span>
    </div>
  );
};

// ─── REPORT MODAL ───────────────────────────────────────────────────────────

const ReportModal = ({ targetId, targetType, targetName, reportedBy, onClose, showToast }) => {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const reasons = ['Spam or misleading','Harassment or bullying','Hate speech','Violence or dangerous content','Nudity or sexual content','False information','Intellectual property violation','Other'];

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reports'), { targetId, targetType, targetName, reason, details: details.trim(), reportedBy, status: 'pending', createdAt: serverTimestamp() });
      showToast('Report submitted. We will review it.', 'success');
      onClose();
    } catch { showToast('Failed to submit report', 'error'); }
    setSubmitting(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 400, background: '#141414', borderRadius: 24, padding: 24 }}>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Report {targetType}</div>
        <div style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>Reporting @{targetName}</div>
        <div style={{ marginBottom: 16 }}>
          {reasons.map(r => (
            <button key={r} onClick={() => setReason(r)} style={{ width: '100%', textAlign: 'left', background: reason === r ? 'rgba(255,45,85,0.15)' : 'transparent', border: 'none', borderRadius: 10, padding: '10px 12px', marginBottom: 4, color: reason === r ? '#ff2d55' : '#ccc', cursor: 'pointer', fontSize: 13 }}>
              {reason === r ? '✓ ' : ''}{r}
            </button>
          ))}
        </div>
        <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Additional details (optional)" rows={3} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', fontSize: 13, outline: 'none', resize: 'none', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: '#2a2a2a', border: 'none', borderRadius: 20, padding: 12, color: '#fff', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!reason || submitting} style={{ flex: 1, background: '#ff2d55', border: 'none', borderRadius: 20, padding: 12, color: '#fff', cursor: !reason || submitting ? 'default' : 'pointer', opacity: !reason || submitting ? 0.5 : 1 }}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── AUTH SCREEN (Login + Register) ─────────────────────────────────────────

const AuthScreen = ({ showToast }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) { showToast('Please fill all fields', 'error'); return; }
    if (!isLogin && !username.trim()) { showToast('Username required', 'error'); return; }
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        showToast('Welcome back! 👋', 'success');
      } else {
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        // FIX: use setDoc with uid as document ID for reliable lookup
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          username: username.toLowerCase().trim(),
          email: email.trim(),
          bio: 'New to Dagu! 🎬',
          followers: [],
          following: [],
          photoURL: '',
          coins: 500,
          createdAt: serverTimestamp(),
        });
        showToast('Account created! 🎉', 'success');
      }
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        showToast('Invalid email or password', 'error');
      } else if (err.code === 'auth/email-already-in-use') {
        showToast('Email already registered — try logging in', 'error');
      } else if (err.code === 'auth/weak-password') {
        showToast('Password must be at least 6 characters', 'error');
      } else if (err.code === 'auth/invalid-email') {
        showToast('Invalid email address', 'error');
      } else {
        showToast(err.message, 'error');
      }
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const uid = result.user.uid;
      // FIX: use getDoc with uid-as-docId instead of query
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', uid), {
          uid,
          username: (result.user.displayName || 'user').toLowerCase().replace(/\s+/g, '_'),
          email: result.user.email,
          bio: 'Joined via Google 🎬',
          followers: [],
          following: [],
          photoURL: result.user.photoURL || '',
          coins: 500,
          createdAt: serverTimestamp(),
        });
      }
      showToast('Signed in with Google! 🎉', 'success');
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        showToast('Sign-in cancelled', 'info');
      } else {
        showToast('Google sign-in failed: ' + err.message, 'error');
      }
    }
    setGoogleLoading(false);
  };

  return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#0a0a0a 60%,#120007)', padding: 20, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>🎬</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, background: 'linear-gradient(135deg,#ff2d55,#af52de)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Dagu</h1>
          <p style={{ color: '#555', fontSize: 13 }}>{isLogin ? 'Welcome back!' : 'Join Dagu today'}</p>
        </div>

        {/* Google button */}
        <button onClick={handleGoogle} disabled={googleLoading} style={{ width: '100%', background: '#fff', border: 'none', borderRadius: 16, padding: 13, color: '#222', fontWeight: 700, cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: googleLoading ? 0.7 : 1 }}>
          {googleLoading ? '⏳ Signing in...' : '🌐 Continue with Google'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
          <span style={{ color: '#444', fontSize: 13 }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
        </div>

        {/* Form */}
        <div style={{ background: '#141414', borderRadius: 24, padding: 24 }}>
          {!isLogin && (
            <input
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 10, outline: 'none', fontSize: 14 }}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 10, outline: 'none', fontSize: 14 }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 16, outline: 'none', fontSize: 14 }}
          />
          <button onClick={submit} disabled={loading} style={{ width: '100%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: 24, padding: 14, color: '#fff', fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, fontSize: 15 }}>
            {loading ? '...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
          <button onClick={() => { setIsLogin(!isLogin); setEmail(''); setPassword(''); setUsername(''); }} style={{ width: '100%', background: 'none', border: 'none', color: '#ff2d55', marginTop: 12, cursor: 'pointer', fontSize: 13 }}>
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── CREATE POST MODAL ──────────────────────────────────────────────────────

const CreatePostModal = ({ currentUser, onClose, showToast }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('user');
  const [filter, setFilter] = useState(VIDEO_FILTERS[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedURL, setRecordedURL] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewURL, setPreviewURL] = useState(null);
  const [postType, setPostType] = useState('video');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [step, setStep] = useState('capture');

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [facingMode]);

  const startCamera = async () => {
    stopCamera(); setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraReady(true);
    } catch (err) {
      setCameraReady(false);
      setCameraError(err.name === 'NotAllowedError' ? 'Camera permission denied. Please allow camera access.' : 'Camera not available on this device.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob); setRecordedURL(URL.createObjectURL(blob));
      setPostType('video'); stopCamera(); setStep('preview');
    };
    recorder.start(); setIsRecording(true); setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(t => { if (t >= 59) { stopRecording(); return 60; } return t + 1; });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop(); setIsRecording(false); clearInterval(timerRef.current);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.filter = filter.css; ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
      setRecordedBlob(blob); setRecordedURL(URL.createObjectURL(blob));
      setPostType('photo'); stopCamera(); setStep('preview');
    }, 'image/jpeg', 0.92);
  };

  const handleGalleryPick = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setSelectedFile(file); setPreviewURL(URL.createObjectURL(file));
    setPostType(file.type.startsWith('video') ? 'video' : 'photo');
    stopCamera(); setStep('preview');
  };

  const handlePost = async () => {
    if (!currentUser?.uid) { showToast('Please log in first', 'error'); return; }
    const blob = recordedBlob || selectedFile;
    if (!blob) { showToast('No media selected', 'error'); return; }
    setUploading(true); setUploadProgress(0);
    try {
      const ext = postType === 'video' ? 'webm' : 'jpg';
      const path = `${postType}s/${currentUser.uid}_${Date.now()}.${ext}`;
      const storageRef2 = ref(storage, path);
      const task = uploadBytesResumable(storageRef2, blob);
      task.on('state_changed',
        snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        err => { showToast('Upload failed: ' + err.message, 'error'); setUploading(false); },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          // FIX: unified "posts" collection
          await addDoc(collection(db, 'posts'), {
            type: postType, url, caption: caption.trim(), filterUsed: filter.id,
            userId: currentUser.uid, username: currentUser.username,
            photoURL: currentUser.photoURL || '', likes: [], comments: [], shares: 0, saves: [],
            createdAt: serverTimestamp(),
          });
          showToast('Posted! 🎉', 'success'); setUploading(false); onClose();
        }
      );
    } catch (err) { showToast('Failed: ' + err.message, 'error'); setUploading(false); }
  };

  const discard = () => {
    setRecordedBlob(null); setRecordedURL(null); setSelectedFile(null);
    setPreviewURL(null); setStep('capture'); setCaption('');
    startCamera();
  };

  const formatTime = s => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (step === 'preview') {
    const mediaURL = recordedURL || previewURL;
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a1a' }}>
          <button onClick={discard} style={{ background: '#1a1a1a', border: 'none', borderRadius: 20, padding: '8px 14px', color: '#fff', cursor: 'pointer' }}>← Back</button>
          <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Preview</h3>
          <button onClick={handlePost} disabled={uploading} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 20px', color: '#fff', cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
            {uploading ? `${uploadProgress}%` : 'Post ✓'}
          </button>
        </div>
        <div style={{ flex: 1, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          {postType === 'video'
            ? <video src={mediaURL} controls autoPlay loop style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', filter: filter.css }} />
            : <img src={mediaURL} alt="preview" style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', filter: filter.css }} />
          }
          {uploading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <div style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>{uploadProgress}%</div>
              <div style={{ width: 200, background: '#333', borderRadius: 8, height: 6 }}>
                <div style={{ width: `${uploadProgress}%`, background: '#ff2d55', height: '100%', borderRadius: 8, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '12px 16px', background: '#0a0a0a', borderTop: '1px solid #1a1a1a' }}>
          <input placeholder="Write a caption..." value={caption} onChange={e => setCaption(e.target.value)} style={{ width: '100%', background: '#161616', border: '1px solid #222', borderRadius: 14, padding: '11px 14px', color: '#fff', outline: 'none', fontSize: 14 }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      {/* Top controls */}
      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 }}>
        <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: '#fff', fontSize: 18, cursor: 'pointer' }}>✕</button>
        <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 40, height: 40, fontSize: 20, cursor: 'pointer' }}>🔄</button>
      </div>

      {/* Camera view */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#111' }}>
        {cameraError ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📵</div>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>{cameraError}</p>
            <button onClick={() => fileInputRef.current?.click()} style={{ background: '#ff2d55', border: 'none', borderRadius: 24, padding: '12px 28px', color: '#fff', cursor: 'pointer', marginBottom: 12 }}>Pick from Gallery</button>
            <button onClick={startCamera} style={{ background: '#333', border: 'none', borderRadius: 24, padding: '12px 28px', color: '#fff', cursor: 'pointer' }}>Try Camera Again</button>
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: facingMode === 'user' ? 'scaleX(-1)' : 'none', filter: filter.css }} />
        )}
        {isRecording && (
          <div style={{ position: 'absolute', top: 70, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: '#ff2d55', borderRadius: 20, padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>REC {formatTime(recordingTime)}</span>
            </div>
          </div>
        )}
        {/* Filters strip */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 0', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'inline-flex', gap: 12, padding: '0 16px' }}>
            {VIDEO_FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer' }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: '#333', border: filter.id === f.id ? '2px solid #ff2d55' : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{f.icon}</div>
                <span style={{ color: filter.id === f.id ? '#ff2d55' : '#ccc', fontSize: 10 }}>{f.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{ background: '#000', padding: '20px 16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => fileInputRef.current?.click()} style={{ width: 56, height: 56, borderRadius: 14, background: '#1a1a1a', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, cursor: 'pointer' }}>🖼️</button>
        <input ref={fileInputRef} type="file" accept="video/*,image/*" onChange={handleGalleryPick} style={{ display: 'none' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <button
            onTouchStart={startRecording} onTouchEnd={stopRecording}
            onMouseDown={startRecording} onMouseUp={stopRecording}
            style={{ width: 76, height: 76, borderRadius: '50%', border: '4px solid #fff', background: isRecording ? '#ff2d55' : 'rgba(255,45,85,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isRecording
              ? <div style={{ width: 28, height: 28, background: '#fff', borderRadius: 4 }} />
              : <div style={{ width: 52, height: 52, background: '#ff2d55', borderRadius: '50%' }} />
            }
          </button>
          <span style={{ color: '#888', fontSize: 10 }}>{isRecording ? 'Release to stop' : 'Hold to record'}</span>
        </div>
        <button onClick={capturePhoto} style={{ width: 56, height: 56, borderRadius: '50%', background: '#fff', border: '3px solid #ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, cursor: 'pointer' }}>📸</button>
      </div>
    </div>
  );
};

// ─── STORIES ────────────────────────────────────────────────────────────────

const CreateStoryModal = ({ currentUser, onClose, showToast, onStoryPosted }) => {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef(null);

  const handleTextStory = async () => {
    if (!text.trim()) { showToast('Write something!', 'error'); return; }
    setPosting(true);
    try {
      await addDoc(collection(db, 'stories'), {
        type: 'text', text: text.trim(), userId: currentUser.uid,
        username: currentUser.username, photoURL: currentUser.photoURL || '',
        createdAt: serverTimestamp(),
      });
      showToast('Story posted! 📖', 'success'); onStoryPosted?.(); onClose();
    } catch { showToast('Failed to post story', 'error'); }
    setPosting(false);
  };

  const handleImageStory = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setPosting(true);
    try {
      const storageRef2 = ref(storage, `stories/${currentUser.uid}_${Date.now()}`);
      const task = uploadBytesResumable(storageRef2, file);
      task.on('state_changed', null, () => { showToast('Upload failed', 'error'); setPosting(false); }, async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await addDoc(collection(db, 'stories'), {
          type: 'photo', url, userId: currentUser.uid,
          username: currentUser.username, photoURL: currentUser.photoURL || '',
          createdAt: serverTimestamp(),
        });
        showToast('Story posted! 📸', 'success'); onStoryPosted?.(); onClose();
      });
    } catch { showToast('Failed to post story', 'error'); setPosting(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 16, borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>✕</button>
        <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Create Story</h3>
        <div style={{ width: 40 }} />
      </div>
      <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <button onClick={() => fileInputRef.current?.click()} style={{ background: '#141414', border: '2px dashed #333', borderRadius: 16, padding: 30, cursor: 'pointer', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📸</div>
          <div style={{ color: '#888' }}>Upload Photo Story</div>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageStory} style={{ display: 'none' }} />
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Or write a text story..." style={{ background: '#141414', border: '1px solid #222', borderRadius: 16, padding: 16, color: '#fff', fontSize: 16, outline: 'none', resize: 'none', height: 120 }} />
        <button onClick={handleTextStory} disabled={posting} style={{ background: '#ff2d55', border: 'none', borderRadius: 16, padding: 14, color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: posting ? 0.7 : 1 }}>
          {posting ? 'Posting...' : 'Post Text Story'}
        </button>
      </div>
    </div>
  );
};

const Stories = ({ currentUser, stories, onStoryPosted, showToast }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [viewingStory, setViewingStory] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!viewingStory) return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => { if (p >= 100) { clearInterval(interval); setViewingStory(null); return 0; } return p + 2; });
    }, 50);
    return () => clearInterval(interval);
  }, [viewingStory]);

  // FIX: filter stories to last 24 hours only
  const recentStories = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return stories.filter(s => {
      if (!s.createdAt) return true;
      const date = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      return date.getTime() > cutoff;
    });
  }, [stories]);

  const groupedStories = useMemo(() =>
    recentStories.reduce((acc, s) => { if (!acc[s.userId]) acc[s.userId] = []; acc[s.userId].push(s); return acc; }, {}),
    [recentStories]
  );

  return (
    <>
      <div style={{ padding: '10px 14px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {/* Your story */}
        <div style={{ display: 'inline-block', marginRight: 14, textAlign: 'center', cursor: 'pointer' }} onClick={() => setShowCreate(true)}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', padding: 2 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>➕</div>
          </div>
          <div style={{ color: '#888', fontSize: 10, marginTop: 3 }}>Your Story</div>
        </div>
        {/* Other stories */}
        {Object.values(groupedStories).map((group, i) => (
          <div key={i} style={{ display: 'inline-block', marginRight: 14, textAlign: 'center', cursor: 'pointer' }} onClick={() => setViewingStory(group)}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', padding: 2 }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff', overflow: 'hidden' }}>
                {group[0]?.photoURL ? <img src={group[0].photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : group[0]?.username?.[0]?.toUpperCase()}
              </div>
            </div>
            <div style={{ color: '#fff', fontSize: 10, marginTop: 3, maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis' }}>@{group[0]?.username}</div>
          </div>
        ))}
      </div>

      {showCreate && <CreateStoryModal currentUser={currentUser} onClose={() => setShowCreate(false)} onStoryPosted={onStoryPosted} showToast={showToast} />}

      {viewingStory && viewingStory[0] && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 3000 }} onClick={() => setViewingStory(null)}>
          <div style={{ position: 'absolute', top: 20, left: 0, right: 0, padding: '0 16px', zIndex: 1 }}>
            <div style={{ height: 3, background: '#333', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: '#fff', transition: 'width 0.05s linear' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ff2d55', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>
                {viewingStory[0].photoURL ? <img src={viewingStory[0].photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : viewingStory[0].username?.[0]?.toUpperCase()}
              </div>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>@{viewingStory[0].username}</span>
              <span style={{ color: '#888', fontSize: 11 }}>{timeAgo(viewingStory[0].createdAt)}</span>
            </div>
          </div>
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            {viewingStory[0].type === 'photo' && <img src={viewingStory[0].url} alt="story" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 16 }} />}
            {viewingStory[0].type === 'text' && (
              <div style={{ background: 'linear-gradient(135deg,#1a0020,#000)', borderRadius: 20, padding: 40, textAlign: 'center', maxWidth: 320 }}>
                <p style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{viewingStory[0].text}</p>
              </div>
            )}
          </div>
          <button onClick={e => { e.stopPropagation(); setViewingStory(null); }} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
      )}
    </>
  );
};

// ─── POST CARD ───────────────────────────────────────────────────────────────

const PostCard = memo(({ post, currentUser, onViewProfile, showToast, onLivePress }) => {
  const [liked, setLiked] = useState((post.likes || []).includes(currentUser?.uid));
  const [likeCount, setLikeCount] = useState((post.likes || []).length);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const videoRef = useRef(null);
  const lastTap = useRef(0);

  useEffect(() => {
    if (!showComments) return;
    const unsub = onSnapshot(
      query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt')),
      snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [showComments, post.id]);

  const toggleLike = async () => {
    const newLiked = !liked;
    setLiked(newLiked); setLikeCount(c => newLiked ? c + 1 : c - 1);
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        likes: newLiked ? arrayUnion(currentUser.uid) : arrayRemove(currentUser.uid)
      });
    } catch (e) { console.error(e); }
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    try {
      await addDoc(collection(db, 'posts', post.id, 'comments'), {
        text: commentText.trim(), userId: currentUser.uid,
        username: currentUser.username, photoURL: currentUser.photoURL || '',
        createdAt: serverTimestamp()
      });
      setCommentText(''); setShowEmojiPicker(false);
    } catch { showToast('Failed to comment', 'error'); }
  };

  const handleShare = async (platform) => {
    const url = window.location.href;
    if (platform === 'copy') {
      try { await navigator.clipboard.writeText(url); showToast('Link copied!', 'success'); }
      catch { showToast('Could not copy link', 'error'); }
    } else {
      const shareUrls = {
        'twitter': `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`,
        'facebook': `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        'whatsapp': `https://wa.me/?text=${encodeURIComponent(url)}`,
        'telegram': `https://t.me/share/url?url=${encodeURIComponent(url)}`,
      };
      if (shareUrls[platform]) window.open(shareUrls[platform], '_blank');
    }
    try { await updateDoc(doc(db, 'posts', post.id), { shares: increment(1) }); } catch {}
    setShowShareMenu(false);
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300 && !liked) toggleLike();
    lastTap.current = now;
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000', overflow: 'hidden' }} onClick={handleDoubleTap}>
      {post.type === 'video' && <video ref={videoRef} src={post.url} loop playsInline autoPlay muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {post.type === 'photo' && <img src={post.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {post.type === 'text' && (
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#1a0a2e,#0a0a1a)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <p style={{ color: '#fff', fontSize: 24, fontWeight: 700, textAlign: 'center' }}>{post.text}</p>
        </div>
      )}

      {/* Gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)', pointerEvents: 'none' }} />

      {/* Bottom info */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 68, padding: '18px 14px', zIndex: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <div onClick={e => { e.stopPropagation(); onViewProfile?.(post.userId); }} style={{ width: 38, height: 38, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
            {post.photoURL ? <img src={post.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (post.username?.[0] || '?').toUpperCase()}
          </div>
          <span onClick={e => { e.stopPropagation(); onViewProfile?.(post.userId); }} style={{ color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>@{post.username}</span>
          <button onClick={e => { e.stopPropagation(); showToast('Follow feature — open profile to follow', 'info'); }} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '4px 10px', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Follow</button>
          <button onClick={e => { e.stopPropagation(); setShowReport(true); }} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid #333', borderRadius: 20, padding: '4px 8px', color: '#ff9500', fontSize: 11, cursor: 'pointer' }}>⚠️</button>
        </div>
        {post.caption && <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, marginBottom: 4 }}>{post.caption}</p>}
        <p style={{ color: '#666', fontSize: 10 }}>{timeAgo(post.createdAt)}</p>
      </div>

      {/* Right actions */}
      <div style={{ position: 'absolute', right: 10, bottom: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, zIndex: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <button onClick={e => { e.stopPropagation(); toggleLike(); }} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 22, cursor: 'pointer' }}>{liked ? '❤️' : '🤍'}</button>
          <span style={{ color: '#fff', fontSize: 11 }}>{formatNumber(likeCount)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <button onClick={e => { e.stopPropagation(); setShowComments(true); }} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 22, cursor: 'pointer' }}>💬</button>
          <span style={{ color: '#fff', fontSize: 11 }}>{formatNumber(comments.length || post.commentCount || 0)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <button onClick={e => { e.stopPropagation(); setShowShareMenu(true); }} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 20, cursor: 'pointer' }}>↗️</button>
          <span style={{ color: '#fff', fontSize: 11 }}>{formatNumber(post.shares || 0)}</span>
        </div>
        <button onClick={e => { e.stopPropagation(); onLivePress?.(post); }} style={{ background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 18, cursor: 'pointer' }}>🔴</button>
      </div>

      {/* Share menu */}
      {showShareMenu && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 5000, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowShareMenu(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#1a1a1a', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 }}>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>Share to</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
              {[
                { icon: '🔗', label: 'Copy', platform: 'copy' },
                { icon: '💬', label: 'WhatsApp', platform: 'whatsapp' },
                { icon: '✉️', label: 'Telegram', platform: 'telegram' },
                { icon: '🐦', label: 'Twitter', platform: 'twitter' },
                { icon: '📘', label: 'Facebook', platform: 'facebook' },
              ].map(opt => (
                <button key={opt.label} onClick={() => handleShare(opt.platform)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: '#2a2a2a', border: 'none', borderRadius: 16, padding: '12px 6px', cursor: 'pointer' }}>
                  <span style={{ fontSize: 28 }}>{opt.icon}</span>
                  <span style={{ color: '#ccc', fontSize: 10 }}>{opt.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowShareMenu(false)} style={{ width: '100%', background: '#2a2a2a', border: 'none', borderRadius: 20, padding: 14, color: '#fff', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Comments panel */}
      {showComments && (
        <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', zIndex: 50, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700 }}>💬 Comments ({comments.length})</span>
            <button onClick={() => setShowComments(false)} style={{ background: '#1a1a1a', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {comments.length === 0 && <p style={{ color: '#444', textAlign: 'center', marginTop: 40 }}>No comments yet. Be first!</p>}
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, overflow: 'hidden', flexShrink: 0 }}>
                  {c.photoURL ? <img src={c.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : c.username?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, background: '#161616', borderRadius: 14, padding: '8px 12px' }}>
                  <div style={{ color: '#ff2d55', fontWeight: 600, fontSize: 11, marginBottom: 3 }}>@{c.username}</div>
                  <p style={{ color: '#ddd', fontSize: 13 }}>{c.text}</p>
                  <p style={{ color: '#555', fontSize: 10, marginTop: 4 }}>{timeAgo(c.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 12px', borderTop: '1px solid #1e1e1e' }}>
            {showEmojiPicker && (
              <div style={{ background: '#161616', borderRadius: 16, padding: 10, marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {EMOJIS.map(e => <button key={e} onClick={() => setCommentText(prev => prev + e)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>{e}</button>)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: '#1a1a1a', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 18, cursor: 'pointer' }}>😊</button>
              <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} placeholder="Add comment..." style={{ flex: 1, background: '#161616', border: '1px solid #222', borderRadius: 20, padding: '9px 14px', color: '#fff', outline: 'none', fontSize: 13 }} />
              <button onClick={addComment} style={{ background: commentText.trim() ? '#ff2d55' : '#2a2a2a', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', cursor: 'pointer' }}>↑</button>
            </div>
          </div>
        </div>
      )}

      {showReport && <ReportModal targetId={post.userId} targetType="post" targetName={post.username} reportedBy={currentUser?.uid} onClose={() => setShowReport(false)} showToast={showToast} />}
    </div>
  );
});

// ─── HOME FEED ───────────────────────────────────────────────────────────────

const HomeFeed = ({ posts, currentUser, onViewProfile, showToast, followed, onLivePress, tabFilter }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState(tabFilter || 'foryou');
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const startY = useRef(null);

  // Reset index when tab changes
  useEffect(() => { setCurrentIndex(0); }, [activeTab]);

  const filteredPosts = useMemo(() => {
    let result = [...posts];
    if (activeTab === 'friends') result = result.filter(p => followed.includes(p.userId));
    if (activeTab === 'learn') result = result.filter(p => p.category === 'education' || p.caption?.toLowerCase().includes('learn') || p.caption?.toLowerCase().includes('tip'));
    if (activeTab === 'jobs') result = result.filter(p => p.caption?.toLowerCase().includes('job') || p.caption?.toLowerCase().includes('hiring') || p.caption?.toLowerCase().includes('work'));
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(p => p.username?.toLowerCase().includes(q) || p.caption?.toLowerCase().includes(q));
    }
    return result;
  }, [posts, activeTab, followed, searchText]);

  const tabs = [
    { id: 'foryou', label: '🔥 For You' },
    { id: 'friends', label: '👥 Friends' },
    { id: 'learn', label: '📚 Learn' },
    { id: 'jobs', label: '💼 Jobs' },
  ];

  const handleTouchStart = e => { startY.current = e.touches[0].clientY; };
  const handleTouchEnd = e => {
    if (startY.current === null) return;
    const dy = startY.current - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 50) {
      if (dy > 0) setCurrentIndex(i => Math.min(filteredPosts.length - 1, i + 1));
      else setCurrentIndex(i => Math.max(0, i - 1));
    }
    startY.current = null;
  };

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 15, background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)', paddingTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 8px' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', flex: 1 }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ background: activeTab === tab.id ? '#ff2d55' : 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 30, padding: '6px 12px', color: '#fff', fontSize: 11, fontWeight: activeTab === tab.id ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
            <button onClick={() => setShowSearch(!showSearch)} style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', fontSize: 15, cursor: 'pointer' }}>🔍</button>
            <button onClick={() => showToast('🔔 No new notifications', 'info')} style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', fontSize: 15, cursor: 'pointer' }}>🔔</button>
          </div>
        </div>
        {showSearch && (
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.7)', borderRadius: 24, padding: '8px 14px', gap: 8, border: '1px solid #333' }}>
              <span style={{ color: '#888' }}>🔍</span>
              <input autoFocus value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search posts..." style={{ flex: 1, background: 'none', border: 'none', color: '#fff', outline: 'none', fontSize: 13 }} />
              {searchText && <button onClick={() => setSearchText('')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>✕</button>}
            </div>
          </div>
        )}
      </div>

      {/* Posts */}
      {filteredPosts.length === 0 ? (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 48 }}>📭</div>
          <div style={{ color: '#555', textAlign: 'center', fontSize: 14 }}>
            {activeTab === 'friends' ? 'Follow people to see their posts here' : 'No posts yet'}
          </div>
        </div>
      ) : (
        filteredPosts.map((post, idx) => (
          <div key={post.id} style={{ position: 'absolute', inset: 0, transform: `translateY(${(idx - currentIndex) * 100}%)`, transition: 'transform 0.3s ease-out', pointerEvents: idx === currentIndex ? 'auto' : 'none' }}>
            <PostCard post={post} currentUser={currentUser} onViewProfile={onViewProfile} showToast={showToast} onLivePress={onLivePress} />
          </div>
        ))
      )}

      {/* Page indicator */}
      {filteredPosts.length > 1 && (
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, zIndex: 10, pointerEvents: 'none' }}>
          {filteredPosts.slice(Math.max(0, currentIndex - 2), currentIndex + 3).map((_, i) => {
            const actual = i + Math.max(0, currentIndex - 2);
            return <div key={actual} style={{ width: actual === currentIndex ? 20 : 5, height: 4, borderRadius: 2, background: actual === currentIndex ? '#ff2d55' : 'rgba(255,255,255,0.3)', transition: 'all 0.2s' }} />;
          })}
        </div>
      )}
    </div>
  );
};

// ─── USER PROFILE PAGE ───────────────────────────────────────────────────────

const UserProfilePage = ({ userId, currentUser, onBack, onMessage, showToast }) => {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const isOwn = userId === currentUser?.uid;

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const fetchProfile = async () => {
      try {
        // FIX: direct getDoc by uid (document ID = uid)
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setProfile({ id: userSnap.id, ...data });
          setIsFollowing((data.followers || []).includes(currentUser?.uid));
          setFollowerCount((data.followers || []).length);
          setFollowingCount((data.following || []).length);
          setEditBio(data.bio || '');
          setEditUsername(data.username || '');
        }
        // FIX: query posts by userId field
        const postsSnap = await getDocs(query(collection(db, 'posts'), where('userId', '==', userId), orderBy('createdAt', 'desc')));
        setPosts(postsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchProfile();
  }, [userId, currentUser]);

  const toggleFollow = async () => {
    if (!currentUser?.uid) return;
    const prev = isFollowing;
    setIsFollowing(!prev); setFollowerCount(c => prev ? c - 1 : c + 1);
    try {
      await updateDoc(doc(db, 'users', userId), { followers: prev ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) });
      await updateDoc(doc(db, 'users', currentUser.uid), { following: prev ? arrayRemove(userId) : arrayUnion(userId) });
    } catch { setIsFollowing(prev); setFollowerCount(c => prev ? c + 1 : c - 1); }
  };

  const updateProfilePhoto = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const storageRef2 = ref(storage, `avatars/${userId}_${Date.now()}`);
      const task = uploadBytesResumable(storageRef2, file);
      task.on('state_changed', null, () => showToast('Upload failed', 'error'), async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await updateDoc(doc(db, 'users', userId), { photoURL: url });
        setProfile(prev => ({ ...prev, photoURL: url }));
        showToast('Photo updated! 📸', 'success');
      });
    } catch { showToast('Upload failed', 'error'); }
  };

  const saveProfile = async () => {
    if (!editUsername.trim()) { showToast('Username required', 'error'); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', userId), { bio: editBio.trim(), username: editUsername.toLowerCase().trim() });
      setProfile(prev => ({ ...prev, bio: editBio, username: editUsername.toLowerCase() }));
      showToast('Profile updated! ✓', 'success');
      setShowEditProfile(false);
    } catch { showToast('Failed to save', 'error'); }
    setSaving(false);
  };

  if (loading) return <div style={{ height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>Loading profile...</div>;
  if (!profile) return <div style={{ height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>User not found</div>;

  if (showEditProfile) {
    return (
      <div style={{ height: '100%', overflowY: 'auto', background: '#0a0a0a' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10 }}>
          <button onClick={() => setShowEditProfile(false)} style={{ background: 'none', border: 'none', color: '#ff2d55', fontSize: 22, cursor: 'pointer' }}>←</button>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, flex: 1 }}>Edit Profile</h2>
          <button onClick={saveProfile} disabled={saving} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 20px', color: '#fff', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#ff2d55', margin: '0 auto 12px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
              {profile.photoURL ? <img src={profile.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: '#fff' }}>{profile.username?.[0]?.toUpperCase()}</div>}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={updateProfilePhoto} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 20, padding: '6px 16px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Change Photo</button>
          </div>
          <label style={{ color: '#888', fontSize: 12, marginBottom: 6, display: 'block' }}>Username</label>
          <input value={editUsername} onChange={e => setEditUsername(e.target.value)} style={{ width: '100%', background: '#141414', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 16, outline: 'none', fontSize: 14 }} />
          <label style={{ color: '#888', fontSize: 12, marginBottom: 6, display: 'block' }}>Bio</label>
          <textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Tell something about yourself" maxLength={150} rows={3} style={{ width: '100%', background: '#141414', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', resize: 'none', outline: 'none', fontSize: 14 }} />
          <div style={{ color: '#555', fontSize: 10, textAlign: 'right', marginTop: 4 }}>{editBio.length}/150</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0a0a0a' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 0', position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10 }}>
        <button onClick={onBack} style={{ background: '#1a1a1a', border: 'none', borderRadius: 20, padding: '8px 14px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>← Back</button>
        <div style={{ display: 'flex', gap: 8 }}>
          {isOwn && <button onClick={() => setShowEditProfile(true)} style={{ background: '#1a1a1a', border: 'none', borderRadius: 20, padding: '8px 14px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>✏️ Edit</button>}
          {!isOwn && <button onClick={() => setShowReport(true)} style={{ background: '#1a1a1a', border: 'none', borderRadius: 20, padding: '8px 14px', color: '#ff9500', cursor: 'pointer', fontSize: 13 }}>⚠️ Report</button>}
        </div>
      </div>

      {/* Profile info */}
      <div style={{ textAlign: 'center', padding: '20px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#ff2d55', margin: '0 auto 12px', overflow: 'hidden', border: '3px solid #ff2d55' }}>
          {profile.photoURL ? <img src={profile.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: '#fff' }}>{profile.username?.[0]?.toUpperCase()}</div>}
        </div>
        <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>@{profile.username}</h2>
        <p style={{ color: '#888', fontSize: 13, marginTop: 4, marginBottom: 16 }}>{profile.bio || 'Dagu Creator 🎬'}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 20 }}>
          {[['Posts', posts.length], ['Followers', followerCount], ['Following', followingCount]].map(([label, val]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{val}</div>
              <div style={{ color: '#666', fontSize: 11 }}>{label}</div>
            </div>
          ))}
        </div>
        {!isOwn && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={toggleFollow} style={{ background: isFollowing ? '#1a1a1a' : '#ff2d55', border: isFollowing ? '1px solid #333' : 'none', borderRadius: 24, padding: '10px 24px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              {isFollowing ? '✓ Following' : '+ Follow'}
            </button>
            <button onClick={() => { onMessage?.(userId); onBack(); }} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 24, padding: '10px 20px', color: '#fff', cursor: 'pointer', fontSize: 14 }}>💬 Message</button>
          </div>
        )}
      </div>

      {/* Posts grid */}
      <div style={{ padding: 12 }}>
        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#444' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎬</div>
            <p style={{ fontSize: 13 }}>No posts yet</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
            {posts.map(post => (
              <div key={post.id} style={{ aspectRatio: '9/16', background: '#111', borderRadius: 6, overflow: 'hidden' }}>
                {post.type === 'video' && <video src={post.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />}
                {post.type === 'photo' && <img src={post.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                {post.type === 'text' && <div style={{ background: 'linear-gradient(135deg,#1a0020,#000)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}><p style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{post.text?.substring(0, 40)}</p></div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {showReport && <ReportModal targetId={userId} targetType="user" targetName={profile.username} reportedBy={currentUser?.uid} onClose={() => setShowReport(false)} showToast={showToast} />}
    </div>
  );
};

// ─── INBOX PAGE ──────────────────────────────────────────────────────────────

const InboxPage = ({ currentUser, showToast, onViewProfile, initialChatUserId }) => {
  const [users, setUsers] = useState([]);
  const [activeChat, setActiveChat] = useState(initialChatUserId || null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);

  // FIX: open chat from initialChatUserId (passed from "Message" button)
  useEffect(() => { if (initialChatUserId) setActiveChat(initialChatUserId); }, [initialChatUserId]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.uid !== currentUser?.uid));
    });
    return unsub;
  }, [currentUser]);

  useEffect(() => {
    if (!activeChat || !currentUser?.uid) return;
    const convoId = [currentUser.uid, activeChat].sort().join('_');
    const unsub = onSnapshot(
      query(collection(db, 'messages', convoId, 'msgs'), orderBy('createdAt')),
      snap => {
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMessages(msgs);
        // Mark as seen
        msgs.forEach(async msg => {
          if (msg.from !== currentUser.uid && !msg.seen) {
            try { await updateDoc(doc(db, 'messages', convoId, 'msgs', msg.id), { seen: true }); } catch {}
          }
        });
      }
    );
    return unsub;
  }, [activeChat, currentUser]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    if (!text.trim() || !activeChat) return;
    const convoId = [currentUser.uid, activeChat].sort().join('_');
    const msg = text.trim();
    setText(''); setShowEmojiPicker(false);
    try {
      await addDoc(collection(db, 'messages', convoId, 'msgs'), {
        text: msg, from: currentUser.uid, sent: true, delivered: true, seen: false,
        createdAt: serverTimestamp()
      });
    } catch { showToast('Failed to send', 'error'); }
  };

  const otherUser = users.find(u => u.uid === activeChat);

  if (activeChat && otherUser) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setActiveChat(null)} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '7px 12px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>←</button>
          <div onClick={() => onViewProfile?.(otherUser.uid)} style={{ width: 38, height: 38, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, overflow: 'hidden', cursor: 'pointer', flexShrink: 0 }}>
            {otherUser.photoURL ? <img src={otherUser.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : otherUser.username?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>@{otherUser.username}</div>
            <div style={{ color: '#555', fontSize: 11 }}>Tap name to view profile</div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.length === 0 && <p style={{ textAlign: 'center', color: '#444', marginTop: 40, fontSize: 13 }}>Say hello to @{otherUser.username}!</p>}
          {messages.map(msg => {
            const isMe = msg.from === currentUser?.uid;
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '75%' }}>
                  <div style={{ background: isMe ? '#ff2d55' : '#1a1a1a', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px' }}>
                    <div style={{ color: '#fff', fontSize: 13 }}>{msg.text}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: 4, marginTop: 3 }}>
                    <span style={{ color: '#555', fontSize: 9 }}>{msg.createdAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMe && <span style={{ color: msg.seen ? '#06d6a0' : '#666', fontSize: 9 }}>{msg.seen ? '✓✓' : '✓'}</span>}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        <div style={{ padding: '10px 12px', borderTop: '1px solid #1a1a1a' }}>
          {showEmojiPicker && (
            <div style={{ background: '#161616', borderRadius: 16, padding: 10, marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EMOJIS.map(e => <button key={e} onClick={() => setText(prev => prev + e)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>{e}</button>)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: '#1a1a1a', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 18, cursor: 'pointer' }}>😊</button>
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Message..." style={{ flex: 1, background: '#161616', border: '1px solid #222', borderRadius: 22, padding: '9px 14px', color: '#fff', outline: 'none', fontSize: 13 }} />
            <button onClick={sendMessage} style={{ background: text.trim() ? '#ff2d55' : '#2a2a2a', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', cursor: 'pointer', fontSize: 16 }}>↑</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 16, borderBottom: '1px solid #1a1a1a' }}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>💬 Messages</h2>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {users.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#444', fontSize: 13 }}>No other users yet</div>}
        {users.map(u => (
          <div key={u.id} onClick={() => setActiveChat(u.uid)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid #111', cursor: 'pointer' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 20, overflow: 'hidden', flexShrink: 0 }}>
              {u.photoURL ? <img src={u.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.username?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>@{u.username}</div>
              <div style={{ color: '#555', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.bio || 'Tap to message'}</div>
            </div>
            <div style={{ color: '#ff2d55', fontSize: 18 }}>›</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── MY PROFILE ──────────────────────────────────────────────────────────────

const MyProfile = ({ currentUser, showToast, onLogout, onOpenSettings }) => {
  const [posts, setPosts] = useState([]);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editBio, setEditBio] = useState(currentUser?.bio || '');
  const [editUsername, setEditUsername] = useState(currentUser?.username || '');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = onSnapshot(
      query(collection(db, 'posts'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc')),
      snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [currentUser]);

  const updateProfilePhoto = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const storageRef2 = ref(storage, `avatars/${currentUser.uid}_${Date.now()}`);
      const task = uploadBytesResumable(storageRef2, file);
      task.on('state_changed', null, () => showToast('Upload failed', 'error'), async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: url });
        showToast('Photo updated! 📸', 'success');
      });
    } catch { showToast('Upload failed', 'error'); }
  };

  const saveProfile = async () => {
    if (!editUsername.trim()) { showToast('Username required', 'error'); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { bio: editBio.trim(), username: editUsername.toLowerCase().trim() });
      showToast('Profile updated! ✓', 'success');
      setShowEditProfile(false);
    } catch { showToast('Failed to save', 'error'); }
    setSaving(false);
  };

  if (showEditProfile) {
    return (
      <div style={{ height: '100%', overflowY: 'auto', background: '#0a0a0a' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10 }}>
          <button onClick={() => setShowEditProfile(false)} style={{ background: 'none', border: 'none', color: '#ff2d55', fontSize: 22, cursor: 'pointer' }}>←</button>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, flex: 1 }}>Edit Profile</h2>
          <button onClick={saveProfile} disabled={saving} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 20px', color: '#fff', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#ff2d55', margin: '0 auto 12px', overflow: 'hidden', position: 'relative', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
              {currentUser?.photoURL ? <img src={currentUser.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: '#fff' }}>{currentUser?.username?.[0]?.toUpperCase()}</div>}
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📷</div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={updateProfilePhoto} style={{ display: 'none' }} />
          </div>
          <label style={{ color: '#888', fontSize: 12, marginBottom: 6, display: 'block' }}>Username</label>
          <input value={editUsername} onChange={e => setEditUsername(e.target.value)} style={{ width: '100%', background: '#141414', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 16, outline: 'none', fontSize: 14 }} />
          <label style={{ color: '#888', fontSize: 12, marginBottom: 6, display: 'block' }}>Bio</label>
          <textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Tell something about yourself" maxLength={150} rows={3} style={{ width: '100%', background: '#141414', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', resize: 'none', outline: 'none', fontSize: 14 }} />
          <div style={{ color: '#555', fontSize: 10, textAlign: 'right', marginTop: 4 }}>{editBio.length}/150</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0a0a0a' }}>
      <div style={{ padding: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onOpenSettings} style={{ background: '#1a1a1a', border: 'none', borderRadius: 20, padding: '8px 14px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>⚙️ Settings</button>
        <button onClick={onLogout} style={{ background: 'rgba(255,45,85,0.1)', border: '1px solid rgba(255,45,85,0.3)', borderRadius: 20, padding: '8px 14px', color: '#ff2d55', cursor: 'pointer', fontSize: 13 }}>🚪 Logout</button>
      </div>

      <div style={{ textAlign: 'center', padding: '20px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', padding: 2, margin: '0 auto 12px' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, color: '#fff', overflow: 'hidden' }}>
            {currentUser?.photoURL ? <img src={currentUser.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : currentUser?.username?.[0]?.toUpperCase()}
          </div>
        </div>
        <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>@{currentUser?.username}</h2>
        <p style={{ color: '#888', fontSize: 13, marginTop: 4, marginBottom: 16 }}>{currentUser?.bio || 'Dagu Creator 🎬'}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 20 }}>
          {[['Posts', posts.length], ['Followers', currentUser?.followers?.length || 0], ['Following', currentUser?.following?.length || 0]].map(([label, val]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{val}</div>
              <div style={{ color: '#666', fontSize: 11 }}>{label}</div>
            </div>
          ))}
        </div>
        <button onClick={() => setShowEditProfile(true)} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 20, padding: '9px 24px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>✏️ Edit Profile</button>
      </div>

      <div style={{ padding: 12 }}>
        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#444' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎬</div>
            <p style={{ fontSize: 13 }}>No posts yet — create your first!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
            {posts.map(post => (
              <div key={post.id} style={{ aspectRatio: '9/16', background: '#111', borderRadius: 6, overflow: 'hidden' }}>
                {post.type === 'video' && <video src={post.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />}
                {post.type === 'photo' && <img src={post.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                {post.type === 'text' && <div style={{ background: 'linear-gradient(135deg,#1a0020,#000)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}><p style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{post.text?.substring(0, 40)}</p></div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── SETTINGS PAGE ───────────────────────────────────────────────────────────

const SettingsPage = ({ currentUser, onClose, showToast, onLogout }) => (
  <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 300, overflowY: 'auto' }}>
    <div style={{ padding: 16, borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, background: '#0a0a0a' }}>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ff2d55', fontSize: 22, cursor: 'pointer' }}>←</button>
      <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Settings</h2>
    </div>
    {[
      { icon: '🔒', label: 'Privacy', fn: () => showToast('Privacy settings coming soon', 'info') },
      { icon: '🔔', label: 'Notifications', fn: () => showToast('Notification settings coming soon', 'info') },
      { icon: '💰', label: 'Wallet', fn: () => showToast(`Wallet: ${currentUser?.coins || 0} coins`, 'info') },
      { icon: '❓', label: 'Help & Support', fn: () => showToast('support@dagu.com', 'info') },
      { icon: '📜', label: 'Terms & Privacy', fn: () => showToast('Terms and conditions', 'info') },
    ].map(item => (
      <button key={item.label} onClick={item.fn} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '16px 20px', background: 'none', border: 'none', borderBottom: '1px solid #111', cursor: 'pointer' }}>
        <span style={{ fontSize: 22 }}>{item.icon}</span>
        <span style={{ color: '#fff', fontSize: 15, flex: 1, textAlign: 'left' }}>{item.label}</span>
        <span style={{ color: '#333', fontSize: 18 }}>›</span>
      </button>
    ))}
    <div style={{ padding: '20px 16px' }}>
      <button onClick={onLogout} style={{ width: '100%', background: 'rgba(255,45,85,0.1)', border: '1px solid rgba(255,45,85,0.3)', borderRadius: 16, padding: 14, color: '#ff2d55', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>🚪 Log Out</button>
    </div>
  </div>
);

// ─── MAIN APP ────────────────────────────────────────────────────────────────

export default function DaguApp() {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = loading
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [followed, setFollowed] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [messageUserId, setMessageUserId] = useState(null);

  const showToast = useCallback((message, type = 'info') => setToast({ message, type }), []);

  // FIX: auth listener — use getDoc(uid) for reliable user data fetch
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        try {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            setCurrentUser({ ...data, uid: user.uid, id: userSnap.id });
            setFollowed(data.following || []);
          } else {
            // User authenticated but no Firestore doc — rare edge case
            // Create a basic doc so they can use the app
            const basicProfile = {
              uid: user.uid,
              username: user.displayName?.toLowerCase().replace(/\s+/g, '_') || `user_${user.uid.substring(0, 6)}`,
              email: user.email || '',
              bio: 'Dagu Creator 🎬',
              followers: [],
              following: [],
              photoURL: user.photoURL || '',
              coins: 500,
              createdAt: serverTimestamp(),
            };
            await setDoc(doc(db, 'users', user.uid), basicProfile);
            setCurrentUser({ ...basicProfile, id: user.uid });
          }
        } catch (e) {
          console.error('Error loading user profile:', e);
          showToast('Error loading profile. Please refresh.', 'error');
        }
      } else {
        setFirebaseUser(null);
        setCurrentUser(null);
        setFollowed([]);
      }
    });
  }, [showToast]);

  // Load posts
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'posts'), orderBy('createdAt', 'desc')),
      snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('Posts listener error:', err)
    );
    return unsub;
  }, []);

  // Load stories
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'stories'), orderBy('createdAt', 'desc')),
      snap => setStories(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('Stories listener error:', err)
    );
    return unsub;
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    showToast('Logged out', 'info');
    setActiveTab('home');
    setViewingProfile(null);
  };

  const handleNavigateToMessage = (uid) => {
    setMessageUserId(uid);
    setActiveTab('inbox');
    setViewingProfile(null);
  };

  // Loading splash
  if (firebaseUser === undefined) {
    return (
      <div style={{ height: '100dvh', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ fontSize: 64 }}>🎬</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, background: 'linear-gradient(135deg,#ff2d55,#af52de)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Dagu</h1>
        <div style={{ width: 40, height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: '100%', height: '100%', background: '#ff2d55', borderRadius: 2, animation: 'loading 1s ease-in-out infinite' }} />
        </div>
        <style>{`@keyframes loading{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
      </div>
    );
  }

  // Not logged in — show auth screen
  if (!firebaseUser) {
    return (
      <>
        <AuthScreen showToast={showToast} />
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </>
    );
  }

  // Logged in but user doc still loading
  if (!currentUser) {
    return (
      <div style={{ height: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 14 }}>
        Loading your profile...
      </div>
    );
  }

  const bottomTabs = [
    { id: 'home',    icon: '🏠', label: 'Home' },
    { id: 'friends', icon: '👥', label: 'Friends' },
    { id: 'create',  icon: '➕', label: 'Create' },
    { id: 'inbox',   icon: '💬', label: 'Messages' },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ];

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
        button:active { transform: scale(0.95); transition: transform 0.05s; }
      `}</style>

      {/* Modals */}
      {showCreatePost && <CreatePostModal currentUser={currentUser} onClose={() => setShowCreatePost(false)} showToast={showToast} />}
      {showSettings && <SettingsPage currentUser={currentUser} onClose={() => setShowSettings(false)} showToast={showToast} onLogout={handleLogout} />}

      {/* Profile overlay */}
      {viewingProfile && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: '#0a0a0a' }}>
          <UserProfilePage
            userId={viewingProfile}
            currentUser={currentUser}
            onBack={() => setViewingProfile(null)}
            onMessage={handleNavigateToMessage}
            showToast={showToast}
          />
        </div>
      )}

      {/* Main content area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>

        {/* HOME tab — Stories + feed */}
        {activeTab === 'home' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stories currentUser={currentUser} stories={stories} onStoryPosted={() => {}} showToast={showToast} />
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              <HomeFeed posts={posts} currentUser={currentUser} onViewProfile={setViewingProfile} showToast={showToast} followed={followed} tabFilter="foryou" onLivePress={post => showToast(`Joining ${post.username}'s live... 🔴`, 'info')} />
            </div>
          </div>
        )}

        {/* FRIENDS tab */}
        {activeTab === 'friends' && (
          <HomeFeed posts={posts} currentUser={currentUser} onViewProfile={setViewingProfile} showToast={showToast} followed={followed} tabFilter="friends" onLivePress={post => showToast(`Joining live... 🔴`, 'info')} />
        )}

        {/* INBOX tab — FIX: only mount when active, pass messageUserId */}
        {activeTab === 'inbox' && (
          <InboxPage
            currentUser={currentUser}
            showToast={showToast}
            onViewProfile={setViewingProfile}
            initialChatUserId={messageUserId}
          />
        )}

        {/* PROFILE tab */}
        {activeTab === 'profile' && (
          <MyProfile
            currentUser={currentUser}
            showToast={showToast}
            onLogout={handleLogout}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}
      </div>

      {/* Bottom nav — FIX: "Create" opens modal, doesn't replace feed */}
      <div style={{ display: 'flex', background: 'rgba(8,8,8,0.97)', borderTop: '1px solid #161616', padding: '8px 4px 18px', flexShrink: 0, backdropFilter: 'blur(12px)' }}>
        {bottomTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id === 'create') {
                setShowCreatePost(true); // FIX: open modal, keep current tab
              } else {
                setActiveTab(tab.id);
                if (tab.id === 'inbox') setMessageUserId(null); // clear message target when navigating manually
              }
            }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
          >
            <span style={{ fontSize: tab.id === 'create' ? 28 : 22, transform: (activeTab === tab.id && tab.id !== 'create') ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.15s' }}>{tab.icon}</span>
            <span style={{ fontSize: 10, color: (activeTab === tab.id && tab.id !== 'create') ? '#ff2d55' : '#444', fontWeight: (activeTab === tab.id && tab.id !== 'create') ? 700 : 400 }}>{tab.label}</span>
          </button>
        ))}
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}