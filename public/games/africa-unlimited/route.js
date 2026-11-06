/* AFRICA UNLIMITED - route.js
   Finds the REAL road route between two places (OpenStreetMap data through OSRM) and prepares it for the game.
   Route points are stored in Web-Mercator metres so they are independent of the game's local frame. */
import { lon2mx, lat2my, mx2lon, my2lat } from './geo.js';

const HOSTS = ['https://router.project-osrm.org', 'https://routing.openstreetmap.de/routed-car'];
const D2R = Math.PI / 180;

export async function fetchRoute(a, b) {
  for (const h of HOSTS) {
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 30000);
      const r = await fetch(`${h}/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson&steps=false&alternatives=false`, { signal: ctl.signal });
      clearTimeout(to);
      if (!r.ok) continue;
      const j = await r.json();
      if (j.code !== 'Ok' || !j.routes || !j.routes[0]) continue;
      return buildRoute(j.routes[0].geometry.coordinates, j.routes[0].distance, j.routes[0].duration);
    } catch (e) { /* try next host */ }
  }
  return null;
}

/* coords: [[lon,lat],...] */
export function buildRoute(coords, dist, time) {
  const n = coords.length, mx = new Float64Array(n), my = new Float64Array(n), lat = new Float64Array(n), cum = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    mx[i] = lon2mx(coords[i][0]); my[i] = lat2my(coords[i][1]); lat[i] = coords[i][1];
    if (i) cum[i] = cum[i - 1] + Math.hypot(mx[i] - mx[i - 1], my[i] - my[i - 1]) * Math.cos(lat[i] * D2R);
  }
  return { mx, my, lat, cum, n, total: cum[n - 1], dist: dist || cum[n - 1], time: time || 0, coords };
}
export function serializeRoute(r) {
  const c = new Array(r.n);
  for (let i = 0; i < r.n; i++) c[i] = [Math.round(r.coords[i][0] * 1e5) / 1e5, Math.round(r.coords[i][1] * 1e5) / 1e5];
  return { c, d: r.dist, t: r.time };
}
export function deserializeRoute(o) { return buildRoute(o.c, o.d, o.t); }

/* position along the route (metres from start) as lat/lon plus segment index */
export function pointAlong(r, along) {
  along = Math.max(0, Math.min(r.total, along));
  let lo = 0, hi = r.n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r.cum[m] <= along) lo = m; else hi = m; }
  const seg = r.cum[hi] - r.cum[lo] || 1, u = Math.max(0, Math.min(1, (along - r.cum[lo]) / seg));
  const mx = r.mx[lo] + (r.mx[hi] - r.mx[lo]) * u, my = r.my[lo] + (r.my[hi] - r.my[lo]) * u;
  return { lat: my2lat(my), lon: mx2lon(mx), i: lo };
}
/* index of the route vertex closest to a lat/lon (full scan, used for recovery) */
export function nearestAlong(r, lat, lon) {
  const mx = lon2mx(lon), my = lat2my(lat); let best = 1e30, bi = 0;
  for (let i = 0; i < r.n; i++) { const d = (r.mx[i] - mx) ** 2 + (r.my[i] - my) ** 2; if (d < best) { best = d; bi = i; } }
  return { along: r.cum[bi], dist: Math.sqrt(best) * Math.cos(lat * D2R) };
}
