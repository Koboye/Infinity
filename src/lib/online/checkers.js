import { newGame, playMove, resolveHuff, validState, positionKey, RULESETS } from '../checkers/engine.js';
import { finishRoom } from './common.js';
import { ONLINE_TURN_SECONDS } from '../games.js';
import { randomFloat } from '../fairRandom.js';

const TURN_MS = ONLINE_TURN_SECONDS * 1000;

export default {
  id: 'checkers', turnMs: TURN_MS, hidden: false,
  rulesets: Object.keys(RULESETS), defaultRuleset: 'flying',
  normalizeOptions: (o) => (o && typeof o.avoid === 'string' ? { avoid: o.avoid.slice(0, 128) } : {}),
  create: (ruleset) => { const g = newGame(ruleset); return { board: g.board, noProgress: 0, seen: g.seen, drawOffer: null, detail: null, pendingHuff: null, opener: null }; },
  // First game: lottery (coin). Rematch: the player who did not open the previous game opens (X, Y, X, Y …).
  start: (room, rng = randomFloat) => {
    const avoid = room.options && room.options.avoid;
    const first = avoid && room.players.includes(avoid) ? (room.players[0] === avoid ? 1 : 0) : (rng() < 0.5 ? 1 : 0);
    const seen = { [positionKey(room.board, first)]: 1 };
    return { room: { ...room, turn: first, seen, opener: room.players[first] } };
  },
  actions: {
    move(room, priv, seat, body, now) {
      const state = { board: room.board, turn: room.turn, over: false, winner: null, reason: null, noProgress: room.noProgress || 0, seen: room.seen || {}, pendingHuff: room.pendingHuff || null };
      if (!validState(state)) return { error: 'Corrupt match state' };
      const from = Number(body.from);
      const raw = Array.isArray(body.path) ? body.path : [body.to];
      if (raw.length > 24) return { error: 'Illegal move' };
      const path = raw.map(Number);
      if (!Number.isInteger(from) || path.some((n) => !Number.isInteger(n))) return { error: 'Illegal move' };
      const r = playMove(state, from, path, room.ruleset);
      if (!r.ok) return { error: r.error };
      let next = {
        ...room, board: r.state.board, turn: r.state.turn, noProgress: r.state.noProgress, seen: r.state.seen, pendingHuff: r.state.pendingHuff || null,
        moveSeq: room.moveSeq + 1, drawOffer: null,
        lastMove: { by: seat, from, path: r.move.path, caps: r.move.caps, promote: r.move.promote, huffed: r.huffed ?? null },
        deadline: now + TURN_MS,
      };
      if (r.state.over) next = finishRoom(next, r.state.winner, 'completed', r.state.reason);
      return { room: next, finished: r.state.over };
    },
    // Huff forfeit: an OPTIONAL claim. The player to move touches a piece of the opponent that missed a capture and
    // removes it (a free action: his turn is not used up). Playing a move instead cancels the claim.
    huff(room, priv, seat, body, now) {
      if (!room.pendingHuff) return { error: 'Nothing to remove' };
      const state = { board: room.board, turn: room.turn, over: false, winner: null, reason: null, noProgress: room.noProgress || 0, seen: room.seen || {}, pendingHuff: room.pendingHuff };
      const sqr = Number(body.square);
      const r = resolveHuff(state, sqr, room.ruleset);
      if (!r.ok) return { error: r.error };
      let next = {
        ...room, board: r.state.board, noProgress: r.state.noProgress, seen: r.state.seen, pendingHuff: null,
        moveSeq: room.moveSeq + 1, drawOffer: null,
        lastMove: { by: seat, from: null, path: [], caps: [], promote: false, huffed: r.huffed, huffPick: true },
        deadline: room.deadline,
      };
      if (r.state.over) next = finishRoom(next, r.state.winner, 'completed', r.state.reason);
      return { room: next, finished: r.state.over };
    },
    offerDraw(room, priv, seat) {
      if (room.drawOffer === 1 - seat) return { room: finishRoom(room, 'draw', 'completed', 'agreed'), finished: true };
      if (room.drawOffer === seat) return { error: 'You already offered a draw' };
      return { room: { ...room, drawOffer: seat } };
    },
    declineDraw(room, priv, seat) {
      if (room.drawOffer !== 1 - seat) return { error: 'No draw offer to decline' };
      return { room: { ...room, drawOffer: null } };
    },
  },
};
