"""Delayed-live dubbing: works on live streams, YouTube links and ordinary video files.

How it works
  1. FFmpeg reads the source and cuts it into 10-second pieces as they arrive.
  2. A background worker dubs each piece (listen -> translate -> clone voice -> mix).
  3. Each finished piece is added to an HLS playlist that the browser player plays.
  The player starts after a small buffer, so the viewer always sees an already-dubbed
  video, a few seconds behind the original.
"""
from __future__ import annotations

import math
import os
import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path

import numpy as np

from . import audio, config, safety, smart, speakers, users, voice
from . import transcribe as asr
from . import translate as mt

CHUNK_SECONDS = 10
LIVE_DIR = config.WORK_DIR / "live"
LIVE_DIR.mkdir(exist_ok=True)
JOBS: dict[str, "LiveJob"] = {}


def resolve_source(source: str) -> tuple[str, list[str]]:
    """Turn a user link into something FFmpeg can read. Returns (input, extra ffmpeg args)."""
    source = source.strip()
    if source.startswith("/") or source[1:3] in (":\\", ":/") or Path(source).exists():
        return safety.validate_local_file(source), []          # only files from the upload box
    safety.validate_link(source)
    low = source.lower().split("?")[0]
    if low.endswith((".m3u8", ".mp4", ".mkv", ".webm", ".mov", ".ts")) or source.startswith(("rtmp", "rtsp")):
        return source, []
    import yt_dlp
    with yt_dlp.YoutubeDL({"format": "best[height<=720]/best", "quiet": True, "noplaylist": True}) as ydl:
        info = ydl.extract_info(source, download=False)
    url = info.get("url") or (info.get("requested_formats") or [{}])[0].get("url")
    if not url:
        raise RuntimeError("Could not find a playable stream at that link.")
    headers = "".join(f"{k}: {v}\r\n" for k, v in (info.get("http_headers") or {}).items())
    return url, (["-headers", headers] if headers else [])


class ReferenceBank:
    """Collects ~10 s of clean speech per speaker, early on, to clone from."""

    def __init__(self):
        self.pieces: dict[str, list[np.ndarray]] = {}
        self.seconds: dict[str, float] = {}

    def add(self, speaker: str, piece: np.ndarray, sr: int):
        if self.seconds.get(speaker, 0) >= config.REFERENCE_SECONDS or len(piece) < sr // 2:
            return
        self.pieces.setdefault(speaker, []).append(piece)
        self.seconds[speaker] = self.seconds.get(speaker, 0) + len(piece) / sr

    def get(self, speaker: str, sr: int) -> np.ndarray | None:
        if speaker not in self.pieces:
            return None
        return np.concatenate(self.pieces[speaker])[: int(config.REFERENCE_SECONDS * sr)]


class LiveJob:
    def __init__(self, source: str, delay_seconds: int | None = None, whisper_size: str = "base",
                 bg_volume: float = config.DEFAULT_BG_VOLUME, translator: str = "nllb",
                 engine: str = "mms_freevc", remove_voices: bool = False, user: str = "local"):
        self.user = user
        self.id = uuid.uuid4().hex[:8]
        self.dir = LIVE_DIR / self.id
        self.dir.mkdir(parents=True)
        self.source, self.whisper_size, self.bg_volume = source, whisper_size, bg_volume
        self.translator, self.engine_name, self.remove_voices = translator, engine, remove_voices
        self.auto_buffer = delay_seconds is None          # None = the app decides, from measured speed
        self.start_chunks = 1 if delay_seconds is None else max(1, round(delay_seconds / CHUNK_SECONDS))
        self.output: str = ""                             # finished MP4, filled in when the stream ends

        self.stage = "Starting"
        self.error = ""
        self.finished = False
        self.stopped = False
        self.ready = False
        self.lang: str | None = None
        self.notes: list[str] = []
        self.rows: list[list] = []
        self.proc_seconds = 0.0
        self.media_seconds = 0.0
        self.durations: list[float] = []
        self._ffmpeg: subprocess.Popen | None = None
        self._carry = np.zeros(0, dtype=np.float32)
        self._last_text = ""                                   # end of the previous piece, helps the next one
        self._bank = ReferenceBank()
        self._tracker: speakers.SpeakerTracker | None = None
        self._separate = None
        self._thread = threading.Thread(target=self._run, daemon=True)
        JOBS[self.id] = self

    # ---------- public ----------
    def start(self):
        users.LIVE_JOBS.acquire(self.user)               # raises a friendly error if the server is full
        self._thread.start()

    def stop(self):
        self.stopped = True
        if self._ffmpeg and self._ffmpeg.poll() is None:
            self._ffmpeg.kill()

    def snapshot(self) -> dict:
        rtf = self.proc_seconds / self.media_seconds if self.media_seconds else 0.0
        if not self.media_seconds:
            speed = "Measuring speed..."
        elif rtf <= 0.8:
            speed = f"Smooth: dubbing is {1 / max(rtf, 0.01):.1f}x faster than the video plays."
        elif rtf <= 1.0:
            speed = "Just fast enough. The app is keeping a bigger safety buffer."
        else:
            speed = ("Your computer is slower than the video, so playback may pause. "
                     "Use Best Quality mode instead, or a computer with an NVIDIA card.")
        return {"id": self.id, "stage": self.stage, "error": self.error, "ready": self.ready,
                "finished": self.finished, "output": self.output, "chunks": len(self.durations), "language": self.lang,
                "speed": speed, "notes": self.notes[-3:], "rows": self.rows[-25:]}

    # ---------- internals ----------
    def _log(self, msg: str):
        self.stage = msg

    def _run(self):
        try:
            self._warmup()
            self._ingest_and_dub()
        except Exception as exc:
            self.error = str(exc)
            self.stage = "Error"
        finally:
            users.LIVE_JOBS.release(self.user)
            self.finished = True
            self.ready = True
            self._write_playlist()
            if self.durations and not self.stopped:
                try:
                    self.output = self.export_mp4()
                except Exception as exc:                          # the live view still works without the download
                    self.notes.append(f"Could not build the download file: {exc}")

    def export_mp4(self) -> str:
        """Join the dubbed pieces into one MP4 the person can keep."""
        parts = "|".join(str(self.dir / f"dub_{i:05d}.ts") for i in range(len(self.durations)))
        out = config.OUTPUT_DIR / f"{self.id}_amharic_live.mp4"
        cmd = [audio.ffmpeg_exe(), "-y", "-i", f"concat:{parts}", "-c", "copy",
               "-bsf:a", "aac_adtstoasc", "-metadata", f"comment={audio.AI_LABEL}", str(out)]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0 or not out.exists():
            raise RuntimeError(proc.stderr[-300:])
        return str(out)

    def _warmup(self):
        self._log("Loading AI models (the first time this takes a few minutes)")
        sr = config.SAMPLE_RATE
        asr.transcribe(np.zeros(sr, dtype=np.float32), sr, self.whisper_size)
        mt.translate(["hello"], "en", self.translator, use_memory=False)
        voice.get_engine(self.engine_name)
        if speakers.available():
            self._tracker = speakers.SpeakerTracker()
        else:
            self.notes.append("Speaker tracking is off (pip install resemblyzer webrtcvad-wheels): one voice for everyone.")
        if self.remove_voices:
            from . import separate
            if separate.available():
                self._separate = separate
            else:
                self.notes.append("Voice removal needs 'pip install demucs'. Using volume ducking instead.")

    def _ingest_and_dub(self):
        self._log("Connecting to the video source")
        src, extra = resolve_source(self.source)
        listing = self.dir / "list.csv"
        listing.touch()
        cmd = [audio.ffmpeg_exe(), "-y", *extra, "-i", src,
               "-map", "0:v:0?", "-map", "0:a:0?",
               "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26", "-pix_fmt", "yuv420p",
               "-vf", "scale=-2:'min(720,ih)'", "-force_key_frames", f"expr:gte(t,n_forced*{CHUNK_SECONDS})",
               "-c:a", "aac", "-b:a", "128k", "-ar", str(config.SAMPLE_RATE), "-ac", "1",
               "-f", "segment", "-segment_time", str(CHUNK_SECONDS - 0.5), "-segment_format", "mp4",
               "-reset_timestamps", "1", "-segment_list", str(listing), "-segment_list_type", "csv",
               str(self.dir / "src_%05d.mp4")]
        self._ffmpeg = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)

        done = 0
        while not self.stopped:
            entries = self._finished_pieces(listing)
            if done < len(entries):
                name, t0, t1 = entries[done]
                self._process_chunk(done, self.dir / name, t1 - t0)
                done += 1
                continue
            if self._ffmpeg.poll() is not None and done >= len(self._finished_pieces(listing)):
                break                                           # ffmpeg finished and nothing left
            time.sleep(0.25)
        if done == 0 and not self.stopped:
            err = (self._ffmpeg.stderr.read() or "")[-600:] if self._ffmpeg.stderr else ""
            raise RuntimeError(f"No video could be read from that source. {err}")
        self._log("Finished" if not self.stopped else "Stopped")

    @staticmethod
    def _finished_pieces(listing: Path) -> list[tuple[str, float, float]]:
        """Read FFmpeg's list of completed pieces, ignoring a half-written last line."""
        text = listing.read_text()
        out = []
        for line in text[: text.rfind("\n") + 1].splitlines():
            parts = line.split(",")
            if len(parts) >= 3:
                try:
                    out.append((parts[0], float(parts[1]), float(parts[2])))
                except ValueError:
                    pass
        return out

    def _process_chunk(self, i: int, seg_path: Path, duration: float):
        with users.gpu():
            self._process_chunk_locked(i, seg_path, duration)

    def _process_chunk_locked(self, i: int, seg_path: Path, duration: float):
        sr = config.SAMPLE_RATE
        t_start = time.perf_counter()
        self._log(f"Dubbing piece {i + 1}")
        wav_path = self.dir / f"a_{i:05d}.wav"
        try:
            audio.extract_audio(seg_path, wav_path, sr)
            original = audio.load_audio(wav_path, sr)
        except RuntimeError:                                    # silent piece, no audio track
            original = np.zeros(int(duration * sr), dtype=np.float32)

        segments, lang = asr.transcribe(original, sr, self.whisper_size, language=self.lang, prompt=self._last_text)
        if segments and not self.lang:
            self.lang = lang
        if segments:
            self._last_text = " ".join(x.text for x in segments)[-200:]
        clips = []
        if segments:
            texts = mt.translate([s.text for s in segments], self.lang or lang, self.translator)
            eng = voice.get_engine(self.engine_name)
            for k, (seg, text) in enumerate(zip(segments, texts)):
                seg.translated = text
                piece = original[int(seg.start * sr):int(seg.end * sr)]
                seg.speaker = self._tracker.identify(piece, sr) if self._tracker else "SPEAKER_00"
                self._bank.add(seg.speaker, piece, sr)
                ref = self._bank.get(seg.speaker, sr)
                if ref is None or not text.strip():
                    continue
                speech = audio.resample(eng.synthesize(text, ref, sr), eng.sample_rate, sr)
                if len(speech) == 0:
                    continue
                speech = audio.match_loudness(speech, piece)
                nxt = segments[k + 1].start if k + 1 < len(segments) else duration + 2.0   # last line may spill into next piece
                slot = max(seg.end - seg.start, nxt - seg.start)
                clips.append((seg.start, audio.fit_to_slot(speech, sr, slot)))
                self.rows.append([f"{i * CHUNK_SECONDS + seg.start:.0f}s", seg.speaker, seg.text, text])

        background = None
        if self._separate is not None and clips:
            try:
                background = self._separate.background_only(original, sr)
            except Exception as exc:
                self.notes.append(f"Voice removal failed ({exc}); using ducking.")
                self._separate = None
        mixed, self._carry = audio.mix_chunk(original, clips, self.bg_volume, self._carry, sr, background)
        mixed_path = audio.save_audio(self.dir / f"m_{i:05d}.wav", mixed, sr)
        self._mux_chunk(seg_path, mixed_path, self.dir / f"dub_{i:05d}.ts", sum(self.durations))

        self.proc_seconds += time.perf_counter() - t_start
        self.media_seconds += duration
        self.durations.append(duration)
        self._write_playlist()
        if self.auto_buffer:                                   # slower computer -> bigger safety buffer
            self.start_chunks = smart.buffer_chunks(self.proc_seconds / max(self.media_seconds, 1e-6))
        if len(self.durations) >= self.start_chunks:
            self.ready = True
        for f in (seg_path, wav_path, mixed_path):             # keep the disk tidy
            Path(f).unlink(missing_ok=True)

    @staticmethod
    def _mux_chunk(video_seg: Path, wav: str | Path, out: Path, offset: float):
        cmd = [audio.ffmpeg_exe(), "-y", "-i", str(video_seg), "-i", str(wav),
               "-map", "0:v:0?", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
               "-muxdelay", "0", "-muxpreload", "0", "-output_ts_offset", f"{offset:.3f}",
               "-f", "mpegts", str(out)]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            raise RuntimeError(f"FFmpeg failed:\n{proc.stderr[-800:]}")

    def _write_playlist(self):
        target = max(CHUNK_SECONDS, math.ceil(max(self.durations, default=CHUNK_SECONDS)))
        lines = ["#EXTM3U", "#EXT-X-VERSION:3", f"#EXT-X-TARGETDURATION:{target}",
                 "#EXT-X-MEDIA-SEQUENCE:0", "#EXT-X-PLAYLIST-TYPE:EVENT"]
        for i, d in enumerate(self.durations):
            lines += [f"#EXTINF:{d:.3f},", f"dub_{i:05d}.ts"]
        if self.finished:
            lines.append("#EXT-X-ENDLIST")
        tmp = self.dir / "index.m3u8.tmp"
        tmp.write_text("\n".join(lines) + "\n")
        os.replace(tmp, self.dir / "index.m3u8")                # atomic: player never sees half a file


def cleanup_old_jobs(keep: int = 3):
    """Delete the files of older jobs so the disk doesn't fill up."""
    old = sorted(LIVE_DIR.iterdir(), key=lambda p: p.stat().st_mtime)[:-keep]
    for p in old:
        shutil.rmtree(p, ignore_errors=True)
