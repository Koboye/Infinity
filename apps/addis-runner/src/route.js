// Route maths + the built-in Addis Ababa route. Pure functions, no DOM, so they can be tested in Node.
const R = 6371000, rad = (d) => (d * Math.PI) / 180, lerp = (a, b, t) => a + (b - a) * t;

/** Metres between two [lat, lon] points. */
export function distance(a, b) {
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** Compass bearing in degrees (0 = north, 90 = east) from a to b. */
export function bearing(a, b) {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
/** Signed change of heading b1 -> b2 in -180..180 (positive = turning right). */
export const turn = (b1, b2) => ((b2 - b1 + 540) % 360) - 180;

// Built-in route: [lat, lon, name, zone]. zone 0 = old city, 1 = city centre, 2 = Bole. Coordinates are APPROXIMATE
// (placed by hand); run `npm run fetch-route` to replace the straight legs with real OpenStreetMap road geometry.
export const WAYPOINTS = [
  [9.0405, 38.7615, 'Sidist Kilo', 0],
  [9.0346, 38.7626, 'Arat Kilo', 0],
  [9.0107, 38.7612, 'Meskel Square', 1],
  [8.9967, 38.7872, 'Bole Medhanialem', 2],
  [8.9779, 38.7993, 'Bole Airport', 2],
];

/**
 * Turn a polyline of [lat, lon] into game track data. The polyline is resampled every `segM` metres; the heading change at each
 * step becomes the road curvature, so real bends in the road are bends in the game. `wobble` adds a gentle arcade sway.
 */
export function buildTrack(points, landmarks, segM = 25, wobble = 0.35) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + distance(points[i - 1], points[i]));
  const total = cum[cum.length - 1], n = Math.max(8, Math.floor(total / segM)), pts = [];
  let j = 1;
  for (let k = 0; k <= n; k++) {
    const d = Math.min(total, (k * total) / n);
    while (j < points.length - 1 && cum[j] < d) j++;
    const t = Math.min(1, Math.max(0, (d - cum[j - 1]) / (cum[j] - cum[j - 1] || 1)));
    pts.push([lerp(points[j - 1][0], points[j][0], t), lerp(points[j - 1][1], points[j][1], t)]);
  }
  const b = [], tr = new Array(n).fill(0);
  for (let k = 0; k < n; k++) b.push(bearing(pts[k], pts[k + 1]));
  for (let k = 1; k < n; k++) tr[k] = turn(b[k - 1], b[k]);
  const curve = new Float32Array(n), W = 4;
  for (let k = 0; k < n; k++) {
    let s = 0; for (let q = -W; q <= W; q++) s += tr[Math.min(n - 1, Math.max(0, k + q))];
    curve[k] = Math.max(-4, Math.min(4, (s / (2 * W + 1)) * 0.3 + wobble * Math.sin(k * 0.07)));
  }
  const marks = landmarks.map((l) => {
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = distance(p, [l.lat, l.lon]); if (d < bd) { bd = d; best = i; } });
    return { i: Math.min(best, n - 1), name: l.name, zone: l.zone ?? 0 };
  }).sort((a, c) => a.i - c.i);
  const zone = new Uint8Array(n).fill(marks[0]?.zone ?? 0);
  for (const m of marks) zone.fill(m.zone, m.i);
  return { n, curve, zone, marks, meters: total, segM };
}
