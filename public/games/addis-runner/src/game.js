import { buildTrack, WAYPOINTS } from './route.js';

const $ = (id) => document.getElementById(id), cv = $('c'), g = cv.getContext('2d');
let W, H, HOR;
const fit = () => { const d = Math.min(devicePixelRatio || 1, 2); W = cv.width = innerWidth * d; H = cv.height = innerHeight * d; HOR = H * 0.42; };
addEventListener('resize', fit); fit();

const SEG = 200, CAMH = 1000, CAMD = 0.84, ROADW = 1200, N = 70, LANE = 800, PZ = 1000;
const FLAG = ['#078930', '#FCDD09', '#DA121A'];                      // Ethiopian colours on the kerbs
const SKIN = ['#d9a066', '#c68642', '#8d5524'];
const THEME = [                                                        // old city / centre / Bole
  { wall: ['#c9a27a', '#b5835a', '#d9b98c', '#a67c52'], h: [400, 900], grass: ['#7a8a4a', '#6f7f43'] },
  { wall: ['#d8d2c4', '#9fb4c7', '#c0c6cc', '#e0c9a6'], h: [800, 2000], grass: ['#8a8f6a', '#80855f'] },
  { wall: ['#5b8fb9', '#7aa7c7', '#4a6f8f', '#9bb7cf'], h: [1400, 3600], grass: ['#7f9a6a', '#74905f'] },
];
const hash = (n) => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return (n ^ (n >>> 16)) >>> 0; };

let T, OBJ, source = 'built-in route (approximate)', best = 0;
try { best = +localStorage.getItem('addis-best') || 0; } catch { /* storage unavailable */ }

async function loadRoute() {
  try {
    const r = await fetch('data/route.json');
    if (r.ok) { const j = await r.json(); if (j.points?.length > 20) { source = j.source; return buildTrack(j.points, j.landmarks); } }
  } catch { /* no fetched route: use the built-in one */ }
  return buildTrack(WAYPOINTS.map((w) => [w[0], w[1]]), WAYPOINTS.map((w) => ({ lat: w[0], lon: w[1], name: w[2], zone: w[3] })));
}

function makeObjects(n) {                                              // obstacles + coins, same every lap
  const m = new Map(); let seed = 7, id = 0;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const add = (s, o) => { if (!m.has(s)) m.set(s, []); m.get(s).push({ ...o, id: id++ }); };
  for (let s = 40; s < n - 6;) {
    const r = rnd(), lane = Math.floor(rnd() * 3) - 1;
    if (r < 0.34) { add(s, { type: 'taxi', lane }); if (rnd() < 0.4) add(s, { type: 'taxi', lane: lane === 1 ? 0 : lane + 1 }); }
    else if (r < 0.54) add(s, { type: 'goat', lane });
    else if (r < 0.7) add(s, { type: 'bar', lane: 0 });
    else { for (let k = 0; k < 5; k++) add(s + k, { type: 'coin', lane }); s += 4; }
    s += 6 + Math.floor(rnd() * 7);
  }
  return m;
}

const st = { z: 0, speed: 0, px: 0, lane: 0, jy: 0, vy: 0, slide: 0, t: 0, coins: 0, alive: false, bg: 0 };
const start = () => { Object.assign(st, { z: 0, speed: 1500, px: 0, lane: 0, jy: 0, vy: 0, slide: 0, t: 0, coins: 0, alive: true }); $('ov').style.display = 'none'; };
const over = (why) => {
  st.alive = false; const m = Math.floor((st.z * T.segM) / SEG);
  if (m > best) { best = m; try { localStorage.setItem('addis-best', String(m)); } catch { /* ignore */ } }
  $('ov').style.display = 'flex'; $('ov').querySelector('h1').textContent = why;
  $('ov').querySelector('p').textContent = `${m} m run, ${st.coins} birr collected. Best ${best} m.`; $('go').textContent = 'Run again';
};

const act = {
  left: () => { st.lane = Math.max(-1, st.lane - 1); }, right: () => { st.lane = Math.min(1, st.lane + 1); },
  jump: () => { if (st.jy === 0) st.vy = 1500; }, slide: () => { st.slide = 0.6; if (st.jy > 0) st.vy = -1800; },
};
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (!st.alive) { if (k === 'enter' || k === ' ') start(); return; }
  if (k === 'arrowleft' || k === 'a') act.left(); else if (k === 'arrowright' || k === 'd') act.right();
  else if (k === 'arrowup' || k === 'w' || k === ' ') act.jump(); else if (k === 'arrowdown' || k === 's') act.slide();
});
let t0 = null;
addEventListener('touchstart', (e) => { t0 = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
addEventListener('touchend', (e) => {
  if (!t0 || !st.alive) return; const dx = e.changedTouches[0].clientX - t0[0], dy = e.changedTouches[0].clientY - t0[1]; t0 = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
  if (Math.abs(dx) > Math.abs(dy)) (dx < 0 ? act.left : act.right)(); else (dy < 0 ? act.jump : act.slide)();
}, { passive: true });
$('go').onclick = start;

function step(dt) {
  if (!st.alive) return;
  st.t += dt; st.speed = Math.min(1500 + st.t * 28, 4200);
  const old = Math.floor((st.z + PZ) / SEG); st.z += st.speed * dt; const cur = Math.floor((st.z + PZ) / SEG);
  st.px += (st.lane * LANE - st.px) * Math.min(1, dt * 10);
  if (st.jy > 0 || st.vy > 0) { st.vy -= 3800 * dt; st.jy = Math.max(0, st.jy + st.vy * dt); if (st.jy === 0) st.vy = 0; }
  st.slide = Math.max(0, st.slide - dt);
  st.bg += T.curve[Math.floor(st.z / SEG) % T.n] * st.speed * dt * 0.00004;
  for (let k = old + 1; k <= cur; k++) for (const o of OBJ.get(k % T.n) || []) {
    const inLane = Math.abs(st.px - o.lane * LANE) < 450;
    if (o.type === 'coin') { if (inLane && st.jy < 500) st.coins++; }
    else if (o.type === 'taxi' && inLane) return over('Hit a taxi!');
    else if (o.type === 'goat' && inLane && st.jy < 180) return over('Goat crossing!');
    else if (o.type === 'bar' && st.slide <= 0) return over('Bumped the bridge!');
  }
}

const quad = (x1, y1, w1, x2, y2, w2, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(x1 - w1, y1); g.lineTo(x1 + w1, y1); g.lineTo(x2 + w2, y2); g.lineTo(x2 - w2, y2); g.closePath(); g.fill(); };

function building(P, ai, side, th) {
  const h = hash(ai * 2 + (side > 0 ? 1 : 0)), bw = 900, bh = th.h[0] + (h % 1000) * ((th.h[1] - th.h[0]) / 1000);
  const X = side * (ROADW * 1.35 + (h % 5) * 100), s = P.sc, k = s * (W / 2);
  const x = W / 2 + s * (P.x + X - P.cam) * (W / 2), w = bw * k, hh = bh * k, y = P.sy;
  if (w < 3 || x + w < 0 || x - w > W) return;
  const left = side < 0 ? x - w : x;
  g.fillStyle = th.wall[(h >> 3) % 4]; g.fillRect(left, y - hh, w, hh);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(left, y - hh, w, Math.max(2, hh * 0.04));
  if (w > 18) {
    g.fillStyle = 'rgba(20,35,55,.55)'; const cols = 4, rows = Math.max(1, Math.min(14, Math.floor(bh / 260)));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g.fillRect(left + w * (0.1 + c * 0.22), y - hh + hh * (0.08 + r * (0.85 / rows)), w * 0.14, (hh / rows) * 0.42);
  }
}
function sign(P, name) {
  const s = P.sc, k = s * (W / 2), x = W / 2 + s * (P.x - ROADW * 1.25 - P.cam) * (W / 2), w = 1400 * k, hh = 700 * k, y = P.sy - 2200 * k;
  if (w < 20) return;
  g.fillStyle = '#0b5d2a'; g.fillRect(x - w, y, w, hh); g.fillStyle = '#FCDD09'; g.fillRect(x - w, y, w, hh * 0.08);
  g.fillStyle = '#fff'; g.font = `800 ${Math.max(8, hh * 0.38)}px system-ui`; g.textAlign = 'center'; g.fillText(name, x - w / 2, y + hh * 0.66);
  g.fillStyle = '#555'; g.fillRect(x - w * 0.55, y + hh, w * 0.1, 2200 * k - hh);
}
function thing(P, o) {
  const s = P.sc, k = s * (W / 2), x = W / 2 + s * (P.x + o.lane * LANE - P.cam) * (W / 2), y = P.sy;
  if (k * 700 < 2) return;
  if (o.type === 'taxi') {                                              // blue-and-white minibus
    const w = 700 * k, h = 640 * k; g.fillStyle = '#1f5fbf'; g.fillRect(x - w / 2, y - h * 0.62, w, h * 0.62);
    g.fillStyle = '#fff'; g.fillRect(x - w / 2, y - h, w, h * 0.38); g.fillStyle = '#2c3e55'; g.fillRect(x - w * 0.42, y - h * 0.94, w * 0.84, h * 0.24);
    g.fillStyle = '#111'; g.fillRect(x - w * 0.46, y - h * 0.1, w * 0.18, h * 0.12); g.fillRect(x + w * 0.28, y - h * 0.1, w * 0.18, h * 0.12);
  } else if (o.type === 'goat') {
    const w = 300 * k, h = 190 * k; g.fillStyle = '#e8e2d6'; g.fillRect(x - w / 2, y - h, w, h * 0.6); g.fillStyle = '#5a4630'; g.fillRect(x - w / 2, y - h * 1.15, w * 0.3, h * 0.45);
    g.fillRect(x - w * 0.4, y - h * 0.4, w * 0.1, h * 0.4); g.fillRect(x + w * 0.3, y - h * 0.4, w * 0.1, h * 0.4);
  } else if (o.type === 'bar') {                                        // LRT bridge: slide under it
    const w = ROADW * k, top = y - 760 * k, bot = y - 400 * k;
    g.fillStyle = '#777'; g.fillRect(x - w - 40 * k, top, 80 * k, y - top); g.fillRect(x + w - 40 * k, top, 80 * k, y - top);
    g.fillStyle = '#c9ccd1'; g.fillRect(x - w, top, w * 2, bot - top); g.fillStyle = '#FCDD09'; g.fillRect(x - w, bot - 40 * k, w * 2, 40 * k);
    g.fillStyle = '#10261a'; g.font = `800 ${Math.max(8, (bot - top) * 0.55)}px system-ui`; g.textAlign = 'center'; g.fillText('LRT', x, bot - (bot - top) * 0.25);
  } else {                                                              // coin (birr)
    const r = 95 * k, cy = y - (300 + Math.sin(st.t * 6 + o.id) * 25) * k; g.fillStyle = '#FCDD09'; g.beginPath(); g.arc(x, cy, r, 0, 7); g.fill();
    g.strokeStyle = '#b8960a'; g.lineWidth = Math.max(1, r * 0.2); g.stroke();
  }
}
function runner(cam) {
  const sc = CAMD / PZ, k = sc * (W / 2), x = W / 2 + sc * (st.px - cam) * (W / 2), y = HOR + sc * CAMH * (H / 2) - st.jy * k;
  const sl = st.slide > 0 && st.jy === 0, h = (sl ? 330 : 620) * k, w = 190 * k, ph = Math.sin(st.t * 15) * (st.jy > 0 ? 0.2 : 1);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, HOR + sc * CAMH * (H / 2), w * 0.9, w * 0.25, 0, 0, 7); g.fill();
  g.fillStyle = '#1b2a41'; g.fillRect(x - w * 0.42 + ph * w * 0.2, y - h * 0.4, w * 0.3, h * 0.4); g.fillRect(x + w * 0.12 - ph * w * 0.2, y - h * 0.4, w * 0.3, h * 0.4);
  FLAG.forEach((c, i) => { g.fillStyle = c; g.fillRect(x - w / 2, y - h * 0.9 + i * h * 0.17, w, h * 0.17); });
  g.fillStyle = SKIN[1]; g.beginPath(); g.arc(x, y - h * 0.97, w * 0.3, 0, 7); g.fill();
}

function draw() {
  const base = Math.floor(st.z / SEG), pct = (st.z % SEG) / SEG, cam = st.px * 0.5, th = THEME[T.zone[base % T.n]];
  const sky = g.createLinearGradient(0, 0, 0, HOR); sky.addColorStop(0, '#6fb6e8'); sky.addColorStop(1, '#f6e7c1');
  g.fillStyle = sky; g.fillRect(0, 0, W, HOR + 2);
  for (const [c, a, hgt, f] of [['#4d7f6a', 0.5, 0.2, 0.011], ['#2f5a3f', 0.8, 0.12, 0.02]]) {   // Entoto hills
    g.fillStyle = c; g.beginPath(); g.moveTo(0, HOR);
    for (let x = 0; x <= W; x += 12) g.lineTo(x, HOR - H * hgt * (0.55 + 0.45 * Math.sin((x + st.bg * W * a) * f / (W / 800) + a * 9)));
    g.lineTo(W, HOR); g.fill();
  }
  let x = 0, dx = -(T.curve[base % T.n] * pct); const P = [];
  for (let n = 0; n <= N; n++) {
    const dz = Math.max(60, (n - pct) * SEG), sc = CAMD / dz;
    P.push({ sc, x, cam, sx: W / 2 + sc * (x - cam) * (W / 2), sy: HOR + sc * CAMH * (H / 2), sw: sc * ROADW * (W / 2) });
    x += dx; dx += T.curve[(base + n) % T.n];
  }
  g.fillStyle = th.grass[0]; g.fillRect(0, HOR, W, H - HOR);
  for (let n = N - 1; n >= 0; n--) {
    const a = P[n], b = P[n + 1], ai = base + n, band = ai % 6 < 3;
    g.fillStyle = th.grass[band ? 0 : 1]; g.fillRect(0, b.sy, W, a.sy - b.sy + 1);
    quad(a.sx, a.sy, a.sw * 1.12, b.sx, b.sy, b.sw * 1.12, FLAG[ai % 3]);
    quad(a.sx, a.sy, a.sw, b.sx, b.sy, b.sw, band ? '#53575c' : '#4a4e53');
    if (ai % 4 < 2) for (const f of [-1 / 3, 1 / 3]) quad(a.sx + a.sw * f, a.sy, a.sw * 0.012, b.sx + b.sw * f, b.sy, b.sw * 0.012, '#f2f2f2');
  }
  for (let n = N - 1; n >= 1; n--) {
    const ai = base + n, P1 = P[n];
    if (ai % 3 === 0) { building(P1, ai, -1, th); building(P1, ai, 1, th); }
    const mk = T.marks.find((m) => m.i === ai % T.n); if (mk) sign(P1, mk.name);
    for (const o of OBJ.get(ai % T.n) || []) thing(P1, o);
  }
  runner(cam);
  const cur = [...T.marks].reverse().find((m) => m.i <= base % T.n) || T.marks[0];
  $('place').textContent = cur ? cur.name : '';
  $('dist').textContent = `${Math.floor((st.z * T.segM) / SEG)} m`; $('coins').textContent = `${st.coins} birr`; $('best').textContent = `Best ${best} m`;
}

loadRoute().then((t) => {
  T = t; OBJ = makeObjects(T.n); $('src').textContent = `Road: ${source} - ${(T.meters / 1000).toFixed(1)} km, looping`;
  let last = performance.now();
  const loop = (now) => { step(Math.min(0.05, (now - last) / 1000)); last = now; draw(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});
