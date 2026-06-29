// src/lib/firebase/upload.ts
import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from './client';

export interface UploadResult { 
  url: string; 
  publicId: string; 
}

async function getFreshToken(): Promise<string> {
  const auth = getAuth(getFirebaseApp());

  if (!auth.currentUser) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(new Error('Not signed in — please sign in again'));
      }, 8000);
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
  console.log('📤 === UPLOAD FILE STARTED ===');
  console.log('📁 File:', file.name, file.type, file.size);
  console.log('📁 File size in MB:', (file.size / 1024 / 1024).toFixed(2));

  let token: string;
  try {
    token = await getFreshToken();
    console.log('✅ Got fresh token');
  } catch (e) {
    console.error('❌ Auth failed:', e);
    throw new Error('Authentication failed — please sign out and sign in again');
  }

  console.log('📤 Calling /api/upload...');
  const sigRes = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log('📡 /api/upload response status:', sigRes.status);
  
  if (!sigRes.ok) {
    let detail = '';
    try { 
      const b = await sigRes.json(); 
      detail = b.detail ?? b.error ?? ''; 
      console.log('📡 Error details:', b); 
    } catch (e) { 
      console.log('❌ Failed to parse error:', e); 
    }
    throw new Error(`Upload failed (${sigRes.status})${detail ? ': ' + detail : ''}`);
  }

  const { timestamp, apiKey, cloudName, folder, upload_preset } = await sigRes.json();
  console.log('✅ Got upload config (UNSIGNED):', { cloudName, folder, upload_preset, timestamp });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  // ❌ NO signature - UNSIGNED mode!
  formData.append('folder', folder);
  formData.append('upload_preset', upload_preset);

  console.log('📤 Sending to Cloudinary (UNSIGNED)...');
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) options.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      console.log('📡 Cloudinary response status:', xhr.status);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          console.log('✅ Cloudinary success:', data.secure_url);
          resolve({ url: data.secure_url, publicId: data.public_id });
        } catch (e) {
          console.error('❌ Failed to parse Cloudinary response:', e);
          reject(new Error('Invalid response from Cloudinary'));
        }
      } else {
        let msg = `Cloudinary upload failed: ${xhr.status}`;
        try { 
          const errData = JSON.parse(xhr.responseText);
          console.log('❌ Cloudinary error:', errData);
          msg = errData?.error?.message ?? msg;
        } catch (e) { 
          console.log('❌ Failed to parse Cloudinary error:', e); 
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => {
      console.error('❌ XHR error');
      reject(new Error('Network error during upload'));
    };
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);
    xhr.send(formData);
  });
}
