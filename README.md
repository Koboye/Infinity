# Dimts · ድምጽ

Hear the world in Amharic. In every speaker's own voice.

Dimts-only app (the Infinity social app is removed). It keeps Infinity's code style: Next.js App Router, Firebase login,
`requireAuth` + `rateLimit` on every route, `lib/theme.js` design tokens, Firestore for data.

## What the person sees
One simple screen: **paste a link (or upload a video) → tick the rights box → Dub into Amharic.**
Everything else is decided for them: live or full dub, voice copying, which models. Then:
- lines that look wrong are shown first ("3 lines need a quick check"); fix them, press Apply, only those lines are re-spoken
- **Talk**: two big buttons (I speak / They speak), languages remembered, swap in one tap
- **Voice**: record 10 s, type Amharic, hear it in that voice
- **My Fixes** (✓ icon): everything you corrected, never repeated

## Run it
1. `npm install`, copy `env.example` to `.env.local` and fill it. In Firebase enable Google + Email/Password sign-in, deploy `firestore.rules` and `firestore.indexes.json`.
2. `npm run dev`
3. GPU machine: `cd worker && pip install -r requirements.txt && DIMTS_WORKER_SECRET=<same secret> ALLOWED_ORIGIN=<your site> uvicorn server:app --host 0.0.0.0 --port 7860` (first run downloads ~3 GB of models). Put it behind HTTPS and set the three `DIMTS_*` variables.
Without a worker, text translation still works through Gemini (`GEMINI_API_KEY`); dubbing, talking and voices need the worker.

## Layout
`src/components` App, Dub, Talk, Voice, Fixes, Auth, ui · `src/app/api/dimts/*` routes · `src/lib/dimts/*` quality, memory, safety, worker client · `worker/` GPU service (original AI core) · `tests/` logic tests.

See `../DIMTS_ANALYSIS.md` for how it works, limits, gaps and what is unique. Models NLLB / MMS are non-commercial: do not sell until replaced.
