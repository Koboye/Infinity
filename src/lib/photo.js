// Your profile picture. It is chosen from the phone's own gallery or camera, shrunk to a small square and kept on this device.
// Signed in, it is also saved on your account so it follows you (see ProfileScreen). Nothing is uploaded anywhere else.
import { useEffect, useState } from 'react';

const KEY = 'gebeta.photo.v1';
export const PHOTO_SIZE = 160;        // pixels, square
export const MAX_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_STORED_CHARS = 28000; // keeps the data small enough for the account document

/** The largest centred square inside w×h, as a crop rectangle. */
export function cropSquare(w, h) { const s = Math.min(w, h); return { sx: Math.round((w - s) / 2), sy: Math.round((h - s) / 2), s }; }

const emit = () => { try { window.dispatchEvent(new Event('photo:change')); } catch { /* no window */ } };
export const getPhoto = () => { try { return window.localStorage.getItem(KEY) || null; } catch { return null; } };
export function storePhoto(dataUrl) {
  try { if (dataUrl) window.localStorage.setItem(KEY, dataUrl); else window.localStorage.removeItem(KEY); } catch { return false; }
  emit(); return true;
}

/** Turn a picked image file into a small square JPEG data URL. Throws a short, readable message on a bad file. */
export async function photoFromFile(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('not-image');
  if (file.size > MAX_FILE_BYTES) throw new Error('too-big');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('not-image')); i.src = url; });
    const { sx, sy, s } = cropSquare(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas'); c.width = c.height = PHOTO_SIZE;
    c.getContext('2d').drawImage(img, sx, sy, s, s, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    for (const q of [0.85, 0.7, 0.55, 0.4]) { const out = c.toDataURL('image/jpeg', q); if (out.length <= MAX_STORED_CHARS) return out; }
    throw new Error('too-big');
  } finally { URL.revokeObjectURL(url); }
}

export function usePhoto() {
  const [p, setP] = useState(null);
  useEffect(() => { const read = () => setP(getPhoto()); read(); window.addEventListener('photo:change', read); return () => window.removeEventListener('photo:change', read); }, []);
  return p;
}
