"""Input safety: a link or file typed by a visitor must never let them reach the server's own files or network.

Without this, a visitor could type /etc/passwd or http://169.254.169.254/ (cloud secrets) as the "video".
"""
from __future__ import annotations

import ipaddress
import os
import socket
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from . import config

ALLOWED_SCHEMES = {"http", "https", "rtmp", "rtmps", "rtsp"}


class UnsafeInput(ValueError):
    """Raised with a message that is safe to show to the person."""


def _is_public(ip: str) -> bool:
    a = ipaddress.ip_address(ip.split("%")[0])
    return not (a.is_private or a.is_loopback or a.is_link_local or a.is_multicast
                or a.is_reserved or a.is_unspecified)


def validate_link(link: str) -> str:
    """Accept only public web / stream links. Rejects file paths, file:// and private-network addresses."""
    link = (link or "").strip()
    u = urlparse(link)
    if u.scheme.lower() not in ALLOWED_SCHEMES or not u.hostname:
        raise UnsafeInput("That does not look like a web link. Paste a YouTube, stream or video link that starts with https://")
    if os.environ.get("DIMTS_ALLOW_PRIVATE_LINKS") == "1":      # for a trusted home network only
        return link
    try:
        addrs = {i[4][0] for i in socket.getaddrinfo(u.hostname, u.port or 443, proto=socket.IPPROTO_TCP)}
    except socket.gaierror:
        raise UnsafeInput("Could not find that website. Check the link.")
    if not addrs or not all(_is_public(a) for a in addrs):
        raise UnsafeInput("Links to private or local addresses are not allowed.")
    return link


def _roots() -> list[Path]:
    roots = [Path(tempfile.gettempdir()), config.WORK_DIR, config.OUTPUT_DIR]
    if os.environ.get("GRADIO_TEMP_DIR"):
        roots.append(Path(os.environ["GRADIO_TEMP_DIR"]))
    return [r.resolve() for r in roots]


def validate_local_file(path: str) -> str:
    """Accept only files inside the app's own upload / work folders (what the upload box produces)."""
    p = Path(path).resolve()
    if not p.is_file() or not any(p == r or r in p.parents for r in _roots()):
        raise UnsafeInput("That file cannot be used. Upload it with the upload box.")
    return str(p)
