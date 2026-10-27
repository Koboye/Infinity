// Ludo online (2 players, seats 0 and 2 of the square board). Server-authoritative:
//  • the die is rolled HERE (crypto-fair `rollDie`), never by a client;
//  • the whole game state lives in `room.lg` as ONE JSON string (Firestore cannot store arrays of arrays);
//  • `room.turn` always mirrors the engine's player index so the shared turn / timeout / resign code works unchanged.
import { newGame, applyRoll, applyMove, rollDie, legalMoves } from '../ludo/engine.js';
import { finishRoom } from './common.js';
import { ONLINE_TURN_SECONDS } from '../games.js';
import { randomFloat } from '../fairRandom.js';

const TURN_MS = ONLINE_TURN_SECONDS * 1000;
const tokensOf = (ruleset) => (ruleset === 'quick' ? 2 : 4);
const load = (room) => { try { const s = JSON.parse(room.lg); return s && Array.isArray(s.pos) ? s : null; } catch { return null; } };
const pack = (s) => JSON.stringify({ ...s, log: (s.log || []).slice(-20) });

export default {
  id: 'ludo', turnMs: TURN_MS, hidden: false,
  rulesets: ['classic', 'quick'], defaultRuleset: 'classic',
  normalizeOptions: () => ({}),
  create: (ruleset) => ({ lg: pack(newGame({ players: 2, tokens: tokensOf(ruleset), start: 0 })), lastMove: null }),
  // who rolls first is a coin toss; seats were already shuffled, so simply pick player 0 or 1
  start: (room, rng = randomFloat) => {
    const first = rng() < 0.5 ? 1 : 0;
    return { room: { ...room, lg: pack(newGame({ players: 2, tokens: tokensOf(room.ruleset), start: first })), turn: first, lastMove: null } };
  },
  actions: {
    roll(room, priv, seat, body, now) {
      const s = load(room); if (!s) return { error: 'Corrupt match state' };
      if (s.over || s.phase !== 'roll' || s.turn !== seat) return { error: 'Not time to roll' };
      const value = rollDie();
      const r = applyRoll(s, value);
      if (r.error) return { error: r.error };
      const ns = r.state;
      return { room: { ...room, lg: pack(ns), turn: ns.turn, moveSeq: room.moveSeq + 1, deadline: now + TURN_MS, lastMove: { kind: 'roll', by: seat, value, none: !!r.none, forfeited: !!r.forfeited } } };
    },
    move(room, priv, seat, body, now) {
      const s = load(room); if (!s) return { error: 'Corrupt match state' };
      const i = Number(body.i);
      if (!Number.isInteger(i) || s.over || s.phase !== 'move' || s.turn !== seat) return { error: 'Illegal move' };
      if (!legalMoves(s).includes(i)) return { error: 'Illegal move' };
      const m = applyMove(s, i);
      if (!m.ok) return { error: m.error };
      const ns = m.state;
      let next = { ...room, lg: pack(ns), turn: ns.turn, moveSeq: room.moveSeq + 1, deadline: now + TURN_MS,
        lastMove: { kind: 'move', by: seat, i, from: m.from, to: m.to, dice: m.dice, caps: m.captured.length, home: !!m.finishes, out: !!m.leaves } };
      if (ns.over) next = finishRoom(next, ns.ranks[0], 'completed', null);
      return { room: next, finished: !!ns.over };
    },
  },
};
