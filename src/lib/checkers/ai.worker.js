// Runs the checkers computer off the main thread so the screen never freezes while it thinks.
import { chooseCheckersMove, chooseHuffPick } from './ai.js';
self.onmessage = (e) => {
  const { id, kind, state, rules, level } = e.data;
  let result;
  try { result = kind === 'huff' ? chooseHuffPick(state, rules) : chooseCheckersMove(state, rules, level); } catch (err) { result = undefined; }
  self.postMessage({ id, result: result === undefined ? null : result, failed: result === undefined });
};
