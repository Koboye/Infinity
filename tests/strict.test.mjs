// Strict-rule invariants checked over many random full games.
import assert from 'node:assert/strict';
import * as G from '../src/lib/gebeta/engine.js';
import * as D from '../src/lib/dominoes/engine.js';
import * as C from '../src/lib/checkers/engine.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('gebeta: 48 stones are never created or destroyed (both rule sets, 300 random games)', () => {
  for (const rs of ['gebeta', 'ashagro']) for (let k = 0; k < 150; k++) {
    let s = G.newGame(rs, k & 1);
    for (let ply = 0; ply < 400 && !s.over; ply++) {
      assert.ok(G.validState(s, true), `${rs} game ${k} ply ${ply}`);
      const ms = G.legalMoves(s);
      if (!ms.length) { const c = G.collectAll(s); if (c.steps.length) { s = c.state; continue; } break; }
      const r = G.playMove(s, ms[Math.floor(Math.random() * ms.length)], rs);
      assert.ok(r.ok); s = r.state;
    }
  }
});
t('gebeta: a corrupt board (stones missing) fails the strict check', () => {
  const s = G.newGame('gebeta'); s.pits[0] = 3;
  assert.equal(G.validState(s, true), false);
  assert.equal(G.validState(s), true, 'non-strict mode only checks structure');
});
t('dominoes: all 28 tiles stay accounted for through whole rounds', () => {
  for (const rs of ['draw', 'block']) for (let k = 0; k < 100; k++) {
    let s = D.newMatch(rs, 100);
    for (let ply = 0; ply < 200 && s.phase === 'play'; ply++) {
      assert.ok(D.validMatch(s), `${rs} game ${k} ply ${ply}`);
      if (D.mustDraw(s)) { s = D.drawTile(s).state; continue; }
      const p = D.playsFor(s.hands[s.turn], s.chain, s.mustLead);
      if (!p.length) break;
      const m = p[Math.floor(Math.random() * p.length)];
      s = D.playTile(s, m.tile, m.end).state;
    }
  }
});
t('dominoes: a duplicated tile is detected', () => {
  const s = D.newMatch('draw'); s.hands[0][0] = s.hands[1][0].slice();
  assert.equal(D.validMatch(s), false);
});
console.log(`${n} strict-rule tests passed`);
