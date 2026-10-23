// On-device settings (text size, contrast, volumes, vibration).
import { setSfxVolume, setHaptics, setStoneKind } from './sound';
import { setMusicVolume } from './music';
import { applyStones, DEFAULT_STONES, stoneSet } from './stones';
const KEY = 'gebeta.settings.v1';
export const DEFAULTS = { text: 'normal', contrast: false, music: 0.55, sfx: 1, haptics: true, stones: DEFAULT_STONES };
export const loadSettings = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; } };
export function applySettings(s) {
  setSfxVolume(s.sfx); setHaptics(s.haptics); setMusicVolume(s.music);
  const el = document.documentElement;
  applyStones(s.stones); setStoneKind(stoneSet(s.stones).kind);
  el.dataset.text = s.text; el.dataset.contrast = s.contrast ? 'high' : 'normal';
}
export function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } applySettings(s); }
