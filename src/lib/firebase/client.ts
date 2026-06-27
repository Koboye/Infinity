import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

let _app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  const apps = getApps();
  if (apps.length > 0) { _app = apps[0]!; return _app; }
  _app = initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  return _app;
}

export function firebaseAuth(): Auth { return getAuth(getFirebaseApp()); }
export function firebaseDb(): Firestore { return getFirestore(getFirebaseApp()); }
