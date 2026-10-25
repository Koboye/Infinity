// Bingo online (2 players). Server-authoritative and clock-driven:
//  • the shuffled deck lives in the server-only `_boneyard` document, so nobody can peek at the next ball;
//  • each player's card + marks live in a private document only its owner can read;
//  • any client may ask for "the next ball" once `nextCallAt` has passed — the server checks the clock, so the
//    two phones can never disagree about what has been called;
//  • marking is validated (the number must have been called), and BINGO is checked against the server's marks.
import { makeCard, shuffle, patterns, FREE, CALL_SECONDS, LOCKOUT_CALLS, RULESETS } from '../bingo/engine.js';
import { finishRoom } from './common.js';
import { randomFloat } from '../fairRandom.js';

export const DECK_DOC = '_boneyard'; // same id the route already treats as a server-only private document
const CALL_MS = CALL_SECONDS * 1000;
export const FIRST_CALL_MS = 5000;

const freshMarks = () => { const m = new Array(25).fill(false); m[FREE] = true; return m; };
const countMarks = (m) => m.filter(Boolean).length - 1; // the FREE square does not count
const toGoOf = (ruleset, marks) => Math.min(...patterns(ruleset).map((p) => p.filter((i) => !marks[i]).length));
const validCard = (c) => Array.isArray(c) && c.length === 25;

export default {
  id: 'bingo', turnMs: CALL_MS, hidden: true,
  rulesets: Object.keys(RULESETS), defaultRuleset: 'line',
  normalizeOptions: () => ({}),
  create: () => ({
    called: [], nextCallAt: null, lock: { 0: 0, 1: 0 }, strikes: { 0: 0, 1: 0 },
    marked: { 0: 0, 1: 0 }, toGo: { 0: 4, 1: 4 }, winLine: null, turn: -1,
  }),
  start(room, rng = randomFloat, now = Date.now()) {
    const cards = [makeCard(rng), makeCard(rng)];
    const deck = shuffle(Array.from({ length: 75 }, (_, i) => i + 1), rng);
    const expireAt = room.expireAt ?? null;
    const next = {
      ...room, turn: -1, deadline: null, called: [], nextCallAt: now + FIRST_CALL_MS,
      lock: { 0: 0, 1: 0 }, strikes: { 0: 0, 1: 0 }, marked: { 0: 0, 1: 0 },
      toGo: { 0: toGoOf(room.ruleset, freshMarks()), 1: toGoOf(room.ruleset, freshMarks()) }, winLine: null,
    };
    return {
      room: next,
      priv: {
        [room.players[0]]: { card: cards[0], marks: freshMarks(), expireAt },
        [room.players[1]]: { card: cards[1], marks: freshMarks(), expireAt },
        [DECK_DOC]: { deck, expireAt },
      },
    };
  },
  actions: {
    // Reveal the next ball. Idempotent: `n` is how many balls the caller has seen, so a duplicate request is a no-op.
    call(room, priv, seat, body, now) {
      if (Number.isInteger(body.n) && body.n !== room.called.length) return { room, noop: true };
      if (!room.nextCallAt || now < room.nextCallAt - 400) return { room, noop: true };
      const deckDoc = priv[DECK_DOC];
      if (!deckDoc || !Array.isArray(deckDoc.deck)) return { error: 'Corrupt match state' };
      const deck = deckDoc.deck.slice();
      if (!deck.length) return { room: finishRoom({ ...room, moveSeq: room.moveSeq + 1 }, 'draw', 'completed', 'exhausted'), finished: true };
      const ball = deck.shift();
      const lock = { 0: Math.max(0, (room.lock?.[0] || 0) - 1), 1: Math.max(0, (room.lock?.[1] || 0) - 1) };
      const next = { ...room, called: [...room.called, ball], nextCallAt: now + CALL_MS, lock, moveSeq: room.moveSeq + 1, lastMove: { kind: 'call', ball } };
      return { room: next, priv: { [DECK_DOC]: { ...deckDoc, deck } }, finished: false };
    },
    // Daub a number. Only a number that has actually been called can be marked.
    mark(room, priv, seat, body, now) {
      const me = priv[room.players[seat]];
      const idx = Number(body.idx);
      if (!me || !validCard(me.card) || !validCard(me.marks)) return { error: 'Corrupt match state' };
      if (!Number.isInteger(idx) || idx < 0 || idx > 24 || idx === FREE) return { error: 'Bad square' };
      if (me.marks[idx]) return { room, noop: true };
      if (!room.called.includes(me.card[idx])) return { error: 'That number has not been called' };
      const marks = me.marks.slice(); marks[idx] = true;
      const next = {
        ...room, marked: { ...room.marked, [seat]: countMarks(marks) }, toGo: { ...room.toGo, [seat]: toGoOf(room.ruleset, marks) },
      };
      return { room: next, priv: { [room.players[seat]]: { ...me, marks } }, finished: false };
    },
    // Shout BINGO. A true claim wins at once; a false one locks you out for the next call.
    claim(room, priv, seat, body, now) {
      const me = priv[room.players[seat]];
      if (!me || !validCard(me.marks)) return { error: 'Corrupt match state' };
      if ((room.lock?.[seat] || 0) > 0) return { error: 'Locked out after a false BINGO' };
      const line = patterns(room.ruleset).find((p) => p.every((i) => me.marks[i]));
      if (line) {
        const next = finishRoom({ ...room, moveSeq: room.moveSeq + 1, winLine: line, lastMove: { kind: 'bingo', by: seat } }, seat, 'completed', `ball ${room.called.length}`);
        return { room: next, finished: true };
      }
      const next = {
        ...room, moveSeq: room.moveSeq + 1, lock: { ...room.lock, [seat]: LOCKOUT_CALLS }, strikes: { ...room.strikes, [seat]: (room.strikes?.[seat] || 0) + 1 },
        lastMove: { kind: 'false', by: seat },
      };
      return { room: next, finished: false };
    },
  },
};
