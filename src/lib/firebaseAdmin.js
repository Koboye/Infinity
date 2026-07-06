// src/lib/firebaseAdmin.js
// One shared Admin SDK instance for every /api/* route (donations, wallet, etc).
// Guards against Next.js hot-reload / multiple route modules trying to call
// initializeApp() more than once, which throws "app already exists".
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  // Prefer a full service-account JSON in one env var (simplest to rotate in
  // most hosts); fall back to three discrete vars if that's how this project
  // already stores them. Either way, none of this is safe to expose client-side.
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
    });
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Private keys stored in env vars usually have their real newlines
      // escaped as literal "\n" — turn them back into actual newlines.
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const adminApp = getAdminApp();
export const db = getFirestore(adminApp);
export const auth = getAuth(adminApp);
