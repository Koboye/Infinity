"""Live speaker tracking, so different actors keep different cloned voices.

Optional: `pip install resemblyzer webrtcvad-wheels`. Without it everyone shares one voice.
"""
from __future__ import annotations

import numpy as np

from . import config
from .audio import resample

THRESHOLD = 0.72        # cosine similarity needed to treat two clips as the same person
MAX_SPEAKERS = 8


def available() -> bool:
    try:
        import resemblyzer  # noqa: F401
        return True
    except Exception:
        return False


class SpeakerTracker:
    def __init__(self):
        from resemblyzer import VoiceEncoder
        self.encoder = VoiceEncoder(device="cpu")
        self.centroids: list[np.ndarray] = []
        self.counts: list[int] = []
        self.last = "SPEAKER_00"

    def identify(self, audio: np.ndarray, sr: int) -> str:
        """Return a speaker label for this piece of speech (updates the known voices)."""
        if len(audio) < sr:                       # under 1 s is too short to fingerprint
            return self.last
        emb = self.encoder.embed_utterance(resample(audio, sr, 16_000))
        best, best_sim = -1, -1.0
        for k, c in enumerate(self.centroids):
            sim = float(np.dot(emb, c) / (np.linalg.norm(emb) * np.linalg.norm(c) + 1e-9))
            if sim > best_sim:
                best, best_sim = k, sim
        if best >= 0 and (best_sim >= THRESHOLD or len(self.centroids) >= MAX_SPEAKERS):
            n = self.counts[best]
            self.centroids[best] = (self.centroids[best] * n + emb) / (n + 1)
            self.counts[best] = n + 1
        else:
            self.centroids.append(emb)
            self.counts.append(1)
            best = len(self.centroids) - 1
        self.last = f"SPEAKER_{best:02d}"
        return self.last
