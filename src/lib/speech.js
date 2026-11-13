// Bingo caller's voice: reads each ball aloud ONCE ("G, fifty-five" / "ጂ፣ ሃምሳ አምስት").
// English uses the phone's built-in text-to-speech. Amharic first plays one recorded clip per call (B12.mp3, O75.mp3 … plus
// START / BINGO / WINNER from /audio/bingo/am/ — made by tools/generate-bingo-audio.py); when no clips are installed it uses an
// Amharic text-to-speech voice, and when the phone has none the caller falls back to English and tells the player once.

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

// Phonetic respelling of the same words for an ENGLISH voice (used when the phone has no Amharic voice and no clips are installed):
// ah = a in "father", eh = e in "bed", oo = oo in "boot", oh = o in "more", ny = the "ni" in "onion"; doubled consonants are held.
// Written once here, hyphenated, exactly as the caller's guide gives it. (Sixty is Sil-sah: ስልሳ. Six, ስድስት, is Sid-dist.)
const ONES_PH = ['', 'Ahnd', 'Hoo-let', 'Sohst', 'Ah-raht', 'Ah-mist', 'Sid-dist', 'Seh-baht', 'Sim-mint', 'Zeh-teny'];
const TENS_PH = ['', 'Ahs-sir', 'Hah-yah', 'Seh-lah-sah', 'Ahr-bah', 'Hahm-sah', 'Sil-sah', 'Seh-bah'];

/** 1…75 as the phonetic guide spells it: 12 → "Ahs-rah Hoo-let". */
export function phoneticNumber(n) {
  if (!Number.isInteger(n) || n < 1 || n > 99) return String(n);
  const t = Math.floor(n / 10), o = n % 10;
  if (n < 10) return ONES_PH[n];
  if (n === 10) return TENS_PH[1];
  if (n < 20) return `Ahs-rah ${ONES_PH[o]}`;
  return o ? `${TENS_PH[t]} ${ONES_PH[o]}` : TENS_PH[t];
}

/** What an English voice says for an Amharic call: the English letter, then the Amharic number as sounds (syllables joined so
 *  the voice does not pause): "B. Ahsrah Hoolet." */
export const ballPhonetic = (n) => `${LETTERS_EN[ballLetterIndex(n)]}. ${phoneticNumber(n).replace(/-/g, '')}.`;

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

// ── recorded Amharic clips: /audio/bingo/am/B1.mp3 … O75.mp3 (one whole call each) and START / BINGO / WINNER ──
export const AM_AUDIO_BASE = '/audio/bingo/am/';
export const ANNOUNCEMENTS = {
  START: 'ጨዋታው ተጀምሯል፣ መልካም እድል!',
  BINGO: 'ቢንጎ! ካርቴላዎን ያረጋግጡ።',
  WINNER: 'እንኳን ደስ አለዎት! አሸናፊ ተገኝቷል።',
};
let clipsMissing = false, seq = 0, clip = null;
if (typeof window !== 'undefined' && typeof fetch === 'function') {
  fetch(`${AM_AUDIO_BASE}B1.mp3`, { method: 'HEAD' }).then((r) => { if (!r.ok) clipsMissing = true; }).catch(() => {});
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

/** Play one clip; if it cannot load, remember that and read `text` with text-to-speech instead (Amharic voice, else `enText`). */
function speakClip(key, text, enText, volume) {
  const my = ++seq;
  playClip(`${AM_AUDIO_BASE}${key}.mp3`, volume).catch(() => {
    if (my !== seq) return;
    clipsMissing = true;
    if (!speechSupported()) return;
    const am = pick('am');
    if (am) speakText(text, 'am', am, volume); else if (enText) speakText(enText, 'en', englishVoice(), volume);
  });
}

/** START / BINGO / WINNER in Amharic (clip, else an Amharic voice; silent otherwise: the screen already shows the message). */
export function speakAnnouncement(kind, lang = 'en', volume = 1) {
  if (!enabled || lang !== 'am' || !ANNOUNCEMENTS[kind]) return 'off';
  const vol = Math.max(0, Math.min(1, volume));
  try {
    stopSpeaking();
    if (amharicClipsAvailable()) { speakClip(kind, ANNOUNCEMENTS[kind], '', vol); return 'am'; }
    const am = speechSupported() ? pick('am') : null;
    if (!am) return 'off';
    speakText(ANNOUNCEMENTS[kind], 'am', am, vol); return 'am';
  } catch { return 'off'; }
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
    if (wantAm && amharicClipsAvailable()) { stopSpeaking(); speakClip(`${LETTERS_EN[ballLetterIndex(n)]}${n}`, ballPhrase(n, 'am'), ballPhonetic(n), vol); return 'am'; }
    if (!speechSupported()) return 'off';
    stopSpeaking();
    const am = wantAm ? pick('am') : null;
    const useLang = wantAm && am ? 'am' : 'en';
    // Amharic chosen but no Amharic voice: the English voice says the Amharic words from the phonetic guide.
    speakText(wantAm && !am ? ballPhonetic(n) : ballPhrase(n, useLang), useLang, useLang === 'am' ? am : englishVoice(), vol);
    return wantAm && !am ? 'en-fallback' : useLang;
  } catch { return 'off'; }
}
