'use client';
import React from 'react';

const L = {
  en: { home: 'Home', level: 'Level', friends: 'Friends', trophy: 'Trophy', rules: 'Rules', profile: 'Profile' },
  am: { home: 'ዋና', level: 'ደረጃ', friends: 'ጓደኞች', trophy: 'ዋንጫ', rules: 'ሕግጋት', profile: 'መገለጫ' },
};
const ICONS = {
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></>,
  level: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z" />,
  friends: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><circle cx="17" cy="9.5" r="2.6" /><path d="M17.5 14.2c2.4.3 4 2 4 4.6" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H4.5c0 3 1.5 4.5 3.7 4.8M16 6h3.5c0 3-1.5 4.5-3.7 4.8" /><path d="M12 13v3.5M8.5 20h7M10 16.5h4" /></>,
  rules: <><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5C4.7 19 4 18.3 4 17.5z" /><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5c.8 0 1.5-.7 1.5-1.5z" /></>,
  profile: <><circle cx="12" cy="8.5" r="3.6" /><path d="M4.5 20c0-3.9 3.4-6.5 7.5-6.5s7.5 2.6 7.5 6.5" /></>,
};
const Icon = ({ name }) => <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{ICONS[name]}</svg>;
const TABS = [
  { id: 'home', icon: '🏠', on: ['home', 'modes', 'ai', 'pass', 'online'] },
  { id: 'level', icon: '⭐', on: ['progress'], to: 'progress' },
  { id: 'friends', icon: '👥', on: ['friends'], to: 'friends' },
  { id: 'trophy', icon: '🏆', on: ['leaders'], to: 'leaders' },
  { id: 'rules', icon: '📖', on: ['rules'], to: 'rules' },
  { id: 'profile', icon: '👤', on: ['profile', 'settings'], to: 'profile' },
];

/** Permanent bottom tab bar (like Ludo King): always on screen outside a running game. */
export default function BottomNav({ lang, view, onHome, onOpen, profile, badge = 0 }) {
  const t = L[lang === 'am' ? 'am' : 'en'];
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((tab) => {
        const active = tab.on.includes(view);
        return (
          <button key={tab.id} type="button" className={`bn-tab${active ? ' on' : ''}`} aria-current={active ? 'page' : undefined} aria-label={tab.id === 'profile' && profile?.displayName ? t.profile : t[tab.id]}
            onClick={() => (tab.id === 'home' ? onHome() : onOpen(tab.to))}>
            <span className="bn-ico" aria-hidden="true"><Icon name={tab.id} />{tab.id === 'friends' && badge > 0 && <em className="badge">{badge > 9 ? '9+' : badge}</em>}</span>
            <span className="bn-lbl">{tab.id === 'profile' && profile?.displayName ? t.profile : t[tab.id]}</span>
          </button>
        );
      })}
    </nav>
  );
}
