'use client';

import { useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { onAuthChanged } from '@/lib/firebase/auth';
import { firebaseDb } from '@/lib/firebase/client';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/types';

/**
 * Mounts once at the top of the app. Subscribes to Firebase Auth + the user
 * profile doc and pushes both into the Zustand auth store. This is the
 * single place where SDK types are converted into our domain types.
 */
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore(s => s.setUser);
  const setStatus = useAuthStore(s => s.setStatus);

  useEffect(() => {
    setStatus('loading');
    let profileUnsub: (() => void) | null = null;

    const authUnsub = onAuthChanged(async fbUser => {
      if (!fbUser) {
        profileUnsub?.();
        profileUnsub = null;
        setUser(null);
        return;
      }
      const ref = doc(firebaseDb(), 'users', fbUser.uid);
      // Try a one-shot get first so we have data immediately
      const initial = await getDoc(ref);
      if (initial.exists()) {
        const data = initial.data();
        setUser({
          ...(data as UserProfile),
          id: fbUser.uid,
        });
      }
      // Then subscribe for live updates
      profileUnsub?.();
      profileUnsub = onSnapshot(ref, snap => {
        if (snap.exists()) {
          setUser({ ...(snap.data() as UserProfile), id: fbUser.uid });
        }
      });
    });

    return () => {
      authUnsub();
      profileUnsub?.();
    };
  }, [setUser, setStatus]);

  return <>{children}</>;
}
