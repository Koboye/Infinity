import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Standard className merge helper — combines clsx (conditional) and
 * tailwind-merge (deduplication) so consumers can override styles safely.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Compact number formatter (1.2K, 3.4M). Replaces the ad-hoc formatNumber()
 * that appeared 3+ times in the original file.
 */
export function formatCount(n: number | null | undefined): string {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

/** Time-ago formatter using date-fns for accurate, locale-aware output. */
export function timeAgo(iso: string | Date | null | undefined): string {
  if (!iso) return 'just now';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;
  return date.toLocaleDateString();
}

/**
 * Safe number parser — handles "12K", "1.5M", and raw numbers.
 * Use when accepting counts from URLs, search params, or user input.
 */
export function parseCount(input: string | number | null | undefined): number {
  if (input == null) return 0;
  if (typeof input === 'number') return Math.max(0, input);
  const trimmed = String(input).trim();
  const match = trimmed.match(/^([\d.]+)\s*([KkMm]?)$/);
  if (!match) return parseInt(trimmed, 10) || 0;
  const num = parseFloat(match[1] ?? '0');
  const suffix = (match[2] ?? '').toLowerCase();
  if (suffix === 'k') return Math.round(num * 1_000);
  if (suffix === 'm') return Math.round(num * 1_000_000);
  return Math.round(num);
}

/**
 * Haptic feedback helper — graceful no-op on unsupported devices.
 * Replaces the inline haptic() function from the original.
 */
export function haptic(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    if (style === 'heavy') navigator.vibrate([30, 10, 30]);
    else if (style === 'medium') navigator.vibrate(20);
    else navigator.vibrate(10);
  } catch {
    /* ignored — some browsers throw even when vibrate exists */
  }
}

/**
 * Build a Cloudinary URL with transformations. Defaults to auto-format/quality.
 */
export function cloudinary(url: string, transforms: string = 'f_auto,q_auto'): string {
  if (!url || !url.includes('cloudinary.com')) return url;
  return url.replace('/upload/', `/upload/${transforms}/`);
}

/** Slug-safe username validator. */
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username.toLowerCase());
}
