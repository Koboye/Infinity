"""Fetch a video from a YouTube (or other) link."""
from __future__ import annotations

from pathlib import Path

from . import config, safety


def download_video(url: str) -> str:
    import yt_dlp
    url = safety.validate_link(url)

    opts = {
        "outtmpl": str(config.WORK_DIR / "download_%(id)s.%(ext)s"),
        "format": "bv*[height<=720]+ba/b[height<=720]/b",
        "merge_output_format": "mp4",
        "noplaylist": True,
        "quiet": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        path = Path(ydl.prepare_filename(info)).with_suffix(".mp4")
    if not path.exists():
        raise RuntimeError("Download finished but the video file was not found.")
    return str(path)
