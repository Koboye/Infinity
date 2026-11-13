// Browser-side Firebase (sign-in only) and the small API helper every screen uses.
'use client';
import { useEffect, useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';

const cfg = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID };
const app = cfg.apiKey ? (getApps()[0] || initializeApp(cfg)) : null;
export const auth = app && typeof window !== 'undefined' ? getAuth(app) : null;
export const authConfigured = !!cfg.apiKey;

export function useUser() {
  const [state, set] = useState({ user: null, ready: !authConfigured });
  useEffect(() => (auth ? onAuthStateChanged(auth, (user) => set({ user, ready: true })) : undefined), []);
  return state;
}
export const signInGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signInEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signUpEmail = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const signOut = () => fbSignOut(auth);

/** Call our API. Adds the signed-in token when there is one. Throws Error(message) on any failure. */
export async function api(path, body, { admin } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth?.currentUser) headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
  if (admin) headers['x-admin-secret'] = admin;
  const res = await fetch(path, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}
