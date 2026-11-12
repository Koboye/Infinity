import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const priv = read('src/app/privacy/page.tsx'), terms = read('src/app/terms/page.tsx');
// the privacy policy must cover what the app really stores and does
for (const k of ['email', 'voice notes', 'documents', 'Ads', 'Deleting your account', 'Children', 'Google Firebase', 'Contact', 'unguessable']) assert.ok(priv.includes(k), `privacy mentions ${k}`);
// it must not still say deletion needs the owner (the app deletes accounts itself)
assert.ok(!/contact the app owner/.test(priv), 'old deletion text removed');
for (const k of ['at least 13', 'Coins', 'Suspending', 'Contact', 'Privacy Policy']) assert.ok(terms.includes(k), `terms mention ${k}`);
// the two pages link to each other and use the shared contact address
assert.ok(priv.includes('/terms') && terms.includes('/privacy'));
assert.ok(priv.includes('CONTACT_EMAIL') && terms.includes('CONTACT_EMAIL'));
// what account deletion removes must match what the policy promises
const del = read('src/lib/online/accountApi.js');
for (const c of ["'chats'", "'friends'", "'wallets'", "'presence'", 'deleteFiles', 'auth.deleteUser']) assert.ok(del.includes(c), `deleteAccount handles ${c}`);
console.log('legal pages ok');
