// Chat files in Firebase Storage: photos, voice notes and documents. Files live under u/{myUid}/chat/... (only I can write there, see storage.rules);
// the message carries the download link, so my friend can open it without any extra permission.
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export const MAX_IMAGE_EDGE = 1600;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_VOICE_SECONDS = 300;
export const storageAvailable = () => !!storage;

const safeName = (n) => String(n || 'file').replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_').slice(-60) || 'file';

/** A photo shrunk to at most 1600 px and re-saved as JPEG, so a 12 MB phone picture becomes a few hundred KB. */
export async function shrinkImage(file, edge = MAX_IMAGE_EDGE, quality = 0.82) {
  if (!/^image\//.test(file.type) || /gif|svg/.test(file.type)) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('That file is not a usable picture.')); i.src = url; });
    const k = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', quality));
    return blob || file;
  } finally { URL.revokeObjectURL(url); }
}

/** Upload one file. onProgress(0..1). Resolves to the attachment object the chat message carries. */
export async function uploadAttachment(uid, kind, blob, { name, dur, onProgress } = {}) {
  if (!storage) throw new Error('File sharing is not switched on yet (Firebase Storage).');
  if (!uid) throw new Error('Sign in first');
  if (blob.size > MAX_FILE_BYTES) throw new Error('That file is too large (15 MB at most).');
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const ext = kind === 'voice' ? (/mp4|aac/.test(blob.type) ? 'm4a' : 'webm') : kind === 'image' ? 'jpg' : '';
  const fname = kind === 'file' ? safeName(name) : `${kind}.${ext}`;
  const r = ref(storage, `u/${uid}/chat/${stamp}_${fname}`);
  const task = uploadBytesResumable(r, blob, { contentType: blob.type || 'application/octet-stream' });
  await new Promise((ok, no) => task.on('state_changed', (s) => onProgress?.(s.bytesTransferred / Math.max(1, s.totalBytes)), no, ok));
  const url = await getDownloadURL(r);
  return { kind, url, name: kind === 'file' ? safeName(name) : '', size: blob.size, mime: blob.type || '', ...(kind === 'voice' ? { dur: Math.round(dur || 0) } : {}) };
}

/** Voice note recorder (tap to start, call stop() to get the file). */
export async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Voice notes are not supported on this device.');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks = []; const t0 = Date.now();
  rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
  rec.start();
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () => new Promise((ok) => { rec.onstop = () => { release(); ok({ blob: new Blob(chunks, { type: rec.mimeType || type || 'audio/webm' }), dur: (Date.now() - t0) / 1000 }); }; rec.stop(); }),
    cancel: () => { rec.onstop = null; try { rec.stop(); } catch { /* already stopped */ } release(); },
  };
}

/** Profile photo: one small JPEG per learner at u/{uid}/avatar.jpg. Resolves to its download link. */
export async function uploadAvatar(uid, file) {
  if (!storage) throw new Error('Photo upload is not switched on yet.');
  if (!uid) throw new Error('Sign in first');
  const blob = await shrinkImage(file, 384, 0.85);
  const r = ref(storage, `u/${uid}/avatar.jpg`);
  await new Promise((ok, no) => uploadBytesResumable(r, blob, { contentType: 'image/jpeg' }).on('state_changed', null, no, ok));
  return getDownloadURL(r);
}
