'use client';
import React, { useEffect, useRef } from 'react';

// ርችት — rockets climb with a spark trail, burst into rings / peonies / willows, crackle and fade.
const PALETTE = [
  ['#FFE9A0', '#F2B632', '#fff6d6'],   // gold
  ['#8be0a8', '#4FA36B', '#d9ffe6'],   // green
  ['#ff9a8a', '#C23B2A', '#ffd9d2'],   // red
  ['#9fd0ff', '#3b8fd6', '#e4f2ff'],   // blue
  ['#e2b8ff', '#8E3FD1', '#f6e9ff'],   // violet
  ['#ffffff', '#F4E9CF', '#fff7e0'],   // pearl
];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/** Full-screen fireworks. `intensity` 1 = a normal win, 2 = a jackpot. */
export default function Fireworks({ intensity = 1, duration = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return undefined;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, raf = 0, last = performance.now(), born = last, nextLaunch = 250;
    const rockets = [], sparks = [];
    const fit = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit(); window.addEventListener('resize', fit);

    const launch = (x = rnd(W * 0.12, W * 0.88), ty = rnd(H * 0.12, H * 0.45)) => {
      rockets.push({ x, y: H + 6, vx: rnd(-18, 18), vy: -rnd(H * 0.85, H * 1.15), ty, pal: pick(PALETTE), kind: pick(['peony', 'ring', 'willow', 'peony', 'heart']) });
    };
    const burst = (r) => {
      const n = r.kind === 'ring' ? 54 : r.kind === 'heart' ? 60 : r.kind === 'willow' ? 70 : 84;
      const power = rnd(150, 250) * Math.min(1.25, Math.max(0.7, W / 520));
      for (let i = 0; i < n; i++) {
        let a = (i / n) * Math.PI * 2, sp = power * (r.kind === 'ring' ? 1 : rnd(0.35, 1));
        if (r.kind === 'heart') { const t = a; const hx = 16 * Math.sin(t) ** 3, hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); sparks.push({ x: r.x, y: r.y, vx: hx * power / 17, vy: hy * power / 17, life: 1, decay: rnd(0.5, 0.75), c: pick(r.pal), g: 70, size: rnd(1.6, 2.6), trail: true }); continue; }
        sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: r.kind === 'willow' ? rnd(0.28, 0.45) : rnd(0.55, 0.9), c: pick(r.pal), g: r.kind === 'willow' ? 130 : 90, size: rnd(1.4, 2.8), trail: true, twinkle: Math.random() < 0.3 });
      }
      for (let i = 0; i < 10; i++) sparks.push({ x: r.x, y: r.y, vx: rnd(-40, 40), vy: rnd(-40, 40), life: 1, decay: rnd(2.2, 3.2), c: '#ffffff', g: 0, size: rnd(2.5, 4.5), trail: false }); // flash
    };

    for (let i = 0; i < Math.round(3 * intensity); i++) setTimeout(() => launch(W * (0.2 + 0.3 * i + rnd(-0.05, 0.05))), 80 + i * 170); // opening volley

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, 0, W, H); // leaves light trails
      ctx.globalCompositeOperation = 'lighter';
      const alive = !duration || now - born < duration;
      nextLaunch -= dt * 1000;
      if (alive && nextLaunch <= 0) { launch(); if (Math.random() < 0.35 * intensity) launch(); nextLaunch = rnd(380, 820) / intensity; }
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]; r.vy += 260 * dt; r.x += r.vx * dt; r.y += r.vy * dt;
        sparks.push({ x: r.x, y: r.y, vx: rnd(-14, 14), vy: rnd(10, 40), life: 0.7, decay: 2.4, c: '#FFD98A', g: 30, size: 1.6, trail: false });
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r.x, r.y, 2.2, 0, 6.3); ctx.fill();
        if (r.vy >= -30 || r.y <= r.ty) { burst(r); rockets.splice(i, 1); }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]; s.vx *= 1 - 0.9 * dt; s.vy = s.vy * (1 - 0.9 * dt) + s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= s.decay * dt;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        const tw = s.twinkle && Math.random() < 0.4 ? 0.25 : 1;
        ctx.globalAlpha = Math.max(0, s.life) * tw; ctx.fillStyle = s.c;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.size * (0.5 + s.life * 0.6), 0, 6.3); ctx.fill();
        if (s.trail) { ctx.globalAlpha *= 0.4; ctx.fillRect(s.x - s.vx * 0.03, s.y - s.vy * 0.03, s.size * 0.8, s.size * 0.8); }
      }
      ctx.globalAlpha = 1;
      if (sparks.length > 1400) sparks.splice(0, sparks.length - 1400);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', fit); };
  }, [intensity, duration]);
  return <canvas ref={ref} className="fireworks" aria-hidden="true" />;
}
