import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cropSquare, PHOTO_SIZE, MAX_STORED_CHARS } from '../src/lib/photo.js';
// the picture is always a centred square, whatever the phone's photo shape
assert.deepEqual(cropSquare(4000, 3000), { sx: 500, sy: 0, s: 3000 });
assert.deepEqual(cropSquare(3000, 4000), { sx: 0, sy: 500, s: 3000 });
assert.deepEqual(cropSquare(500, 500), { sx: 0, sy: 0, s: 500 });
assert.ok(PHOTO_SIZE <= 256 && MAX_STORED_CHARS < 30000, 'small enough for the account document');
// the account may store it, and only as a small jpeg data URL (rules)
const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
assert.ok(rules.includes("'photo'") && rules.includes('data:image/jpeg;base64') && rules.includes('size() < 30000'));
// the coronation is wired: the animator flags the new king and the board draws it
const an = fs.readFileSync(new URL('../src/components/checkers/useCheckersAnimator.js', import.meta.url), 'utf8');
const bd = fs.readFileSync(new URL('../src/components/checkers/CheckersBoard.jsx', import.meta.url), 'utf8');
assert.ok(an.includes('mover.crown') && bd.includes('crowning') && bd.includes('k3d-burst'));
console.log('photo + coronation tests passed');
