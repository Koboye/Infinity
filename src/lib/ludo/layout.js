// Ludo board geometry (SVG units). Pure maths, shared by the renderer and the tests.
import { BOARDS, HOME_CELLS, finishOf } from './engine.js';

/* ── classic square: a 15×15 grid, cell (row, col) centred at (col+.5, row+.5) ── */
const RING_RC = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];
const HOME_RC = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
];
const SQ_BASE = [[0, 0], [9, 0], [9, 9], [0, 9]]; // [x0, y0] of each 6×6 base: red top-left, green top-right, yellow bottom-right, blue bottom-left
SQ_BASE[0] = [0, 0]; SQ_BASE[1] = [9, 0]; SQ_BASE[2] = [9, 9]; SQ_BASE[3] = [0, 9];
const rc = ([r, c]) => ({ x: c + 0.5, y: r + 0.5 });

export const viewBoxOf = () => '-0.5 -0.5 16 16';   // the 15×15 grid plus a half-cell margin for the frame

/** Absolute centre of every ring cell (index 0 … ringLen-1). */
export const ringXY = (board, idx) => rc(RING_RC[idx]);
export const homeXY = (board, seat, m) => rc(HOME_RC[seat][m - 1]); // m = 1…5
export const finishXY = (board, seat, slot = 0) => {
  const d = [[-0.85, 0], [0, -0.85], [0.85, 0], [0, 0.85]][seat], o = (slot - 1.5) * 0.4;
  return { x: 7.5 + d[0] + (d[0] ? 0 : o), y: 7.5 + d[1] + (d[1] ? 0 : o) };
};
export const baseXY = (board, seat, slot) => {
  // classic yard: a 6x6 corner with a white 4x4 square inside; the four pawns stand 2 apart round its centre
  const [x0, y0] = SQ_BASE[seat];
  return { x: x0 + 3 + ((slot % 2) - 0.5) * 2, y: y0 + 3 - 0.4 + (Math.floor(slot / 2) - 0.5) * 2 };
};

/** Turn a point k quarter-turns clockwise about the board centre — so every device can show ITS player at the bottom-left. */
export const turnXY = (k, { x, y }) => { let p = { x, y }; for (let n = 0; n < ((k % 4) + 4) % 4; n++) p = { x: 15 - p.y, y: p.x }; return p; };

/** Where is a token (of the seat) with relative position `pos`? slot = its index (only used for base / finish). k = view rotation. */
export function tokenXY(board, seat, pos, slot = 0, k = 0) {
  return turnXY(k, tokenXYraw(board, seat, pos, slot));
}
function tokenXYraw(board, seat, pos, slot = 0) {
  const B = BOARDS[board];
  if (pos === -1) return baseXY(board, seat, slot);
  if (pos === finishOf(board)) return finishXY(board, seat, slot);
  if (pos <= B.ringLen - 2) return ringXY(board, (B.seatStart[seat] + pos) % B.ringLen);
  return homeXY(board, seat, pos - (B.ringLen - 2));
}
export const homeCells = HOME_CELLS;

/* ── drawing helpers shared by the renderer and the game ── */
/** Token radius and hop height in SVG units, per board. */
export const UNIT = { square: { r: 0.72, hop: 0.7 } };

/** Centres of the cells a token crosses going from relative position `from` to `to` (used to draw the last-move trail). */
export function trailXY(board, seat, from, to, k = 0) {
  if (from === to) return [];
  const out = [];
  for (let x = from === -1 ? 0 : from + 1; x <= to; x++) out.push(tokenXY(board, seat, x, 0, k));
  return from === -1 ? [turnXY(k, baseXY(board, seat, 0)), ...out] : out;
}

/** Angle (degrees) of a seat's home column, pointing towards the finish — for the chevrons painted on it. */
export function homeAngle(board, seat) {
  const a = homeXY(board, seat, 1), b = homeXY(board, seat, 5);
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
}

/** Which corner of the screen each seat's player panel (and its die) sits in, next to that seat's base. */
export const PANEL_SLOT = { square: ['tl', 'tr', 'br', 'bl'] };

/** Quarter-turns that bring `seat` to the bottom-left corner (display position 3). */
export const viewOf = (seat) => (7 - seat) % 4;
