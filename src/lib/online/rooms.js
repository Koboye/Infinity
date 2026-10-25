// Server-side room logic for every game. Kept separate from the HTTP route so it can be unit-tested with a fake db.
import { gameOf, normalizeGame } from './games.js';
import { finishRoom } from './common.js';
import { randomFloat } from '../fairRandom.js';

export const K_FACTOR = 24;
export const WAIT_MS = 120_000; // a public room nobody joined for this long is considered abandoned
export const SPIN_GRACE_MS = 12_000; // the opening wheel (7 s spin + result) must not eat the first player's clock
export const PRESENCE_MS = 45_000;   // a waiting room whose owner has not pinged for this long is a ghost
export const ROOM_TTL_MS = 7 * 24 * 3600 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const makeCode = (rng = randomFloat) =>
  Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(rng() * CODE_CHARS.length)]).join('');
export const normalizeCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

export function eloUpdate(rA, rB, scoreA, k = K_FACTOR) {
  const expA = 1 / (1 + 10 ** ((rB - rA) / 400));
  const dA = Math.round(k * (scoreA - expA));
  return [rA + dA, rB - dA];
}

/** Per-game stat field names on the user document. Gebeta keeps the original un-suffixed names. */
export function statFields(game) {
  const s = normalizeGame(game) === 'gebeta' ? '' : `_${game}`;
  return { rating: `rating${s}`, wins: `wins${s}`, losses: `losses${s}`, draws: `draws${s}`, games: `games${s}` };
}

export function newRoomDoc({ game, uid, profile, ruleset, options, isPublic, now, expireAt = null }) {
  const g = normalizeGame(game), mod = gameOf(g);
  const rs = mod.rulesets.includes(ruleset) ? ruleset : mod.defaultRuleset;
  const opts = mod.normalizeOptions(options);
  return {
    game: g, ruleset: rs, options: opts, public: !!isPublic, status: 'waiting',
    players: [uid], names: [profile.displayName], avatars: [profile.avatar],
    turn: 0, winner: null, moveSeq: 0, lastMove: null, deadline: null, turnMs: mod.turnMs, seen: {},
    reason: null, detail: null, emote: null, rematch: null, ratingChange: null,
    createdAt: now, expireAt,
    ...mod.create(rs, opts),
  };
}

/** Add the second player (randomising who sits first) and start the match. Returns { room, priv }. */
export function seatSecondPlayer(room, { uid, profile }, rng = randomFloat, now = Date.now()) {
  const players = [room.players[0], uid];
  const names = [room.names[0], profile.displayName];
  const avatars = [room.avatars[0], profile.avatar];
  if (rng() < 0.5) { players.reverse(); names.reverse(); avatars.reverse(); }
  const mod = gameOf(room.game);
  const seated = { ...room, players, names, avatars, status: 'playing', deadline: now + mod.turnMs };
  const out = mod.start(seated, rng, now);
  // First game of a pairing shows the spin wheel: give the first mover the time the wheel takes on top of the turn clock.
  if (!(room.options && room.options.avoid) && out.room && out.room.deadline) out.room = { ...out.room, deadline: out.room.deadline + SPIN_GRACE_MS, seen: {} };
  return out;
}

const TURN_ACTIONS = new Set(['move', 'huff', 'drawTile']) // 'collect' (Gebeta) is deliberately not turn-bound;

/** Validate + apply an in-match action. Returns { error } or { room, priv?, finished, noop? }. */
export function applyRoomAction(room, priv, uid, action, body = {}, now = Date.now(), rng = randomFloat) {
  const mod = gameOf(room.game);
  const fn = mod.actions[action];
  if (!fn) return { error: 'Unknown action' };
  if (room.status !== 'playing') return { error: 'Match is not in progress' };
  const seat = room.players.indexOf(uid);
  if (seat < 0) return { error: 'You are not in this match', status: 403 };
  if (TURN_ACTIONS.has(action) && room.turn !== seat) return { error: 'Not your turn' };
  return fn(room, priv, seat, body, now, rng);
}
export const applyRoomMove = (room, priv, uid, body, now, rng) => applyRoomAction(room, priv, uid, 'move', body, now, rng);

export function applyForfeit(room, loserSeat, reason) {
  return finishRoom(room, 1 - loserSeat, reason);
}

/** Rating/stat deltas for a finished human match. Returns [{uid, rating, result, delta}] */
export function settle(room, ratings) {
  const [a, b] = room.players;
  const scoreA = room.winner === 0 ? 1 : room.winner === 1 ? 0 : 0.5;
  const [nA, nB] = eloUpdate(ratings[0], ratings[1], scoreA);
  return [
    { uid: a, rating: nA, result: scoreA === 1 ? 'win' : scoreA === 0 ? 'loss' : 'draw', delta: nA - ratings[0] },
    { uid: b, rating: nB, result: scoreA === 0 ? 'win' : scoreA === 1 ? 'loss' : 'draw', delta: nB - ratings[1] },
  ];
}
