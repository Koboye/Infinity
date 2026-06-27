'use client';
import { useUIStore } from '@/stores/uiStore';
import type { AppPage } from '@/types';

interface BottomNavProps {
  onCreateTap: () => void;
  unreadNotifs?: number;
  unreadMessages?: number;
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#6B4EFF' : 'none'} stroke={active ? '#6B4EFF' : '#9CA3AF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function ExploreIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#6B4EFF' : '#9CA3AF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function InboxIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#6B4EFF' : '#9CA3AF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#6B4EFF' : '#9CA3AF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}

const TABS: { id: AppPage | 'create'; label: string; hasBadge?: 'notifs' | 'messages' }[] = [
  { id: 'feed', label: 'Home' },
  { id: 'discover', label: 'Explore' },
  { id: 'create', label: 'Create' },
  { id: 'inbox', label: 'Messages', hasBadge: 'messages' },
  { id: 'profile', label: 'Profile' },
];

export function BottomNav({ onCreateTap, unreadNotifs = 0, unreadMessages = 0 }: BottomNavProps) {
  const page = useUIStore(s => s.page);
  const setPage = useUIStore(s => s.setPage);

  const renderIcon = (id: string, active: boolean) => {
    if (id === 'feed') return <HomeIcon active={active} />;
    if (id === 'discover') return <ExploreIcon active={active} />;
    if (id === 'inbox') return <InboxIcon active={active} />;
    if (id === 'profile') return <ProfileIcon active={active} />;
    if (id === 'create') return <PlusIcon />;
    return null;
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 72,
      background: 'rgba(255,255,255,0.97)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(0,0,0,0.07)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      zIndex: 100,
    }}>
      {TABS.map(tab => {
        const isCreate = tab.id === 'create';
        const active = !isCreate && page === tab.id;
        const badgeCount = tab.hasBadge === 'notifs' ? unreadNotifs : tab.hasBadge === 'messages' ? unreadMessages : 0;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => isCreate ? onCreateTap() : setPage(tab.id as AppPage)}
            style={{
              background: isCreate ? 'linear-gradient(135deg,#6B4EFF,#9D4EDD)' : 'none',
              border: 'none',
              width: isCreate ? 48 : 'auto',
              height: isCreate ? 48 : 'auto',
              borderRadius: isCreate ? '50%' : 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center',
              gap: 3, padding: isCreate ? 0 : '4px 12px',
              cursor: 'pointer', position: 'relative',
            }}
          >
            {renderIcon(tab.id, active)}
            {!isCreate && (
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? '#6B4EFF' : '#9CA3AF' }}>
                {tab.label}
              </span>
            )}
            {badgeCount > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: isCreate ? -4 : 8,
                background: '#EF4444', color: 'white',
                borderRadius: 999, fontSize: 9, fontWeight: 700,
                padding: '1px 5px', minWidth: 16, textAlign: 'center',
                lineHeight: '14px',
              }}>
                {badgeCount > 9 ? '9+' : badgeCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
