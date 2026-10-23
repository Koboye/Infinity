'use client';
import dynamic from 'next/dynamic';

const GebetaApp = dynamic(() => import('@/components/GebetaApp'), {
  ssr: false,
  loading: () => <div className="boot"><div className="boot-seed" /></div>,
});

export default function Home() {
  return <GebetaApp />;
}
