'use client';
import { useState, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { signOutCurrent } from '@/lib/firebase/auth';
import { Avatar } from '@/components/Avatar';
import { fetchUserVideos } from '@/lib/firebase/videos';
import { useQuery } from '@tanstack/react-query';
import { doc, updateDoc } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase/client';
import { uploadFile } from '@/lib/firebase/upload';
import { formatCount } from '@/lib/utils/cn';
import type { VideoPost } from '@/types';

type Tab = 'posts' | 'liked' | 'saved';

// ─── Edit Profile Modal ────────────────────────────────────────────────────
function EditProfileModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const showToast = useUIStore(s => s.showToast);
  const [username, setUsername] = useState(user?.username ?? '');
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [link, setLink] = useState(user?.link ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const { url } = await uploadFile(file);
      await updateDoc(doc(firebaseDb(), 'users', user.id), { avatarUrl: url });
      setUser({ ...user, avatarUrl: url });
      showToast('Photo updated! 📸', 'success');
    } catch { showToast('Upload failed', 'error'); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!user) return;
    if (username.length < 3) { showToast('Username too short', 'error'); return; }
    setSaving(true);
    try {
      await updateDoc(doc(firebaseDb(), 'users', user.id), { username, fullName, bio, link });
      setUser({ ...user, username, fullName, bio, link });
      showToast('Profile updated! ✨', 'success');
      onClose();
    } catch { showToast('Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const inp = (label: string, val: string, set: (v: string) => void, placeholder = '', maxLen = 100) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <input value={val} onChange={e => set(e.target.value)} placeholder={placeholder} maxLength={maxLen}
        style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 14px', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', background: '#1C1C24', borderRadius: '24px 24px 0 0', padding: 20, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Edit Profile</span>
          <button onClick={save} disabled={saving} style={{ background: 'linear-gradient(135deg,#FF2156,#9D4EDD)', border: 'none', color: 'white', borderRadius: 999, padding: '8px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* Avatar */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Avatar name={user?.username ?? '?'} color={user?.avatarColor} src={user?.avatarUrl} size="xl" />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              style={{ position: 'absolute', bottom: 0, right: 0, background: 'linear-gradient(135deg,#FF2156,#9D4EDD)', border: '2px solid #1C1C24', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              {uploading ? '⏳' : '📷'}
            </button>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Tap camera to change photo</div>
        </div>

        {inp('Username', username, setUsername, 'username', 20)}
        {inp('Full Name', fullName, setFullName, 'Your name', 50)}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4, fontWeight: 600 }}>Bio</div>
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell your story…" maxLength={150} rows={3}
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 14px', color: 'white', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          <div style={{ textAlign: 'right', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{bio.length}/150</div>
        </div>
        {inp('Link', link, setLink, 'https://yoursite.com', 100)}

        <input ref={fileRef} type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])} style={{ display: 'none' }} />
      </div>
    </div>
  );
}

// ─── Main Profile Screen ───────────────────────────────────────────────────
export function ProfileScreen() {
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);
  const showToast = useUIStore(s => s.showToast);
  const [tab, setTab] = useState<Tab>('posts');
  const [showEdit, setShowEdit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { data: posts = [] } = useQuery<VideoPost[]>({
    queryKey: ['userVideos', user?.id],
    queryFn: () => user ? fetchUserVideos(user.id) : [],
    enabled: !!user,
  });

  const handleLogout = async () => {
    try { await signOutCurrent(); signOut(); showToast('Signed out', 'info'); }
    catch { showToast('Sign-out failed', 'error'); }
  };

  if (!user) return null;

  const totalViews = posts.reduce((sum, p) => sum + (p.views ?? 0), 0);
  const totalLikes = posts.reduce((sum, p) => sum + (p.likes ?? 0), 0);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0B0B0F' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h1 style={{ fontSize: 18, fontWeight: 900 }}>@{user.username}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowEdit(true)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>✏️ Edit</button>
          <button onClick={() => setShowSettings(s => !s)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>⚙️</button>
        </div>
      </div>

      {/* Settings dropdown */}
      {showSettings && (
        <div style={{ background: '#1C1C24', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '8px 0' }}>
          {[
            { label: '🔔 Notifications', action: () => showToast('Coming soon', 'info') },
            { label: '🔒 Privacy', action: () => showToast('Coming soon', 'info') },
            { label: '🌙 Theme', action: () => showToast('Coming soon', 'info') },
            { label: '❓ Help', action: () => showToast('Coming soon', 'info') },
            { label: '🚪 Sign Out', action: handleLogout, danger: true },
          ].map(item => (
            <button key={item.label} onClick={() => { item.action(); setShowSettings(false); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '12px 20px', background: 'none', border: 'none', color: (item as any).danger ? '#FF453A' : 'white', fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Profile info */}
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <div style={{ margin: '0 auto', width: 'fit-content', position: 'relative' }}>
          <Avatar name={user.username} color={user.avatarColor} src={user.avatarUrl} size="xl" ring />
          {user.verified && <span style={{ position: 'absolute', bottom: 2, right: 2, fontSize: 18 }}>✅</span>}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 900, marginTop: 12 }}>@{user.username}</h2>
        {user.fullName && <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 2, fontSize: 15 }}>{user.fullName}</p>}
        {user.bio && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 6, lineHeight: 1.5, maxWidth: 280, margin: '6px auto 0' }}>{user.bio}</p>}
        {user.link && <a href={user.link} target="_blank" rel="noopener noreferrer" style={{ color: '#FF2156', fontSize: 13, marginTop: 6, display: 'block' }}>{user.link}</a>}

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-around', background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, margin: '16px 0', border: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            ['Posts', posts.length],
            ['Followers', user.followers.length],
            ['Following', user.following.length],
          ].map(([label, val], i, arr) => (
            <div key={String(label)} style={{ textAlign: 'center', flex: 1, borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{formatCount(Number(val))}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Mini analytics */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <div style={{ background: 'rgba(255,33,86,0.08)', border: '1px solid rgba(255,33,86,0.15)', borderRadius: 12, padding: '10px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#FF2156' }}>{formatCount(totalViews)}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Total Views</div>
          </div>
          <div style={{ background: 'rgba(157,78,221,0.08)', border: '1px solid rgba(157,78,221,0.15)', borderRadius: 12, padding: '10px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#9D4EDD' }}>{formatCount(totalLikes)}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Total Likes</div>
          </div>
          <div style={{ background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.15)', borderRadius: 12, padding: '10px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0A84FF' }}>{user.coins ?? 0}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Coins 🪙</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {([['posts', '🎬'], ['liked', '❤️'], ['saved', '🔖']] as const).map(([t, icon]) => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '14px', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #FF2156' : '2px solid transparent', color: tab === t ? 'white' : 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {icon} {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Grid */}
      {posts.length === 0
        ? <div style={{ textAlign: 'center', padding: '48px 24px', color: 'rgba(255,255,255,0.4)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
            <div style={{ fontSize: 14 }}>No posts yet. Tap + to create!</div>
          </div>
        : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, padding: 2 }}>
            {posts.map(p => (
              <div key={p.id} style={{ position: 'relative', aspectRatio: '9/16', background: '#1C1C24', overflow: 'hidden', borderRadius: 4 }}>
                {p.media.kind === 'image' || p.images
                  ? <img src={p.images?.[0] ?? p.media.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  : <video src={p.media.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent 50%)' }} />
                <div style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 10, fontWeight: 700, color: 'white' }}>{formatCount(p.views)} 👁</div>
                {p.likes > 0 && <div style={{ position: 'absolute', bottom: 4, right: 6, fontSize: 10, fontWeight: 700, color: 'white' }}>{formatCount(p.likes)} ❤️</div>}
              </div>
            ))}
          </div>}

      {showEdit && <EditProfileModal onClose={() => setShowEdit(false)} />}
    </div>
  );
}
