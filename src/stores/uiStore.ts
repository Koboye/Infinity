import { create } from 'zustand';
import type { ToastItem, ToastVariant, AppPage } from '@/types';

interface UIState {
  page: AppPage;
  setPage: (page: AppPage) => void;
  toasts: ToastItem[];
  showToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;
  activeModal: string | null;
  openModal: (id: string) => void;
  closeModal: () => void;
}

let seq = 0;

export const useUIStore = create<UIState>(set => ({
  page: 'feed',
  setPage: page => set({ page }),
  toasts: [],
  showToast: (message, variant = 'info') => {
    const id = `t${++seq}`;
    set(state => ({ toasts: [...state.toasts, { id, message, variant }] }));
    setTimeout(() => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })), 2800);
  },
  dismissToast: id => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
  activeModal: null,
  openModal: id => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
}));
