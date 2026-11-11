// v3.15: WhatsApp-level friends chat -- delivered ticks, block, mute, delete for me, clear chat, star, forward, search, unread divider.
// Pure rules first, then the whole thing through the real API route (fake Firestore), then wiring and texts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
process.env.GEBETA_RATE_MAX = '1000000';
register('./fakes/loader.mjs', import.meta.url);
const S = await import('../src/lib/social.js');
const { POST } = await import('../src/app/api/gebeta/route.js');
const { __store } = await import('./fakes/firebaseAdmin.mjs');
const { SOCIAL_EN, SOCIAL_AM } = await import('../src/lib/i18nSocial.js');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };

// -- pure rules --
await t('ticks: sent -> delivered (their app has it) -> read (they opened the chat)', () => {
  let chat = S.pushChat(null, 'a', 'b', 'hi', 1000).chat; const m = chat.msgs[0];
  assert.equal(S.tickState(chat, 'b', m), 'sent');
  chat = S.markDelivered(chat, 'b', 2000);
  assert.equal(S.tickState(chat, 'b', m), 'delivered');
  chat = S.markRead(chat, 'b', 3000);
  assert.equal(S.tickState(chat, 'b', m), 'read');
  const later = S.pushChat(chat, 'a', 'b', 'again', 4000).chat.msgs[1];
  assert.equal(S.tickState(chat, 'b', later), 'sent');   // a newer line starts at one tick again
});
await t('markDelivered returns the same object when nothing is new, so the server can skip the write', () => {
  const chat = S.pushChat(null, 'a', 'b', 'hi', 1000).chat;
  assert.equal(S.markDelivered(chat, 'a', 2000), chat);                       // my own lines never count as delivered to me
  const d = S.markDelivered(chat, 'b', 2000);
  assert.notEqual(d, chat); assert.equal(S.markDelivered(d, 'b', 3000), d);   // already delivered
  assert.equal(S.markDelivered(null, 'b'), null);
});
await t('a line held back by a block stays at one tick and never counts as unread or delivered', () => {
  let chat = S.pushChat(null, 'a', 'b', 'hello?', 1000, null, { held: true }).chat;
  assert.equal(chat.unread.b || 0, 0); assert.equal(chat.msgs[0].held, true);
  assert.equal(S.markDelivered(chat, 'b', 2000), chat);
  chat = S.markRead(chat, 'b', 3000);
  assert.equal(S.tickState(chat, 'b', chat.msgs[0]), 'sent');
  assert.equal(S.visibleMsgs(chat, 'b').length, 0); assert.equal(S.visibleMsgs(chat, 'a').length, 1);
});
await t('delete for me hides one line from me only; clear chat hides everything so far from me only', () => {
  let chat = null; for (let i = 0; i < 4; i++) chat = S.pushChat(chat, i % 2 ? 'b' : 'a', i % 2 ? 'a' : 'b', `m${i}`, 1000 + i * 10).chat;
  const id = chat.msgs[1].id;
  chat = S.hideMsg(chat, 'a', id).chat;
  assert.deepEqual(S.visibleMsgs(chat, 'a').map((m) => m.text), ['m0', 'm2', 'm3']);
  assert.equal(S.visibleMsgs(chat, 'b').length, 4);
  assert.ok(S.hideMsg(chat, 'a', 'nope').error);
  chat = S.clearChat(chat, 'a');   // anchored to the newest line, not to a clock
  assert.deepEqual(S.visibleMsgs(chat, 'a').map((m) => m.text), []); assert.equal(chat.unread.a, 0);
  assert.equal(S.visibleMsgs(chat, 'b').length, 4);
  chat = S.pushChat(chat, 'b', 'a', 'new', 2000).chat;
  assert.equal(S.visibleMsgs(chat, 'a').at(-1).text, 'new');   // lines after the clear come back as normal
});
await t('stars are private to each person and toggle; a deleted line cannot be starred', () => {
  let chat = S.pushChat(null, 'a', 'b', 'keep this', 1000).chat; const id = chat.msgs[0].id;
  chat = S.starMsg(chat, 'a', id).chat; assert.deepEqual(chat.msgs[0].starred, ['a']);
  chat = S.starMsg(chat, 'b', id).chat; assert.deepEqual(chat.msgs[0].starred.sort(), ['a', 'b']);
  chat = S.starMsg(chat, 'a', id).chat; assert.deepEqual(chat.msgs[0].starred, ['b']);
  const gone = S.deleteMsg(chat, 'a', id).chat;
  assert.ok(S.starMsg(gone, 'a', id).error);
});
await t('forwarded lines carry a mark; replies, search and the unread divider find the right lines', () => {
  let chat = S.pushChat(null, 'a', 'b', 'see this', 1000, null, { fwd: true }).chat;
  assert.equal(chat.msgs[0].fwd, true);
  chat = S.pushChat(chat, 'a', 'b', 'Match at SIX pm', 1100).chat; chat = S.pushChat(chat, 'a', 'b', 'ok?', 1200).chat;
  assert.deepEqual(S.searchMsgs(chat.msgs, ' six ').map((m) => m.text), ['Match at SIX pm']);
  assert.deepEqual(S.searchMsgs(chat.msgs, '   '), []);
  assert.equal(S.firstUnreadId(chat.msgs, 'a', 2), chat.msgs[1].id);
  assert.equal(S.firstUnreadId(chat.msgs, 'a', 0), null); assert.equal(S.firstUnreadId(chat.msgs, 'zz', 3), null);
  const gone = S.deleteMsg(chat, 'a', chat.msgs[1].id).chat;
  assert.deepEqual(S.searchMsgs(gone.msgs, 'six'), []);   // a deleted line never matches
});
await t('block and mute are per-person lists, toggled on my friends document and capped', () => {
  let f = { list: { x: {} } };
  f = S.toggleFlag(f, 'blocked', 'x'); assert.equal(S.isBlocked(f, 'x'), true); assert.ok(f.list.x);
  f = S.toggleFlag(f, 'blocked', 'x'); assert.equal(S.isBlocked(f, 'x'), false);
  f = S.toggleFlag(f, 'muted', 'x'); assert.equal(S.isMuted(f, 'x'), true); assert.equal(S.isBlocked(f, 'x'), false);
  let many = {}; for (let i = 0; i < S.MAX_FLAGS + 20; i++) many = S.toggleFlag(many, 'muted', `u${i}`);
  assert.equal(many.muted.length, S.MAX_FLAGS);
});
await t('the Friends badge ignores unread lines from muted chats but still counts requests and invites', () => {
  const chats = [{ users: ['me', 'x'], unread: { me: 4 } }, { users: ['me', 'y'], unread: { me: 2 } }];
  assert.equal(S.badgeCount({ friends: { muted: ['x'] }, chats }, 'me'), 2);
  assert.equal(S.badgeCount({ friends: { muted: ['x'], incoming: { z: {} } }, chats }, 'me'), 3);
  assert.equal(S.badgeCount({ friends: {}, chats }, 'me'), 6);
});

// -- through the API route --
const call = async (uid, body) => POST({ headers: { get: () => (uid ? `Bearer tok:${uid}` : '') }, json: async () => body });
const ok = async (uid, body) => { const r = await call(uid, body); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
const bad = async (uid, body, status) => { const r = await call(uid, body); assert.equal(r.status, status, JSON.stringify(r.body)); return r.body; };
for (const [id, name, avatar] of [['alice', 'Alice', 'queen'], ['bob', 'Bob', 'lion'], ['carl', 'Carl', 'sun']]) __store.set(`users/${id}`, { displayName: name, avatar, rating: 1000, wins: 0, losses: 0, draws: 0, games: 0 });
const code = (await ok('alice', { action: 'friendCode' })).code;
await ok('bob', { action: 'friendRequest', friendCode: code }); await ok('alice', { action: 'friendAccept', to: 'bob' });
const codeC = (await ok('carl', { action: 'friendCode' })).code;
await ok('alice', { action: 'friendRequest', friendCode: codeC }); await ok('carl', { action: 'friendAccept', to: 'alice' });

await t('API: socialSync marks lines delivered once, and the sender then sees a grey double tick', async () => {
  const sent = await ok('alice', { action: 'chatSend', to: 'bob', text: 'are you there?' });
  let chat = __store.get('chats/alice_bob');
  assert.equal(S.tickState(chat, 'bob', chat.msgs.find((m) => m.id === sent.id)), 'sent');
  const sync = await ok('bob', { action: 'socialSync' });
  chat = __store.get('chats/alice_bob');
  assert.equal(S.tickState(chat, 'bob', chat.msgs.find((m) => m.id === sent.id)), 'delivered');
  assert.equal(S.tickState(sync.chats.find((c) => c.id === 'alice_bob'), 'bob', chat.msgs[0]), 'delivered');
  const stamp = chat.deliveredAt.bob;
  await ok('bob', { action: 'socialSync' });
  assert.equal(__store.get('chats/alice_bob').deliveredAt.bob, stamp);   // nothing new: no rewrite
  await ok('bob', { action: 'chatRead', to: 'alice' });
  chat = __store.get('chats/alice_bob');
  assert.equal(S.tickState(chat, 'bob', chat.msgs[0]), 'read');
});
await t('API: forwarding sends the text as a new line marked forwarded; only friends can receive it', async () => {
  const r = await ok('alice', { action: 'chatSend', to: 'carl', text: 'are you there?', fwd: true });
  assert.equal(__store.get('chats/alice_carl').msgs.find((m) => m.id === r.id).fwd, true);
  const plain = await ok('alice', { action: 'chatSend', to: 'carl', text: 'plain', fwd: 'yes' });   // only a real `true` counts
  assert.equal(__store.get('chats/alice_carl').msgs.find((m) => m.id === plain.id).fwd, undefined);
  await bad('alice', { action: 'chatSend', to: 'nobody', text: 'x', fwd: true }, 403);
});
await t('API: star and delete-for-me touch only my view; a stranger cannot star or hide', async () => {
  const id = __store.get('chats/alice_bob').msgs[0].id;
  await ok('bob', { action: 'chatStar', to: 'alice', id });
  assert.deepEqual(__store.get('chats/alice_bob').msgs[0].starred, ['bob']);
  await ok('bob', { action: 'chatHide', to: 'alice', id });
  const chat = __store.get('chats/alice_bob');
  assert.equal(S.visibleMsgs(chat, 'bob').some((m) => m.id === id), false); assert.equal(S.visibleMsgs(chat, 'alice').some((m) => m.id === id), true);
  const snapshot = JSON.stringify(__store.get('chats/alice_bob'));
  await bad('carl', { action: 'chatStar', to: 'alice', id }, 400);   // carl only reaches alice_carl, where this id does not exist
  assert.equal(JSON.stringify(__store.get('chats/alice_bob')), snapshot);   // and alice_bob is untouched
  await bad('bob', { action: 'chatHide', to: 'alice', id: 'nope' }, 400);
  await bad('bob', { action: 'chatStar', to: 'nobody', id }, 403);
});
await t('API: clear chat empties only my view', async () => {
  await ok('bob', { action: 'chatSend', to: 'alice', text: 'before clear' });
  await ok('bob', { action: 'chatClear', to: 'alice' });
  let chat = __store.get('chats/alice_bob');
  assert.equal(S.visibleMsgs(chat, 'bob').length, 0); assert.ok(S.visibleMsgs(chat, 'alice').length >= 2);
  assert.equal(chat.unread.bob, 0);
  await ok('alice', { action: 'chatSend', to: 'bob', text: 'after clear' });
  chat = __store.get('chats/alice_bob');
  assert.deepEqual(S.visibleMsgs(chat, 'bob').map((m) => m.text), ['after clear']);
});
await t('API: mute keeps unread out of the badge; blocking stops sending, holds the other side\'s lines and silences game invites', async () => {
  const muted = await ok('bob', { action: 'friendMute', to: 'alice' }); assert.deepEqual(muted.muted, ['alice']);
  await bad('bob', { action: 'friendMute', to: 'carl' }, 404);   // not bob's friend
  await bad('bob', { action: 'friendBlock', to: 'carl' }, 404);
  assert.deepEqual((await ok('bob', { action: 'friendMute', to: 'alice' })).muted, []);   // toggles back

  const blocked = await ok('bob', { action: 'friendBlock', to: 'alice' }); assert.deepEqual(blocked.blocked, ['alice']);
  await bad('bob', { action: 'chatSend', to: 'alice', text: 'I blocked you' }, 403);   // must unblock first
  const sent = await ok('alice', { action: 'chatSend', to: 'bob', text: 'why no reply?' });   // alice is not told
  let chat = __store.get('chats/alice_bob');
  const line = chat.msgs.find((m) => m.id === sent.id);
  assert.equal(line.held, true); assert.equal(S.visibleMsgs(chat, 'bob').some((m) => m.id === sent.id), false);
  assert.equal(S.tickState(chat, 'bob', line), 'sent');
  await ok('bob', { action: 'socialSync' }); await ok('bob', { action: 'chatRead', to: 'alice' });
  chat = __store.get('chats/alice_bob'); assert.equal(S.tickState(chat, 'bob', chat.msgs.find((m) => m.id === sent.id)), 'sent');

  const before = (__store.get('invites/bob')?.items || []).length;
  const inv = await ok('alice', { action: 'friendInvite', to: 'bob', game: 'gebeta', ruleset: 'tuz', fee: 0 });
  assert.match(inv.code, /^[A-Z2-9]{5}$/);   // alice still gets her room ...
  assert.equal((__store.get('invites/bob')?.items || []).length, before);   // ... but bob's inbox stays quiet

  assert.deepEqual((await ok('bob', { action: 'friendBlock', to: 'alice' })).blocked, []);   // unblock
  await ok('bob', { action: 'chatSend', to: 'alice', text: 'ok we are good' });
});
await t('API: a blocked line never reaches the blocker even after they unblock (held stays held)', async () => {
  const chat = __store.get('chats/alice_bob');
  assert.equal(S.visibleMsgs(chat, 'bob').some((m) => m.text === 'why no reply?'), false);
});

// -- wiring and texts --
const jsx = readFileSync('src/components/Friends.jsx', 'utf8'), css = readFileSync('src/app/wa.css', 'utf8'), route = readFileSync('src/app/api/gebeta/route.js', 'utf8');
await t('UI: ticks have three states, and every new action is wired to the server', () => {
  assert.match(jsx, /tickState\(chat, friend\.id, m\)/); assert.match(jsx, /state === 'delivered'/);
  for (const a of ['chatStar', 'chatHide', 'chatClear', 'friendBlock', 'friendMute']) { assert.match(jsx, new RegExp(`action: '${a}'`)); assert.match(route, new RegExp(`case '${a}'`)); }
  assert.match(jsx, /fwd: true/); assert.match(jsx, /firstUnreadId/); assert.match(jsx, /searchMsgs/); assert.match(jsx, /visibleMsgs/);
  assert.match(jsx, /blocked && <p className="tg-blocked"/);
});
await t('CSS: the new pieces are styled and stay scoped (no global selectors added)', () => {
  const added = css.slice(css.indexOf('WhatsApp-level chat (v3.15)'));
  for (const c of ['.tg-ticks.delivered', '.tg-find', '.tg-unread', '.tg-fwd', '.tg-star', '.tg-blocked']) assert.ok(added.includes(c), c);
  assert.equal(/^body|^html|^\.app\b/m.test(added), false);
});
await t('texts: every new line exists in English and Amharic with the same keys', () => {
  const en = Object.keys(SOCIAL_EN), am = Object.keys(SOCIAL_AM);
  assert.deepEqual(en.filter((k) => !am.includes(k)), []); assert.deepEqual(am.filter((k) => !en.includes(k)), []);
  for (const k of ['forwardMsg', 'forwarded', 'deleteForMe', 'starMsg', 'starredMsgs', 'searchInChat', 'clearChat', 'blockFriend', 'unblockFriend', 'muteChat', 'unreadDivider', 'blockedNote']) { assert.ok(SOCIAL_EN[k], k); assert.ok(SOCIAL_AM[k], k); }
  assert.equal(SOCIAL_EN.unreadDivider(1), '1 unread message'); assert.equal(SOCIAL_EN.unreadDivider(3), '3 unread messages');
});
console.log(n, 'chat-whatsapp tests passed');
