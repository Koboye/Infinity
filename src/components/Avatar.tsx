'use client';

interface AvatarProps {
  name: string; color?: string; src?: string | null;
  size?: 'xs'|'sm'|'md'|'lg'|'xl'; className?: string;
  onClick?: () => void; ring?: boolean;
}

const SIZES = { xs:24, sm:32, md:40, lg:48, xl:96 };
const FONT = { xs:10, sm:12, md:14, lg:16, xl:24 };

export function Avatar({ name, color='#3D6B4F', src, size='md', onClick, ring }: AvatarProps) {
  const px = SIZES[size]; const fs = FONT[size];
  return (
    <button type="button" onClick={onClick} style={{ width:px, height:px, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'white', fontSize:fs, flexShrink:0, overflow:'hidden', border: ring ? '2px solid rgba(255,255,255,0.8)' : 'none', cursor: onClick ? 'pointer' : 'default', padding:0 }} aria-label={`${name}'s avatar`}>
      {src ? <img src={src} alt={name} style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy" /> : (name?.[0]??'?').toUpperCase()}
    </button>
  );
}
