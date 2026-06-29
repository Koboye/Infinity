'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Avatar } from '@/components/Avatar';
import {
  collection, onSnapshot, orderBy, query,
  where, updateDoc, doc, writeBatch,
} from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase/client';

export interface AppNotification {
  id: string;
  userId: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatar: string;
  fromAvatarColor: string;
  fromAvatarUrl: string | null;
  type: 'like' | 'comment' | 'follow' | 'mention';
  message: string;
  videoId?: string;
  videoUrl?: string;
  read: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<AppNotification['type'], string> = {
  like: '❤️', comment: '💬', follow: '👤', mention: '📣',
};

const TYPE_COLOR: Record<AppNotification['type'], string> = {
  like: 'rgba(255,33,86,0.12)', comment: 'rgba(10,132,255,0.12)',
  follow: 'rgba(46,213,115,0.12)', mention: 'rgba(255,159,10,0.12)',
};

function timeAgoShort(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// Group consecutive notifications of same type from same user
function groupNotifications(notifs: AppNotification[]): Array<AppNotification & { count?: number }> {
  const result: Array<AppNotification & { count?: number }> = [];
  for (const n of notifs) {
    const last = result[result.length - 1];
    if (last && last.fromUserId === n.fromUserId && last.type === n.type && last.videoId === n.videoId && (last.count ?? 1) < 5) {
      last.count = (last.count ?? 1) + 1;
      last.read = last.read && n.read;
    } else {
      result.push({ ...n, count: 1 });
    }
  }
  return result;
}

export function NotificationsScreen() {
  const user = useAuthStore(s => s.user);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | AppNotification['type']>('all');

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(firebaseDb(), 'notifications'),
      where('userId', '==', user.id),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const markAllRead = async () => {
    const unread = notifs.filter(n => !n.read);
    if (!unread.length) return;
    const batch = writeBatch(firebaseDb());
    unread.forEach(n => batch.update(doc(firebaseDb(), 'notifications', n.id), { read: true }));
    await batch.commit();
  };

  const markOneRead = async (id: string) => {
    await updateDoc(doc(firebaseDb(), 'notifications', id), { read: true });
  };

  const unreadCount = notifs.filter(n => !n.read).length;

  const filtered = filter === 'all' ? notifs : notifs.filter(n => n.type === filter);

  const grouped = filtered.reduce<Record<string, AppNotification[]>>((acc, n) => {
    const date = new Date(n.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    let key = 'Earlier';
    if (date.toDateString() === today.toDateString()) key = 'Today';
    else if (date.toDateString() === yesterday.toDateString()) key = 'Yesterday';
    (acc[key] ??= []).push(n);
    return acc;
  }, {});

  const FILTERS: Array<{ id: typeof filter; label: string; icon: string }> = [
    { id: 'all', label: 'All', icon: '🔔' },
    { id: 'like', label: 'Likes', icon: '❤️' },
    { id: 'comment', label: 'Comments', icon: '💬' },
    { id: 'follow', label: 'Follows', icon: '👤' },
  ];

  return (
    <div style={{ height: '100%', background: '#F5F5F7', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(245,245,247,0.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0D0D12', margin: 0 }}>Activity</h1>
          {unreadCount > 0 && (
            <span style={{ background: '#3D6B4F', color: 'white', borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: '#3D6B4F', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', overflowX: 'auto', borderBottom: '1px solid rgba(0,0,0,0.05)', background: '#FFFFFF' }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            style={{
              whiteSpace: 'nowrap',
              background: filter === f.id ? '#EBF3EE' : 'transparent',
              border: filter === f.id ? 'none' : '1px solid rgba(0,0,0,0.08)',
              color: filter === f.id ? '#3D6B4F' : '#6B7280',
              borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: 68, background: 'rgba(0,0,0,0.03)', margin: '4px 12px', borderRadius: 12 }} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70%', gap: 12, textAlign: 'center', padding: 24 }}>
            <div style={{ width: 72, height: 72, borderRadius: 24, background: '#EBF3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🔔</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0D0D12' }}>No notifications yet</h3>
            <p style={{ color: '#6B7280', fontSize: 13 }}>
              When someone likes, comments, or follows you — it shows up here.
            </p>
          </div>
        )}

        {['Today', 'Yesterday', 'Earlier'].map(group => {
          const items = grouped[group];
          if (!items?.length) return null;
          const groupedItems = groupNotifications(items);
          return (
            <div key={group}>
              <div style={{ padding: '12px 16px 6px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>
                {group}
              </div>
              {groupedItems.map(n => (
                <button key={n.id} onClick={() => markOneRead(n.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    background: n.read ? '#FFFFFF' : '#F0F7F2',
                    border: 'none', borderBottom: '1px solid rgba(0,0,0,0.04)',
                    cursor: 'pointer', color: '#0D0D12', textAlign: 'left',
                  }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar name={n.fromUsername} color={n.fromAvatarColor} src={n.fromAvatarUrl} size="md" />
                    <span style={{ position: 'absolute', bottom: -4, right: -4, fontSize: 14, lineHeight: 1 }}>
                      {TYPE_ICON[n.type]}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, lineHeight: 1.4, color: '#0D0D12' }}>
                      <span style={{ fontWeight: 700 }}>@{n.fromUsername}</span>
                      {(n.count ?? 1) > 1 && (
                        <span style={{ color: '#9CA3AF', fontSize: 13 }}> and {(n.count ?? 1) - 1} others</span>
                      )}
                      {' '}
                      <span style={{ color: '#6B7280' }}>{n.message}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                      {timeAgoShort(n.createdAt)}
                    </div>
                  </div>
                  {!n.read && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3D6B4F', flexShrink: 0 }} />
                  )}
                  {n.videoUrl && (
                    <div style={{ width: 44, height: 56, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(0,0,0,0.08)' }}>
                      <img src={n.videoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
