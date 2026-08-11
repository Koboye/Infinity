/**
 * Live translation (message/caption translate) extracted from Infinity.jsx.
 * Hits Google's public translate endpoint directly — no Firebase dependency.
 */
import { useState, useEffect } from 'react';

const translationCache = {};

export const liveTranslate = async (text, targetLang = 'en') => {
  if (!text || targetLang === 'auto') return text;
  const cacheKey = `${targetLang}:${text.substring(0, 80)}`;
  if (translationCache[cacheKey]) return translationCache[cacheKey];
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    );
    const data = await res.json();
    const translated = data?.[0]?.map(s => s?.[0]).filter(Boolean).join('') || text;
    translationCache[cacheKey] = translated;
    return translated;
  } catch { return text; }
};

export const useLiveTranslation = (text, targetLang) => {
  const [translated, setTranslated] = useState(text);
  useEffect(() => {
    if (!text || !targetLang || targetLang === 'auto') { setTranslated(text); return; }
    liveTranslate(text, targetLang).then(setTranslated);
  }, [text, targetLang]);
  return translated;
};
