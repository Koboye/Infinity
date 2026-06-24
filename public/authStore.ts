/**
 * Auth store — single source of truth for the current user session.
 * Components subscribe to slices via Zustand selectors, which prevents
 * the global re-render storm we saw in the original `useState`-heavy code.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Language, Theme, UserProfile } from '@/types';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  setStatus: (status: AuthStatus) => void;
  patchPrefs: (prefs: Partial<Pick<UserProfile, 'language' | 'theme'>>) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>()(
  subscribeWithSelector(set => ({
    status: 'idle',
    user: null,
    setUser: user => set({ user, status: user ? 'authenticated' : 'unauthenticated' }),
    setStatus: status => set({ status }),
    patchPrefs: prefs =>
      set(state => ({
        user: state.user ? { ...state.user, ...prefs } : null,
      })),
    signOut: () => set({ user: null, status: 'unauthenticated' }),
  })),
);

// Selectors — components import these for stable references.
export const selectUser = (s: AuthState): UserProfile | null => s.user;
export const selectIsAuthed = (s: AuthState): boolean => s.status === 'authenticated' && !!s.user;
export const selectLanguage = (s: AuthState): Language => s.user?.language ?? 'en';
export const selectTheme = (s: AuthState): Theme => s.user?.theme ?? 'dark';
