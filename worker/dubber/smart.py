"""Smart defaults: the person never has to pick a model, a delay or a setting.

The app looks at the computer once and chooses everything, then keeps adjusting while it runs.
"""
from __future__ import annotations

import math
import threading
from dataclasses import dataclass

from . import config


@dataclass(frozen=True)
class Profile:
    device: str              # cuda / mps / cpu
    vram_gb: float
    live_model: str          # Whisper size for Watch Now
    best_model: str          # Whisper size for Best Quality
    can_go_live: bool        # fast enough for real-time dubbing
    headline: str            # one plain sentence for the screen
    engine: str = "mms_freevc"   # voice engine: mms_freevc copies voices, mms_light is 2-3x faster


def detect() -> Profile:
    device = config.pick_device()
    vram = 0.0
    if device == "cuda":
        try:
            import torch
            vram = torch.cuda.get_device_properties(0).total_memory / 1e9
        except Exception:
            pass
    return profile_for(device, vram)


def profile_for(device: str, vram_gb: float = 0.0) -> Profile:
    if device == "cuda" and vram_gb >= 10:
        return Profile(device, vram_gb, "small", "large-v3", True,
                       "Powerful graphics card found. Live dubbing runs at full quality.")
    if device == "cuda":
        return Profile(device, vram_gb, "base", "medium", True,
                       "Graphics card found. Live dubbing works; Best Quality takes a little longer.")
    if device == "mps":
        return Profile(device, vram_gb, "base", "small", False,
                       "Apple chip found. Best Quality works well; live dubbing may pause now and then.", "mms_light")
    return Profile(device, vram_gb, "tiny", "small", False,
                   "No graphics card found. Best Quality works but is slow (about 6x the video length). "
                   "Live dubbing needs an NVIDIA card. Fast mode is on: one standard Amharic voice instead of copying each speaker.",
                   "mms_light")


def buffer_chunks(rtf: float) -> int:
    """How many dubbed pieces to collect before playback starts, from measured speed.

    rtf = seconds of work per second of video. Fast machine -> start after 1 piece (~10 s behind);
    slower machine -> wait longer so playback never stalls.
    """
    if rtf <= 0.55:
        return 1
    if rtf <= 0.8:
        return 2
    if rtf <= 1.0:
        return 3
    return 4


def source_kind(link: str | None, video_path: str | None) -> str:
    """'file' for an upload, 'live' for a stream link, 'link' for anything else."""
    if video_path and not (link or "").strip():
        return "file"
    low = (link or "").lower().split("?")[0]
    if low.endswith(".m3u8") or low.startswith(("rtmp", "rtsp")) or "/live" in low:
        return "live"
    return "link"


# ---------- start the heavy models in the background so the first dub is not slow ----------
_state = {"stage": "idle", "detail": ""}
_lock = threading.Lock()


def preload_status() -> dict:
    return dict(_state)


def preload(profile: Profile | None = None) -> None:
    """Load the AI models once at startup, in a background thread. Safe to call many times."""
    with _lock:
        if _state["stage"] in ("loading", "ready"):
            return
        _state["stage"] = "loading"
    prof = profile or detect()

    def work():
        steps = [("Listening model", lambda: _warm_asr(prof)),
                 ("Translator", lambda: _warm_mt()),
                 ("Voices", lambda: _warm_voice())]
        try:
            for name, fn in steps:
                _state["detail"] = f"Loading {name}"
                fn()
            _state.update(stage="ready", detail="Everything is loaded. Dubbing starts instantly.")
        except Exception as exc:                        # models not installed / no internet on first run
            _state.update(stage="partial", detail=f"Some models will load on first use ({type(exc).__name__}).")

    threading.Thread(target=work, daemon=True).start()


def _warm_asr(prof):
    import numpy as np
    from . import transcribe
    transcribe.transcribe(np.zeros(config.SAMPLE_RATE, dtype=np.float32), config.SAMPLE_RATE, prof.live_model)


def _warm_mt():
    from . import translate
    translate.translate(["hello"], "en", use_memory=False)


def _warm_voice():
    from . import voice
    voice.get_engine("mms_freevc")


def eta_text(profile: Profile, video_seconds: float, mode: str) -> str:
    """Plain-words time estimate shown before the person presses the button."""
    if mode == "live":
        return "Starts playing about 10-20 seconds after you press the button." if profile.can_go_live \
            else "Your computer may pause while it catches up. Best Quality is safer."
    factor = {"cuda": 0.7, "mps": 2.5, "cpu": 6.0}.get(profile.device, 6.0)
    minutes = max(1, math.ceil(video_seconds * factor / 60))
    return f"Takes about {minutes} minute{'s' if minutes != 1 else ''} for this video."
