// Bingo caller's voice: reads each ball aloud ONCE ("G, fifty-five" / "ጂ፣ ሃምሳ አምስት").
// English uses the phone's built-in text-to-speech. Amharic first plays recorded clips (the letter, then the number, from
// /audio/bingo/am/ — see the README there); when no clips are installed it uses an Amharic text-to-speech voice, and when the
// phone has none the caller falls back to English and tells the player once.

const LETTERS_EN = ['B', 'I', 'N', 'G', 'O'];
const LETTERS_AM = ['ቢ', 'አይ', 'ኤን', 'ጂ', 'ኦ'];            // how the five letters are said in Amharic
const ONES = ['', 'አንድ', 'ሁለት', 'ሦስት', 'አራት', 'አምስት', 'ስድስት', 'ሰባት', 'ስምንት', 'ዘጠኝ'];
const TENS = ['', 'አስር', 'ሃያ', 'ሰላሳ', 'አርባ', 'ሃምሳ', 'ስልሳ', 'ሰባ'];

/** 1…75 in spoken Amharic. */
export function amharicNumber(n) {
  if (!Number.isInteger(n) || n < 1 || n > 99) return String(n);
  const t = Math.floor(n / 10), o = n % 10;
  if (n < 10) return ONES[n];
  if (n === 10) return TENS[1];
  if (n < 20) return `አስራ ${ONES[o]}`;
  return o ? `${TENS[t]} ${ONES[o]}` : TENS[t];
}

/** The letter of a ball: 1-15 B, 16-30 I, 31-45 N, 46-60 G, 61-75 O. */
export const ballLetterIndex = (n) => Math.min(4, Math.floor((n - 1) / 15));

/** What is spoken for a ball, once. English: "G. 55."  Amharic: "ጂ፣ ሃምሳ አምስት". */
export function ballPhrase(n, lang = 'en') {
  const L = ballLetterIndex(n);
  if (lang === 'am') return `${LETTERS_AM[L]}፣ ${amharicNumber(n)}`;
  return `${LETTERS_EN[L]}. ${n}.`;
}

/** What is shown on screen for a ball: "B - 12" in English, "ቢ - አስራ ሁለት" in Amharic. */
export function ballLabel(n, lang = 'en') {
  if (!Number.isInteger(n)) return '';
  const L = ballLetterIndex(n);
  return lang === 'am' ? `${LETTERS_AM[L]} - ${amharicNumber(n)}` : `${LETTERS_EN[L]} - ${n}`;
}

let enabled = true;
export const setSpeechEnabled = (v) => { enabled = !!v; if (!v) stopSpeaking(); };
export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

let voices = [];
function loadVoices() { try { voices = window.speechSynthesis.getVoices() || []; } catch { voices = []; } }
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  try { window.speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch { /* old browsers */ }
}
const pick = (prefix) => voices.find((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(prefix));
export const hasAmharicVoice = () => { if (!voices.length) loadVoices(); return !!pick('am'); };

// ── recorded Amharic clips: /audio/bingo/am/B.mp3 … O.mp3 (letters) and 1.mp3 … 75.mp3 (numbers) ──
export const AM_AUDIO_BASE = '/audio/bingo/am/';
let clipsMissing = false, seq = 0, clip = null;
if (typeof window !== 'undefined' && typeof fetch === 'function') {
  fetch(`${AM_AUDIO_BASE}B.mp3`, { method: 'HEAD' }).then((r) => { if (!r.ok) clipsMissing = true; }).catch(() => {});
}
export const amharicClipsAvailable = () => !clipsMissing && typeof Audio !== 'undefined';
function playClip(src, volume) {
  return new Promise((resolve, reject) => {
    const a = new Audio(src); clip = a; a.volume = volume;
    a.onended = () => resolve(); a.onerror = () => reject(new Error('clip missing'));
    a.play().catch(reject);
  });
}

export function stopSpeaking() {
  seq++;
  try { if (clip) { clip.pause(); clip = null; } } catch { /* nothing playing */ }
  try { window.speechSynthesis?.cancel(); } catch { /* nothing speaking */ }
}

function speakText(text, lang, voice, volume) {
  const u = new SpeechSynthesisUtterance(text);
  if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = lang === 'am' ? 'am-ET' : 'en-US';
  u.rate = 0.9; u.pitch = 1; u.volume = volume;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
const englishVoice = () => pick('en-us') || pick('en-gb') || pick('en');

/** Letter clip, then number clip. If a clip cannot load, remember that and read what is left with text-to-speech. */
function speakAmharicClips(n, volume) {
  const my = ++seq, letter = LETTERS_EN[ballLetterIndex(n)];
  let letterDone = false;
  playClip(`${AM_AUDIO_BASE}${letter}.mp3`, volume)
    .then(() => { if (my !== seq) return undefined; letterDone = true; return playClip(`${AM_AUDIO_BASE}${n}.mp3`, volume); })
    .catch(() => {
      if (my !== seq) return;
      clipsMissing = true;
      if (!speechSupported()) return;
      const am = pick('am');
      if (am) speakText(letterDone ? amharicNumber(n) : ballPhrase(n, 'am'), 'am', am, volume);
      else speakText(letterDone ? String(n) : ballPhrase(n, 'en'), 'en', englishVoice(), volume);
    });
}

/**
 * Read a ball aloud, once, in the chosen language. Returns 'am' | 'en' | 'en-fallback' (Amharic chosen but no clips and no
 * Amharic voice) | 'off'. A new call always cuts off the previous one, so a slow voice never falls behind the balls.
 */
export function speakBall(n, lang = 'en', volume = 1) {
  if (!enabled) return 'off';
  const vol = Math.max(0, Math.min(1, volume));
  try {
    const wantAm = lang === 'am';
    if (wantAm && amharicClipsAvailable()) { stopSpeaking(); speakAmharicClips(n, vol); return 'am'; }
    if (!speechSupported()) return 'off';
    stopSpeaking();
    const am = wantAm ? pick('am') : null;
    const useLang = wantAm && am ? 'am' : 'en';
    speakText(ballPhrase(n, useLang), useLang, useLang === 'am' ? am : englishVoice(), vol);
    return wantAm && !am ? 'en-fallback' : useLang;
  } catch { return 'off'; }
}
