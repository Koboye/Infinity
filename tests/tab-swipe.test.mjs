import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/components/useTabSwipe.js', import.meta.url), 'utf8');
const m = src.match(/export const TAB_ORDER = (\[[^\]]*\])/); assert.ok(m, 'tab order exists');
const order = eval(m[1]);
assert.deepEqual(order, ['home', 'progress', 'friends', 'leaders', 'rules', 'profile']);
// tabs the bottom bar shows must all be reachable by swipe, in the same order
const nav = readFileSync(new URL('../src/components/BottomNav.jsx', import.meta.url), 'utf8');
const navTo = [...nav.matchAll(/\{ id: '(\w+)', icon: '[^']*', on: \[[^\]]*\](?:, to: '(\w+)')? \}/g)].map((x) => x[2] || 'home');
assert.deepEqual(navTo, order, 'swipe order matches the bottom bar');
console.log('swipe order ok');
