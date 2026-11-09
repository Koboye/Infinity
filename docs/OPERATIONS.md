# Operations runbook

## Health check
`GET /api/health` → `{ ok: true, version, time }`. Point your uptime monitor (UptimeRobot, Better Stack, Vercel checks) at it.

## Environment variables
See `env.example`. Required for online play: the six `NEXT_PUBLIC_FIREBASE_*` values and one Firebase Admin credential
(`FIREBASE_SERVICE_ACCOUNT_JSON` or the three `FIREBASE_*` values). Optional: `UPSTASH_REDIS_REST_*` (global rate limit),
`ADS_ADMIN_KEY` (16+ chars, enables /admin/ads), `TRUST_PROXY_HOPS` (default 1), `NEXT_PUBLIC_SITE_URL`.

## Release checklist
1. `npm run verify` (typecheck + tests + build) must pass.
2. Update `CHANGELOG.md`, bump `package.json` version (`npm version <x.y.z> --no-git-tag-version`).
3. Merge to `main`, tag `vX.Y.Z`, create a GitHub release.
4. After deploy, open `/api/health` and confirm the new version; sign in with Google once.

## Rollback
Redeploy the previous tag (Vercel → Deployments → Promote the previous one, or `git revert` on `main`).
The service worker cache name (`gebeta-vNN` in `public/sw.js`) must be bumped whenever shell files change so phones drop stale caches.

## Rotating secrets
- `ADS_ADMIN_KEY`: change the env var and redeploy; old key stops working immediately.
- Firebase Admin key: create a new key in the Firebase console, update the env var, delete the old key.
- GitHub tokens: use fine-grained tokens scoped to this repository only, with an expiry date.

## Known limits
- Per-instance rate limiting is best effort; configure Upstash for a hard global limit.
- `public/audio/tizita.m4a` is 14 MB and only loads when a player turns music on.
