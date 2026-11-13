# ExamPrep

University exam and exit-exam practice for every department: questions with full explanations, a timed exit-exam simulation, and a two-way way to pay: **15 birr a month**, or **contribute 15 new questions** for a department and get a month free.

Next.js 15 + Firebase (Auth + Firestore, server-side only). English UI (Amharic is a good next step).

## How it works
- **Content.** `src/data/departments.js` lists 8 colleges / 70+ departments. `src/data/seedQuestions.js` + `seedMore.js` hold a small **sample** bank (146 questions in 24 departments, correct answers spread over A-D and re-shuffled on every attempt). **Have a lecturer per department review and extend it before you promise students a full bank.** Everything else grows through contributions.
- **Free preview.** Anyone can try 5 questions per department (`PREVIEW_COUNT` in `src/lib/core.js`).
- **Paying.** The student enters the mobile number they pay from, dials your code (a `tel:` link opens the dialer; they press call), and a claim is created. You confirm it in `/admin` ("I received it"), or a payment provider / SMS forwarder calls `POST /api/pay/confirm` with `{ phone, amount }` and your `WEBHOOK_SECRET`. A confirmed payment adds 30 days after any time still left. A web page cannot dial in the background or prove payment by itself; access is only granted by that server-side confirmation.
- **Contributing.** A student sends 1–15 questions at a time for one department. Each is checked (4 different options, a marked answer, an explanation) and compared with the whole bank **and** everything waiting in review (same wording, near-same wording, or the same options + answer are refused; different numbers count as different questions). You approve or reject in `/admin`. Every 15 approved questions in a department = 30 free days (earned time never runs more than 90 days ahead; at most 30 questions may wait for review per student).
- **Security.** All data goes through the API with Firebase Admin; `firestore.rules` denies direct browser access. `ADMIN_SECRET` (review + payments) and `WEBHOOK_SECRET` (payments only) must be 24+ characters or they are off.

## Where it lives
This app is in `apps/exam-prep/` of the Infinity repo and is independent of the Gebeta games app at the repo root (its own `package.json`, Firebase project and deploy). Run every command below from inside `apps/exam-prep/`. On Vercel set the project's **Root Directory** to `apps/exam-prep`.

## Setup
1. Create a Firebase project; enable Authentication (Google and Email/Password) and Firestore. Deploy `firestore.rules`.
2. Copy `env.example` to `.env.local` and fill it in (Vercel: Project → Settings → Environment Variables).
3. `npm install`, `npm run dev`. Open `/admin`, enter `ADMIN_SECRET`.
4. Firestore needs composite indexes for a few queries; the first time one is used Firestore logs a link to create it (claims by uid+status, contribs by dept+status, contribs by uid+status/createdAt).

## Checks
`npm run verify` runs the typecheck, the tests (core rules, full API flow incl. payments, duplicates, credits, caps) and a production build.

## Known limits (be honest with yourself before launch)
- Duplicate detection is wording-based; it will not catch a question that is translated or rephrased heavily. The review step is the real quality gate.
- The seed bank is tiny. Contribution volume decides how useful the app is.
- Subscribers receive each question with its answer (needed for instant feedback), so one subscriber could copy the bank. Treat the bank as content you police by reviewing and, if needed, per-user rate limits.
- The per-instance rate limiter is in-memory; use a shared one (e.g. Upstash) when running many instances.

## Importing real exam questions
Only import questions you wrote, or that the rights holder has licensed to you. Put them in a CSV (`dept,question,A,B,C,D,answer,explanation,topic`) or JSON file, then run
`node tools/import-questions.mjs file.csv` from `apps/exam-prep/`. Each row is checked with the app's own rules and against the existing bank; rejects are listed. Results go to `src/data/imported.json`. Freshman common courses (Logic, Physics, English...) are in the "Freshman Common Courses" college.

## Taking the "coming soon" card live
The home-screen card says "coming soon" until `NEXT_PUBLIC_EXAMPREP_URL` is set in the main app's environment to the deployed ExamPrep address (Vercel, Root Directory `apps/exam-prep`, plus the env vars in `env.example`).

## Grade 12 Entrance (ESSLCE) bank
A "Grade 12 Entrance (ESSLCE)" college (10 subjects) holds 1,421 questions imported from past entrance/model papers (2006-2018 EC). **Only questions whose answer key agrees with their own explanation were imported.** A first extraction of ~12,000 questions showed about half of the checkable keys contradicting their explanations, so the rest are held back until the answer keys are re-checked against the source papers. Questions that depend on a figure or table were skipped.
**Before charging for it:** the papers/explanations carry Temari.et branding; confirm you may republish them commercially (see "Importing real exam questions" above). Have a teacher per subject spot-check answers.
