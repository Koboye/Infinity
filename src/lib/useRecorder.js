import { useRef } from 'react';

// Tap to start, tap to stop. Returns the recording as a Blob.
export function useRecorder() {
  const rec = useRef(null); const chunks = useRef([]);
  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks.current = []; rec.current = new MediaRecorder(stream);
    rec.current.ondataavailable = (e) => chunks.current.push(e.data);
    rec.current.start();
  };
  const stop = () => new Promise((resolve) => {
    const r = rec.current; if (!r) return resolve(null);
    r.onstop = () => { r.stream.getTracks().forEach((t) => t.stop()); resolve(new Blob(chunks.current, { type: r.mimeType || 'audio/webm' })); };
    r.stop();
  });
  return { start, stop };
}
