'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import {
  collection, addDoc, onSnapshot, orderBy, query,
  serverTimestamp, where, getDocs, doc, updateDoc, getDoc, increment,
} from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase/client';

interface Message {
  id: string; text: string; senderId: string;
  senderUsername: string; createdAt: any; read: boolean;
}
interface Conversation {
  id: string; participants: string[];
  participantNames: Record<string, string>;
  participantAvatars: Record<string, string>;
  participantAvatarColors: Record<string, string>;
  participantAvatarUrls: Record<string, string | null>;
  lastMessage: string; lastMessageAt: any;
  /** unread count PER participant uid, since each side reads at a different time */
  unreadCount: Record<string, number>;
}
interface UserResult {
  id: string; username: string; avatarColor: string;
  avatarUrl: string | null; bio: string; verified: boolean;
}

function getOtherId(conv: Conversation, myId: string) {
  return conv.participants?.find(p => p !== myId) ?? '';
}
function getField<T>(map: Record<string, T> | undefined, key: string, fallback: T): T {
  if (!map || !key) return fallback;
  return map[key] ?? fallback;
}
function getSmartReplies(lastMsg: string): string[] {
  const l = lastMsg.toLowerCase();
  if (l.includes('how are you') || l.includes('how r u')) return ['doing great 😊', 'pretty good u?', 'all good 🙌'];
  if (l.includes('hello') || l.includes('hi') || l.includes('hey')) return ['hey 👋', 'hiiii 😄', 'heyy 🙌'];
  if (l.includes('thank')) return ['ofc! 😊', 'anytime 🙌', 'always ❤️'];
  if (l.includes('love') || l.includes('❤') || l.includes('🔥')) return ['❤️', '🔥🔥', 'same!! 😍'];
  if (l.includes('video') || l.includes('post')) return ['omg so good 🔥', 'love ur content ❤️', 'keep going 💪'];
  if (l.includes('follow')) return ['following back 🙌', 'appreciate it ❤️', 'welcome 😊'];
  return ['👍', '❤️', 'lol 😭', 'no way 💀', 'fr fr'];
}

// ─── Squircle Avatar ────────────────────────────────────────────────────────
function SqAvatar({ name, color, src, size = 48, radius = 16 }: { name: string; color: string; src?: string | null; size?: number; radius?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, color: '#fff', fontSize: size * 0.35,
      overflow: 'hidden', position: 'relative',
    }}>
      {src
        ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (name?.[0] ?? '?').toUpperCase()
      }
    </div>
  );
}

// ─── Online ring ────────────────────────────────────────────────────────────
function OnlineRing({ color, size = 52 }: { color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 18,
      padding: 2, flexShrink: 0,
      background: `linear-gradient(135deg, ${color}, #9B4FFF)`,
    }} />
  );
}

// ─── Chat View ──────────────────────────────────────────────────────────────
function ChatView({ conv, onBack }: { conv: Conversation; onBack: () => void }) {
  const user = useAuthStore(s => s.user);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const otherId = getOtherId(conv, user?.id ?? '');
  const otherName = getField(conv.participantNames, otherId, 'user');
  const otherColor = getField(conv.participantAvatarColors, otherId, '#FF2D78');
  const otherUrl = getField<string | null>(conv.participantAvatarUrls, otherId, null);

  // Mark conversation as read for the viewer the moment they open it.
  useEffect(() => {
    if (!user) return;
    updateDoc(doc(firebaseDb(), 'conversations', conv.id), {
      [`unreadCount.${user.id}`]: 0,
    }).catch(() => {});
  }, [conv.id, user?.id]);

  useEffect(() => {
    const q = query(
      collection(firebaseDb(), 'messages'),
      where('conversationId', '==', conv.id),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    });
  }, [conv.id]);

  const send = async (msg?: string) => {
    const content = msg ?? text.trim();
    if (!content || !user || !otherId) return;
    setSending(true); setText('');
    try {
      await addDoc(collection(firebaseDb(), 'messages'), {
        conversationId: conv.id, text: content,
        senderId: user.id, senderUsername: user.username,
        createdAt: serverTimestamp(), read: false,
      });
      await updateDoc(doc(firebaseDb(), 'conversations', conv.id), {
        lastMessage: content, lastMessageAt: serverTimestamp(),
        [`unreadCount.${otherId}`]: increment(1),
      });
    } finally { setSending(false); }
  };

  const lastOtherMsg = [...messages].reverse().find(m => m.senderId !== user?.id)?.text ?? '';
  const smartReplies = lastOtherMsg ? getSmartReplies(lastOtherMsg) : [];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#0A0A0F', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px 12px',
        background: 'rgba(10,10,15,0.98)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
      }}>
        <button onClick={onBack} style={{
          width: 36, height: 36, borderRadius: 12,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.07)',
          color: '#fff', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>←</button>

        <div style={{ flexShrink: 0 }}>
          <SqAvatar name={otherName} color={otherColor} src={otherUrl} size={38} radius={12} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: '-0.3px' }}>@{otherName}</div>
        </div>

        <button style={{
          width: 36, height: 36, borderRadius: 12,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.07)',
          color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>⋯</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, paddingBottom: 60 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: otherColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 800, color: '#fff',
            }}>
              {otherUrl ? <img src={otherUrl} alt={otherName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 20 }} /> : otherName[0]?.toUpperCase()}
            </div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#fff' }}>@{otherName}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>say something 👋</div>
          </div>
        )}

        {messages.map((m, i) => {
          const isMine = m.senderId === user?.id;
          const prevSame = i > 0 && messages[i - 1].senderId === m.senderId;
          const nextSame = i < messages.length - 1 && messages[i + 1].senderId === m.senderId;
          const isFirst = !prevSame;
          const isLast = !nextSame;

          let borderRadius = '18px';
          if (isMine) {
            if (isFirst && !isLast) borderRadius = '18px 4px 4px 18px';
            else if (!isFirst && !isLast) borderRadius = '18px 4px 4px 18px';
            else if (!isFirst && isLast) borderRadius = '18px 4px 18px 18px';
            else borderRadius = '18px 4px 18px 18px';
          } else {
            if (isFirst && !isLast) borderRadius = '4px 18px 18px 18px';
            else if (!isFirst && !isLast) borderRadius = '4px 18px 18px 4px';
            else if (!isFirst && isLast) borderRadius = '4px 18px 18px 18px';
            else borderRadius = '4px 18px 18px 18px';
          }

          return (
            <div key={m.id} style={{
              display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start',
              marginTop: prevSame ? 2 : 10,
            }}>
              <div style={{
                maxWidth: '76%', padding: '9px 14px',
                borderRadius,
                background: isMine
                  ? 'linear-gradient(135deg,#FF2D78,#9B4FFF)'
                  : 'rgba(255,255,255,0.08)',
                color: '#fff', fontSize: 14, lineHeight: 1.45,
                wordBreak: 'break-word',
              }}>
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Smart replies */}
      {smartReplies.length > 0 && (
        <div style={{ display: 'flex', gap: 7, padding: '8px 14px 4px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {smartReplies.map(r => (
            <button key={r} onClick={() => send(r)} style={{
              whiteSpace: 'nowrap',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)',
              borderRadius: 999, padding: '7px 15px',
              fontSize: 12.5, cursor: 'pointer', flexShrink: 0,
            }}>{r}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '10px 14px 32px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(10,10,15,0.98)',
      }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: '10px 14px',
        }}>
          <span style={{ fontSize: 18 }}>😊</span>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="message…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#fff', fontSize: 14,
            }}
          />
          <span style={{ fontSize: 18 }}>📷</span>
        </div>
        <button onClick={() => send()} disabled={!text.trim() || sending} style={{
          width: 42, height: 42, borderRadius: 13, flexShrink: 0,
          background: text.trim() ? 'linear-gradient(135deg,#FF2D78,#9B4FFF)' : 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.07)',
          color: '#fff', fontSize: 17, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}>➤</button>
      </div>
    </div>
  );
}

// ─── New Message Modal ───────────────────────────────────────────────────────
function NewMessageModal({ onClose, onStart }: { onClose: () => void; onStart: (c: Conversation) => void }) {
  const user = useAuthStore(s => s.user);
  const showToast = useUIStore(s => s.showToast);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const snap = await getDocs(collection(firebaseDb(), 'users'));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserResult));
      setResults(all.filter(u => u.id !== user?.id && u.username.toLowerCase().includes(q.toLowerCase())).slice(0, 10));
    } finally { setSearching(false); }
  };

  const startChat = async (other: UserResult) => {
    if (!user) return;
    try {
      const snap = await getDocs(query(collection(firebaseDb(), 'conversations'), where('participants', 'array-contains', user.id)));
      const existing = snap.docs.find(d => (d.data().participants as string[]).includes(other.id));
      if (existing) { onStart({ id: existing.id, ...existing.data() } as Conversation); return; }
      const ref = await addDoc(collection(firebaseDb(), 'conversations'), {
        participants: [user.id, other.id],
        participantNames: { [user.id]: user.username, [other.id]: other.username },
        participantAvatars: { [user.id]: user.avatar, [other.id]: other.username[0].toUpperCase() },
        participantAvatarColors: { [user.id]: user.avatarColor, [other.id]: other.avatarColor },
        participantAvatarUrls: { [user.id]: user.avatarUrl, [other.id]: other.avatarUrl ?? null },
        lastMessage: '', lastMessageAt: serverTimestamp(),
        unreadCount: { [user.id]: 0, [other.id]: 0 },
      });
      const newDoc = await getDoc(doc(firebaseDb(), 'conversations', ref.id));
      onStart({ id: ref.id, ...newDoc.data() } as Conversation);
    } catch { showToast('Could not start chat', 'error'); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{
        width: '100%', background: '#13131A',
        borderRadius: '28px 28px 0 0',
        padding: '0 20px 40px',
        maxHeight: '82vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* drag handle */}
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 99, margin: '14px auto 20px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 20, color: '#fff', letterSpacing: '-0.5px' }}>New message</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>find someone to chat with</div>
          </div>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: 11,
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.6)', fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: '11px 16px',
          }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="search username…"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14 }}
              autoFocus
            />
          </div>
          <button onClick={search} style={{
            background: 'linear-gradient(135deg,#FF2D78,#9B4FFF)',
            border: 'none', color: '#fff', borderRadius: 14,
            padding: '0 20px', fontWeight: 800, cursor: 'pointer', fontSize: 14,
            flexShrink: 0,
          }}>{searching ? '…' : 'Go'}</button>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {results.length === 0 && q && !searching && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', padding: '32px 0', fontSize: 14 }}>
              no one found for "{q}"
            </div>
          )}
          {results.map(u => (
            <button key={u.id} onClick={() => startChat(u)} style={{
              display: 'flex', alignItems: 'center', gap: 13,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 16, padding: '13px 14px',
              cursor: 'pointer', color: '#fff', textAlign: 'left',
            }}>
              <SqAvatar name={u.username} color={u.avatarColor} src={u.avatarUrl} size={44} radius={14} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>@{u.username}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.bio?.slice(0, 45)}
                </div>
              </div>
              <div style={{ fontSize: 20, opacity: 0.3 }}>→</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Active users strip ──────────────────────────────────────────────────────
function ActiveStrip({ conversations, myId, onOpen }: { conversations: Conversation[]; myId: string; onOpen: (c: Conversation) => void }) {
  if (conversations.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 14, padding: '4px 16px 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
      {conversations.slice(0, 6).map(conv => {
        const otherId = getOtherId(conv, myId);
        const name = getField(conv.participantNames, otherId, 'user');
        const color = getField(conv.participantAvatarColors, otherId, '#FF2D78');
        const url = getField<string | null>(conv.participantAvatarUrls, otherId, null);
        return (
          <button key={conv.id} onClick={() => onOpen(conv)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            <div style={{
              width: 54, height: 54, borderRadius: 18, padding: 2, flexShrink: 0,
              background: 'linear-gradient(135deg, #FF2D78, #9B4FFF)',
            }}>
              <SqAvatar name={name} color={color} src={url} size={50} radius={15} />
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', maxWidth: 54, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Inbox ──────────────────────────────────────────────────────────────
export function InboxScreen() {
  const user = useAuthStore(s => s.user);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(firebaseDb(), 'conversations'), where('participants', 'array-contains', user.id));
    return onSnapshot(q, snap => {
      const convs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Conversation));
      convs.sort((a, b) => (b.lastMessageAt > a.lastMessageAt ? 1 : -1));
      setConversations(convs); setLoading(false);
    });
  }, [user]);

  if (activeConv) return <ChatView conv={activeConv} onBack={() => setActiveConv(null)} />;

  const filtered = search.trim()
    ? conversations.filter(c => {
        const otherId = getOtherId(c, user?.id ?? '');
        const name = getField(c.participantNames, otherId, '');
        return name.toLowerCase().includes(search.toLowerCase());
      })
    : conversations;

  const unreadCount = conversations.filter(c => (c.unreadCount?.[user?.id ?? ''] ?? 0) > 0).length;

  return (
    <div style={{ height: '100%', background: '#F5F5F7', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '18px 16px 10px', flexShrink: 0, background: 'rgba(245,245,247,0.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0D0D12', margin: 0 }}>Messages</h1>
          <button onClick={() => setShowNew(true)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 38, height: 38,
            background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 12, cursor: 'pointer',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B4EFF" strokeWidth="2.5" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['Messages', 'Groups', 'Requests'].map((t, i) => (
            <button key={t} style={{
              background: i === 0 ? '#0D0D12' : '#FFFFFF',
              border: i === 0 ? 'none' : '1px solid rgba(0,0,0,0.08)',
              borderRadius: 999, padding: '7px 14px',
              fontSize: 13, fontWeight: 600,
              color: i === 0 ? '#FFFFFF' : '#6B7280',
              cursor: 'pointer',
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 80px' }}>

        {/* Skeletons */}
        {loading && [1, 2, 3, 4].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(0,0,0,0.06)', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ height: 13, width: '35%', background: 'rgba(0,0,0,0.06)', borderRadius: 6 }} />
              <div style={{ height: 11, width: '60%', background: 'rgba(0,0,0,0.04)', borderRadius: 6 }} />
            </div>
          </div>
        ))}

        {/* Empty state */}
        {!loading && conversations.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '65%', gap: 14, padding: 32 }}>
            <div style={{ width: 72, height: 72, borderRadius: 24, background: '#EEE9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>💬</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#0D0D12' }}>No messages yet</div>
            <div style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', maxWidth: 220, lineHeight: 1.6 }}>Start a conversation with someone you follow.</div>
            <button onClick={() => setShowNew(true)} style={{ background: '#6B4EFF', border: 'none', color: '#fff', borderRadius: 14, padding: '12px 28px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>New message</button>
          </div>
        )}

        {/* No search results */}
        {!loading && search && filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '40px 0', fontSize: 14 }}>
            Nothing found for "{search}"
          </div>
        )}

        {/* Conversations */}
        {filtered.map(conv => {
          const otherId = getOtherId(conv, user?.id ?? '');
          const otherName = getField(conv.participantNames, otherId, 'user');
          const otherColor = getField(conv.participantAvatarColors, otherId, '#6B4EFF');
          const otherUrl = getField<string | null>(conv.participantAvatarUrls, otherId, null);
          const hasUnread = (conv.unreadCount?.[user?.id ?? ''] ?? 0) > 0;

          const ts = conv.lastMessageAt;
          let timeLabel = '';
          if (ts) {
            const d = ts.toDate ? ts.toDate() : new Date(ts);
            const now = new Date();
            const isToday = d.toDateString() === now.toDateString();
            const diff = Math.round((Date.now() - d.getTime()) / 60000);
            timeLabel = isToday
              ? diff < 60 ? `${diff}m` : `${Math.floor(diff/60)}h`
              : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
          }

          return (
            <button key={conv.id} onClick={() => setActiveConv(conv)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 13,
              padding: '12px 16px',
              background: 'none', border: 'none',
              borderBottom: '1px solid rgba(0,0,0,0.04)',
              cursor: 'pointer', color: '#0D0D12', textAlign: 'left',
            }}>
              <SqAvatar name={otherName} color={otherColor} src={otherUrl} size={50} radius={25} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontWeight: hasUnread ? 800 : 600, fontSize: 14, color: '#0D0D12' }}>{otherName}</span>
                  <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0, marginLeft: 8 }}>{timeLabel}</span>
                </div>
                <div style={{ fontSize: 13, color: hasUnread ? '#0D0D12' : '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: hasUnread ? 600 : 400 }}>
                  {conv.lastMessage || 'Say hello 👋'}
                </div>
              </div>

              {hasUnread && (
                <div style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0, background: '#6B4EFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 800 }}>
                  {conv.unreadCount?.[user?.id ?? ''] ?? 1}
                </div>
              )}
            </button>
          );
        })}

        <div style={{ height: 20 }} />
      </div>

      {showNew && (
        <NewMessageModal
          onClose={() => setShowNew(false)}
          onStart={conv => { setShowNew(false); setActiveConv(conv); }}
        />
      )}
    </div>
  );
}
