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

  const otherId = conv.participants.find(p => p !== user?.id) ?? '';
  const otherName = conv.participantNames[otherId] ?? 'User';
  const otherColor = conv.participantAvatarColors[otherId] ?? '#888';
  const otherUrl = conv.participantAvatarUrls[otherId] ?? null;

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(11,11,15,0.97)' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', borderRadius: 999, width: 36, height: 36, cursor: 'pointer', fontSize: 18 }}>←</button>
        <Avatar name={otherName} color={otherColor} src={otherUrl} size="md" />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>@{otherName}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Tap to view profile</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>👋</div>
            Say hello to @{otherName}!
          </div>
        )}
        {messages.map(m => {
          const isMine = m.senderId === user?.id;
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '75%', padding: '10px 14px', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: isMine ? 'linear-gradient(135deg,#FF2156,#9D4EDD)' : 'rgba(255,255,255,0.08)',
                color: 'white', fontSize: 14, lineHeight: 1.4, wordBreak: 'break-word',
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
        <div style={{ display: 'flex', gap: 8, padding: '8px 12px', overflowX: 'auto' }}>
          {smartReplies.map(r => (
            <button key={r} onClick={() => send(r)} style={{ whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: 999, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}>{r}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 12px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <input
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Message…"
          style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '12px 16px', color: 'white', fontSize: 14, outline: 'none' }}
        />
        <button onClick={() => send()} disabled={!text.trim() || sending}
          style={{ width: 44, height: 44, borderRadius: 999, background: text.trim() ? 'linear-gradient(135deg,#FF2156,#9D4EDD)' : 'rgba(255,255,255,0.07)', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
      // Check if conversation already exists
      const snap = await getDocs(query(collection(firebaseDb(), 'conversations'), where('participants', 'array-contains', user.id)));
      const existing = snap.docs.find(d => {
        const p = d.data().participants as string[];
        return p.includes(other.id);
      });
      if (existing) {
        onStart({ id: existing.id, ...existing.data() } as Conversation);
        return;
      }
      // Create new conversation
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', background: '#1C1C24', borderRadius: '24px 24px 0 0', padding: 20, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>New Message</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="Search by username…"
            style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '10px 16px', color: 'white', fontSize: 14, outline: 'none' }} />
          <button onClick={search} style={{ background: 'linear-gradient(135deg,#FF2156,#9D4EDD)', border: 'none', color: 'white', borderRadius: 999, padding: '10px 18px', cursor: 'pointer', fontWeight: 700 }}>
            {searching ? '…' : 'Search'}
          </button>
        </div>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.length === 0 && q && !searching && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 24 }}>No users found</div>}
          {results.map(u => (
            <button key={u.id} onClick={() => startChat(u)} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: 14, padding: 12, cursor: 'pointer', color: 'white', textAlign: 'left' }}>
              <Avatar name={u.username} color={u.avatarColor} src={u.avatarUrl} size="md" />
              <div>
                <div style={{ fontWeight: 700 }}>@{u.username}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{u.bio?.slice(0, 40)}</div>
              </div>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Messages</h1>
        <button onClick={() => setShowNew(true)} style={{ background: 'linear-gradient(135deg,#FF2156,#9D4EDD)', border: 'none', color: 'white', borderRadius: 999, padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
          ✏️ New
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: 72, background: 'rgba(255,255,255,0.03)', margin: '1px 0' }} />)}
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70%', gap: 12, textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 56 }}>💬</div>
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>No messages yet</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, maxWidth: 260 }}>Search for someone and start a conversation!</p>
            <button onClick={() => setShowNew(true)} style={{ background: 'linear-gradient(135deg,#FF2156,#9D4EDD)', border: 'none', color: 'white', borderRadius: 999, padding: '12px 24px', fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
              Start a Chat
            </button>
          </div>
        )}
        {conversations.map(conv => {
          const otherId = conv.participants.find(p => p !== user?.id) ?? '';
          const otherName = conv.participantNames?.[otherId] ?? 'User';
          const otherColor = conv.participantAvatarColors?.[otherId] ?? '#888';
          const otherUrl = conv.participantAvatarUrls?.[otherId] ?? null;
          return (
            <button key={conv.id} onClick={() => setActiveConv(conv)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', color: 'white', textAlign: 'left' }}>
              <Avatar name={otherName} color={otherColor} src={otherUrl} size="md" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>@{otherName}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {conv.lastMessage || 'Say hello! 👋'}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {showNew && <NewMessageModal onClose={() => setShowNew(false)} onStart={conv => { setShowNew(false); setActiveConv(conv); }} />}
    </div>
  );
}
