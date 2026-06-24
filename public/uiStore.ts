export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

export type AppPage = 'feed' | 'discover' | 'inbox' | 'profile' | 'create';

interface UIState {
  page: AppPage;
  setPage: (page: AppPage) => void;

  toasts: ToastItem[];
  showToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;

  // Bottom-sheet / modal stack — only one open at a time but tracked for analytics
  activeModal: string | null;
  openModal: (id: string) => void;
  closeModal: () => void;
}

let toastSeq = 0;

export const useUIStore = create<UIState>(set => ({
  page: 'feed',
  setPage: page => set({ page }),

  toasts: [],
  showToast: (message, variant = 'info') => {
    const id = `t${++toastSeq}`;
    set(state => ({ toasts: [...state.toasts, { id, message, variant }] }));
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 2800);
  },
  dismissToast: id => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),

  activeModal: null,
  openModal: id => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
}));
