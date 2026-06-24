import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyD9jDk8gijMVAYrsFe4vpojI7GyZnkzGL8',
  authDomain: 'dagu-8348c.firebaseapp.com',
  projectId: 'dagu-8348c',
  storageBucket: 'dagu-8348c.firebasestorage.app',
  messagingSenderId: '259738670911',
  appId: '1:259738670911:web:c4d1116e3697a8f67c658a',
  measurementId: 'G-KJW3QQJ26X',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
