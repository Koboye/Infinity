"""Central settings. Change values here, not all over the code."""
from __future__ import annotations

import os
from pathlib import Path

APP_NAME = "Dimts"                 # ድምጽ = "voice" in Amharic
APP_NAME_AM = "ድምጽ"
TAGLINE = "Hear the world in Amharic. In every speaker's own voice."

ROOT = Path(__file__).resolve().parent.parent
FIXES_FILE = ROOT / "my_fixes.json"   # corrections the app remembers (see dubber/memory.py)
WORK_DIR = ROOT / "workspace"      # temporary files while dubbing
OUTPUT_DIR = ROOT / "outputs"      # finished videos / audio
MODELS_DIR = ROOT / "models"       # put fine-tuned checkpoints here later

SAMPLE_RATE = 24_000               # all audio is mixed at this rate
WHISPER_RATE = 16_000

REFERENCE_SECONDS = 10             # length of the voice sample used for cloning
MIN_REFERENCE_SECONDS = 3
MAX_STRETCH = 1.45                 # never speed speech up more than this
DEFAULT_BG_VOLUME = 0.15           # original track volume under the dub (0-1)

HF_TOKEN = os.environ.get("HF_TOKEN", "")   # only needed for speaker separation

TARGET_LANGUAGES = {"Amharic (አማርኛ)": "amh_Ethi"}
WHISPER_SIZES = ["tiny", "base", "small", "medium", "large-v3"]
DEFAULT_WHISPER = "small"

WORK_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)


def pick_device() -> str:
    """cuda (NVIDIA GPU) > mps (Apple chip) > cpu."""
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
    except ImportError:
        pass
    return "cpu"
