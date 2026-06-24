import React from 'react';

interface AvatarProps {
  src?: string;
  username?: string;
  size?: number;
  style?: React.CSSProperties;
}

export default function Avatar({ src, username, size = 40, style }: AvatarProps) {
  return src ? (
    <img
      src={src}
      alt={username || 'avatar'}
      width={size}
      height={size}
      style={{ borderRadius: '50%', objectFit: 'cover', width: size, height: size, ...style }}
    />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#FF2156', display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#fff', fontWeight: 700,
      fontSize: size * 0.4, flexShrink: 0, ...style
    }}>
      {(username || '?')[0].toUpperCase()}
    </div>
  );
}
