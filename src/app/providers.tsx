'use client';
// src/app/providers.tsx
// Added LocaleSync so the user's language preference is applied on the <html> element.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { LocaleSync } from '@/components/LocaleSync';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleSync />
      {children}
    </QueryClientProvider>
  );
}
