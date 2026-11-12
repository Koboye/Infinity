# Security overview (for reviewers)

## Trust model
The phone is **never trusted**. Everything that has value (coins, ratings, wins, match state, friends, chats, ads) is written only by the server with the Firebase Admin SDK after it verifies the player's ID token. Firestore rules deny client writes to all of it.

| Area | Client may | Server enforces |
|---|---|---|
| `users/{uid}` | create own profile (base fields only, rating 1000, 0 wins), edit name / avatar / lang / photo / progress | ratings, wins, losses, draws, usernames |
| `wallets`, `ads*`, `friends`, `invites`, `chats`, `usernames`, `friendCodes` | read own (or nothing) | every write |
| `gebetaRooms`, `raceRooms` | read only rooms they play in | every move is validated by the shared game engines; dice, balls and spins are rolled on the server |
| `raceRooms/*/cars/{uid}` | write own car packet (fixed key list, numeric) | |
| Storage `u/{uid}/**` | write own folder, < 15 MB | chat attachments must point into the sender's own folder **in this project's bucket** |

## Controls in place
- ID-token check on every API call; **revocation check** on coin-moving actions (spin, top-up, ad reward).
- Per-user and per-IP rate limits; optional global limit through Upstash. IP comes from the trusted proxy header, never the left-most `X-Forwarded-For`.
- Admin ads API: `ADS_ADMIN_KEY` (16+ chars), constant-time compare, lockout after repeated wrong keys, disabled when the variable is unset.
- Rewarded ads use signed, one-use tokens (click-fraud guard).
- Account deletion requires recent re-authentication and removes profile, username, friends, chats, files.
- Headers: CSP (no `eval`, `object-src 'none'`, `frame-ancestors 'none'`), HSTS, `nosniff`, `X-Frame-Options: DENY`, strict referrer policy.
- Chat text is rendered as React text (no `innerHTML`); links use `rel="noopener noreferrer"`.
- No secrets in the repository (`.env*` ignored; `env.example` has names only). Service-account keys live in Vercel environment variables.

## Daily level pass
- `passes/*` and `payClaims/*` are server-written only. A pass is confirmed by `/api/pay/confirm` (`PAY_WEBHOOK_SECRET`, 24+ chars, constant-time compare, lockout after 10 wrong secrets); a claim pays once.
- Limit: games against the computer run on the phone, so the pass gate on those is enforced by the app and server together but a modified client could skip it. Strong enforcement needs the match to be played on the server (as online rooms are).

## Known limitations (accepted, documented)
1. CSP still allows `'unsafe-inline'` scripts (Next.js inline bootstrap). Moving to nonces removes it.
2. Without the optional Upstash variables, rate limits are per server instance (a determined attacker can spread requests across instances).
3. Any signed-in user can read every public profile (needed for the leaderboard). Profiles hold no email or contact data.
4. Usernames can be tested for availability by anyone (`/api/account`, rate limited) – required by the sign-up form.
5. Client code, game rules and Firestore rules are public by nature; security does not depend on hiding them.

## Release checklist
- [ ] `firebase deploy --only firestore:rules,storage`
- [ ] Vercel env: `FIREBASE_SERVICE_ACCOUNT_JSON` (or the 3 split values), all `NEXT_PUBLIC_FIREBASE_*`, `ADS_ADMIN_KEY` (random 32+ chars), optional `UPSTASH_*`
- [ ] Firebase Auth: authorized domains = production domain only; enable email enumeration protection
- [ ] Firebase App Check (recommended) and API-key HTTP-referrer restriction in Google Cloud console
- [ ] Rotate any token or key that was ever pasted in a chat, ticket or screenshot
- [ ] Set a Firestore TTL policy on `adTokens.expireAt`
- [ ] Budget alert on the Firebase project
