'use client';
import dynamic from 'next/dynamic';
import ErrorGuard from '@/components/ErrorGuard';

// Preserve the complete existing Afro Zone game engine, with its original
// local/online play, saved progress, settings and game selection.
const GebetaApp = dynamic(() => import('@/components/GebetaApp'), {
  ssr: false,
  loading: () => <div className="boot" role="status" aria-label="Loading game break"><div className="boot-card"><div className="boot-name">Loading games…</div></div></div>,
});
export default function GameBreak() {
  return <ErrorGuard><GebetaApp /></ErrorGuard>;
}
