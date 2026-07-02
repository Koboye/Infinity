'use client';
import dynamic from 'next/dynamic';

const DaguV3App = dynamic(() => import('@/components/Infinity'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '100dvh', width: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14, background: '#0B0B0F',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'linear-gradient(135deg,#FF2156,#9D4EDD)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
      }}>∞</div>
      <div style={{
        width: 28, height: 28, border: '3px solid rgba(255,255,255,0.15)',
        borderTop: '3px solid #FF2156', borderRadius: '50%',
        animation: 'infSpin 0.8s linear infinite',
      }} />
      <style>{`@keyframes infSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ),
});

export default function Home() {
  return <DaguV3App />;
}
