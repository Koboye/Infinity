"""People and limits.

Open mode (nothing configured): everyone is the local user. Use it on your own computer.
Shared mode: set  DIMTS_TOKENS="alice:code1,bob:code2"  (or the old TRANSLATOR_TOKEN for one shared code).
Every page and API then needs a code, and each person gets their own rate limit and job slot.
"""
from __future__ import annotations

import hmac
import os
import threading
from contextlib import contextmanager


def _load() -> dict[str, str]:
    users = {}
    for part in os.environ.get("DIMTS_TOKENS", "").split(","):
        if ":" in part:
            name, code = part.split(":", 1)
            if name.strip() and code.strip():
                users[name.strip()] = code.strip()
    if os.environ.get("TRANSLATOR_TOKEN"):
        users.setdefault("shared", os.environ["TRANSLATOR_TOKEN"])
    return users


USERS = _load()
OPEN = not USERS


def authenticate(token: str) -> str | None:
    """Return the user's name for a valid code, None if wrong. In open mode everybody is 'local'."""
    if OPEN:
        return "local"
    token = token or ""
    found = None
    for name, code in USERS.items():                 # no early exit: constant work whoever matches
        if hmac.compare_digest(token, code):
            found = name
    return found


def gradio_auth(username: str, password: str) -> bool:
    code = USERS.get(username)
    return bool(code) and hmac.compare_digest(password or "", code)


# ---------- fair use of the GPU and of live-job slots ----------
_GPU = threading.BoundedSemaphore(int(os.environ.get("DIMTS_GPU_SLOTS", "1")))


@contextmanager
def gpu():
    """Heavy AI work takes turns, so two people never run the GPU out of memory together."""
    with _GPU:
        yield


class JobLimiter:
    def __init__(self, per_user: int, total: int):
        self.per_user, self.total = per_user, total
        self._by_user: dict[str, int] = {}
        self._lock = threading.Lock()

    def acquire(self, user: str) -> None:
        with self._lock:
            if sum(self._by_user.values()) >= self.total:
                raise RuntimeError("The server is busy right now. Try again in a few minutes.")
            if self._by_user.get(user, 0) >= self.per_user:
                raise RuntimeError("You already have a live dub running. Stop it first.")
            self._by_user[user] = self._by_user.get(user, 0) + 1

    def release(self, user: str) -> None:
        with self._lock:
            if self._by_user.get(user, 0) > 0:
                self._by_user[user] -= 1


LIVE_JOBS = JobLimiter(int(os.environ.get("DIMTS_JOBS_PER_USER", "1")), int(os.environ.get("DIMTS_JOBS_TOTAL", "2")))
