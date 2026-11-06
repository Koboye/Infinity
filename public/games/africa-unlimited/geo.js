/* AFRICA UNLIMITED - geo.js
   Real-world maths: Web-Mercator tiles <-> local metres, terrain grids, and mesh builders for
   roads and buildings. No DOM access here, so it can be unit-tested in node. */
import * as THREE from './three.module.min.js';

export const R = 6378137, TWO = 2 * Math.PI * R, Z = 14, N = 128;
const D2R = Math.PI / 180;
export const lon2mx = lon => lon * D2R * R;
export const lat2my = lat => Math.log(Math.tan(Math.PI / 4 + lat * D2R / 2)) * R;
export const mx2lon = mx => mx / R / D2R;
export const my2lat = my => (2 * Math.atan(Math.exp(my / R)) - Math.PI / 2) / D2R;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* Local frame: x = east, z = south, y = up, in true ground metres around (lat0, lon0). */
export class Frame {
  constructor(lat0, lon0) {
    this.lat0 = lat0; this.lon0 = lon0;
    this.mx0 = lon2mx(lon0); this.my0 = lat2my(lat0);
    this.k = Math.cos(lat0 * D2R);
  }
  toWorld(lat, lon) { return [(lon2mx(lon) - this.mx0) * this.k, -(lat2my(lat) - this.my0) * this.k]; }
  toLatLon(x, z) { return [my2lat(-z / this.k + this.my0), mx2lon(x / this.k + this.mx0)]; }
  tileAt(x, z, zoom = Z) {
    const s = TWO / 2 ** zoom, mx = x / this.k + this.mx0, my = -z / this.k + this.my0;
    return [Math.floor((mx + TWO / 2) / s), Math.floor((TWO / 2 - my) / s)];
  }
  tileRect(tx, ty, zoom = Z) {
    const s = TWO / 2 ** zoom, x0 = -TWO / 2 + tx * s, yTop = TWO / 2 - ty * s;
    return { x: (x0 - this.mx0) * this.k, z: -(yTop - this.my0) * this.k, w: s * this.k };
  }
  tileBounds(tx, ty, zoom = Z) {
    const s = TWO / 2 ** zoom, x0 = -TWO / 2 + tx * s, yTop = TWO / 2 - ty * s;
    return { w: mx2lon(x0), e: mx2lon(x0 + s), n: my2lat(yTop), s: my2lat(yTop - s) };
  }
}

/* ---------- elevation ---------- */
export function decodeTerrarium(d) {
  const h = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) h[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
  return h;
}
export function sampleRaw(h, fx, fy) {
  const u = clamp(fx * 256 - 0.5, 0, 255), v = clamp(fy * 256 - 0.5, 0, 255);
  const x0 = Math.floor(u), y0 = Math.floor(v), x1 = Math.min(255, x0 + 1), y1 = Math.min(255, y0 + 1);
  const tx = u - x0, ty = v - y0;
  return (h[y0 * 256 + x0] * (1 - tx) + h[y0 * 256 + x1] * tx) * (1 - ty) + (h[y1 * 256 + x0] * (1 - tx) + h[y1 * 256 + x1] * tx) * ty;
}
export function buildGrid(raw, vex = 1) {
  const n1 = N + 1, g = new Float32Array(n1 * n1);
  for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) g[j * n1 + i] = sampleRaw(raw, i / N, j / N) * vex;
  return g;
}
/* height at local metres (lx,lz) inside a tile of width w; exact triangle interpolation matching the mesh */
export function gridHeight(g, lx, lz, w) {
  const n1 = N + 1, c = w / N;
  const fx = clamp(lx / c, 0, N), fz = clamp(lz / c, 0, N);
  const i = Math.min(N - 1, Math.floor(fx)), j = Math.min(N - 1, Math.floor(fz));
  const tx = fx - i, tz = fz - j, a = g[j * n1 + i], b = g[j * n1 + i + 1], cc = g[(j + 1) * n1 + i], d = g[(j + 1) * n1 + i + 1];
  return tx + tz <= 1 ? a + (b - a) * tx + (cc - a) * tz : d + (cc - d) * (1 - tx) + (b - d) * (1 - tz);
}
/* terrain geometry in tile-local coordinates (mesh.position = tile corner). Includes skirts to hide seams. */
export function buildTerrainGeometry(g, w) {
  const n1 = N + 1, c = w / N, nv = n1 * n1, skirt = 4 * n1;
  const pos = new Float32Array((nv + skirt) * 3), uv = new Float32Array((nv + skirt) * 2);
  for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) {
    const k = j * n1 + i;
    pos[k * 3] = i * c; pos[k * 3 + 1] = g[k]; pos[k * 3 + 2] = j * c;
    uv[k * 2] = i / N; uv[k * 2 + 1] = 1 - j / N;
  }
  const idx = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * n1 + i, b = a + 1, cc = a + n1, d = cc + 1;
    idx.push(a, cc, b, b, cc, d);
  }
  const edges = [
    Array.from({ length: n1 }, (_, i) => i),
    Array.from({ length: n1 }, (_, i) => N * n1 + i),
    Array.from({ length: n1 }, (_, j) => j * n1),
    Array.from({ length: n1 }, (_, j) => j * n1 + N)
  ];
  let s = nv;
  for (const e of edges) {
    const base = s;
    for (let q = 0; q < n1; q++, s++) {
      const k = e[q];
      pos[s * 3] = pos[k * 3]; pos[s * 3 + 1] = pos[k * 3 + 1] - 40; pos[s * 3 + 2] = pos[k * 3 + 2];
      uv[s * 2] = uv[k * 2]; uv[s * 2 + 1] = uv[k * 2 + 1];
    }
    for (let q = 0; q < n1 - 1; q++) idx.push(e[q], base + q, e[q + 1], e[q + 1], base + q, base + q + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/* ---------- OSM meshes ---------- */
const WALLS = [[0.93, 0.9, 0.82], [0.86, 0.78, 0.64], [0.9, 0.62, 0.45], [0.8, 0.8, 0.78], [0.95, 0.85, 0.6], [0.7, 0.55, 0.45]];
const ROOFS = [[0.5, 0.5, 0.52], [0.62, 0.35, 0.28], [0.42, 0.42, 0.45], [0.7, 0.68, 0.62]];
export function pointInPoly(pts, x, z) {   /* pts = Float32Array [x0,z0,x1,z1,...] */
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], zi = pts[i + 1], xj = pts[j], zj = pts[j + 1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
/* list: [{pts:[[x,z]...] (open ring), h, id}] -> {geometry, solids:[{minx,maxx,minz,maxz,pts}]} */
export function buildBuildings(list, hAt) {
  const P = [], C = [], solids = [];
  const quad = (a, b, c, d, col) => { for (const v of [a, b, c, a, c, d]) { P.push(v[0], v[1], v[2]); C.push(col[0], col[1], col[2]); } };
  for (const b of list) {
    const pts = b.pts; if (pts.length < 3) continue;
    const hs = pts.map(p => hAt(p[0], p[1])), minH = Math.min(...hs), maxH = Math.max(...hs);
    const base = minH - 0.6, top = maxH + b.h, s = (b.id | 0) >>> 0;
    const wc = WALLS[s % WALLS.length], rc = ROOFS[(s >> 3) % ROOFS.length];
    const shade = 0.9 + ((s >> 5) % 10) / 50, col = [wc[0] * shade, wc[1] * shade, wc[2] * shade];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      quad([p[0], base, p[1]], [q[0], base, q[1]], [q[0], top, q[1]], [p[0], top, p[1]], col);
    }
    const tri = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []);
    for (const t of tri) for (const k of t) { P.push(pts[k][0], top, pts[k][1]); C.push(rc[0], rc[1], rc[2]); }
    const flat = new Float32Array(pts.length * 2); let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
    pts.forEach((p, i) => { flat[i * 2] = p[0]; flat[i * 2 + 1] = p[1]; minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); minz = Math.min(minz, p[1]); maxz = Math.max(maxz, p[1]); });
    solids.push({ minx, maxx, minz, maxz, pts: flat });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geometry.computeVertexNormals();
  return { geometry, solids };
}
/* ways: [{pts:[[x,z]...], w, c:[r,g,b]}] -> draped ribbon geometry */
export function buildRoads(ways, hAt) {
  const P = [], C = [], I = []; let v = 0;
  for (const way of ways) {
    const line = [];
    for (let i = 0; i < way.pts.length - 1; i++) {
      const a = way.pts[i], b = way.pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / 10));
      for (let k = 0; k < n; k++) line.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    line.push(way.pts[way.pts.length - 1]);
    if (line.length < 2) continue;
    const start = v;
    for (let i = 0; i < line.length; i++) {
      const p = line[i], p0 = line[Math.max(0, i - 1)], p1 = line[Math.min(line.length - 1, i + 1)];
      let dx = p1[0] - p0[0], dz = p1[1] - p0[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const nx = -dz * way.w / 2, nz = dx * way.w / 2;
      for (const s of [1, -1]) {
        const x = p[0] + nx * s, z = p[1] + nz * s;
        P.push(x, hAt(x, z) + 0.32, z); C.push(way.c[0], way.c[1], way.c[2]); v++;
      }
    }
    for (let i = 0; i < line.length - 1; i++) {
      const a = start + i * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geometry.setIndex(I);
  geometry.computeVertexNormals();
  return geometry;
}
export const ROAD_STYLE = {
  motorway: [12, [0.2, 0.2, 0.21]], trunk: [11, [0.2, 0.2, 0.21]], primary: [9.5, [0.22, 0.22, 0.23]],
  secondary: [8, [0.25, 0.25, 0.26]], tertiary: [7, [0.28, 0.28, 0.29]], residential: [6, [0.33, 0.33, 0.33]],
  living_street: [5, [0.36, 0.36, 0.35]], service: [4, [0.4, 0.4, 0.38]], unclassified: [5.5, [0.55, 0.46, 0.34]],
  road: [5.5, [0.5, 0.45, 0.38]], track: [3.8, [0.6, 0.48, 0.33]]
};
