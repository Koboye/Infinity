'use client';
import { useEffect } from 'react';
import { onAuthChanged } from '@/lib/firebase/auth';
import { getDoc, doc } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase/client';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/types';

export function AuthSync() {
  const setUser = useAuthStore(s => s.setUser);
  const setStatus = useAuthStore(s => s.setStatus);

  useEffect(() => {
    setStatus('idle');
    const unsub = onAuthChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        return;
      }
      try {
        const snap = await getDoc(doc(firebaseDb(), 'users', firebaseUser.uid));
        if (snap.exists()) {
          setUser(snap.data() as UserProfile);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
    });
    return () => unsub();
  }, [setUser, setStatus]);

  return null;
}
