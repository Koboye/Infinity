// Calibrates the ጡዝ computer. Run: node tests/tuz-calibration.mjs [games-per-level] [level] [maxMs]
// Reference player = an average club player (3-ply look-ahead, 10 % careless moves). Seats alternate (who starts is fair).
import * as G from '../src/lib/gebeta/engine.js';
import { think, chooseMove } from '../src/lib/gebeta/ai.js';
const N = +process.argv[2] || 30, only = process.argv[3], maxMs = +process.argv[4] || Infinity;
const BANDS = { easy: [60, 75], medium: [76, 85], hard: [86, 99] };
const reference = (s, rng) => { const m = G.legalMoves(s); return rng() < 0.10 ? m[Math.floor(rng() * m.length)] : think(s, 'tuz', { depth: 3, ms: 1000, rng }).move; };
function game(level, seat) {
  let s = G.newGame('tuz', seat === 0 ? 0 : 1), n = 0; // the seat that starts alternates
  // the computer keeps its search memory per game, like the worker does
  const tt = new Map();
  while (!s.over && n++ < 500) {
    const m = s.turn === seat ? chooseMove(s, 'tuz', level, Math.random, { maxMs, tt, auto: seat }) : reference(s, Math.random);
    const r = G.playMove(s, m, 'tuz'); if (!r.ok) throw new Error('illegal move'); s = r.state;
  }
  return s.over ? (s.winner === seat ? 1 : s.winner === 'draw' ? 0.5 : 0) : 0.5;
}
for (const level of Object.keys(BANDS)) {
  if (only && only !== level) continue;
  let w = 0; for (let i = 0; i < N; i++) w += game(level, i % 2);
  const pct = (100 * w) / N, [lo, hi] = BANDS[level];
  console.log(`${level}: computer wins ${pct.toFixed(0)}% of ${N} (target ${lo}-${hi}%) ${pct >= lo && pct <= hi ? 'OK' : 'OUT OF BAND'}`);
}
