import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../public/games/hillclimb-racing/race.js', import.meta.url), 'utf8');
// the live link must report problems instead of failing silently
assert.ok(/Cannot see the other cars/.test(src), 'receive errors are shown');
assert.ok(/Your car is not reaching the others/.test(src), 'send errors are shown');
// off-screen opponents get an edge marker; markers are removed when the race stops
assert.ok(/function edgeMarks\(/.test(src) && /rcmk/.test(src));
assert.ok(/querySelectorAll\('\[id\^=rcmk\]'\)/.test(src), 'markers cleaned up');
// the packet keys the client sends must all be allowed by firestore.rules
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const allowed = rules.match(/hasOnly\(\[('x'[^\]]*)\]\)/)[1].match(/'(\w+)'/g).map((k) => k.replace(/'/g, ''));
const pkt = src.match(/var pkt = \{([^}]*)\}/)[1].match(/(\w+):/g).map((k) => k.replace(':', ''));
for (const k of pkt) assert.ok(allowed.includes(k), `rules allow packet key ${k}`);
console.log('race client ok');
