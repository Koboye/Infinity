# Changelog

## 3.3.0 — Afro Zone
- Brand: app name is **Afro Zone** everywhere (README, store listing, manifest, TWA); Afro portrait icon, maskable icon and share image.
- Service-worker cache bumped so installed apps refresh the new icons.

## 3.2.1 — Polish
- `/api/gebeta` refuses request bodies over 128 KB (413).
- Ad-admin lockout map now forgets old addresses (no unbounded growth).
- Footer shows the real app version instead of a hardcoded label.
- Store/search description lists all current games.
- Added `docs/OPERATIONS.md` runbook and `ci/dependabot.yml` template.

## 3.2.0 — Release-level upgrade

### Phase 1 — Foundation & CI (v3.1.1)
- CI pipeline (typecheck, tests, build, audit) provided at `ci/github-ci.yml`; copy to `.github/workflows/ci.yml`.
- Parallel test runner with per-file timeout (`npm test`), plus `npm run typecheck` and `npm run verify`.
- Fixed duplicate Hill Climb world name (now "Blue Nile Gorge"); stale world tests made data-driven.
- `engine.test.mjs` no longer runs for minutes (AI think time capped in the test).
- App version now has a single source of truth (`package.json`).
- Removed tracked build artefacts (`tsconfig.tsbuildinfo`) and a stale script.

### Phase 2 — Security (v3.1.2)
- Spoof-proof client IP for admin lockout and ad rate limits (`TRUST_PROXY_HOPS`).
- Added HSTS, X-Frame-Options, Permissions-Policy, COOP; CSP `base-uri` / `form-action`; removed `X-Powered-By`.
- Next 15.5.29; overrides for `@grpc/grpc-js`, `postcss`. High-severity advisories 5 → 0.
- Git history scanned for secrets: clean.

### Phase 3 — Reliability (v3.1.3)
- `/api/health` liveness endpoint.
- Branded error, global-error and not-found screens.
- Service worker v30: no longer caches failed responses; runtime cache capped.

### Known / next
- 8 moderate `uuid` advisories remain, transitive inside Google Cloud SDKs (affects buffer-argument use only).
- CSP still allows `'unsafe-inline'` scripts (needs nonce support; plan with Next middleware).
- 47 stacked CSS files in `src/app` should be consolidated carefully (cascade order matters).
- Repo history is ~187 MB (large game art); consider moving media to a CDN / Git LFS.

## Phase 1 — Fits every screen
- One responsive system: `ViewportFit` measures the visible screen and sets the app column width and root font size; new `fit.css` (loaded last) uses them, replacing five competing width/font rules.
- Fixed the narrow strip on tablets/desktop/large-CSS-width phones (home shrank to its content width inside the column).
- Home: 2 columns on phones, 3 on wider screens; sizes in rem; auto-fits one screen above the bottom bar; compact mode for short phones.
- Friends chat: panel ends above the bottom bar so the message box is never hidden.
- Top bar no longer wraps on 320–360px phones; text-size setting still works.
