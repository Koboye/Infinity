// v3.16: unique usernames, account deletion, chat attachments (photo / voice / document), car invite track choice, car level cap.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
process.env.GEBETA_RATE_MAX = '1000000';
register('./fakes/loader.mjs', import.meta.url);
const U = await import('../src/lib/username.js');
const S = await import('../src/lib/social.js');
const R = await import('../src/lib/online/race.js');
const { POST } = await import('../src/app/api/gebeta/route.js');
const { __store } = await import('./fakes/firebaseAdmin.mjs');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };

await t('username rules', () => {
  assert.equal(U.usernameProblem('ab'), 'short');
  assert.equal(U.usernameProblem('a'.repeat(21)), 'long');
  assert.equal(U.usernameProblem('has space'), 'chars');
  assert.equal(U.usernameProblem('_bad'), 'chars');
  assert.equal(U.usernameProblem('a..b'), 'chars');
  assert.equal(U.usernameProblem('Admin'), 'reserved');
  assert.equal(U.usernameProblem('@Kebede_92'), null);
  assert.equal(U.normalizeUsername(' @Kebede_92 '), 'kebede_92');
});

const call = async (uid, body) => POST({ headers: { get: () => (uid ? `Bearer tok:${uid}` : '') }, json: async () => body });
const ok = async (uid, body) => { const r = await call(uid, body); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
const bad = async (uid, body, status) => { const r = await call(uid, body); assert.equal(r.status, status, JSON.stringify(r.body)); return r.body; };
for (const [id, name] of [['alice', 'Alice'], ['bob', 'Bob']]) __store.set(`users/${id}`, { displayName: name, avatar: 'lion', rating: 1000, wins: 0, losses: 0, draws: 0, games: 0 });

await t('a username is unique: the second person is refused, and can take it after it is released', async () => {
  assert.equal((await ok('alice', { action: 'usernameClaim', username: '@Alice_ET' })).username, 'alice_et');
  assert.equal(__store.get('users/alice').username, 'alice_et');
  assert.equal((await ok('bob', { action: 'usernameCheck', username: 'alice_et' })).ok, false);
  await bad('bob', { action: 'usernameClaim', username: 'ALICE_ET' }, 409);
  await ok('alice', { action: 'usernameClaim', username: 'alice_et' });          // claiming your own again is fine
  await ok('alice', { action: 'usernameClaim', username: 'alice2' });             // changing lets go of the old one
  assert.equal(__store.has('usernames/alice_et'), false);
  await ok('bob', { action: 'usernameClaim', username: 'alice_et' });
  await bad('bob', { action: 'usernameClaim', username: 'x' }, 400);
});

const url = (uid, f = 'photo.jpg') => `https://firebasestorage.googleapis.com/v0/b/proj.appspot.com/o/u%2F${uid}%2Fchat%2F1_${f}?alt=media&token=abc`;
await t('attachments: only files from the sender\'s own folder are accepted', () => {
  assert.ok(S.cleanAttachment({ kind: 'image', url: url('alice'), size: 100 }, 'alice'));
  assert.equal(S.cleanAttachment({ kind: 'image', url: url('bob') }, 'alice'), null);                      // someone else's file
  assert.equal(S.cleanAttachment({ kind: 'image', url: 'https://evil.example/x.jpg' }, 'alice'), null);
  assert.equal(S.cleanAttachment({ kind: 'exe', url: url('alice') }, 'alice'), null);
  const v = S.cleanAttachment({ kind: 'voice', url: url('alice', 'voice.webm'), dur: 9999 }, 'alice'); assert.equal(v.dur, 600);
});
await t('a photo / voice note / document is sent through the API and shows a readable preview', async () => {
  const code = (await ok('alice', { action: 'friendCode' })).code;
  await ok('bob', { action: 'friendRequest', friendCode: code }); await ok('alice', { action: 'friendAccept', to: 'bob' });
  await ok('alice', { action: 'chatSend', to: 'bob', att: { kind: 'image', url: url('alice'), size: 5000, mime: 'image/jpeg' } });
  await ok('alice', { action: 'chatSend', to: 'bob', att: { kind: 'voice', url: url('alice', 'voice.webm'), dur: 7 } });
  await ok('alice', { action: 'chatSend', to: 'bob', att: { kind: 'file', url: url('alice', 'cv.pdf'), name: 'cv.pdf', size: 90000 } });
  await bad('alice', { action: 'chatSend', to: 'bob', att: { kind: 'image', url: url('bob') } }, 400);       // pretending to send bob's own file
  const msgs = __store.get(`chats/${S.pairId('alice', 'bob')}`).msgs;
  assert.deepEqual(msgs.map((m) => m.text), ['📷 Photo', '🎤 Voice message', '📄 cv.pdf']);
  assert.equal(msgs[1].att.dur, 7);
});

await t('delete account: profile, username, friends, chats and sign-in are all removed', async () => {
  await ok('alice', { action: 'accountDelete' });
  assert.ok(globalThis.__deletedUsers.includes('alice'));
  assert.equal(__store.has('users/alice'), false);
  assert.equal(__store.has('friends/alice'), false);
  assert.equal(__store.has('usernames/alice2'), false);
  assert.equal(__store.has(`chats/${S.pairId('alice', 'bob')}`), false);
  assert.equal(__store.get('friends/bob').list.alice, undefined);
});

await t('car: stage choice reaches the room and 100 stages are allowed', () => {
  const room = R.newRaceRoom({ code: 'ABCDE', uid: 'a', name: 'A', veh: 0, world: 7, level: 85, now: 1 });
  assert.equal(room.level, 85); assert.equal(room.world, 7);
  assert.equal(R.newRaceRoom({ code: 'ABCDE', uid: 'a', name: 'A', veh: 0, world: 7, level: 500, now: 1 }).level, 99);
  const cw = readFileSync(new URL('../src/lib/carWorlds.js', import.meta.url), 'utf8'); assert.match(cw, /CAR_LEVELS = 100/);
});
await t('car: tyre rotation and contact are wired in the client, storage + username rules exist', () => {
  const r = readFileSync(new URL('../public/games/hillclimb-racing/race.js', import.meta.url), 'utf8');
  assert.match(r, /gh\.sp0 \+= /); assert.match(r, /function bump/); assert.match(r, /o0: r\(om\[0\]\)/);
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /'o0', 'o1'/); assert.match(rules, /usernames\/\{name\}/);
  assert.match(readFileSync(new URL('../storage.rules', import.meta.url), 'utf8'), /match \/u\/\{uid\}/);
  const f = readFileSync(new URL('../src/components/Friends.jsx', import.meta.url), 'utf8'); assert.match(f, /CAR_WORLDS/); assert.match(f, /uploadAttachment/);
});
console.log(`${n} passed`);
