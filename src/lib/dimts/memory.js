import { adminDb } from '@/lib/firebase-admin';

// Port of dubber/memory.py ("My Fixes"). Stored per user in Firestore instead of my_fixes.json,
// so corrections follow the person across devices:  users/{uid}/dimts/fixes  { lines, words }
export const normalize = (t) =>
  String(t || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

const ref = (uid) => adminDb.collection('users').doc(uid).collection('dimts').doc('fixes');

export async function loadFixes(uid) {
  const snap = await ref(uid).get();
  const d = snap.exists ? snap.data() : {};
  return { lines: d.lines || {}, words: d.words || {} };
}

export async function replaceFixes(uid, lineRows, wordRows) {
  const lines = {}; const words = {};
  for (const r of lineRows || []) {
    const src = String(r?.[0] || '').trim(); const am = String(r?.[1] || '').trim();
    if (src && am) lines[normalize(src)] = { src: src.slice(0, 500), am: am.slice(0, 1000) };
  }
  for (const r of wordRows || []) {
    const w = String(r?.[0] || '').trim(); const v = String(r?.[1] || '').trim();
    if (w && v && w !== v) words[w.slice(0, 80)] = v.slice(0, 80);
  }
  await ref(uid).set({ lines, words, updatedAt: Date.now() });
  return { lines, words };
}

export async function teachLines(uid, pairs) {
  if (!pairs.length) return;
  const cur = await loadFixes(uid);
  for (const [src, am] of pairs) {
    const k = normalize(src);
    if (k && am.trim()) cur.lines[k] = { src: src.trim().slice(0, 500), am: am.trim().slice(0, 1000) };
  }
  await ref(uid).set({ ...cur, updatedAt: Date.now() });
}

export const lookup = (fixes, text) => fixes.lines[normalize(text)]?.am ?? null;

export function fixWords(fixes, text) {
  // longest first, so a two-word fix wins over a one-word fix it contains
  let out = text;
  for (const w of Object.keys(fixes.words).sort((a, b) => b.length - a.length)) out = out.split(w).join(fixes.words[w]);
  return out;
}

export const fixesRows = (f) => ({
  lines: Object.values(f.lines).map((v) => [v.src, v.am]),
  words: Object.entries(f.words).map(([k, v]) => [k, v]),
});
