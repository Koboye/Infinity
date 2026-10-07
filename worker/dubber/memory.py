"""My Fixes: the app remembers every correction you make and never repeats the mistake.

Two kinds of memory, both saved in `my_fixes.json` next to the app:
  * lines  - a whole sentence you corrected ("Hello, how are you?" -> your Amharic). Next time the
             same sentence appears, YOUR wording is used and the AI is not asked at all (100% right, instant).
  * words  - a wrong Amharic word the AI keeps producing -> the right one (names, brands, place names).
"""
from __future__ import annotations

import json
import re
import threading
from pathlib import Path

from . import config

_WS = re.compile(r"\s+")
_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)


def normalize(text: str) -> str:
    """Compare sentences ignoring case, punctuation and spacing."""
    return _WS.sub(" ", _PUNCT.sub(" ", text.lower())).strip()


class Memory:
    def __init__(self, path: Path | None = None):
        self.path = Path(path) if path else config.FIXES_FILE
        self._lock = threading.Lock()
        self.lines: dict[str, dict[str, str]] = {}      # normalized source -> {"src": original, "am": fixed}
        self.words: dict[str, str] = {}                 # wrong -> right
        self._load()

    # ---------- storage ----------
    def _load(self):
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            self.lines = data.get("lines", {})
            self.words = data.get("words", {})
        except (OSError, ValueError):
            pass

    def _save(self):
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps({"lines": self.lines, "words": self.words}, ensure_ascii=False, indent=1),
                       encoding="utf-8")
        tmp.replace(self.path)

    # ---------- teach ----------
    def teach_line(self, source: str, amharic: str) -> bool:
        key = normalize(source)
        amharic = amharic.strip()
        if not key or not amharic:
            return False
        with self._lock:
            self.lines[key] = {"src": source.strip(), "am": amharic}
            self._save()
        return True

    def teach_word(self, wrong: str, right: str) -> bool:
        wrong, right = wrong.strip(), right.strip()
        if not wrong or not right or wrong == right:
            return False
        with self._lock:
            self.words[wrong] = right
            self._save()
        return True

    def forget_line(self, source: str):
        with self._lock:
            self.lines.pop(normalize(source), None)
            self._save()

    def forget_word(self, wrong: str):
        with self._lock:
            self.words.pop(wrong.strip(), None)
            self._save()

    # ---------- use ----------
    def lookup(self, source: str) -> str | None:
        hit = self.lines.get(normalize(source))
        return hit["am"] if hit else None

    def fix_words(self, text: str) -> str:
        # longest first, so a two-word fix wins over a one-word fix it contains
        for wrong in sorted(self.words, key=len, reverse=True):
            text = text.replace(wrong, self.words[wrong])
        return text

    def rows(self) -> tuple[list[list[str]], list[list[str]]]:
        return ([[v["src"], v["am"]] for v in self.lines.values()],
                [[k, v] for k, v in self.words.items()])

    def replace_all(self, line_rows, word_rows):
        """Used by the editable tables in the UI: whatever is in the tables becomes the memory."""
        lines, words = {}, {}
        for r in line_rows or []:
            if len(r) >= 2 and str(r[0]).strip() and str(r[1]).strip():
                lines[normalize(str(r[0]))] = {"src": str(r[0]).strip(), "am": str(r[1]).strip()}
        for r in word_rows or []:
            if len(r) >= 2 and str(r[0]).strip() and str(r[1]).strip():
                words[str(r[0]).strip()] = str(r[1]).strip()
        with self._lock:
            self.lines, self.words = lines, words
            self._save()


_memory: Memory | None = None


def get() -> Memory:
    global _memory
    if _memory is None:
        _memory = Memory()
    return _memory
