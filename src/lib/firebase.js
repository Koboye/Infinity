// Client Firebase. Optional: with no env config the app still runs offline (computer + pass-and-play).
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const onlineAvailable = !!(cfg.apiKey && cfg.projectId);
let app = null;
if (onlineAvailable) app = getApps()[0] || initializeApp(cfg);

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Server clock offset (ms): a phone with a wrong clock must still see the right turn timer.
let skew = 0;
export const serverNow = () => Date.now() + skew;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** POST to the game API. Network hiccups and 5xx answers are retried (a repeated move is harmless: the server checks the turn). */
export async function apiCall(body, { retries = 2 } = {}) {
  if (!auth?.currentUser) throw new Error('Sign in to play online');
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const token = await auth.currentUser.getIdToken();
      const t0 = Date.now();
      const res = await fetch('/api/gebeta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const t1 = Date.now();
      let data = null;
      try { data = await res.json(); } catch { /* empty */ }
      if (data && Number.isFinite(data.serverNow)) skew = data.serverNow - (t0 + t1) / 2;
      if (res.status >= 500 && attempt < retries) { await sleep(500 * (attempt + 1)); continue; }
      if (!res.ok) throw Object.assign(new Error(data?.error || `Request failed (${res.status})`), { final: true });
      return data;
    } catch (e) {
      if (e.final) throw e;
      last = e;
      if (attempt < retries) await sleep(500 * (attempt + 1)); // offline / dropped connection
    }
  }
  throw new Error(navigator.onLine === false ? 'You are offline — reconnecting…' : (last?.message || 'Connection problem, try again'));
}
