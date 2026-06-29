'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { signOutCurrent } from '@/lib/firebase/auth';
import { Avatar } from '@/components/Avatar';
import { fetchUserVideos } from '@/lib/firebase/videos';
import { getIdToken } from '@/lib/firebase/auth';
import { useQuery } from '@tanstack/react-query';
import { doc, updateDoc, getDoc, getDocs, collection, query, where, orderBy } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase/client';
import { uploadFile } from '@/lib/firebase/upload';
import { formatCount } from '@/lib/utils/cn';
import type { VideoPost } from '@/types';

type Tab = 'posts' | 'liked' | 'saved';

// ─── Followers / Following Modal ───────────────────────────────────────────
function FollowListModal({ title, userIds, onClose }: { title: string; userIds: string[]; onClose: () => void }) {
  const [users, setUsers] = useState<Array<{ id: string; username: string; avatarColor: string; avatarUrl: string | null; verified: boolean }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const results = await Promise.all(
        userIds.slice(0, 50).map(async id => {
          const snap = await getDoc(doc(firebaseDb(), 'users', id));
          return snap.exists() ? { id, ...snap.data() } as any : null;
        })
      );
      setUsers(results.filter(Boolean));
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', background: '#FFFFFF', borderRadius: '24px 24px 0 0', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{title} ({userIds.length})</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(0,0,0,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: 12 }}>
          {loading && <div style={{ textAlign: 'center', padding: 32, color: 'rgba(0,0,0,0.4)' }}>Loading…</div>}
          {!loading && users.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'rgba(0,0,0,0.4)' }}>No users yet</div>
          )}
          {users.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <Avatar name={u.username} color={u.avatarColor} src={u.avatarUrl} size="md" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>@{u.username}</div>
              </div>
              {u.verified && <span style={{ fontSize: 16 }}>✅</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <input value={val} onChange={e => set(e.target.value)} placeholder={placeholder} maxLength={maxLen}
        style={{ width: '100%', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.09)', borderRadius: 12, padding: '12px 14px', color: '#1A1A1A', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', background: '#FFFFFF', borderRadius: '24px 24px 0 0', padding: 20, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(0,0,0,0.4)', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Edit Profile</span>
          <button onClick={save} disabled={saving} style={{ background: 'linear-gradient(135deg,#3D6B4F,#5A9A6F)', border: 'none', color: 'white', borderRadius: 999, padding: '8px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Avatar name={user?.username ?? '?'} color={user?.avatarColor} src={user?.avatarUrl} size="xl" />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              style={{ position: 'absolute', bottom: 0, right: 0, background: 'linear-gradient(135deg,#3D6B4F,#5A9A6F)', border: '2px solid #FFFFFF', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              {uploading ? '⏳' : '📷'}
            </button>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', marginTop: 8 }}>Tap camera to change photo</div>
        </div>

        {inp('Username', username, setUsername, 'username', 20)}
        {inp('Full Name', fullName, setFullName, 'Your name', 50)}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginBottom: 4, fontWeight: 600 }}>Bio</div>
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell your story…" maxLength={150} rows={3}
            style={{ width: '100%', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.09)', borderRadius: 12, padding: '12px 14px', color: '#1A1A1A', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          <div style={{ textAlign: 'right', fontSize: 11, color: 'rgba(0,0,0,0.35)' }}>{bio.length}/150</div>
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
  const setUser = useAuthStore(s => s.setUser);
  const signOut = useAuthStore(s => s.signOut);
  const showToast = useUIStore(s => s.showToast);
  const [tab, setTab] = useState<Tab>('posts');
  const [showEdit, setShowEdit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  const { data: posts = [], refetch: refetchPosts } = useQuery<VideoPost[]>({
    queryKey: ['userVideos', user?.id],
    queryFn: () => user ? fetchUserVideos(user.id) : [],
    enabled: !!user,
  });

  const { data: likedPosts = [] } = useQuery<VideoPost[]>({
    queryKey: ['likedVideos', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const likeSnap = await getDocs(
        query(collection(firebaseDb(), 'likes'), where('userId', '==', user.id))
      );
      const videoIds = likeSnap.docs.map(d => d.data().videoId as string);
      if (!videoIds.length) return [];
      // Fetch in batches of 10 (Firestore 'in' limit)
      const batches = [];
      for (let i = 0; i < videoIds.length; i += 10) {
        batches.push(videoIds.slice(i, i + 10));
      }
      const results = await Promise.all(
        batches.map(batch =>
          getDocs(query(collection(firebaseDb(), 'videos'), where('__name__', 'in', batch)))
        )
      );
      return results.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() } as VideoPost)));
    },
    enabled: !!user,
  });

  const { data: savedPosts = [] } = useQuery<VideoPost[]>({
    queryKey: ['savedVideos', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const saveSnap = await getDocs(
        query(collection(firebaseDb(), 'saves'), where('userId', '==', user.id))
      );
      const videoIds = saveSnap.docs.map(d => d.data().videoId as string);
      if (!videoIds.length) return [];
      const batches = [];
      for (let i = 0; i < videoIds.length; i += 10) {
        batches.push(videoIds.slice(i, i + 10));
      }
      const results = await Promise.all(
        batches.map(batch =>
          getDocs(query(collection(firebaseDb(), 'videos'), where('__name__', 'in', batch)))
        )
      );
      return results.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() } as VideoPost)));
    },
    enabled: !!user,
  });

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDeletePost = async (postId: string) => {
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/videos/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      refetchPosts();
      showToast('Post deleted', 'info');
    } catch { showToast('Delete failed', 'error'); }
    finally { setDeleteTarget(null); }
  };

  const handleLogout = async () => {
    try { await signOutCurrent(); signOut(); showToast('Signed out', 'info'); }
    catch { showToast('Sign-out failed', 'error'); }
  };

  const shareProfile = () => {
    const url = `${window.location.origin}?u=${user?.username}`;
    if (navigator.share) {
      navigator.share({ title: `@${user?.username} on Infinity`, url });
    } else {
      navigator.clipboard?.writeText(url);
      showToast('Profile link copied! 🔗', 'success');
    }
  };

  if (!user) return null;

  const totalViews = posts.reduce((sum, p) => sum + (p.views ?? 0), 0);
  const totalLikes = posts.reduce((sum, p) => sum + (p.likes ?? 0), 0);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#F8F7F4' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(245,245,247,0.97)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1A1A1A', margin: 0 }}>Profile</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowEdit(true)} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', color: '#3D6B4F', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D6B4F" strokeWidth="2.5" style={{ marginRight: 4, verticalAlign: 'middle' }}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button onClick={() => setShowSettings(s => !s)} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', color: '#6B7280', borderRadius: 12, padding: '8px 12px', cursor: 'pointer', fontSize: 18 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </div>

      {/* Settings dropdown */}
      {showSettings && (
        <div style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '4px 0' }}>
          {[
            { label: `${user.theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}`, action: async () => {
              const newTheme = user.theme === 'dark' ? 'light' : 'dark';
              await updateDoc(doc(firebaseDb(), 'users', user.id), { theme: newTheme });
              setUser({ ...user, theme: newTheme });
              showToast(`Switched to ${newTheme} mode`, 'info');
            }},
            { label: 'Privacy Policy', action: () => window.open('/privacy', '_blank') },
            { label: 'Sign Out', action: handleLogout, danger: true },
          ].map(item => (
            <button key={item.label} onClick={() => { item.action(); setShowSettings(false); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '13px 20px', background: 'none', border: 'none', color: (item as any).danger ? '#EF4444' : '#1A1A1A', fontSize: 14, cursor: 'pointer', textAlign: 'left', fontWeight: 500 }}>
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Profile card */}
      <div style={{ margin: '12px', background: '#FFFFFF', borderRadius: 24, padding: '24px 20px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ margin: '0 auto', width: 'fit-content', position: 'relative', marginBottom: 12 }}>
          <Avatar name={user.username} color={user.avatarColor} src={user.avatarUrl} size="xl" ring />
          {user.verified && <span style={{ position: 'absolute', bottom: 2, right: 2, fontSize: 16 }}>✅</span>}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1A1A1A', margin: '0 0 2px' }}>You</h2>
        <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 6 }}>@{user.username}</div>
        {user.bio && <p style={{ color: '#6B7280', fontSize: 13, lineHeight: 1.6, maxWidth: 260, margin: '0 auto 12px' }}>{user.bio}</p>}
        {user.link && (
          <a href={user.link} target="_blank" rel="noopener noreferrer" style={{ color: '#3D6B4F', fontSize: 13, display: 'block', marginBottom: 12 }}>
            {user.link.replace('https://', '')}
          </a>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 12 }}>
          {[
            { label: 'Posts', val: posts.length, onClick: undefined },
            { label: 'Followers', val: user.followers.length, onClick: () => setShowFollowers(true) },
            { label: 'Following', val: user.following.length, onClick: () => setShowFollowing(true) },
          ].map(({ label, val, onClick }) => (
            <button key={label} onClick={onClick}
              style={{ textAlign: 'center', background: 'none', border: 'none', cursor: onClick ? 'pointer' : 'default', padding: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1A1A1A' }}>{formatCount(val)}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{label}</div>
            </button>
          ))}
        </div>
        {(totalViews > 0 || totalLikes > 0) && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{formatCount(totalViews)}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>Total views</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#E24B4A' }}>{formatCount(totalLikes)}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>Total likes</div>
            </div>
          </div>
        )}

        {/* XP bar */}
        <div style={{ background: '#EBF3EE', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>💎</span>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#3D6B4F' }}>Level 12 · Explorer</div>
            <div style={{ height: 6, background: 'rgba(61,107,79,0.2)', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${((user.coins ?? 2360) / 3600) * 100}%`, background: '#3D6B4F', borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{user.coins ?? 2360} / 3,600 XP</div>
          </div>
        </div>
      </div>

      {/* My spaces */}
      <div style={{ margin: '0 12px 12px', background: '#FFFFFF', borderRadius: 20, padding: '16px', border: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1A1A1A' }}>My spaces</span>
          <button style={{ background: 'none', border: 'none', color: '#3D6B4F', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>See all</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: '#F8F7F4', borderRadius: 14, padding: '14px' }}>
            <div style={{ fontSize: 12, color: '#3D6B4F', fontWeight: 700 }}>My thoughts</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{posts.length} posts</div>
          </div>
          <div style={{ background: '#F8F7F4', borderRadius: 14, padding: '14px' }}>
            <div style={{ fontSize: 12, color: '#3D6B4F', fontWeight: 700 }}>Goals</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>7 goals</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', margin: '0 12px', background: '#FFFFFF', borderRadius: 14, padding: 4, marginBottom: 8, border: '1px solid rgba(0,0,0,0.06)' }}>
        {([['posts', 'Posts'], ['liked', 'Liked'], ['saved', 'Saved']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '8px', background: tab === t ? '#3D6B4F' : 'none', border: 'none', borderRadius: 10, color: tab === t ? 'white' : '#6B7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ padding: '4px 12px 80px' }}>
        {tab === 'posts' && (
          posts.length === 0
            ? <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9CA3AF', background: '#FFFFFF', borderRadius: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✏️</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>No posts yet. Share something!</div>
              </div>
            : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                {posts.map(p => (
                  <div key={p.id} style={{ position: 'relative', aspectRatio: '1', background: '#E8E7EE', overflow: 'hidden', borderRadius: 12 }}>
                    {p.media?.kind === 'image' || p.images
                      ? <img src={p.images?.[0] ?? p.media?.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      : <video src={p.media?.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent 60%)' }} />
                    <div style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 9, fontWeight: 700, color: 'white' }}>{formatCount(p.views)} views</div>
                    <button
                      onClick={() => setDeleteTarget(p.id)}
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.55)', border: 'none', color: 'white', borderRadius: 6, width: 22, height: 22, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >✕</button>
                  </div>
                ))}
              </div>
        )}
        {tab === 'liked' && (
          likedPosts.length === 0
            ? <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9CA3AF', background: '#FFFFFF', borderRadius: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>❤️</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Posts you liked appear here</div>
              </div>
            : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                {likedPosts.map(p => (
                  <div key={p.id} style={{ position: 'relative', aspectRatio: '1', background: '#E8E7EE', overflow: 'hidden', borderRadius: 12 }}>
                    {p.media?.kind === 'image' || p.images
                      ? <img src={p.images?.[0] ?? p.media?.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      : <video src={p.media?.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent 60%)' }} />
                    <div style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 9, fontWeight: 700, color: 'white' }}>{formatCount(p.views)} views</div>
                    <button
                      onClick={() => setDeleteTarget(p.id)}
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.55)', border: 'none', color: 'white', borderRadius: 6, width: 22, height: 22, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >✕</button>
                  </div>
                ))}
              </div>
        )}
        {tab === 'saved' && (
          savedPosts.length === 0
            ? <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9CA3AF', background: '#FFFFFF', borderRadius: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔖</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Saved posts appear here</div>
              </div>
            : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                {savedPosts.map(p => (
                  <div key={p.id} style={{ position: 'relative', aspectRatio: '1', background: '#E8E7EE', overflow: 'hidden', borderRadius: 12 }}>
                    {p.media?.kind === 'image' || p.images
                      ? <img src={p.images?.[0] ?? p.media?.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      : <video src={p.media?.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent 60%)' }} />
                    <div style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 9, fontWeight: 700, color: 'white' }}>{formatCount(p.views)} views</div>
                    <button
                      onClick={() => setDeleteTarget(p.id)}
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.55)', border: 'none', color: 'white', borderRadius: 6, width: 22, height: 22, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >✕</button>
                  </div>
                ))}
              </div>
        )}
      </div>

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 24, maxWidth: 300, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Delete post?</div>
            <div style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 20 }}>This can't be undone.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '12px', background: '#F8F7F4', border: 'none', borderRadius: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDeletePost(deleteTarget)} style={{ flex: 1, padding: '12px', background: '#EF4444', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {showEdit && <EditProfileModal onClose={() => setShowEdit(false)} />}
      {showFollowers && <FollowListModal title="Followers" userIds={user.followers} onClose={() => setShowFollowers(false)} />}
      {showFollowing && <FollowListModal title="Following" userIds={user.following} onClose={() => setShowFollowing(false)} />}
    </div>
  );
}
