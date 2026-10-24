// Background music: the Tizita instrumental recording (/audio/tizita.m4a), looped. If the file can't load
// (first visit offline, blocked), it falls back to the generative synth below.
// Generative Ethiopian-style synth (fallback):
// A bowed "masenqo" lead (sawtooth + vibrato + band-pass), a plucked "krar" arpeggio, a drone,
// and a soft "kebero" drum in a 6/8 swing, in the pentatonic qenet modes: Tizita, Bati, Ambassel, Anchihoye.
import { audioCtx } from './sound';

const MODES = {
  tizita: [0, 2, 4, 7, 9],      // major-pentatonic feel (Tizita major)
  tizitaMinor: [0, 2, 3, 7, 8], // Tizita minor
  bati: [0, 4, 5, 7, 11],
  ambassel: [0, 1, 5, 7, 8],
  anchihoye: [0, 1, 5, 7, 8],
};
const ORDER = ['tizita', 'tizitaMinor', 'bati', 'ambassel', 'tizita', 'anchihoye'];
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

let on = false, timer = null, master = null, nextT = 0, step = 0, section = 0, root = 57, walk = 2, vol = 0.55;
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

function bowed(c, t, f, dur, g) {
  const o = c.createOscillator(), o2 = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain();
  const bp = c.createBiquadFilter(), lp = c.createBiquadFilter(), a = c.createGain();
  o.type = 'sawtooth'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 1.004;
  lfo.frequency.value = 5.2; lg.gain.value = f * 0.011; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
  bp.type = 'bandpass'; bp.frequency.value = Math.min(2200, f * 3); bp.Q.value = 1.1; lp.type = 'lowpass'; lp.frequency.value = 2600;
  a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(g, t + 0.12); a.gain.setValueAtTime(g, t + dur * 0.7); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(bp); o2.connect(bp); bp.connect(lp).connect(a).connect(master);
  [o, o2, lfo].forEach((x) => { x.start(t); x.stop(t + dur + 0.05); });
}
function pluck(c, t, f, g) {
  const o = c.createOscillator(), a = c.createGain(), lp = c.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.5);
  a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  o.connect(lp).connect(a).connect(master); o.start(t); o.stop(t + 0.75);
}
function drum(c, t, low, g) {
  const o = c.createOscillator(), a = c.createGain();
  o.frequency.setValueAtTime(low ? 110 : 190, t); o.frequency.exponentialRampToValueAtTime(low ? 55 : 120, t + 0.12);
  a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + (low ? 0.28 : 0.14));
  o.connect(a).connect(master); o.start(t); o.stop(t + 0.3);
}
function drone(c, t, f, dur) {
  const o = c.createOscillator(), a = c.createGain(); o.type = 'sine'; o.frequency.value = f;
  a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(0.05, t + 1); a.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(a).connect(master); o.start(t); o.stop(t + dur + 0.1);
}

const BEAT = 0.33; // seconds per 8th note in 6/8 (≈ 90 bpm dotted)
function schedule() {
  const c = audioCtx(); if (!c || !on) return;
  while (nextT < c.currentTime + 0.25) {
    const sc = MODES[ORDER[section % ORDER.length]];
    const deg = (d) => root + sc[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5);
    const pos = step % 12; // two bars of 6/8
    const t = nextT + (pos % 3 === 1 ? 0.03 : 0); // swing
    if (pos === 0) drone(c, t, midi(root - 12), BEAT * 12);
    if (pos === 0 || pos === 3 || pos === 6 || pos === 9) drum(c, t, pos % 6 === 0, pos === 0 ? 0.16 : 0.08);
    if (pos === 4 || pos === 10) drum(c, t, false, 0.05);
    if (pos % 2 === 0) pluck(c, t, midi(deg(walk - 5 + (pos % 4 === 0 ? 0 : 2)) + 12), 0.05);
    if (pos === 0 || pos === 6 || (pos === 3 && Math.random() < 0.5) || (pos === 9 && Math.random() < 0.6)) {
      walk = Math.max(0, Math.min(9, walk + rnd([-2, -1, -1, 0, 1, 1, 2])));
      const long = pos === 0 || pos === 6;
      bowed(c, t, midi(deg(walk) + 12), BEAT * (long ? 5.2 : 2.6), 0.07);
    }
    step++; nextT += BEAT;
    if (step % 48 === 0) { section++; root = rnd([55, 57, 57, 59, 52]); walk = 3; }
  }
}
const TRACK = '/audio/tizita.m4a';
let el = null, src = null, fileGain = null, usingFile = false;

function startSynth(c) {
  if (master) return;
  master = c.createGain(); master.gain.setValueAtTime(0.0001, c.currentTime); master.gain.linearRampToValueAtTime(vol, c.currentTime + 1.5); master.connect(c.destination);
  nextT = c.currentTime + 0.1; step = 0;
  timer = setInterval(schedule, 60);
}
function stopSynth(c) {
  clearInterval(timer); timer = null;
  if (master && c) { const m = master; m.gain.cancelScheduledValues(c.currentTime); m.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.4); setTimeout(() => m.disconnect(), 600); }
  master = null;
}
function startFile(c) {
  if (!el) {
    el = new Audio(TRACK); el.loop = true; el.preload = 'auto';
    try { src = c.createMediaElementSource(el); fileGain = c.createGain(); src.connect(fileGain).connect(c.destination); } catch { fileGain = null; el.volume = vol; }
    el.addEventListener('error', () => { if (on && !master) { usingFile = false; startSynth(audioCtx()); } });
  }
  usingFile = true;
  if (fileGain) { fileGain.gain.cancelScheduledValues(c.currentTime); fileGain.gain.setValueAtTime(0.0001, c.currentTime); fileGain.gain.linearRampToValueAtTime(vol, c.currentTime + 2); }
  const p = el.play(); if (p && p.catch) p.catch(() => { if (on && !master) { usingFile = false; startSynth(audioCtx()); } });
}
function stopFile(c) {
  if (!el) return;
  const e = el;
  if (fileGain && c) { fileGain.gain.cancelScheduledValues(c.currentTime); fileGain.gain.setValueAtTime(fileGain.gain.value, c.currentTime); fileGain.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.4); setTimeout(() => { if (!on) e.pause(); }, 500); }
  else e.pause();
}

export function musicOn() { return on; }
export function setMusic(enabled) {
  if (enabled === on) return;
  const c = audioCtx();
  if (enabled && c) { on = true; startFile(c); }
  else { on = false; stopFile(c); stopSynth(c); }
}
export function setMusicVolume(v) { vol = v; if (master) master.gain.value = v; if (fileGain) fileGain.gain.value = v; else if (el) el.volume = v; }
export const getMusicVolume = () => vol;
export function pauseMusic(p) {
  const c = audioCtx(); if (!c) return;
  const target = p ? 0.0001 : vol;
  if (master) master.gain.linearRampToValueAtTime(target, c.currentTime + 0.4);
  if (el) {
    if (fileGain) fileGain.gain.linearRampToValueAtTime(target, c.currentTime + 0.4);
    if (p) setTimeout(() => { if (document.hidden && on) el.pause(); }, 500);
    else if (on && usingFile) el.play().catch(() => {});
  }
}
