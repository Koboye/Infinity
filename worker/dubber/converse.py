"""Two-way conversation translator (turn-based).

One turn = one person speaks, we listen, translate, and speak back.
  direction "hear": a stranger speaks (their language) -> you hear it in yours (earbuds)
  direction "say" : you speak (your language) -> the phone speaks it in theirs, in YOUR cloned voice

Privacy: the stranger's audio is decoded in memory, never written to disk, and never kept after the turn.
Only the last seconds of YOUR OWN voice are held in memory (for cloning, expire after 30 minutes);
FreeVC needs files, so that clip is written to workspace/ for a moment while cloning and deleted at once.
Translation is offline unless you set ALLOW_ONLINE_MT=1 (then Google is used if NLLB fails).
"""
from __future__ import annotations

import base64
import io
import os
import subprocess
import threading
import time
from dataclasses import dataclass

import numpy as np

from . import config, licences, speakers, transcribe, translate, voice
from .audio import ffmpeg_exe, resample

MAX_UPLOAD_BYTES = 8_000_000
MIN_SECONDS = 0.35
MIN_RMS = 0.004
SESSION_TTL = 30 * 60


@dataclass(frozen=True)
class Lang:
    code: str            # also the Whisper code
    name: str
    native: str
    nllb: str
    bcp47: str           # for the phone's built-in voice
    asr: str = "whisper"  # "mms" = Meta MMS (much better than Whisper for Ethiopian languages)
    mms: str = ""        # ISO 639-3 code used by MMS ASR / TTS
    server_tts: bool = False


LANGS: dict[str, Lang] = {l.code: l for l in [
    Lang("am", "Amharic", "አማርኛ", "amh_Ethi", "am-ET", "mms", "amh", True),
    Lang("om", "Oromo", "Afaan Oromoo", "gaz_Latn", "om-ET", "mms", "orm", True),
    Lang("ti", "Tigrinya", "ትግርኛ", "tir_Ethi", "ti-ET", "mms", "tir", True),
    Lang("en", "English", "English", "eng_Latn", "en-US"),
    Lang("it", "Italian", "Italiano", "ita_Latn", "it-IT"),
    Lang("ar", "Arabic", "العربية", "arb_Arab", "ar-SA"),
    Lang("fr", "French", "Français", "fra_Latn", "fr-FR"),
    Lang("es", "Spanish", "Español", "spa_Latn", "es-ES"),
    Lang("de", "German", "Deutsch", "deu_Latn", "de-DE"),
    Lang("tr", "Turkish", "Türkçe", "tur_Latn", "tr-TR"),
    Lang("sw", "Swahili", "Kiswahili", "swh_Latn", "sw-KE"),
]}


class TurnError(ValueError):
    """A problem the person can fix (bad language, empty upload...)."""


class RateError(TurnError):
    """Too many turns in a minute."""


# ---------- audio in / out (memory only) ----------
def decode_upload(data: bytes, sr: int = config.SAMPLE_RATE) -> np.ndarray:
    """Browser recordings are webm/opus (Chrome) or mp4 (Safari): let FFmpeg read them from memory."""
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise TurnError("Recording is empty or too long.")
    proc = subprocess.run([ffmpeg_exe(), "-v", "error", "-i", "pipe:0", "-f", "f32le", "-ac", "1",
                           "-ar", str(sr), "pipe:1"], input=data, capture_output=True)
    if proc.returncode != 0 or not proc.stdout:
        raise TurnError("Could not read that recording.")
    return np.frombuffer(proc.stdout, dtype=np.float32).copy()


def wav_bytes(audio: np.ndarray, sr: int) -> bytes:
    import soundfile as sf
    buf = io.BytesIO()
    sf.write(buf, np.clip(audio, -1, 1), sr, format="WAV", subtype="PCM_16")
    return buf.getvalue()


# ---------- your voice, kept in memory only ----------
class VoiceBank:
    def __init__(self):
        self._d: dict[str, tuple[float, np.ndarray]] = {}
        self._lock = threading.Lock()

    def add(self, sid: str, audio: np.ndarray, sr: int):
        keep = int(config.REFERENCE_SECONDS * sr)
        with self._lock:
            now = time.time()
            self._d = {k: v for k, v in self._d.items() if now - v[0] < SESSION_TTL}
            old = self._d.get(sid, (0, np.zeros(0, np.float32)))[1]
            self._d[sid] = (now, np.concatenate([old, audio])[-keep:])

    def get(self, sid: str, sr: int) -> np.ndarray | None:
        with self._lock:
            item = self._d.get(sid)
        return item[1] if item is not None and len(item[1]) >= config.MIN_REFERENCE_SECONDS * sr else None


BANK = VoiceBank()
SAME_VOICE = float(os.environ.get("SAME_VOICE", speakers.THRESHOLD))   # cosine similarity that means "this is you"


class Expiring:
    """Tiny in-memory dict whose entries vanish after SESSION_TTL."""
    def __init__(self):
        self._d: dict = {}
        self._lock = threading.Lock()

    def put(self, key, value):
        with self._lock:
            now = time.time()
            self._d = {k: v for k, v in self._d.items() if now - v[0] < SESSION_TTL}
            self._d[key] = (now, value)

    def get(self, key):
        with self._lock:
            item = self._d.get(key)
        return item[1] if item and time.time() - item[0] < SESSION_TTL else None


ENROLLED = Expiring()      # session -> embedding of YOUR voice (numbers, not audio)
LAST_DIR = Expiring()      # session -> who spoke last (for clips too short to fingerprint)


class RateLimit:
    def __init__(self, n: int, per: float):
        self.n, self.per, self.hits = n, per, {}
        self._lock = threading.Lock()

    def check(self, key: str):
        with self._lock:
            now = time.time()
            q = [t for t in self.hits.get(key, []) if now - t < self.per]
            if len(q) >= self.n:
                self.hits[key] = q
                raise RateError("Too many turns in a minute. Wait a moment.")
            q.append(now)
            self.hits[key] = q
            if len(self.hits) > 2000:
                self.hits = {k: v for k, v in self.hits.items() if v and now - v[-1] < self.per}


RATE = RateLimit(int(os.environ.get("TURNS_PER_MINUTE", "40")), 60)
_gpu = threading.Lock()          # one turn at a time keeps GPU memory sane


# ---------- engines (replaceable through HOOKS, which is how the tests run without AI models) ----------
_mms_asr: dict = {}
_mms_tts: dict = {}


def asr_default(audio: np.ndarray, sr: int, lang: Lang) -> str:
    # Set ASR_AM=whisper (and ASR_WHISPER_SIZE=large-v3) to compare against MMS; see tools/asr_check.py.
    engine = os.environ.get(f"ASR_{lang.code.upper()}", lang.asr)
    if lang.code != "am" and lang.asr == "mms":
        engine = "mms"                                   # Whisper has no Oromo / Tigrinya
    if engine == "whisper":
        segs, _ = transcribe.transcribe(audio, sr, os.environ.get("ASR_WHISPER_SIZE", config.DEFAULT_WHISPER),
                                        language=lang.code)
        return " ".join(s.text for s in segs).strip()

    import torch
    from transformers import AutoProcessor, Wav2Vec2ForCTC
    device = config.pick_device()
    licences.require("facebook/mms-1b-all")
    model_id = "facebook/mms-1b-all"
    if "m" not in _mms_asr:
        _mms_asr["p"] = AutoProcessor.from_pretrained(model_id, target_lang=lang.mms)
        _mms_asr["m"] = Wav2Vec2ForCTC.from_pretrained(model_id, target_lang=lang.mms,
                                                       ignore_mismatched_sizes=True).to(device).eval()
        _mms_asr["lang"] = lang.mms
    proc, model = _mms_asr["p"], _mms_asr["m"]
    if _mms_asr["lang"] != lang.mms:                     # swap the small language adapter, not the whole model
        proc.tokenizer.set_target_lang(lang.mms)
        model.load_adapter(lang.mms)
        _mms_asr["lang"] = lang.mms
    x = resample(audio, sr, config.WHISPER_RATE)
    inputs = proc(x, sampling_rate=config.WHISPER_RATE, return_tensors="pt").to(device)
    with torch.no_grad():
        logits = model(**inputs).logits
    return proc.decode(torch.argmax(logits, dim=-1)[0]).strip()


def mt_default(text: str, src: Lang, dst: Lang) -> str:
    from . import memory
    mem = memory.get() if dst.code == "am" else None          # My Fixes are Amharic fixes
    if mem and (known := mem.lookup(text)):
        return known                                           # a sentence you corrected before: always right, instant
    try:
        out = translate.translate_nllb([text], src.code, dst.nllb)[0]
        return mem.fix_words(out) if mem else out
    except Exception as exc:
        if os.environ.get("ALLOW_ONLINE_MT") == "1":
            print(f"[converse] NLLB failed ({exc}); using online translation")
            return translate.translate_google([text], src.code, dst.code)[0]
        raise TurnError(f"Translation model not available: {exc}") from exc


def _plain_tts(text: str, lang: Lang) -> tuple[np.ndarray, int]:
    import torch
    from transformers import AutoTokenizer, VitsModel
    device = config.pick_device()
    if lang.mms not in _mms_tts:
        name = f"facebook/mms-tts-{lang.mms}"
        licences.require("facebook/mms-tts-amh / orm / tir")
        tok = AutoTokenizer.from_pretrained(name)
        model = VitsModel.from_pretrained(name).to(device).eval()
        rom = None
        if lang.code in ("am", "ti"):                    # Ge'ez script must be romanized for MMS-TTS
            import uroman
            tok.is_uroman = False
            rom = uroman.Uroman()
        _mms_tts[lang.mms] = (tok, model, rom)
    tok, model, rom = _mms_tts[lang.mms]
    if rom is not None:
        text = rom.romanize_string(text, lcode=lang.mms)
    inputs = tok(text.lower(), return_tensors="pt").to(device)
    if inputs["input_ids"].shape[-1] == 0:
        return np.zeros(0, np.float32), model.config.sampling_rate
    with torch.no_grad():
        wave = model(**inputs).waveform[0].cpu().numpy()
    return wave.astype(np.float32), model.config.sampling_rate


def tts_default(text: str, lang: Lang, reference: np.ndarray | None) -> tuple[np.ndarray, int] | None:
    """Server voice for Amharic / Oromo / Tigrinya, in YOUR voice when a reference exists.

    Voice conversion does not care about language, so one FreeVC model clones all three.
    Any failure (model missing, no GPU memory) returns None: the app then shows the text instead of crashing."""
    if not lang.server_tts:
        return None
    try:
        wave, sr = _plain_tts(text, lang)
        if reference is not None and len(wave) > 1600:
            conv = voice.get_converter()
            wave = conv.convert(resample(wave, sr, conv.sample_rate),
                                voice.prepare_reference(reference, config.SAMPLE_RATE), config.SAMPLE_RATE)
            sr = conv.sample_rate
        return wave, sr
    except Exception as exc:
        print(f"[converse] voice for {lang.name} failed ({type(exc).__name__}: {exc}); showing text only")
        return None


_enc: dict = {}


def embed_default(audio: np.ndarray, sr: int) -> np.ndarray:
    """Voice fingerprint (256 numbers) with Resemblyzer. Runs on the CPU, about 50 ms."""
    from resemblyzer import VoiceEncoder
    if "e" not in _enc:
        _enc["e"] = VoiceEncoder(device="cpu")
    return _enc["e"].embed_utterance(resample(audio, sr, config.WHISPER_RATE))


HOOKS = {"asr": asr_default, "mt": mt_default, "tts": tts_default, "embed": embed_default,
         "auto_ok": speakers.available}


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


def auto_available() -> bool:
    return bool(HOOKS["auto_ok"]())


def enroll(session: str, audio: np.ndarray, sr: int = config.SAMPLE_RATE) -> dict:
    """Learn YOUR voice once: lets the app tell you from the other person, and gives voice cloning its sample."""
    if not auto_available():
        raise TurnError("Voice recognition is not installed on the server (pip install resemblyzer webrtcvad-wheels).")
    if len(audio) < 2.0 * sr or float(np.sqrt(np.mean(audio ** 2))) < MIN_RMS:
        raise TurnError("Say a full sentence (about 5 seconds), a bit louder.")
    ENROLLED.put(session, HOOKS["embed"](audio, sr))
    BANK.add(session, audio, sr)
    return {"ok": True, "seconds": round(len(audio) / sr, 1)}


# ---- model warm-up: the first real turn must not take a minute ----
WARM = {"state": "idle", "msg": ""}


def warmup(my_code: str, their_code: str) -> None:
    if my_code not in LANGS or their_code not in LANGS or my_code == their_code:
        raise TurnError("Pick two different languages.")
    if WARM["state"] == "loading":
        return
    WARM.update(state="loading", msg="Loading models. The first time takes a minute or two.")
    threading.Thread(target=_warm, args=(LANGS[my_code], LANGS[their_code]), daemon=True).start()


def _warm(me: Lang, them: Lang) -> None:
    try:
        with _gpu:
            quiet = np.zeros(config.WHISPER_RATE, np.float32)
            for a, b in ((me, them), (them, me)):
                HOOKS["asr"](quiet, config.WHISPER_RATE, a)
                HOOKS["mt"]("hello", a, b)
                HOOKS["tts"]("hello", b, None)
            if auto_available():
                HOOKS["embed"](np.zeros(2 * config.WHISPER_RATE, np.float32) + 0.01, config.WHISPER_RATE)
        WARM.update(state="ready", msg="")
    except Exception as exc:
        print(f"[converse] warm-up problem: {type(exc).__name__}: {exc}")
        WARM.update(state="error", msg=f"Models are not ready: {exc}")



# ---------- one turn ----------
def process_turn(session: str, audio: np.ndarray, direction: str, my_code: str, their_code: str,
                 sr: int = config.SAMPLE_RATE) -> dict:
    """direction: 'hear' (they speak), 'say' (you speak) or 'auto' (decided by whose voice it is)."""
    if direction not in ("hear", "say", "auto"):
        raise TurnError("direction must be 'hear', 'say' or 'auto'")
    if my_code not in LANGS or their_code not in LANGS:
        raise TurnError("Unknown language.")
    if my_code == their_code:
        raise TurnError("Pick two different languages.")
    me, them = LANGS[my_code], LANGS[their_code]

    if len(audio) < MIN_SECONDS * sr or float(np.sqrt(np.mean(audio ** 2))) < MIN_RMS:
        return {"empty": True, "heard": "", "translated": ""}

    similarity = None
    if direction == "auto":
        mine = ENROLLED.get(session)
        if mine is None:
            raise TurnError("Record your voice first, so I can tell you apart from the other person.")
        if len(audio) >= 1.0 * sr:                       # shorter clips cannot be fingerprinted reliably
            similarity = cosine(HOOKS["embed"](audio, sr), mine)
            direction = "say" if similarity >= SAME_VOICE else "hear"
        else:
            direction = LAST_DIR.get(session) or "hear"
        LAST_DIR.put(session, direction)
    src, dst = (them, me) if direction == "hear" else (me, them)

    t0 = time.time()
    with _gpu:
        heard = HOOKS["asr"](audio, sr, src)
        t1 = time.time()
        if not heard:
            return {"empty": True, "heard": "", "translated": ""}
        translated = HOOKS["mt"](heard, src, dst)
        t2 = time.time()
        reference = None
        if direction == "say":                           # only YOUR voice ever becomes the cloning sample
            BANK.add(session, audio, sr)
            reference = BANK.get(session, sr)
        speech = HOOKS["tts"](translated, dst, reference)
        t3 = time.time()

    out = {"empty": False, "heard": heard, "translated": translated, "direction": direction,
           "similarity": None if similarity is None else round(similarity, 2),
           "speak_lang": dst.bcp47, "audio": None, "voice_cloned": bool(reference is not None and speech is not None),
           "ms": {"listen": int((t1 - t0) * 1000), "translate": int((t2 - t1) * 1000),
                  "speak": int((t3 - t2) * 1000)}}
    if speech is not None and len(speech[0]):
        out["audio"] = base64.b64encode(wav_bytes(*speech)).decode("ascii")
    return out


def handle_upload(data: bytes, session: str, direction: str, my_code: str, their_code: str, ip: str = "") -> dict:
    session = session[:64] or "anon"
    RATE.check(f"{ip}:{session}")
    return process_turn(session, decode_upload(data), direction, my_code, their_code)


def handle_enroll(data: bytes, session: str, ip: str = "") -> dict:
    session = session[:64] or "anon"
    RATE.check(f"{ip}:{session}")
    return enroll(session, decode_upload(data))


def status(session: str) -> dict:
    return {"auto": auto_available(), "enrolled": ENROLLED.get(session[:64] or "anon") is not None,
            "warm": dict(WARM)}


def public_langs() -> list[dict]:
    return [{"code": l.code, "name": l.name, "native": l.native, "bcp47": l.bcp47} for l in LANGS.values()]
