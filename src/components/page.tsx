'use client';

import { useEffect } from 'react';
import { AuthBootstrap } from '@/features/auth/AuthBootstrap';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { AppShell } from '@/features/AppShell';
import { useAuthStore } from '@/stores/authStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Skeleton } from '@/components/Skeleton';

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
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg-base">
        <div className="gradient-brand flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black shadow-2xl shadow-accent/30">
          D
        </div>
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <AuthScreen />;
  }

  return <AppShell />;
}
