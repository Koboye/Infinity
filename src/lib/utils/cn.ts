import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCount(n: number | null | undefined): string {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'just now';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

export function haptic(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    if (style === 'heavy') navigator.vibrate([30, 10, 30]);
    else if (style === 'medium') navigator.vibrate(20);
    else navigator.vibrate(10);
  } catch { /* ignored */ }
}

export function isValidUsername(u: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(u.toLowerCase());
}
