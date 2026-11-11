import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EMOJI_TABS, splitEmoji, pushRecent } from '../src/lib/emoji.js';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const jsx = readFileSync('src/components/Friends.jsx', 'utf8'), css = readFileSync('src/app/wa.css', 'utf8'), soc = readFileSync('src/lib/i18nSocial.js', 'utf8');
t('emoji picker: every tab has whole emoji, flags stay in one piece, recents are newest-first without repeats', () => {
  for (const c of EMOJI_TABS.filter((c) => c.list)) assert.ok(splitEmoji(c.list).length >= 20, c.id);
  assert.ok(splitEmoji('🇪🇹🇺🇸').length === 2 && splitEmoji('👨‍👩‍👧').length === 1);
  assert.deepEqual(pushRecent(['a', 'b', 'c'], 'b'), ['b', 'a', 'c']); assert.equal(pushRecent(Array.from({ length: 30 }, (_, i) => String(i)), 'x').length, 24);
});
t('chat: three looks, saved choice, emoji button, jump-to-latest and WhatsApp day labels are wired', () => {
  assert.match(jsx, /THEMES = \['classic', 'wa-light', 'wa-dark'\]/); assert.match(jsx, /th-\$\{theme\}/); assert.match(jsx, /tg-emoji-btn/); assert.match(jsx, /tg-down/); assert.match(jsx, /function dayLabel/);
});
t('looks are scoped to the chat only and define light and dark WhatsApp colours', () => {
  assert.match(css, /\.th-wa-light \{/); assert.match(css, /\.th-wa-dark \{/); assert.match(css, /#d9fdd3/); assert.match(css, /#005c4b/); assert.match(css, /#53bdeb/);
  assert.equal(/^body|^html|^\.app\b/m.test(css), false);
});
t('texts exist in English and Amharic', () => { assert.equal((soc.match(/chatTheme_classic/g) || []).length, 2); assert.equal((soc.match(/chatEmoji/g) || []).length, 2); assert.equal((soc.match(/yesterday/g) || []).length, 2); });
console.log(n, 'chat-ui tests passed');
