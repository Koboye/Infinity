import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from './client';

export interface UploadResult { url: string; publicId: string; }

async function getFreshToken(): Promise<string> {
  const auth = getAuth(getFirebaseApp());
  if (!auth.currentUser) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { unsub(); reject(new Error('Not signed in')); }, 8000);
      const unsub = auth.onAuthStateChanged(user => {
        if (user) { clearTimeout(timer); unsub(); resolve(); }
      });
    });
  }
  if (!auth.currentUser) throw new Error('Not signed in — please sign in again');
  return auth.currentUser.getIdToken(true);
}

export async function uploadFile(
  file: File,
  options: { onProgress?: (pct: number) => void } = {}
): Promise<UploadResult> {

  let token: string;
  try {
    token = await getFreshToken();
  } catch {
    throw new Error('Authentication failed — please sign out and sign in again');
  }

  const sigRes = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!sigRes.ok) {
    const body = await sigRes.json().catch(() => ({}));
    throw new Error(`Upload sign failed (${sigRes.status}): ${body.detail ?? body.error ?? 'unknown'}`);
  }

  const { timestamp, signature, apiKey, cloudName, folder } = await sigRes.json();

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) options.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve({ url: data.secure_url, publicId: data.public_id });
      } else {
        // Show the REAL Cloudinary error message
        let msg = `Cloudinary ${xhr.status}`;
        try {
          const err = JSON.parse(xhr.responseText);
          msg = err?.error?.message ?? msg;
        } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);
    xhr.send(formData);
  });
}
