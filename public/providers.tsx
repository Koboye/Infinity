'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion';
import { useState } from 'react';
import { ToastHost } from '@/components/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  // One QueryClient per app instance — never re-create on re-render.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
          {children}
          <ToastHost />
        </MotionConfig>
      </LazyMotion>
    </QueryClientProvider>
  );
}
