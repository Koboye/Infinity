import { create } from 'zustand';
import type { UserProfile, AuthStatus } from '@/types';

interface AuthState {
  status: AuthStatus;
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  setStatus: (status: AuthStatus) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>()(set => ({
  status: 'idle',
  user: null,
  setUser: user => set({ user, status: user ? 'authenticated' : 'unauthenticated' }),
  setStatus: status => set({ status }),
  signOut: () => set({ user: null, status: 'unauthenticated' }),
}));
