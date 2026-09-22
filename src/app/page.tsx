'use client';
import dynamic from 'next/dynamic';

const GebeyaLinkApp = dynamic(() => import('@/components/GebeyaLink'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '100dvh', width: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14, background: '#F4F7F2',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: '#1E6B45',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, color: '#fff', fontWeight: 700, fontFamily: 'Georgia, serif',
      }}>ገ</div>
      <div style={{
        width: 26, height: 26, border: '3px solid rgba(30,107,69,0.18)',
        borderTop: '3px solid #1E6B45', borderRadius: '50%',
        animation: 'glSpin 0.8s linear infinite',
      }} />
      <style>{`@keyframes glSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ),
});

export default function Home() {
  return <GebeyaLinkApp />;
}
