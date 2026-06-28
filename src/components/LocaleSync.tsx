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

  useEffect(() => {
    const lang = LANG_MAP[language] ?? 'en';
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr';
  }, [language]);

  return null;
}
