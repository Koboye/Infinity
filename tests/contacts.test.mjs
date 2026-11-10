// v98: Telegram-style contacts — @usernames and search, blocking, pin/mute/nickname, request notes, privacy-aware last seen,
// reply / edit / delete / react / read ticks / typing, people you may know. Pure rules first, then the real API route.
import assert from 'node:assert/strict';
import { register } from 'node:module';
process.env.GEBETA_RATE_MAX = '1000000';
register('./fakes/loader.mjs', import.meta.url);
const S = await import('../src/lib/social.js');
const { POST } = await import('../src/app/api/gebeta/route.js');
const { __store } = await import('./fakes/firebaseAdmin.mjs');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };

const A = { uid: 'a', name: 'Abel', avatar: 'lion' }, B = { uid: 'b', name: 'Bethel', avatar: 'queen' }, C = { uid: 'c', name: 'Chala', avatar: 'sun' };
const friends = (x, y) => { const r = S.requestFriend(null, null, x, y); const f = S.acceptFriend(r.theirs, r.mine, y, x); return [f.theirs, f.mine]; };   // [x's doc, y's doc]

// ── usernames ──
await t('usernames are normalised (@, case, symbols) and checked: 5–20 chars, start with a letter, not reserved', () => {
  assert.equal(S.normalizeUsername('  @Abel_K-9! '), 'abel_k9');
  assert.equal(S.checkUsername('abel_k9').ok, true);
  for (const bad of ['abc', '1abcde', '_abcde', 'admin', 'Infinity', '']) assert.equal(S.checkUsername(bad).ok, false, bad);
  assert.equal(S.normalizeUsername('x'.repeat(40)).length, S.USERNAME_MAX);
});

// ── block ──
await t('blocking ends the friendship, drops pin/mute/nick, and stops requests both ways', () => {
  let [a, b] = friends(A, B);
  a = S.setContact(a, 'b', { pin: true, mute: true, nick: 'Beth' }).mine;
  const out = S.blockPlayer(a, b, A, B);
  assert.equal(out.result, 'blocked'); assert.ok(out.mine.blocked.b);
  assert.deepEqual(out.mine.list, {}); assert.deepEqual(out.theirs.list, {});
  assert.deepEqual(out.mine.pinned, {}); assert.deepEqual(out.mine.muted, {}); assert.deepEqual(out.mine.nick, {});
  assert.equal(S.requestFriend(out.theirs, out.mine, B, A).result, 'blocked');          // they cannot ask me
  assert.equal(S.requestFriend(out.mine, out.theirs, A, B).result, 'youBlocked');       // I must unblock first
  const again = S.requestFriend(S.unblockPlayer(out.mine, 'b'), out.theirs, A, B);
  assert.equal(again.result, 'sent');
  assert.equal(S.blockPlayer(null, null, A, A).result, 'self');
});
await t('the block list is capped', () => {
  const full = { blocked: Object.fromEntries(Array.from({ length: S.MAX_BLOCKED }, (_, i) => [`u${i}`, { name: 'x', avatar: 'lion', at: 1 }])) };
  assert.equal(S.blockPlayer(full, null, A, B).result, 'full');
});

// ── contact settings ──
await t('pin, mute and nickname work on friends only; an empty nickname clears it; text is cleaned and capped', () => {
  const [a] = friends(A, B);
  assert.ok(S.setContact(a, 'zzz', { pin: true }).error);
  let m = S.setContact(a, 'b', { pin: true, nick: '  My\n friend  ' }).mine;
  assert.equal(m.pinned.b, true); assert.equal(m.nick.b, 'My friend'); assert.equal(S.displayName(m, 'b', { name: 'Bethel' }), 'My friend');
  m = S.setContact(m, 'b', { pin: false, nick: '' }).mine;
  assert.deepEqual(m.pinned, {}); assert.equal(S.displayName(m, 'b', { name: 'Bethel' }), 'Bethel');
  assert.equal(S.setContact(a, 'b', { nick: 'x'.repeat(99) }).mine.nick.b.length, S.MAX_NICK);
});
await t('unfriending also removes my pin, mute and nickname for that friend', () => {
  let [a, b] = friends(A, B); a = S.setContact(a, 'b', { pin: true, mute: true, nick: 'B' }).mine;
  const out = S.severFriend(a, b, 'a', 'b');
  assert.deepEqual(out.mine.pinned, {}); assert.deepEqual(out.mine.muted, {}); assert.deepEqual(out.mine.nick, {});
});
await t('profile: bio is cleaned and capped, last-seen privacy must be a known choice', () => {
  assert.equal(S.setProfile(null, { bio: ` hi\n${'x'.repeat(200)}` }).mine.bio.length, S.MAX_BIO);
  assert.equal(S.setProfile(null, { lastSeen: 'nobody' }).mine.privacy.lastSeen, 'nobody');
  assert.ok(S.setProfile(null, { lastSeen: 'the-moon' }).error);
});

// ── request notes ──
await t('a request can carry a short note that only the receiver sees', () => {
  const r = S.requestFriend(null, null, A, B, 1000, ' hi,\n it is Abel from school ');
  assert.equal(r.theirs.incoming.a.note, 'hi, it is Abel from school'); assert.equal(r.mine.outgoing.b.note, undefined);
  assert.equal(S.requestFriend(null, null, A, B, 1000, 'x'.repeat(500)).theirs.incoming.a.note.length, S.MAX_NOTE);
  assert.equal(S.requestFriend(null, null, A, B, 1000).theirs.incoming.a.note, undefined);
});

// ── chat ──
await t('messages get ids; a reply keeps a short quote of the original', () => {
  let c = S.pushChat(null, 'a', 'b', 'hello', 1000).chat;
  const id = c.msgs[0].id; assert.ok(id);
  c = S.pushChat(c, 'b', 'a', 'hi back', 2000, id).chat;
  assert.deepEqual(c.msgs[1].re, { id, from: 'a', text: 'hello' });
  assert.equal(new Set(c.msgs.map((m) => m.id)).size, 2);
  assert.equal(S.pushChat(c, 'a', 'b', 'x', 3000, 'nope').chat.msgs[2].re, undefined);   // unknown id: plain message
});
await t('edit: only my own message, only within 48 hours, marked as edited', () => {
  let c = S.pushChat(null, 'a', 'b', 'helo', 1000).chat; const id = c.msgs[0].id;
  assert.ok(S.editMessage(c, 'b', id, 'x', 2000).error);
  assert.ok(S.editMessage(c, 'a', id, '  ', 2000).error);
  assert.ok(S.editMessage(c, 'a', id, 'x', 1000 + S.EDIT_MS + 1).error);
  c = S.editMessage(c, 'a', id, 'hello', 5000).chat;
  assert.equal(c.msgs[0].text, 'hello'); assert.equal(c.msgs[0].ed, 5000);
});
await t('delete: only my own message, and an unread one lowers their unread count', () => {
  let c = S.pushChat(null, 'a', 'b', 'one', 1000).chat; c = S.pushChat(c, 'a', 'b', 'two', 2000).chat;
  assert.equal(c.unread.b, 2); const id = c.msgs[1].id;
  assert.ok(S.deleteMessage(c, 'b', id).error);
  c = S.deleteMessage(c, 'a', id).chat;
  assert.deepEqual(c.msgs.map((m) => m.text), ['one']); assert.equal(c.unread.b, 1);
  c = S.markRead(c, 'b', 3000);                                    // after they read, deleting does not touch the count
  c = S.pushChat(c, 'a', 'b', 'three', 4000).chat; c = S.markRead(c, 'b', 5000);
  c = S.deleteMessage(c, 'a', c.msgs[0].id).chat; assert.equal(c.unread.b, 0);
});
await t('reactions: one per person, tapping it again removes it, unknown emoji refused', () => {
  let c = S.pushChat(null, 'a', 'b', 'hi', 1000).chat; const id = c.msgs[0].id;
  c = S.reactMessage(c, 'b', id, '❤️').chat; assert.deepEqual(c.msgs[0].rx, { b: '❤️' });
  c = S.reactMessage(c, 'b', id, '🔥').chat; assert.deepEqual(c.msgs[0].rx, { b: '🔥' });
  c = S.reactMessage(c, 'a', id, '🔥').chat; assert.equal(Object.keys(c.msgs[0].rx).length, 2);
  c = S.reactMessage(c, 'b', id, '🔥').chat; c = S.reactMessage(c, 'a', id, '🔥').chat; assert.equal(c.msgs[0].rx, undefined);
  assert.ok(S.reactMessage(c, 'a', id, '💩').error);
});
await t('read ticks: a message is seen once the other person opened the chat after it; typing fades after 6 s', () => {
  let c = S.pushChat(null, 'a', 'b', 'hi', 1000).chat; const m = c.msgs[0];
  assert.equal(S.isSeen(c, m, 'b'), false);
  c = S.markRead(c, 'b', 1500); assert.equal(S.isSeen(c, m, 'b'), true);
  c = S.setTyping(c, 'b', 10000);
  assert.equal(S.isTyping(c, 'b', 12000), true); assert.equal(S.isTyping(c, 'b', 10000 + S.TYPING_MS + 1), false);
  assert.equal(S.isTyping(S.pushChat(c, 'b', 'a', 'x', 11000).chat, 'b', 11001), false);     // sending ends typing
});

// ── last seen ──
await t('last-seen buckets read like Telegram, and a hidden time only ever shows a rough bucket', () => {
  const now = new Date(2026, 5, 15, 14, 0, 0).getTime();
  assert.equal(S.seenBucket(now - 30e3, now).kind, 'online');
  assert.equal(S.seenBucket(now - 100e3, now).kind, 'just');
  assert.deepEqual(S.seenBucket(now - 25 * 60e3, now), { kind: 'min', n: 25 });
  assert.equal(S.seenBucket(new Date(2026, 5, 15, 9, 0).getTime(), now).kind, 'today');
  assert.equal(S.seenBucket(new Date(2026, 5, 14, 23, 0).getTime(), now).kind, 'yesterday');
  assert.deepEqual(S.seenBucket(new Date(2026, 5, 12, 9, 0).getTime(), now), { kind: 'days', n: 3 });
  assert.equal(S.seenBucket(now - 40 * 864e5, now).kind, 'long');
  assert.equal(S.seenBucket(undefined, now).kind, 'long');
  const hid = (age) => S.presenceView({ lastSeen: 'nobody' }, now - age, now);
  assert.deepEqual(hid(10e3), { kind: 'recent' }); assert.deepEqual(hid(5 * 864e5), { kind: 'week' }); assert.deepEqual(hid(20 * 864e5), { kind: 'month' }); assert.deepEqual(hid(90 * 864e5), { kind: 'long' });
  assert.equal(S.presenceView({ lastSeen: 'friends' }, now - 10e3, now).kind, 'online');
});

// ── suggestions and badge ──
await t('people you may know: friends of my friends, most shared first, never me, friends, pending or blocked', () => {
  const mine = { list: { b: { name: 'B' }, c: { name: 'C' } }, blocked: { x: { name: 'X' } }, outgoing: { p: { name: 'P' } } };
  const bDoc = { list: { a: { name: 'Abel' }, d: { name: 'Dawit', avatar: 'lion' }, e: { name: 'Eden' }, x: { name: 'X' }, p: { name: 'P' }, c: { name: 'C' } } };
  const cDoc = { list: { d: { name: 'Dawit', avatar: 'lion' }, a: { name: 'Abel' } } };
  const out = S.suggestFriends(mine, [bDoc, cDoc], 'a');
  assert.deepEqual(out.map((p) => [p.id, p.mutual]), [['d', 2], ['e', 1]]);
});
await t('muted chats do not add to the badge', () => {
  const chats = [{ users: ['b', 'me'], unread: { me: 4 } }, { users: ['c', 'me'], unread: { me: 2 } }];
  assert.equal(S.badgeCount({ friends: { muted: { b: true } }, chats, invites: null }, 'me', 1), 2);
});

// ── through the API ──
const call = async (uid, body) => POST({ headers: { get: () => (uid ? `Bearer tok:${uid}` : '') }, json: async () => body });
const ok = async (uid, body) => { const r = await call(uid, body); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
const bad = async (uid, body, status) => { const r = await call(uid, body); assert.equal(r.status, status, JSON.stringify(r.body)); return r.body; };
for (const [id, name, avatar] of [['alice', 'Alice', 'queen'], ['bob', 'Bob', 'lion'], ['carl', 'Carl', 'sun'], ['dina', 'Dina', 'lion']]) __store.set(`users/${id}`, { displayName: name, avatar, rating: 1000, wins: 0, losses: 0, draws: 0, games: 0 });

await t('API: usernames are unique, validated, changeable; the old one is freed', async () => {
  await bad('alice', { action: 'friendUsername', username: 'abc' }, 400);
  await bad('alice', { action: 'friendUsername', username: 'admin' }, 400);
  assert.equal((await ok('alice', { action: 'friendUsername', username: '@Alice_Star' })).username, 'alice_star');
  await bad('bob', { action: 'friendUsername', username: 'alice_star' }, 409);
  assert.equal((await ok('alice', { action: 'friendUsername', username: 'alice_star' })).username, 'alice_star');   // same one again is fine
  await ok('alice', { action: 'friendUsername', username: 'alice_gold' });
  assert.equal(__store.get('usernames/alice_star'), undefined); assert.equal(__store.get('usernames/alice_gold').uid, 'alice');
  assert.equal(__store.get('friends/alice').username, 'alice_gold');
  await ok('bob', { action: 'friendUsername', username: 'alice_star' });                                            // freed → bob may take it
  await ok('bob', { action: 'friendUsername', username: 'bobby_b' });
  await ok('carl', { action: 'friendUsername', username: 'carl_the_great' });
  await ok('dina', { action: 'friendUsername', username: 'dina_dev' });
});
await t('API: search by @username prefix finds players, never me, and shows each player’s relation to me', async () => {
  await bad('bob', { action: 'friendFind', q: 'al' }, 400);
  let r = await ok('bob', { action: 'friendFind', q: '@ALICE' });
  assert.deepEqual(r.results.map((p) => [p.id, p.username, p.status, p.name]), [['alice', 'alice_gold', 'none', 'Alice']]);
  assert.equal((await ok('alice', { action: 'friendFind', q: 'alice' })).results.length, 0);          // not myself
  assert.equal((await ok('bob', { action: 'friendFind', q: 'zzzzz' })).results.length, 0);
});
await t('API: request by @username with a note; the note shows in the receiver’s incoming card; accept makes friends', async () => {
  await bad('bob', { action: 'friendRequest', username: 'nobody_here' }, 404);
  await bad('bob', { action: 'friendRequest', username: 'bad' }, 400);
  await bad('bob', { action: 'friendRequest', username: 'bobby_b' }, 400);                           // myself
  const r = await ok('bob', { action: 'friendRequest', username: 'alice_gold', note: ' it is Bob\nfrom the club ' });
  assert.equal(r.result, 'sent');
  assert.equal(__store.get('friends/alice').incoming.bob.note, 'it is Bob from the club'); assert.equal(__store.get('friends/alice').incoming.bob.username, 'bobby_b');
  assert.equal((await ok('bob', { action: 'friendFind', q: 'alice' })).results[0].status, 'outgoing');
  assert.equal((await ok('alice', { action: 'friendFind', q: 'bobby' })).results[0].status, 'incoming');
  await ok('alice', { action: 'friendAccept', to: 'bob' });
  assert.equal((await ok('bob', { action: 'friendFind', q: 'alice' })).results[0].status, 'friend');
});
await t('API: mutual friends are counted in search, and friends of friends are suggested', async () => {
  await ok('carl', { action: 'friendRequest', username: 'alice_gold' }); await ok('alice', { action: 'friendAccept', to: 'carl' });
  await ok('dina', { action: 'friendRequest', username: 'alice_gold' }); await ok('alice', { action: 'friendAccept', to: 'dina' });
  const sug = await ok('bob', { action: 'friendSuggest' });
  assert.deepEqual(sug.people.map((p) => [p.id, p.mutual]).sort(), [['carl', 1], ['dina', 1]]);
  const f = await ok('bob', { action: 'friendFind', q: 'carl' });
  assert.equal(f.results[0].mutual, 1); assert.equal(f.results[0].status, 'none');
});
await t('API: pin / mute / nickname are stored on my side only, friends only', async () => {
  await bad('bob', { action: 'friendSet', to: 'zed', pin: true }, 403);
  await ok('bob', { action: 'friendSet', to: 'alice', pin: true, mute: true, nick: 'Boss' });
  assert.deepEqual([__store.get('friends/bob').pinned.alice, __store.get('friends/bob').muted.alice, __store.get('friends/bob').nick.alice], [true, true, 'Boss']);
  assert.equal(__store.get('friends/alice').nick.bob, undefined);
  await ok('bob', { action: 'friendSet', to: 'alice', pin: false, mute: false, nick: '' });
  assert.deepEqual(__store.get('friends/bob').nick, {});
});
await t('API: reply, edit, delete, react, read ticks and typing', async () => {
  const sent = await ok('alice', { action: 'chatSend', to: 'bob', text: 'hello Bob' }); assert.ok(sent.id);
  const r2 = await ok('bob', { action: 'chatSend', to: 'alice', text: 'hi!', replyTo: sent.id });
  const chat = () => __store.get('chats/alice_bob');
  assert.equal(chat().msgs[1].re.text, 'hello Bob');
  await bad('bob', { action: 'chatEdit', to: 'alice', id: sent.id, text: 'hacked' }, 400);          // not his message
  await ok('alice', { action: 'chatEdit', to: 'bob', id: sent.id, text: 'hello Bobby' });
  assert.equal(chat().msgs[0].text, 'hello Bobby'); assert.ok(chat().msgs[0].ed);
  await ok('bob', { action: 'chatReact', to: 'alice', id: sent.id, emoji: '❤️' }); assert.equal(chat().msgs[0].rx.bob, '❤️');
  await bad('bob', { action: 'chatReact', to: 'alice', id: sent.id, emoji: 'x' }, 400);
  await ok('bob', { action: 'chatTyping', to: 'alice' }); assert.ok(chat().typing.bob > 0);
  await ok('bob', { action: 'chatRead', to: 'alice' }); assert.ok(chat().read.bob > 0); assert.equal(S.isSeen(chat(), chat().msgs[0], 'bob'), true);
  await ok('bob', { action: 'chatDelete', to: 'alice', id: r2.id }); assert.equal(chat().msgs.length, 1);
  await bad('carl', { action: 'chatEdit', to: 'alice', id: sent.id, text: 'x' }, 404);                // no such chat for carl
});
await t('API: last seen is worded by each friend’s privacy choice; hidden friends never leak the exact time', async () => {
  await ok('alice', { action: 'presence' });
  let p = await ok('bob', { action: 'friendPresence' });
  assert.equal(p.seen.alice.kind, 'online'); assert.ok(p.seen.alice.at > 0);
  await bad('alice', { action: 'profileSet', lastSeen: 'moon' }, 400);
  const pr = await ok('alice', { action: 'profileSet', lastSeen: 'nobody', bio: ' Gebeta lover ' });
  assert.deepEqual([pr.lastSeen, pr.bio], ['nobody', 'Gebeta lover']);
  p = await ok('bob', { action: 'friendPresence' });
  assert.equal(p.seen.alice.kind, 'recent'); assert.equal(p.seen.alice.at, undefined);
  assert.equal(__store.get('friends/alice').privacy.lastSeen, 'nobody');
  await ok('alice', { action: 'profileSet', lastSeen: 'everyone' });
});
await t('API: blocking removes the friendship, hides me from their search, and stops their requests', async () => {
  await ok('alice', { action: 'friendBlock', to: 'carl' });
  assert.ok(__store.get('friends/alice').blocked.carl); assert.equal(__store.get('friends/alice').list.carl, undefined); assert.equal(__store.get('friends/carl').list.alice, undefined);
  await bad('alice', { action: 'chatSend', to: 'carl', text: 'x' }, 403); await bad('carl', { action: 'chatSend', to: 'alice', text: 'x' }, 403);
  assert.equal((await ok('carl', { action: 'friendFind', q: 'alice_' })).results.length, 0);             // alice is invisible to carl
  assert.equal((await ok('alice', { action: 'friendFind', q: 'carl_' })).results.length, 0);             // and carl to alice
  await bad('carl', { action: 'friendRequest', username: 'alice_gold' }, 403);
  await bad('alice', { action: 'friendRequest', to: 'carl' }, 409);
  await bad('carl', { action: 'friendInvite', to: 'alice', game: 'gebeta', ruleset: 'gebeta', fee: 0 }, 403);
  await bad('alice', { action: 'friendBlock', to: 'alice' }, 400);
  await ok('alice', { action: 'friendUnblock', to: 'carl' });
  assert.deepEqual(__store.get('friends/alice').blocked, {});
  assert.equal((await ok('carl', { action: 'friendRequest', username: 'alice_gold' })).result, 'sent');
});
await t('Firestore rules: presence is readable only by its owner; usernames are server-only', async () => {
  const fs = await import('node:fs');
  const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /match \/presence\/\{uid\}[^}]*request\.auth\.uid == uid/);
  assert.match(rules, /match \/usernames\/\{name\} \{ allow read, write: if false; \}/);
});
console.log(`contacts tests passed (${n})`);
