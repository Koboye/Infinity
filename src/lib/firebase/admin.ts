import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let _app: App | null = null;

function getAdminApp(): App {
  if (_app) return _app;
  const existing = getApps();
  if (existing.length > 0) {
    _app = existing[0]!;
    return _app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      `Missing Firebase Admin credentials. ` +
      `projectId=${!!projectId} clientEmail=${!!clientEmail} privateKey=${!!privateKey}`
    );
  }

  // Vercel sometimes strips the surrounding quotes — remove them if present
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }

  // Convert literal \n sequences to real newlines
  privateKey = privateKey.replace(/\\n/g, '\n');

  // Validate the key looks correct
  if (!privateKey.includes('-----BEGIN')) {
    throw new Error('FIREBASE_PRIVATE_KEY does not contain BEGIN marker — check Vercel env var');
  }

  _app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return _app;
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

export async function requireUser(request: Request): Promise<{ uid: string }> {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AuthError('Missing Authorization header');
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch (err) {
    // Log the real error so it appears in Vercel function logs
    console.error('[requireUser] verifyIdToken failed:', err);
    throw new AuthError('Invalid or expired token');
  }
}

export class AuthError extends Error {}
