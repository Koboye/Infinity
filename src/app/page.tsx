'use client';
import dynamic from 'next/dynamic';
import React from 'react';

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('Altimate crashed:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          height: '100dvh', width: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14, background: '#F4F7F5', padding: 24, textAlign: 'center',
        }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#0B3B39,#0E7A55,#14A66E)' }} />
          <div style={{ fontWeight: 800, fontSize: 18, color: '#16201A' }}>Something went wrong</div>
          <div style={{ color: '#5B6961', fontSize: 14, maxWidth: 320 }}>Your data is saved on this device. Reloading usually fixes this.</div>
          <button onClick={() => window.location.reload()} style={{
            marginTop: 6, border: 'none', borderRadius: 999, padding: '11px 22px', fontWeight: 700,
            background: '#0E7A55', color: '#fff', cursor: 'pointer', fontSize: 14,
          }}>Reload App</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const GebeyaLinkApp = dynamic(() => import('@/components/GebeyaLink'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '100dvh', width: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14, background: '#F4F7F5',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: 'linear-gradient(135deg,#0B3B39,#0E7A55,#14A66E)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
        </svg>
      </div>
      <div style={{
        width: 26, height: 26, border: '3px solid rgba(14,122,85,0.18)',
        borderTop: '3px solid #0E7A55', borderRadius: '50%',
        animation: 'glSpin 0.8s linear infinite',
      }} />
      <style>{`@keyframes glSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ),
});

export default function Home() {
  return (
    <div className="app-frame-outer">
      <div className="app-frame">
        <AppErrorBoundary>
          <GebeyaLinkApp />
        </AppErrorBoundary>
      </div>
    </div>
  );
}
