'use client';

import { cn } from '@/lib/utils/cn';

export interface AvatarProps {
  name: string;
  color?: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
  ring?: boolean;
}

const SIZE_MAP = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-24 w-24 text-2xl',
} as const;

export function Avatar({ name, color = '#FF2156', src, size = 'md', className, onClick, ring }: AvatarProps) {
  const initial = (name?.[0] ?? '?').toUpperCase();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white',
        SIZE_MAP[size],
        ring && 'ring-2 ring-white/80',
        onClick && 'cursor-pointer transition-transform active:scale-95',
        className,
      )}
      style={{ backgroundColor: color }}
      aria-label={`${name}'s avatar`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${name} avatar`} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        initial
      )}
    </button>
  );
}
