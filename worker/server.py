"""Dimts GPU worker. Run:  uvicorn server:app --host 0.0.0.0 --port 7860

The Infinity (Next.js) app owns login, limits, storage and the screen. This process only does what
needs a GPU: listen (Whisper/MMS), translate (NLLB), speak and clone voices (MMS + FreeVC), build video.
Every request must carry  x-worker-secret: $DIMTS_WORKER_SECRET  (set the same value in Infinity's env).
"""
import hmac
import os
import shutil
import threading
import time
import uuid
from pathlib import Path

os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from dubber import config, converse, memory, pipeline, safety, smart, stream, users

SECRET = os.environ.get("DIMTS_WORKER_SECRET", "")
PROFILE = smart.detect()            # looks at the machine once and picks every setting
smart.preload(PROFILE)              # models warm up in the background

app = FastAPI(title="Dimts worker")
app.add_middleware(CORSMiddleware, allow_origins=[o for o in os.environ.get("ALLOWED_ORIGIN", "").split(",") if o],
                   allow_methods=["GET"], allow_headers=["*"])


def guard(request: Request):
    if not SECRET or not hmac.compare_digest(request.headers.get("x-worker-secret", ""), SECRET):
        raise HTTPException(401, "Bad worker secret")


# ---------- per-person My Fixes arrive with each request (Firestore is the source of truth) ----------
def load_fixes(fixes: dict | None):
    mem = memory.Memory(path=config.WORK_DIR / f"fixes_{uuid.uuid4().hex}.json")
    mem.lines = (fixes or {}).get("lines", {})
    mem.words = (fixes or {}).get("words", {})
    memory._memory = mem          # process-global; always call while holding FIX_LOCK


JOBS: dict[str, dict] = {}
# One dub at a time per worker: memory._memory is process-global, so this lock guarantees one person's
# corrections are never applied to another person's video. Scale by running more workers, not more threads.
FIX_LOCK = threading.Lock()


def _public_out(path: str, job_id: str) -> str:
    if not path:
        return ""
    dest = config.OUTPUT_DIR / job_id
    dest.mkdir(exist_ok=True)
    target = dest / "video.mp4"
    if Path(path).resolve() != target.resolve():
        shutil.copyfile(path, target)
    return f"/media/out/{job_id}/video.mp4"


class NewJob(BaseModel):
    url: str
    mode: str = "auto"          # auto = the worker decides (live links on a GPU -> watch, everything else -> best)
    clone: bool = True
    bgVolume: float = config.DEFAULT_BG_VOLUME
    fixes: dict | None = None


@app.get("/health", dependencies=[Depends(guard)])
def health():
    return {"ok": True, "device": PROFILE.device, "headline": PROFILE.headline, "preload": smart.preload_status()}


@app.get("/capabilities", dependencies=[Depends(guard)])
def capabilities():
    """What this machine can do, in plain words, so the screen never offers something that will not work."""
    pre = smart.preload_status()
    return {"device": PROFILE.device, "canLive": PROFILE.can_go_live, "cloneByDefault": PROFILE.engine == "mms_freevc",
            "headline": PROFILE.headline, "ready": pre.get("stage") == "ready", "busy": FIX_LOCK.locked(),
            "slowFactor": {"cuda": 0.7, "mps": 2.5, "cpu": 6.0}.get(PROFILE.device, 6.0)}


@app.post("/translate", dependencies=[Depends(guard)])
async def translate_(body: dict):
    from dubber import translate
    texts, source = body.get("texts") or [], body.get("source") or "en"
    with users.gpu():
        out = await run_in_threadpool(translate.translate, texts, source, "nllb", False)   # memory is applied by Infinity
    return {"texts": out}


@app.post("/jobs", dependencies=[Depends(guard)])
async def new_job(body: NewJob):
    try:
        link = safety.validate_link(body.url)
    except safety.UnsafeInput as exc:
        return JSONResponse({"error": str(exc)}, 400)
    engine = "mms_freevc" if body.clone and PROFILE.engine == "mms_freevc" else "mms_light"
    job_id = uuid.uuid4().hex
    # Smart choice: never make the person pick. A live link on a fast machine plays while it dubs;
    # anything else (or a machine too slow to keep up) is dubbed fully, then reviewed.
    wants_live = body.mode == "watch" or (body.mode == "auto" and smart.source_kind(link, None) == "live")
    body.mode = "watch" if wants_live and PROFILE.can_go_live else "best"

    if body.mode == "watch":
        if not FIX_LOCK.acquire(blocking=False):
            return JSONResponse({"error": "The server is busy right now. Try again in a few minutes."}, 429)
        try:
            load_fixes(body.fixes)
            live = stream.LiveJob(link, delay_seconds=None, whisper_size=PROFILE.live_model,
                                  bg_volume=body.bgVolume, engine=engine, user=job_id)
            live.start()
        except RuntimeError as exc:
            FIX_LOCK.release()
            return JSONResponse({"error": str(exc)}, 429)
        JOBS[job_id] = {"mode": "watch", "live": live}

        def release_when_done():
            live._thread.join()
            FIX_LOCK.release()
        threading.Thread(target=release_when_done, daemon=True).start()
        return {"jobId": job_id}

    job = {"mode": "best", "stage": "Queued", "progress": 0.0, "rows": [], "error": "", "finished": False,
           "output": "", "sid": "", "stopped": False}
    JOBS[job_id] = job

    def run():
        def prog(f, m=""):
            job.update(progress=round(f, 3), stage=m or job["stage"])
        try:
            job["stage"] = "Waiting for the GPU"
            with FIX_LOCK:
                load_fixes(body.fixes)
                out, rows, sid = pipeline.dub_video(None, link, PROFILE.best_model, body.bgVolume, engine=engine, progress=prog)
            job.update(rows=rows, sid=sid, output=_public_out(out, job_id), stage="Done", progress=1.0)
        except Exception as exc:
            job["error"] = str(exc)
        finally:
            job["finished"] = True

    threading.Thread(target=run, daemon=True).start()
    return {"jobId": job_id}


def _job(job_id: str) -> dict:
    j = JOBS.get(job_id)
    if not j:
        raise HTTPException(404, "Unknown job")
    return j


@app.get("/jobs/{job_id}", dependencies=[Depends(guard)])
def job_status(job_id: str):
    j = _job(job_id)
    if j["mode"] == "watch":
        s = j["live"].snapshot()
        out = _public_out(s["output"], job_id) if s["output"] else ""
        return {"mode": "watch", "stage": s["stage"], "error": s["error"], "finished": s["finished"], "ready": s["ready"],
                "language": s["language"], "speed": s["speed"], "notes": s["notes"], "rows": s["rows"],
                "playlist": f"/media/hls/{j['live'].id}/index.m3u8" if s["ready"] else "", "output": out}
    return {"mode": "best", "stage": j["stage"], "progress": j["progress"], "error": j["error"], "finished": j["finished"],
            "rows": j["rows"], "output": j["output"], "playlist": ""}


@app.delete("/jobs/{job_id}", dependencies=[Depends(guard)])
def stop_job(job_id: str):
    j = _job(job_id)
    if j["mode"] == "watch":
        j["live"].stop()
    return {"ok": True}


@app.post("/jobs/{job_id}/redub", dependencies=[Depends(guard)])
async def redub(job_id: str, body: dict):
    j = _job(job_id)
    sess = pipeline.SESSIONS.get(j.get("sid", ""))
    if not sess:
        return JSONResponse({"error": "This dub is no longer editable. Dub the video again to make fixes."}, 410)
    rows = body.get("rows") or []
    changed = [[sess.segments[i].text, str(r[3]).strip()] for i, r in enumerate(rows[:len(sess.segments)])
               if str(r[3]).strip() and str(r[3]).strip() != sess.segments[i].translated.strip()]
    try:
        out, new_rows, _ = await run_in_threadpool(pipeline.redub, j["sid"], rows, False)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, 400)
    j.update(rows=new_rows, output=_public_out(out, job_id))
    return {"rows": new_rows, "output": j["output"], "changed": changed}


@app.post("/speak", dependencies=[Depends(guard)])
async def speak(sample: UploadFile = File(...), text: str = Form(...)):
    ref = config.WORK_DIR / f"ref_{uuid.uuid4().hex}"
    ref.write_bytes(await sample.read())
    try:
        with users.gpu():
            wav = await run_in_threadpool(pipeline.clone_voice, str(ref), text)
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, 400)
    finally:
        ref.unlink(missing_ok=True)
    from fastapi.responses import FileResponse
    return FileResponse(wav, media_type="audio/wav")


@app.post("/turn", dependencies=[Depends(guard)])
async def turn(audio: UploadFile = File(...), direction: str = Form("say"), my_lang: str = Form(...),
               their_lang: str = Form(...), session: str = Form("anon")):
    try:
        return await run_in_threadpool(converse.handle_upload, await audio.read(), session, direction, my_lang, their_lang, "")
    except converse.RateError as exc:
        return JSONResponse({"error": str(exc)}, 429)
    except converse.TurnError as exc:
        return JSONResponse({"error": str(exc)}, 400)


app.mount("/media/hls", StaticFiles(directory=str(stream.LIVE_DIR)), name="hls")
app.mount("/media/out", StaticFiles(directory=str(config.OUTPUT_DIR)), name="out")
