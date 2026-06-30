'use client';
import { useUIStore } from '@/stores/uiStore';
import type { AppPage } from '@/types';

interface BottomNavProps {
  onCreateTap: () => void;
  onProfileTap?: () => void;  // ✅ NEW
  unreadNotifs?: number;
  unreadMessages?: number;
}

const ACCENT = '#3D6B4F';
const MUTED = '#B0B0B8';

function LeafIcon({ size = 22, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-8 2S13 2 17 8z"/>
    </svg>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? ACCENT : 'none'} stroke={active ? ACCENT : MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function PeopleIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACCENT : MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACCENT : MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function BellIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACCENT : MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACCENT : MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}

const TABS: { id: AppPage | 'create'; label: string; hasBadge?: 'notifs' | 'messages' }[] = [
  { id: 'feed', label: 'Home' },
  { id: 'discover', label: 'People' },
  { id: 'create', label: 'Create' },
  { id: 'inbox', label: 'Chat', hasBadge: 'messages' },
  { id: 'notifications', label: 'Activity', hasBadge: 'notifs' },
  { id: 'profile', label: 'Me' },
];

export function BottomNav({ onCreateTap, onProfileTap, unreadNotifs = 0, unreadMessages = 0 }: BottomNavProps) {
  const page = useUIStore(s => s.page);
  const setPage = useUIStore(s => s.setPage);

  const renderIcon = (id: string, active: boolean) => {
    if (id === 'feed') return <HomeIcon active={active} />;
    if (id === 'discover') return <PeopleIcon active={active} />;
    if (id === 'inbox') return <ChatIcon active={active} />;
    if (id === 'notifications') return <BellIcon active={active} />;
    if (id === 'profile') return <ProfileIcon active={active} />;
    if (id === 'create') return <LeafIcon size={22} color="white" />;
    return null;
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 72,
      background: '#FFFFFF',
      borderTop: '1px solid rgba(0,0,0,0.07)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      zIndex: 100,
    }}>
      {TABS.map(tab => {
        const isCreate = tab.id === 'create';
        const isProfile = tab.id === 'profile';
        const active = !isCreate && page === tab.id;
        const badgeCount = tab.hasBadge === 'notifs' ? unreadNotifs : tab.hasBadge === 'messages' ? unreadMessages : 0;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              if (isCreate) {
                onCreateTap();
              } else if (isProfile && onProfileTap) {
                onProfileTap();  // ✅ Reset viewing state when tapping Profile tab
              } else {
                setPage(tab.id as AppPage);
              }
            }}
            style={{
              background: isCreate ? '#3D6B4F' : 'none',
              border: 'none',
              width: isCreate ? 52 : 'auto',
              height: isCreate ? 52 : 'auto',
              borderRadius: isCreate ? '50%' : 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center',
              gap: 3, padding: isCreate ? 0 : '4px 14px',
              cursor: 'pointer', position: 'relative',
              boxShadow: isCreate ? '0 4px 16px rgba(61,107,79,0.35)' : 'none',
            }}
          >
            {renderIcon(tab.id, active)}
            {!isCreate && (
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? ACCENT : MUTED }}>
                {tab.label}
              </span>
            )}
            {badgeCount > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: isCreate ? -4 : 6,
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
