import assert from 'node:assert/strict';
import { newGame, playMove, resolveHuff, legalMoves } from '../src/lib/checkers/engine.js';
import { chooseCheckersMove, chooseHuffPick } from '../src/lib/checkers/ai.js';

// the computer plays only moves the free-choice rules allow, including claims, and games finish
for (const rs of ['flying', 'american']) {
  let skipped = 0, plies = 0;
  for (let g = 0; g < 4; g++) {
    let s = newGame(rs, { first: g & 1 }); let n = 0;
    while (!s.over && n++ < 160) {
      if (s.pendingHuff) { const sq = chooseHuffPick(s, rs); if (sq != null && n % 2) { const r = resolveHuff(s, sq, rs); assert.ok(r.ok); s = r.state; if (s.over) break; } }
      const m = chooseCheckersMove(s, rs, 'easy'); assert.ok(m, 'a move exists');
      const legal = legalMoves(s, rs);
      assert.ok(legal.some((x) => x.from === m.from && x.path.join() === m.path.join()), 'AI move is legal');
      const hadCapture = legal.some((x) => x.caps.length);
      const r = playMove(s, m.from, m.path, rs); assert.ok(r.ok, r.error);
      if (hadCapture && !m.caps.length) skipped++;
      plies++; s = r.state;
    }
  }
  console.log(`ok ${rs}: computer plays free-choice moves (${plies} plies, skipped a capture ${skipped}x)`);
}

// a human may always skip a capture; the piece is then offered for removal
{
  const b = new Array(64).fill(0); b[35] = 1; b[26] = 3; b[56] = 1; b[7] = 3; // (4,3) could take (3,2)
  const s = { ...newGame('flying'), board: b, turn: 0, seen: {} };
  const quiet = legalMoves(s, 'flying').find((m) => m.from === 56 && !m.caps.length);
  const r = playMove(s, quiet.from, quiet.path, 'flying');
  assert.ok(r.ok && r.state.pendingHuff && r.state.pendingHuff.options.includes(35));
  assert.ok(resolveHuff(r.state, 35, 'flying').ok);
}
console.log('ok skipping a capture is allowed and forfeits the piece when claimed');
