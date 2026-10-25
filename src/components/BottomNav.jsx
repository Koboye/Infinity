'use client';
import React from 'react';

const L = {
  en: { home: 'Home', level: 'Level', trophy: 'Trophy', rules: 'Rules', profile: 'Profile' },
  am: { home: 'ዋና', level: 'ደረጃ', trophy: 'ዋንጫ', rules: 'ሕግጋት', profile: 'መገለጫ' },
};
const TABS = [
  { id: 'home', icon: '🏠', on: ['home', 'modes', 'ai', 'pass', 'online'] },
  { id: 'level', icon: '⭐', on: ['progress'], to: 'progress' },
  { id: 'trophy', icon: '🏆', on: ['leaders'], to: 'leaders' },
  { id: 'rules', icon: '📖', on: ['rules'], to: 'rules' },
  { id: 'profile', icon: '👤', on: ['profile', 'settings'], to: 'profile' },
];

/** Permanent bottom tab bar (like Ludo King): always on screen outside a running game. */
export default function BottomNav({ lang, view, onHome, onOpen, profile }) {
  const t = L[lang === 'am' ? 'am' : 'en'];
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((tab) => {
        const active = tab.on.includes(view);
        return (
          <button key={tab.id} type="button" className={`bn-tab${active ? ' on' : ''}`} aria-current={active ? 'page' : undefined}
            onClick={() => (tab.id === 'home' ? onHome() : onOpen(tab.to))}>
            <span className="bn-ico" aria-hidden="true">{tab.icon}</span>
            <span className="bn-lbl">{tab.id === 'profile' && profile?.displayName ? t.profile : t[tab.id]}</span>
          </button>
        );
      })}
    </nav>
  );
}
