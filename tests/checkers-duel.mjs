// Self-play duel: current checkers AI vs a baseline module (pass a path to an older ai.js to compare versions), equal time. Run: node tests/checkers-duel.mjs [games] [ms] [ruleset] [baselinePath]
import * as C from '../src/lib/checkers/engine.js';
import * as NEW from '../src/lib/checkers/ai.js';
const N = +process.argv[2] || 8, MS = +process.argv[3] || 400, RS = process.argv[4] || 'flying';
const OLD = await import(process.argv[5] || '../src/lib/checkers/ai.js');
NEW.LEVELS.hard.ms = MS; OLD.LEVELS.hard.ms = MS;
let w = 0, l = 0, d = 0;
for (let g = 0; g < N; g++) {
  const newSeat = g % 2;
  let s = C.newGame(RS), n = 0;
  while (!s.over && n++ < 160) {
    let m;
    if (n <= 4) { const ms = C.legalMoves(s, RS); m = ms[Math.floor(Math.random() * ms.length)]; } // random opening for variety
    else m = (s.turn === newSeat ? NEW : OLD).chooseCheckersMove(s, RS, 'hard');
    if (!m) break;
    s = C.playMove(s, m.from, m.path, RS).state;
    while (s.pendingHuff && !s.over) { const sq = (s.turn === newSeat ? NEW : OLD).chooseHuffPick(s, RS); s = C.resolveHuff(s, sq, RS).state; }
  }
  const r = s.over ? (s.winner === 'draw' ? 'd' : s.winner === newSeat ? 'w' : 'l') : 'd';
  if (r === 'w') w++; else if (r === 'l') l++; else d++;
  console.log(`game ${g + 1}: new as seat ${newSeat} -> ${r} (${n} plies)`);
}
console.log(`NEW vs OLD (${RS}, ${MS}ms): ${w}W ${d}D ${l}L`);
