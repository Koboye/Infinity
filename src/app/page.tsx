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
      <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'#0B0B0F', flexDirection:'column', gap:12 }}>
        <div className="gradient-brand" style={{ width:56, height:56, borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:900, color:'white' }}>I</div>
      </div>
    );
  }
  if (status === 'unauthenticated') return <AuthScreen />;
  return <AppShell />;
}
