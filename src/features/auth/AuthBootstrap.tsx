'use client';
import { useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { onAuthChanged } from '@/lib/firebase/auth';
import { firebaseDb } from '@/lib/firebase/client';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/types';

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
      const initial = await getDoc(ref);
      if (initial.exists()) {
        setUser({ ...(initial.data() as UserProfile), id: fbUser.uid });
      } else {
        // Firebase Auth user exists but Firestore profile doc is missing —
        // this can happen if registration failed partway through, or if the
        // doc was manually deleted. Sign out and show the auth screen so the
        // user can re-register rather than landing in a broken state.
        const { signOutCurrent } = await import('@/lib/firebase/auth');
        await signOutCurrent();
        setStatus('unauthenticated');
        return;
      }
      profileUnsub?.();
      profileUnsub = onSnapshot(ref, snap => {
        if (snap.exists()) setUser({ ...(snap.data() as UserProfile), id: fbUser.uid });
      });
    });
    return () => { authUnsub(); profileUnsub?.(); };
  }, [setUser, setStatus]);

  return <>{children}</>;
}
