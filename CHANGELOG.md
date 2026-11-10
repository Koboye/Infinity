# Changelog

## Unreleased — Friends, Telegram-style ("Aurora")
- **@usernames**: pick a unique @name, find players by name (prefix search), share a `?u=name` link next to the old `?friend=CODE` link.
- **Chats · Contacts · Requests** hub with one search box (name, @username or 6-letter code), contacts sorted by last seen or A–Z.
- **Last seen like Telegram** (online, 12 min ago, today at…, yesterday at…) with a privacy choice: everyone / friends / nobody (rough "recently" only). Presence documents are now readable only by their owner; friends get last-seen through the API.
- **Block / unblock**, pin and mute chats, private nicknames for contacts, a short note with a friend request, a bio, and "people you may know" (friends of friends).
- **Richer chat**: reply, edit (48 h), delete for both, six reactions, read ticks (✓ / ✓✓), "typing…", day separators; muted chats stay out of the badge.
- New look in `friends.css` (aurora cyan→violet on the indigo glass canvas), English + Amharic texts, `tests/contacts.test.mjs` (24 checks).

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
