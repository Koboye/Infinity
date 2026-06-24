/**
 * Firebase client SDK — browser only.
 * Lazy-initialized to avoid SSR issues and unnecessary work on server routes.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function readEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    // In dev, fall back to the original Dagu project's public config so the
    // demo works out-of-the-box. In production, env vars are required.
    if (process.env.NODE_ENV === 'production') {
      console.warn(`[firebase] Missing env var: ${key}`);
    }
    return '';
  }
  return value;
}

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  const apps = getApps();
  if (apps.length > 0) {
    _app = apps[0]!;
    return _app;
  }
  _app = initializeApp({
    apiKey: readEnv('NEXT_PUBLIC_FIREBASE_API_KEY'),
    authDomain: readEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: readEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
    storageBucket: readEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: readEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    appId: readEnv('NEXT_PUBLIC_FIREBASE_APP_ID'),
    measurementId: readEnv('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID'),
  });
  return _app;
}

export function firebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(getFirebaseApp());
  return _auth;
}

export function firebaseDb(): Firestore {
  if (!_db) _db = getFirestore(getFirebaseApp());
  return _db;
}
