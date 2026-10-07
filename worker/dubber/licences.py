"""Licence registry: which model may be used for what.

Run for yourself or in a research / pilot setting: everything works (the default).
Set  DIMTS_COMMERCIAL=1  before selling or offering it as a paid service: models whose licence forbids
commercial use are then blocked with a clear message instead of silently putting you in breach.

Statuses are my best reading of each model's published licence. Confirm each one with a lawyer
before launch (python tools/check_models.py prints the live licence from Hugging Face).
"""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Model:
    name: str
    used_for: str
    licence: str
    commercial: str          # "yes", "no" or "verify"


REGISTRY = {m.name: m for m in [
    Model("whisper / faster-whisper", "listening (all languages except best Amharic)", "MIT", "yes"),
    Model("facebook/nllb-200-distilled-600M", "translation", "CC-BY-NC 4.0", "no"),
    Model("facebook/mms-1b-all", "listening to Amharic, Oromo, Tigrinya", "CC-BY-NC 4.0", "no"),
    Model("facebook/mms-tts-amh / orm / tir", "speaking Amharic, Oromo, Tigrinya", "CC-BY-NC 4.0", "no"),
    Model("FreeVC (coqui freevc24)", "copying a speaker's voice", "MIT code; check the weights and training data", "verify"),
    Model("XTTS v2", "voice cloning (not used by default)", "Coqui Public Model Licence (non-commercial)", "no"),
    Model("pyannote speaker-diarization-3.1", "telling speakers apart", "MIT, gated: accept terms on Hugging Face", "verify"),
    Model("resemblyzer", "telling you from the other person", "Apache 2.0", "yes"),
    Model("demucs", "removing original voices", "MIT", "yes"),
    Model("yt-dlp", "downloading links", "Unlicense. Downloading content can breach a site's terms or copyright", "verify"),
]}

COMMERCIAL = os.environ.get("DIMTS_COMMERCIAL") == "1"


class LicenceBlocked(RuntimeError):
    pass


def require(name: str) -> None:
    """Call before loading a model. In commercial mode a non-commercial model is refused."""
    m = REGISTRY.get(name)
    if COMMERCIAL and m and m.commercial == "no":
        raise LicenceBlocked(
            f"'{m.name}' ({m.licence}) cannot be used commercially. Replace it with a commercially licensed model "
            f"(see LICENCES.md), or unset DIMTS_COMMERCIAL for personal / research use.")


def table_markdown() -> str:
    rows = ["| Model | Used for | Licence | Commercial use |", "|---|---|---|---|"]
    rows += [f"| {m.name} | {m.used_for} | {m.licence} | {m.commercial} |" for m in REGISTRY.values()]
    return "\n".join(rows)
