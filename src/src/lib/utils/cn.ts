import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n ?? 0);
}

export function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  try {
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      window.navigator.vibrate(style === 'heavy' ? 30 : style === 'medium' ? 15 : 8);
    }
  } catch {}
}

export function timeAgo(date: Date | string | number): string {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - new Date(date as string).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks}w`;
  return `${Math.floor(weeks / 52)}y`;
}
