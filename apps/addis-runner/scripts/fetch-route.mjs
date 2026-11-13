// Run with internet: `npm run fetch-route`. Snaps the landmark route to real roads using OpenStreetMap data (via the public OSRM
// demo server) and writes data/route.json, which the game loads automatically. Map data (c) OpenStreetMap contributors, ODbL.
import { writeFile } from 'node:fs/promises';
import { WAYPOINTS } from '../src/route.js';

const coords = WAYPOINTS.map((w) => `${w[1]},${w[0]}`).join(';');
const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
const res = await fetch(url, { headers: { 'user-agent': 'addis-runner/0.1 (game prototype)' } });
if (!res.ok) throw new Error(`OSRM answered ${res.status}`);
const j = await res.json();
const line = j.routes?.[0]?.geometry?.coordinates;
if (!line?.length) throw new Error('No route returned');
const out = {
  source: 'OpenStreetMap contributors (ODbL) via OSRM',
  points: line.map(([lon, lat]) => [lat, lon]),
  landmarks: WAYPOINTS.map((w) => ({ lat: w[0], lon: w[1], name: w[2], zone: w[3] })),
};
await writeFile(new URL('../data/route.json', import.meta.url), JSON.stringify(out));
console.log(`Saved ${out.points.length} road points, ${Math.round(j.routes[0].distance)} m.`);
