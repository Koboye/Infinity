"""Plain scoring maths for the benchmark (no AI models needed, so it is unit-tested)."""
from __future__ import annotations

import re
from collections import Counter

_PUNCT = re.compile(r"[\s።፣፤፥፦፧፨.,;:!?\"'()\-–—]+")


def norm(text: str) -> str:
    return _PUNCT.sub(" ", text.lower()).strip()


def edit_distance(a, b) -> int:
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def cer(ref: str, hyp: str) -> float:
    ref, hyp = norm(ref), norm(hyp)
    return edit_distance(ref, hyp) / max(1, len(ref))


def wer(ref: str, hyp: str) -> float:
    r, h = norm(ref).split(), norm(hyp).split()
    return edit_distance(r, h) / max(1, len(r))


def chrf(ref: str, hyp: str, n: int = 6, beta: float = 2.0) -> float:
    """Character n-gram F-score (0..1, higher is better). The standard fair metric for Amharic translation."""
    ref, hyp = norm(ref).replace(" ", ""), norm(hyp).replace(" ", "")
    if not ref or not hyp:
        return 0.0
    scores = []
    for k in range(1, n + 1):
        rc = Counter(ref[i:i + k] for i in range(len(ref) - k + 1))
        hc = Counter(hyp[i:i + k] for i in range(len(hyp) - k + 1))
        if not rc or not hc:
            continue
        overlap = sum((rc & hc).values())
        p, r = overlap / sum(hc.values()), overlap / sum(rc.values())
        scores.append(0.0 if p + r == 0 else (1 + beta ** 2) * p * r / (beta ** 2 * p + r))
    return sum(scores) / len(scores) if scores else 0.0


# go / no-go rules of thumb. They are guides, not laws: tune them with your first real users.
THRESHOLDS = {"asr_cer": 0.15, "mt_chrf": 0.40, "tts_cer": 0.15, "live_rtf": 0.8}


def verdict(results: dict) -> dict[str, str]:
    """Turn raw numbers into 'PASS' / 'FAIL' per stage."""
    out = {}
    if "asr_cer" in results:
        out["listening"] = "PASS" if results["asr_cer"] <= THRESHOLDS["asr_cer"] else "FAIL"
    if "mt_chrf" in results:
        out["translation"] = "PASS" if results["mt_chrf"] >= THRESHOLDS["mt_chrf"] else "FAIL"
    if "tts_cer" in results:
        out["speaking"] = "PASS" if results["tts_cer"] <= THRESHOLDS["tts_cer"] else "FAIL"
    if "live_rtf" in results:
        out["live speed"] = "PASS" if results["live_rtf"] <= THRESHOLDS["live_rtf"] else "FAIL"
    return out
