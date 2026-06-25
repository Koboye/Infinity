'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { Avatar } from '@/components/Avatar';
import {
  collection, addDoc, onSnapshot, orderBy, query,
  serverTimestamp, where, getDocs, doc, updateDoc, getDoc,
} from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase/client';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderUsername: string;
  createdAt: string;
  read: boolean;
}

interface Conversation {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantAvatars: Record<string, string>;
  participantAvatarColors: Record<string, string>;
  participantAvatarUrls: Record<string, string | null>;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface UserResult {
  id: string;
  username: string;
  avatarColor: string;
  avatarUrl: string | null;
  bio: string;
  verified: boolean;
}

// ─── Safe accessor helpers ─────────────────────────────────────────────────
function getOtherId(conv: Conversation, myId: string): string {
  return conv.participants?.find(p => p !== myId) ?? '';
}
function getField<T>(map: Record<string, T> | undefined, key: string, fallback: T): T {
  if (!map || !key) return fallback;
  return map[key] ?? fallback;
}

// ─── Smart Reply suggestions ───────────────────────────────────────────────
function getSmartReplies(lastMsg: string): string[] {
  const lower = lastMsg.toLowerCase();
  if (lower.includes('how are you') || lower.includes('how r u')) return ['Doing great! 😊', 'Pretty good, you?', 'All good! 🙌'];
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) return ['Hey! 👋', 'Hi there! 😄', 'Hello! 🙌'];
  if (lower.includes('thank')) return ['You\'re welcome! 😊', 'Anytime! 🙌', 'Happy to help!'];
  if (lower.includes('love') || lower.includes('❤') || lower.includes('🔥')) return ['❤️', '🔥🔥', 'Same! 😍'];
  if (lower.includes('video') || lower.includes('post')) return ['Looks amazing! 🔥', 'Love your content! ❤️', 'Keep it up! 💪'];
  if (lower.includes('follow')) return ['Thanks! Following back! 🙌', 'Appreciate it! ❤️', 'Welcome! 😊'];
  return ['👍', '❤️', '😊', 'Sure!', 'Sounds good!'];
}

// ─── Chat View ─────────────────────────────────────────────────────────────
function ChatView({ conv, onBack }: { conv: Conversation; onBack: () => void }) {
  const user = useAuthStore(s => s.user);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const otherId = getOtherId(conv, user?.id ?? '');
  const otherName = getField(conv.participantNames, otherId, 'User');
  const otherColor = getField(conv.participantAvatarColors, otherId, '#888');
  const otherUrl = getField<string | null>(conv.participantAvatarUrls, otherId, null);

  useEffect(() => {
    const q = query(
      collection(firebaseDb(), 'messages'),
      where('conversationId', '==', conv.id),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsub();
  }, [conv.id]);

  const send = async (msg?: string) => {
    const content = msg ?? text.trim();
    if (!content || !user) return;
    setSending(true);
    setText('');
    try {
      await addDoc(collection(firebaseDb(), 'messages'), {
        conversationId: conv.id, text: content,
        senderId: user.id, senderUsername: user.username,
        createdAt: serverTimestamp(), read: false,
      });
      await updateDoc(doc(firebaseDb(), 'conversations', conv.id), {
        lastMessage: content, lastMessageAt: serverTimestamp(),
      });
    } finally { setSending(false); }
  };

  const lastOtherMsg = [...messages].reverse().find(m => m.senderId !== user?.id)?.text ?? '';
  const smartReplies = lastOtherMsg ? getSmartReplies(lastOtherMsg) : [];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#0B0B0F', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px',
        background: 'rgba(11,11,15,0.98)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
      }}>
        <button onClick={onBack} style={{
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)',
          color: 'white', borderRadius: 999, width: 38, height: 38,
          cursor: 'pointer', fontSize: 18, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>←</button>
        <Avatar name={otherName} color={otherColor} src={otherUrl} size="md" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px' }}>@{otherName}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>Active now</div>
        </div>
        <div style={{
          width: 8, height: 8, borderRadius: 999,
          background: '#22C55E',
          boxShadow: '0 0 6px #22C55E',
        }} />
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 14px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14, marginTop: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 999,
              background: `linear-gradient(135deg, ${otherColor}33, ${otherColor}11)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
            }}>
              <Avatar name={otherName} color={otherColor} src={otherUrl} size="lg" />
            </div>
            <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>@{otherName}</div>
            <div style={{ fontSize: 13 }}>No messages yet. Say hi! 👋</div>
          </div>
        )}
        {messages.map((m, i) => {
          const isMine = m.senderId === user?.id;
          const prevSame = i > 0 && messages[i - 1].senderId === m.senderId;
          return (
            <div key={m.id} style={{
              display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start',
              marginTop: prevSame ? 2 : 10,
            }}>
              <div style={{
                maxWidth: '78%', padding: '10px 15px',
                borderRadius: isMine
                  ? (prevSame ? '18px 4px 4px 18px' : '18px 4px 18px 18px')
                  : (prevSame ? '4px 18px 18px 18px' : '4px 18px 18px 18px'),
                background: isMine
                  ? 'linear-gradient(135deg,#FF2156,#9D4EDD)'
                  : 'rgba(255,255,255,0.09)',
                color: 'white', fontSize: 14, lineHeight: 1.45,
                wordBreak: 'break-word',
                boxShadow: isMine ? '0 4px 15px rgba(255,33,86,0.2)' : 'none',
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
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px 6px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {smartReplies.map(r => (
            <button key={r} onClick={() => send(r)} style={{
              whiteSpace: 'nowrap',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.85)',
              borderRadius: 999, padding: '7px 15px',
              fontSize: 13, cursor: 'pointer',
              transition: 'all 0.15s',
            }}>{r}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        display: 'flex', gap: 10, padding: '10px 14px 28px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(11,11,15,0.97)',
      }}>
        <input
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Message…"
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 999, padding: '12px 18px',
            color: 'white', fontSize: 14, outline: 'none',
          }}
        />
        <button onClick={() => send()} disabled={!text.trim() || sending}
          style={{
            width: 46, height: 46, borderRadius: 999, flexShrink: 0,
            background: text.trim() ? 'linear-gradient(135deg,#FF2156,#9D4EDD)' : 'rgba(255,255,255,0.07)',
            border: 'none', color: 'white', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: text.trim() ? '0 4px 15px rgba(255,33,86,0.3)' : 'none',
            transition: 'all 0.2s',
          }}>
          ➤
        </button>
      </div>
    </div>
  );
}

// ─── New Message / User Search ─────────────────────────────────────────────
function NewMessageModal({ onClose, onStart }: { onClose: () => void; onStart: (conv: Conversation) => void }) {
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
      const existing = snap.docs.find(d => {
        const p = d.data().participants as string[];
        return p.includes(other.id);
      });
      if (existing) {
        onStart({ id: existing.id, ...existing.data() } as Conversation);
        return;
      }
      const ref = await addDoc(collection(firebaseDb(), 'conversations'), {
        participants: [user.id, other.id],
        participantNames: { [user.id]: user.username, [other.id]: other.username },
        participantAvatars: { [user.id]: user.avatar, [other.id]: other.username[0].toUpperCase() },
        participantAvatarColors: { [user.id]: user.avatarColor, [other.id]: other.avatarColor },
        participantAvatarUrls: { [user.id]: user.avatarUrl, [other.id]: other.avatarUrl ?? null },
        lastMessage: '', lastMessageAt: serverTimestamp(), unreadCount: 0,
      });
      const newDoc = await getDoc(doc(firebaseDb(), 'conversations', ref.id));
      onStart({ id: ref.id, ...newDoc.data() } as Conversation);
    } catch { showToast('Could not start chat', 'error'); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{
        width: '100%', background: '#16161F',
        borderRadius: '24px 24px 0 0',
        padding: '20px 20px 36px',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 99, margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ fontWeight: 800, fontSize: 17 }}>New Message</span>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 16, cursor: 'pointer', borderRadius: 999, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="Search username…"
            style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '11px 18px', color: 'white', fontSize: 14, outline: 'none' }} />
          <button onClick={search} style={{ background: 'linear-gradient(135deg,#FF2156,#9D4EDD)', border: 'none', color: 'white', borderRadius: 999, padding: '11px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
            {searching ? '…' : 'Go'}
          </button>
        </div>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {results.length === 0 && q && !searching && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 30, fontSize: 14 }}>No users found for "{q}"</div>
          )}
          {results.map(u => (
            <button key={u.id} onClick={() => startChat(u)} style={{
              display: 'flex', alignItems: 'center', gap: 13,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 16, padding: '12px 14px',
              cursor: 'pointer', color: 'white', textAlign: 'left',
              transition: 'background 0.15s',
            }}>
              <Avatar name={u.username} color={u.avatarColor} src={u.avatarUrl} size="md" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>@{u.username}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.bio?.slice(0, 45)}</div>
              </div>
              <div style={{ fontSize: 18, opacity: 0.4 }}>→</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Inbox Screen ─────────────────────────────────────────────────────
export function InboxScreen() {
  const user = useAuthStore(s => s.user);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(firebaseDb(), 'conversations'), where('participants', 'array-contains', user.id));
    const unsub = onSnapshot(q, snap => {
      const convs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Conversation));
      convs.sort((a, b) => (b.lastMessageAt > a.lastMessageAt ? 1 : -1));
      setConversations(convs);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  if (activeConv) return <ChatView conv={activeConv} onBack={() => setActiveConv(null)} />;

  return (
    <div style={{ height: '100%', background: '#0B0B0F', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 16px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px', margin: 0 }}>Messages</h1>
          {conversations.length > 0 && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <button onClick={() => setShowNew(true)} style={{
          background: 'linear-gradient(135deg,#FF2156,#9D4EDD)',
          border: 'none', color: 'white', borderRadius: 999,
          padding: '9px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 13,
          boxShadow: '0 4px 15px rgba(255,33,86,0.3)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          ✏️ New
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '8px 0' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
                <div style={{ width: 48, height: 48, borderRadius: 999, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ height: 13, width: '40%', background: 'rgba(255,255,255,0.06)', borderRadius: 6 }} />
                  <div style={{ height: 11, width: '65%', background: 'rgba(255,255,255,0.04)', borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && conversations.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70%', gap: 14, textAlign: 'center', padding: 32 }}>
            <div style={{
              width: 90, height: 90, borderRadius: 999,
              background: 'linear-gradient(135deg, rgba(255,33,86,0.15), rgba(157,78,221,0.15))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42,
            }}>💬</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>No messages yet</h3>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, maxWidth: 240, margin: 0, lineHeight: 1.5 }}>
              Find someone to chat with and start a conversation!
            </p>
            <button onClick={() => setShowNew(true)} style={{
              background: 'linear-gradient(135deg,#FF2156,#9D4EDD)',
              border: 'none', color: 'white', borderRadius: 999,
              padding: '13px 28px', fontWeight: 700, cursor: 'pointer',
              fontSize: 15, marginTop: 4,
              boxShadow: '0 6px 20px rgba(255,33,86,0.3)',
            }}>
              Start a Chat
            </button>
          </div>
        )}

        {/* Conversation list */}
        {conversations.map(conv => {
          const otherId = getOtherId(conv, user?.id ?? '');
          const otherName = getField(conv.participantNames, otherId, 'User');
          const otherColor = getField(conv.participantAvatarColors, otherId, '#888');
          const otherUrl = getField<string | null>(conv.participantAvatarUrls, otherId, null);
          const hasUnread = (conv.unreadCount ?? 0) > 0;

          return (
            <button key={conv.id} onClick={() => setActiveConv(conv)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px',
              background: 'none', border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              cursor: 'pointer', color: 'white', textAlign: 'left',
            }}>
              {/* Avatar with online dot */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Avatar name={otherName} color={otherColor} src={otherUrl} size="md" />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontWeight: hasUnread ? 800 : 600, fontSize: 14 }}>@{otherName}</span>
                  {conv.lastMessageAt && (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginLeft: 8 }}>
                      {new Date(conv.lastMessageAt).toLocaleDateString() === new Date().toLocaleDateString()
                        ? new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : new Date(conv.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 13,
                  color: hasUnread ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontWeight: hasUnread ? 600 : 400,
                }}>
                  {conv.lastMessage || 'Say hello! 👋'}
                </div>
              </div>

              {hasUnread && (
                <div style={{
                  width: 10, height: 10, borderRadius: 999,
                  background: 'linear-gradient(135deg,#FF2156,#9D4EDD)',
                  flexShrink: 0, boxShadow: '0 0 8px rgba(255,33,86,0.6)',
                }} />
              )}
            </button>
          );
        })}
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
