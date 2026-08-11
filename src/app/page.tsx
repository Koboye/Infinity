'use client';
import dynamic from 'next/dynamic';

const DaguV3App = dynamic(() => import('@/components/Infinity'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '100dvh', width: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14, background: '#F7F5FC',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'linear-gradient(135deg,#8B5CF6,#EC4899)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#fff',
      }}>∞</div>
      <div style={{
        width: 28, height: 28, border: '3px solid rgba(139,92,246,0.2)',
        borderTop: '3px solid #8B5CF6', borderRadius: '50%',
        animation: 'infSpin 0.8s linear infinite',
      }} />
      <style>{`@keyframes infSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ),
});

export default function Home() {
  return <DaguV3App />;
}
