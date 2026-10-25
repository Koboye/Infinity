import { newGame, playMove, collect, validState, RULESETS } from '../gebeta/engine.js';
import { finishRoom } from './common.js';
import { ONLINE_TURN_SECONDS } from '../games.js';
import { randomFloat } from '../fairRandom.js';

const TURN_MS = ONLINE_TURN_SECONDS * 1000;

export default {
  id: 'gebeta', turnMs: TURN_MS, hidden: false,
  rulesets: Object.keys(RULESETS), defaultRuleset: 'gebeta',
  // `avoid` = the player who opened the previous game of a rematch: the OTHER player opens this one (first game: lottery)
  normalizeOptions: (o) => (o && typeof o.avoid === 'string' ? { avoid: o.avoid.slice(0, 128) } : {}),
  create: (ruleset) => { const g = newGame(ruleset); return { pits: g.pits, own: g.own, flag: g.flag, starter: 0, opening: !!g.opening, opener: null }; },
  // The FIRST game opens with a lottery (the client shows a spin wheel). A rematch alternates: the player who did not
  // open the previous game opens this one, so openers go X, Y, X, Y … `avoid` = who opened the previous game.
  start: (room, rng = randomFloat) => {
    const avoid = room.options && room.options.avoid;
    const first = avoid && room.players.includes(avoid) ? (room.players[0] === avoid ? 1 : 0) : (rng() < 0.5 ? 1 : 0);
    return { room: { ...room, turn: first, starter: first, opener: room.players[first] } };
  },
  actions: {
    // Tap a ripe family to bank it. A free action: the turn does not change, and it works on either player's turn.
    collect(room, priv, seat, body, now) {
      if (room.ruleset === 'tuz') return { error: 'Nothing to collect there' }; // ጡዝ: a four is an ordinary hole
      // A tap made WHILE the stones were still travelling (`at` = steps of the move already on screen): the move is
      // replayed from the board before it, with this collect landing at exactly that moment.
      const lm = room.lastMove;
      if (Number.isInteger(body.at) && body.at >= 0 && lm && lm.prev && lm.ctxSeq === room.moveSeq && room.status === 'playing') {
        const hole = Number(body.pit);
        const schedule = [...(lm.schedule || []), { at: body.at, hole, seat }];
        const before = { ...lm.prev, over: false, winner: null };
        if (validState(before)) {
          const r = playMove(before, lm.pit, room.ruleset, schedule);
          const fam = r.ok && r.steps[body.at];
          if (fam && fam.t === 'family' && fam.i === hole && fam.by === seat) {
            let next = {
              ...room, pits: r.state.pits, own: r.state.own, flag: r.state.flag, turn: r.state.turn, starter: r.state.starter, opening: !!r.state.opening, moveSeq: room.moveSeq + 1,
              lastMove: { by: lm.by, pit: lm.pit, steps: r.steps, prev: lm.prev, schedule, ctxSeq: room.moveSeq + 1, rescript: true },
              deadline: r.state.turn === room.turn ? room.deadline : now + TURN_MS,
            };
            if (r.state.over) next = finishRoom(next, r.state.winner);
            return { room: next, finished: !!r.state.over };
          }
        }
        // too late (or not valid at that moment): fall through to an ordinary collect of what is on the board now
      }
      const state = { pits: room.pits, own: room.own, flag: room.flag, turn: room.turn, starter: room.starter, opening: !!room.opening, over: false, winner: null };
      if (!validState(state)) return { error: 'Corrupt match state' };
      const r = collect(state, Number(body.pit), seat); // the entitled player may collect off-turn
      if (!r.ok) return { error: r.error };
      return { room: { ...room, pits: r.state.pits, flag: r.state.flag, moveSeq: room.moveSeq + 1, lastMove: { by: seat, pit: Number(body.pit), steps: r.steps, collect: true } }, finished: false };
    },
    move(room, priv, seat, body, now) {
      const pit = Number(body.pit);
      const state = { pits: room.pits, own: room.own, flag: room.flag, turn: room.turn, starter: room.starter, opening: !!room.opening, over: false, winner: null };
      if (!validState(state)) return { error: 'Corrupt match state' };
      const r = playMove(state, pit, room.ruleset);
      if (!r.ok) return { error: r.error };
      let next = {
        ...room, pits: r.state.pits, own: r.state.own, flag: r.state.flag, turn: r.state.turn, starter: r.state.starter, opening: !!r.state.opening, moveSeq: room.moveSeq + 1,
        lastMove: { by: seat, pit, steps: r.steps, prev: { pits: room.pits, own: room.own, flag: room.flag, turn: room.turn, starter: room.starter, opening: !!room.opening }, schedule: [], ctxSeq: room.moveSeq + 1 }, deadline: now + TURN_MS,
      };
      if (r.state.over) next = finishRoom(next, r.state.winner);
      return { room: next, finished: r.state.over };
    },
  },
};
