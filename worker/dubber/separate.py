"""Optional: remove voices from the movie sound, keeping music and effects (Demucs).

Needs `pip install demucs`. About real-time speed on a GPU, too slow on CPU.
If anything is missing, callers fall back to simple ducking.
"""
from __future__ import annotations

import numpy as np

from . import config
from .audio import resample

_model = {}


def available() -> bool:
    try:
        import demucs  # noqa: F401
        return True
    except ImportError:
        return False


def background_only(audio: np.ndarray, sr: int) -> np.ndarray:
    """Return the audio with vocals removed, same length and rate as the input."""
    import torch
    from demucs.apply import apply_model
    from demucs.pretrained import get_model

    device = "cuda" if config.pick_device() == "cuda" else "cpu"
    if "m" not in _model:
        _model["m"] = get_model("htdemucs").to(device).eval()
    model = _model["m"]
    x = resample(audio, sr, model.samplerate)
    wav = torch.from_numpy(np.stack([x, x])).unsqueeze(0).to(device)        # (1, 2, T) fake stereo
    with torch.no_grad():
        stems = apply_model(model, wav, device=device, split=True, overlap=0.1)[0]   # (S, 2, T)
    keep = [i for i, name in enumerate(model.sources) if name != "vocals"]
    bg = stems[keep].sum(dim=0).mean(dim=0).cpu().numpy()
    out = resample(bg, model.samplerate, sr)
    if len(out) < len(audio):
        out = np.pad(out, (0, len(audio) - len(out)))
    return out[: len(audio)].astype(np.float32)
