'use client';

import { AnimatePresence, m } from 'framer-motion';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils/cn';

const VARIANT_STYLES = {
  success: 'bg-gradient-to-br from-teal to-teal-2',
  error: 'bg-gradient-to-br from-accent to-[#FF8552]',
  info: 'bg-gradient-to-br from-info to-indigo',
  warning: 'bg-gradient-to-br from-warning to-[#FF8552]',
} as const;

export function ToastHost() {
  const toasts = useUIStore(s => s.toasts);
  const dismiss = useUIStore(s => s.dismissToast);

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-28 z-[9999] flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence>
        {toasts.map(t => (
          <m.div
            key={t.id}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className="pointer-events-auto flex max-w-[90vw] items-center gap-2.5 rounded-full border border-white/10 bg-[rgba(15,15,15,0.95)] py-2.5 pl-2.5 pr-4 shadow-2xl backdrop-blur-xl"
          >
            <div className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white', VARIANT_STYLES[t.variant])}>
              {t.variant === 'success' ? '✓' : t.variant === 'error' ? '✕' : t.variant === 'warning' ? '!' : 'i'}
            </div>
            <span className="text-[13px] font-medium">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="ml-1 text-white/40 hover:text-white/70"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
