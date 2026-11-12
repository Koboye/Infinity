# Changelog


## Unreleased — Daily level pass (off by default)
- New: pay once per Ethiopian day (UTC+3) to unlock 10 computer-game starts; the next day, or after the 10, the player pays again.
- The server decides: `passes/{uid}` is written only by the API; `/api/pay/confirm` (secret-protected) opens a pass when your payment channel confirms a claim.
- The pay sheet opens the phone dialer with the code (`NEXT_PUBLIC_PAY_USSD`); a web page cannot dial silently or read the result, so the player presses call.
- Payment approval: the player enters the number they pay from; `/api/pay/sms` reads your phone's payment SMS (via an SMS-forwarder app) and opens the matching player's pass automatically; anything unmatched is approved or rejected at `/admin/pay`. One SMS pays once; ambiguous matches are left to you.
- Off unless `PAYWALL=1` (server) and `NEXT_PUBLIC_PAYWALL=1` (build). New Firestore rules for `passes` and `payClaims`: run `firebase deploy --only firestore:rules`.

## 3.17.0 -- Release polish and hardening
- **Top bar**: the spin counter is now part of the coin chip instead of a badge laid over the amount, so numbers never overlap; on narrow screens spacing tightens first, then decoration goes (never the numbers).
- **Friends**: the invite button is a larger animated dice-and-spark button (soft ring when the friend is online); still when "reduce motion" is on.
- **Profile**: avatar picker and Account are collapsible groups; per-game progress is one compact table.
- **Progress**: Stats / Achievements / Recent tabs instead of one long page.
- **Security**: Firestore sign-up rule now allows only the base profile fields (no pre-set per-game ratings) and caps avatar/lang; spin, top-up and ad rewards also check the sign-in session was not revoked.
- **Friends**: the invite button is now a round joystick (stick wobbles, ring when the friend is online).
- **Settings** grouped into Sound & vibration, Language & display, Gameplay, Profile picture, App (sliders sit under their switch); **Profile** has a header card, then Edit profile, Picture, Progress, Account.
- **Rules tab**: a hub of every game (recent first, search across all rules); tap a game to open its rules as an accordion with a Play button and a game switcher; back goes game → hub → home.
- **Brand**: one palette (Ethiopian green, gold, ember red) locked in the last stylesheet; stray indigo/royal blue removed; buttons have three roles only (gold primary, green-glass secondary, ember danger).
- **Security**: chat attachments must live in this project's own Storage bucket; `SECURITY.md` added for reviewers (trust model, limits, release checklist).
- Needs deploying: `firebase deploy --only firestore:rules,storage`.

## 3.16.0 -- Real accounts, chat files, a better car race
- **Real sign-in**: no more guest accounts. Sign up with a unique **username** (checked live, held by the server so two people can never share one), display name, email and an 8+ character password typed twice; a confirmation email is sent. Google sign-in still works. Forgot-password link, change-password link, **sign out** and **delete account** (re-enter password / pick the Google account again; removes profile, username, coins, friends, chats and uploaded files, and the sign-in itself).
- Players with no username (Google sign-in, or a name taken a moment before) are asked to choose one on the Profile tab. Friends can be searched by `@username`.
- **Profile photo belongs to the account**: it follows you to a new phone and only changes when you change it. It is cleared from the phone on sign out, so it can never carry over to the next person.
- **Photos, voice notes and documents in chat** (Firebase Storage): 📎 document, 📷 photo (shrunk to 1600 px first), 🎤 voice note (tap, speak, send). The server only accepts a file that sits in the sender's own `u/{uid}/` folder.
- **Car race**: other cars move smoothly (they use the real velocity and spin rate sent by each phone, sent 10 times a second), **tyres turn at the real wheel speed**, and cars **bump into each other** instead of driving through. Level cap bug fixed (the host could only pick stages 1-40; now 1-100).
- **Friends > Invite > Car**: pick the **world** and **stage** (with difficulty) like the other games' rule choices.
- Needs deploying: `firebase deploy --only firestore:rules,storage` (new `storage.rules`, `usernames` and car-packet rules). Old rules keep working: the car falls back to the old packet.
- Tests `tests/account-files.test.mjs`, SW cache v45.

## 3.15.0 -- Friends chat: the rest of WhatsApp's chat features
- **Three tick states**: one grey tick = sent, two grey ticks = delivered (their app is open and has your message), two blue ticks = read. Also shown on the chat list.
- **Block / unblock**: a blocked friend can still send, but you never see it and it never counts as unread. They see one tick and are not told. Game invites from a blocked player are not delivered. You must unblock to send.
- **Mute**: unread lines from a muted chat stay out of the Friends badge; the row shows a bell-off icon and a grey count.
- **Delete for me** (any line, yours or theirs) next to the existing Delete for everyone, and **Clear chat** (only your own view; the other person keeps theirs).
- **Star** lines (private to each person) and a **Starred messages** view; **Search in chat**.
- **Forward** a line to any friend (shows "Forwarded").
- **"N unread messages" divider** where you left off.
- Server: new actions `chatStar`, `chatHide`, `chatClear`, `friendBlock`, `friendMute`; `chatSend` accepts `fwd`; `socialSync` marks delivered (written only when something is new).
- Texts in English and Amharic, tests `tests/chat-whatsapp.test.mjs`, SW cache v44.
- Not included (needs file storage, which this project does not have yet): photos, voice notes and documents; push notifications when the app is closed.

## 3.14.0 — Release candidate, Phase 4: Wallet, ads & earn, Profile, Settings
- **Settings in Amharic**: every On/Off switch and the text-size buttons were hard-coded English; now translated.
- **Lucky-spin wheel scales with the screen** (it was a fixed 240 px and pushed the buttons off short phones); the sheet scrolls instead of clipping, and in landscape its buttons stay in reach.
- **Profile**: photo, avatar and name come first, stats below; Enter saves (real form), name hint, "Saved" confirmation.
- Tap targets 44 px+ on switches, avatar picks, ad Skip/CTA, earn-offer close, fee tiles; wallet buttons 48 px.
- Long labels wrap instead of clipping on small phones.
- Tests `tests/rc1-account.test.mjs`, SW cache v43.

## 3.13.0 — Release candidate, Phase 3: Friends chat at WhatsApp level
- **Bubble tails and grouping**: messages from the same person within 5 minutes form one run; only the first has the tail and the extra space above (WhatsApp look). The time and ticks sit inside the bubble, bottom-right.
- **Swipe a message to the right to reply** (vibration when it is ready); vertical scrolling is not affected.
- **Text formatting**: `*bold*`, `_italic_`, `~strike~`, `` `mono` ``. Words like snake_case_name are left alone.
- **Tappable links** (https/http only, opened in a new tab without access to the app).
- **Big emoji**: 1–3 emoji alone are shown large without a bubble.
- **WhatsApp look is now the default** and follows the phone (dark phone → WhatsApp dark, light → WhatsApp light); the ⋮ menu still switches looks and your choice is remembered.
- Info chip at the top of each chat (English + Amharic) and a round green send button.
- Not in this step (each needs server work): group chats, photos/voice notes, voice and video calls, end-to-end encryption. The chat does not claim any of these.
- Pure helpers in `src/lib/chatText.js`, tests in `tests/rc1-chat.test.mjs`, SW cache v42.

## 3.12.0 — Release candidate, Phase 2: in-game screens
- Games fill the real visible screen (browser bar, foldables, split-screen) instead of a fixed 100dvh.
- Game top bar: 44px buttons, long titles shorten with …, notch-safe on both sides in landscape; compact bar on short landscape phones so the board gets the height.
- Thumb-sized action buttons (48px), no accidental text selection or double-tap zoom on controls, player names shorten instead of overflowing.
- **Afro Climb page**: title was still "Infinity Climb" → now "Afro Climb"; added theme colour, favicon, Apple touch icon and manifest link so it installs and shows the right logo.
- Test `tests/rc1-games.test.mjs`.

## 3.11.0 — Release candidate, Phase 1: Home screen & logos
- **One logo size for every game card** (SVG or image): 60 / 76 / 84 / 96 px by screen size, same shadow and spacing. Afro Climb now uses the same icon system and is translated (English + Amharic) instead of a hard-coded English card with a 64×38 picture.
- Equal card heights, names clamp to two lines, lone last card spans the row, 3-across layout on landscape phones.
- Safe-area padding for notches and home-bar, reduced-motion respected, tap targets 44px+.
- Install: manifest description matches the released games, new **Afro Climb** shortcut, dedicated 180×180 `apple-touch-icon.png`, favicon set (SVG + 192 PNG).
- New `src/app/rc1.css` (loaded last), test `tests/rc1-home.test.mjs`, SW cache v40.

## 3.10.0 — Friends chat, WhatsApp style
- **Emoji picker** in the chat box (😊 button): 8 groups plus recently used, inserts at the cursor.
- **Chat looks**: ⋮ menu → "Chat look" cycles Afro Zone, WhatsApp light, WhatsApp dark (doodle wallpaper, green bubbles, blue read ticks, green header). Your choice is remembered on the phone.
- Pill-shaped message bar like WhatsApp, a **jump-to-latest** button with a count of new lines while you are scrolled up, and day labels Today / Yesterday / weekday / date.
- Texts in English and Amharic, test added, SW cache v39.
- Not in this step: group chats, photos, voice notes (each needs server and storage work).

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
