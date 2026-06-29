'use client';
// src/components/LocaleSync.tsx
// Reads the signed-in user's language preference and applies it to:
//   • document.documentElement.lang  (screen readers, browser translate)
//   • document.documentElement.dir   (RTL for Arabic)
// Mount this once inside Providers or AppShell. No external i18n library needed.

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

const RTL_LANGUAGES = new Set(['ar']);

// Maps our Language codes to valid BCP-47 lang tags
const LANG_MAP: Record<string, string> = {
  en: 'en', am: 'am', ar: 'ar', fr: 'fr', es: 'es',
  pt: 'pt', hi: 'hi', zh: 'zh', sw: 'sw', de: 'de',
  ru: 'ru', tr: 'tr', ja: 'ja', ko: 'ko', it: 'it',
};

export function LocaleSync() {
  const language = useAuthStore(s => s.user?.language ?? 'en');
  const theme = useAuthStore(s => s.user?.theme ?? 'light');

  useEffect(() => {
    const lang = LANG_MAP[language] ?? 'en';
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr';
  }, [language]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // Basic dark mode: invert app background/text
    if (theme === 'dark') {
      document.documentElement.style.setProperty('--bg', '#0D0D0D');
      document.documentElement.style.setProperty('--bg2', '#1A1A1A');
      document.documentElement.style.setProperty('--text', '#F8F7F4');
      document.documentElement.style.setProperty('--border', 'rgba(255,255,255,0.08)');
    } else {
      document.documentElement.style.setProperty('--bg', '#F8F7F4');
      document.documentElement.style.setProperty('--bg2', '#FFFFFF');
      document.documentElement.style.setProperty('--text', '#1A1A1A');
      document.documentElement.style.setProperty('--border', 'rgba(0,0,0,0.06)');
    }
  }, [theme]);

  return null;
}
