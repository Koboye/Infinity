// The pay sheet shows the price; pass-and-play spends a level like games against the computer; an SMS is spent inside a transaction.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
assert.match(read('src/components/GebetaApp.jsx'), /\['ai', 'pass'\]\.includes\(o\.mode\)/, 'pass-and-play is gated');
assert.match(read('src/components/PassSheet.jsx'), /P\.passPrice/, 'the pay sheet shows the price');
assert.match(read('src/lib/pass.js'), /NEXT_PUBLIC_PASS_PRICE/);
const api = read('src/lib/online/passApi.js');
assert.match(api, /async function takeSms[\s\S]*?db\.runTransaction[\s\S]*?tx\.get\(/, 'takeSms reads and spends in one transaction');
console.log('pass gate tests passed');
