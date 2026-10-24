// Bingo caller's voice: reads each ball aloud ("G, fifty-five … five five" / "ጂ፣ ሃምሳ አምስት") with the phone's built-in
// text-to-speech. No audio files, no network. English works everywhere; Amharic needs an Amharic voice installed on the device —
// when there is none the caller falls back to English and tells the player once.

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

/** What is spoken for a ball. English: "G. fifty-five. Five, five."  Amharic: "ጂ፣ ሃምሳ አምስት". */
export function ballPhrase(n, lang = 'en') {
  const L = ballLetterIndex(n);
  if (lang === 'am') return `${LETTERS_AM[L]}፣ ${amharicNumber(n)}`;
  const digits = String(n).split('').join(', ');
  return `${LETTERS_EN[L]}. ${n}. ${n > 9 ? `${digits}.` : ''}`;
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

export function stopSpeaking() { try { window.speechSynthesis?.cancel(); } catch { /* nothing speaking */ } }

/**
 * Read a ball aloud in the chosen language. Returns 'am' | 'en' | 'en-fallback' (Amharic chosen but no Amharic voice) | 'off'.
 * A new call always cuts off the previous one, so a slow voice never falls behind the balls.
 */
export function speakBall(n, lang = 'en', volume = 1) {
  if (!enabled || !speechSupported()) return 'off';
  try {
    const wantAm = lang === 'am';
    const am = wantAm ? pick('am') : null;
    const useLang = wantAm && am ? 'am' : 'en';
    const u = new SpeechSynthesisUtterance(ballPhrase(n, useLang));
    const v = useLang === 'am' ? am : (pick('en-us') || pick('en-gb') || pick('en'));
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = useLang === 'am' ? 'am-ET' : 'en-US';
    u.rate = 0.9; u.pitch = 1; u.volume = Math.max(0, Math.min(1, volume));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    return wantAm && !am ? 'en-fallback' : useLang;
  } catch { return 'off'; }
}
