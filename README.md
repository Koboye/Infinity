# Gebeta · ገበጣ — Gebeta, Checkers & Dominoes

Multiplayer Ethiopian games hub. Next.js + Firebase. Three games share one profile, one rating system, one room/matchmaking server and one look.

## Games
| Game | Offline | Online | Rule sets |
|---|---|---|---|
| **Gebeta** ገበጣ | vs computer (3 levels), two players one phone | quick match, private room code | Gebeta (relay) · Classic |
| **Checkers** ቼከርስ | vs computer (3 levels), two players one phone | quick match, private room code, draw offers | Classic 8×8 · Flying kings |
| **Dominoes** ዶሚኖ | vs computer (3 levels), two players one phone (privacy curtain) | quick match, private room code, hidden hands | Draw · Block, match to 50 or 100 |

Online: server validates every move, turn timer, resign, rematch, emotes, per-game Elo rating and leaderboard. English + አማርኛ, sound, animations, installable PWA.

## Rules implemented
**Checkers** — dark moves first; men step diagonally forward; capturing is compulsory and multi-jumps must be finished; kings move/capture both ways; 3-fold repetition or 40 moves (80 plies) without a capture/man move is a draw. *Classic*: kings step one square, crowning ends the turn. *Flying kings* (Brazilian style): kings glide, men may capture backwards, you must take the most pieces. The move generator matches the published English-draughts move counts (7, 49, 302, 1469, 7361, 36768, 179740).

**Dominoes** (double-six, 2 players, 7 tiles each) — highest double leads round 1, then the last winner leads. *Draw*: if you can't play you draw from the boneyard until you can. *Block*: no drawing, you pass. Going out scores the opponent's remaining pips; a blocked table is won by the lower hand for the difference (tie = 0). Hands are private online: each hand is in `gebetaRooms/{code}/private/{uid}` (readable only by its owner); the boneyard is server-only.

All rules live in `src/lib/<game>/engine.js` (pure functions shared by browser and server).

## Run it
```bash
cp env.example .env.local    # fill in Firebase keys (below)
npm install
npm run dev                  # http://localhost:3000
npm test                     # engines, room logic, API integration (all three games)
```
Without Firebase keys, computer and pass-and-play still work; online shows "not set up".

## Firebase setup (once)
1. Authentication → enable **Email/Password**, **Google**, **Anonymous**.
2. Create **Firestore**, then `firebase deploy --only firestore`.
   **Re-deploy the rules for this release** — they add the `private` subcollection used by dominoes.
3. Project settings → Web app → keys into `NEXT_PUBLIC_FIREBASE_*`.
4. Service accounts → generate key → `FIREBASE_SERVICE_ACCOUNT_JSON` (or the 3 separate vars) on the host.
5. Add your domain to Authentication → Settings → Authorized domains.
6. Recommended: auto-delete old matches. Rooms and private docs carry an `expireAt` (7 days). In Firestore → TTL add policies on `expireAt` for collection groups `gebetaRooms` and `private`.

## Deploy
Vercel: import the repo, add env vars, deploy. `/api/gebeta` runs on the Node runtime.

## Data model notes
- Existing Gebeta ratings/stats are untouched (`rating`, `wins`, …). Checkers/dominoes use `rating_checkers`, `wins_dominoes`, … on the same user document.
- Rooms stay in `gebetaRooms` and gain a `game` field (rooms without it are Gebeta).
- Firestore can't store arrays in arrays, so dominoes tiles are 2-character strings (`"36"`).

## Layout
```
src/lib/{gebeta,checkers,dominoes}/engine.js  rules      ai.js  computer opponent
src/lib/online/            server room logic: rooms.js (generic) + one module per game
src/app/api/gebeta/route.js   authoritative online API (rate limited)
src/components/            screens, boards, per-game Local/Online views
firestore.rules            clients read their room + own hand; only the server writes
tests/                     engine, rooms, API tests with an in-memory Firestore fake
```

## Known limits / next steps
- Rate limiting is per server instance; add Upstash/Redis for a hard global limit.
- The online UI could not be run against a live Firebase project here. Server logic is covered by tests (full random matches of all three games through the API); offline UIs were played end-to-end in a headless browser.
- Ethiopian **Dama** (orthogonal draughts) and 4-player partner dominoes are not included; the structure is ready for them.
