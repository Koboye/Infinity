# Dimts (ድምጽ) — what it is, what it can't do yet, and where it fits

Written from reading the actual code of the `dimts` project, not from the README's claims.

## 1. What the app does for the user

Dimts lets a person **hear and speak Amharic (also Oromo and Tigrinya for conversation) in the original speaker's own voice**. Four tools:

| Tool | What the user does | What happens inside |
|---|---|---|
| **Dub a video** | Paste a YouTube / live / .m3u8 link | Download → extract audio → Whisper listens and splits by speaker → NLLB translates to Amharic → MMS speaks Amharic → FreeVC bends that voice toward each original speaker → loudness-matched, squeezed into the original time slot (max 1.45x) → mixed over the original sound at 15% → muxed into an MP4 labelled AI-generated |
| **Watch now** (live mode) | Same link, pick "Watch now" | Same chain on 10-second pieces, written as an HLS playlist so the video plays about 10-20 s behind while it is still being dubbed; the MP4 is ready at the end |
| **Talk to someone** | Pick two languages, record one turn at a time | Their words → your earbud in your language; your words → spoken aloud in their language in **your cloned voice**. Their audio is never stored |
| **Speak in a voice** | 10 s of a voice + typed Amharic | Amharic speech in that voice (consent box required) |
| **My Fixes** | Correct any line in the table | Fixed sentences are reused **exactly** next time (no AI call); wrong words are swapped every time; only changed lines are re-spoken (seconds, not minutes) |

Supporting features: it inspects the machine once and picks models and buffer size by itself (`smart.py`); every line gets a quality check and a ⚠ flag (`quality.py`); links to private networks are refused (`safety.py`); a licence registry blocks non-commercial models when `DIMTS_COMMERCIAL=1`; a GPU queue and per-user job limits protect a shared server.

## 2. What makes it unique

1. **Own-voice output, into Amharic.** Mainstream dubbing tools (YouTube auto-dub, ElevenLabs, HeyGen) support a short list of big languages. Amharic is poorly served, and nobody gives it in the speaker's voice.
2. **Corrections that stick.** The "My Fixes" memory is the real product idea: instead of promising a perfect model, it promises *you never fix the same thing twice*. A human-in-the-loop workflow built for a language where models are weak.
3. **Honest quality signalling.** Lines are flagged (hard to hear, repeating words, not Amharic script, numbers missing) so the user reviews the risky ones first.
4. **Live dubbing as HLS with an adaptive buffer** that waits longer on slower machines instead of stuttering.
5. **Privacy-first conversation:** stranger's audio decoded in memory only, only *your* voice becomes the cloning sample.
6. **Covers the Horn of Africa set** (Amharic, Oromo, Tigrinya) with Meta MMS, which beats Whisper on those languages.

## 3. Limitations (the real ones)

**Proof**
- **Never run with the real models on a real GPU.** The README says so itself: all 49 tests use fake models. Real accuracy, speed and memory use are unknown.
- The Swift/Kotlin audio-routing code has never been compiled.

**Quality**
- **Errors compound:** listening errors become translation errors become speech errors. NLLB-600M-distilled is a small model; Amharic idioms, names and numbers will break. Nothing here can promise "100% correct"; the design moves the last mile to the human.
- **Amharic as the *source* language is weak in Whisper** (dubbing Amharic → other languages is not a target; only conversation uses MMS ASR).
- **Voice likeness is partial.** MMS has a single stock voice; FreeVC only moves its timbre. Emotion, pace and accent of the original are lost.
- **Timing:** Amharic is often longer than English. The cap of 1.45x speed-up means long sentences can overrun or get clipped.
- **Original voices stay audible** at 15% unless `demucs` is installed (needs a GPU).
- **Speaker separation is optional** (pyannote + Hugging Face token). Without it, every actor shares one cloned voice.

**Legal / business**
- **NLLB, MMS and XTTS are non-commercial licences.** Fine for testing and research, **not for a paid product**. FreeVC weights and pyannote are "verify". This is the single biggest business blocker.
- `yt-dlp` downloading can breach site terms and copyright. Voice cloning and recording laws vary by country (the app shows consent boxes but cannot enforce them).
- The Google-translate fallback sends text to a third party (privacy).

**Engineering**
- Needs an **NVIDIA GPU** for live mode; on CPU best-quality is about 6x video length.
- Job state and editable sessions live **in RAM** (only the last 3 stay editable); a restart loses them.
- One GPU slot: one heavy job at a time.
- Target language for dubbing is **Amharic only**; conversation covers 11 languages.
- First run downloads ~3 GB of models.
- It was a single-user local tool (Gradio, local `my_fixes.json`, access codes), not an account-based service.

## 4. The gap — what to address

| Priority | Gap | What to do |
|---|---|---|
| 1 | No evidence of real accuracy | Run `tools/benchmark.py` and `tools/asr_check.py` on a GPU with 20 real Amharic videos; publish word-error and fix-rate numbers |
| 2 | Non-commercial models | Pick a path before launch: licence from Meta, fine-tune your own, or use commercially licensed engines for each stage; keep `DIMTS_COMMERCIAL=1` on in production |
| 3 | Voice quality | Fine-tune an Amharic TTS (XTTS / F5-style) on licensed Amharic speech; this is the biggest quality lever and a data-collection project |
| 4 | Translation quality | Use your own corrections (My Fixes) as training data for a domain-tuned model; every fix is a labelled example |
| 5 | Durable state | Done in this port: fixes and jobs are in Firestore. Still to do: move the worker's in-RAM sessions to disk/Redis |
| 6 | Scale | Add a job queue (Redis) and several workers; today one GPU = one dub |
| 7 | Trust & consent | Add watermarking of output audio, a takedown flow, and log consent per job |

## 5. What it should be positioned as

Not "AI that translates perfectly". Position it as **"the fastest way to get any video or conversation into Amharic in a familiar voice, with a review step that gets better every time you use it."** Best first users: Ethiopian diaspora (family videos, news, sermons), churches and NGOs, educators, creators and local media who need Amharic versions of content.

---

## 6. What changed: DIMTS → Infinity style

| DIMTS (before) | Infinity version (now) |
|---|---|
| Python + Gradio screen (`app.py`) | Next.js panel `src/components/dimts/Dimts.jsx`, route `/dimts` |
| CSS/theme in Python string, green Ethiopian palette | Infinity design tokens (`COLORS`, `TYPE`, `RADIUS` from `lib/theme.js`), inline styles, lucide icons |
| Access codes (`DIMTS_TOKENS`) | Firebase login: `requireAuth` on every route |
| `users.py` limits in memory | Upstash `rateLimit` per user+IP; one running job per user checked in Firestore |
| `my_fixes.json` on disk | Firestore `users/{uid}/dimts/fixes` (per person, follows them across devices) |
| `quality.py`, `safety.py`, `memory.py` | Same logic ported to `src/lib/dimts/*.js` (tested) |
| Everything in one process | Infinity = login, limits, storage, UI. `worker/` = GPU only (the original Python AI core, reused unchanged) behind `x-worker-secret` |
| Translation only via local NLLB | Same, plus Gemini fallback when no worker is connected (same key Infinity already uses) |
| Security headers in FastAPI | CSP in `next.config.mjs` extended for the worker origin |

New files: `src/app/api/dimts/{fixes,translate,jobs,jobs/[id],jobs/[id]/redub,voice,turn}/route.js`, `src/lib/dimts/*`, `src/lib/firebase-client.js`, `worker/server.py`. Edited: `package.json` (hls.js), `next.config.mjs`, `firestore.rules`, `firestore.indexes.json`, `env.example`.

### Setup
1. Infinity: `npm install`, fill `env.example` (add `DIMTS_WORKER_URL`, `DIMTS_WORKER_SECRET`, `NEXT_PUBLIC_DIMTS_WORKER_ORIGIN`), deploy `firestore.rules` and indexes, `npm run dev`, open `/dimts` while signed in.
2. Worker (GPU machine): `cd worker && pip install -r requirements.txt && DIMTS_WORKER_SECRET=... ALLOWED_ORIGIN=https://your-infinity-domain uvicorn server:app --host 0.0.0.0 --port 7860` (or the Dockerfile). Put it behind HTTPS.
3. Link it: from the TalkMe area or menu, link to `/dimts` (kept out of `Infinity.jsx` on purpose: that file is 1.1 MB and the bottom bar has five tabs already).

### Tested vs not tested
- Tested: all new JS files compile; quality checks, private-address blocking and fix-memory logic pass unit checks; the worker starts, rejects bad secrets, blocks private links, returns 404/429 correctly.
- **Not tested:** `next build` of the whole app, Firebase/Firestore calls, real Whisper/NLLB/MMS/FreeVC runs, HLS playback in a browser, recording on phones. Expect to fix small things on first run.
- Known limits of this port: the worker handles **one dub at a time** (a lock stops one person's corrections reaching another's video); job state in the worker is in RAM; worker media URLs are unguessable but not signed.
