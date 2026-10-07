"""Step D: Amharic voice cloning.

Why two models?
  XTTS v2 does not know Amharic, and fine-tuning it needs lots of Amharic speech data.
  So the default engine works in two stages, with no training needed:
    1. Meta MMS-TTS speaks the Amharic text in a neutral voice.
    2. FreeVC (zero-shot voice conversion) re-colours that speech to match a short
       reference clip of the target speaker.
  Later, a fine-tuned XTTS / F5-TTS model can be plugged in through the same interface.
"""
from __future__ import annotations

import uuid

import numpy as np

from . import config, licences
from .audio import load_audio, resample, save_audio

_cache = {}


class VoiceEngine:
    name = "base"
    sample_rate = config.SAMPLE_RATE

    def synthesize(self, text: str, reference: np.ndarray, ref_sr: int) -> np.ndarray:
        """Return mono float32 audio at self.sample_rate."""
        raise NotImplementedError


class MmsFreeVCEngine(VoiceEngine):
    name = "mms_freevc"
    sample_rate = 24_000

    def __init__(self, load_tts: bool = True, with_vc: bool = True):
        import torch

        self.device = config.pick_device()
        self._torch = torch
        if load_tts:                                 # converter-only mode skips the Amharic speaker
            licences.require("facebook/mms-tts-amh / orm / tir")
            from transformers import AutoTokenizer, VitsModel
            import uroman
            self.tokenizer = AutoTokenizer.from_pretrained("facebook/mms-tts-amh")
            self.tokenizer.is_uroman = False         # we romanize ourselves (see _romanize)
            self.tts = VitsModel.from_pretrained("facebook/mms-tts-amh").to(self.device).eval()
            self.uroman = uroman.Uroman()

        self.vc = None
        if with_vc:                                  # the voice-copying step is the slowest part on a laptop
            from TTS.api import TTS
            self.vc = TTS("voice_conversion_models/multilingual/vctk/freevc24").to(self.device)

    def _romanize(self, text: str) -> str:
        # MMS-TTS-amh was trained on romanized text (Ge'ez script -> Latin letters).
        return self.uroman.romanize_string(text, lcode="amh").lower()

    def _speak(self, text: str) -> np.ndarray:
        inputs = self.tokenizer(self._romanize(text), return_tensors="pt").to(self.device)
        if inputs["input_ids"].shape[-1] == 0:
            return np.zeros(0, dtype=np.float32)
        with self._torch.no_grad():
            wave = self.tts(**inputs).waveform[0].cpu().numpy()
        return resample(wave, self.tts.config.sampling_rate, self.sample_rate)

    def synthesize(self, text: str, reference: np.ndarray, ref_sr: int) -> np.ndarray:
        base = self._speak(text)
        return self.convert(base, reference, ref_sr) if self.vc is not None else base

    def convert(self, base: np.ndarray, reference: np.ndarray, ref_sr: int) -> np.ndarray:
        """Re-colour speech (any language, at self.sample_rate) so it sounds like the reference voice.

        FreeVC needs real files, so the reference is written to workspace/ for a moment and deleted at once."""
        if len(base) < 1600:
            return base
        tag = uuid.uuid4().hex[:8]
        src = config.WORK_DIR / f"_vc_source_{tag}.wav"
        ref = config.WORK_DIR / f"_vc_reference_{tag}.wav"
        save_audio(src, base, self.sample_rate)
        save_audio(ref, resample(reference, ref_sr, 16_000), 16_000)
        try:
            converted = self.vc.voice_conversion(source_wav=str(src), target_wav=str(ref))
        finally:
            src.unlink(missing_ok=True)
            ref.unlink(missing_ok=True)
        return np.asarray(converted, dtype=np.float32).reshape(-1)   # FreeVC24 outputs 24 kHz


class MmsLightEngine(MmsFreeVCEngine):
    """Fast mode for computers without a graphics card: one standard Amharic voice, no voice copying (about 2-3x faster)."""
    name = "mms_light"

    def __init__(self):
        super().__init__(load_tts=True, with_vc=False)


class XttsFineTunedEngine(VoiceEngine):
    """Placeholder for Phase 3: an XTTS v2 / F5-TTS checkpoint fine-tuned on Amharic."""
    name = "xtts_finetuned"

    def __init__(self):
        raise NotImplementedError(
            "No fine-tuned Amharic checkpoint yet. Put one in the 'models/' folder after "
            "Phase 3 (fine-tuning), then implement loading here.")


ENGINES = {"mms_freevc": MmsFreeVCEngine, "mms_light": MmsLightEngine, "xtts_finetuned": XttsFineTunedEngine}


def get_converter() -> "MmsFreeVCEngine":
    """Voice converter only (no Amharic speaker): used to clone your voice onto Oromo / Tigrinya / Amharic speech."""
    if "vc_only" not in _cache:
        _cache["vc_only"] = MmsFreeVCEngine(load_tts=False)
    return _cache["vc_only"]


def get_engine(name: str = "mms_freevc") -> VoiceEngine:
    if name not in _cache:
        _cache[name] = ENGINES[name]()
    return _cache[name]


# ---------- reference clips ----------
def prepare_reference(audio: np.ndarray, sr: int, seconds: float = config.REFERENCE_SECONDS) -> np.ndarray:
    """Trim a user clip to its loudest `seconds` window (skips silence at the start)."""
    n = int(seconds * sr)
    if len(audio) <= n:
        return audio
    hop = sr // 2
    energies = [float(np.mean(audio[i:i + n] ** 2)) for i in range(0, len(audio) - n + 1, hop)]
    i = int(np.argmax(energies)) * hop
    return audio[i:i + n]


def reference_from_segments(audio: np.ndarray, sr: int, spans: list[tuple[float, float]],
                            seconds: float = config.REFERENCE_SECONDS) -> np.ndarray:
    """Build a voice sample for one speaker by joining their longest lines up to `seconds`."""
    pieces, total = [], 0.0
    for start, end in sorted(spans, key=lambda s: s[1] - s[0], reverse=True):
        pieces.append(audio[int(start * sr):int(end * sr)])
        total += end - start
        if total >= seconds:
            break
    return np.concatenate(pieces)[: int(seconds * sr)] if pieces else audio[: int(seconds * sr)]
