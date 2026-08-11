import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';

// Server-only. Never import this file from a 'use client' component.
// Requires FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
// (service account creds — NOT the NEXT_PUBLIC_* client config).
//
// Initialization is LAZY (only happens the first time adminDb/adminAuth/
// adminMessaging is actually touched), not at module import time. Eager init
// meant `next build`'s page-data collection step — which imports every route
// module, including this one transitively — would hard-fail the ENTIRE build
// if Firebase credentials were missing or malformed, even for routes that
// don't use Firebase at all (e.g. /api/ai/conversation). Lazy init means
// credentials are only required once a Firebase-backed route is actually hit
// at runtime.
function initAdmin() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in your environment.'
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

// Proxies that defer both initAdmin() and getFirestore/getAuth/getMessaging()
// until the first property/method access (e.g. `adminDb.collection(...)`),
// so `import { adminDb } from '@/lib/firebase-admin'` alone never throws.
function lazy(getInstance) {
  let instance = null;
  return new Proxy(
    {},
    {
      get(_target, prop, receiver) {
        if (!instance) instance = getInstance();
        const value = instance[prop];
        return typeof value === 'function' ? value.bind(instance) : value;
      },
    }
  );
}

export const adminDb = lazy(() => getFirestore(initAdmin()));
export const adminAuth = lazy(() => getAuth(initAdmin()));
export const adminMessaging = lazy(() => getMessaging(initAdmin()));

// Verifies the Firebase ID token sent by the client in an Authorization: Bearer <token> header.
// Throws if missing/invalid. Use in every route that needs to know who's calling.
export async function requireAuth(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    const err = new Error('Missing Authorization header');
    err.status = 401;
    throw err;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded; // { uid, email, admin?: true, ... }
  } catch (e) {
    const err = new Error('Invalid or expired token');
    err.status = 401;
    throw err;
  }
}

// Same as requireAuth but also requires the admin custom claim.
export async function requireAdmin(req) {
  const decoded = await requireAuth(req);
  if (decoded.admin !== true) {
    const err = new Error('Admin privileges required');
    err.status = 403;
    throw err;
  }
  return decoded;
}
