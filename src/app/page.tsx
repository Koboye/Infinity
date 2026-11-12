'use client';
import dynamic from 'next/dynamic';

import ErrorGuard from '@/components/ErrorGuard';

const GebetaApp = dynamic(() => import('@/components/GebetaApp'), {
  ssr: false,
  loading: () => (
    <div className="boot" role="status" aria-label="Loading Afro Zone">
      <div className="boot-card">
        <img className="boot-logo" src="/icon-192.png" alt="" width={96} height={96} />
        <div className="boot-name">AFRO ZONE</div>
        <div className="boot-tag">Classic games, Ethiopian style</div>
        <div className="boot-bar"><i /></div>
      </div>
    </div>
  ),
});

export default function Home() {
  return <ErrorGuard><GebetaApp /></ErrorGuard>;
}
