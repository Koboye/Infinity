import { getIdToken } from './auth';

export interface UploadResult { url: string; publicId: string; }

export async function uploadFile(
  file: File,
  options: { onProgress?: (pct: number) => void } = {}
): Promise<UploadResult> {
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
