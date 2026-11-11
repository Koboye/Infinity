// RC Phase 3: Friends chat at WhatsApp level (pure helpers + wiring).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { groupFlags, isEmojiOnly, parseRich, safeUrl, GROUP_GAP_MS } from '../src/lib/chatText.js';
import { STRINGS } from '../src/lib/i18n.js';
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const at = new Date(2026, 10, 11, 10, 0).getTime();

t('grouping: same sender within 5 min is one run; sender change, long gap or new day starts a new one', () => {
  const m = [{ from: 'a', at }, { from: 'a', at: at + 60000 }, { from: 'b', at: at + 90000 }, { from: 'b', at: at + 90000 + GROUP_GAP_MS + 1 }, { from: 'b', at: at + 24 * 3600e3 * 2 }];
  assert.deepEqual(groupFlags(m).map((f) => [f.first, f.last]), [[true, false], [false, true], [true, true], [true, true], [true, true]]);
  assert.deepEqual(groupFlags([]), []);
});
t('grouping: a deleted line never merges with a normal one', () => assert.deepEqual(groupFlags([{ from: 'a', at }, { from: 'a', at: at + 1, deleted: true }]).map((f) => f.first), [true, true]));
t('emoji-only: 1–3 emoji are big, text or 4+ emoji are not', () => {
  for (const s of ['😀', '😀😂', '👍🏽', '❤️ 🔥 🎉', '👨‍👩‍👧']) assert.ok(isEmojiOnly(s), s);
  for (const s of ['hi 😀', '😀😂🔥🎉', '', 'abc', null, '1']) assert.ok(!isEmojiOnly(s), String(s));
});
t('formatting: bold, italic, strike, mono', () => {
  assert.deepEqual(parseRich('a *b* _c_ ~d~ `e`').map((p) => p.t), ['text', 'bold', 'text', 'italic', 'text', 'strike', 'text', 'mono']);
  assert.deepEqual(parseRich('*hello*'), [{ t: 'bold', v: 'hello' }]);
});
t('formatting: markers inside words, spaces next to markers, and lone markers stay plain text', () => {
  for (const s of ['snake_case_name', '2*3*4', '* not bold *', 'a * b', '_ x _', '5 * 6 = 30']) assert.deepEqual(parseRich(s), [{ t: 'text', v: s }], s);
});
t('links: http(s) only, trailing punctuation stays outside', () => {
  const p = parseRich('see https://afro.example/a?b=1, ok');
  assert.deepEqual(p.map((x) => x.t), ['text', 'link', 'text']); assert.equal(p[1].v, 'https://afro.example/a?b=1');
  assert.equal(safeUrl('javascript:alert(1)'), null); assert.equal(safeUrl('data:text/html,x'), null); assert.ok(safeUrl('https://x.y/z'));
  assert.ok(!parseRich('javascript:alert(1)').some((x) => x.t === 'link'));
});
t('parseRich never throws on garbage and keeps every character', () => {
  for (const v of [null, undefined, 5, '', '***', '~~', '``', '<b>x</b>']) { const out = parseRich(v); assert.ok(Array.isArray(out)); }
  assert.equal(parseRich('<b>x</b> *y*').map((p) => (p.t === 'text' ? p.v : p.v)).join(''), '<b>x</b> y');
});
t('chat text is in both languages', () => { for (const l of ['en', 'am']) { assert.equal(typeof STRINGS[l].chatNotice, 'function'); assert.ok(STRINGS[l].chatNotice('Sam').includes('Sam')); assert.ok(STRINGS[l].chatSwipeReply); } });
t('chat wiring: rich text, grouping, swipe, notice, default look follows the phone', () => {
  const s = read('src/components/Friends.jsx');
  for (const k of ['RichText', 'groupFlags', 'swStart', 'swMove', 'swEnd', 'tg-note', 'prefers-color-scheme: dark', "'wa-dark' : 'wa-light'", 'noopener,noreferrer']) assert.ok(s.includes(k), k);
  assert.ok(!s.includes('dangerouslySetInnerHTML'), 'no raw HTML');
  const css = read('src/app/wa.css'); for (const k of ['.tg-msg.first', 'clip-path', '.tg-msg.big', 'data-swipe', '.tg-link']) assert.ok(css.includes(k), k);
});
console.log(`rc1 chat tests passed (${n})`);
