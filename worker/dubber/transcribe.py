"""Step B: speech recognition (Whisper) and optional speaker separation."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from . import config
from .audio import resample

_whisper = {}


@dataclass
class Segment:
    start: float
    end: float
    text: str
    speaker: str = "SPEAKER_00"
    translated: str = ""
    confidence: float = 1.0          # 0..1 from the speech model
    flags: list = None               # plain-words problems found by dubber.quality

    def __post_init__(self):
        if self.flags is None:
            self.flags = []


def transcribe(audio: np.ndarray, sr: int, model_size: str = config.DEFAULT_WHISPER,
               language: str | None = None, prompt: str | None = None) -> tuple[list[Segment], str]:
    """Return timed text segments and the language code (e.g. 'en', 'tr').

    Pass `language` to skip auto-detection (used by live mode after the first chunk).
    """
    from faster_whisper import WhisperModel

    device = config.pick_device()
    # faster-whisper supports cuda and cpu (not mps)
    device = "cuda" if device == "cuda" else "cpu"
    key = (model_size, device)
    if key not in _whisper:
        compute = "float16" if device == "cuda" else "int8"
        _whisper[key] = WhisperModel(model_size, device=device, compute_type=compute)
    model = _whisper[key]

    audio16 = resample(audio, sr, config.WHISPER_RATE)
    raw, info = model.transcribe(audio16, vad_filter=True, beam_size=5,
                                  language=language, condition_on_previous_text=False,
                                  initial_prompt=prompt or None)      # previous words help names and cut sentences
    from . import quality
    segments = []
    for s in raw:
        if not s.text.strip():
            continue
        seg = Segment(s.start, s.end, s.text.strip(), confidence=float(np.exp(min(0.0, s.avg_logprob))))
        seg.flags = quality.check_listening(seg.confidence, getattr(s, "no_speech_prob", 0.0),
                                            getattr(s, "compression_ratio", 1.0), seg.text, s.end - s.start)
        segments.append(seg)
    return segments, info.language


def diarize(audio: np.ndarray, sr: int, segments: list[Segment]) -> bool:
    """Label each segment with a speaker. Needs pyannote.audio and HF_TOKEN.

    Returns True if it ran, False if skipped (then everyone is SPEAKER_00).
    """
    if not config.HF_TOKEN:
        return False
    try:
        import torch
        from pyannote.audio import Pipeline
    except ImportError:
        return False

    try:
        pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", token=config.HF_TOKEN)
    except TypeError:                                   # older pyannote versions
        pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=config.HF_TOKEN)
    if pipe is None:
        return False
    if config.pick_device() == "cuda":
        pipe.to(torch.device("cuda"))

    wave = torch.from_numpy(resample(audio, sr, config.WHISPER_RATE)).unsqueeze(0)
    result = pipe({"waveform": wave, "sample_rate": config.WHISPER_RATE})
    annotation = getattr(result, "speaker_diarization", result)
    turns = [(t.start, t.end, spk) for t, _, spk in annotation.itertracks(yield_label=True)]

    for seg in segments:
        overlap: dict[str, float] = {}
        for t0, t1, spk in turns:
            o = min(seg.end, t1) - max(seg.start, t0)
            if o > 0:
                overlap[spk] = overlap.get(spk, 0.0) + o
        if overlap:
            seg.speaker = max(overlap, key=overlap.get)
    return True
