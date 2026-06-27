import { getIdToken } from './auth';
import { firebaseAuth } from './client';

export interface UploadResult { url: string; publicId: string; }

async function waitForUser(timeoutMs = 5000): Promise<void> {
  if (firebaseAuth().currentUser) return;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsub(); reject(new Error('Not signed in')); }, timeoutMs);
    const unsub = firebaseAuth().onAuthStateChanged(user => {
      if (user) { clearTimeout(timer); unsub(); resolve(); }
    });
  });
}

export async function uploadFile(
  file: File,
  options: { onProgress?: (pct: number) => void } = {}
): Promise<UploadResult> {
  await waitForUser();
  const token = await getIdToken();
  const sigRes = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!sigRes.ok) {
    const { error } = await sigRes.json().catch(() => ({ error: 'Upload sign failed' }));
    throw new Error(error ?? 'Upload sign failed');
  }
  const { timestamp, signature, apiKey, cloudName, folder } =
    await sigRes.json() as { timestamp: string; signature: string; apiKey: string; cloudName: string; folder: string };

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
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);
    xhr.send(formData);
  });
}
