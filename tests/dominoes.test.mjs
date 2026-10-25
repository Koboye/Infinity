import assert from 'node:assert/strict';
import { newMatch, dealRound, playTile, drawTile, playsFor, mustDraw, normalize, handPips, fullSet, sameTile, ends, hasPlay, forfeit } from '../src/lib/dominoes/engine.js';
import { chooseDominoPlay } from '../src/lib/dominoes/ai.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const base = (o = {}) => ({ rules: 'draw', target: 50, round: 1, scores: [0, 0], phase: 'play', winner: null, lastWinner: null, lastStarter: 0,
  hands: [[], []], boneyard: [], chain: [], turn: 0, passes: 0, mustLead: null, voids: [[], []], roundResult: null, ...o });
const total = (s) => s.hands[0].length + s.hands[1].length + s.boneyard.length + s.chain.length;

t('deal: 7 + 7 + 14, all 28 distinct', () => {
  const s = newMatch('draw', 50);
  assert.equal(s.hands[0].length, 7); assert.equal(s.hands[1].length, 7); assert.equal(s.boneyard.length, 14);
  const all = [...s.hands[0], ...s.hands[1], ...s.boneyard]; assert.equal(all.length, 28);
  for (const a of fullSet()) assert.equal(all.filter((b) => sameTile(a, b)).length, 1);
});
t('round one (strict): the highest double (else heaviest tile) opens, and that tile must be the first played', () => {
  for (let k = 0; k < 80; k++) {
    const s = newMatch('block', 50);
    const all = [...s.hands[0].map((t) => [0, t]), ...s.hands[1].map((t) => [1, t])];
    const doubles = all.filter(([, t]) => t[0] === t[1]);
    const expected = doubles.length ? doubles.sort((x, y) => y[1][0] - x[1][0])[0] : all.sort((x, y) => (y[1][0] + y[1][1] + y[1][1] / 10) - (x[1][0] + x[1][1] + x[1][1] / 10))[0];
    assert.equal(s.turn, expected[0]); assert.ok(sameTile(s.mustLead, expected[1]));
    const plays = playsFor(s.hands[s.turn], s.chain, s.mustLead);
    assert.equal(plays.length, 1, 'only the opening tile may be played');
    assert.equal(playTile(s, s.hands[s.turn].find((t) => !sameTile(t, s.mustLead)), 'R').ok, false, 'any other opening is refused');
  }
});
t('matching ends, both orientations, both ends', () => {
  const s = base({ chain: [[2, 3], [3, 5]], hands: [[[0, 2], [5, 6], [1, 4], [2, 5]], [[0, 0]]], turn: 0 });
  const p = playsFor(s.hands[0], s.chain);
  assert.equal(p.length, 4); // [0,2]→L, [5,6]→R, [2,5]→L and R
  const r = playTile(s, [2, 0], 'L'); assert.ok(r.ok); assert.deepEqual(r.state.chain[0], [0, 2]); assert.deepEqual(ends(r.state.chain), [0, 5]);
  const r2 = playTile(s, [5, 6], 'R'); assert.deepEqual(r2.state.chain.at(-1), [5, 6]);
  assert.equal(playTile(s, [1, 4], 'L').ok, false);
});
t('chain stays connected through random play', () => {
  for (let k = 0; k < 400; k++) {
    let s = newMatch(k % 2 ? 'draw' : 'block', 100), guard = 0;
    while (s.phase === 'play' && guard++ < 200) {
      assert.equal(total(s), 28);
      for (let i = 0; i + 1 < s.chain.length; i++) assert.equal(s.chain[i][1], s.chain[i + 1][0]);
      if (mustDraw(s)) { s = drawTile(s).state; continue; }
      const pl = playsFor(s.hands[s.turn], s.chain, s.mustLead); assert.ok(pl.length > 0, 'turn must have a play');
      const p = pl[Math.floor(Math.random() * pl.length)]; const r = playTile(s, p.tile, p.end); assert.ok(r.ok); s = r.state;
    }
    assert.notEqual(s.phase, 'play'); assert.ok(s.roundResult);
  }
});
t('going out scores the other hand', () => {
  const s = base({ chain: [[3, 4]], hands: [[[4, 4]], [[1, 2], [0, 6]]], turn: 0, boneyard: [] });
  const r = playTile(s, [4, 4], 'R'); assert.ok(r.ok && r.domino);
  assert.equal(r.state.roundResult.reason, 'domino'); assert.equal(r.state.scores[0], 9); assert.equal(r.state.phase, 'roundOver');
});
t('reaching the target ends the match', () => {
  const s = base({ scores: [45, 0], chain: [[3, 4]], hands: [[[4, 4]], [[6, 6], [1, 2]]], turn: 0 });
  const r = playTile(s, [4, 4], 'R'); assert.equal(r.state.phase, 'over'); assert.equal(r.state.winner, 0);
});
t('draw game: must draw when stuck, tiles move from the boneyard', () => {
  const s = base({ chain: [[1, 1]], hands: [[[2, 3], [4, 5]], [[1, 6]]], boneyard: [[0, 0], [1, 5]], turn: 0 });
  assert.equal(mustDraw(s), true); assert.equal(playTile(s, [2, 3], 'L').ok, false);
  const d = drawTile(s); assert.ok(d.ok); assert.deepEqual(d.tile, [1, 5]); // pops from the end
  assert.equal(d.state.hands[0].length, 3); assert.equal(d.state.boneyard.length, 1); assert.equal(d.state.turn, 0);
  assert.ok(d.state.voids[0].includes(1));
  assert.equal(drawTile(d.state).ok, false, 'cannot draw once you can play');
});
t('block game: stuck player is passed automatically', () => {
  const s = base({ rules: 'block', chain: [[1, 1]], hands: [[[2, 3]], [[1, 6], [0, 1]]], boneyard: [[5, 5]], turn: 1 });
  const r = playTile(s, [1, 6], 'R'); assert.deepEqual(r.autoPasses, [0]); assert.equal(r.state.turn, 1); assert.equal(r.state.passes, 1);
});
t('blocked table: lower hand wins the difference; tie scores nothing', () => {
  const s = base({ rules: 'block', chain: [[1, 2], [2, 3]], hands: [[[0, 0], [4, 4]], [[5, 5], [6, 6]]], turn: 0 });
  const n1 = normalize(s); assert.equal(n1.state.phase, 'roundOver'); assert.equal(n1.state.roundResult.reason, 'blocked');
  assert.equal(n1.state.roundResult.winner, 0); assert.equal(n1.state.scores[0], 22 - 8);
  const s2 = base({ rules: 'block', chain: [[1, 2], [2, 3]], hands: [[[0, 0], [4, 4]], [[0, 4], [2, 2]]], turn: 0 });
  assert.equal(normalize(s2).state.roundResult.winner, 'tie');
});
t('next round: winner leads, scores carry', () => {
  let s = base({ scores: [12, 5], lastWinner: 1, round: 2, chain: [], hands: [[], []] });
  const d = dealRound(s); assert.equal(d.round, 3); assert.equal(d.turn, 1); assert.deepEqual(d.scores, [12, 5]); assert.equal(d.hands[0].length, 7);
});
t('forfeit ends the match', () => { assert.equal(forfeit(newMatch(), 1).winner, 0); });
t('AI plays legal tiles and beats a random player', () => {
  for (const level of ['easy', 'medium', 'hard']) {
    let wins = 0, N = level === 'hard' ? 14 : 24;
    for (let k = 0; k < N; k++) {
      let s = newMatch('draw', 100); const ai = k % 2; let guard = 0;
      while (s.phase !== 'over' && guard++ < 3000) {
        if (s.phase === 'roundOver') { s = dealRound(s); continue; }
        if (mustDraw(s)) { s = drawTile(s).state; continue; }
        const pl = playsFor(s.hands[s.turn], s.chain, s.mustLead);
        let p;
        if (s.turn === ai) { p = chooseDominoPlay(s, level); assert.ok(pl.some((x) => sameTile(x.tile, p.tile) && x.end === p.end), 'AI move must be legal'); }
        else p = pl[Math.floor(Math.random() * pl.length)];
        s = playTile(s, p.tile, p.end).state;
      }
      assert.equal(s.phase, 'over'); if (s.winner === ai) wins++;
    }
    console.log(`  AI(${level}) wins`, wins, '/', N); assert.ok(wins >= N * (level === 'easy' ? 0.5 : 0.6));
  }
});
console.log(n, 'dominoes tests passed');
