import assert from 'node:assert/strict';
import { distance, bearing, turn, buildTrack, WAYPOINTS } from '../src/route.js';

assert.ok(Math.abs(bearing([0, 0], [1, 0]) - 0) < 0.01, 'north is 0');
assert.ok(Math.abs(bearing([0, 0], [0, 1]) - 90) < 0.01, 'east is 90');
assert.equal(turn(350, 10), 20, 'turn wraps across north (right turn)');
assert.equal(turn(10, 350), -20, 'left turn is negative');
assert.ok(Math.abs(distance([0, 0], [0, 1]) - 111195) < 200, '1 degree of longitude at the equator is about 111 km');

const pts = WAYPOINTS.map((w) => [w[0], w[1]]), lm = WAYPOINTS.map((w) => ({ lat: w[0], lon: w[1], name: w[2], zone: w[3] }));
const T = buildTrack(pts, lm);
assert.ok(T.meters > 7000 && T.meters < 12000, `route length is plausible: ${Math.round(T.meters)} m`);
assert.ok(Math.abs(T.n - Math.floor(T.meters / 25)) <= 1, 'one segment per 25 m');
assert.ok([...T.curve].every((c) => Number.isFinite(c) && Math.abs(c) <= 4), 'curvature stays within +-4');
assert.ok([...T.curve].some((c) => Math.abs(c) > 0.2), 'the road is not a dead-straight line');
assert.equal(T.marks.length, lm.length, 'every landmark is placed');
assert.ok(T.marks.every((m, i, a) => i === 0 || a[i - 1].i <= m.i), 'landmarks come in route order');
assert.equal(T.marks[0].name, 'Sidist Kilo'); assert.equal(T.marks.at(-1).name, 'Bole Airport');
assert.equal(T.zone[T.n - 1], 2, 'the end of the route is in the Bole zone');
console.log('route tests passed');
