"""Step A and E: audio extraction, timing, mixing and putting audio back into video.

Uses the FFmpeg binary that ships with `imageio-ffmpeg`, so nothing extra to install.
Video is copied, not re-encoded, which makes the final step take seconds.
"""
from __future__ import annotations

import subprocess
import uuid
from math import gcd
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

from . import config


def ffmpeg_exe() -> str:
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def _run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"FFmpeg failed:\n{proc.stderr[-1500:]}")


# ---------- read / write ----------
def load_audio(path: str | Path, sr: int = config.SAMPLE_RATE) -> np.ndarray:
    """Load any wav/flac/ogg file as mono float32 at `sr`."""
    data, file_sr = sf.read(str(path), dtype="float32", always_2d=True)
    return resample(data.mean(axis=1), file_sr, sr)


AI_LABEL = "AI-generated voice and dubbing made with Dimts"


def save_audio(path: str | Path, audio: np.ndarray, sr: int = config.SAMPLE_RATE, label: bool = False) -> str:
    with sf.SoundFile(str(path), "w", samplerate=sr, channels=1, subtype="PCM_16") as f:
        if label:                                     # honest labelling: the file says it is synthetic
            f.comment = AI_LABEL
        f.write(np.clip(audio, -1.0, 1.0))
    return str(path)


def resample(audio: np.ndarray, src_sr: int, dst_sr: int) -> np.ndarray:
    if src_sr == dst_sr:
        return audio.astype(np.float32)
    g = gcd(src_sr, dst_sr)
    return resample_poly(audio, dst_sr // g, src_sr // g).astype(np.float32)


# ---------- Step A: extract ----------
def extract_audio(video_path: str | Path, out_wav: str | Path, sr: int = config.SAMPLE_RATE) -> str:
    """Pull the audio track out of a video as a mono wav."""
    _run([ffmpeg_exe(), "-y", "-i", str(video_path), "-vn", "-ac", "1", "-ar", str(sr),
          "-c:a", "pcm_s16le", str(out_wav)])
    if not Path(out_wav).exists() or Path(out_wav).stat().st_size < 1000:
        raise RuntimeError("This video has no audio track to dub.")
    return str(out_wav)


# ---------- timing ----------
def fit_to_slot(audio: np.ndarray, sr: int, slot_seconds: float) -> np.ndarray:
    """Speed speech up (never slow it down) so it fits in `slot_seconds`.

    Amharic is often longer than the source language. We speed up by at most
    MAX_STRETCH; anything beyond that is allowed to run slightly long.
    """
    duration = len(audio) / sr
    if slot_seconds <= 0 or duration <= slot_seconds:
        return audio
    factor = min(duration / slot_seconds, config.MAX_STRETCH)
    if factor < 1.03:
        return audio
    tag = uuid.uuid4().hex[:8]
    tmp_in = config.WORK_DIR / f"_stretch_in_{tag}.wav"
    tmp_out = config.WORK_DIR / f"_stretch_out_{tag}.wav"
    save_audio(tmp_in, audio, sr)
    _run([ffmpeg_exe(), "-y", "-i", str(tmp_in), "-filter:a", f"atempo={factor:.4f}", str(tmp_out)])
    result = load_audio(tmp_out, sr)
    tmp_in.unlink(missing_ok=True)
    tmp_out.unlink(missing_ok=True)
    return result


def match_loudness(speech: np.ndarray, reference: np.ndarray) -> np.ndarray:
    """Make the dubbed voice as loud as the original voice was (so it is not too quiet or too loud)."""
    if len(speech) == 0 or len(reference) == 0:
        return speech
    ref_rms = float(np.sqrt(np.mean(reference ** 2)))
    sp_rms = float(np.sqrt(np.mean(speech ** 2)))
    if ref_rms < 1e-4 or sp_rms < 1e-5:
        return speech
    gain = float(np.clip(ref_rms / sp_rms, 0.3, 3.0))
    return np.clip(speech * gain, -0.98, 0.98).astype(np.float32)


# ---------- mixing ----------
def mix_chunk(original: np.ndarray, clips: list[tuple[float, np.ndarray]], bg_volume: float,
              carry: np.ndarray | None = None, sr: int = config.SAMPLE_RATE,
              background: np.ndarray | None = None) -> tuple[np.ndarray, np.ndarray]:
    """Mix dubbed speech over the movie sound for one chunk (or a whole file).

    * `background` (music/effects without voices) is used as-is if given; otherwise the
      original track is used and ducked ONLY while someone is speaking, so music and
      action stay loud between lines.
    * Speech that runs past the end of the chunk is returned as `carry`, to be played at
      the start of the next chunk instead of being cut off.
    """
    from scipy.ndimage import uniform_filter1d

    n = len(original)
    voice = np.zeros(n + 8 * sr, dtype=np.float32)
    talking = np.zeros(n, dtype=np.float32)
    if carry is not None and len(carry):
        voice[: len(carry)] += carry[: len(voice)]
        talking[: min(len(carry), n)] = 1.0
    for start, clip in clips:
        i = int(start * sr)
        fade = min(int(0.01 * sr), len(clip) // 2)          # 10 ms fades avoid clicks
        if fade:
            clip = clip.copy()
            clip[:fade] *= np.linspace(0, 1, fade)
            clip[-fade:] *= np.linspace(1, 0, fade)
        j = min(i + len(clip), len(voice))
        voice[i:j] += clip[: j - i]
        talking[i:min(i + len(clip), n)] = 1.0

    if background is not None:
        base = background[:n] * 0.9
    else:
        talking = uniform_filter1d(talking, size=max(1, int(0.2 * sr)))   # smooth in/out
        base = original * (1.0 - (1.0 - bg_volume) * talking)
    out = base + voice[:n]
    tail = voice[n:]
    nz = np.nonzero(np.abs(tail) > 1e-4)[0]
    new_carry = tail[: nz[-1] + 1].copy() if len(nz) else np.zeros(0, dtype=np.float32)

    peak = float(np.abs(out).max())
    if peak > 0.97:
        out *= 0.97 / peak
    return out.astype(np.float32), new_carry


def mix_dub(original: np.ndarray, clips: list[tuple[float, np.ndarray]], bg_volume: float,
            sr: int = config.SAMPLE_RATE) -> np.ndarray:
    """Whole-file version of mix_chunk (used by the offline Video Dubbing tab)."""
    out, carry = mix_chunk(original, clips, bg_volume, None, sr)
    return np.concatenate([out, carry]) if len(carry) else out


# ---------- Step E: put it back in the video ----------
def mux_video(video_path: str | Path, audio_wav: str | Path, out_path: str | Path) -> str:
    """Replace the video's audio with the dubbed track. Video stream is copied."""
    _run([ffmpeg_exe(), "-y", "-i", str(video_path), "-i", str(audio_wav),
          "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
          "-metadata", f"comment={AI_LABEL}", "-metadata:s:a:0", "title=Amharic (AI dub)",
          "-shortest", str(out_path)])
    return str(out_path)
