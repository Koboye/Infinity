// src/lib/firebase/auth.ts - CLIENT-SIDE ONLY
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged,
  sendPasswordResetEmail, sendEmailVerification, signInWithEmailAndPassword, signInWithPopup,
  signOut, updateProfile as fbUpdateProfile, type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from './client';
import type { UserProfile } from '@/types';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const buildProfile = (uid: string, data: { email: string; username?: string; fullName?: string }): UserProfile => {
  // Auto-generate username from email if not provided
  let username = data.username;
  if (!username || username.trim() === '') {
    username = data.email.split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 20);
    if (username.length < 3) username = `user_${uid.slice(0, 8)}`;
  }
  return {
    id: uid,
    username,
    fullName: data.fullName ?? '',
    email: data.email,
    avatar: (username || data.email)[0]!.toUpperCase(),
    avatarColor: `hsl(${Math.floor(Math.random() * 360)},70%,60%)`,
    avatarUrl: null,
    bio: 'New to Infinity! 🎬',
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
  };
};

export async function signUpWithEmail(input: {
  email: string; password: string; username?: string; fullName?: string;
}): Promise<UserProfile> {
  const cred = await createUserWithEmailAndPassword(firebaseAuth(), input.email, input.password);
  if (input.fullName) await fbUpdateProfile(cred.user, { displayName: input.fullName });
  await sendEmailVerification(cred.user);

  const token = await cred.user.getIdToken();
  
  const username = input.username && input.username.trim() !== '' 
    ? input.username 
    : undefined;
    
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ 
      username, 
      fullName: input.fullName,
      email: input.email 
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    console.error('Register API failed:', res.status, errBody);
    throw new Error('Account setup failed — please try again.');
  }

  await signOut(firebaseAuth());
  return buildProfile(cred.user.uid, input);
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
  const userRef = doc(firebaseDb(), 'users', cred.user.uid);

  const existing = await getDoc(userRef);
  const email = cred.user.email ?? '';
  let username = cred.user.displayName?.replace(/\s+/g, '_').toLowerCase() ?? '';
  if (!username || username.trim() === '') {
    username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
  }
  
  const baseFields = {
    id: cred.user.uid,
    email,
    username,
    fullName: cred.user.displayName ?? '',
    avatarUrl: cred.user.photoURL ?? null,
    avatar: (cred.user.displayName ?? 'U')[0]!.toUpperCase(),
    bio: 'New to Infinity! 🎬',
  };

  if (existing.exists()) {
    await updateDoc(userRef, {
      email: baseFields.email,
      avatarUrl: baseFields.avatarUrl,
      fullName: baseFields.fullName,
    });
  } else {
    await setDoc(userRef, {
      ...baseFields,
      avatarColor: `hsl(${Math.floor(Math.random() * 360)},70%,60%)`,
      createdAt: serverTimestamp(),
      verified: false,
      followers: [], following: [], blockedUsers: [],
      coins: 500, walletBalance: 500, level: 1, streak: 1,
      subscription: 'free', language: 'en', theme: 'dark', link: '',
    });
  }

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

export async function getIdToken(): Promise<string> {
  const auth = firebaseAuth();
  if (!auth.currentUser) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { unsub(); reject(new Error('Not signed in')); }, 5000);
      const unsub = auth.onAuthStateChanged(u => {
        if (u) { clearTimeout(timer); unsub(); resolve(); }
      });
    });
  }
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  return user.getIdToken(true);
}
