'use client';

import { useState } from 'react';
import { MessageCircle, Users, Sparkles } from 'lucide-react';

export function InboxScreen() {
  const [tab, setTab] = useState<'chats' | 'groups'>('chats');

  return (
    <div className="flex h-full flex-col bg-bg-base">
      <header className="border-b border-white/6 p-4">
        <h1 className="text-xl font-extrabold">Inbox</h1>
        <div className="mt-3 flex gap-1.5">
          <TabButton active={tab === 'chats'} onClick={() => setTab('chats')} icon={<MessageCircle className="h-4 w-4" />}>
            Chats
          </TabButton>
          <TabButton active={tab === 'groups'} onClick={() => setTab('groups')} icon={<Users className="h-4 w-4" />}>
            Groups
          </TabButton>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="rounded-2xl border border-info/20 bg-info/5 p-4 text-sm">
          <div className="mb-1 flex items-center gap-1.5 font-bold text-info">
            <Sparkles className="h-4 w-4" />
            Smart replies available
          </div>
          <p className="text-white/60">
            Open any chat to see AI-generated reply suggestions based on the incoming message — exactly like Telegram's smart-reply, but fully under your control.
          </p>
        </div>

        <div className="mt-8 text-center text-white/40">
          <div className="mb-2 text-5xl">💬</div>
          <div className="text-sm">Your conversations will appear here.</div>
          <div className="mt-1 text-xs">
            The V5 chat module is pluggable — wire in your real-time transport (Firestore / Socket.io / Ably) and the smart-reply layer activates automatically.
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ' +
        (active ? 'bg-accent/15 text-accent' : 'bg-white/4 text-white/55 hover:bg-white/8')
      }
    >
      {icon}
      {children}
    </button>
  );
}
