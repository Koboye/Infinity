// Remembers small choices on this device so the app gets quieter the more it is used.
// Every read/write is guarded: private mode or a full disk must never break the screen.
export const getPref = (key, fallback) => {
  try { const v = window.localStorage.getItem(`dimts_${key}`); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
};
export const setPref = (key, value) => {
  try { window.localStorage.setItem(`dimts_${key}`, JSON.stringify(value)); } catch { /* ignore */ }
};
