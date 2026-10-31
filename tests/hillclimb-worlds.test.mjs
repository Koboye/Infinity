// Hill Climb Racing: 120 worlds x 100 levels data checks (worlds.js is a classic script, so evaluate it)
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir = 'public/games/hillclimb-racing/';
const code = fs.readFileSync(dir + 'worlds.js', 'utf8') + ';({WORLDS,PANO,LEVELS,TIERS,tierOf,goalOf,PMIX,OMIX,RIVC,ORBS,BIOMES,WORLD_COUNT,OPEN_NEED})';
const W = (0, eval)(code);
assert.equal(W.LEVELS, 100);
assert.ok(W.WORLD_COUNT >= 100, 'at least 100 worlds');
assert.equal(W.WORLDS.filter(w => w.cat === 'earth').length + W.WORLDS.filter(w => w.cat === 'planet').length, W.WORLD_COUNT);
assert.ok(W.WORLDS.filter(w => w.cat === 'planet').length >= 20, 'planets');
assert.equal(new Set(W.WORLDS.map(w => w.n)).size, W.WORLD_COUNT, 'unique world names');
W.WORLDS.forEach((w, i) => {
  assert.equal(w.id, i);
  assert.ok(fs.existsSync(dir + w.img), 'image missing: ' + w.img);
  assert.ok(W.PMIX[w.pm] && W.OMIX[w.om] && W.RIVC[w.riv], 'mix/river for ' + w.n);
  assert.ok(!w.orb || W.ORBS[w.orb], 'orb for ' + w.n);
  assert.ok(w.gv > .3 && w.gv < 1.3 && w.grip > .5 && w.amp > .6 && w.dm >= 1, 'physics sane for ' + w.n);
});
// difficulty: distance never shrinks by more than the per-world jitter, tiers cover 0..99 in order
for (let w = 0; w < W.WORLD_COUNT; w++) {
  assert.ok(W.goalOf(w, 0) <= 520 && W.goalOf(w, 99) >= 2000, 'range ' + w);
  for (let l = 1; l < 100; l++) assert.ok(W.goalOf(w, l) >= W.goalOf(w, l - 1), 'monotonic ' + w + ':' + l);
}
let prev = -1; for (let l = 0; l < 100; l++) { const i = W.TIERS.indexOf(W.tierOf(l)); assert.ok(i >= prev); prev = i }
// panorama worlds are always open, use the fauna scenery and are appended after the planets (saved progress keeps its world numbers)
assert.equal(W.PANO.length, 4);
W.PANO.forEach((p, i) => { const w = W.WORLDS[W.WORLD_COUNT - W.PANO.length + i]; assert.equal(w.n, p[0]); assert.ok(w.open && w.pano && w.fauna, 'pano flags ' + p[0]) });
assert.equal(W.WORLDS[119].cat, 'planet', 'planets keep ids 94..119');
const sc = fs.readFileSync(dir + 'scenery.js', 'utf8'), html = fs.readFileSync(dir + 'index.html', 'utf8');
assert.ok(html.includes('<script src="scenery.js">') && html.includes('Scenery.back(') && html.includes('Scenery.front('), 'scenery wired into the game loop');
for (const f of ['eagle', 'parrot', 'geese']) assert.ok(sc.includes("'" + f + "'"), 'fauna ' + f);
console.log('hillclimb worlds: ' + W.WORLD_COUNT + ' worlds x ' + W.LEVELS + ' levels = ' + (W.WORLD_COUNT * W.LEVELS) + ' levels OK');
