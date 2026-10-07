// Port of dubber/quality.py — finds the lines most likely to be wrong so people check those first.
const ETHIOPIC = /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF\uAB00-\uAB2F]/;

export const hasEthiopic = (t) => ETHIOPIC.test(t || '');

function loops(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 5) {
    const counts = {};
    for (const w of words) counts[w] = (counts[w] || 0) + 1;
    if (Math.max(...Object.values(counts)) >= Math.max(4, words.length * 0.6)) return true;
  }
  return /(.{3,}?)\1{3,}/.test(text);
}

export function checkTranslation(source, amharic, { script = true } = {}) {
  const problems = [];
  const src = (source || '').trim();
  const am = (amharic || '').trim();
  if (!am) return ['no translation'];
  if (script && !hasEthiopic(am)) problems.push('not Amharic script');
  if (loops(am)) problems.push('repeating words');
  if (src.length > 12) {
    const ratio = am.length / Math.max(src.length, 1);
    if (ratio < 0.2) problems.push('translation too short');
    else if (ratio > 3) problems.push('translation too long');
  }
  const digits = src.match(/\d+/g) || [];
  if (digits.length && hasEthiopic(am) && digits.every((d) => !am.includes(d))) problems.push('numbers missing');
  return problems;
}

export const checkLabel = (problems) => (problems.length ? `⚠ ${problems.join(', ')}` : '✓');
