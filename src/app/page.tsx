'use client';
import dynamic from 'next/dynamic';

// Client-only (Firebase auth + microphone). Lazy so the first paint is instant.
const App = dynamic(() => import('@/components/App'), {
  ssr: false,
  loading: () => <div style={{ height: '100dvh', display: 'grid', placeItems: 'center', background: '#F5F8FF', color: '#0B5FFF', fontSize: 28, fontWeight: 800 }}>ድምጽ</div>,
});

export default function Home() { return <App />; }
