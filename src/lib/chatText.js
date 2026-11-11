// WhatsApp-style chat text helpers: grouping, emoji-only detection, *bold* _italic_ ~strike~ `mono`, tappable http(s) links.
// Pure functions (no React, no DOM) so they are unit-tested. Output is data; the component renders it as React elements (never innerHTML).

export const GROUP_GAP_MS = 5 * 60 * 1000;

/** For each message: is it the first / last of a run (same sender, same day, within 5 minutes)? Tails and spacing follow this. */
export function groupFlags(msgs) {
  const dk = (at) => new Date(at).toDateString();
  const same = (a, b) => !!a && !!b && a.from === b.from && !a.deleted === !b.deleted && dk(a.at) === dk(b.at) && Math.abs(b.at - a.at) <= GROUP_GAP_MS;
  return msgs.map((m, i) => ({ first: !same(msgs[i - 1], m), last: !same(m, msgs[i + 1]) }));
}

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*\s*){1,3}$/u;
/** 1–3 emoji and nothing else → shown big, without a bubble (like WhatsApp). */
export const isEmojiOnly = (text) => typeof text === 'string' && text.length <= 40 && EMOJI_ONLY.test(text.trim());

const RE = /(https?:\/\/[^\s<>]*[^\s<>.,;:!?)\]'"”’])|(\*[^\s*](?:[^*\n]*[^\s*])?\*)|(_[^\s_](?:[^_\n]*[^\s_])?_)|(~[^\s~](?:[^~\n]*[^\s~])?~)|(`[^`\n]+`)/g;
const KIND = [null, 'link', 'bold', 'italic', 'strike', 'mono'];

/** Split a message into [{ t: 'text'|'link'|'bold'|'italic'|'strike'|'mono', v }]. A marker inside a word (snake_case_name) stays plain. */
export function parseRich(text) {
  const s = String(text ?? ''); const out = []; let last = 0;
  const push = (t, v) => { if (!v) return; const p = out[out.length - 1]; if (t === 'text' && p?.t === 'text') p.v += v; else out.push({ t, v }); };
  for (const m of s.matchAll(RE)) {
    const i = m.index; const k = KIND[m.slice(1).findIndex(Boolean) + 1];
    if (k !== 'link' && i > 0 && /[\p{L}\p{N}]/u.test(s[i - 1])) continue;                 // mid-word marker
    const end = i + m[0].length; if (k !== 'link' && end < s.length && /[\p{L}\p{N}]/u.test(s[end])) continue;
    push('text', s.slice(last, i));
    push(k, k === 'link' ? m[0] : m[0].slice(1, -1)); last = end;
  }
  push('text', s.slice(last));
  return out;
}

/** Only plain web links are ever opened. */
export const safeUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : null; } catch { return null; } };
