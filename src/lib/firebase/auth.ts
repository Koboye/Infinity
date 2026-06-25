import {
  GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged,
  sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup,
  signOut, updateProfile as fbUpdateProfile, type User as FirebaseUser,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from './client';
import type { UserProfile } from '@/types';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const buildProfile = (uid: string, data: { email: string; username: string; fullName?: string }): UserProfile => ({
  id: uid, username: data.username, fullName: data.fullName ?? '',
  email: data.email, avatar: (data.username || data.email)[0]!.toUpperCase(),
  avatarColor: `hsl(${Math.floor(Math.random() * 360)},70%,60%)`,
  avatarUrl: null, bio: 'New to Dagu! 🎬', link: '', verified: false,
  followers: [], following: [], blockedUsers: [], coins: 500, walletBalance: 500,
  level: 1, streak: 1, subscription: 'free', language: 'en', theme: 'dark',
  createdAt: new Date().toISOString(),
});

export async function signUpWithEmail(input: { email: string; password: string; username: string; fullName?: string }): Promise<UserProfile> {
  const cred = await createUserWithEmailAndPassword(firebaseAuth(), input.email, input.password);
  if (input.fullName) await fbUpdateProfile(cred.user, { displayName: input.fullName });
  await cred.user.sendEmailVerification();
  const profile = buildProfile(cred.user.uid, input);
  await setDoc(doc(firebaseDb(), 'users', cred.user.uid), { ...profile, createdAt: serverTimestamp() });
  await signOut(firebaseAuth());
  return profile;
}

export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const { user } = await signInWithEmailAndPassword(firebaseAuth(), email, password);
  if (!user.emailVerified) {
    await signOut(firebaseAuth());
    throw new Error('Please verify your email first. Check your inbox.');
  }
  return user;
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const cred = await signInWithPopup(firebaseAuth(), googleProvider);
  await setDoc(doc(firebaseDb(), 'users', cred.user.uid), {
    id: cred.user.uid, email: cred.user.email ?? '',
    username: cred.user.displayName?.replace(/\s+/g, '_').toLowerCase() ?? `user_${cred.user.uid.slice(0, 6)}`,
    fullName: cred.user.displayName ?? '', avatarUrl: cred.user.photoURL ?? null,
    avatar: (cred.user.displayName ?? 'U')[0]!.toUpperCase(),
    avatarColor: `hsl(${Math.floor(Math.random() * 360)},70%,60%)`,
    bio: 'New to Dagu! 🎬', createdAt: serverTimestamp(),
  }, { merge: true });
  return cred.user;
}

export async function signOutCurrent(): Promise<void> { await signOut(firebaseAuth()); }
export async function sendResetEmail(email: string): Promise<void> { await sendPasswordResetEmail(firebaseAuth(), email); }
export function onAuthChanged(handler: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(firebaseAuth(), handler);
}
