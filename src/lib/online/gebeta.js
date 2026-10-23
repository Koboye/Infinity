import { newGame, playMove, collect, validState, RULESETS } from '../gebeta/engine.js';
import { finishRoom } from './common.js';

const TURN_MS = 60_000;

export default {
  id: 'gebeta', turnMs: TURN_MS, hidden: false,
  rulesets: Object.keys(RULESETS), defaultRuleset: 'gebeta',
  normalizeOptions: () => ({}),
  create: (ruleset) => { const g = newGame(ruleset); return { pits: g.pits, own: g.own, flag: g.flag }; },
  start: (room) => ({ room }),
  actions: {
    // Tap a ripe family to bank it. A free action: the turn does not change.
    collect(room, priv, seat, body, now) {
      const state = { pits: room.pits, own: room.own, flag: room.flag, turn: room.turn, over: false, winner: null };
      if (!validState(state)) return { error: 'Corrupt match state' };
      const r = collect(state, Number(body.pit));
      if (!r.ok) return { error: r.error };
      return { room: { ...room, pits: r.state.pits, flag: r.state.flag, moveSeq: room.moveSeq + 1, lastMove: { by: seat, pit: Number(body.pit), steps: r.steps, collect: true } }, finished: false };
    },
    move(room, priv, seat, body, now) {
      const pit = Number(body.pit);
      const state = { pits: room.pits, own: room.own, flag: room.flag, turn: room.turn, over: false, winner: null };
      if (!validState(state)) return { error: 'Corrupt match state' };
      const r = playMove(state, pit, room.ruleset);
      if (!r.ok) return { error: r.error };
      let next = {
        ...room, pits: r.state.pits, own: r.state.own, flag: r.state.flag, turn: r.state.turn, moveSeq: room.moveSeq + 1,
        lastMove: { by: seat, pit, steps: r.steps }, deadline: now + TURN_MS,
      };
      if (r.state.over) next = finishRoom(next, r.state.winner);
      return { room: next, finished: r.state.over };
    },
  },
};
