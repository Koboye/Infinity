'use strict';
/* Hill Climb Racing - living scenery.
   Drawn in screen space behind (Scenery.back) and in front of (Scenery.front) the world, so the whole landscape reacts to the vehicle:
   - drifting clouds, soft haze ridges and swaying tree lines at three different parallax depths (they slide as the vehicle moves)
   - birds that fly on their own (eagle, parrots, geese or distant gulls depending on the world)
   - wind blown leaves, petals, snow, sand, embers or spores that stream backwards faster the faster the vehicle goes
   - speed streaks when the vehicle is really flying
   Pure canvas, no assets. Everything is cheap (sprites are pre-rendered once). */
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hex = h => { h = (h || '#888888').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] };
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')' };
  const mod = (v, m) => ((v % m) + m) % m;
  const rnd = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) };

  /* ---------- pre-rendered cloud sprites (soft, lit from above) ---------- */
  const CLOUDS = [];
  function cloudSprite(seed) {
    const w = 380, h = 150, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const n = 7 + (seed % 3);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), px = 50 + t * (w - 100), r = 26 + rnd(seed * 9 + i) * 26 + Math.sin(t * Math.PI) * 18, py = h * .62 - Math.sin(t * Math.PI) * 18 - rnd(seed * 5 + i) * 14 + (pass ? -6 : 0);
        const gr = x.createRadialGradient(px - r * .25, py - r * .35, r * .1, px, py, r);
        if (!pass) { gr.addColorStop(0, 'rgba(206,222,244,.85)'); gr.addColorStop(1, 'rgba(206,222,244,0)') }
        else { gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.6, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)') }
        x.fillStyle = gr; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
      }
    }
    return c;
  }
  function clouds() { if (!CLOUDS.length) for (let i = 0; i < 4; i++) CLOUDS.push(cloudSprite(i * 7 + 3)); return CLOUDS }

  /* ---------- birds ---------- */
  function wing(g, x, y, s, flap, col, dir) {
    g.strokeStyle = col; g.lineWidth = Math.max(1.2, s * .16); g.lineCap = 'round'; g.lineJoin = 'round';
    const up = Math.sin(flap) * s * .9;
    g.beginPath(); g.moveTo(x - s, y + up * .6); g.quadraticCurveTo(x - s * .45, y - s * .35 - up * .5, x, y); g.quadraticCurveTo(x + s * .45, y - s * .35 - up * .5, x + s, y + up * .6); g.stroke();
  }
  function gull(g, x, y, s, t, ph, col) { wing(g, x, y, s, t * 7 + ph, col) }
  function eagle(g, x, y, s, t) {
    const fl = Math.sin(t * 1.7) * .35, dive = Math.sin(t * .5) * .08;
    g.save(); g.translate(x, y); g.rotate(dive);
    /* wings (broad, feathered tips) */
    for (const sd of [-1, 1]) {
      g.fillStyle = '#3a2412'; g.beginPath(); g.moveTo(0, 0);
      g.bezierCurveTo(sd * s * .5, -s * (.34 + fl * .4), sd * s * 1.1, -s * (.22 + fl), sd * s * 1.65, s * (.08 - fl * .5));
      for (let i = 0; i < 4; i++) g.lineTo(sd * (s * (1.55 - i * .26)), s * (.16 + i * .035 - fl * .3));
      g.bezierCurveTo(sd * s * .8, s * .22, sd * s * .3, s * .2, 0, s * .14); g.closePath(); g.fill();
    }
    g.fillStyle = '#4a2f18'; g.beginPath(); g.ellipse(0, s * .06, s * .34, s * .17, 0, 0, 7); g.fill();
    g.fillStyle = '#fafafa'; g.beginPath(); g.ellipse(s * .3, -s * .02, s * .13, s * .11, 0, 0, 7); g.fill();
    g.fillStyle = '#f5b82e'; g.beginPath(); g.moveTo(s * .4, -s * .02); g.lineTo(s * .55, s * .03); g.lineTo(s * .4, s * .06); g.fill();
    g.fillStyle = '#fafafa'; g.beginPath(); g.moveTo(-s * .3, s * .02); g.lineTo(-s * .62, s * .1); g.lineTo(-s * .62, -s * .02); g.closePath(); g.fill();
    g.restore();
  }
  function parrot(g, x, y, s, t, ph, body, wingc) {
    const f = Math.sin(t * 9 + ph) * .9;
    g.save(); g.translate(x, y); g.rotate(-.12);
    g.fillStyle = wingc; for (const sd of [1, -1]) { g.beginPath(); g.moveTo(-s * .1, 0); g.quadraticCurveTo(-s * .2, -s * (.9 + f * .5) * sd * .6 - s * .3, -s * .85, -s * (.5 + f * .4) * sd * .5); g.quadraticCurveTo(-s * .5, s * .05, s * .1, s * .05); g.fill() }
    g.fillStyle = body; g.beginPath(); g.ellipse(0, 0, s * .55, s * .22, -.1, 0, 7); g.fill();
    g.beginPath(); g.arc(s * .5, -s * .08, s * .17, 0, 7); g.fill();
    g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(s * .53, -s * .1, s * .06, 0, 7); g.fill();
    g.fillStyle = '#222'; g.beginPath(); g.arc(s * .55, -s * .11, s * .025, 0, 7); g.fill();
    g.fillStyle = '#f3efe2'; g.beginPath(); g.moveTo(s * .64, -s * .1); g.quadraticCurveTo(s * .8, -s * .06, s * .7, s * .06); g.quadraticCurveTo(s * .64, 0, s * .64, -s * .1); g.fill();
    g.strokeStyle = body; g.lineWidth = s * .13; g.lineCap = 'round'; g.beginPath(); g.moveTo(-s * .5, s * .05); g.quadraticCurveTo(-s * .9, s * .2, -s * 1.2, s * .5); g.stroke();
    g.restore();
  }

  /* ---------- haze ridges + tree lines ---------- */
  function ridge(g, W, H, shift, base, amp, seed, col, treeCol, t, sway, trees) {
    const step = 12, y0 = base;
    g.fillStyle = col; g.beginPath(); g.moveTo(-10, H);
    const hs = [];
    for (let x = -step; x <= W + step; x += step) {
      const u = x + shift;
      const y = y0 - (Math.sin(u * .0042 + seed) * .55 + Math.sin(u * .0107 + seed * 2.3) * .3 + Math.sin(u * .023 + seed * 4.1) * .15 + .5) * amp;
      hs.push([x, y]); g.lineTo(x, y);
    }
    g.lineTo(W + step, H); g.closePath(); g.fill();
    if (trees) {
      g.fillStyle = treeCol;
      for (let x = -step; x <= W + step; x += step * 2) {
        const u = Math.floor((x + shift) / (step * 2)), r = rnd(u * 3.7 + seed);
        if (r < .35) continue;
        const idx = Math.round((x + step) / step), p = hs[clamp(idx, 0, hs.length - 1)];
        const h = 10 + r * 16, sw = Math.sin(t * 1.4 + u * .7) * sway * h * .08;
        if (r > .72) { g.beginPath(); g.moveTo(p[0] - h * .3, p[1] + 2); g.lineTo(p[0] + sw, p[1] - h); g.lineTo(p[0] + h * .3, p[1] + 2); g.fill() }
        else { g.beginPath(); g.ellipse(p[0] + sw, p[1] - h * .45, h * .34, h * .5, 0, 0, 7); g.fill() }
      }
    }
  }

  /* ---------- wind blown particles ---------- */
  const NP = 46;
  function pkind(WD) {
    const b = WD.biome;
    if (b === 'snow' || b === 'ice') return 'snow';
    if (b === 'volcanic') return 'ember';
    if (b === 'alien') return 'spore';
    if (b === 'desert' || b === 'mars' || b === 'canyon' || b === 'savanna') return 'sand';
    if (b === 'coast') return 'petal';
    if (b === 'moon') return 'dust';
    return 'leaf';
  }
  const PCOL = {
    leaf: ['#7cc74a', '#a8d85a', '#e0b33a', '#d77a2f'], petal: ['#ffd1e0', '#ffffff', '#ffe3a8'], snow: ['#ffffff', '#e6f4ff'],
    ember: ['#ffb02e', '#ff6a1a', '#ffd86a'], spore: ['#9cfff0', '#d8a6ff', '#fff59a'], sand: ['#e9cf94', '#d6b073', '#f1deb0'], dust: ['#d9dbe6', '#aeb1c4']
  };

  const Scenery = {
    back(g, W, H, cam, z, WD, t, spd) {
      if (!WD) return;
      const space = WD.cat === 'planet', night = !!WD.stars;
      const hazeSky = night ? '#1b2650' : space ? '#6a5a8a' : '#bcd8f2';
      const gr0 = WD.gr ? WD.gr[0] : '#3f9a28';
      const camx = cam.x * z, camy = cam.y * z;
      /* 1. clouds drift with their own wind and slide with the camera */
      if (!space) {
        const cs = clouds(), span = W + 520;
        g.save(); g.globalAlpha = night ? .22 : .8;
        for (let i = 0; i < 6; i++) {
          const s = cs[i % cs.length], depth = .018 + (i % 3) * .014, sc = (.55 + (i % 3) * .28) * H / 620;
          const x = mod(i * span / 6 + t * (6 + i * 2.2) - camx * depth, span) - 300, y = H * (.05 + (i * .071) % .3) - camy * .01;
          g.drawImage(s, x, y, s.width * sc, s.height * sc);
        }
        g.restore();
      }
      /* 2. haze ridges (far, mid) with swaying tree lines (near) */
      const hz = (night ? .55 : space ? .5 : .62);
      const ridgeA = mix(gr0, hazeSky, hz + .12), ridgeB = mix(gr0, hazeSky, hz - .12), treeB = mix(gr0, '#0b2a14', .35);
      const wind = Math.sin(t * .8) * .5 + .5;
      g.save(); g.globalAlpha = night ? .5 : .62;
      ridge(g, W, H, camx * .10, H * .76 - camy * .03, H * .10, 1.7, ridgeA, ridgeA, t, 0, false);
      g.globalAlpha = night ? .62 : .8;
      ridge(g, W, H, camx * .22, H * .80 - camy * .05, H * .09, 4.2, ridgeB, treeB, t, 1 + wind, !space);
      g.restore();
      /* 3. birds */
      if (space) return;
      const f = WD.fauna, dk = night ? 'rgba(10,14,40,.7)' : 'rgba(26,32,48,.7)';
      const bs = H / 620;
      if (f === 'eagle') {
        const span = W + 500, x = mod(t * 34 - camx * .05, span) - 250, y = H * .17 + Math.sin(t * .35) * H * .05;
        eagle(g, x, y, 34 * bs, t);
        const x2 = mod(t * 22 + span * .5 - camx * .04, span) - 250; eagle(g, x2, H * .30 + Math.sin(t * .27 + 2) * H * .03, 16 * bs, t + 3);
      } else if (f === 'parrot') {
        const span = W + 400;
        for (let i = 0; i < 3; i++) {
          const x = mod(t * (70 + i * 14) + i * 150 - camx * .07, span) - 200, y = H * (.14 + i * .07) + Math.sin(t * 1.3 + i) * 10 * bs;
          parrot(g, x, y, 22 * bs, t, i * 2, i === 1 ? '#2d6fe0' : '#e6322a', i === 1 ? '#ffd33d' : '#2d6fe0');
        }
      } else if (f === 'geese') {
        const span = W + 700, hx = mod(t * 40 - camx * .06, span) - 350, hy = H * .14 + Math.sin(t * .4) * 6 * bs;
        for (let i = 0; i < 9; i++) { const k = (i + 1) >> 1, sd = i & 1 ? 1 : -1; if (!i) { gull(g, hx, hy, 9 * bs, t, 0, dk); continue } gull(g, hx - k * 26 * bs, hy + sd * k * 15 * bs, 8.5 * bs, t, i * .7, dk) }
      } else if (!WD.mood || WD.mood !== 'Planet') {
        const span = W + 500;
        for (let i = 0; i < 4; i++) { const x = mod(t * (24 + i * 5) + i * 180 - camx * .05, span) - 250, y = H * (.12 + (i * .06)) + Math.sin(t * .9 + i * 2) * 5 * bs; gull(g, x, y, 6.5 * bs, t, i * 1.3, dk) }
      }
    },

    /* particles + speed streaks in front of the world; spd = |vehicle speed| in world units/s */
    front(g, W, H, cam, z, WD, t, spd, dt) {
      if (!WD) return;
      const kind = pkind(WD), cols = PCOL[kind], camx = cam.x * z, camy = cam.y * z, sp = clamp(spd / 600, 0, 1.4);
      const wind = (kind === 'snow' ? 26 : 60) + 25 * Math.sin(t * .6);
      g.save();
      for (let i = 0; i < NP; i++) {
        const r = rnd(i + 1), r2 = rnd(i * 3 + 7), depth = .55 + r * 1.35;
        const span = W + 200, x = mod(r2 * span + t * wind * depth - camx * depth * .55, span) - 100;
        const fall = kind === 'ember' ? -22 : kind === 'snow' ? 40 : kind === 'sand' || kind === 'dust' ? 2 : 24;
        const ySpan = H + 120, y = mod(rnd(i * 5 + 2) * ySpan + t * fall * depth - camy * .2 * depth, ySpan) - 60 + Math.sin(t * (1 + r) + i) * 14 * depth;
        const s = (kind === 'snow' ? 1.6 : kind === 'sand' || kind === 'dust' ? 1.3 : 3.2) * depth * H / 620;
        g.globalAlpha = (kind === 'sand' || kind === 'dust' ? .35 : .85) * (.5 + .5 * Math.min(1, depth));
        g.fillStyle = cols[i % cols.length];
        const rot = t * (1 + r * 2) + i;
        g.save(); g.translate(x, y);
        if (kind === 'leaf' || kind === 'petal') { g.rotate(rot); g.scale(1, .5 + .5 * Math.abs(Math.sin(rot * 1.3))); g.beginPath(); g.ellipse(0, 0, s * 1.5, s * .8, 0, 0, 7); g.fill() }
        else if (kind === 'sand' || kind === 'dust') { g.fillRect(0, 0, s * (4 + sp * 14), s * .55) }
        else { g.beginPath(); g.arc(0, 0, s, 0, 7); if (kind === 'ember' || kind === 'spore') { g.shadowColor = cols[i % cols.length]; g.shadowBlur = 8 } g.fill() }
        g.restore();
      }
      g.restore();
      /* speed streaks: appear only when the vehicle is really moving */
      if (sp > .55) {
        const a = (sp - .55) * .55; g.save(); g.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')'; g.lineWidth = 2 * H / 620; g.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
          const y = H * (.12 + rnd(i * 11) * .55), L = (40 + rnd(i) * 80) * sp * H / 620, x = mod(rnd(i * 4) * W * 1.5 - t * (900 + i * 90) * sp, W + 200) - 100;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y); g.stroke();
        }
        g.restore();
      }
    }
  };
  window.Scenery = Scenery;
})();
