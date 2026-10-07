
// Port of dubber/memory.py ("My Fixes"). Stored per user in Firestore instead of my_fixes.json,
// so corrections follow the person across devices:  users/{uid}/dimts/fixes  { lines, words }
export const normalize = (t) =>
  String(t || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();


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
