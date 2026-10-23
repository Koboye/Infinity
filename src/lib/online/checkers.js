import { newGame, playMove, validState, RULESETS } from '../checkers/engine.js';
import { finishRoom } from './common.js';

const TURN_MS = 90_000;

export default {
  id: 'checkers', turnMs: TURN_MS, hidden: false,
  rulesets: Object.keys(RULESETS), defaultRuleset: 'american',
  normalizeOptions: () => ({}),
  create: (ruleset) => { const g = newGame(ruleset); return { board: g.board, noProgress: 0, seen: g.seen, drawOffer: null, detail: null }; },
  start: (room) => ({ room }),
  actions: {
    move(room, priv, seat, body, now) {
      const state = { board: room.board, turn: room.turn, over: false, winner: null, reason: null, noProgress: room.noProgress || 0, seen: room.seen || {} };
      if (!validState(state)) return { error: 'Corrupt match state' };
      const from = Number(body.from);
      const raw = Array.isArray(body.path) ? body.path : [body.to];
      if (raw.length > 24) return { error: 'Illegal move' };
      const path = raw.map(Number);
      if (!Number.isInteger(from) || path.some((n) => !Number.isInteger(n))) return { error: 'Illegal move' };
      const r = playMove(state, from, path, room.ruleset);
      if (!r.ok) return { error: r.error };
      let next = {
        ...room, board: r.state.board, turn: r.state.turn, noProgress: r.state.noProgress, seen: r.state.seen,
        moveSeq: room.moveSeq + 1, drawOffer: null,
        lastMove: { by: seat, from, path: r.move.path, caps: r.move.caps, promote: r.move.promote },
        deadline: now + TURN_MS,
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
