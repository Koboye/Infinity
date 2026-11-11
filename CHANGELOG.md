# Changelog

## 3.9.0 — Equal cars, auto-drop, offline Android bundle
- **Equal cars** (online race lobby, host option): everyone drives the same stock car with upgrades, driver and parts switched off, so skill decides. Your own garage is restored after the race and never saved with the stock car.
- **Closing the app drops you from the room**: every phone sends an "I am here" every 15 s; a racer silent for 45 s is removed by the server when anyone pings, joins or starts (a finished racer keeps their result; a room is never emptied by this). A removed player is told and sent back to the menu. The host passes on automatically.
- **Android works offline**: the app starts from a bundled launcher: internet → live site, no internet → offline menu with Hill Climb Racer (bundled, Bluetooth/Wi-Fi nearby race works) and the cached board games. `node scripts/build-android-web.mjs` fills the bundle. Not yet run on a device.
- New server action `ping` on `/api/race`; room field `equal`; tests added; SW cache v38.

## 3.8.0 — Review pass: the car game joins Friends
- **Friends can invite each other to Hill Climb Racer**, same as the board games: the 🎮 button (friends list and chat) now lists the car game; the friend gets the normal invite card and one tap takes them straight into your race lobby (the car page joins the room by itself).
- Inside the car race lobby there is a new **INVITE FRIENDS** button: pick friends from your list and they get the invite on any screen.
- New server actions: `friendInvite` with `game: 'car'` (opens a race room), and `friends` / `invite` on `/api/race`. Invites expire with the waiting room, like every other game.
- New car icon in the game picker, Amharic/English invite text, tests for the car invite, service-worker cache bumped (v37).

## 3.7.0 — Phase 3b: Bluetooth ready for the Android app
- The nearby race now has a **Bluetooth** link next to Wi-Fi / hotspot: BLUETOOTH · HOST and BLUETOOTH · JOIN (pick the host phone from a list). It switches on only inside the native Android app; in a browser the buttons explain that it is an Android-app feature.
- Same race as before over a Bluetooth stream (shared start, live ghost car, crash respawn, results, rematch). The game talks to a small bridge (`AfroBluetooth`); tested here against a simulated bridge.
- New `android-bluetooth/`: the native Android plugin (Kotlin, Bluetooth RFCOMM), MainActivity, Capacitor config (loads the live site), manifest permissions and a step-by-step README. Not yet run on a real phone.
- Service-worker cache bumped (v36).

## 3.6.0 — Phase 3: nearby race, no internet (Hill Climb Racer)
- New **NEARBY · NO INTERNET** option in the car game's race menu: two phones race 1 vs 1 over the **same Wi-Fi** or one phone's **hotspot**. No data, no server, no sign-in needed.
- Connecting: the host shows a QR code, the other phone scans it (or pastes the text code) and shows an answer QR back; the race lobby then opens on both phones by itself. Same race as online: shared 3-2-1-GO, live ghost car, crash respawn, results, rematch.
- Browsers cannot use Bluetooth between two phones, so Wi-Fi / hotspot is the offline option in the web app. True Bluetooth needs the native Android app (a later step).
- Camera permission is now allowed for the app itself (`camera=(self)`) so the QR can be scanned. QR scanning needs Chrome on Android; other browsers use the text code.
- Service-worker cache bumped (v35).

## 3.5.0 — Phase 2: online race (Hill Climb Racer)
- New **ONLINE RACE** button on the car game's title screen: create a room (5-letter code), friends join with the code, 2 to 4 racers drive the **same road** at the same time and see each other as live translucent cars with name tags.
- Host picks the world and level in the lobby; everyone starts together after a shared 3-2-1-GO (server clock, so a wrong phone clock cannot cheat the start). Live standings bar (place, progress, finish flag).
- A crash costs time, not the race: you are put back on the last safe spot. First to the flag wins; the others have 60 s to finish, then they are DNF. Coins for finishing (300 / 150 / 100 / 60). Host can race again in the same room.
- Server: new `/api/race` (rooms, start, finish order measured by the server clock). Each phone writes only its own car to `raceRooms/{code}/cars/{uid}` and listens to the others (about 5 updates per second, smoothed on screen).
- **Deploy `firestore.rules` for this release** (`firebase deploy --only firestore:rules`): they add `raceRooms`. Without it the lobby works but cars cannot see each other.
- Needs the player to be signed in to the app (the car page reuses that sign-in) and an internet connection. Offline play is unchanged. Bluetooth / hotspot / Wi-Fi play is phase 3.
- Service-worker cache bumped (v34).

## 3.4.0 — Phase 1: fit every screen
- New scale engine (`ViewportFit` + `fit.css`): the app shell is scaled from the real screen size (0.8× small phones … 1.6× tablets/desktop), so menus, friends, profile and sheets look the same on every device instead of tiny on some.
- Friends chat now fills exactly the space between the top bar and the bottom bar, so the message box is never hidden behind the navigation (also follows the on-screen keyboard).
- Top-bar chips shrink instead of overflowing; dialogs, invites and toasts size from the scaled viewport; no sideways scrolling.
- In-game screens are unchanged (they already use the full visible area).
- Service-worker cache bumped (v33) so installed apps pick this up.

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
