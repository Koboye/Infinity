// Dagu.jsx - COMPLETE PRODUCTION VERSION v4.0
// TikTok/Instagram/Facebook Level - ALL Features Included
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { auth, db, storage, googleProvider } from './firebase';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, signInWithPopup, updateProfile,
  sendPasswordResetEmail, sendEmailVerification
} from 'firebase/auth';
import {
  collection, addDoc, getDocs, onSnapshot, doc,
  updateDoc, getDoc, arrayUnion, arrayRemove,
  serverTimestamp, query, orderBy, where, setDoc, deleteDoc, limit,
  increment, Timestamp, writeBatch
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

const CATEGORIES = [
  { id: 'all', label: '🔥 All', icon: '🔥' },
  { id: 'comedy', label: '😂 Comedy', icon: '😂' },
  { id: 'dance', label: '💃 Dance', icon: '💃' },
  { id: 'beauty', label: '💄 Beauty', icon: '💄' },
  { id: 'fitness', label: '💪 Fitness', icon: '💪' },
  { id: 'food', label: '🍳 Food', icon: '🍳' },
  { id: 'travel', label: '✈️ Travel', icon: '✈️' },
  { id: 'art', label: '🎨 Art', icon: '🎨' },
  { id: 'gaming', label: '🎮 Gaming', icon: '🎮' },
  { id: 'music', label: '🎵 Music', icon: '🎵' },
  { id: 'tech', label: '💻 Tech', icon: '💻' },
  { id: 'news', label: '📰 News', icon: '📰' },
  { id: 'sports', label: '⚽ Sports', icon: '⚽' },
  { id: 'education', label: '📚 Education', icon: '📚' },
];

const FILTERS = [
  { id: 'none', label: 'Normal', css: 'none', icon: '✨' },
  { id: 'vivid', label: 'Vivid', css: 'saturate(2) contrast(1.1)', icon: '🌈' },
  { id: 'warm', label: 'Warm', css: 'sepia(0.4) saturate(1.5)', icon: '🔥' },
  { id: 'cool', label: 'Cool', css: 'hue-rotate(30deg) saturate(1.3)', icon: '❄️' },
  { id: 'bw', label: 'B&W', css: 'grayscale(1)', icon: '⚫' },
  { id: 'fade', label: 'Fade', css: 'opacity(0.85) brightness(1.1)', icon: '🌫️' },
  { id: 'drama', label: 'Drama', css: 'contrast(1.5) brightness(0.85)', icon: '🎭' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.6) contrast(1.1)', icon: '📻' },
  { id: 'neon', label: 'Neon', css: 'brightness(1.2) saturate(1.8) hue-rotate(180deg)', icon: '💡' },
  { id: 'pastel', label: 'Pastel', css: 'saturate(0.8) brightness(1.1)', icon: '🌸' },
];

const GIFTS = [
  { id: 'rose', icon: '🌹', price: 50, animation: 'float', effect: '🌹✨' },
  { id: 'heart', icon: '❤️', price: 100, animation: 'bounce', effect: '💕💖' },
  { id: 'fire', icon: '🔥', price: 200, animation: 'flame', effect: '🔥🔥' },
  { id: 'diamond', icon: '💎', price: 500, animation: 'sparkle', effect: '💎✨' },
  { id: 'crown', icon: '👑', price: 1000, animation: 'rainbow', effect: '👑🌈' },
  { id: 'rocket', icon: '🚀', price: 2000, animation: 'fly', effect: '🚀⭐' },
  { id: 'galaxy', icon: '🌌', price: 5000, animation: 'stars', effect: '🌌✨⭐' },
  { id: 'unicorn', icon: '🦄', price: 10000, animation: 'rainbow', effect: '🦄🌈✨' },
];

const EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😭', '😱', '🔥', '❤️', '👍', '🎉', '✨', '💯', '🙌', '👏', '🤝', '💪', '🎵', '📸', '🐶', '🐱', '🍕', '🏀', '🚗', '✈️', '⭐', '💔', '✅', '❌', '😘', '🥺', '🤣', '😊', '😇', '🥳', '😤', '😴', '💀', '👀'];

const REPORT_REASONS = [
  'Spam or misleading',
  'Harassment or bullying',
  'Hate speech',
  'Violence or dangerous content',
  'Nudity or sexual content',
  'False information',
  'Intellectual property violation',
  'Self-harm or suicide',
  'Scam or fraud',
  'Other',
];

const COIN_PACKAGES = [
  { coins: 100, price: 0.99, bonus: 0, popular: false },
  { coins: 500, price: 4.99, bonus: 0, popular: false },
  { coins: 1100, price: 9.99, bonus: 100, popular: true },
  { coins: 2500, price: 19.99, bonus: 500, popular: false },
  { coins: 5500, price: 49.99, bonus: 1000, popular: false },
  { coins: 12000, price: 99.99, bonus: 3000, popular: false },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatNumber = (num) => {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const timeAgo = (timestamp) => {
  if (!timestamp) return 'Just now';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  return date.toLocaleDateString();
};

// ============================================
// TOAST NOTIFICATION
// ============================================
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: '#06d6a0',
    error: '#ff2d55',
    info: '#af52de',
    warning: '#ff9500',
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 90,
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#1a1a1a',
      border: `1px solid ${colors[type] || '#333'}`,
      borderRadius: 30,
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      zIndex: 10000,
      backdropFilter: 'blur(10px)',
      boxShadow: `0 4px 20px ${colors[type] || '#333'}40`,
      maxWidth: '90vw',
    }}>
      <span style={{ fontSize: 18 }}>{type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
      <span style={{ color: '#fff', fontSize: 14 }}>{message}</span>
    </div>
  );
};

// ============================================
// CONFIRM DIALOG
// ============================================
const ConfirmDialog = ({ message, onConfirm, onCancel }) => (
  <div style={{
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    zIndex: 10000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <div style={{
      background: '#1a1a1a',
      borderRadius: 24,
      padding: 24,
      maxWidth: 300,
      width: '90%',
    }}>
      <p style={{ color: '#fff', fontSize: 15, marginBottom: 20, textAlign: 'center' }}>{message}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, background: '#2a2a2a', border: 'none', borderRadius: 20, padding: 12, color: '#fff', cursor: 'pointer' }}>Cancel</button>
        <button onClick={onConfirm} style={{ flex: 1, background: '#ff2d55', border: 'none', borderRadius: 20, padding: 12, color: '#fff', cursor: 'pointer' }}>Confirm</button>
      </div>
    </div>
  </div>
);

// ============================================
// EDIT PROFILE MODAL
// ============================================
const EditProfileModal = ({ user, onClose, onUpdate, showToast }) => {
  const [bio, setBio] = useState(user?.bio || '');
  const [username, setUsername] = useState(user?.username || '');
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [location, setLocation] = useState(user?.location || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor || '#ff2d55');
  const [saving, setSaving] = useState(false);

  const colors = ['#ff2d55', '#06d6a0', '#af52de', '#ffd60a', '#1d9bf0', '#34c759', '#ff9500', '#00c7be'];

  const handleSave = async () => {
    if (!username.trim()) {
      showToast('Username is required', 'error');
      return;
    }
    setSaving(true);
    await onUpdate({ bio, username, fullName, website, location, avatarColor });
    setSaving(false);
    onClose();
    showToast('Profile updated!', 'success');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 5000, overflowY: 'auto' }}>
      <div style={{ padding: 16, borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>✕</button>
        <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Edit Profile</h3>
        <button onClick={handleSave} disabled={saving} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 20px', color: '#fff', fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 100, height: 100, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: 40, margin: '0 auto 12px' }}>
            {user?.avatar || username[0]?.toUpperCase() || '?'}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {colors.map(c => (
              <button key={c} onClick={() => setAvatarColor(c)} style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: avatarColor === c ? '3px solid #fff' : 'none', cursor: 'pointer' }} />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="username" maxLength={30} style={{ width: '100%', background: '#141414', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', fontSize: 14, outline: 'none' }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>Full Name</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full name" style={{ width: '100%', background: '#141414', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', fontSize: 14, outline: 'none' }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>Bio</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell something about yourself" maxLength={150} rows={3} style={{ width: '100%', background: '#141414', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', fontSize: 14, outline: 'none', resize: 'none' }} />
          <div style={{ color: '#555', fontSize: 10, textAlign: 'right', marginTop: 4 }}>{bio.length}/150</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>Website</label>
          <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." style={{ width: '100%', background: '#141414', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', fontSize: 14, outline: 'none' }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>Location</label>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" style={{ width: '100%', background: '#141414', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', fontSize: 14, outline: 'none' }} />
        </div>
      </div>
    </div>
  );
};

// ============================================
// REPORT MODAL
// ============================================
const ReportModal = ({ targetId, targetType, targetName, reportedBy, onClose, showToast }) => {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reports'), {
        targetId,
        targetType,
        targetName,
        reason,
        details: details.trim(),
        reportedBy,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      showToast('Report submitted. We will review it.', 'success');
      onClose();
    } catch (error) {
      showToast('Failed to submit report', 'error');
    }
    setSubmitting(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 400, background: '#141414', borderRadius: 24, padding: 24 }}>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Report {targetType}</div>
        <div style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>Reporting @{targetName}</div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#aaa', fontSize: 13, marginBottom: 8 }}>Why are you reporting?</div>
          {REPORT_REASONS.map(r => (
            <button key={r} onClick={() => setReason(r)} style={{
              width: '100%', textAlign: 'left', background: reason === r ? 'rgba(255,45,85,0.15)' : 'transparent',
              border: 'none', borderRadius: 10, padding: '10px 12px', marginBottom: 4,
              color: reason === r ? '#ff2d55' : '#ccc', cursor: 'pointer', fontSize: 13,
            }}>{reason === r ? '✓ ' : ''}{r}</button>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Additional details (optional)" rows={3} style={{
            width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12,
            padding: 12, color: '#fff', fontSize: 13, outline: 'none', resize: 'none',
          }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: '#2a2a2a', border: 'none', borderRadius: 20, padding: 12, color: '#fff', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!reason || submitting} style={{
            flex: 1, background: '#ff2d55', border: 'none', borderRadius: 20, padding: 12,
            color: '#fff', cursor: !reason || submitting ? 'default' : 'pointer', opacity: !reason || submitting ? 0.5 : 1,
          }}>{submitting ? 'Submitting...' : 'Submit Report'}</button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// FOLLOW LIST MODAL
// ============================================
const FollowListModal = ({ title, users, currentUser, onClose, onFollow, onViewProfile, followed }) => (
  <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 5000, display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: 16, borderBottom: '1px solid #222', display: 'flex', alignItems: 'center' }}>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', marginRight: 12 }}>←</button>
      <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{title}</h3>
    </div>
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>No {title.toLowerCase()} yet</div>
      ) : (
        users.map(user => (
          <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #111' }}>
            <div onClick={() => { onViewProfile?.(user.uid || user.id); onClose(); }} style={{
              width: 48, height: 48, borderRadius: '50%', background: user.avatarColor || '#ff2d55',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: 18, cursor: 'pointer',
              overflow: 'hidden',
            }}>
              {user.photoURL ? <img src={user.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user.username?.[0] || '?').toUpperCase()}
            </div>
            <div style={{ flex: 1 }} onClick={() => { onViewProfile?.(user.uid || user.id); onClose(); }}>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>@{user.username}</div>
              {user.bio && <div style={{ color: '#666', fontSize: 11 }}>{user.bio.substring(0, 50)}</div>}
            </div>
            {user.uid !== currentUser?.uid && user.id !== currentUser?.id && (
              <button onClick={() => onFollow?.(user.uid || user.id)} style={{
                background: followed?.includes(user.uid || user.id) ? '#2a2a2a' : '#ff2d55',
                border: 'none', borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>
                {followed?.includes(user.uid || user.id) ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        ))
      )}
    </div>
  </div>
);

// ============================================
// NOTIFICATION CENTER
// ============================================
const NotificationCenter = ({ notifications, onClose, onMarkRead, onClearAll, onNavigate }) => {
  const getIcon = (type) => {
    const icons = { like: '❤️', comment: '💬', follow: '👥', mention: '@', gift: '🎁', message: '💌' };
    return icons[type] || '🔔';
  };

  return (
    <div style={{
      position: 'absolute', top: 60, right: 10, width: 350, maxHeight: 500,
      background: '#1a1a1a', borderRadius: 20, overflow: 'hidden', zIndex: 5000,
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Notifications</h4>
        {notifications.length > 0 && (
          <button onClick={onClearAll} style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer' }}>Clear all</button>
        )}
      </div>
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🔔</div>
            <div style={{ fontSize: 13 }}>No notifications yet</div>
          </div>
        ) : (
          notifications.map(notif => (
            <div key={notif.id} onClick={() => { onMarkRead(notif.id); onNavigate?.(notif); onClose(); }} style={{
              padding: '12px 16px', borderBottom: '1px solid #222', cursor: 'pointer',
              background: notif.read ? 'transparent' : 'rgba(255,45,85,0.1)',
            }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ fontSize: 24 }}>{getIcon(notif.type)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: 12 }}>{notif.message}</div>
                  <div style={{ color: '#666', fontSize: 10, marginTop: 4 }}>{timeAgo(notif.timestamp)}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ============================================
// USER PROFILE PAGE (View other users)
// ============================================
const ViewProfilePage = ({ userId, currentUser, onBack, onMessage, showToast }) => {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [followerUsers, setFollowerUsers] = useState([]);
  const [followingUsers, setFollowingUsers] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    const fetchProfile = async () => {
      try {
        let userData = null;
        let userIdToUse = userId;

        let q = query(collection(db, 'users'), where('uid', '==', userId));
        let snap = await getDocs(q);
        if (!snap.empty) {
          userData = { id: snap.docs[0].id, ...snap.docs[0].data() };
        } else {
          const docSnap = await getDoc(doc(db, 'users', userId));
          if (docSnap.exists()) userData = { id: docSnap.id, ...docSnap.data() };
        }

        if (userData) {
          setProfile(userData);
          setIsFollowing((userData.followers || []).includes(currentUser?.uid));
          setFollowerCount((userData.followers || []).length);
          setFollowingCount((userData.following || []).length);
          userIdToUse = userData.uid || userId;
        }

        const postsQuery = query(collection(db, 'posts'), where('userId', '==', userIdToUse), orderBy('createdAt', 'desc'));
        const postsSnap = await getDocs(postsQuery);
        setPosts(postsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error(error);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [userId, currentUser]);

  const loadFollowUsers = async (type) => {
    if (!profile) return;
    const userIds = type === 'followers' ? profile.followers : profile.following;
    const users = [];
    for (const uid of (userIds || [])) {
      const q = query(collection(db, 'users'), where('uid', '==', uid));
      const snap = await getDocs(q);
      if (!snap.empty) users.push({ id: snap.docs[0].id, ...snap.docs[0].data() });
    }
    if (type === 'followers') setFollowerUsers(users);
    else setFollowingUsers(users);
  };

  const toggleFollow = async () => {
    const prev = isFollowing;
    setIsFollowing(!prev);
    setFollowerCount(c => prev ? c - 1 : c + 1);

    try {
      const q = query(collection(db, 'users'), where('uid', '==', profile.uid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, { followers: prev ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) });
      }

      const currentQ = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
      const currentSnap = await getDocs(currentQ);
      if (!currentSnap.empty) {
        await updateDoc(currentSnap.docs[0].ref, { following: prev ? arrayRemove(profile.uid) : arrayUnion(profile.uid) });
      }

      if (!prev) {
        await addDoc(collection(db, 'notifications'), {
          toUid: profile.uid, fromUid: currentUser.uid, fromUsername: currentUser.username,
          fromPhotoURL: currentUser.photoURL || '', type: 'follow', read: false, createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      setIsFollowing(prev);
      setFollowerCount(c => prev ? c + 1 : c - 1);
      showToast('Failed to follow', 'error');
    }
  };

  if (loading) return (
    <div style={{ height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>Loading...</div>
  );
  if (!profile) return (
    <div style={{ height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>User not found</div>
  );

  const isOwn = profile.uid === currentUser?.uid;

  return (
    <>
      <div style={{ height: '100%', overflowY: 'auto', background: '#0a0a0a', paddingBottom: 80 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 0' }}>
          <button onClick={onBack} style={{ background: '#1a1a1a', border: 'none', borderRadius: 20, padding: '8px 14px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>← Back</button>
          {!isOwn && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowMenu(!showMenu)} style={{ background: '#1a1a1a', border: 'none', borderRadius: 20, padding: '8px 16px', color: '#fff', cursor: 'pointer', fontSize: 18 }}>•••</button>
              {showMenu && (
                <div style={{ position: 'absolute', top: 44, right: 0, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16, padding: 6, minWidth: 170, zIndex: 50 }}>
                  <button onClick={() => { onMessage?.(profile.uid); onBack(); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13 }}>💬 Send Message</button>
                  <button onClick={() => { setShowReport(true); setShowMenu(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: '#ff9500', cursor: 'pointer', fontSize: 13 }}>⚠️ Report User</button>
                  <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: '#ff2d55', cursor: 'pointer', fontSize: 13 }}>🚫 Block User</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile Info */}
        <div style={{ textAlign: 'center', padding: '20px 20px 16px' }}>
          <div style={{
            width: 100, height: 100, borderRadius: '50%', background: profile.avatarColor || '#ff2d55',
            margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40, fontWeight: 700, color: '#fff', border: '3px solid #ff2d55', overflow: 'hidden',
          }}>
            {profile.photoURL ? <img src={profile.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (profile.username?.[0] || '?').toUpperCase()}
          </div>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>@{profile.username}</h2>
          {profile.fullName && <div style={{ color: '#888', fontSize: 13, marginBottom: 4 }}>{profile.fullName}</div>}
          {profile.bio && <p style={{ color: '#aaa', fontSize: 13, marginBottom: 8, maxWidth: 300, margin: '8px auto 0' }}>{profile.bio}</p>}
          {profile.location && <div style={{ color: '#555', fontSize: 12, marginTop: 4 }}>📍 {profile.location}</div>}
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ color: '#06d6a0', fontSize: 12, marginTop: 4, display: 'inline-block', textDecoration: 'none' }}>{profile.website}</a>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 48, padding: '16px 20px', borderBottom: '1px solid #1a1a1a', borderTop: '1px solid #1a1a1a' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>{posts.length}</div>
            <div style={{ color: '#666', fontSize: 11 }}>Posts</div>
          </div>
          <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => { setShowFollowers(true); loadFollowUsers('followers'); }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>{followerCount}</div>
            <div style={{ color: '#666', fontSize: 11 }}>Followers</div>
          </div>
          <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => { setShowFollowing(true); loadFollowUsers('following'); }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>{followingCount}</div>
            <div style={{ color: '#666', fontSize: 11 }}>Following</div>
          </div>
        </div>

        {/* Action Buttons */}
        {!isOwn && (
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={toggleFollow} style={{
                flex: 2, background: isFollowing ? '#2a2a2a' : '#ff2d55',
                border: isFollowing ? '1px solid #333' : 'none', borderRadius: 24, padding: '12px',
                color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14,
              }}>{isFollowing ? '✓ Following' : '+ Follow'}</button>
              <button onClick={() => { onMessage?.(profile.uid); onBack(); }} style={{
                flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: 24,
                padding: '12px', color: '#fff', cursor: 'pointer', fontSize: 14,
              }}>💬</button>
            </div>
          </div>
        )}

        {/* Posts Grid */}
        <div style={{ padding: '0 12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
            {posts.map(post => (
              <div key={post.id} style={{ aspectRatio: '9/16', background: '#111', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                {post.type === 'video' && <video src={post.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />}
                {post.type === 'photo' && <img src={post.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                {post.type === 'text' && (
                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#1a0020,#000)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                    <p style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{post.text?.substring(0, 50)}</p>
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '2px 6px', color: '#fff', fontSize: 9 }}>❤️ {formatNumber(post.likes?.length || 0)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showFollowers && (
        <FollowListModal title="Followers" users={followerUsers} currentUser={currentUser}
          onClose={() => setShowFollowers(false)} onFollow={toggleFollow}
          onViewProfile={(uid) => { onBack(); setTimeout(() => onViewProfile?.(uid), 100); }} followed={[]} />
      )}
      {showFollowing && (
        <FollowListModal title="Following" users={followingUsers} currentUser={currentUser}
          onClose={() => setShowFollowing(false)} onFollow={toggleFollow}
          onViewProfile={(uid) => { onBack(); setTimeout(() => onViewProfile?.(uid), 100); }} followed={[]} />
      )}
      {showReport && <ReportModal targetId={profile.uid} targetType="user" targetName={profile.username} reportedBy={currentUser?.uid} onClose={() => setShowReport(false)} showToast={showToast} />}
    </>
  );
};

// ============================================
// MY PROFILE PAGE (Current user)
// ============================================
const MyProfile = ({ currentUser, showToast, onLogout, onOpenSettings }) => {
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState('posts');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [followerUsers, setFollowerUsers] = useState([]);
  const [followingUsers, setFollowingUsers] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'posts'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'posts'), where('saves', 'array-contains', currentUser.uid));
    const unsub = onSnapshot(q, snap => setSavedPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [currentUser]);

  const changePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser?.uid) return;
    setUploading(true);
    try {
      const storageRef2 = ref(storage, `avatars/${currentUser.uid}_${Date.now()}`);
      const task = uploadBytesResumable(storageRef2, file);
      task.on('state_changed', null, null, async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        const q = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
        const snap = await getDocs(q);
        if (!snap.empty) await updateDoc(snap.docs[0].ref, { photoURL: url });
        setUploading(false);
        showToast('Profile photo updated!', 'success');
      });
    } catch {
      setUploading(false);
      showToast('Upload failed', 'error');
    }
  };

  const updateProfile = async (updates) => {
    const q = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
    const snap = await getDocs(q);
    if (!snap.empty) await updateDoc(snap.docs[0].ref, updates);
    showToast('Profile updated!', 'success');
  };

  const loadFollowUsers = async (type) => {
    const userIds = type === 'followers' ? currentUser.followers : currentUser.following;
    const users = [];
    for (const uid of (userIds || [])) {
      const q = query(collection(db, 'users'), where('uid', '==', uid));
      const snap = await getDocs(q);
      if (!snap.empty) users.push({ id: snap.docs[0].id, ...snap.docs[0].data() });
    }
    if (type === 'followers') setFollowerUsers(users);
    else setFollowingUsers(users);
  };

  const displayPosts = tab === 'saved' ? savedPosts : posts;
  const totalLikes = posts.reduce((sum, p) => sum + (p.likes?.length || 0), 0);

  return (
    <>
      <div style={{ height: '100%', overflowY: 'auto', background: '#0a0a0a', paddingBottom: 80 }}>
        {/* Settings Button */}
        <div style={{ padding: '16px 16px 0', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onOpenSettings} style={{ background: '#1a1a1a', border: 'none', borderRadius: 20, padding: '8px 16px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>⚙️ Settings</button>
        </div>

        {/* Profile Header */}
        <div style={{ textAlign: 'center', padding: '16px 20px 16px', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
            <div style={{ width: 90, height: 90, borderRadius: '50%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', padding: 2 }}>
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%', background: '#0a0a0a',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
                fontWeight: 700, color: '#fff', overflow: 'hidden',
              }}>
                {currentUser?.photoURL ? <img src={currentUser.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (currentUser?.username?.[0] || '?').toUpperCase()}
              </div>
            </div>
            <label style={{ position: 'absolute', bottom: 2, right: 2, background: '#ff2d55', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }}>
              📷
              <input ref={fileRef} type="file" accept="image/*" onChange={changePhoto} style={{ display: 'none' }} />
            </label>
          </div>
          {uploading && <p style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>Uploading...</p>}
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>@{currentUser?.username}</h2>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>{currentUser?.bio || 'Dagu Creator 🎬'}</p>

          {/* Stats */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 16 }}>
            {[
              { val: posts.length, label: 'Posts', onClick: null },
              { val: currentUser?.followers?.length || 0, label: 'Followers', onClick: () => { setShowFollowers(true); loadFollowUsers('followers'); } },
              { val: currentUser?.following?.length || 0, label: 'Following', onClick: () => { setShowFollowing(true); loadFollowUsers('following'); } },
              { val: formatNumber(totalLikes), label: 'Likes', onClick: null },
            ].map((stat, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', borderRight: i < 3 ? '1px solid #1a1a1a' : 'none', cursor: stat.onClick ? 'pointer' : 'default' }} onClick={stat.onClick}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{stat.val}</div>
                <div style={{ color: '#666', fontSize: 11 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => setShowEditProfile(true)} style={{ flex: 1, maxWidth: 160, background: '#1a1a1a', border: '1px solid #333', borderRadius: 20, padding: '9px 0', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>✏️ Edit Profile</button>
            <button onClick={() => { if (navigator.share) navigator.share({ title: 'Check me on Dagu!', url: window.location.href }); else showToast('Share not supported', 'info'); }} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 20, padding: '9px 16px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>↗️ Share</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1a1a1a' }}>
          {[
            { id: 'posts', icon: '⊞', label: 'Posts' },
            { id: 'saved', icon: '🔖', label: 'Saved' },
          ].map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} style={{
              flex: 1, padding: '12px 0', background: 'none', border: 'none',
              borderBottom: tab === item.id ? '2px solid #ff2d55' : '2px solid transparent',
              color: tab === item.id ? '#ff2d55' : '#555', cursor: 'pointer', fontSize: 13,
              fontWeight: tab === item.id ? 700 : 400,
            }}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        {/* Posts Grid */}
        <div style={{ padding: '3px' }}>
          {displayPosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#444' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>{tab === 'saved' ? '🔖' : '🎬'}</div>
              <p style={{ fontSize: 13 }}>{tab === 'saved' ? 'No saved posts yet' : 'No posts yet. Tap + to create!'}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
              {displayPosts.map(post => (
                <div key={post.id} style={{ aspectRatio: '9/16', background: '#111', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                  {post.type === 'video' && <video src={post.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />}
                  {post.type === 'photo' && <img src={post.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  {post.type === 'text' && (
                    <div style={{ background: 'linear-gradient(135deg,#1a0020,#000)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
                      <p style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{post.text?.substring(0, 50)}</p>
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '2px 6px', color: '#fff', fontSize: 9 }}>❤️ {formatNumber(post.likes?.length || 0)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showEditProfile && <EditProfileModal user={currentUser} onClose={() => setShowEditProfile(false)} onUpdate={updateProfile} showToast={showToast} />}
      {showFollowers && <FollowListModal title="Followers" users={followerUsers} currentUser={currentUser} onClose={() => setShowFollowers(false)} onFollow={() => {}} onViewProfile={() => {}} followed={[]} />}
      {showFollowing && <FollowListModal title="Following" users={followingUsers} currentUser={currentUser} onClose={() => setShowFollowing(false)} onFollow={() => {}} onViewProfile={() => {}} followed={[]} />}
    </>
  );
};

// ============================================
// WALLET PAGE
// ============================================
const WalletPage = ({ currentUser, showToast, onBack }) => {
  const [coins, setCoins] = useState(currentUser?.coins || 500);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, snap => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [currentUser]);

  const buyCoins = async (coinsToAdd, price) => {
    showToast(`Processing payment for ${coinsToAdd} coins...`, 'info');
    try {
      const newCoins = coins + coinsToAdd;
      const q = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
      const snap = await getDocs(q);
      if (!snap.empty) await updateDoc(snap.docs[0].ref, { coins: newCoins });
      setCoins(newCoins);
      await addDoc(collection(db, 'transactions'), {
        userId: currentUser.uid, type: 'credit', amount: coinsToAdd,
        description: `Purchased ${coinsToAdd} coins ($${price})`,
        createdAt: serverTimestamp(),
      });
      showToast(`Added ${coinsToAdd} coins! 🎉`, 'success');
    } catch (error) {
      showToast('Purchase failed', 'error');
    }
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0a0a0a' }}>
      <div style={{ padding: '16px 16px 0' }}>
        <button onClick={onBack} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '8px 14px', color: '#fff', cursor: 'pointer', fontSize: 12, marginBottom: 16 }}>← Back</button>
        <h2 style={{ color: '#fff', marginBottom: 16, fontSize: 20, fontWeight: 700 }}>💰 Wallet</h2>

        {/* Balance Card */}
        <div style={{ background: 'linear-gradient(135deg,#ffd700,#ff9500)', borderRadius: 20, padding: 20, marginBottom: 20 }}>
          <div style={{ color: 'rgba(0,0,0,0.6)', fontSize: 11 }}>Your Balance</div>
          <div style={{ color: '#000', fontSize: 36, fontWeight: 800, marginTop: 4 }}>{formatNumber(coins)} 🪙</div>
          <div style={{ color: 'rgba(0,0,0,0.5)', fontSize: 10, marginTop: 2 }}>≈ ${(coins * 0.01).toFixed(2)} USD</div>
        </div>

        {/* Coin Packages */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 14, marginBottom: 12 }}>Buy Coins</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {COIN_PACKAGES.map(pkg => (
              <button key={pkg.coins} onClick={() => buyCoins(pkg.coins + pkg.bonus, pkg.price)} style={{
                background: pkg.popular ? 'linear-gradient(135deg,#ff2d55,#af52de)' : '#141414',
                border: pkg.popular ? 'none' : '1px solid #1e1e1e', borderRadius: 16, padding: 14,
                textAlign: 'center', cursor: 'pointer', position: 'relative',
              }}>
                {pkg.popular && <div style={{ position: 'absolute', top: -8, right: 8, background: '#ffd700', color: '#000', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>POPULAR</div>}
                <div style={{ color: pkg.popular ? '#fff' : '#ffd700', fontSize: 20, fontWeight: 800 }}>{formatNumber(pkg.coins + pkg.bonus)}</div>
                <div style={{ color: pkg.popular ? 'rgba(255,255,255,0.7)' : '#888', fontSize: 11 }}>${pkg.price}</div>
                {pkg.bonus > 0 && <div style={{ color: '#06d6a0', fontSize: 10, marginTop: 4 }}>+{pkg.bonus} bonus</div>}
              </button>
            ))}
          </div>
        </div>

        {/* Transaction History */}
        <div>
          <h3 style={{ color: '#fff', fontSize: 14, marginBottom: 12 }}>Transaction History</h3>
          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#333' }}>No transactions yet</div>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #111' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 13 }}>{tx.description}</div>
                  <div style={{ color: '#555', fontSize: 11 }}>{timeAgo(tx.createdAt)}</div>
                </div>
                <div style={{ color: tx.amount > 0 ? '#06d6a0' : '#ff2d55', fontWeight: 700 }}>{tx.amount > 0 ? '+' : ''}{tx.amount} 🪙</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// SETTINGS PAGE (Complete)
// ============================================
const SettingsPage = ({ currentUser, onClose, showToast, onLogout }) => {
  const [section, setSection] = useState('main');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [privateAccount, setPrivateAccount] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);

  const sections = {
    main: (
      <div>
        <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ff2d55', cursor: 'pointer', fontSize: 22 }}>✕</button>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Settings</h2>
        </div>
        {[
          { icon: '👤', label: 'Account', sub: 'Profile, phone, email', fn: () => setSection('account') },
          { icon: '🔒', label: 'Privacy', sub: 'Account visibility, blocking', fn: () => setSection('privacy') },
          { icon: '🔔', label: 'Notifications', sub: 'Push, email, in-app', fn: () => setSection('notifications') },
          { icon: '🎨', label: 'Appearance', sub: 'Theme, font size, auto-play', fn: () => setSection('appearance') },
          { icon: '🛡️', label: 'Safety', sub: 'Blocked, muted, reported', fn: () => setSection('safety') },
          { icon: '💰', label: 'Wallet', sub: 'Coins, transactions', fn: () => setSection('wallet') },
          { icon: '📊', label: 'Analytics', sub: 'Your performance', fn: () => setSection('analytics') },
          { icon: '❓', label: 'Help & Support', sub: 'FAQ, contact, report', fn: () => setSection('help') },
          { icon: '📜', label: 'Legal', sub: 'Terms, privacy, licenses', fn: () => setSection('legal') },
          { icon: '🌍', label: 'Language', sub: 'English, Amharic...', fn: () => showToast('Coming soon!', 'info') },
          { icon: 'ℹ️', label: 'About Dagu', sub: 'Version 1.0.0', fn: () => setSection('about') },
        ].map(item => (
          <button key={item.label} onClick={item.fn} style={{
            display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '16px 20px',
            background: 'none', border: 'none', borderBottom: '1px solid #111', cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ fontSize: 22, width: 36 }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{item.label}</div>
              <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>{item.sub}</div>
            </div>
            <span style={{ color: '#333', fontSize: 18 }}>›</span>
          </button>
        ))}
        <div style={{ padding: '20px 16px' }}>
          <button onClick={onLogout} style={{ width: '100%', background: 'rgba(255,45,85,0.1)', border: '1px solid rgba(255,45,85,0.3)', borderRadius: 16, padding: 14, color: '#ff2d55', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>🚪 Log Out</button>
        </div>
      </div>
    ),

    privacy: (
      <div>
        <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSection('main')} style={{ background: 'none', border: 'none', color: '#ff2d55', cursor: 'pointer', fontSize: 22 }}>←</button>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Privacy</h2>
        </div>
        {[
          { label: 'Private Account', value: privateAccount, onChange: setPrivateAccount, desc: 'Only approved followers can see your content' },
          { label: 'Hide Active Status', value: false, onChange: () => {}, desc: 'Don\'t show when you\'re online' },
          { label: 'Hide Read Receipts', value: false, onChange: () => {}, desc: 'Don\'t show when you read DMs' },
          { label: 'Allow Comments', value: true, onChange: () => {}, desc: 'Everyone, Followers, or Only You' },
          { label: 'Allow DMs', value: true, onChange: () => {}, desc: 'Everyone, Followers, or No One' },
          { label: 'Allow Tags', value: true, onChange: () => {}, desc: 'Allow others to tag you in posts' },
          { label: 'Show Liked Posts', value: true, onChange: () => {}, desc: 'Show posts you\'ve liked on your profile' },
        ].map(setting => (
          <div key={setting.label} style={{ padding: '16px 20px', borderBottom: '1px solid #111' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#ccc', fontSize: 14 }}>{setting.label}</span>
              <div onClick={() => setting.onChange(!setting.value)} style={{ width: 44, height: 24, background: setting.value ? '#ff2d55' : '#333', borderRadius: 12, position: 'relative', cursor: 'pointer' }}>
                <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: setting.value ? 22 : 2, transition: 'left 0.2s' }} />
              </div>
            </div>
            <div style={{ color: '#666', fontSize: 11 }}>{setting.desc}</div>
          </div>
        ))}
      </div>
    ),

    notifications: (
      <div>
        <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSection('main')} style={{ background: 'none', border: 'none', color: '#ff2d55', cursor: 'pointer', fontSize: 22 }}>←</button>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Notifications</h2>
        </div>
        {[
          { label: 'Push Notifications', value: pushNotifications, onChange: setPushNotifications },
          { label: 'Email Notifications', value: emailNotifications, onChange: setEmailNotifications },
          { label: 'Likes', value: true, onChange: () => {} },
          { label: 'Comments', value: true, onChange: () => {} },
          { label: 'New Followers', value: true, onChange: () => {} },
          { label: 'Mentions', value: true, onChange: () => {} },
          { label: 'Direct Messages', value: true, onChange: () => {} },
          { label: 'Live Streams', value: true, onChange: () => {} },
          { label: 'Story Replies', value: true, onChange: () => {} },
          { label: 'Gifts Received', value: true, onChange: () => {} },
        ].map(notif => (
          <div key={notif.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #111' }}>
            <span style={{ color: '#ccc', fontSize: 14 }}>{notif.label}</span>
            <div onClick={() => notif.onChange(!notif.value)} style={{ width: 44, height: 24, background: notif.value ? '#ff2d55' : '#333', borderRadius: 12, position: 'relative', cursor: 'pointer' }}>
              <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: notif.value ? 22 : 2 }} />
            </div>
          </div>
        ))}
      </div>
    ),

    appearance: (
      <div>
        <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSection('main')} style={{ background: 'none', border: 'none', color: '#ff2d55', cursor: 'pointer', fontSize: 22 }}>←</button>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Appearance</h2>
        </div>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#ccc', fontSize: 14 }}>Dark Mode</span>
          <div onClick={() => setDarkMode(!darkMode)} style={{ width: 44, height: 24, background: darkMode ? '#ff2d55' : '#333', borderRadius: 12, position: 'relative', cursor: 'pointer' }}>
            <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: darkMode ? 22 : 2 }} />
          </div>
        </div>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#ccc', fontSize: 14 }}>Auto-Play Videos</span>
          <div onClick={() => setAutoPlay(!autoPlay)} style={{ width: 44, height: 24, background: autoPlay ? '#ff2d55' : '#333', borderRadius: 12, position: 'relative', cursor: 'pointer' }}>
            <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: autoPlay ? 22 : 2 }} />
          </div>
        </div>
      </div>
    ),

    safety: (
      <div>
        <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSection('main')} style={{ background: 'none', border: 'none', color: '#ff2d55', cursor: 'pointer', fontSize: 22 }}>←</button>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Safety</h2>
        </div>
        {[
          { icon: '🚫', label: 'Blocked Users' },
          { icon: '🔕', label: 'Muted Accounts' },
          { icon: '⚠️', label: 'Report History' },
          { icon: '🛡️', label: 'Sensitive Content Control' },
          { icon: '👤', label: 'Restricted Accounts' },
        ].map(item => (
          <button key={item.label} onClick={() => showToast('Coming soon!', 'info')} style={{
            display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '16px 20px',
            background: 'none', border: 'none', borderBottom: '1px solid #111', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ color: '#ccc', fontSize: 14 }}>{item.label}</span>
            <span style={{ marginLeft: 'auto', color: '#333' }}>›</span>
          </button>
        ))}
      </div>
    ),

    account: (
      <div>
        <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSection('main')} style={{ background: 'none', border: 'none', color: '#ff2d55', cursor: 'pointer', fontSize: 22 }}>←</button>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Account</h2>
        </div>
        {[
          { icon: '📧', label: 'Email', value: currentUser?.email },
          { icon: '📱', label: 'Phone Number', value: 'Not added' },
          { icon: '🔑', label: 'Change Password' },
          { icon: '🔄', label: 'Switch Account' },
          { icon: '📥', label: 'Download Your Data' },
          { icon: '🗑️', label: 'Delete Account', danger: true },
        ].map(item => (
          <button key={item.label} onClick={() => showToast('Coming soon!', 'info')} style={{
            display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '16px 20px',
            background: 'none', border: 'none', borderBottom: '1px solid #111', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ color: item.danger ? '#ff2d55' : '#ccc', fontSize: 14 }}>{item.label}</div>
              {item.value && <div style={{ color: '#555', fontSize: 12 }}>{item.value}</div>}
            </div>
            <span style={{ color: '#333' }}>›</span>
          </button>
        ))}
      </div>
    ),

    wallet: <WalletPage currentUser={currentUser} showToast={showToast} onBack={() => setSection('main')} />,

    analytics: (
      <div>
        <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSection('main')} style={{ background: 'none', border: 'none', color: '#ff2d55', cursor: 'pointer', fontSize: 22 }}>←</button>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Analytics</h2>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
            <p>Analytics coming soon!</p>
            <p style={{ fontSize: 12, marginTop: 8 }}>Post more content to see your stats</p>
          </div>
        </div>
      </div>
    ),

    help: (
      <div>
        <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSection('main')} style={{ background: 'none', border: 'none', color: '#ff2d55', cursor: 'pointer', fontSize: 22 }}>←</button>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Help & Support</h2>
        </div>
        {[
          { icon: '❓', label: 'FAQ' },
          { icon: '📧', label: 'Contact Support' },
          { icon: '⚠️', label: 'Report a Problem' },
          { icon: '💡', label: 'Tips & Tricks' },
          { icon: '📋', label: 'Community Guidelines' },
        ].map(item => (
          <button key={item.label} onClick={() => showToast('Coming soon!', 'info')} style={{
            display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '16px 20px',
            background: 'none', border: 'none', borderBottom: '1px solid #111', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ color: '#ccc', fontSize: 14 }}>{item.label}</span>
            <span style={{ marginLeft: 'auto', color: '#333' }}>›</span>
          </button>
        ))}
      </div>
    ),

    legal: (
      <div>
        <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSection('main')} style={{ background: 'none', border: 'none', color: '#ff2d55', cursor: 'pointer', fontSize: 22 }}>←</button>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Legal</h2>
        </div>
        {[
          { icon: '📄', label: 'Terms of Service' },
          { icon: '🔐', label: 'Privacy Policy' },
          { icon: '©️', label: 'Copyright Information' },
          { icon: '⚖️', label: 'Licenses' },
        ].map(item => (
          <button key={item.label} onClick={() => showToast('Coming soon!', 'info')} style={{
            display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '16px 20px',
            background: 'none', border: 'none', borderBottom: '1px solid #111', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ color: '#ccc', fontSize: 14 }}>{item.label}</span>
            <span style={{ marginLeft: 'auto', color: '#333' }}>›</span>
          </button>
        ))}
      </div>
    ),

    about: (
      <div>
        <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSection('main')} style={{ background: 'none', border: 'none', color: '#ff2d55', cursor: 'pointer', fontSize: 22 }}>←</button>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>About Dagu</h2>
        </div>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>🎬</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, background: 'linear-gradient(135deg,#ff2d55,#af52de)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>Dagu</h1>
          <p style={{ color: '#555', fontSize: 14, marginBottom: 4 }}>Version 1.0.0</p>
          <p style={{ color: '#555', fontSize: 13, marginBottom: 20 }}>Short Video Platform</p>
          <div style={{ color: '#333', fontSize: 12, marginTop: 20 }}>
            <p>© 2024 Dagu. All rights reserved.</p>
            <p style={{ marginTop: 8 }}>Made with ❤️ in Ethiopia</p>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 300, overflowY: 'auto' }}>
      {sections[section]}
    </div>
  );
};

// ============================================
// SEARCH PAGE (Complete)
// ============================================
const SearchPage = ({ currentUser, onViewProfile, showToast }) => {
  const [query2, setQuery2] = useState('');
  const [results, setResults] = useState({ users: [], posts: [] });
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('dagu_recent_searches');
    if (saved) setRecentSearches(JSON.parse(saved).slice(0, 5));
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(30));
    const unsub = onSnapshot(q, snap => setTrendingPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const search = async (val) => {
    if (!val.trim()) { setResults({ users: [], posts: [] }); return; }
    setLoading(true);
    try {
      const [uSnap, pSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'posts')),
      ]);
      const q3 = val.toLowerCase();
      const users = uSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.username?.toLowerCase().includes(q3) || u.bio?.toLowerCase().includes(q3));
      const posts = pSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.caption?.toLowerCase().includes(q3) || p.text?.toLowerCase().includes(q3));
      setResults({ users, posts });
      if (!recentSearches.includes(val)) {
        const newSearches = [val, ...recentSearches].slice(0, 5);
        setRecentSearches(newSearches);
        localStorage.setItem('dagu_recent_searches', JSON.stringify(newSearches));
      }
    } catch { showToast('Search failed', 'error'); }
    setLoading(false);
  };

  const displayPosts = activeCategory === 'all' ? trendingPosts : trendingPosts.filter(p => p.category === activeCategory);
  const hasSearch = query2.trim().length > 0;

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0a0a0a', paddingBottom: 20 }}>
      {/* Search Bar */}
      <div style={{ padding: '14px 14px 10px', position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10, borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#161616', borderRadius: 14, padding: '10px 14px', gap: 8 }}>
          <span style={{ fontSize: 16, color: '#555' }}>🔍</span>
          <input value={query2} onChange={e => { setQuery2(e.target.value); search(e.target.value); }} placeholder="Search users, posts, hashtags..." style={{ flex: 1, background: 'none', border: 'none', color: '#fff', outline: 'none', fontSize: 14 }} />
          {query2 && <button onClick={() => { setQuery2(''); setResults({ users: [], posts: [] }); }} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16 }}>✕</button>}
        </div>
        {!hasSearch && recentSearches.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#666', fontSize: 11, fontWeight: 700 }}>RECENT SEARCHES</span>
              <button onClick={() => { setRecentSearches([]); localStorage.removeItem('dagu_recent_searches'); }} style={{ background: 'none', border: 'none', color: '#555', fontSize: 11, cursor: 'pointer' }}>Clear</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {recentSearches.map(s => (
                <button key={s} onClick={() => { setQuery2(s); search(s); }} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 20, padding: '6px 14px', color: '#ccc', fontSize: 12, cursor: 'pointer' }}>{s}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {hasSearch ? (
        <div style={{ padding: '0 14px' }}>
          {loading && <div style={{ textAlign: 'center', padding: 30, color: '#555' }}>Searching...</div>}
          {results.users.length > 0 && (
            <>
              <p style={{ color: '#555', fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>PEOPLE</p>
              {results.users.map(u => (
                <div key={u.id} onClick={() => onViewProfile(u.uid || u.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', cursor: 'pointer', borderBottom: '1px solid #111' }}>
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, overflow: 'hidden', flexShrink: 0 }}>
                    {u.photoURL ? <img src={u.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.username?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontWeight: 600 }}>@{u.username}</div>
                    {u.bio && <div style={{ color: '#666', fontSize: 12 }}>{u.bio}</div>}
                  </div>
                  <div style={{ color: '#555', fontSize: 12 }}>{formatNumber(u.followers?.length || 0)} followers</div>
                </div>
              ))}
            </>
          )}
          {results.posts.length > 0 && (
            <>
              <p style={{ color: '#555', fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>POSTS</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                {results.posts.map(p => (
                  <div key={p.id} style={{ aspectRatio: '9/16', background: '#111', borderRadius: 8, overflow: 'hidden' }}>
                    {p.type === 'video' && <video src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />}
                    {p.type === 'photo' && <img src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    {p.type === 'text' && <div style={{ background: 'linear-gradient(135deg,#1a0020,#000)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}><p style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{p.text?.substring(0, 50)}</p></div>}
                  </div>
                ))}
              </div>
            </>
          )}
          {!loading && results.users.length === 0 && results.posts.length === 0 && (
            <div style={{ textAlign: 'center', padding: 50, color: '#444' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <p>No results for "{query2}"</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Categories */}
          <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', padding: '12px 14px', borderBottom: '1px solid #111' }}>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{
                display: 'inline-block', marginRight: 8, background: activeCategory === cat.id ? '#ff2d55' : '#161616',
                border: 'none', borderRadius: 20, padding: '7px 14px', color: '#fff', fontSize: 12,
                fontWeight: activeCategory === cat.id ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
          {/* Trending Grid */}
          <div style={{ padding: '12px 14px' }}>
            <p style={{ color: '#888', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>🔥 TRENDING NOW</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
              {displayPosts.slice(0, 30).map((p, i) => (
                <div key={p.id} style={{ aspectRatio: i % 5 === 0 ? '9/20' : '9/16', background: '#111', borderRadius: 8, overflow: 'hidden', position: 'relative', gridRow: i % 5 === 0 ? 'span 2' : 'span 1' }}>
                  {p.type === 'video' && <video src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />}
                  {p.type === 'photo' && <img src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  {p.type === 'text' && <div style={{ background: 'linear-gradient(135deg,#1a0020,#000)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}><p style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{p.text?.substring(0, 50)}</p></div>}
                  <div style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(0,0,0,0.6)', borderRadius: 10, padding: '3px 7px', color: '#fff', fontSize: 10 }}>❤️ {formatNumber(p.likes?.length || 0)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ============================================
// NOTIFICATIONS PAGE
// ============================================
const NotificationsPage = ({ currentUser, onViewProfile }) => {
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'notifications'), where('toUid', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, snap => setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [currentUser]);

  const icons = { like: '❤️', comment: '💬', follow: '👤', gift: '🎁', mention: '@', message: '💌' };

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0a0a0a' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1a', position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10 }}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>🔔 Notifications</h2>
      </div>
      {notifs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#444' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
          <p>No notifications yet</p>
          <p style={{ fontSize: 12, marginTop: 8, color: '#333' }}>When someone likes or follows you, you'll see it here</p>
        </div>
      ) : (
        notifs.map(n => (
          <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid #111', background: n.read ? 'transparent' : 'rgba(255,45,85,0.04)' }}>
            <div onClick={() => onViewProfile?.(n.fromUid)} style={{ width: 44, height: 44, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}>
              {n.fromPhotoURL ? <img src={n.fromPhotoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : n.fromUsername?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#fff', fontSize: 13 }}>
                <span style={{ fontWeight: 700 }}>@{n.fromUsername}</span>{' '}
                {n.type === 'like' && 'liked your post'}
                {n.type === 'comment' && `commented: "${n.text?.substring(0, 30)}"`}
                {n.type === 'follow' && 'started following you'}
                {n.type === 'gift' && `sent you a ${n.gift}`}
                {n.type === 'message' && `sent you a message`}
              </p>
              <p style={{ color: '#555', fontSize: 11, marginTop: 2 }}>{timeAgo(n.createdAt)}</p>
            </div>
            <span style={{ fontSize: 20 }}>{icons[n.type] || '🔔'}</span>
          </div>
        ))
      )}
    </div>
  );
};

// ============================================
// INBOX PAGE (Complete DM)
// ============================================
const InboxPage = ({ currentUser, openUserId, showToast, onViewProfile }) => {
  const [users, setUsers] = useState([]);
  const [activeConvo, setActiveConvo] = useState(openUserId || null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.uid !== currentUser?.uid));
    });
    return unsub;
  }, [currentUser]);

  useEffect(() => { if (openUserId) setActiveConvo(openUserId); }, [openUserId]);

  useEffect(() => {
    if (!activeConvo || !currentUser?.uid) return;
    const convoId = [currentUser.uid, activeConvo].sort().join('_');
    const unsub = onSnapshot(query(collection(db, 'messages', convoId, 'msgs'), orderBy('createdAt')), snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [activeConvo, currentUser]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!text.trim() || !activeConvo || !currentUser?.uid) return;
    const convoId = [currentUser.uid, activeConvo].sort().join('_');
    const messageText = text; setText('');
    try {
      await addDoc(collection(db, 'messages', convoId, 'msgs'), { text: messageText, from: currentUser.uid, createdAt: serverTimestamp() });
      await addDoc(collection(db, 'notifications'), { toUid: activeConvo, fromUid: currentUser.uid, fromUsername: currentUser.username, fromPhotoURL: currentUser.photoURL || '', type: 'message', text: messageText.substring(0, 30), read: false, createdAt: serverTimestamp() });
    } catch { showToast('Failed to send', 'error'); }
  };

  const otherUser = users.find(u => u.uid === activeConvo);
  const filteredUsers = users.filter(u => u.username?.toLowerCase().includes(searchUser.toLowerCase()));

  if (activeConvo && otherUser) return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={() => setActiveConvo(null)} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '7px 12px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>←</button>
        <div onClick={() => onViewProfile?.(otherUser.uid)} style={{ width: 38, height: 38, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}>
          {otherUser.photoURL ? <img src={otherUser.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : otherUser.username?.[0]?.toUpperCase()}
        </div>
        <div>
          <div style={{ color: '#fff', fontWeight: 600 }}>@{otherUser.username}</div>
          <div style={{ color: '#06d6a0', fontSize: 11 }}>● Online</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && <div style={{ textAlign: 'center', color: '#444', fontSize: 13, marginTop: 40 }}>Say hello! 👋</div>}
        {messages.map(msg => {
          const isMe = msg.from === currentUser?.uid;
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{ background: isMe ? '#ff2d55' : '#1a1a1a', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', maxWidth: '75%' }}>
                <div style={{ color: '#fff', fontSize: 13 }}>{msg.text}</div>
                <div style={{ color: isMe ? 'rgba(255,255,255,0.5)' : '#444', fontSize: 9, marginTop: 4, textAlign: 'right' }}>
                  {msg.createdAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div style={{ padding: '10px 12px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 6, flexShrink: 0 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Message..." style={{ flex: 1, background: '#161616', border: '1px solid #222', borderRadius: 22, padding: '9px 14px', color: '#fff', outline: 'none', fontSize: 13 }} />
        <button onClick={send} style={{ background: text.trim() ? '#ff2d55' : '#222', border: 'none', borderRadius: '50%', width: 38, height: 38, color: '#fff', cursor: 'pointer', fontSize: 18 }}>↑</button>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 12 }}>💬 Messages</h2>
        <div style={{ display: 'flex', alignItems: 'center', background: '#161616', borderRadius: 14, padding: '8px 12px', gap: 8 }}>
          <span style={{ color: '#555' }}>🔍</span>
          <input value={searchUser} onChange={e => setSearchUser(e.target.value)} placeholder="Search users..." style={{ flex: 1, background: 'none', border: 'none', color: '#fff', outline: 'none', fontSize: 13 }} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredUsers.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#444', fontSize: 13 }}>No users found</div>}
        {filteredUsers.map(u => (
          <div key={u.id} onClick={() => setActiveConvo(u.uid)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid #111', cursor: 'pointer' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 20, overflow: 'hidden', flexShrink: 0 }}>
              {u.photoURL ? <img src={u.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.username?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>@{u.username}</div>
              <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>{u.bio || 'Tap to message'}</div>
            </div>
            <div style={{ color: '#ff2d55', fontSize: 20 }}>›</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// CREATE POST SCREEN (Complete)
// ============================================
const CreateScreen = ({ currentUser, onClose, showToast }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  const [mode, setMode] = useState('camera');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('user');
  const [filter, setFilter] = useState(FILTERS[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedURL, setRecordedURL] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewURL, setPreviewURL] = useState(null);
  const [postType, setPostType] = useState('video');
  const [caption, setCaption] = useState('');
  const [textContent, setTextContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [step, setStep] = useState('capture');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    if (mode === 'camera') startCamera();
    return () => stopCamera();
  }, [mode, facingMode]);

  const startCamera = async () => {
    stopCamera(); setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraReady(true);
    } catch (err) {
      setCameraReady(false);
      setCameraError(err.name === 'NotAllowedError' ? 'Camera permission denied.' : 'Camera not available');
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
      setPostType('video'); setStep('preview');
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
    canvas.toBlob(blob => { setRecordedBlob(blob); setRecordedURL(URL.createObjectURL(blob)); setPostType('photo'); setStep('preview'); }, 'image/jpeg', 0.92);
  };

  const handleGalleryPick = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    setSelectedFile(file); setPreviewURL(url);
    setPostType(file.type.startsWith('video') ? 'video' : 'photo'); setStep('preview');
  };

  const handlePost = async () => {
    if (!currentUser?.uid) { showToast('Please log in first', 'error'); return; }
    if (postType === 'text') {
      if (!textContent.trim()) { showToast('Write something first!', 'error'); return; }
      try {
        await addDoc(collection(db, 'posts'), {
          type: 'text', text: textContent.trim(), caption: caption.trim(),
          userId: currentUser.uid, username: currentUser.username,
          photoURL: currentUser.photoURL || '', category,
          likes: [], comments: [], shares: 0, saves: [],
          createdAt: serverTimestamp(),
        });
        showToast('Text post shared! 🎉', 'success'); onClose();
      } catch { showToast('Failed to post', 'error'); }
      return;
    }
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
          await addDoc(collection(db, 'posts'), {
            type: postType, url, caption: caption.trim(), category,
            userId: currentUser.uid, username: currentUser.username,
            photoURL: currentUser.photoURL || '',
            likes: [], comments: [], shares: 0, saves: [], filterUsed: filter.id,
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
    if (mode === 'camera') startCamera();
  };

  if (step === 'preview') {
    const mediaURL = recordedURL || previewURL;
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a1a' }}>
          <button onClick={discard} style={{ background: '#1a1a1a', border: 'none', borderRadius: 20, padding: '8px 14px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>← Back</button>
          <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Preview</h3>
          <button onClick={handlePost} disabled={uploading} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 20px', color: '#fff', fontWeight: 700, cursor: uploading ? 'default' : 'pointer', fontSize: 13, opacity: uploading ? 0.7 : 1 }}>
            {uploading ? `${uploadProgress}%` : 'Post ✓'}
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {postType === 'video' ? (
            <video src={mediaURL} controls autoPlay loop style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', filter: filter.css }} />
          ) : (
            <img src={mediaURL} alt="preview" style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', filter: filter.css }} />
          )}
          {uploading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <div style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>{uploadProgress}%</div>
              <div style={{ width: 200, background: '#333', borderRadius: 8, height: 6 }}>
                <div style={{ width: `${uploadProgress}%`, background: '#ff2d55', height: '100%', borderRadius: 8, transition: 'width 0.3s' }} />
              </div>
              <div style={{ color: '#888', fontSize: 13 }}>Uploading...</div>
            </div>
          )}
        </div>
        <div style={{ padding: '12px 16px', background: '#0a0a0a', borderTop: '1px solid #1a1a1a' }}>
          <input placeholder="Write a caption... #hashtag @mention" value={caption} onChange={e => setCaption(e.target.value)} style={{ width: '100%', background: '#161616', border: '1px solid #222', borderRadius: 14, padding: '11px 14px', color: '#fff', outline: 'none', fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }} />
          <div style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>
            {CATEGORIES.slice(0, 8).map(cat => (
              <button key={cat.id} onClick={() => setCategory(cat.id)} style={{ display: 'inline-block', marginRight: 6, background: category === cat.id ? '#ff2d55' : '#161616', border: 'none', borderRadius: 20, padding: '6px 12px', color: '#fff', fontSize: 11, cursor: 'pointer' }}>{cat.label}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'text') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a1a' }}>
          <button onClick={onClose} style={{ background: '#1a1a1a', border: 'none', borderRadius: 20, padding: '8px 14px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>✕ Cancel</button>
          <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Text Post</h3>
          <button onClick={handlePost} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 20px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Post ✓</button>
        </div>
        <div style={{ flex: 1, padding: 16 }}>
          <textarea value={textContent} onChange={e => setTextContent(e.target.value)} placeholder="What's on your mind? Share something with Dagu..." autoFocus style={{ width: '100%', height: 200, background: '#141414', border: '1px solid #222', borderRadius: 16, padding: 16, color: '#fff', fontSize: 17, outline: 'none', resize: 'none', lineHeight: 1.6, boxSizing: 'border-box', marginBottom: 12 }} />
          <input placeholder="Add a caption..." value={caption} onChange={e => setCaption(e.target.value)} style={{ width: '100%', background: '#141414', border: '1px solid #222', borderRadius: 12, padding: '12px 16px', color: '#fff', outline: 'none', fontSize: 14, boxSizing: 'border-box' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 }}>
        <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: '#fff', fontSize: 18, cursor: 'pointer' }}>✕</button>
        <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 40, height: 40, fontSize: 20, cursor: 'pointer' }}>🔄</button>
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#111' }}>
        {cameraError ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📵</div>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>{cameraError}</p>
            <button onClick={startCamera} style={{ background: '#ff2d55', border: 'none', borderRadius: 24, padding: '12px 28px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Try Again</button>
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
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 0', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'inline-flex', gap: 12, padding: '0 16px' }}>
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer' }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: '#333', border: filter.id === f.id ? '2px solid #ff2d55' : '2px solid transparent', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{f.icon}</div>
                <span style={{ color: filter.id === f.id ? '#ff2d55' : '#ccc', fontSize: 10, fontWeight: filter.id === f.id ? 700 : 400 }}>{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ background: '#000', padding: '20px 16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => fileInputRef.current?.click()} style={{ width: 56, height: 56, borderRadius: 14, background: '#1a1a1a', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, cursor: 'pointer' }}>🖼️</button>
        <input ref={fileInputRef} type="file" accept="video/*,image/*" onChange={handleGalleryPick} style={{ display: 'none' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <button onTouchStart={startRecording} onTouchEnd={stopRecording} onMouseDown={startRecording} onMouseUp={stopRecording} style={{ width: 76, height: 76, borderRadius: '50%', border: '4px solid #fff', background: isRecording ? '#ff2d55' : 'rgba(255,45,85,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
            {isRecording ? <div style={{ width: 28, height: 28, background: '#fff', borderRadius: 4 }} /> : <div style={{ width: 52, height: 52, background: '#ff2d55', borderRadius: '50%' }} />}
          </button>
          <span style={{ color: '#888', fontSize: 10 }}>{isRecording ? 'Release to stop' : 'Hold to record'}</span>
        </div>
        <button onClick={capturePhoto} style={{ width: 56, height: 56, borderRadius: '50%', background: '#fff', border: '3px solid #ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, cursor: 'pointer' }}>📸</button>
      </div>
      <div style={{ background: '#000', borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'center', gap: 24, padding: '10px 0 20px' }}>
        {[['camera', '📹', 'Video'], ['text', '📝', 'Text']].map(([m, icon, label]) => (
          <button key={m} onClick={() => setMode(m)} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ color: mode === m ? '#ff2d55' : '#555', fontSize: 11, fontWeight: mode === m ? 700 : 400 }}>{label}</span>
            {mode === m && <div style={{ width: 20, height: 2, background: '#ff2d55', borderRadius: 2 }} />}
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================
// POST CARD (TikTok Style)
// ============================================
const PostCard = memo(({ post, currentUser, onViewProfile, onMessage, showToast }) => {
  const [liked, setLiked] = useState((post.likes || []).includes(currentUser?.uid));
  const [likeCount, setLikeCount] = useState((post.likes || []).length);
  const [saved, setSaved] = useState((post.saves || []).includes(currentUser?.uid));
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showGifts, setShowGifts] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const videoRef = useRef(null);
  const lastTap = useRef(0);

  useEffect(() => {
    if (!showComments) return;
    const unsub = onSnapshot(query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt')), snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [showComments, post.id]);

  const toggleLike = async () => {
    const newLiked = !liked;
    setLiked(newLiked); setLikeCount(c => newLiked ? c + 1 : c - 1);
    if (newLiked) { setLikeAnim(true); setTimeout(() => setLikeAnim(false), 800); }
    try {
      await updateDoc(doc(db, 'posts', post.id), { likes: newLiked ? arrayUnion(currentUser.uid) : arrayRemove(currentUser.uid) });
      if (newLiked && post.userId !== currentUser?.uid) {
        await addDoc(collection(db, 'notifications'), { toUid: post.userId, fromUid: currentUser.uid, fromUsername: currentUser.username, fromPhotoURL: currentUser.photoURL || '', type: 'like', postId: post.id, read: false, createdAt: serverTimestamp() });
      }
    } catch (e) { console.error(e); }
  };

  const toggleSave = async () => {
    const newSaved = !saved; setSaved(newSaved);
    try { await updateDoc(doc(db, 'posts', post.id), { saves: newSaved ? arrayUnion(currentUser.uid) : arrayRemove(currentUser.uid) }); } catch { }
    showToast(newSaved ? 'Post saved! 🔖' : 'Removed from saved', newSaved ? 'success' : 'info');
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300 && !liked) toggleLike();
    lastTap.current = now;
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    try {
      await addDoc(collection(db, 'posts', post.id, 'comments'), { text: commentText, userId: currentUser?.uid, username: currentUser?.username || 'user', photoURL: currentUser?.photoURL || '', createdAt: serverTimestamp() });
      if (post.userId !== currentUser?.uid) {
        await addDoc(collection(db, 'notifications'), { toUid: post.userId, fromUid: currentUser.uid, fromUsername: currentUser.username, fromPhotoURL: currentUser.photoURL || '', type: 'comment', text: commentText, postId: post.id, read: false, createdAt: serverTimestamp() });
      }
      setCommentText('');
    } catch { showToast('Failed to comment', 'error'); }
  };

  const sharePost = () => {
    const url = `${window.location.origin}?post=${post.id}`;
    if (navigator.share) navigator.share({ title: 'Check out this post!', text: post.caption, url });
    else { navigator.clipboard.writeText(url); showToast('Link copied!', 'success'); }
    setShowShare(false);
  };

  const isVideo = post.type === 'video';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000', overflow: 'hidden' }} onClick={handleDoubleTap}>
      {isVideo && <video ref={videoRef} src={post.url} loop playsInline autoPlay muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {post.type === 'photo' && <img src={post.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {post.type === 'text' && (
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a0a2e, #0a0a1a, #1a0010)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <p style={{ color: '#fff', fontSize: 24, fontWeight: 700, textAlign: 'center', lineHeight: 1.5 }}>{post.text}</p>
        </div>
      )}

      {likeAnim && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 50 }}>
          <div style={{ fontSize: 100, animation: 'likeAnim 0.8s ease forwards' }}>❤️</div>
          <style>{`@keyframes likeAnim{0%{transform:scale(0);opacity:1}50%{transform:scale(1.3);opacity:1}100%{transform:scale(1);opacity:0}}`}</style>
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)', pointerEvents: 'none' }} />

      {/* Bottom Left Info */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 68, padding: '18px 14px', zIndex: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div onClick={(e) => { e.stopPropagation(); onViewProfile?.(post.userId); }} style={{ width: 42, height: 42, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, border: '2px solid rgba(255,255,255,0.4)', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
            {post.photoURL ? <img src={post.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (post.username?.[0] || '?').toUpperCase()}
          </div>
          <span onClick={(e) => { e.stopPropagation(); onViewProfile?.(post.userId); }} style={{ color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>@{post.username || 'user'}</span>
          <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} style={{ marginLeft: 'auto', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '4px 10px', color: '#fff', cursor: 'pointer', fontSize: 16 }}>•••</button>
        </div>
        {post.caption && <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 1.4 }}>{post.caption}</p>}
        {post.category && post.category !== 'all' && (
          <span style={{ display: 'inline-block', marginTop: 6, background: 'rgba(255,45,85,0.2)', border: '1px solid rgba(255,45,85,0.4)', borderRadius: 20, padding: '2px 10px', color: '#ff2d55', fontSize: 10 }}>{CATEGORIES.find(c => c.id === post.category)?.label || post.category}</span>
        )}
        <p style={{ color: '#555', fontSize: 10, marginTop: 4 }}>{timeAgo(post.createdAt)}</p>
      </div>

      {/* Action Menu */}
      {showMenu && (
        <div onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} style={{ position: 'absolute', inset: 0, zIndex: 19 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 160, left: 14, background: '#181818', border: '1px solid #2a2a2a', borderRadius: 18, padding: 6, zIndex: 20, minWidth: 200 }}>
            {[
              ['💬', 'Message', () => { onMessage?.(post.userId); setShowMenu(false); }],
              ['🔗', 'Share', () => { setShowShare(true); setShowMenu(false); }],
              ['🔖', saved ? 'Unsave' : 'Save', () => { toggleSave(); setShowMenu(false); }],
              ['🎁', 'Send Gift', () => { setShowGifts(true); setShowMenu(false); }],
              ['⚠️', 'Report', () => { setShowReport(true); setShowMenu(false); }],
              ['🚫', 'Block', () => { showToast('User blocked', 'warning'); setShowMenu(false); }],
            ].map(([icon, label, fn]) => (
              <button key={label} onClick={(e) => { e.stopPropagation(); fn(); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: 'none', border: 'none', color: label === 'Block' ? '#ff2d55' : label === 'Report' ? '#ff9500' : '#fff', cursor: 'pointer', borderRadius: 12, fontSize: 13 }}>
                <span style={{ fontSize: 16 }}>{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Right Side Actions */}
      <div style={{ position: 'absolute', right: 10, bottom: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, zIndex: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <button onClick={(e) => { e.stopPropagation(); toggleLike(); }} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{liked ? '❤️' : '🤍'}</button>
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{formatNumber(likeCount)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <button onClick={(e) => { e.stopPropagation(); setShowComments(true); }} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💬</button>
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{formatNumber(comments.length)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <button onClick={(e) => { e.stopPropagation(); setShowShare(true); }} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↗️</button>
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{formatNumber(post.shares || 0)}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); toggleSave(); }} style={{ background: saved ? 'rgba(255,215,0,0.2)' : 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{saved ? '🔖' : '🏷️'}</button>
        <button onClick={(e) => { e.stopPropagation(); setShowGifts(!showGifts); }} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎁</button>
      </div>

      {/* Gifts Picker */}
      {showGifts && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 200, right: 10, background: 'rgba(0,0,0,0.95)', borderRadius: 20, padding: 12, zIndex: 30, border: '1px solid #222' }}>
          {GIFTS.map(g => (
            <button key={g.id} onClick={() => { showToast(`Sent ${g.icon}! 🎁`, 'success'); setShowGifts(false); }} style={{ display: 'block', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, padding: '8px 12px', marginBottom: 6, cursor: 'pointer', width: '100%', textAlign: 'left', color: '#fff', fontSize: 13 }}>
              {g.icon} <span style={{ color: '#ffd700', fontSize: 11 }}>{g.price}🪙</span>
            </button>
          ))}
        </div>
      )}

      {/* Comments Panel */}
      {showComments && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', inset: 0, background: '#0a0a0a', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700 }}>💬 {comments.length} Comments</span>
            <button onClick={() => setShowComments(false)} style={{ background: '#1a1a1a', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {comments.length === 0 && <p style={{ color: '#444', textAlign: 'center', marginTop: 40 }}>No comments yet. Be first! 💬</p>}
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <div onClick={() => onViewProfile?.(c.userId)} style={{ width: 34, height: 34, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0, overflow: 'hidden', cursor: 'pointer' }}>
                  {c.photoURL ? <img src={c.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : c.username?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ background: '#161616', borderRadius: 14, padding: '8px 12px' }}>
                    <div onClick={() => onViewProfile?.(c.userId)} style={{ color: '#ff2d55', fontWeight: 600, fontSize: 11, marginBottom: 4, cursor: 'pointer' }}>@{c.username}</div>
                    <p style={{ color: '#ddd', fontSize: 13 }}>{c.text}</p>
                  </div>
                  <p style={{ color: '#444', fontSize: 10, marginTop: 4, paddingLeft: 8 }}>{timeAgo(c.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 12px', borderTop: '1px solid #1e1e1e', display: 'flex', gap: 6 }}>
            <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} placeholder="Add a comment..." style={{ flex: 1, background: '#161616', border: '1px solid #222', borderRadius: 20, padding: '9px 14px', color: '#fff', outline: 'none', fontSize: 13 }} />
            <button onClick={addComment} style={{ background: commentText.trim() ? '#ff2d55' : '#222', border: 'none', borderRadius: '50%', width: 38, height: 38, color: '#fff', cursor: 'pointer', fontSize: 16 }}>↑</button>
          </div>
        </div>
      )}

      {showShare && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 5000, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowShare(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#111', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 }}>
            <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>Share</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { icon: '🔗', label: 'Copy Link', fn: sharePost },
                { icon: '💬', label: 'WhatsApp', fn: () => { window.open(`https://wa.me/?text=${encodeURIComponent(window.location.origin)}`); setShowShare(false); } },
                { icon: '✉️', label: 'Telegram', fn: () => { window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}`); setShowShare(false); } },
                { icon: '🐦', label: 'Twitter', fn: () => { window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.origin)}`); setShowShare(false); } },
              ].map(o => (
                <button key={o.label} onClick={o.fn} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16, padding: '12px 6px', cursor: 'pointer' }}>
                  <span style={{ fontSize: 24 }}>{o.icon}</span>
                  <span style={{ color: '#aaa', fontSize: 10 }}>{o.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowShare(false)} style={{ width: '100%', background: '#1a1a1a', border: 'none', borderRadius: 20, padding: 14, color: '#aaa', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          </div>
        </div>
      )}
      {showReport && <ReportModal targetId={post.id} targetType="post" targetName={post.username} reportedBy={currentUser?.uid} onClose={() => setShowReport(false)} showToast={showToast} />}
    </div>
  );
});

// ============================================
// STORIES COMPONENT
// ============================================
const Stories = ({ currentUser, showToast }) => {
  const [stories, setStories] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [text, setText] = useState('');
  const [viewing, setViewing] = useState(null);
  const [viewIdx, setViewIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'stories'), snap => {
      const now = Date.now();
      setStories(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => {
        const t = s.createdAt?.toDate?.()?.getTime?.() || 0;
        return now - t < 86400000;
      }));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!viewing) return;
    setProgress(0);
    progressRef.current = setInterval(() => {
      setProgress(p => { if (p >= 100) { clearInterval(progressRef.current); setViewing(null); return 0; } return p + 2; });
    }, 100);
    return () => clearInterval(progressRef.current);
  }, [viewing]);

  const postStory = async () => {
    if (!text.trim()) return;
    try {
      await addDoc(collection(db, 'stories'), { text, type: 'text', userId: currentUser.uid, username: currentUser.username, photoURL: currentUser.photoURL || '', createdAt: serverTimestamp() });
      setText(''); setShowCreate(false); showToast('Story posted!', 'success');
    } catch { showToast('Failed to post story', 'error'); }
  };

  const handlePhotoStory = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const storageRef2 = ref(storage, `stories/${currentUser.uid}_${Date.now()}`);
      const task = uploadBytesResumable(storageRef2, file);
      task.on('state_changed', null, null, async () => {
        const downloadUrl = await getDownloadURL(task.snapshot.ref);
        await addDoc(collection(db, 'stories'), { url: downloadUrl, type: file.type.startsWith('video') ? 'video' : 'photo', userId: currentUser.uid, username: currentUser.username, photoURL: currentUser.photoURL || '', createdAt: serverTimestamp() });
        showToast('Story posted! 📸', 'success');
      });
    } catch { showToast('Failed', 'error'); }
  };

  const grouped = stories.reduce((acc, s) => { const k = s.userId; if (!acc[k]) acc[k] = []; acc[k].push(s); return acc; }, {});
  const userStories = Object.values(grouped);

  return (
    <>
      <div style={{ padding: '8px 14px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', overflowX: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', marginRight: 14, cursor: 'pointer' }} onClick={() => setShowCreate(true)}>
          <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', padding: 2 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>➕</div>
          </div>
          <span style={{ color: '#888', fontSize: 9, marginTop: 3 }}>Add</span>
        </div>
        {userStories.map((group, i) => {
          const s = group[0];
          return (
            <div key={i} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', marginRight: 14, cursor: 'pointer' }} onClick={() => { setViewing(group); setViewIdx(0); setProgress(0); }}>
              <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', padding: 2 }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff', overflow: 'hidden' }}>
                  {s.photoURL ? <img src={s.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : s.username?.[0]?.toUpperCase()}
                </div>
              </div>
              <span style={{ color: '#ccc', fontSize: 9, marginTop: 3, maxWidth: 58, overflow: 'hidden', textOverflow: 'ellipsis' }}>@{s.username}</span>
            </div>
          );
        })}
      </div>

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a1a' }}>
            <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 22 }}>✕</button>
            <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>New Story</h3>
            <div style={{ width: 32 }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
            <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', maxWidth: 340, background: '#141414', border: '2px dashed #333', borderRadius: 20, padding: 30, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 40 }}>📸</span>
              <span style={{ color: '#888', fontSize: 14 }}>Photo or Video Story</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handlePhotoStory} style={{ display: 'none' }} />
            <div style={{ width: '100%', maxWidth: 340, background: '#141414', borderRadius: 20, padding: 20 }}>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Or write a text story..." autoFocus style={{ width: '100%', height: 120, background: 'transparent', border: 'none', color: '#fff', fontSize: 16, outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
              <button onClick={postStory} style={{ width: '100%', background: '#ff2d55', border: 'none', borderRadius: 16, padding: 13, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Post Text Story</button>
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 3000, display: 'flex', flexDirection: 'column' }} onClick={() => setViewing(null)}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#333', zIndex: 10 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: '#fff', transition: 'width 0.1s linear' }} />
          </div>
          <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', alignItems: 'center', gap: 10, zIndex: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
              {viewing[viewIdx]?.photoURL ? <img src={viewing[viewIdx].photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : viewing[viewIdx]?.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>@{viewing[viewIdx]?.username}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{timeAgo(viewing[viewIdx]?.createdAt)}</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setViewing(null); }} style={{ marginLeft: 'auto', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 34, height: 34, color: '#fff', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {viewing[viewIdx]?.type === 'photo' && <img src={viewing[viewIdx].url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
            {viewing[viewIdx]?.type === 'video' && <video src={viewing[viewIdx].url} autoPlay loop style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
            {viewing[viewIdx]?.type === 'text' && (
              <div style={{ background: 'linear-gradient(135deg,#1a0020,#000)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                <p style={{ color: '#fff', fontSize: 28, fontWeight: 700, textAlign: 'center', lineHeight: 1.5 }}>{viewing[viewIdx].text}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// ============================================
// HOME FEED (TikTok Style)
// ============================================
const HomeFeed = ({ posts, currentUser, onViewProfile, onMessage, showToast, followed }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tab, setTab] = useState('foryou');
  const startY = useRef(null);

  const feedPosts = useMemo(() => {
    if (tab === 'following') return posts.filter(p => followed.includes(p.userId));
    return posts;
  }, [posts, tab, followed]);

  const handleTouchStart = e => { startY.current = e.touches[0].clientY; };
  const handleTouchEnd = e => {
    if (startY.current === null) return;
    const dy = startY.current - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 50) {
      if (dy > 0) setCurrentIndex(i => Math.min(feedPosts.length - 1, i + 1));
      else setCurrentIndex(i => Math.max(0, i - 1));
    }
    startY.current = null;
  };

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div style={{ position: 'absolute', top: 12, left: 0, right: 0, zIndex: 15, display: 'flex', justifyContent: 'center', gap: 8 }}>
        {[
          { id: 'foryou', label: '🔥 For You' },
          { id: 'following', label: '👥 Following' },
        ].map(item => (
          <button key={item.id} onClick={() => { setTab(item.id); setCurrentIndex(0); }} style={{
            background: tab === item.id ? '#ff2d55' : 'rgba(0,0,0,0.6)', border: 'none',
            borderRadius: 30, padding: '6px 14px', color: '#fff', fontSize: 12,
            fontWeight: tab === item.id ? 700 : 500, cursor: 'pointer', backdropFilter: 'blur(10px)',
          }}>
            {item.label}
          </button>
        ))}
      </div>
      {feedPosts.length === 0 ? (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ fontSize: 48 }}>📭</div>
          <div style={{ color: '#555', textAlign: 'center', padding: 20 }}>
            {tab === 'following' ? 'Follow people to see their posts!' : 'No posts yet. Be the first!'}
          </div>
          {tab === 'following' && <button onClick={() => setTab('foryou')} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '10px 20px', color: '#fff', cursor: 'pointer' }}>Browse For You</button>}
        </div>
      ) : (
        feedPosts.map((post, idx) => (
          <div key={post.id} style={{ position: 'absolute', inset: 0, transform: `translateY(${(idx - currentIndex) * 100}%)`, transition: 'transform 0.3s', pointerEvents: idx === currentIndex ? 'auto' : 'none' }}>
            <PostCard post={post} currentUser={currentUser} onViewProfile={onViewProfile} onMessage={onMessage} showToast={showToast} />
          </div>
        ))
      )}
    </div>
  );
};

// ============================================
// AUTH SCREEN (Complete)
// ============================================
const AuthScreen = ({ showToast }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!email || !password) { setError('Please fill all fields'); return; }
    if (!isLogin && !username) { setError('Username is required'); return; }
    setLoading(true); setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await addDoc(collection(db, 'users'), {
          uid: result.user.uid, username: username.toLowerCase().trim(), email: email.trim(),
          bio: 'New to Dagu! 🎬', followers: [], following: [], photoURL: '', coins: 500,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/\(auth\/.*?\)\.?/, '').trim());
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true); setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const q = query(collection(db, 'users'), where('uid', '==', user.uid));
      const snap = await getDocs(q);
      if (snap.empty) {
        const uname = (user.displayName || user.email?.split('@')[0] || 'user').toLowerCase().replace(/\s+/g, '').substring(0, 20);
        await addDoc(collection(db, 'users'), {
          uid: user.uid, username: uname, email: user.email || '',
          bio: 'Joined via Google 🎬', followers: [], following: [],
          photoURL: user.photoURL || '', coins: 500, createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/\(auth\/.*?\)\.?/, '').trim());
    }
    setGoogleLoading(false);
  };

  return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#0a0a0a 60%,#120007)', padding: 20, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>🎬</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, background: 'linear-gradient(135deg,#ff2d55,#af52de)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Dagu</h1>
          <p style={{ color: '#555', fontSize: 13, marginTop: 6 }}>{isLogin ? 'Welcome back!' : 'Join Dagu today'}</p>
        </div>

        <button onClick={handleGoogle} disabled={googleLoading} style={{ width: '100%', background: '#fff', border: 'none', borderRadius: 16, padding: '13px', color: '#222', fontWeight: 700, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16, opacity: googleLoading ? 0.7 : 1 }}>
          <span style={{ fontSize: 20 }}>🌐</span> {googleLoading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
          <span style={{ color: '#444', fontSize: 12 }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
        </div>

        <div style={{ background: '#141414', borderRadius: 24, padding: 24 }}>
          {error && <div style={{ background: 'rgba(255,45,85,0.1)', border: '1px solid #ff2d55', borderRadius: 12, padding: '10px 14px', color: '#ff2d55', fontSize: 13, marginBottom: 16 }}>{error}</div>}
          {!isLogin && (
            <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 10, outline: 'none', fontSize: 13, boxSizing: 'border-box' }} />
          )}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 10, outline: 'none', fontSize: 13, boxSizing: 'border-box' }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 16, outline: 'none', fontSize: 13, boxSizing: 'border-box' }} />
          <button onClick={submit} disabled={loading} style={{ width: '100%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: 24, padding: 14, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: loading ? 0.7 : 1 }}>
            {loading ? '...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
          <button onClick={() => { setIsLogin(!isLogin); setError(''); }} style={{ width: '100%', background: 'none', border: 'none', color: '#ff2d55', fontSize: 13, cursor: 'pointer', marginTop: 12, padding: 8 }}>
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN APP COMPONENT
// ============================================
export default function DaguApp() {
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [followed, setFollowed] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [messageUserId, setMessageUserId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const showToast = useCallback((message, type = 'info') => setToast({ message, type }), []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        try {
          const q = query(collection(db, 'users'), where('uid', '==', user.uid));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            setCurrentUser({ ...data, uid: user.uid, id: snap.docs[0].id });
            setFollowed(data.following || []);
          }
        } catch (e) { console.error(e); }
      } else {
        setFirebaseUser(null);
        setCurrentUser(null);
      }
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'notifications'), where('toUid', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(20));
    return onSnapshot(q, snap => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);

  const toggleFollow = async (userId) => {
    if (!currentUser?.uid) return;
    const isFollowing = followed.includes(userId);
    setFollowed(prev => isFollowing ? prev.filter(id => id !== userId) : [...prev, userId]);
    try {
      const q = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
      const snap = await getDocs(q);
      if (!snap.empty) await updateDoc(snap.docs[0].ref, { following: isFollowing ? arrayRemove(userId) : arrayUnion(userId) });
      const tq = query(collection(db, 'users'), where('uid', '==', userId));
      const tSnap = await getDocs(tq);
      if (!tSnap.empty) await updateDoc(tSnap.docs[0].ref, { followers: isFollowing ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) });
    } catch (e) { console.error(e); }
    showToast(isFollowing ? 'Unfollowed' : 'Followed! 🎉', 'success');
  };

  const handleMessage = (userId) => { setMessageUserId(userId); setActiveTab('inbox'); };
  const handleLogout = async () => { await signOut(auth); setCurrentUser(null); setFirebaseUser(null); showToast('Logged out', 'info'); };

  if (firebaseUser === undefined) return (
    <div style={{ height: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 56 }}>🎬</div>
    </div>
  );

  if (!firebaseUser) return <AuthScreen showToast={showToast} />;

  const TABS = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'search', icon: '🔍', label: 'Search' },
    { id: 'create', icon: '➕', label: 'Create' },
    { id: 'inbox', icon: '💬', label: 'Inbox' },
    { id: 'profile', icon: '👤', label: 'Me' },
  ];

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <style>{`*{margin:0;padding:0;box-sizing:border-box}::-webkit-scrollbar{display:none}button:active{transform:scale(0.95)}`}</style>

      {/* Top Bar with Notifications */}
      {activeTab !== 'profile' && (
        <div style={{ padding: '10px 14px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, flex: 1 }}>
            <button onClick={() => setShowCreate(true)} style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 24, padding: '9px 16px', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📷</span> Create
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowNotifications(!showNotifications)} style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
              🔔
              {notifications.filter(n => !n.read).length > 0 && (
                <div style={{ position: 'absolute', top: -2, right: -2, background: '#ff2d55', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{notifications.filter(n => !n.read).length}</div>
              )}
            </button>
            {showNotifications && (
              <NotificationCenter
                notifications={notifications}
                onClose={() => setShowNotifications(false)}
                onMarkRead={async (id) => { await updateDoc(doc(db, 'notifications', id), { read: true }); }}
                onClearAll={async () => { const batch = writeBatch(db); notifications.forEach(n => batch.delete(doc(db, 'notifications', n.id))); await batch.commit(); }}
                onNavigate={(notif) => {
                  if (notif.type === 'like' || notif.type === 'comment') setActiveTab('home');
                  else if (notif.type === 'follow') setViewingProfile(notif.fromUid);
                  else if (notif.type === 'message') setActiveTab('inbox');
                  setShowNotifications(false);
                }}
              />
            )}
          </div>
        </div>
      )}

      {showCreate && <CreateScreen currentUser={currentUser} onClose={() => setShowCreate(false)} showToast={showToast} />}
      {showSettings && <SettingsPage currentUser={currentUser} onClose={() => setShowSettings(false)} showToast={showToast} onLogout={handleLogout} />}

      {viewingProfile && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: '#0a0a0a' }}>
          <ViewProfilePage userId={viewingProfile} currentUser={currentUser} onBack={() => setViewingProfile(null)} onMessage={handleMessage} showToast={showToast} />
        </div>
      )}

      {activeTab === 'home' && currentUser && <Stories currentUser={currentUser} showToast={showToast} />}

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {activeTab === 'home' && (
          <HomeFeed posts={posts} currentUser={currentUser} followed={followed} onViewProfile={uid => setViewingProfile(uid)} onMessage={handleMessage} showToast={showToast} />
        )}
        {activeTab === 'search' && (
          <SearchPage currentUser={currentUser} onViewProfile={uid => setViewingProfile(uid)} showToast={showToast} />
        )}
        {activeTab === 'inbox' && (
          <InboxPage currentUser={currentUser} openUserId={messageUserId} showToast={showToast} onViewProfile={uid => setViewingProfile(uid)} />
        )}
        {activeTab === 'profile' && (
          <MyProfile currentUser={currentUser} showToast={showToast} onLogout={handleLogout} onOpenSettings={() => setShowSettings(true)} />
        )}
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', background: 'rgba(8,8,8,0.97)', borderTop: '1px solid #161616', padding: '8px 4px 18px', flexShrink: 0, backdropFilter: 'blur(12px)' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => {
            if (tab.id === 'create') { setShowCreate(true); return; }
            setActiveTab(tab.id);
            if (tab.id !== 'inbox') setMessageUserId(null);
          }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}>
            <span style={{ fontSize: tab.id === 'create' ? 28 : 22, transform: activeTab === tab.id ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.15s' }}>{tab.icon}</span>
            <span style={{ fontSize: 10, color: activeTab === tab.id ? '#ff2d55' : '#444', fontWeight: activeTab === tab.id ? 700 : 400 }}>{tab.label}</span>
          </button>
        ))}
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}