// Tiny WebAudio synth: wooden seed "tick", store "clack", capture, win. No audio files needed.
let ctx = null;
let muted = false;
export const setMuted = (m) => { muted = m; };
const ac = () => {
  if (typeof window === 'undefined') return null;
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};
function blip(freq, dur = 0.08, type = 'triangle', gain = 0.12, slide = 0) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), c.currentTime + dur);
  g.gain.setValueAtTime(gain, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.02);
}
export const sfx = {
  sow: () => blip(380 + Math.random() * 90, 0.06, 'triangle', 0.1, -120),
  store: () => blip(220, 0.14, 'sine', 0.18, -60),
  pick: () => blip(160, 0.09, 'square', 0.05),
  capture: () => { blip(300, 0.12, 'sawtooth', 0.08, 300); setTimeout(() => blip(600, 0.16, 'triangle', 0.1), 90); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.14), i * 120)),
  lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'sine', 0.12), i * 150)),
  tap: () => blip(520, 0.04, 'triangle', 0.06),
  // checkers: a hollow wooden "tock", a sharper capture, a bright crowning chime
  move: () => { blip(210 + Math.random() * 30, 0.07, 'triangle', 0.16, -60); setTimeout(() => blip(120, 0.05, 'sine', 0.1), 25); },
  jump: () => { blip(260, 0.06, 'square', 0.07, 120); setTimeout(() => blip(180, 0.1, 'triangle', 0.14, -80), 40); },
  king: () => [660, 880, 1320].forEach((f, i) => setTimeout(() => blip(f, 0.14, 'triangle', 0.12), i * 90)),
  // dominoes: the click-clack of a tile, a soft shuffle for drawing
  place: () => { blip(150, 0.05, 'square', 0.1); setTimeout(() => blip(420, 0.04, 'triangle', 0.08, -120), 30); },
  draw: () => { blip(300, 0.05, 'triangle', 0.05, 80); setTimeout(() => blip(340, 0.05, 'triangle', 0.05, 80), 70); },
  pass: () => blip(200, 0.18, 'sine', 0.1, -80),
};
