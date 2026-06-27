'use client';
import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';

const COLORS = {
  success: { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46', dot: '#10B981' },
  error:   { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', dot: '#EF4444' },
  info:    { bg: '#EEE9FF', border: '#C4B5FD', text: '#4C1D95', dot: '#6B4EFF' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', dot: '#F59E0B' },
};

export function ToastHost() {
  const toast = useUIStore(s => s.toasts);
  const clearToast = useUIStore(s => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 2800);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  const c = COLORS[toast.kind] ?? COLORS.info;

  return (
    <div style={{
      position: 'fixed', top: 60, left: 0, right: 0,
      display: 'flex', justifyContent: 'center',
      zIndex: 999, pointerEvents: 'none',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 14,
        padding: '10px 18px',
        display: 'flex', alignItems: 'center', gap: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        maxWidth: 320,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{toast.message}</span>
      </div>
    </div>
  );
}
