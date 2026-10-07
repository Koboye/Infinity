"""Quality control: find the lines most likely to be wrong, so the person checks those first.

Speech recognition and translation errors compound. Instead of pretending they do not happen,
every line gets checked here and flagged in plain words when something looks off.
"""
from __future__ import annotations

import re

_ETHIOPIC = re.compile(r"[ሀ-፿ᎀ-᎟ⶀ-⷟꬀-꬯]")
_DIGITS = re.compile(r"\d+")


def has_ethiopic(text: str) -> bool:
    return bool(_ETHIOPIC.search(text))


def _loops(text: str) -> bool:
    """The classic translation failure: the same word repeated again and again."""
    words = text.split()
    if len(words) >= 5 and max(words.count(w) for w in set(words)) >= max(4, len(words) * 0.6):
        return True
    return bool(re.search(r"(.{3,}?)\1{3,}", text))


def check_translation(source: str, amharic: str) -> list[str]:
    """Problems with one translated line. Empty list = looks fine."""
    problems = []
    src, am = source.strip(), amharic.strip()
    if not am:
        return ["no translation"]
    if not has_ethiopic(am):
        problems.append("not Amharic script")
    if _loops(am):
        problems.append("repeating words")
    if len(src) > 12:
        ratio = len(am) / max(len(src), 1)
        if ratio < 0.2:
            problems.append("translation too short")
        elif ratio > 3.0:
            problems.append("translation too long")
    missing = [d for d in _DIGITS.findall(src) if d not in am]
    if missing and has_ethiopic(am) and len(missing) == len(_DIGITS.findall(src)):
        problems.append("numbers missing")
    return problems


def check_listening(confidence: float, no_speech: float = 0.0, compression: float = 1.0,
                    text: str = "", seconds: float = 0.0) -> list[str]:
    """Problems with one heard line (confidence is 0..1, from the speech model)."""
    problems = []
    if confidence < 0.45:
        problems.append("hard to hear")
    if no_speech > 0.6:
        problems.append("maybe no speech")
    if compression > 2.4:
        problems.append("repeating sound")
    if seconds > 0.3 and len(text) / seconds > 28:
        problems.append("too fast to be right")
    return problems


def label(problems: list[str]) -> str:
    return "✓" if not problems else "⚠ " + ", ".join(problems)
