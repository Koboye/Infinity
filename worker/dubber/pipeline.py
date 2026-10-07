"""Orchestrates the full dubbing pipeline (steps A to E) and single-clip voice cloning."""
from __future__ import annotations

import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import numpy as np

from . import audio, config, memory, safety, transcribe as asr, translate as mt, users, voice

Progress = Callable[[float, str], None]


def _noop(_frac: float, _msg: str = "") -> None:
    pass


def clone_voice(reference_path: str, text: str, engine: str = "mms_freevc",
                progress: Progress = _noop) -> str:
    """Tab 2: speak `text` (Amharic) in the voice of the reference clip. Returns a wav path."""
    if not reference_path:
        raise ValueError("Please upload a reference voice clip (about 10 seconds).")
    if not text or not text.strip():
        raise ValueError("Please type the Amharic text to speak.")

    progress(0.1, "Preparing reference voice")
    ref = audio.load_audio(reference_path, config.SAMPLE_RATE)
    if len(ref) / config.SAMPLE_RATE < config.MIN_REFERENCE_SECONDS:
        raise ValueError("Reference clip is too short. Use at least 3 seconds (10 is best).")
    ref = voice.prepare_reference(ref, config.SAMPLE_RATE)

    progress(0.3, "Loading voice models (first run downloads ~1 GB)")
    eng = voice.get_engine(engine)

    progress(0.7, "Generating Amharic speech")
    wav = eng.synthesize(text.strip(), ref, config.SAMPLE_RATE)
    if len(wav) == 0:
        raise RuntimeError("No speech was generated. Check that the text is Amharic.")
    out = config.OUTPUT_DIR / f"clone_{int(time.time())}.wav"
    audio.save_audio(out, wav, eng.sample_rate, label=True)
    progress(1.0, "Done")
    return str(out)


@dataclass
class DubSession:
    """Everything needed to fix a line and re-dub in seconds, without listening/translating again."""
    id: str
    video_path: str
    stem: str
    original: np.ndarray
    segments: list
    references: dict
    bg_volume: float
    engine: str
    clips: dict = field(default_factory=dict)      # segment index -> fitted speech (cache)


SESSIONS: dict[str, DubSession] = {}


def _rows(segments) -> list[list]:
    from . import quality
    out = []
    for s in segments:
        s.flags = [f for f in s.flags if f in _LISTEN_FLAGS] if s.flags else []
        out.append([f"{s.start:.1f}s", s.speaker, s.text, s.translated,
                    quality.label(s.flags + quality.check_translation(s.text, s.translated))])
    return out


_LISTEN_FLAGS = {"hard to hear", "maybe no speech", "repeating sound", "too fast to be right"}


def _voice_segment(sess: DubSession, i: int, eng) -> None:
    """Speak one segment in its speaker's voice and cache the result."""
    sr = config.SAMPLE_RATE
    seg = sess.segments[i]
    if not seg.translated.strip():
        sess.clips.pop(i, None)
        return
    speech = eng.synthesize(seg.translated, sess.references[seg.speaker], sr)
    if len(speech) == 0:
        sess.clips.pop(i, None)
        return
    speech = audio.resample(speech, eng.sample_rate, sr)
    speech = audio.match_loudness(speech, sess.original[int(seg.start * sr):int(seg.end * sr)])
    nxt = sess.segments[i + 1].start if i + 1 < len(sess.segments) else seg.end + 1.5
    slot = max(seg.end - seg.start, nxt - seg.start)
    sess.clips[i] = (seg.start, audio.fit_to_slot(speech, sr, slot))


def _render(sess: DubSession) -> str:
    sr = config.SAMPLE_RATE
    clips = [sess.clips[i] for i in sorted(sess.clips)]
    mixed = audio.mix_dub(sess.original, clips, sess.bg_volume, sr)
    mix_path = audio.save_audio(config.WORK_DIR / f"{sess.id}_dub.wav", mixed, sr)
    out = config.OUTPUT_DIR / f"{sess.stem}_amharic_{int(time.time())}.mp4"
    return audio.mux_video(sess.video_path, mix_path, out)


def dub_video(video_path: str | None, url: str | None, whisper_size: str, bg_volume: float,
              translator: str = "nllb", engine: str = "mms_freevc",
              progress: Progress = _noop) -> tuple[str, list[list], str]:
    """Full dub. Returns (output video path, transcript rows, session id for fixing lines later)."""
    sr = config.SAMPLE_RATE

    if url and url.strip():
        from .download import download_video
        progress(0.02, "Downloading the video")
        video_path = download_video(safety.validate_link(url))
    elif video_path:
        video_path = safety.validate_local_file(video_path)
    if not video_path:
        raise ValueError("Add a video or paste a link first.")
    with users.gpu():
        return _dub_locked(video_path, whisper_size, bg_volume, translator, engine, progress)


def _dub_locked(video_path, whisper_size, bg_volume, translator, engine, progress):
    sr = config.SAMPLE_RATE
    stem = Path(video_path).stem
    sid = uuid.uuid4().hex[:8]

    progress(0.08, "Step 1/4 - Getting the sound")
    wav_path = audio.extract_audio(video_path, config.WORK_DIR / f"{sid}.wav", sr)
    original = audio.load_audio(wav_path, sr)

    progress(0.15, "Step 2/4 - Listening")
    segments, lang = asr.transcribe(original, sr, whisper_size)
    if not segments:
        raise RuntimeError("No speech was found in this video.")
    asr.diarize(original, sr, segments)

    progress(0.35, f"Step 3/4 - Translating {lang} to Amharic")
    for seg, text in zip(segments, mt.translate([s.text for s in segments], lang, translator)):
        seg.translated = text

    progress(0.45, "Step 4/4 - Speaking Amharic in the original voices")
    eng = voice.get_engine(engine)
    spans = defaultdict(list)
    for s in segments:
        spans[s.speaker].append((s.start, s.end))
    references = {spk: voice.reference_from_segments(original, sr, sp) for spk, sp in spans.items()}
    sess = DubSession(sid, video_path, stem, original, segments, references, bg_volume, engine)
    for i in range(len(segments)):
        progress(0.45 + 0.45 * i / len(segments), f"Step 4/4 - Voice {i + 1} of {len(segments)}")
        _voice_segment(sess, i, eng)

    progress(0.95, "Building your video")
    out_video = _render(sess)
    SESSIONS[sid] = sess
    while len(SESSIONS) > 3:                                 # keep memory small: only the latest dubs stay editable
        SESSIONS.pop(next(iter(SESSIONS)))
    progress(1.0, "Done")
    return out_video, _rows(segments), sid


def redub(session_id: str, rows: list[list], remember: bool = True,
          progress: Progress = _noop) -> tuple[str, list[list], int]:
    """Apply the person's fixes to the Amharic column and rebuild the video.

    Only the lines that changed are spoken again, so this takes seconds, not minutes.
    Returns (new video, rows, number of lines changed).
    """
    with users.gpu():
        return _redub_locked(session_id, rows, remember, progress)


def _redub_locked(session_id, rows, remember, progress):
    sess = SESSIONS.get(session_id or "")
    if not sess:
        raise ValueError("This dub is no longer editable. Dub the video again to make fixes.")
    mem = memory.get()
    changed = []
    for i, row in enumerate(rows[: len(sess.segments)]):
        new = str(row[3]).strip()
        seg = sess.segments[i]
        if new and new != seg.translated.strip():
            if remember:
                mem.teach_line(seg.text, new)
            seg.translated = new
            changed.append(i)
    if not changed:
        raise ValueError("Nothing was changed. Edit the Amharic column first.")
    eng = voice.get_engine(sess.engine)
    for n, i in enumerate(changed):
        progress(0.1 + 0.8 * n / len(changed), f"Speaking fixed line {n + 1} of {len(changed)}")
        _voice_segment(sess, i, eng)
    progress(0.95, "Rebuilding the video")
    out = _render(sess)
    progress(1.0, "Done")
    return out, _rows(sess.segments), len(changed)
