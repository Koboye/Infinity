'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

interface AvatarProps {
  name?: string;
  src?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  ring?: boolean;
  onClick?: () => void;
  className?: string;
}

const sizes: Record<string, number> = {
  sm: 28,
  md: 38,
  lg: 52,
};

export function Avatar({
  name,
  src,
  color = '#FF2156',
  size = 'md',
  ring,
  onClick,
  className,
}: AvatarProps) {
  const px = sizes[size] ?? 38;
  const initial = (name || '?')[0].toUpperCase();

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex-shrink-0',
        onClick && 'cursor-pointer',
        ring && 'ring-2 ring-[#FF2156] ring-offset-1 ring-offset-black',
        className,
      )}
      style={{ width: px, height: px, borderRadius: '50%', overflow: 'hidden' }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ?? 'avatar'}
          width={px}
          height={px}
          style={{ width: px, height: px, objectFit: 'cover' }}
        />
      ) : (
        <div
          style={{
            width: px,
            height: px,
            background: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: px * 0.38,
          }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}

export default Avatar;
