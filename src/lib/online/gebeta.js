import { newGame, playMove, validState, RULESETS } from '../gebeta/engine.js';
import { finishRoom } from './common.js';

const TURN_MS = 60_000;

export default {
  id: 'gebeta', turnMs: TURN_MS, hidden: false,
  rulesets: Object.keys(RULESETS), defaultRuleset: 'gebeta',
  normalizeOptions: () => ({}),
  create: (ruleset) => ({ pits: newGame(ruleset).pits }),
  start: (room) => ({ room }),
  actions: {
    move(room, priv, seat, body, now) {
      const pit = Number(body.pit);
      const state = { pits: room.pits, turn: room.turn, over: false, winner: null };
      if (!validState(state)) return { error: 'Corrupt match state' };
      const r = playMove(state, pit, room.ruleset);
      if (!r.ok) return { error: r.error };
      let next = {
        ...room, pits: r.state.pits, turn: r.state.turn, moveSeq: room.moveSeq + 1,
        lastMove: { by: seat, pit, steps: r.steps }, deadline: now + TURN_MS,
      };
      if (r.state.over) next = finishRoom(next, r.state.winner);
      return { room: next, finished: r.state.over };
    },
  },
};
