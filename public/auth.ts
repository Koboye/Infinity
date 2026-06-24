/**
 * Auth service — wraps Firebase Auth with typed helpers.
 * Replaces the inline signInWithEmailAndPassword / createUserWithEmailAndPassword
 * scattered through the original <AuthScreen>.
 */

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile as fbUpdateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from '@/lib/firebase/client';
import type { Language, Theme, UserProfile } from '@/types';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const buildDefaultProfile = (
  uid: string,
  data: Partial<UserProfile> & { email: string; username: string },
): UserProfile => ({
  id: uid,
  username: data.username,
  fullName: data.fullName ?? '',
  email: data.email,
  avatar: (data.username || data.email)[0]!.toUpperCase(),
  avatarColor: `hsl(${Math.floor(Math.random() * 360)},70%,60%)`,
  avatarUrl: null,
  bio: 'New to Dagu! 🎬',
  link: '',
  verified: false,
  followers: [],
  following: [],
  blockedUsers: [],
  coins: 500,
  walletBalance: 500,
  level: 1,
  streak: 1,
  subscription: 'free',
  language: 'en',
  theme: 'dark',
  createdAt: new Date().toISOString(),
});

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  username: string;
  fullName?: string;
  language?: Language;
}): Promise<UserProfile> {
  const auth = firebaseAuth();
  const cred = await createUserWithEmailAndPassword(auth, input.email, input.password);
  if (input.fullName) {
    await fbUpdateProfile(cred.user, { displayName: input.fullName });
  }
  const profile = buildDefaultProfile(cred.user.uid, {
    email: input.email,
    username: input.username,
    fullName: input.fullName,
    language: input.language,
  });
  await setDoc(doc(firebaseDb(), 'users', cred.user.uid), {
    ...profile,
    createdAt: serverTimestamp(),
  });
  return profile;
}

export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const cred = await signInWithEmailAndPassword(firebaseAuth(), email, password);
  return cred.user;
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const cred = await signInWithPopup(firebaseAuth(), googleProvider);
  // Ensure profile doc exists for first-time Google sign-ins
  const ref = doc(firebaseDb(), 'users', cred.user.uid);
  await setDoc(
    ref,
    {
      id: cred.user.uid,
      email: cred.user.email ?? '',
      username: cred.user.displayName?.replace(/\s+/g, '_').toLowerCase() ?? `user_${cred.user.uid.slice(0, 6)}`,
      fullName: cred.user.displayName ?? '',
      avatarUrl: cred.user.photoURL ?? null,
      avatar: (cred.user.displayName ?? cred.user.email ?? 'U')[0]!.toUpperCase(),
      avatarColor: `hsl(${Math.floor(Math.random() * 360)},70%,60%)`,
      bio: 'New to Dagu! 🎬',
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
  return cred.user;
}

export async function signOutCurrent(): Promise<void> {
  await signOut(firebaseAuth());
}

export async function sendResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(firebaseAuth(), email);
}

export function onAuthChanged(handler: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(firebaseAuth(), handler);
}

/** Helper to apply a theme/language update both locally and to Firestore. */
export async function updatePreferences(
  uid: string,
  prefs: Partial<Pick<UserProfile, 'language' | 'theme'>>,
): Promise<void> {
  await setDoc(doc(firebaseDb(), 'users', uid), prefs, { merge: true });
}
