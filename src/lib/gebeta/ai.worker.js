// Runs the Gebeta computer off the main thread so the screen never freezes while it thinks.
import { chooseMove } from './ai.js';
const tts = [new Map(), new Map()]; // search memory per seat, kept between turns
self.onmessage = (e) => {
  const { id, state, rules, level, auto } = e.data;
  let move = null;
  try { move = chooseMove(state, rules, level, Math.random, { tt: tts[state.turn], ...(auto ? { auto: state.turn } : {}) }); } catch (err) { move = undefined; }
  self.postMessage({ id, move });
};
