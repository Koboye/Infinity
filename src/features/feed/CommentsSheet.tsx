'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { Avatar } from '@/components/Avatar';
import { timeAgo } from '@/lib/utils/cn';
import { createNotification } from '@/lib/firebase/notifications';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase/client';
import type { Comment } from '@/types';

interface CommentsSheetProps {
  videoId: string;
  videoOwnerId: string;
  videoOwnerUsername: string;
  onClose: () => void;
}

export function CommentsSheet({ videoId, videoOwnerId, videoOwnerUsername, onClose }: CommentsSheetProps) {
  const user = useAuthStore(s => s.user);
  const showToast = useUIStore(s => s.showToast);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = subscribeToComments(videoId, setComments);
    return () => unsub();
  }, [videoId]);

  const send = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    const content = replyTo ? `@${replyTo.username} ${text.trim()}` : text.trim();
    try {
      const token = await getIdToken();
const res = await fetch('/api/comments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    videoId,
    username: user.username,
    avatar: user.avatar,
    avatarColor: user.avatarColor,
    avatarUrl: user.avatarUrl,
    text: content,
  }),
});
if (!res.ok) throw new Error('Failed to post comment');
      await createNotification({
        userId: videoOwnerId,
        fromUserId: user.id,
        fromUsername: user.username,
        fromAvatar: user.avatar,
        fromAvatarColor: user.avatarColor,
        fromAvatarUrl: user.avatarUrl,
        type: 'comment',
        message: `commented: "${content.slice(0, 40)}"`,
        videoId,
      });
      setText('');
      setReplyTo(null);
    } catch {
      showToast('Failed to post comment', 'error');
    } finally {
      setSending(false);
    }
  };

  const likeComment = async (c: Comment) => {
    if (!user) return;
    try {
      await updateDoc(doc(firebaseDb(), 'comments', c.id), { likes: increment(1) });
    } catch {
      showToast('Failed to like', 'error');
    }
  };

  const pinned = comments.filter(c => c.pinned);
  const regular = comments.filter(c => !c.pinned);
  const sorted = [...pinned, ...regular];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />

      {/* Sheet */}
      <div style={{
        position: 'relative',
        background: '#1C1C24',
        borderRadius: '24px 24px 0 0',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'white' }}>
            💬 {comments.length} Comments
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Comments list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sorted.length === 0 && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '32px 0', fontSize: 14 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
              Be the first to comment!
            </div>
          )}
          {sorted.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10 }}>
              <Avatar name={c.username} color={c.avatarColor} src={c.avatarUrl} size="sm" />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'white' }}>@{c.username}</span>
                  {c.pinned && (
                    <span style={{ fontSize: 10, background: 'rgba(107,78,255,0.15)', color: '#6B4EFF', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                      📌 Pinned
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
                    {timeAgo(c.createdAt)}
                  </span>
                </div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.4 }}>
                  {c.text}
                </p>
                <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                  <button
                    onClick={() => likeComment(c)}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    ❤️ {c.likes > 0 ? c.likes : ''}
                  </button>
                  <button
                    onClick={() => { setReplyTo(c); inputRef.current?.focus(); }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}
                  >
                    Reply
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reply indicator */}
        {replyTo && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px',
            background: 'rgba(107,78,255,0.08)',
            borderTop: '1px solid rgba(107,78,255,0.15)'
          }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              Replying to{' '}
              <span style={{ color: '#6B4EFF', fontWeight: 700 }}>@{replyTo.username}</span>
            </span>
            <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* Input row */}
        <div style={{ display: 'flex', gap: 10, padding: '12px 16px 32px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Avatar name={user?.username ?? '?'} color={user?.avatarColor} src={user?.avatarUrl} size="sm" />
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder={replyTo ? `Reply to @${replyTo.username}…` : 'Add a comment…'}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 999, padding: '10px 16px',
              color: 'white', fontSize: 14, outline: 'none'
            }}
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            style={{
              background: text.trim() ? 'linear-gradient(135deg,#6B4EFF,#9D4EDD)' : 'rgba(255,255,255,0.07)',
              border: 'none', color: 'white', borderRadius: 999,
              width: 40, height: 40, cursor: 'pointer', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
