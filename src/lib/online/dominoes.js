// Dominoes online. The line, scores and hand SIZES are public; each hand lives in a private
// document only its owner can read, and the boneyard lives in a server-only document.
// (Firestore cannot store arrays inside arrays, so tiles are 2-character strings like "36".)
import { newMatch, dealRound, playTile, drawTile, validHand, validMatch, RULESETS, TARGETS, DEFAULT_TARGET } from '../dominoes/engine.js';
import { finishRoom } from './common.js';
import { ONLINE_TURN_SECONDS } from '../games.js';

const TURN_MS = ONLINE_TURN_SECONDS * 1000;
export const BONEYARD_DOC = '_boneyard';
export const enc = (t) => `${t[0]}${t[1]}`;
export const dec = (s) => [Number(String(s)[0]), Number(String(s)[1])];
const validCode = (s) => typeof s === 'string' && /^[0-6][0-6]$/.test(s);

function toState(room, priv) {
  const [p0, p1] = room.players;
  const hand = (u) => (priv?.[u]?.hand || []).map(dec);
  return {
    rules: room.ruleset, target: room.target, round: room.round, scores: room.scores.slice(), phase: room.phase,
    winner: null, lastWinner: room.lastWinner ?? null, lastStarter: room.lastStarter ?? 0,
    hands: [hand(p0), hand(p1)], boneyard: (priv?.[BONEYARD_DOC]?.tiles || []).map(dec),
    chain: room.chain.map(dec), turn: room.turn, passes: room.passes || 0,
    mustLead: room.mustLead ? dec(room.mustLead) : null,
    voids: [room.voids?.['0'] || [], room.voids?.['1'] || []], roundResult: null,
  };
}

function publicFrom(s) {
  const rr = s.roundResult;
  return {
    round: s.round, scores: s.scores, phase: s.phase, chain: s.chain.map(enc), turn: s.turn, passes: s.passes,
    handCounts: [s.hands[0].length, s.hands[1].length], boneyardCount: s.boneyard.length,
    mustLead: s.mustLead ? enc(s.mustLead) : null, voids: { 0: s.voids[0], 1: s.voids[1] },
    lastWinner: s.lastWinner ?? null, lastStarter: s.lastStarter ?? 0,
    roundResult: rr ? { winner: rr.winner, reason: rr.reason, points: rr.points, h0: rr.hands[0].map(enc), h1: rr.hands[1].map(enc), pipsLeft: rr.pipsLeft } : null,
  };
}

function privFrom(room, s, oldPriv, expireAt) {
  const docs = {
    [room.players[0]]: { hand: s.hands[0].map(enc), expireAt },
    [room.players[1]]: { hand: s.hands[1].map(enc), expireAt },
    [BONEYARD_DOC]: { tiles: s.boneyard.map(enc), expireAt },
  };
  const out = {};
  for (const [id, d] of Object.entries(docs)) if (JSON.stringify(d) !== JSON.stringify(oldPriv?.[id] ?? null)) out[id] = d;
  return out;
}

export default {
  id: 'dominoes', turnMs: TURN_MS, hidden: true,
  rulesets: Object.keys(RULESETS), defaultRuleset: 'draw',
  normalizeOptions: (o) => ({ target: TARGETS.includes(Number(o?.target)) ? Number(o.target) : DEFAULT_TARGET }),
  create: (ruleset, opts) => ({
    target: opts.target, round: 0, scores: [0, 0], phase: 'play', chain: [], handCounts: [0, 0], boneyardCount: 0,
    passes: 0, mustLead: null, voids: { 0: [], 1: [] }, lastWinner: null, lastStarter: 1, roundResult: null,
  }),
  start(room, rng, now) {
    const s = newMatch(room.ruleset, room.target, rng);
    const next = { ...room, ...publicFrom(s), lastMove: null };
    return { room: next, priv: privFrom(next, s, {}, room.expireAt ?? null) };
  },
  actions: {
    move(room, priv, seat, body, now) {
      if (room.phase !== 'play') return { error: 'Round is not in progress' };
      const code = Array.isArray(body.tile) ? enc(body.tile) : body.tile;
      if (!validCode(code)) return { error: 'Bad tile' };
      const end = body.end === 'L' ? 'L' : 'R';
      const state = toState(room, priv);
      if (!validHand(state.hands[seat]) || !validMatch(state)) return { error: 'Corrupt match state' };
      const r = playTile(state, dec(code), end);
      if (!r.ok) return { error: r.error };
      return commit(room, priv, r.state, { by: seat, kind: 'play', tile: enc(r.tile), end: r.end, domino: !!r.domino, autoPasses: r.autoPasses }, now);
    },
    drawTile(room, priv, seat, body, now) {
      const cur = toState(room, priv);
      if (!validMatch(cur)) return { error: 'Corrupt match state' };
      const r = drawTile(cur);
      if (!r.ok) return { error: r.error };
      return commit(room, priv, r.state, { by: seat, kind: 'draw', autoPasses: r.autoPasses }, now);
    },
    nextRound(room, priv, seat, body, now, rng = Math.random) {
      if (room.phase !== 'roundOver') return { room, noop: true };
      if (Number.isInteger(body.round) && body.round !== room.round) return { room, noop: true };
      const s = dealRound(toState(room, priv), rng);
      const next = { ...room, ...publicFrom(s), moveSeq: room.moveSeq + 1, lastMove: { by: seat, kind: 'deal', autoPasses: [] }, deadline: now + TURN_MS };
      return { room: next, priv: privFrom(next, s, priv, room.expireAt ?? null) };
    },
  },
};

function commit(room, priv, s, lastMove, now) {
  let next = { ...room, ...publicFrom(s), moveSeq: room.moveSeq + 1, lastMove, deadline: now + TURN_MS };
  const out = { priv: privFrom(next, s, priv, room.expireAt ?? null) };
  if (s.phase === 'over') {
    next = { ...finishRoom(next, s.winner, 'completed', s.roundResult?.reason || null) };
    return { room: next, ...out, finished: true };
  }
  if (s.phase === 'roundOver') next.deadline = null;
  return { room: next, ...out, finished: false };
}
