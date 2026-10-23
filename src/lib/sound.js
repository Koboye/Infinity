// Tiny WebAudio synth: wooden seed "tick", store "clack", capture, win. No audio files needed.
let ctx = null;
let muted = false;
export const setMuted = (m) => { muted = m; };
let sfxVol = 1, haptics = true;
export const setSfxVolume = (v) => { sfxVol = v; };
export const setHaptics = (h) => { haptics = h; };
export const audioCtx = () => ac();
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
  gain *= sfxVol; g.gain.setValueAtTime(Math.max(gain, 0.0002), c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.02);
}
const buzz = (p) => { if (muted || !haptics) return; try { navigator.vibrate?.(p); } catch { /* unsupported */ } };
// A short filtered noise burst: the "knock" of wood on wood that pure tones lack.
function knock(freq = 900, dur = 0.05, gain = 0.2) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2.5; g.gain.value = gain * sfxVol;
  src.connect(f).connect(g).connect(c.destination); src.start();
}

// ── Gebeta stone sounds: the voice follows the chosen stone kind (gem / pebble / glass / shell) ──
let stoneKind = 'gem';
export const setStoneKind = (k) => { stoneKind = k; };
const R = (a, b) => a + Math.random() * (b - a);
// A struck, ringing tone: a few inharmonic partials that die away (glass and gem "clink").
function ring(freq, dur, gain) {
  if (muted) return;
  const c = ac(); if (!c) return;
  [1, 2.76, 5.4].forEach((m, i) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = freq * m;
    g.gain.setValueAtTime(gain * sfxVol / (i + 1), c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur / (i + 1));
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.02);
  });
}
// One stone touching another, in the voice of the current kind.
function clack(vel = 1) {
  switch (stoneKind) {
    case 'pebble': knock(R(500, 900), 0.05, 0.4 * vel); knock(R(1200, 1700), 0.025, 0.16 * vel); break;
    case 'glass': knock(R(1900, 2500), 0.03, 0.22 * vel); ring(R(1500, 2300), 0.22, 0.05 * vel); break;
    case 'shell': knock(R(2800, 3600), 0.04, 0.18 * vel); setTimeout(() => knock(R(2200, 3000), 0.03, 0.1 * vel), 22); break;
    default: knock(R(2400, 3200), 0.03, 0.2 * vel); ring(R(2000, 3200), 0.3, 0.05 * vel); // gem
  }
}
// A stone dropping into water: a short rising "plop" and a small ripple.
function plop(g = 0.16) { blip(R(330, 420), 0.13, 'sine', g, 380); setTimeout(() => blip(R(560, 680), 0.09, 'sine', g * 0.5, 220), 70); }
// Stones scooped and ground against each other as a hole is lifted.
function grind() {
  const f = { pebble: 380, glass: 900, shell: 1500, gem: 1100 }[stoneKind] || 900;
  knock(f, 0.2, 0.14);
  [0, 40, 85, 130].forEach((d) => setTimeout(() => clack(0.45), d));
}
export const sfx = {
  sow: () => clack(1),
  store: () => { plop(0.18); setTimeout(() => clack(0.5), 40); },
  pick: () => grind(),
  capture: () => { [0, 35, 70, 120, 170].forEach((d) => setTimeout(() => clack(R(0.5, 1)), d)); setTimeout(() => plop(0.2), 200); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.14), i * 120)),
  lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'sine', 0.12), i * 150)),
  tap: () => blip(520, 0.04, 'triangle', 0.06),
  // checkers: a hollow wooden "tock", a sharper capture, a bright crowning chime
  move: () => { knock(700, 0.06, 0.35); blip(210 + Math.random() * 30, 0.07, 'triangle', 0.16, -60); setTimeout(() => blip(120, 0.05, 'sine', 0.1), 25); },
  jump: () => { knock(1000, 0.07, 0.4); blip(260, 0.06, 'square', 0.07, 120); setTimeout(() => blip(180, 0.1, 'triangle', 0.14, -80), 40); },
  king: () => [660, 880, 1320].forEach((f, i) => setTimeout(() => blip(f, 0.14, 'triangle', 0.12), i * 90)),
  // dominoes: the click-clack of a tile, a soft shuffle for drawing
  place: () => { knock(1100, 0.05, 0.4); blip(150, 0.05, 'square', 0.1); setTimeout(() => blip(420, 0.04, 'triangle', 0.08, -120), 30); },
  draw: () => { blip(300, 0.05, 'triangle', 0.05, 80); setTimeout(() => blip(340, 0.05, 'triangle', 0.05, 80), 70); },
  pass: () => blip(200, 0.18, 'sine', 0.1, -80),
};

// Haptics: wrap selected effects with a short vibration (Android).
const HAPTIC = { capture: [18, 30, 28], jump: [14, 20, 22], king: [20, 40, 20, 40, 60], win: [30, 50, 30, 50, 90], lose: [120], move: 8, place: 10, store: 14 };
Object.keys(HAPTIC).forEach((k) => { const f = sfx[k]; sfx[k] = () => { buzz(HAPTIC[k]); f(); }; });
