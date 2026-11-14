# Exam Pro consolidation — scoped execution plan

Primary application: `public/games/exam-prep/`.
Working branch: `exampro-consolidation`.
Scope: **only duplicate Exam Pro applications and files**. All unrelated Infinity games and apps are out of scope.

## Verified repository inventory
- Static Exam Pro: `public/games/exam-prep/index.html`, `auth.js`, `unified.js`, `navigation.js`, `bank.js`, learning-level banks, and kindergarten learning pages.
- Separate Next.js ExamPrep: `apps/exam-prep/`, including API endpoints, Firebase server integration, department/question source data, payment and contribution workflows, and tests.
- Static bank generator: `apps/exam-prep/tools/build-static.mjs` writes directly to `public/games/exam-prep/bank.js`.
- Root regression tests: `tests/exampro-readiness.test.mjs`.

## Retention and migration rules
1. Preserve the existing static application URL and working navigation.
2. Preserve all current question banks and their generation source; **do not delete `apps/exam-prep/` while its build-static script and source data are required**.
3. Preserve existing local-storage keys and Firebase account data; no destructive migration or credential handling.
4. Audit Next.js-only capabilities (contributions, admin review, server-verified payment, API-backed question bank) for relevance and security. Server-only functionality cannot be copied into client-only JavaScript; retain its backend or implement a secure replacement before decommissioning.
5. Consolidate Home/Profile CSS into maintainable styles; remove overrides only with regression coverage.
6. Verify Welcome → Sign In → Home → Profile; question selection, exam timing, progress persistence, offline/static bank, and game-break return flow.
7. Delete only confirmed redundant Exam Pro code, with replacement and regression evidence recorded. Do not delete unrelated apps or shared dependencies.
8. Run root Exam Pro readiness tests and Next.js verification before requesting merge into `main`.

## Current status
Inventory completed; consolidation and runtime verification **not yet completed**. No deletion authorized by this plan without dependency checks.
