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

/* ── triangle: three identical sides of 18 cells, rotated 120° ── */
export const TRI = (() => {
  const cx = 50, cy = 54, R = 47;
  const V = [0, 1, 2].map((k) => { const a = (-90 + k * 120) * Math.PI / 180; return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; });
  return { cx, cy, R, V };
})();
const triRing = (idx) => { // ring cell idx 0…53: side k = floor(idx/18), j = idx%18
  const k = Math.floor(idx / 18), j = idx % 18, A = TRI.V[k], B = TRI.V[(k + 1) % 3], f = (j + 1) / 19; // equal spacing everywhere, also round the corners
  return { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f };
};
const triHome = (seat, m) => { // m = 1…5 along the line from the seat's last ring cell to the centre
  const c = triRing(BOARDS.triangle.seatStart[seat] - 1), f = m / 7;
  return { x: c.x + (TRI.cx - c.x) * f, y: c.y + (TRI.cy - c.y) * f };
};
const triFinish = (seat) => { const c = triRing(BOARDS.triangle.seatStart[seat] - 1), f = 6 / 7; return { x: c.x + (TRI.cx - c.x) * f, y: c.y + (TRI.cy - c.y) * f }; };
const triBase = (seat, slot) => { // near the corner the path reaches next, tokens in a 2×2 block
  const V = TRI.V[(seat + 1) % 3], k = 0.5, bx = V.x + (TRI.cx - V.x) * k, by = V.y + (TRI.cy - V.y) * k;
  const ox = slot % 2 ? 3.4 : -3.4, oy = slot < 2 ? -3.4 : 3.4, th = (seat + 1) * 2 * Math.PI / 3; // the 2×2 block turns with the seat, so all three bases are identical
  const dx = ox * Math.cos(th) - oy * Math.sin(th), dy = ox * Math.sin(th) + oy * Math.cos(th);
  return { x: bx + dx, y: by + dy, bx, by };
};

export const viewBoxOf = (board) => (board === 'square' ? '0 0 15 15' : '0 0 100 100');

/** Absolute centre of every ring cell (index 0 … ringLen-1). */
export const ringXY = (board, idx) => (board === 'square' ? rc(RING_RC[idx]) : triRing(idx));
export const homeXY = (board, seat, m) => (board === 'square' ? rc(HOME_RC[seat][m - 1]) : triHome(seat, m)); // m = 1…5
export const finishXY = (board, seat, slot = 0) => {
  if (board === 'square') { const d = [[-0.85, 0], [0, -0.85], [0.85, 0], [0, 0.85]][seat], o = (slot - 1.5) * 0.28; return { x: 7.5 + d[0] + (d[0] ? 0 : o), y: 7.5 + d[1] + (d[1] ? 0 : o) }; }
  const f = triFinish(seat), o = (slot - 1.5) * 1.5, n = { x: f.x - TRI.cx, y: f.y - TRI.cy }, L = Math.hypot(n.x, n.y) || 1;
  return { x: f.x - (n.y / L) * o, y: f.y + (n.x / L) * o };
};
export const baseXY = (board, seat, slot) => {
  if (board === 'triangle') return triBase(seat, slot);
  const [x0, y0] = SQ_BASE[seat]; return { x: x0 + 1.8 + (slot % 2) * 2.4, y: y0 + 1.8 + Math.floor(slot / 2) * 2.4 };
};

/** Where is a token (of the seat) with relative position `pos`? slot = its index (only used for base / finish). */
export function tokenXY(board, seat, pos, slot = 0) {
  const B = BOARDS[board];
  if (pos === -1) return baseXY(board, seat, slot);
  if (pos === finishOf(board)) return finishXY(board, seat, slot);
  if (pos <= B.ringLen - 2) return ringXY(board, (B.seatStart[seat] + pos) % B.ringLen);
  return homeXY(board, seat, pos - (B.ringLen - 2));
}
export const homeCells = HOME_CELLS;

/* ── drawing helpers shared by the renderer and the game ── */
/** Token radius and hop height in SVG units, per board. */
export const UNIT = { square: { r: 0.36, hop: 0.5 }, triangle: { r: 1.75, hop: 2.4 } };

/** Centres of the cells a token crosses going from relative position `from` to `to` (used to draw the last-move trail). */
export function trailXY(board, seat, from, to) {
  if (from === to) return [];
  const out = [];
  for (let x = from === -1 ? 0 : from + 1; x <= to; x++) out.push(tokenXY(board, seat, x, 0));
  return from === -1 ? [baseXY(board, seat, 0), ...out] : out;
}

/** Angle (degrees) of a seat's home column, pointing towards the finish — for the chevrons painted on it. */
export function homeAngle(board, seat) {
  const a = homeXY(board, seat, 1), b = homeXY(board, seat, 5);
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
}
