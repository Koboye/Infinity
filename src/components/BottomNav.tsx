'use client';

import { Home, Search, MessageCircle, User as UserIcon, Plus } from 'lucide-react';
import { useUIStore, type AppPage } from '@/stores/uiStore';
import { cn } from '@/lib/utils/cn';

const TABS: { id: AppPage; icon: React.ReactNode; label: string }[] = [
  { id: 'feed', icon: <Home className="h-5 w-5" />, label: 'Home' },
  { id: 'discover', icon: <Search className="h-5 w-5" />, label: 'Discover' },
  { id: 'create', icon: <Plus className="h-6 w-6" />, label: 'Create' },
  { id: 'inbox', icon: <MessageCircle className="h-5 w-5" />, label: 'Inbox' },
  { id: 'profile', icon: <UserIcon className="h-5 w-5" />, label: 'Profile' },
];

export function BottomNav() {
  const page = useUIStore(s => s.page);
  const setPage = useUIStore(s => s.setPage);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-white/6 bg-bg-base/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
      role="navigation"
      aria-label="Primary"
    >
      {TABS.map(tab => {
        const isActive = page === tab.id;
        const isCreate = tab.id === 'create';
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setPage(tab.id)}
            className={cn(
              'flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors',
              isActive ? 'text-accent' : 'text-white/55',
              isCreate && 'relative',
            )}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
          >
            {isCreate ? (
              <span className="gradient-brand -mt-5 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg shadow-accent/30">
                {tab.icon}
              </span>
            ) : (
              tab.icon
            )}
            {!isCreate && tab.label}
          </button>
        );
      })}
    </nav>
  );
}
