'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { LocaleSync } from '@/components/LocaleSync';
import { AuthSync } from '@/components/AuthSync';  // ← ADD THIS

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />        {/* ← ADD THIS */}
      <LocaleSync />
      {children}
    </QueryClientProvider>
  );
}
