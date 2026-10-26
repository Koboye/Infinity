# Gebeta · ገበጣ — Gebeta & Checkers (Dominoes coming soon)

Multiplayer Ethiopian games hub. Next.js + Firebase. Three games share one profile, one rating system, one room/matchmaking server and one look.

## Games
| Game | Offline | Online | Rule sets |
|---|---|---|---|
| **Gebeta** ገበጣ | vs computer (3 levels), two players one phone | quick match, private room code | Ethio Gebeta · አሻግሮ መብል (relay + families of four, rounds until a player owns no hole) |
| **ዳማ** (Checkers / Dama) | vs computer (3 levels), two players one phone | quick match, private room code, draw offers | Flying kings (default) · Classic 8×8 |
| **ዱምና** (Dominoes) — *coming soon, not released* | vs computer (3 levels), two players one phone (privacy curtain) | quick match, private room code, hidden hands | Draw · Block, match to 50 or 100 |

Online: server validates every move, turn timer, resign, rematch, emotes, per-game Elo rating and leaderboard. English + አማርኛ, sound, animations, installable PWA.

## Rules implemented
**Gebeta (Ethio Gebeta v1.0)** — 12 holes (6 each), 4 seeds per hole. Pick up a whole hole and sow one seed per hole, counter-clockwise through all 12 holes. A hole that reaches exactly 4 seeds is a *family* and is captured at once: mid-sowing it scores for the hole's owner and sowing continues; with the last seed it scores for the mover and the turn ends. Last seed in a filled hole → lift it and keep sowing (relay); last seed in an empty hole → turn ends. A round ends when the player to move has no seeds; the opponent takes what is left. Then a new round is dealt and EVERY hole gets exactly four stones: each player gets one hole per four stones he owns, and the leftovers make one more hole (1+3 → the player with 3 gets it, 2+2 → lottery). The first game opens with a visible spin wheel that picks the first player; after that the opener alternates (X, Y, X, Y …) every round and every rematch. Dama and Checkers work the same way (spin first, then alternate); Dominoes round one is a coin toss. Rounds go on until one player owns no hole. **አሻግሮ መብል** (second mode): same game, plus — if your last stone rests in your own empty hole and the hole across (12 − i) belongs to the opponent, you take that stone and everything in the opposite hole. If your last stone rests in your own empty hole and the hole across is EMPTY, you pick up that single stone for your pile. Because won seeds stay with their owner, a game between equal players can run long. Pacing is one fixed slow speed — a tap or the phone's reduce-motion setting never changes it (see `DELAY` in `src/components/useAnimator.js`; the floating number is the seeds still in hand). Slots 6 and 13 of the 14-slot array are the two family piles, not holes.

**Checkers** — dark moves first; men step diagonally forward; capturing is OPTIONAL in every mode (see v18): play any piece, the opponent may remove a piece that skipped a capture; kings move/capture both ways; 3-fold repetition or 40 moves (80 plies) without a capture/man move is a draw. *Classic*: kings step one square, crowning ends the turn. *Flying kings* (Brazilian style): kings glide, men may capture backwards, you must take the most pieces. The move generator matches the published English-draughts move counts (7, 49, 302, 1469, 7361, 36768, 179740).

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
- 4-player partner dominoes are not included. The 16-man Ethiopian orthogonal Dama rule set was removed in v20.

## Royal edition (v8)
- Background music: `public/audio/tizita.m4a` (looped, falls back to the built-in synth if it cannot load). Replace the file to change the track.
- `src/app/royal.css` — gold-foil, rosewood and velvet look layered over `globals.css`.
- `src/lib/stones.js` — Gebeta stone catalog: 13 sets in 4 kinds (Gems, Beach stones, Glass, Cowries). Player 1 and Player 2 each get one colour; a stone takes the colour of the side it sits on, so sown stones visibly change owner. Chosen in Settings → Gebeta stones and saved on the device.

## v14 additions
- Settings → **Gebeta speed** (Slow default / Normal). Spin wheel has a Skip button; Dominoes also spins for the opener.
- Dama vs computer: optional **Computer may miss captures**; the computer otherwise plays free-choice Dama and models the forfeit.
- Turn clock ticks in the last 5 seconds; an auto-played move is announced.
- Optional global rate limit: set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.


## v16 — strict rules & smart boards
- **Dama (strict):** men step and capture forward/sideways only (never backward); kings fly in all four directions. Nothing is compulsory — any piece may move — but a player who skips a capture, stops a chain early, or takes fewer pieces than the longest chain (majority rule) can be huffed: the opponent touches the offending piece and removes it before his own move. Works user-vs-user, user-vs-computer (the computer always claims a forfeit it is offered) and online.
- **Gebeta:** `validState(state, true)` enforces stone conservation (always 48); holes and family trays redrawn as perfect circles / long trays.
- **Dominoes:** opening is the highest double (else heaviest tile) and it must lead; `validMatch` guards the 28-tile set on the server.
- **Design:** `src/app/smart.css` (loaded last) unifies the Gebeta, Dama, Dominoes and Bingo boards.
- `npm test` now includes `tests/strict.test.mjs`.
- **Gebeta leftovers:** totals divisible by four are untouched; a lone leftover 1 goes to the player holding 3; 2+2 triggers an on-screen spin wheel (local and online) and the winner takes the extra hole. Covered by `tests/leftover.test.mjs`.

## v17 — Dama kill animation & አሻግሮ computer fix
- **Dama kill/kick animation (Ludo King style):** every capture — by a man, a king, or a claimed (huffed) piece — now makes the attacker lunge, kicks the victim off in the direction of the strike (squash, tumble, fade), bursts light on its square and jolts the board. Kings and chains of two or more hit harder. Honors "reduce motion". Code: `useCheckersAnimator.js`, `CheckersBoard.jsx`, `src/app/kick.css`, `sfx.kick`.
- **አሻግሮ መብል computer:** it now always takes an available capture (last stone in its own empty hole opposite a loaded opponent hole) on every level, and its search memory is tagged by rule set so Gebeta and አሻግሮ never share results. When a round ends and the same player also opens the next round, a clear "New round — X opens" message is shown so it no longer looks like an extra turn. Covered by `tests/ashagro-ai.test.mjs`.
- **Dama optional capture (already in the rules, unchanged):** nothing is compulsory; if a player skips a capture, the opponent may touch the piece that missed it and remove it before his own move; if he just plays, the claim is gone.

## v18 — optional capture in every draughts mode
- **Flying kings** and **Classic** no longer force a capture and no longer highlight the pieces that can capture ("You must capture!" is gone). Like Dama: play any piece you want. If you skip a capture, stop a chain early, or (Flying kings) take less than the longest chain, the opponent may touch the piece that missed and remove it before his own move; if he just plays, the claim is gone. Works against the computer, on one phone and online (same engine on the server). In Classic a man that is crowned still ends its jump.
- The rules live in `RULESETS[…].huff` (`src/lib/checkers/engine.js`); the screens read that flag instead of checking for `'dama'`.

## v19 — mirrored diagonals, computer collects its fours at once
- Draughts boards are drawn mirrored left↔right (dark corner bottom-right, diagonals run the other way). Display only — rules and square numbers are unchanged; flip `MIRROR` in `CheckersBoard.jsx` to undo.
- Gebeta vs computer: the computer takes a four of its own **the instant it appears** (even in the middle of your move), so nothing can land in it and freeze it. Humans still tap their own fours. (`playMove(..., autoSeat)`.)
- Tests added: `gebeta-auto`, `turn-order` (players strictly alternate; nobody moves the other side's pieces or holes).

## v20 — Dama (16-man) removed, Dominoes "Coming soon", fair spin
- **Removed the Ethiopian 16-man (orthogonal) Dama rule set** completely: engine, AI, online module, board drawing, CSS, rules text and tests. Draughts now has **Flying kings** (default) and **Classic**. Rooms/clients that still ask for `dama` fall back to the default rule set.
- **Dominoes is "Coming soon" only.** The tile stays in the game picker with a *Coming soon* badge and a placeholder; it has no play, setup, rules, online or leaderboard screens, it is never restored from a saved choice or `?game=` link, it is out of the daily challenge, and the API answers `403 This game is coming soon` for create / quick match / join / moves. The engine and components are kept; to release, remove `comingSoon: true` from `GAMES.dominoes` in `src/lib/games.js`.
- **Fair, seamless spin** (`src/lib/fairRandom.js`, `src/lib/spin.js`, `src/components/SpinOverlay.jsx`):
  - One unbiased coin from `crypto.getRandomValues` with rejection sampling (no modulo bias). The old rule that forced the other side after two wins in a row is gone: it made the draw predictable and no longer a true 50 / 50. The server's seat shuffle, opener draw and room codes use the same source.
  - The wheel has 12 alternating slices, so each player owns exactly half, evenly spread. It always turns forward to land in the middle zone of a slice owned by the winner (uniform slice, uniform point), so the picture is as random as the result and can never disagree with it.
  - Motion is driven by the clock (not timers), with one tick per slice passing the pointer, a pointer flick, a smooth ease-out that stops dead, and the pointer takes the winner's colour on landing. Reduced-motion users get a shorter spin.
  - `tests/spin.test.mjs`: chi-square / binomial tests of the coin and the landing, 200 000 spins checked to end in the winner's slice, ease-out and online-seat fairness.

## v32 — ጡዝ rules, part 1 (rules & opening)
- **Nobody can make a Tuz on his own holes.** A Tuz always sits in an *opponent's* hole and belongs to the player who made it.
- **The opener opens on the opponent's holes.** When the computer starts, it opens on one of YOUR holes; when you start, you tap one of the COMPUTER's holes (they glow). One stone walks round the ring, every hole is back at four except the one opened, which becomes the opener's Tuz. The same goes for two players on one phone and for online rooms (the server rejects an opening on your own hole). A status line says what to tap.
- **The Tuz is the only freeze.** A four made mid-sowing, or by your own last stone in your own hole, is an ordinary hole: no marker, nothing to collect, touching it lifts and plays it. In ጡዝ the collect tap is gone from the local screen, the online screen and the server (`collect` answers "Nothing to collect there").
- Attacking a Tuz (your last stone rests on the opponent's Tuz: +2 and play again) and the end-of-round payout of every Tuz to its owner are unchanged.
- Tests: `tests/tuz.test.mjs` updated, new `tests/tuz-rules.test.mjs` (60 full random games: a Tuz is never in its maker's own hole, only Tuz ever freezes, both seats open on the right side at every AI level).

## v32 — part 2 (look & computer levels)
- **Rebrand "Midnight & Ember"** (`src/app/v32.css`, loaded last): midnight-indigo board, ember-gold frame, turquoise glow on playable holes, ember / rose Tuz seals, pill-shaped uppercase buttons, lit status pill. New flash texts (EN + አማርኛ).
- **Spin wheel** (all games): bigger stage, brighter rim with twinkling studs, ✦ hub, winner glow and a sparkle burst when it stops. Geometry and the fair draw are unchanged.
- **Computer levels** re-measured on the new opening rule (vs the reference club player, `node tests/tuz-calibration.mjs N level maxMs`): easy 68 % of 100 (band 60–75 ✔), medium 73 % of 80 (band 76–85, slightly under), hard last measured 95 % before this release and not re-run.

## v33 — ጡዝ matches the written rulebook
- **Attacking a Tuz:** your last stone on the opponent's Tuz captures exactly two stones from it **plus your own landing stone**; the Tuz keeps the rest (4 → 2) and you play again.
- **Emptied Tuz:** when repeated attacks empty a Tuz, the hole is remembered (flag 6). A stone that merely passes through makes it an ordinary hole again; the LAST stone landing there is captured (one stone to the mover's pile) and the turn ends.
- Tests: `tests/tuz.test.mjs`, `tests/tuz-rules.test.mjs`.

## v34 — ጡዝ opening starts from YOUR OWN hole
- The starter (you, the computer, either seat online) taps one of **his own** holes. It keeps 3 stones; one stone walks round the ring to the opponent's hole **straight across** (12 − i), which becomes the starter's first **Tuz** (four stones). The carried stone goes to the starter's pile, so 48 stones stay accounted for.
- A Tuz is therefore never on its maker's own hole — the opening included (the old opening put it on the starter's own hole). Checked over 60 full random games in `tests/tuz-rules.test.mjs`.
- This replaces the "opens on the opponent's holes" wording in v32.

## v35 — rule-by-rule audit of ጡዝ
`tests/tuz-rulebook.test.mjs` has one test per rule of the rulebook: own Tuz (no capture, turn ends), emptied Tuz (receives stones, a last stone there captures the single stone placed), capturing from the opponent's Tuz (**exactly two stones**, the rest stays frozen, play again), ownership (nobody can lift a Tuz), creating several Tuz (last stone on an opponent hole holding exactly three), and a last stone in an empty hole ending the turn. This corrects v33, which also took the landing stone.

## v36 — ጡዝ rules completed + release-level swipe UI
- **Every ጡዝ round opens like the game does:** after a re-deal the new opener plays the Tuz opening from one of his own holes. If a lopsided deal leaves him no hole facing an opponent hole, the round starts normally.
- **Fixed a deadlock:** an opening that froze the opponent's only hole left him with nothing to lift. A player with nothing to lift is now skipped after the opening too, as after any other move.
- Tests: `tests/tuz-rulebook.test.mjs` rule 8 (30 random games, 1000+ new rounds, always a legal move, 48 stones kept).
- **Swipeable UI:** `SwipePicker` (level / game type) and new `SwipeRail` (games, play modes, bottom dock): snap scrolling, mouse drag, keyboard, dots, colour-coded cards, sticky Start button. Styles: `v36.css`, `v36-rails.css`.
## v38 — ሉዶ (Ludo) royal upgrade: design & system
**Design.** The board is rebuilt as a lit tabletop: a walnut frame, glossy cells, glowing gold stars, chevron home columns that point at the centre, and a centre jewel that takes the colour of whoever is to move (square cross and the fair 3-player triangle alike). Tokens are 3D pawns that hop cell by cell with a squash-and-stretch and a shadow that shrinks in the air; captured pawns slide back to base. The die is a real CSS-3D cube that is tossed, tumbles and lands exactly on the rolled face. Capture / home / leave-base bursts, a trail over the cells the last move crossed, dashed "landing" ghosts for every movable token (red ✕ on a capture, a star for home), a golden Hint highlight, and player cards with avatar, token pips and a progress bar. Honors "reduce motion". Code: `LudoBoard.jsx`, `LudoGame.jsx`, `src/app/ludo.css`.

**System.** The rules engine (`src/lib/ludo/engine.js`) keeps its API and gains: per-player **stats** (rolls, sixes, captures, times sent home) and a **move log**; `previewAll` (what every legal move would do), `hintMove` (the strongest computer's pick, deterministic), `progressOf`, and `serializeGame` / `restoreGame` (validated; anything malformed, finished or for a different player/token count is refused). The computer also learned to **pressure**: it prefers landing 1–6 cells behind an unprotected opponent. The game now **auto-saves** and offers *Resume / New game* when you come back, has a **Fast** mode, a **Moves** log, keyboard rolling (Space / Enter), keyboard-reachable tokens, and shows a **match-stats table** on the result screen. New sounds: dice rattle, hop, landing, home chime. Tests: `tests/ludo.test.mjs` (section 7).

## v39 — Royal Arcade design layer (all games)
- `src/app/v39.css`, loaded last: drifting diamond-weave backdrop with a per-game accent glow (`<html data-game>` + `--game-accent`), glass top bar / panels / dialogs, chunky bevelled 3D buttons, glowing pulsing selection cards, docked pill tab bar on Home, glass player cards and status pills in every game.
- Fixes found by screenshot on a 390 px phone: the Home demo board no longer spills past its frame; long titles stay on one line; dock chips fit.
- Original artwork and palette (no third-party assets or branding).

## v49 — Coins held by the server (real, not on the phone)
**What changed**
- Every coin now lives in Firestore at `wallets/{uid}`, one wallet per **account**, readable only by its owner and written only by the server (`firestore.rules`). Coins follow the player to any phone.
- Server actions in `/api/gebeta`: `wallet` (creates the account wallet with the 1,000 gift the first time, once), `spin` (10 a day; the prize is drawn and paid by the server using the server's UTC day, so phone clocks and local storage no longer matter).
- **Online matches** carry an entry fee (50–1,000). The fee leaves both wallets in the same transaction that seats the second player; the winner is paid 90% of the pot, a draw refunds both, and the prize is paid in the same transaction that finishes the match, so it can never pay twice. Quick match only pairs players who picked the same fee; a player who cannot pay cannot open or enter a match.
- **Computer and Pass & Play are free practice** (no fee, no coins). A phone cannot prove who won a match played on the phone, so no coins are ever moved by one. This also removes the old 10%-per-game loss on Pass & Play.
- Pure rules in `src/lib/walletCore.js`; the client `src/lib/wallet.js` only asks the server and displays the answer. Design pass in `src/app/v49.css` (wallet chip, fee picker in the online lobby, spin wheel, result coins).
- Tests: `tests/wallet.test.mjs` (rules), `tests/wallet-server.test.mjs` (gift once, spins, fee on seating, payout, no double pay, fee tiers, broke players, rematch).

**Deploy:** publish the new `firestore.rules` (`firebase deploy --only firestore:rules`) together with the app. Without it the wallet document is unreadable to the client.

**Limits that remain**
- **Guest accounts get a gift each.** If guest sign-in is enabled, a new guest account gets its own 1,000 coins. Coins are play-money only, but if you want one gift per person, require Google sign-in for the gift.
- **An abandoned match holds the fees until it finishes.** If both players leave a running match, the fees stay staked until one side claims the timeout or resigns. Nothing is lost or duplicated.
- **No coin top-ups.** The welcome gift and the daily spins are the only ways to earn coins. A daily top-up or "double your coins" is easy to add; buying coins for real money would need Play/App Store billing and server-side receipt checks.
- Spins reset at 00:00 UTC for everyone.


## v51 — real Home, no demo content
- Home is a grid of every game. Each card shows this device's actual record (wins · losses · draws) from the progress store; a game never played says so. The streak / wins / games strip uses the same data.
- The self-playing demo boards on Home were removed — nothing on Home is staged any more.
- Top-bar titles are short (they no longer truncate); the leaderboard shows which game it lists.
- Ludo: the real move log stays open on tall screens (remembered per device).
- Coins live on the server (v49/v50.1): the account wallet, daily spins, entry fees, prizes and the daily top-up are all decided server-side, so editing local storage or the phone clock changes nothing. Computer and Pass & Play are free practice.

## v52 — profile photo, Dama coronation, Ludo table
- **Profile picture:** Settings and Profile → choose a photo from the gallery/camera. It is cropped to a small square and kept on this device; signed in, it is also saved on the account (`users/{uid}.photo`, a small JPEG data URL). **Re-deploy `firestore.rules`** (`firebase deploy --only firestore`) so the account may store it. It shows on your Ludo card, your Dama player card and your Dama king.
- **Dama coronation:** a new king rises, spins in 3D, the crown drops on and a gold ring bursts out (≈1.3 s, skipped under reduced-motion). With a photo set, the king is a thick 3D medal of your picture; without one it is your hero figure as before. Online matches do not show the opponent's photo (not shared between players yet).
- **Ludo:** compact player cards with the die beside its own base and full names, a larger board, and a turn clock (12 s to roll, 18 s to move, shorter if you keep missing; the game plays for you when it runs out). Toggle with ⏱.

## v54 — Ads (local advertisers: events, banks, shops)

Direct ads, no third-party SDK: a local advertiser gives you one picture and a link; you schedule it; the app shows it.

**Where ads appear**

| Placement | When | Length | Skippable |
|---|---|---|---|
| `splash` | The app opens | 2–10 s (per ad) | after 3 s (shorter ads just end) |
| `pre_game` | A local game starts, and before online matchmaking (Quick match / Create / Join) | 2–10 s (per ad) | after 3 s |
| `rewarded` | **Only if the player taps** "Watch a short ad → +2 spins" in the lucky-spin sheet | 5–10 s | no (leaving early pays nothing) |

Never during a match. Never two ads back to back (45 s gap). Splash at most once per 2 minutes. Pre-game on every 3rd game start. All of it is in `CAPS` at the top of `src/lib/adsCore.js`; change a number there to change how often ads show.

**Rewarded spins are decided by the server** (the same rule as every coin in this app). `adStart` picks the ad, stores the start time in `adSessions/{uid}` and returns the length; `adDone` pays +2 bonus spins only if the server clock says the full length has passed, once per session, max 5 paid ads per server day (10 extra spins), bank capped at 20. A modified client cannot shorten an ad, replay it, or use another account's session. Bonus spins are used after the 10 daily spins and do not expire.

**How an ad is stored** — one document `ads/{id}` (managed by the owner page, below):

```json
{ "id": "abay-bank-nov", "advertiser": "Abay Bank", "category": "bank",
  "placements": ["splash", "pre_game", "rewarded"],
  "image": "https://firebasestorage.googleapis.com/…/offer.jpg", "clickUrl": "https://abaybank.example/offer",
  "title": "Open an account", "titleAm": "ሂሳብ ይክፈቱ", "body": "Zero fees in November", "bodyAm": "",
  "cta": "Learn more", "ctaAm": "ተጨማሪ እወቅ",
  "durationSec": 6, "weight": 3, "start": "2026-11-01", "end": "2026-11-30", "active": true }
```

An ad is live from `start` to `end` (both days included, UTC) while `active` is true. `weight` (1–100) is its share when several ads compete: weight 3 is shown three times as often as weight 1. The same ad is not shown twice in a row when there is a choice.

**Managing ads (owner)**

1. Set `ADS_ADMIN_KEY` (16+ random characters) in the server environment (Vercel → Settings → Environment Variables) and redeploy. Without it the admin page and API are switched off.
2. Open `https://YOUR-DOMAIN/admin/ads`, type the key, and add / edit / preview / switch off / delete ads. Each ad shows its last-7-days **shown / taps / watched-for-spins** so you can report to the advertiser.
3. Pictures: upload to Firebase Storage (Storage → Files → upload → copy the download link) or use any https host. Hosts other than Firebase Storage must be added to `NEXT_PUBLIC_ADS_IMG_HOSTS` (space separated), because the Content-Security-Policy only allows listed hosts. Best size 1080×1350 (4:5), under 300 KB.
4. Prefer the command line? `curl -H "x-admin-key: $KEY" https://YOUR-DOMAIN/api/admin/ads` lists ads; `curl -X POST -H "x-admin-key: $KEY" -H "Content-Type: application/json" -d '{"action":"save","ad":{…}}' …` saves one (same JSON as above). You can also edit the `ads` collection in the Firebase console, but the admin page validates for you.

**How it reaches the phone** — `GET /api/ads` returns the live splash / pre-game ads (CDN-cached 60 s). The app keeps them for 10 minutes and preloads the pictures, so an ad appears instantly. No network, no ads, or a broken picture = no ad and the app carries on; an ad can never block play. Impressions and taps go to `POST /api/ads` (rate-limited, real ad ids only) and are counted per ad per day in `adStats`. They are **indicative** (a determined person can inflate taps), so for billing prefer the "watched for spins" number, which the server verifies.

**Files:** rules `src/lib/adsCore.js`, server helpers `src/lib/adsServer.js`, client `src/lib/ads.js`, UI `src/components/AdOverlay.jsx` (+ `src/app/ads.css`), spin-sheet button in `src/components/Wallet.jsx`, owner page `src/components/AdminAds.jsx`, APIs `src/app/api/ads/route.js`, `src/app/api/admin/ads/route.js` and the `adStart` / `adDone` actions in `src/app/api/gebeta/route.js`. Wallet fields added: `bonus`, `adDay`, `adViews`.

**Deploy:** publish `firestore.rules` (`firebase deploy --only firestore:rules`; the three ad collections are closed to clients), set `ADS_ADMIN_KEY`, redeploy, then add your first ad. With no ads in the database nothing changes for players, and the watch button simply says no ad is available.

**Tests:** `tests/ads.test.mjs` (length clamp, validation, dates, weights, frequency caps, bonus-spin economy), `tests/ads-server.test.mjs` (public feed, counters, rewarded sessions: early finish, replay, someone else's session, expiry, daily cap, admin API and key), `tests/ads-ui.test.mjs` (wiring and security guards).

**Policy notes:** ads are labelled "Ad" with a countdown, never styled as game buttons, and rewarded ads are optional. Choose advertisers carefully (no gambling, adult or misleading offers) and keep the Play Console **Data safety** form in line with `/privacy`: ads collect no advertising ID; per-ad view and tap counts only.
