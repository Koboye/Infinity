/**
 * Browser-API helpers and hooks. No storage or server dependency —
 * these only touch window/navigator/DOM APIs.
 */
import { useState, useEffect } from 'react';

export const haptic = (style = 'light') => {
  try {
    if (window.navigator?.vibrate) {
      style === 'heavy' ? navigator.vibrate([30, 10, 30]) : navigator.vibrate(10);
    }
  } catch {}
};

export const useNetworkStatus = () => {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
};

// PIN is stored as a salted SHA-256 hash, never as plain digits.
export const hashPin = async (pin) => {
  const text = `gebeya-link:${pin}`;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return btoa(text); // very old WebView without crypto.subtle
  }
};

// Share text through the phone's own share sheet, or fall back to SMS.
export const shareText = async (text, phone = '') => {
  try {
    if (navigator.share && !phone) { await navigator.share({ text }); return true; }
  } catch { return false; }
  window.location.href = `sms:${phone}?body=${encodeURIComponent(text)}`;
  return true;
};

export const shareTelegram = (text) => {
  window.open(`https://t.me/share/url?url=%20&text=${encodeURIComponent(text)}`, '_blank', 'noopener');
};

export const downloadFile = (name, content, type = 'application/json') => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const normalizePhone = (raw) => {
  const d = String(raw || '').replace(/[^\d]/g, '');
  const m = d.match(/^(?:251|0)?([79]\d{8})$/);
  return m ? `+251${m[1]}` : null;
};
