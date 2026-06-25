'use client';
import { useUIStore } from '@/stores/uiStore';
import type { AppPage } from '@/types';

const TABS: { id: AppPage; label: string; icon: string }[] = [
  { id: 'feed',          label: 'Home',    icon: '🏠' },
  { id: 'discover',      label: 'Discover', icon: '🔍' },
  { id: 'create',        label: 'Create',   icon: '➕' },
  { id: 'notifications', label: 'Activity', icon: '🔔' },
  { id: 'inbox',         label: 'Messages', icon: '💬' },
];

interface BottomNavProps {
  onCreateTap?: () => void;
  unreadNotifs?: number;
  unreadMessages?: number;
}

export function BottomNav({ onCreateTap, unreadNotifs = 0, unreadMessages = 0 }: BottomNavProps) {
  const page = useUIStore(s => s.page);
  const setPage = useUIStore(s => s.setPage);

  const getBadge = (id: AppPage) => {
    if (id === 'notifications') return unreadNotifs;
    if (id === 'inbox') return unreadMessages;
    return 0;
  };

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: 64,
      background: 'rgba(11,11,15,0.97)', backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {TABS.map(tab => {
        const isActive = page === tab.id;
        const isCreate = tab.id === 'create';
        const badge = getBadge(tab.id);
        return (
          <button key={tab.id} type="button"
            onClick={() => { if (isCreate && onCreateTap) { onCreateTap(); return; } setPage(tab.id); }}
            style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', color: isActive ? '#FF2156' : 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, position: 'relative' }}>
            {isCreate ? (
              <span style={{ width: 48, height: 48, background: 'linear-gradient(135deg,#FF2156,#9D4EDD)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginTop: -20, boxShadow: '0 4px 20px rgba(255,33,86,0.35)' }}>{tab.icon}</span>
            ) : (
              <>
                <span style={{ fontSize: 20, position: 'relative' }}>
                  {tab.icon}
                  {badge > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -6, background: '#FF2156', color: 'white', borderRadius: 999, fontSize: 9, fontWeight: 900, minWidth: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 }}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                {tab.label}
              </>
            )}
          </button>
        );
      })}
    </nav>
  );
}
