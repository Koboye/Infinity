import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Same config Infinity.jsx uses. getApps() guard lets standalone pages (e.g. /dimts)
// share the already-signed-in session instead of creating a second app.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
export const fbApp = () => (getApps().length ? getApp() : initializeApp(config));
export const fbAuth = () => getAuth(fbApp());

// Same contract as apiFetch in Infinity.jsx: attach the Firebase ID token, throw Error(data.error) on failure.
export async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const user = fbAuth().currentUser;
  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  const res = await fetch(path, { ...options, headers });
  if (options.raw) { if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`); return res; }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}
