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
  like: '❤️',
  comment: '💬',
  follow: '👤',
  mention: '📣',
};

export function NotificationsScreen() {
  const user = useAuthStore(s => s.user);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

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

  const grouped = notifs.reduce<Record<string, AppNotification[]>>((acc, n) => {
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

  return (
    <div style={{ height: '100%', background: '#0B0B0F', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900 }}>Notifications</h1>
          {unreadCount > 0 && (
            <span style={{ background: '#FF2156', color: 'white', borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: '#FF2156', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Mark all read
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 68, background: 'rgba(255,255,255,0.03)', margin: '1px 0' }} />)}
          </div>
        )}

        {!loading && notifs.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70%', gap: 12, textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 56 }}>🔔</div>
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>No notifications yet</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>When someone likes or follows you, it shows up here.</p>
          </div>
        )}

        {['Today', 'Yesterday', 'Earlier'].map(group => {
          const items = grouped[group];
          if (!items?.length) return null;
          return (
            <div key={group}>
              <div style={{ padding: '10px 16px 6px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 }}>{group}</div>
              {items.map(n => (
                <button key={n.id} onClick={() => markOneRead(n.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: n.read ? 'none' : 'rgba(255,33,86,0.04)', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', color: 'white', textAlign: 'left' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar name={n.fromUsername} color={n.fromAvatarColor} src={n.fromAvatarUrl} size="md" />
                    <span style={{ position: 'absolute', bottom: -4, right: -4, fontSize: 14, lineHeight: 1 }}>{TYPE_ICON[n.type]}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 700 }}>@{n.fromUsername}</span>{' '}
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>{n.message}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF2156', flexShrink: 0 }} />}
                  {n.videoUrl && (
                    <div style={{ width: 44, height: 56, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
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
