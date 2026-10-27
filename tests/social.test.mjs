// v73: friends, direct chat, invites and in-match chat — the pure rules, then the whole thing through the real API route.
import assert from 'node:assert/strict';
import { register } from 'node:module';
process.env.GEBETA_RATE_MAX = '1000000';
register('./fakes/loader.mjs', import.meta.url);
const S = await import('../src/lib/social.js');
const { POST } = await import('../src/app/api/gebeta/route.js');
const { __store } = await import('./fakes/firebaseAdmin.mjs');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };

// ── pure rules ──
await t('friend codes are 6 characters without look-alike letters, and are normalised', () => {
  for (let i = 0; i < 50; i++) assert.match(S.makeFriendCode(), /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  assert.equal(S.normalizeFriendCode(' ab-c d23 efg '), 'ABCD23');
});
await t('text is cleaned: control characters and runs of spaces go, length is capped, empty is refused', () => {
  assert.equal(S.cleanText('  hello \n\n  world\u0007 '), 'hello world');
  assert.equal(S.cleanText('x'.repeat(500)).length, S.MAX_TEXT);
  assert.equal(S.cleanText('   \n '), '');
  assert.ok(S.pushChat(null, 'a', 'b', '   ').error);
});
const A = { uid: 'a', name: 'Abel', avatar: 'lion' }, B = { uid: 'b', name: 'Bethel', avatar: 'queen' };
await t('a request arrives as incoming for them and outgoing for me; accepting makes both lists', () => {
  const r = S.requestFriend(null, null, A, B);
  assert.equal(r.result, 'sent'); assert.ok(r.mine.outgoing.b); assert.ok(r.theirs.incoming.a);
  const acc = S.acceptFriend(r.theirs, r.mine, B, A);
  assert.equal(acc.result, 'accepted');
  assert.ok(acc.mine.list.a && acc.theirs.list.b);
  assert.deepEqual(acc.mine.incoming, {}); assert.deepEqual(acc.theirs.outgoing, {});
});
await t('two requests that cross become a friendship at once; repeats and self-requests are harmless', () => {
  const r1 = S.requestFriend(null, null, A, B);
  const r2 = S.requestFriend(r1.theirs, r1.mine, B, A);
  assert.equal(r2.result, 'accepted'); assert.ok(r2.mine.list.a && r2.theirs.list.b);
  assert.equal(S.requestFriend(r2.mine, r2.theirs, B, A).result, 'already');
  assert.equal(S.requestFriend(r1.mine, r1.theirs, A, B).result, 'pending');
  assert.equal(S.requestFriend(null, null, A, A).result, 'self');
});
await t('unfriending, declining and cancelling remove every link on both sides', () => {
  const r = S.requestFriend(null, null, A, B);
  const dec = S.severFriend(r.theirs, r.mine, 'b', 'a');
  assert.deepEqual(dec.mine.incoming, {}); assert.deepEqual(dec.theirs.outgoing, {});
  const fr = S.acceptFriend(r.theirs, r.mine, B, A);
  const un = S.severFriend(fr.mine, fr.theirs, 'b', 'a');
  assert.deepEqual(un.mine.list, {}); assert.deepEqual(un.theirs.list, {});
});
await t('lists and request boxes are capped', () => {
  const full = { list: Object.fromEntries(Array.from({ length: S.MAX_FRIENDS }, (_, i) => [`u${i}`, { name: 'x', avatar: 'lion', at: 1 }])) };
  assert.equal(S.requestFriend(full, null, A, B).result, 'full');
  const flooded = { incoming: Object.fromEntries(Array.from({ length: S.MAX_REQUESTS }, (_, i) => [`u${i}`, { name: 'x', avatar: 'lion', at: 1 }])) };
  assert.equal(S.requestFriend(null, flooded, A, B).result, 'full');
});
await t('chat keeps the newest 50 lines, counts unread for the other person and clears it when read', () => {
  let chat = null;
  for (let i = 0; i < 60; i++) chat = S.pushChat(chat, 'a', 'b', `m${i}`, i).chat;
  assert.equal(chat.msgs.length, S.MAX_MSGS); assert.equal(chat.msgs.at(-1).text, 'm59'); assert.equal(chat.unread.b, 60); assert.equal(chat.unread.a, 0);
  assert.deepEqual(chat.users, ['a', 'b']); assert.equal(S.markRead(chat, 'b').unread.b, 0);
  assert.equal(S.pairId('b', 'a'), S.pairId('a', 'b'));
});
await t('invites: newest first, one per host, expired ones dropped, at most 10', () => {
  let doc = null;
  doc = S.pushInvite(doc, { id: '1', from: 'x' }, 1000); doc = S.pushInvite(doc, { id: '2', from: 'x' }, 2000);
  assert.deepEqual(doc.items.map((i) => i.id), ['2']);
  for (let i = 0; i < 15; i++) doc = S.pushInvite(doc, { id: `h${i}`, from: `h${i}` }, 3000);
  assert.equal(doc.items.length, S.MAX_INVITES);
  assert.equal(S.liveInvites(doc, 3000 + S.INVITE_TTL_MS + 1).length, 0);
  assert.equal(S.dropInvite(doc, 'h14').items.some((i) => i.id === 'h14'), false);
});
await t('room chat keeps the last 30 lines and is limited to 120 characters', () => {
  let chat = [];
  for (let i = 0; i < 40; i++) chat = S.pushRoomChat(chat, i % 2, `line ${i}`, i).chat;
  assert.equal(chat.length, S.MAX_ROOM_MSGS); assert.equal(chat.at(-1).text, 'line 39');
  assert.equal(S.pushRoomChat([], 0, 'y'.repeat(500)).chat[0].text.length, 120);
  assert.ok(S.pushRoomChat([], 0, '  ').error);
});
await t('online = seen in the last 90 seconds; the badge adds requests, unread and live invites', () => {
  assert.equal(S.isOnline(1000, 1000 + 89_000), true); assert.equal(S.isOnline(1000, 1000 + 91_000), false); assert.equal(S.isOnline(undefined), false);
  const b = S.badgeCount({ friends: { incoming: { x: {}, y: {} } }, chats: [{ unread: { me: 3 } }, { unread: { other: 9 } }], invites: { items: [{ at: 5000 }] } }, 'me', 6000);
  assert.equal(b, 2 + 3 + 1);
});

// ── through the API route ──
const call = async (uid, body) => POST({ headers: { get: () => (uid ? `Bearer tok:${uid}` : '') }, json: async () => body });
const ok = async (uid, body) => { const r = await call(uid, body); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
const bad = async (uid, body, status) => { const r = await call(uid, body); assert.equal(r.status, status, JSON.stringify(r.body)); return r.body; };
for (const [id, name, avatar] of [['alice', 'Alice', 'queen'], ['bob', 'Bob', 'lion'], ['carl', 'Carl', 'sun']]) __store.set(`users/${id}`, { displayName: name, avatar, rating: 1000, wins: 0, losses: 0, draws: 0, games: 0 });
__store.set('wallets/alice', { coins: 500 });

await t('API: every player gets a stable friend code', async () => {
  const a = await ok('alice', { action: 'friendCode' }); assert.match(a.code, /^[A-Z2-9]{6}$/);
  assert.equal((await ok('alice', { action: 'friendCode' })).code, a.code);
  assert.notEqual((await ok('bob', { action: 'friendCode' })).code, a.code);
  assert.equal((await call(null, { action: 'friendCode' })).status, 401);
});
let aliceCode;
await t('API: request by code → incoming for alice → accept → both are friends', async () => {
  aliceCode = (await ok('alice', { action: 'friendCode' })).code;
  await bad('bob', { action: 'friendRequest', friendCode: 'ZZZZZZ' }, 404);
  await bad('bob', { action: 'friendRequest', friendCode: 'ab' }, 400);
  await bad('alice', { action: 'friendRequest', friendCode: aliceCode }, 400);
  const r = await ok('bob', { action: 'friendRequest', friendCode: aliceCode.toLowerCase() });
  assert.equal(r.result, 'sent'); assert.equal(r.name, 'Alice');
  assert.ok(__store.get('friends/alice').incoming.bob); assert.ok(__store.get('friends/bob').outgoing.alice);
  assert.equal((await ok('bob', { action: 'friendRequest', friendCode: aliceCode })).result, 'pending');
  await bad('carl', { action: 'friendAccept', to: 'bob' }, 404);   // carl has no request from bob
  await ok('alice', { action: 'friendAccept', to: 'bob' });
  assert.ok(__store.get('friends/alice').list.bob); assert.ok(__store.get('friends/bob').list.alice);
  assert.deepEqual(__store.get('friends/alice').incoming, {});
  assert.equal((await ok('bob', { action: 'friendRequest', friendCode: aliceCode })).result, 'already');
});
await t('API: only friends can chat; messages are stored once, unread counts, read clears it', async () => {
  await bad('carl', { action: 'chatSend', to: 'alice', text: 'hi' }, 403);
  await bad('alice', { action: 'chatSend', to: 'bob', text: '   ' }, 400);
  await ok('alice', { action: 'chatSend', to: 'bob', text: '  hello\nBob ' });
  await ok('alice', { action: 'chatSend', to: 'bob', text: 'ready?' });
  const chat = __store.get('chats/alice_bob');
  assert.deepEqual(chat.users, ['alice', 'bob']); assert.deepEqual(chat.msgs.map((m) => m.text), ['hello Bob', 'ready?']); assert.equal(chat.unread.bob, 2);
  await ok('bob', { action: 'chatRead', to: 'alice' });
  assert.equal(__store.get('chats/alice_bob').unread.bob, 0);
  await ok('bob', { action: 'chatSend', to: 'alice', text: 'yes!' });
  assert.equal(__store.get('chats/alice_bob').msgs.length, 3);
});
await t('API: inviting a friend opens a private room and puts the invite in their inbox; strangers cannot be invited', async () => {
  await bad('alice', { action: 'friendInvite', to: 'carl', game: 'gebeta', ruleset: 'tuz', fee: 0 }, 403);
  const r = await ok('alice', { action: 'friendInvite', to: 'bob', game: 'gebeta', ruleset: 'tuz', fee: 0 });
  assert.match(r.code, /^[A-Z2-9]{5}$/);
  const room = __store.get(`gebetaRooms/${r.code}`);
  assert.equal(room.public, false); assert.equal(room.ruleset, 'tuz'); assert.equal(room.players[0], 'alice'); assert.equal(room.status, 'waiting');
  const inbox = __store.get('invites/bob').items;
  assert.equal(inbox.length, 1); assert.equal(inbox[0].code, r.code); assert.equal(inbox[0].game, 'gebeta'); assert.equal(inbox[0].ruleset, 'tuz'); assert.equal(inbox[0].name, 'Alice');
  // bob answers the invite with the ordinary join action → the match starts
  const j = await ok('bob', { action: 'join', code: r.code }); assert.equal(j.status, 'playing');
  await ok('bob', { action: 'inviteDismiss', id: inbox[0].id });
  assert.equal(__store.get('invites/bob').items.length, 0);
});
await t('API: a waiting room can invite a friend afterwards, but only its owner can, and only while waiting', async () => {
  const w = await ok('alice', { action: 'create', game: 'checkers', ruleset: 'flying', fee: 0 });
  await bad('bob', { action: 'friendInvite', to: 'alice', code: w.code }, 409);       // bob does not own it
  await ok('alice', { action: 'friendInvite', to: 'bob', code: w.code });
  assert.equal(__store.get('invites/bob').items[0].code, w.code); assert.equal(__store.get('invites/bob').items[0].game, 'checkers');
  await ok('bob', { action: 'join', code: w.code });
  await bad('alice', { action: 'friendInvite', to: 'bob', code: w.code }, 409);       // already started
});
await t('API: in-match chat is for the two players only, and the room keeps the last lines', async () => {
  const w = await ok('alice', { action: 'friendInvite', to: 'bob', game: 'gebeta', ruleset: 'gebeta', fee: 0 });
  await ok('bob', { action: 'join', code: w.code });
  await ok('alice', { action: 'roomChat', code: w.code, text: 'good luck' });
  await ok('bob', { action: 'roomChat', code: w.code, text: 'you too' });
  await bad('carl', { action: 'roomChat', code: w.code, text: 'hi' }, 403);
  await bad('bob', { action: 'roomChat', code: w.code, text: '  ' }, 400);
  const chat = __store.get(`gebetaRooms/${w.code}`).chat;
  assert.deepEqual(chat.map((m) => m.text), ['good luck', 'you too']);
  assert.deepEqual(chat.map((m) => m.by).sort(), [0, 1]);
});
await t('API: unfriending removes the link both ways and closes the chat and invites', async () => {
  await ok('bob', { action: 'friendRemove', to: 'alice' });
  assert.equal(__store.get('friends/alice').list.bob, undefined); assert.equal(__store.get('friends/bob').list.alice, undefined);
  await bad('alice', { action: 'chatSend', to: 'bob', text: 'still there?' }, 403);
  await bad('alice', { action: 'friendInvite', to: 'bob', game: 'gebeta', ruleset: 'gebeta', fee: 0 }, 403);
});
await t('API: presence is recorded', async () => { await ok('alice', { action: 'presence' }); assert.ok(__store.get('presence/alice').at > 0); });
await t('Firestore rules: clients can read their own friends/invites/chats and write none of them', async () => {
  const fs = await import('node:fs');
  const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  for (const c of ['friends', 'invites', 'chats', 'presence', 'friendCodes']) assert.match(rules, new RegExp(`match /${c}/`));
  assert.match(rules, /match \/friends\/\{uid\}[^}]*request\.auth\.uid == uid/);
  assert.match(rules, /match \/chats\/\{pair\}[^}]*request\.auth\.uid in resource\.data\.users/);
  assert.match(rules, /match \/friendCodes\/\{code\} \{ allow read, write: if false; \}/);
});
console.log(`social tests passed (${n})`);
