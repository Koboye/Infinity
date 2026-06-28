'use client';
import { AuthBootstrap } from '@/features/auth/AuthBootstrap';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { AppShell } from '@/features/AppShell';
import { useAuthStore } from '@/stores/authStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function HomePage() {
  return (
    <ErrorBoundary>
      <AuthBootstrap>
        <Gate />
      </AuthBootstrap>
    </ErrorBoundary>
  );
}

function Gate() {
  const status = useAuthStore(s => s.status);
  if (status === 'loading' || status === 'idle') {
    return (
      <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'#F8F7F4', flexDirection:'column', gap:12 }}>
        <div style={{ width:64, height:64, borderRadius:20, background:'#3D6B4F', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 32px rgba(61,107,79,0.3)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
            <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-8 2S13 2 17 8z"/>
          </svg>
        </div>
        <p style={{ color:'#9CA3AF', fontSize:14 }}>infinity</p>
      </div>
    );
  }
  if (status === 'unauthenticated') return <AuthScreen />;
  return <AppShell />;
}
