/* AFRICA UNLIMITED - Phase 1: real-world 3D driving and exploring.
   Terrain: AWS Terrain Tiles (Terrarium). Imagery: Esri World Imagery. Roads & buildings: OpenStreetMap (Overpass). */
import * as THREE from './three.module.min.js';
import { Frame, Z, buildGrid, gridHeight, buildTerrainGeometry, buildBuildings, buildRoads, pointInPoly, decodeTerrarium, ROAD_STYLE } from './geo.js';
import { createCar, stepCar, createPerson, stepFoot } from './phys.js';
import { fetchRoute, serializeRoute, deserializeRoute, pointAlong, nearestAlong } from './route.js';

const $ = id => document.getElementById(id);
const TOUCH = matchMedia('(pointer:coarse)').matches;
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const PRESETS = [
  { n: 'Lalibela', d: 'Rock-hewn churches', lat: 12.0317, lon: 39.0473 },
  { n: 'Addis Ababa', d: 'Meskel Square', lat: 9.0107, lon: 38.7612 },
  { n: 'Bahir Dar', d: 'Lake Tana', lat: 11.5936, lon: 37.3910 },
  { n: 'Axum', d: 'Obelisks', lat: 14.1306, lon: 38.7185 },
  { n: 'Gondar', d: 'Fasil Ghebbi castles', lat: 12.6070, lon: 37.4690 },
  { n: 'Blue Nile Falls', d: 'Tis Abay', lat: 11.4890, lon: 37.5877 },
  { n: 'Ras Dashen', d: 'Simien highlands', lat: 13.2416, lon: 38.3687 },
  { n: 'Afar · Dallol', d: 'Desert adventure', lat: 14.2417, lon: 40.2989 }
];
const PAINTS = [0xf2f2f2, 0x1f8f3a, 0xf5c518, 0xd62828, 0x1d4ed8, 0x15171c];

/* ---------------- renderer, scene, lights ---------------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !TOUCH, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TOUCH ? 1.5 : 2));
const SHADOWS = !TOUCH;
renderer.shadowMap.enabled = SHADOWS; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbfe0ff, 450, 2300);
const camera = new THREE.PerspectiveCamera(62, 1, 0.4, 12000);
const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6b5a44, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.3); scene.add(sun, sun.target);
if (SHADOWS) { sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = sc.bottom = -60; sc.right = sc.top = 60; sc.near = 1; sc.far = 400; sun.shadow.bias = -0.0004; }

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x2f6fe0) }, hor: { value: new THREE.Color(0xbfe0ff) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(0xfff1d6) } },
  vertexShader: 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'varying vec3 vD;uniform vec3 top,hor,sunDir,sunCol;void main(){float h=clamp(vD.y,0.,1.);vec3 c=mix(hor,top,pow(h,.55));float s=max(dot(normalize(vD),sunDir),0.);c+=sunCol*(pow(s,600.)*3.+pow(s,18.)*.28);gl_FragColor=vec4(c,1.);}'
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 24, 14), skyMat); sky.renderOrder = -10; scene.add(sky);
const starsGeo = new THREE.BufferGeometry(); { const a = []; const r = mulberry(7); for (let i = 0; i < 900; i++) { const u = r() * 2 - 1, t = r() * 6.283, s = Math.sqrt(1 - u * u); a.push(Math.cos(t) * s * 8800, Math.abs(u) * 8800 * 0.98 + 200, Math.sin(t) * s * 8800); } starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); }
const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); scene.add(stars);

/* ---------------- world state ---------------- */
let frame = new Frame(9.0107, 38.7612), S2 = 1;
const tiles = new Map(); let queue = [], active = 0, genId = 0;
let hash = new Map(); const HC = 60;
let lastH = 0;
const roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
const bldMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
const canopyGeo = new THREE.IcosahedronGeometry(1, 1), trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 3, 6);
const canopyMat = new THREE.MeshLambertMaterial({ color: 0xffffff }), trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4330 });

function heightAt(x, z) {
  const [tx, ty] = frame.tileAt(x, z), t = tiles.get(tx + ',' + ty);
  if (!t || !t.g) return lastH;
  return gridHeight(t.g, x - t.rect.x, z - t.rect.z, t.rect.w);
}
function rebuildHash() {
  hash = new Map();
  for (const t of tiles.values()) if (t.solids) for (const s of t.solids)
    for (let cx = Math.floor(s.minx / HC); cx <= Math.floor(s.maxx / HC); cx++) for (let cz = Math.floor(s.minz / HC); cz <= Math.floor(s.maxz / HC); cz++) {
      const k = cx + ',' + cz; let a = hash.get(k); if (!a) hash.set(k, a = []); a.push(s);
    }
}
function solidAt(x, z) {
  const a = hash.get(Math.floor(x / HC) + ',' + Math.floor(z / HC)); if (!a) return false;
  for (const s of a) if (x >= s.minx && x <= s.maxx && z >= s.minz && z <= s.maxz && pointInPoly(s.pts, x, z)) return true;
  return false;
}
function waterAt(x, z) {
  const [tx, ty] = frame.tileAt(x, z), t = tiles.get(tx + ',' + ty); if (!t || !t.water) return false;
  const i = Math.floor((x - t.rect.x) / t.rect.w * 64), j = Math.floor((z - t.rect.z) / t.rect.w * 64);
  return i >= 0 && j >= 0 && i < 64 && j < 64 && t.water[j * 64 + i] === 1;
}
const env = { h: heightAt, water: waterAt, solid: solidAt };

function loadImg(url, ms = 20000) {
  return new Promise((res, rej) => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    const t = setTimeout(() => { im.src = ''; rej(new Error('timeout')); }, ms);
    im.onload = () => { clearTimeout(t); res(im); }; im.onerror = () => { clearTimeout(t); rej(new Error('img')); };
    im.src = url;
  });
}
function reliefCanvas(raw) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const small = document.createElement('canvas'); small.width = small.height = 256;
  const sx = small.getContext('2d'), im = sx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const i = y * 256 + x, h = raw[i], hl = raw[y * 256 + Math.max(0, x - 1)], hr = raw[y * 256 + Math.min(255, x + 1)];
    const sh = clamp(1 + (hl - hr) * 0.06, 0.55, 1.3);
    let r, g, b; if (h < 1400) { r = 120; g = 150; b = 70; } else if (h < 2400) { r = 150; g = 140; b = 80; } else if (h < 3400) { r = 140; g = 120; b = 90; } else { r = 165; g = 150; b = 135; }
    im.data[i * 4] = r * sh; im.data[i * 4 + 1] = g * sh; im.data[i * 4 + 2] = b * sh; im.data[i * 4 + 3] = 255;
  }
  sx.putImageData(im, 0, 0); c.getContext('2d').drawImage(small, 0, 0, 512, 512);
  return c;
}

async function loadTile(tx, ty, gen) {
  const key = tx + ',' + ty, rect = frame.tileRect(tx, ty);
  const t = { key, tx, ty, rect, g: null, raw: null, group: new THREE.Group(), lines: [], solids: null, water: null, imgDone: false, osmDone: false, treesDone: false, gen };
  tiles.set(key, t);
  let raw = null;
  try {
    const im = await loadImg(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`);
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    raw = decodeTerrarium(x.getImageData(0, 0, 256, 256).data);
  } catch (e) { raw = new Float32Array(65536); raw.fill(lastH || 1500); }
  if (tiles.get(key) !== t) return;
  t.raw = raw; t.g = buildGrid(raw, 1);
  t.canvas = reliefCanvas(raw); t.ctx = t.canvas.getContext('2d');
  t.tex = new THREE.CanvasTexture(t.canvas); t.tex.colorSpace = THREE.SRGBColorSpace; t.tex.anisotropy = 4;
  t.mat = new THREE.MeshLambertMaterial({ map: t.tex, emissive: 0xffffff, emissiveMap: t.tex, emissiveIntensity: 0.5, side: THREE.DoubleSide });
  t.rect = frame.tileRect(tx, ty);
  t.mesh = new THREE.Mesh(buildTerrainGeometry(t.g, t.rect.w), t.mat);
  t.mesh.position.set(t.rect.x - t.group.position.x, 0, t.rect.z - t.group.position.z); t.mesh.receiveShadow = SHADOWS; t.mesh.frustumCulled = false;
  t.group.add(t.mesh); scene.add(t.group);
  loadImagery(t); loadOSM(t);
}
async function loadImagery(t) {
  const jobs = [];
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    jobs.push(loadImg(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${Z + 1}/${t.ty * 2 + dy}/${t.tx * 2 + dx}`).then(im => {
      if (tiles.get(t.key) !== t) return; t.ctx.drawImage(im, dx * 256, dy * 256, 256, 256); t.tex.needsUpdate = true; t.imgOk = true;
    }).catch(() => {}));
  }
  await Promise.all(jobs); t.imgDone = true;
  if (tiles.get(t.key) !== t) return;
  if (t.imgOk) makeWater(t);
  maybeTrees(t);
}
function makeWater(t) {
  let d; try { d = t.ctx.getImageData(0, 0, 512, 512).data; } catch (e) { return; }
  const m = new Uint8Array(4096);
  for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) {
    const o = ((j * 8 + 4) * 512 + i * 8 + 4) * 4, r = d[o], g = d[o + 1], b = d[o + 2];
    if (b > r + 22 && b > g + 4) {
      const cx = Math.floor((i + 0.5) / 64 * 256), cy = Math.floor((j + 0.5) / 64 * 256); let mn = 1e9, mx = -1e9;
      for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) { const h = t.raw[clamp(cy + yy, 0, 255) * 256 + clamp(cx + xx, 0, 255)]; if (h < mn) mn = h; if (h > mx) mx = h; }
      if (mx - mn < 0.75) m[j * 64 + i] = 1;
    }
  }
  t.water = m;
}
async function fetchOverpass(b, gen) {
  const q = `[out:json][timeout:25];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|track|road)$"](${b.s},${b.w},${b.n},${b.e});way["building"](${b.s},${b.w},${b.n},${b.e}););out geom qt 4000;`;
  const hosts = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  for (let a = 0; a < 3; a++) {
    if (gen !== genId) return null;
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 28000);
      const r = await fetch(hosts[a % 2] + '?data=' + encodeURIComponent(q), { signal: ctl.signal }); clearTimeout(to);
      if (r.ok) return await r.json();
    } catch (e) {}
    await sleep(2500);
  }
  return null;
}
async function loadOSM(t) {
  const data = await fetchOverpass(frame.tileBounds(t.tx, t.ty), t.gen);
  if (tiles.get(t.key) !== t) return;
  try { if (data && data.elements) buildOSM(t, data.elements); } catch (e) { console.warn('osm', e); }
  t.osmDone = true; maybeTrees(t);
  if (t.key === centerKey && pendingSnap) trySnap();
}
function buildOSM(t, els) {
  const blds = [], ways = [];
  for (const e of els) {
    if (e.type !== 'way' || !e.geometry || e.geometry.length < 2) continue;
    const tg = e.tags || {}, pts = e.geometry.map(p => frame.toWorld(p.lat, p.lon));
    if (tg.building) {
      const g0 = e.geometry[0], g1 = e.geometry[e.geometry.length - 1];
      if (e.geometry.length < 4 || g0.lat !== g1.lat || g0.lon !== g1.lon || blds.length >= 2500) continue;
      pts.pop();
      let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
      a = Math.abs(a) / 2; if (a < 10 || a > 40000) continue;
      const lv = parseFloat(tg['building:levels']); let h = parseFloat(tg.height) || (lv ? lv * 3.2 : 0) || (3.2 + (e.id % 7) * 0.45);
      blds.push({ pts, h: Math.min(h, 200), id: e.id });
    } else if (tg.highway) {
      const st = ROAD_STYLE[tg.highway]; if (!st) continue;
      const unp = /unpaved|dirt|ground|gravel|sand|earth|mud|grass/.test(tg.surface || '');
      ways.push({ pts, w: unp ? st[0] * 0.85 : st[0], c: unp ? [0.58, 0.46, 0.32] : st[1] });
    }
  }
  if (ways.length) {
    const m = new THREE.Mesh(buildRoads(ways, heightAt), roadMat); m.frustumCulled = false; m.receiveShadow = SHADOWS; m.position.set(-t.group.position.x, 0, -t.group.position.z); t.group.add(m); t.roadMesh = m;
    t.lines = ways.map(w => { const f = new Float32Array(w.pts.length * 2); let a = 1e9, b = -1e9, c = 1e9, d = -1e9; w.pts.forEach((p, i) => { f[i * 2] = p[0]; f[i * 2 + 1] = p[1]; a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]); }); return { f, minx: a, maxx: b, minz: c, maxz: d, major: w.w >= 7 }; });
  }
  if (blds.length) {
    const r = buildBuildings(blds, heightAt); const m = new THREE.Mesh(r.geometry, bldMat); m.frustumCulled = false; m.castShadow = SHADOWS; m.receiveShadow = SHADOWS; m.position.set(-t.group.position.x, 0, -t.group.position.z);
    t.group.add(m); t.bldMesh = m; t.solids = r.solids; rebuildHash();
  }
}
function maybeTrees(t) {
  if (t.treesDone || !t.imgDone || !t.osmDone || !t.imgOk || tiles.get(t.key) !== t) return; t.treesDone = true;
  let d; try { d = t.ctx.getImageData(0, 0, 512, 512).data; } catch (e) { return; }
  const rnd = mulberry((t.tx * 73856093) ^ (t.ty * 19349663)), spots = [];
  for (let n = 0; n < 1600 && spots.length < 420; n++) {
    const u = rnd(), v = rnd(), o = ((v * 511 | 0) * 512 + (u * 511 | 0)) * 4, r = d[o], g = d[o + 1], b = d[o + 2];
    if (g > r + 6 && g > b + 10 && r + g + b < 330) {
      const x = t.rect.x + u * t.rect.w, z = t.rect.z + v * t.rect.w;
      if (!solidAt(x, z) && !waterAt(x, z)) spots.push([x, z, rnd()]);
    }
  }
  if (!spots.length) return;
  const can = new THREE.InstancedMesh(canopyGeo, canopyMat, spots.length), trk = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  spots.forEach((s, i) => {
    const y = heightAt(s[0], s[1]), sc = 0.8 + s[2] * 0.9;
    m.compose(new THREE.Vector3(s[0], y + 1.5 * sc, s[1]), q, new THREE.Vector3(sc, sc, sc)); trk.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(s[0], y + 3.4 * sc, s[1]), q, new THREE.Vector3(3 * sc, 1.9 * sc, 3 * sc)); can.setMatrixAt(i, m);
    can.setColorAt(i, c.setHSL(0.24 + s[2] * 0.08, 0.5, 0.2 + s[2] * 0.12));
  });
  can.frustumCulled = false; trk.frustumCulled = false; can.castShadow = SHADOWS; can.position.set(-t.group.position.x, 0, -t.group.position.z); trk.position.copy(can.position);
  t.group.add(can, trk); t.trees = [can, trk];
}
function disposeTile(t) {
  tiles.delete(t.key); scene.remove(t.group);
  t.group.traverse(o => { if (o.geometry && o.geometry !== canopyGeo && o.geometry !== trunkGeo) o.geometry.dispose(); });
  if (t.tex) t.tex.dispose(); if (t.mat) t.mat.dispose();
  if (t.trees) t.trees.forEach(i => i.dispose());
  if (t.solids) rebuildHash();
}
let centerKey = '';
function ensureTiles(fx, fz) {
  const [cx, cy] = frame.tileAt(fx, fz); centerKey = cx + ',' + cy;
  const want = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) want.push([cx + dx, cy + dy, Math.abs(dx) + Math.abs(dy)]);
  want.sort((a, b) => a[2] - b[2]);
  for (const [x, y] of want) if (!tiles.has(x + ',' + y) && !queue.some(q => q[0] === x && q[1] === y)) queue.push([x, y, genId]);
  for (const t of [...tiles.values()]) if (Math.max(Math.abs(t.tx - cx), Math.abs(t.ty - cy)) > 2) disposeTile(t);
  pump();
}
function pump() {
  while (active < 2 && queue.length) {
    const [x, y, g] = queue.shift(); if (g !== genId || tiles.has(x + ',' + y)) continue;
    active++; loadTile(x, y, g).catch(e => console.warn('tile', e)).finally(() => { active--; pump(); });
  }
}
function resetWorld(lat, lon) {
  genId++; queue = []; for (const t of [...tiles.values()]) disposeTile(t); hash = new Map();
  frame = new Frame(lat, lon); lastH = 0;
}

/* ---------------- vehicle and person models ---------------- */
const car = createCar(), person = createPerson();
let mode = 'car', paintIdx = LS.get('au_paint', 0) % PAINTS.length;
const carGroup = new THREE.Group(), bodyMats = [], wheels = [];
{
  const mk = (w, h, d, col, x, y, z, paint) => { const m = new THREE.MeshLambertMaterial({ color: col }); if (paint) bodyMats.push(m); const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = SHADOWS; carGroup.add(o); return o; };
  mk(2.0, 0.78, 4.4, 0xffffff, 0, 0.88, 0, true); mk(1.84, 0.66, 2.2, 0x1b2733, 0, 1.58, 0.35); mk(1.9, 0.09, 2.3, 0xffffff, 0, 1.96, 0.35, true);
  mk(1.7, 0.07, 1.7, 0x222222, 0, 2.04, 0.35); mk(2.06, 0.3, 0.3, 0x222222, 0, 0.62, -2.2); mk(2.06, 0.3, 0.3, 0x222222, 0, 0.62, 2.2);
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff6c8 }), tl = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.08), hl); a.position.set(s * 0.72, 0.98, -2.2); const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.08), tl); b.position.set(s * 0.78, 1.0, 2.21); carGroup.add(a, b); }
  const tg = new THREE.CylinderGeometry(0.46, 0.46, 0.4, 16); tg.rotateZ(Math.PI / 2); const tm = new THREE.MeshLambertMaterial({ color: 0x17181a }), hm = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 });
  for (const [x, z] of [[-1.05, -1.45], [1.05, -1.45], [-1.05, 1.45], [1.05, 1.45]]) {
    const piv = new THREE.Group(); piv.position.set(x, 0.46, z); const w = new THREE.Mesh(tg, tm); w.castShadow = SHADOWS; const hub = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.18), hm); w.add(hub); piv.add(w); carGroup.add(piv); wheels.push({ piv, w, front: z < 0 });
  }
  car.spots = [];
  for (const s of [-1, 1]) { const sp = new THREE.SpotLight(0xfff0d0, 0, 140, 0.55, 0.5, 2); sp.position.set(s * 0.7, 1.0, -2.2); sp.target.position.set(s * 0.7, 0.3, -40); carGroup.add(sp, sp.target); car.spots.push(sp); }
  carGroup.rotation.order = 'YXZ'; scene.add(carGroup);
}
function applyPaint() { bodyMats.forEach(m => m.color.setHex(PAINTS[paintIdx])); LS.set('au_paint', paintIdx); }
applyPaint();
const personGroup = new THREE.Group(), limbs = {};
{
  const sm = new THREE.MeshLambertMaterial({ color: 0x7b4a2d }), shirt = new THREE.MeshLambertMaterial({ color: 0x078930 }), pants = new THREE.MeshLambertMaterial({ color: 0x24324a });
  const box = (w, h, d, m, x, y, z, par) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = SHADOWS; (par || personGroup).add(o); return o; };
  box(0.5, 0.7, 0.28, shirt, 0, 1.15, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), sm); head.position.y = 1.68; personGroup.add(head);
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.13, 0.8, 0); box(0.18, 0.8, 0.2, pants, 0, -0.4, 0, leg); personGroup.add(leg); limbs['l' + s] = leg;
    const arm = new THREE.Group(); arm.position.set(s * 0.33, 1.45, 0); box(0.12, 0.62, 0.14, shirt, 0, -0.3, 0, arm); personGroup.add(arm); limbs['a' + s] = arm;
  }
  personGroup.visible = false; scene.add(personGroup);
}
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 600, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, fog: false }));
const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.35, 8, 36), new THREE.MeshBasicMaterial({ color: 0xffd23c, fog: false })); ring.rotation.x = Math.PI / 2;
const carMark = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 4), new THREE.MeshBasicMaterial({ color: 0x20e0ff, fog: false })); carMark.rotation.x = Math.PI;
scene.add(beacon, ring, carMark); beacon.visible = ring.visible = carMark.visible = false;

/* ---------------- input ---------------- */
const keys = {}, btn = { hand: false, boost: false }, joy = { x: 0, y: 0, id: null };
let playing = false;
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (!playing) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyE') toggleCar(); else if (e.code === 'KeyC') { paintIdx = (paintIdx + 1) % PAINTS.length; applyPaint(); }
  else if (e.code === 'KeyM') toggleMute(); else if (e.code === 'KeyT') cycleTime(); else if (e.code === 'KeyR') recover(); else if (e.code === 'KeyP') toggleAuto(); else if (e.code === 'KeyK') skipAhead();
  else if (e.code === 'Escape' || e.code === 'KeyH') openMenu();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function getInput() {
  let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), my = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  if (joy.id !== null) { mx = joy.x; my = -joy.y; }
  const sp = !!keys.Space || btn.hand;
  return { mx, my, hand: mode === 'car' && sp, jump: mode === 'foot' && sp, boost: !!keys.ShiftLeft || !!keys.ShiftRight || btn.boost };
}
const joyEl = $('joy'), knob = $('knob');
function joyMove(e) { const r = joyEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = (e.clientX - cx) / 55, dy = (e.clientY - cy) / 55; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } joy.x = Math.abs(dx) < 0.12 ? 0 : dx; joy.y = Math.abs(dy) < 0.12 ? 0 : dy; knob.style.transform = `translate(${dx * 38}px,${dy * 38}px)`; }
joyEl.addEventListener('pointerdown', e => { joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMove(e); e.preventDefault(); });
joyEl.addEventListener('pointermove', e => { if (e.pointerId === joy.id) joyMove(e); });
const joyEnd = e => { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; } };
joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
function hold(el, k) { el.addEventListener('pointerdown', e => { btn[k] = true; el.classList.add('on'); el.setPointerCapture(e.pointerId); e.preventDefault(); }); const up = () => { btn[k] = false; el.classList.remove('on'); }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); }
hold($('bA'), 'hand'); hold($('bB'), 'boost'); $('bC').addEventListener('pointerdown', e => { toggleCar(); e.preventDefault(); });
$('bAuto').onclick = toggleAuto; $('bSkip').onclick = () => skipAhead(); $('bMenu').onclick = openMenu; $('bPaint').onclick = () => { paintIdx = (paintIdx + 1) % PAINTS.length; applyPaint(); }; $('bMute').onclick = toggleMute; $('bTime').onclick = cycleTime;
let camYaw = 0, camPitch = 0.28, camOff = 0, camIdle = 0, drag = null;
canvas.addEventListener('pointerdown', e => { if (!playing) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; camYaw -= dx * 0.006; camPitch = clamp(camPitch + dy * 0.004, -0.1, 1.2); camIdle = 0; });
const dragEnd = e => { if (drag && e.pointerId === drag.id) drag = null; }; canvas.addEventListener('pointerup', dragEnd); canvas.addEventListener('pointercancel', dragEnd);
canvas.addEventListener('wheel', e => { camDist = clamp(camDist + e.deltaY * 0.01, 4, 18); }, { passive: true });
let camDist = 8;

/* ---------------- audio ---------------- */
let ac, osc, gainN, mute = LS.get('au_mute', false);
function initAudio() { if (ac) { ac.resume && ac.resume(); return; } try { ac = new (window.AudioContext || window.webkitAudioContext)(); osc = ac.createOscillator(); osc.type = 'sawtooth'; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; gainN = ac.createGain(); gainN.gain.value = 0; osc.connect(lp); lp.connect(gainN); gainN.connect(ac.destination); osc.start(); } catch (e) { ac = null; } }
function updateAudio(thr) { if (!ac) return; const sp = Math.abs(car.speed); gainN.gain.setTargetAtTime(!mute && mode === 'car' && playing ? 0.03 + Math.min(0.03, sp * 0.001) : 0, ac.currentTime, 0.1); osc.frequency.setTargetAtTime(38 + sp * 4.2 + (thr > 0 ? 10 : 0), ac.currentTime, 0.08); }
function toggleMute() { mute = !mute; LS.set('au_mute', mute); $('bMute').textContent = mute ? '🔇' : '🔊'; }
$('bMute').textContent = mute ? '🔇' : '🔊';

/* ---------------- day / night ---------------- */
let gameHour = 12, timeIdx = 0; const TIMES = [1, 60, 600];
function cycleTime() { timeIdx = (timeIdx + 1) % TIMES.length; toast('Time speed ×' + TIMES[timeIdx]); $('bTime').textContent = timeIdx ? '⏩' : '🕒'; }
const C = THREE.Color, dayTop = new C(0x2f6fe0), dayHor = new C(0xbfe0ff), duTop = new C(0x2a3a78), duHor = new C(0xff9a55), niTop = new C(0x03060f), niHor = new C(0x0a1226);
let night = 0;
function updateSky() {
  const ang = (gameHour - 6) / 12 * Math.PI, f = Math.sin(ang);
  const sd = new THREE.Vector3(Math.cos(ang), Math.max(f, -0.3), -0.25).normalize();
  const a = smooth(-0.12, 0.05, f), b = smooth(0.05, 0.35, f), l = smooth(0, 0.3, f);
  skyMat.uniforms.top.value.copy(niTop).lerp(duTop, a).lerp(dayTop, b);
  skyMat.uniforms.hor.value.copy(niHor).lerp(duHor, a).lerp(dayHor, b);
  skyMat.uniforms.sunDir.value.copy(sd);
  skyMat.uniforms.sunCol.value.setRGB(1, 0.75 + 0.2 * b, 0.45 + 0.4 * b).multiplyScalar(smooth(-0.1, 0.05, f));
  scene.fog.color.copy(skyMat.uniforms.hor.value);
  const fa = 450 + 600 * b; scene.fog.near = fa * 0.6; scene.fog.far = 1500 + 800 * b;
  hemi.intensity = 0.14 + 0.78 * b; hemi.color.setRGB(0.6 + 0.4 * b, 0.7 + 0.3 * b, 1);
  sun.intensity = 2.4 * l; sun.color.setRGB(1, 0.8 + 0.2 * b, 0.6 + 0.4 * b);
  const f0 = mode === 'car' ? car : person; sun.position.set(f0.x + sd.x * 200, f0.y + Math.max(sd.y, 0.15) * 200, f0.z + sd.z * 200); sun.target.position.set(f0.x, f0.y, f0.z);
  night = 1 - b; stars.material.opacity = clamp(1 - a * 1.4, 0, 1);
  const ei = 0.06 + 0.5 * b; for (const t of tiles.values()) if (t.mat) t.mat.emissiveIntensity = ei;
  for (const sp of car.spots) sp.intensity = night > 0.35 ? 1600 * night : 0;
}

/* ---------------- game flow ---------------- */
let wp = null, pendingSnap = false, spawnMode = 'car', coins = LS.get('au_coins', 0), carNear = false;
let placeTimer = 0, lastGeo = { x: 1e9, z: 1e9 }, toastT = 0;
function toast(msg, ms = 2400) { const el = $('toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), ms); }
function nearestRoad(x, z, maxR) {
  let best = null, bd = maxR * maxR;
  for (const t of tiles.values()) for (const ln of t.lines) {
    if (x < ln.minx - maxR || x > ln.maxx + maxR || z < ln.minz - maxR || z > ln.maxz + maxR) continue;
    const f = ln.f;
    for (let i = 0; i < f.length - 2; i += 2) {
      const ax = f[i], az = f[i + 1], bx = f[i + 2], bz = f[i + 3], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const u = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), px = ax + dx * u, pz = az + dz * u, d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bd) { bd = d; const l = Math.sqrt(l2); best = { x: px, z: pz, dx: dx / l, dz: dz / l, d: Math.sqrt(d) }; }
    }
  }
  return best;
}
function placeCarAt(r) { car.x = r.x; car.z = r.z; car.yaw = Math.atan2(-r.dx, -r.dz); car.vx = car.vz = car.vy = 0; car.y = heightAt(r.x, r.z); car.speed = 0; car.steer = 0; }
function trySnap() {
  pendingSnap = false;
  const px = mode === 'foot' ? person.x : car.x, pz = mode === 'foot' ? person.z : car.z;
  const r = nearestRoad(px, pz, 500);
  if (r) {
    if (mode === 'foot') { placeCarAt({ x: r.x + r.dz * 3, z: r.z - r.dx * 3, dx: r.dx, dz: r.dz }); toast('Your SUV is parked at the nearest road · ' + Math.round(r.d) + ' m away'); }
    else { placeCarAt(r); camYaw = car.yaw; }
  }
}
function newWaypoint() {
  const fx = mode === 'foot' ? person.x : car.x, fz = mode === 'foot' ? person.z : car.z;
  for (let n = 0; n < 40; n++) {
    const a = Math.random() * 6.283, d = 600 + Math.random() * 800, x = fx + Math.cos(a) * d, z = fz + Math.sin(a) * d, [tx, ty] = frame.tileAt(x, z), t = tiles.get(tx + ',' + ty);
    if (!t || !t.g || waterAt(x, z) || solidAt(x, z)) continue;
    wp = { x, z }; const y = heightAt(x, z); beacon.position.set(x, y + 300, z); ring.position.set(x, y + 1, z); beacon.visible = ring.visible = true; return;
  }
  wp = null; beacon.visible = ring.visible = false;
}
function toggleCar() {
  if (mode === 'car') {
    mode = 'foot'; const rx = Math.cos(car.yaw), rz = -Math.sin(car.yaw);
    let x = car.x + rx * 2.6, z = car.z + rz * 2.6; if (solidAt(x, z)) { x = car.x - rx * 2.6; z = car.z - rz * 2.6; }
    person.x = x; person.z = z; person.y = heightAt(x, z); person.vx = person.vz = person.vy = 0; person.yaw = car.yaw; person.grounded = true; car.vx = car.vz = 0; car.speed = 0;
  } else {
    if (Math.hypot(person.x - car.x, person.z - car.z) > 7) { toast('Get closer to your SUV (cyan marker)'); return; }
    mode = 'car'; camYaw = car.yaw;
  }
  document.querySelector('#bA').innerHTML = mode === 'car' ? 'BRAKE<br>HAND' : 'JUMP'; $('bB').innerHTML = mode === 'car' ? 'NITRO' : 'RUN';
}
function recover() {
  if (journey && !journey.done) { const [la, lo] = frame.toLatLon(mode === 'car' ? car.x : person.x, mode === 'car' ? car.z : person.z), g = nearestAlong(journey.route, la, lo); if (g.dist > 600) { relocateAlong(g.along, 'Back to the route…'); } else { placeOnRoute(g.along); toast('Back on the route'); } return; }
  const x = mode === 'car' ? car.x : person.x, z = mode === 'car' ? car.z : person.z, r = nearestRoad(x, z, 800); if (r) { placeCarAt(r); if (mode === 'foot') { person.x = r.x + 3; person.z = r.z; person.y = heightAt(person.x, person.z); } toast('Recovered to the nearest road'); } else { car.vx = car.vz = car.vy = 0; car.speed = 0; car.y = heightAt(car.x, car.z); toast('No road nearby · levelled the SUV'); } }
function pickupCheck() {
  if (!wp || journey) return;
  const x = mode === 'car' ? car.x : person.x, z = mode === 'car' ? car.z : person.z;
  if (Math.hypot(wp.x - x, wp.z - z) < 28) { const gain = 50 + Math.round(Math.hypot(wp.x - x, wp.z - z) * 0 + 40); coins += gain; LS.set('au_coins', coins); toast('📍 Waypoint reached! +' + gain + ' coins'); newWaypoint(); }
}
async function reverseGeocode() {
  const [lat, lon] = frame.toLatLon(mode === 'car' ? car.x : person.x, mode === 'car' ? car.z : person.z);
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&accept-language=en&lat=${lat}&lon=${lon}`); if (!r.ok) return;
    const j = await r.json(), a = j.address || {}; const n = a.village || a.town || a.city || a.suburb || a.county || a.state_district || j.name || 'Unknown';
    $('pn').textContent = [n, a.state || a.region, a.country].filter(Boolean).join(', ');
  } catch (e) {}
}
function solarHour(lon) { const d = new Date(); return (d.getUTCHours() + d.getUTCMinutes() / 60 + lon / 15 + 24) % 24; }

/* Long journeys: keep coordinates small by moving the local origin (floating origin). Nothing is reloaded. */
function rebase() {
  const f0 = mode === 'car' ? car : person, [lat, lon] = frame.toLatLon(f0.x, f0.z), nf = new Frame(lat, lon);
  const conv = o => { const [la, lo] = frame.toLatLon(o.x, o.z), [x, z] = nf.toWorld(la, lo); o.x = x; o.z = z; };
  conv(car); conv(person); if (wp) conv(wp);
  for (const t of tiles.values()) {
    const nr = nf.tileRect(t.tx, t.ty), ox = nr.x - t.rect.x, oz = nr.z - t.rect.z;
    t.group.position.x += ox; t.group.position.z += oz;
    for (const sd of t.solids || []) { for (let i = 0; i < sd.pts.length; i += 2) { sd.pts[i] += ox; sd.pts[i + 1] += oz; } sd.minx += ox; sd.maxx += ox; sd.minz += oz; sd.maxz += oz; }
    for (const ln of t.lines) { for (let i = 0; i < ln.f.length; i += 2) { ln.f[i] += ox; ln.f[i + 1] += oz; } ln.minx += ox; ln.maxx += ox; ln.minz += oz; ln.maxz += oz; }
    t.rect = nr;
  }
  frame = nf; rebuildHash(); camReset = true; routeTick = 99;
  if (beacon.visible && wp && !journey) { const y = heightAt(wp.x, wp.z); beacon.position.set(wp.x, y + 300, wp.z); ring.position.set(wp.x, y + 1, wp.z); }
}
async function enterRegion(lat, lon, label) {
  initAudio(); playing = false; $('menu').hidden = true; $('loading').hidden = false; $('ltxt').textContent = 'Loading real terrain…'; $('lsub').textContent = label || (lat.toFixed(4) + ', ' + lon.toFixed(4));
  resetWorld(lat, lon); ensureTiles(0, 0);
  const t0 = performance.now(); let tile;
  while (performance.now() - t0 < 30000) { tile = tiles.get(centerKey); $('lsub').textContent = `${[...tiles.values()].filter(t => t.g).length}/9 terrain tiles`; if (tile && tile.g) break; await sleep(150); }
  lastH = heightAt(0, 0);
  $('ltxt').textContent = 'Finding roads and buildings…';
  const t1 = performance.now(); while (tile && !tile.osmDone && performance.now() - t1 < 9000) await sleep(150);
  return tile;
}
function setButtons() { document.querySelector('#bA').innerHTML = mode === 'car' ? 'BRAKE<br>HAND' : 'JUMP'; $('bB').innerHTML = mode === 'car' ? 'NITRO' : 'RUN'; }
function goLive() { $('loading').hidden = true; $('hud').hidden = false; $('touch').hidden = !TOUCH; playing = true; placeTimer = 0; lastGeo = { x: 1e9, z: 1e9 }; $('bResume').hidden = false; camReset = true; setButtons(); }
async function startAt(lat, lon, asMode, label) {
  journey = null; clearRoute(); LS.set('au_last', { lat, lon, label: label || '' });
  gameHour = solarHour(lon); car.nitro = 1; mode = asMode; person.x = person.z = 0; person.vx = person.vz = 0; car.x = 4; car.z = 0; car.vx = car.vz = car.speed = 0; car.yaw = 0;
  await enterRegion(lat, lon, label);
  const h = heightAt(0, 0); person.y = h; car.y = h; pendingSnap = false; trySnap();
  camYaw = mode === 'car' ? car.yaw : 0; camPitch = 0.28; newWaypoint(); goLive();
  $('pn').textContent = label || 'Exploring…';
  toast(mode === 'foot' ? 'You are on foot at your real location · press E near your SUV' : 'Welcome to ' + (label || 'the real world') + ' · follow the yellow beacon');
}

/* ---------------- road trip: real road routes ---------------- */
let journey = null, routeMesh = null, routeTick = 0, saveT = 0, skipping = false;
const routeMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
const rw = i => [(journey.route.mx[i] - frame.mx0) * frame.k, -(journey.route.my[i] - frame.my0) * frame.k];
function routeAt(along) {
  const r = journey.route, c = r.cum; along = clamp(along, 0, r.total); let lo = 0, hi = r.n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= along) lo = m; else hi = m; }
  const a = rw(lo), b = rw(hi), seg = c[hi] - c[lo] || 1, u = clamp((along - c[lo]) / seg, 0, 1), dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
  return { x: a[0] + dx * u, z: a[1] + dz * u, dx: dx / l, dz: dz / l, i: lo };
}
function clearRoute() { if (routeMesh) { scene.remove(routeMesh); routeMesh.geometry.dispose(); routeMesh = null; } ['bAuto', 'bSkip'].forEach(i => $(i).hidden = true); $('pb').hidden = true; }
function placeOnRoute(along) {
  const J = journey, p = routeAt(along);
  car.x = p.x; car.z = p.z; car.yaw = Math.atan2(-p.dx, -p.dz); car.vx = car.vz = car.vy = car.speed = 0; car.steer = 0; car.y = heightAt(p.x, p.z); car.grounded = true;
  person.x = p.x + 3; person.z = p.z; person.y = car.y; J.ri = p.i; J.along = along; routeTick = 99; mode = 'car'; setButtons();
}
function updateRoute(dt) {
  const J = journey; if (!J) return; const r = J.route, px = mode === 'car' ? car.x : person.x, pz = mode === 'car' ? car.z : person.z;
  let best = 1e18, bi = J.ri, bu = 0; const lo = Math.max(0, J.ri - 25), hi = Math.min(r.n - 2, J.ri + 300); let a = rw(lo);
  for (let i = lo; i <= hi; i++) {
    const b = rw(i + 1), dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, u = clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / l2, 0, 1), qx = a[0] + dx * u - px, qz = a[1] + dz * u - pz, d = qx * qx + qz * qz;
    if (d < best) { best = d; bi = i; bu = u; } a = b;
  }
  J.ri = bi; J.off = Math.sqrt(best); J.along = r.cum[bi] + (r.cum[bi + 1] - r.cum[bi]) * bu; J.remaining = r.total - J.along;
  if (J.off < 80) J.progress = Math.max(J.progress, J.along);
  const p = routeAt(J.along + 90); wp = { x: p.x, z: p.z };
  if (J.remaining < 3000) { const e = routeAt(r.total), y = heightAt(e.x, e.z); beacon.position.set(e.x, y + 300, e.z); ring.position.set(e.x, y + 1, e.z); beacon.visible = ring.visible = true; } else beacon.visible = ring.visible = false;
  if (J.remaining < 70 && !J.done) {
    J.done = true; J.auto = false; const gain = 500 + Math.round(J.driven / 1000 * 8); coins += gain; LS.set('au_coins', coins); LS.set('au_prog', null);
    toast(`🏁 Arrived in ${J.to.n}! You drove ${(J.driven / 1000).toFixed(0)} km · +${gain} coins`, 6000);
  }
}
function buildRouteRibbon() {
  const J = journey; if (!J) return; const pts = [];
  for (let a = Math.max(0, J.along - 15); a <= Math.min(J.route.total, J.along + 3200); a += 14) {
    const p = routeAt(a), [tx, ty] = frame.tileAt(p.x, p.z), t = tiles.get(tx + ',' + ty); if (!t || !t.g) break; pts.push([p.x, p.z]);
  }
  if (routeMesh) { scene.remove(routeMesh); routeMesh.geometry.dispose(); routeMesh = null; }
  if (pts.length < 2) return;
  routeMesh = new THREE.Mesh(buildRoads([{ pts, w: 3.4, c: [0.15, 0.9, 1] }], heightAt), routeMat); routeMesh.position.y = 0.3; routeMesh.frustumCulled = false; scene.add(routeMesh);
}
function autoInput() {
  const J = journey, L = 14 + Math.abs(car.speed) * 0.9, t1 = routeAt(J.along + L), t2 = routeAt(J.along + L * 3);
  const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = -Math.sin(car.yaw);
  const ang = Math.atan2((t1.x - car.x) * rx + (t1.z - car.z) * rz, (t1.x - car.x) * fx + (t1.z - car.z) * fz);
  const a2 = Math.atan2((t2.x - car.x) * rx + (t2.z - car.z) * rz, (t2.x - car.x) * fx + (t2.z - car.z) * fz);
  let target = 23 * (1 - clamp(Math.abs(a2) / 1.2, 0, 0.7)) * (1 - clamp(Math.abs(ang) / 1.0, 0, 0.6)); target = Math.max(6, target);
  return { mx: clamp(ang * 1.6, -1, 1), my: clamp((target - car.speed) * 0.35, -1, 1), hand: false, jump: false, boost: false };
}
function toggleAuto() {
  const J = journey; if (!J || J.done) return; if (mode !== 'car') { toast('Get in your SUV first (E)'); return; }
  J.auto = !J.auto; $('bAuto').style.outline = J.auto ? '2px solid #FCDD09' : ''; toast(J.auto ? '🤖 Autopilot on · touch any control to take over' : 'Manual control');
}
async function relocateAlong(along, label) {
  const J = journey, ll = pointAlong(J.route, along); J.auto = false; $('bAuto').style.outline = '';
  await enterRegion(ll.lat, ll.lon, label); placeOnRoute(along); gameHour = solarHour(ll.lon); camYaw = car.yaw; camPitch = 0.26; goLive();
}
async function skipAhead(m = 25000) {
  const J = journey; if (!J || J.done || skipping) return; skipping = true;
  const target = Math.min(J.route.total - 400, J.along + m);
  if (target < J.along + 800) { toast('Almost there!'); skipping = false; return; }
  await relocateAlong(target, 'Driving ahead on the road…'); J.progress = Math.max(J.progress, target); toast('⏭ Skipped ahead · ' + (J.remaining / 1000).toFixed(0) + ' km to go'); skipping = false;
}
async function startJourney(route, from, to, progress = 0, driven = 0) {
  journey = { route, from, to, ri: 0, along: progress, progress, remaining: route.total - progress, driven, done: false, auto: false, off: 0 };
  beacon.visible = ring.visible = false; wp = null;
  const ll = pointAlong(route, progress); LS.set('au_last', { lat: ll.lat, lon: ll.lon, label: from.n });
  await enterRegion(ll.lat, ll.lon, `${from.n} → ${to.n}`);
  placeOnRoute(progress); gameHour = solarHour(ll.lon); car.nitro = 1; camYaw = car.yaw; camPitch = 0.26; goLive();
  ['bAuto', 'bSkip'].forEach(i => $(i).hidden = false); $('bAuto').style.outline = ''; $('pb').hidden = false; $('pn').textContent = from.n;
  const hrs = route.time / 3600; toast(`🛣 ${from.n} → ${to.n} · ${(route.total / 1000).toFixed(0)} km by road${hrs ? ' · about ' + Math.floor(hrs) + ' h ' + Math.round((hrs % 1) * 60) + ' min' : ''}. Follow the cyan line · P autopilot · K skip`, 6500);
}
async function planAndStart(a, b) {
  $('menu').hidden = true; $('loading').hidden = false; $('ltxt').textContent = 'Finding the real road…'; $('lsub').textContent = `${a.n} → ${b.n}`; playing = false;
  const r = await fetchRoute(a, b);
  if (!r) { $('loading').hidden = true; $('menu').hidden = false; $('planInfo').textContent = 'Could not find a road route between those places. Try places that are connected by road.'; return; }
  LS.set('au_route', serializeRoute(r)); LS.set('au_trip', { a, b }); LS.set('au_prog', { along: 0, driven: 0 });
  await startJourney(r, a, b, 0, 0);
}

/* ---------------- menu ---------------- */
function openMenu() { playing = false; $('menu').hidden = false; $('bResume').hidden = false; for (const k in keys) keys[k] = false; }
$('bResume').onclick = () => { $('menu').hidden = true; playing = true; };
const pr = $('presets');
PRESETS.forEach(p => { const b = document.createElement('button'); b.innerHTML = `${p.n}<small>${p.d}</small>`; b.onclick = () => startAt(p.lat, p.lon, 'car', p.n); pr.appendChild(b); });
$('bGps').onclick = () => {
  if (!navigator.geolocation) { toast('GPS is not available · starting in Addis Ababa'); startAt(9.0107, 38.7612, 'car', 'Addis Ababa'); return; }
  $('bGps').textContent = '📍 Finding you…';
  navigator.geolocation.getCurrentPosition(p => { $('bGps').textContent = '📍 Start at my real location'; startAt(p.coords.latitude, p.coords.longitude, 'foot', 'Your location'); },
    () => { $('bGps').textContent = '📍 Start at my real location'; $('results').innerHTML = '<div class="hint">Location permission denied. Allow it in your browser, or search for a place below.</div>'; },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
};
const last = LS.get('au_last', null); if (last) { $('bCont').hidden = false; $('bCont').textContent = '↩ Continue: ' + (last.label || last.lat.toFixed(3) + ', ' + last.lon.toFixed(3)); $('bCont').onclick = () => startAt(last.lat, last.lon, 'car', last.label); }
async function search() {
  const q = $('q').value.trim(); if (!q) return; const box = $('results'); box.innerHTML = '<div class="hint">Searching…</div>';
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=en&q=' + encodeURIComponent(q)), j = await r.json();
    box.innerHTML = ''; if (!j.length) { box.innerHTML = '<div class="hint">Nothing found. Try another name.</div>'; return; }
    j.forEach(x => { const b = document.createElement('button'); b.textContent = '📌 ' + x.display_name; b.onclick = () => startAt(+x.lat, +x.lon, 'car', x.display_name.split(',').slice(0, 2).join(',')); box.appendChild(b); });
  } catch (e) { box.innerHTML = '<div class="hint">Search needs an internet connection.</div>'; }
}
const TRIPS = [
  { main: true, a: { n: 'Addis Ababa', lat: 9.0107, lon: 38.7612 }, b: { n: 'Lalibela', lat: 12.0317, lon: 39.0473 } },
  { a: { n: 'Addis Ababa', lat: 9.0107, lon: 38.7612 }, b: { n: 'Bahir Dar', lat: 11.5936, lon: 37.3910 } },
  { a: { n: 'Bahir Dar', lat: 11.5936, lon: 37.3910 }, b: { n: 'Gondar', lat: 12.6070, lon: 37.4690 } },
  { a: { n: 'Lalibela', lat: 12.0317, lon: 39.0473 }, b: { n: 'Axum', lat: 14.1306, lon: 38.7185 } }
];
TRIPS.forEach(t => { const b = document.createElement('button'); b.innerHTML = `${t.a.n} → ${t.b.n}<small>real road trip</small>`; if (t.main) { b.style.gridColumn = '1 / -1'; b.style.background = 'linear-gradient(90deg,#078930,#0aa43a)'; b.style.fontWeight = '700'; } b.onclick = () => planAndStart(t.a, t.b); $('trips').appendChild(b); });
const sel = { from: null, to: null };
const geocode = async q => (await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=en&q=' + encodeURIComponent(q))).json();
function placeFinder(inp, box, key) {
  return async () => {
    const q = inp.value.trim(); if (!q) return; box.innerHTML = '<div class="hint">Searching…</div>';
    try {
      const j = await geocode(q); box.innerHTML = ''; if (!j.length) { box.innerHTML = '<div class="hint">Nothing found.</div>'; return; }
      j.forEach(x => { const b = document.createElement('button'); b.textContent = '📌 ' + x.display_name; b.onclick = () => { sel[key] = { n: x.display_name.split(',')[0], lat: +x.lat, lon: +x.lon }; inp.value = sel[key].n; box.innerHTML = ''; }; box.appendChild(b); });
    } catch (e) { box.innerHTML = '<div class="hint">Search needs an internet connection.</div>'; }
  };
}
$('bFrom').onclick = placeFinder($('qFrom'), $('rFrom'), 'from'); $('bTo').onclick = placeFinder($('qTo'), $('rTo'), 'to');
$('qFrom').addEventListener('keydown', e => { if (e.key === 'Enter') $('bFrom').onclick(); }); $('qTo').addEventListener('keydown', e => { if (e.key === 'Enter') $('bTo').onclick(); });
$('bFromGps').onclick = () => { if (!navigator.geolocation) return; navigator.geolocation.getCurrentPosition(p => { sel.from = { n: 'My location', lat: p.coords.latitude, lon: p.coords.longitude }; $('qFrom').value = 'My location'; }, () => { $('planInfo').textContent = 'Location permission denied.'; }, { enableHighAccuracy: true, timeout: 15000 }); };
async function resolvePlace(inp, key) {
  const q = inp.value.trim(); if (!q) return null; if (sel[key] && sel[key].n === q) return sel[key];
  try { const j = await geocode(q); if (j[0]) return (sel[key] = { n: j[0].display_name.split(',')[0], lat: +j[0].lat, lon: +j[0].lon }); } catch (e) {} return null;
}
$('bPlan').onclick = async () => {
  $('planInfo').textContent = 'Looking up places…'; const a = await resolvePlace($('qFrom'), 'from'), b = await resolvePlace($('qTo'), 'to');
  if (!a || !b) { $('planInfo').textContent = 'Enter both a start and a destination.'; return; } $('planInfo').textContent = ''; planAndStart(a, b);
};
{ const trip = LS.get('au_trip', null), rt = LS.get('au_route', null), pg = LS.get('au_prog', null);
  if (trip && rt && pg) { $('bJResume').hidden = false; $('bJResume').textContent = `↩ Resume: ${trip.a.n} → ${trip.b.n}`; $('bJResume').onclick = () => startJourney(deserializeRoute(rt), trip.a, trip.b, pg.along, pg.driven); } }
$('bSearch').onclick = search; $('q').addEventListener('keydown', e => { if (e.key === 'Enter') search(); });

/* ---------------- HUD / minimap ---------------- */
const mini = $('mini'), mctx = mini.getContext('2d'); let miniT = 0;
function drawMini() {
  const W = mini.width, h = W / 2, sc = h / 450, px = mode === 'car' ? car.x : person.x, pz = mode === 'car' ? car.z : person.z;
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  const P = (x, z) => { const dx = x - px, dz = z - pz; return [h + (dx * rx + dz * rz) * sc, h - (dx * fx + dz * fz) * sc]; };
  mctx.clearRect(0, 0, W, W); mctx.save(); mctx.beginPath(); mctx.arc(h, h, h - 2, 0, 6.283); mctx.clip();
  mctx.fillStyle = 'rgba(30,50,40,.75)'; mctx.fillRect(0, 0, W, W);
  mctx.lineCap = 'round'; mctx.strokeStyle = '#d9d2c0';
  for (const t of tiles.values()) for (const ln of t.lines) {
    if (ln.maxx < px - 460 || ln.minx > px + 460 || ln.maxz < pz - 460 || ln.minz > pz + 460) continue;
    mctx.lineWidth = ln.major ? 5 : 3; mctx.beginPath(); for (let i = 0; i < ln.f.length; i += 2) { const [x, y] = P(ln.f[i], ln.f[i + 1]); i ? mctx.lineTo(x, y) : mctx.moveTo(x, y); } mctx.stroke();
  }
  if (journey) { const J = journey; mctx.strokeStyle = '#2ee6ff'; mctx.lineWidth = 7; mctx.beginPath(); for (let i = Math.max(0, J.ri - 60), e = Math.min(J.route.n - 1, J.ri + 500); i <= e; i++) { const q = rw(i), [x, y] = P(q[0], q[1]); i === Math.max(0, J.ri - 60) ? mctx.moveTo(x, y) : mctx.lineTo(x, y); } mctx.stroke(); }
  if (wp && !journey) { const [x, y] = P(wp.x, wp.z), dx = x - h, dy = y - h, m = Math.hypot(dx, dy), k = m > h - 14 ? (h - 14) / m : 1; mctx.fillStyle = '#ffd23c'; mctx.beginPath(); mctx.arc(h + dx * k, h + dy * k, 9, 0, 6.283); mctx.fill(); }
  if (mode === 'foot') { const [x, y] = P(car.x, car.z); mctx.fillStyle = '#20e0ff'; mctx.fillRect(x - 6, y - 6, 12, 12); }
  mctx.restore(); mctx.save(); mctx.translate(h, h); mctx.rotate((mode === 'car' ? car.yaw : person.yaw) - camYaw); mctx.fillStyle = '#fff'; mctx.strokeStyle = '#078930'; mctx.lineWidth = 3;
  mctx.beginPath(); mctx.moveTo(0, -14); mctx.lineTo(10, 11); mctx.lineTo(0, 6); mctx.lineTo(-10, 11); mctx.closePath(); mctx.fill(); mctx.stroke(); mctx.restore();
}
function updateHUD(dt) {
  let wpText = '';
  const x = mode === 'car' ? car.x : person.x, z = mode === 'car' ? car.z : person.z, [lat, lon] = frame.toLatLon(x, z);
  $('coord').textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)} · ${Math.round(mode === 'car' ? car.y : person.y)} m`;
  $('coins').textContent = coins; const hh = Math.floor(gameHour), mm = Math.floor((gameHour - hh) * 60); $('clock').textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  $('kmh').textContent = Math.round(Math.abs(mode === 'car' ? car.speed : person.speed) * 3.6); $('nit').style.transform = `scaleX(${car.nitro})`;
  if (wp) {
    const dx = wp.x - x, dz = wp.z - z, f = [-Math.sin(camYaw), -Math.cos(camYaw)], r = [Math.cos(camYaw), -Math.sin(camYaw)];
    $('arrow').style.transform = `rotate(${Math.atan2(dx * r[0] + dz * r[1], dx * f[0] + dz * f[1])}rad)`; const d = Math.hypot(dx, dz); wpText = d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m';
  } else wpText = 'No waypoint';
  if (journey) { const J = journey; $('dist').textContent = J.done ? '🏁 Arrived in ' + J.to.n : (J.remaining / 1000).toFixed(1) + ' km to ' + J.to.n + (J.off > 150 ? ' · off route (R)' : ''); $('pb').firstChild.style.width = (100 * clamp(J.progress / J.route.total, 0, 1)) + '%'; }
  else $('dist').textContent = wpText + (mode === 'foot' ? ' · SUV ' + Math.round(Math.hypot(person.x - car.x, person.z - car.z)) + ' m' : '');
  miniT += dt; if (miniT > 0.16) { miniT = 0; drawMini(); }
}

/* ---------------- main loop ---------------- */
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let acc = 0, prev = performance.now(), shake = 0, frameN = 0, camReset = true;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - prev) / 1000); prev = now; frameN++;
  if (playing) {
    let inp = getInput(); acc += dt;
    if (journey && journey.auto && mode === 'car') { if (Math.abs(inp.mx) > 0.25 || inp.my !== 0 || inp.hand) { journey.auto = false; $('bAuto').style.outline = ''; toast('Manual control'); } else inp = autoInput(); }
    while (acc >= 1 / 60) {
      acc -= 1 / 60;
      if (mode === 'car') { stepCar(car, inp, 1 / 60, env); if (car.hit > 0.2) shake = Math.max(shake, car.hit); }
      else { stepFoot(person, inp, 1 / 60, env, camYaw); stepCar(car, { mx: 0, my: 0, hand: true }, 1 / 60, env); }
    }
    lastH = mode === 'car' ? car.y : person.y;
    if (journey) {
      if (mode === 'car') journey.driven += Math.abs(car.speed) * dt;
      if (frameN % 5 === 0) updateRoute(dt);
      routeTick += dt; if (routeTick > 1.5 && !skipping) { routeTick = 0; buildRouteRibbon(); }
      saveT += dt; if (saveT > 8 && !journey.done) { saveT = 0; LS.set('au_prog', { along: journey.progress, driven: journey.driven }); }
    }
    if (frameN % 30 === 0 && Math.hypot(mode === 'car' ? car.x : person.x, mode === 'car' ? car.z : person.z) > 7000) rebase();
    if (frameN % 20 === 0) ensureTiles(mode === 'car' ? car.x : person.x, mode === 'car' ? car.z : person.z);
    if (frameN % 6 === 0) pickupCheck();
    gameHour = (gameHour + dt * TIMES[timeIdx] / 3600) % 24;
    placeTimer += dt;
    if (placeTimer > 25) { const x = mode === 'car' ? car.x : person.x, z = mode === 'car' ? car.z : person.z; if (Math.hypot(x - lastGeo.x, z - lastGeo.z) > 250 || placeTimer > 120) { placeTimer = 0; lastGeo = { x, z }; reverseGeocode(); } }
    updateAudio(inp.my);
    /* camera */
    if (mode === 'car') { camIdle += dt; if (!drag && camIdle > 1.2) { let d = car.yaw - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); camYaw += d * Math.min(1, dt * 3); camPitch += (0.26 - camPitch) * Math.min(1, dt * 2); } }
    const tgt = mode === 'car' ? car : person, dist = (mode === 'car' ? camDist + Math.abs(car.speed) * 0.07 : camDist * 0.62), lookH = mode === 'car' ? 1.5 : 1.4;
    const cp = Math.cos(camPitch), wantX = tgt.x + Math.sin(camYaw) * dist * cp, wantZ = tgt.z + Math.cos(camYaw) * dist * cp, wantY = tgt.y + lookH + Math.sin(camPitch) * dist + 0.8;
    if (camReset) { camPos.set(wantX, wantY, wantZ); camReset = false; } else { const k = Math.min(1, dt * (mode === 'car' ? 7 : 9)); camPos.x += (wantX - camPos.x) * k; camPos.y += (wantY - camPos.y) * k; camPos.z += (wantZ - camPos.z) * k; }
    camPos.y = Math.max(camPos.y, heightAt(camPos.x, camPos.z) + 1.2);
    shake *= Math.pow(0.02, dt);
    camera.position.set(camPos.x + (Math.random() - 0.5) * shake * 0.5, camPos.y + (Math.random() - 0.5) * shake * 0.5, camPos.z);
    camLook.set(tgt.x, tgt.y + lookH, tgt.z); camera.lookAt(camLook);
    camera.fov = 62 + Math.min(14, Math.abs(car.speed) * 0.28) * (mode === 'car' ? 1 : 0); camera.updateProjectionMatrix();
    updateSky(); updateHUD(dt);
  }
  /* models */
  carGroup.position.set(car.x, car.y + (car.water ? -0.2 : 0), car.z); carGroup.rotation.set(car.pitch, car.yaw, car.roll);
  for (const w of wheels) { w.w.rotation.x = -car.wheel; if (w.front) w.piv.rotation.y = -car.steer * 0.45; }
  personGroup.visible = mode === 'foot'; if (mode === 'foot') {
    personGroup.position.set(person.x, person.y, person.z); personGroup.rotation.y = person.yaw;
    const sw = Math.sin(person.anim) * Math.min(1, person.speed / 3) * 0.9; limbs.l1.rotation.x = sw; limbs['l-1'].rotation.x = -sw; limbs.a1.rotation.x = -sw; limbs['a-1'].rotation.x = sw;
    carMark.visible = true; carMark.position.set(car.x, car.y + 5.2 + Math.sin(now / 250) * 0.4, car.z); carMark.rotation.y = now / 600;
  } else carMark.visible = false;
  if (beacon.visible) { ring.scale.setScalar(1 + Math.sin(now / 300) * 0.08); beacon.material.opacity = 0.22 + Math.sin(now / 400) * 0.07; }
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
window.__au = { startAt, car, person, tiles, heightAt, rebase, planAndStart, skipAhead, toggleAuto, relocateAlong, get frame() { return frame; }, get journey() { return journey; } };
