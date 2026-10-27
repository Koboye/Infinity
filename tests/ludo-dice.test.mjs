import assert from 'node:assert/strict';
import { seatsFor } from '../src/lib/ludo/engine.js';
import { PANEL_SLOT } from '../src/lib/ludo/layout.js';
// every playing seat gets its own distinct screen slot, so each player has a die of their own
for (const n of [2, 4]) {
  const { board, seats } = seatsFor(n);
  const slots = seats.map((s) => PANEL_SLOT[board][s]);
  assert.ok(slots.every(Boolean), `players=${n}: every seat has a slot`);
  assert.equal(new Set(slots).size, seats.length, `players=${n}: slots are distinct`);
}
console.log('ludo dice panel tests passed');
