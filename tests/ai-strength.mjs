// Self-play: checks that harder levels really beat easier ones. Run: node tests/ai-strength.mjs [games]
import * as G from '../src/lib/gebeta/engine.js';
import { chooseMove } from '../src/lib/gebeta/ai.js';
import * as C from '../src/lib/checkers/engine.js';
import { chooseCheckersMove } from '../src/lib/checkers/ai.js';
import * as D from '../src/lib/dominoes/engine.js';
import { chooseDominoPlay } from '../src/lib/dominoes/ai.js';
const N = +process.argv[2] || 6;
const only = process.argv[3];

function gebeta(l0, l1) {
  let s = G.newGame('gebeta'), n = 0;
  while (!s.over && n++ < 400) { const lv = s.turn === 0 ? l0 : l1; s = G.playMove(s, chooseMove(s, 'gebeta', lv), 'gebeta').state; }
  if (s.over) return s.winner;
  // Gebeta has no round limit: at the cap, whoever owns more seeds (pile + own holes) is ahead.
  const own = (k) => s.pits[k === 0 ? 6 : 13] + G.PITS[k].reduce((a, i) => a + s.pits[i], 0);
  return own(0) > own(1) ? 0 : own(1) > own(0) ? 1 : 'draw';
}
function checkers(rs, l0, l1) {
  let s = C.newGame(rs), n = 0;
  while (!s.over && n++ < 300) { const m = chooseCheckersMove(s, rs, s.turn === 0 ? l0 : l1); if (!m) break; s = C.playMove(s, m.from, m.path, rs).state; }
  return s.over ? s.winner : 'draw';
}
function dominoes(l0, l1) {
  let s = D.newMatch('draw', 50), n = 0;
  while (s.phase !== 'over' && n++ < 2000) {
    if (s.phase === 'roundOver') { s = D.dealRound(s); continue; }
    const lv = s.turn === 0 ? l0 : l1;
    if (D.mustDraw(s)) { s = D.drawTile(s).state; continue; }
    const p = chooseDominoPlay(s, lv); s = D.playTile(s, p.tile, p.end).state;
  }
  return s.winner;
}
function duel(name, f) {
  // stronger level plays seat 0 half the time and seat 1 half the time
  for (const [hi, lo] of [['hard', 'medium'], ['medium', 'easy']]) {
    let w = 0, l = 0, d = 0;
    for (let i = 0; i < N; i++) {
      const hiSeat = i % 2; const r = f(hiSeat === 0 ? hi : lo, hiSeat === 0 ? lo : hi);
      if (r === 'draw') d++; else if (r === hiSeat) w++; else l++;
    }
    console.log(`${name}: ${hi} vs ${lo} -> ${w}W ${d}D ${l}L`);
  }
}
const all = { gebeta, flying: (a, b) => checkers('flying', a, b), dominoes };
for (const [k, f] of Object.entries(all)) if (!only || only === k) duel(k, f);
