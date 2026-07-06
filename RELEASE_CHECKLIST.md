# Infinity — Release Checklist

This file explains exactly what was changed in this pass, what you must do by hand
before this goes live, and precisely what belongs in GitHub vs what must never be
committed. Nothing below is optional — items marked 🔴 will break the app or leak
credentials if skipped.

---

## 1. What was actually broken (found during this review)

These aren't style nitpicks — each one meant a real feature was silently failing
or a real secret was exposed.

1. 🔴 **A live secret was committed in plaintext.** `.env.local` had a real
   `EMAILJS_PRIVATE_KEY` value checked into the file. That key must be treated as
   burned. **Rotate it now** in the EmailJS dashboard (Account → API Keys) — the old
   value will keep working for anyone who already has it until you do. The file has
   been changed to a blank placeholder; paste the *new* key into your own local
   `.env.local` (never back into a file that gets committed).
2. 🔴 **Direct messages had no matching security rule.** `firestore.rules` only had a
   rule for a flat `messages/{messageId}` path, but the app actually reads/writes
   `messages/{conversationId}/msgs/{msgId}` (a subcollection). Firestore rules don't
   inherit across that boundary, so every 1:1 chat read/write was being denied by the
   rules that shipped — this has been fixed with a rule scoped to the real path.
3. 🔴 **A stranger's live Firebase project was hardcoded as a silent fallback.** If
   `NEXT_PUBLIC_FIREBASE_*` env vars were ever missing, the app fell back to a
   specific `dagu-8348c` Firebase project baked into the source. Anyone who cloned
   this repo without setting up their own `.env.local` would have silently written
   signups/messages/uploads into that project instead of their own. The app now
   throws a clear error instead of silently falling back — you must fill in your own
   project's values (see §3).
4. **Story replies went nowhere.** They were written to an orphaned, flat `messages`
   collection with a document shape the security rules didn't actually authorize, and
   nothing in the app ever read that collection back — so story replies silently
   failed, and even on the rare path where they didn't, the story's owner never saw
   them anywhere. Fixed to write into the real 1:1 conversation thread, the same way
   every other message does.

## 2. New features added (real, no mock data)

### Chat Theme
- Per-conversation color theme (8 presets), stored on the conversation doc as
  `chatTheme`. Both participants see the same theme immediately (Firestore
  `onSnapshot`, not a local-only preference).
- Changeable from the chat's **⋮ → Chat Theme** sheet. Changing it posts a real
  system message into the thread ("X changed the theme to Y"), same as WhatsApp.
- Applies to your own message bubbles, the send button, and the voice-message bubble.

### Disappearing Messages
- Per-conversation setting (`Off` / `24 hours` / `7 days` / `90 days`), stored on the
  conversation doc as `disappearing: { enabled, seconds }`.
- Changeable from **⋮ → Disappearing Messages**. Only *new* messages sent after
  turning it on are affected — not retroactive, matching real chat-app behavior.
  Toggling it posts a real system message into the thread.
- Every new text, sticker, and voice message gets a real `expireAt` timestamp when
  the setting is on.
- **Actual deletion is server-side**, via a native Firestore TTL policy on the
  `expireAt` field — not a client-side timer (which would do nothing if nobody has
  the chat open, and wouldn't survive an app restart). 🔴 **You must turn this policy
  on once, manually — it is not something client code or security rules can do.**
  See §4.
- The client additionally hides any message whose `expireAt` has already passed,
  as a display-only safeguard for the window between expiry and the TTL job's actual
  sweep (Firestore TTL deletion can take up to ~24h to run) — this is a UI
  convenience layered on top of the real server-side deletion, not a substitute for it.

## 3. Before you run this anywhere — required setup

1. Copy `env.example` to `.env.local` and fill in every value with **your own**
   Firebase project, Cloudinary account, OpenAI key (if using AI captions), Upstash
   Redis, and the rotated EmailJS key from §1.
2. Open `public/firebase-messaging-sw.js` and replace the six
   `REPLACE_WITH_YOUR_...` placeholders with your Firebase project's web config
   (Firebase Console → Project Settings → General → Your apps). This file can't read
   `.env.local` — it's a static file served as-is, so it needs the literal values.
   These values aren't secret, but they must match *your* project.
3. In Firebase Console → Authentication, enable Email/Password sign-in (the OTP flow
   creates users with `createUser` + a password).
4. Run `node scripts/set-admin.js <your-uid>` (or however that script expects
   arguments — check the file) to grant yourself the `admin` custom claim, which the
   Moderation queue and Reports screen require.

## 4. 🔴 One-time server-side setup for Disappearing Messages

Client code and security rules **cannot** delete documents on a timer — that has to
be a Firestore feature. Enable the native TTL policy once, from a machine with the
[gcloud CLI](https://cloud.google.com/sdk/docs/install) authenticated to your
project (or do the equivalent from the Firebase Console → Firestore Database →
TTL tab):

```bash
gcloud firestore fields ttls update expireAt \
  --collection-group=msgs \
  --enable-ttl \
  --project=YOUR_PROJECT_ID
```

Firestore will then automatically delete any `msgs` document once its `expireAt`
timestamp is in the past (typically within ~24h of expiry, per Firestore's TTL SLA).
Without this step, Disappearing Messages will still *tag* messages with `expireAt`
and hide them client-side once expired, but the underlying documents will never
actually be deleted from your database.

## 5. Deploy Firestore rules and indexes

The rules file was edited (see §1.2). Deploy it before shipping, or the messaging
fix does nothing:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## 6. Known, already-flagged item that still needs real work

`src/app/api/wallet/route.js`'s `topup` branch has a `TODO` left in the code on
purpose: it currently grants coins to anyone who calls the endpoint with a valid
auth token, with **no real payment verification**. That's fine for a free/promo
top-up flow, but if real money is involved you must wire in your payment provider
(Stripe, RevenueCat, App Store server notifications, etc.) and verify the receipt
server-side before crediting coins. This was true before this pass and is not
something this session changed — flagging it here so it isn't missed at launch.

## 7. What to commit to GitHub — and what NEVER to commit

### ✅ Commit these
- Everything in `src/`, `public/` (after you've filled in your own Firebase config
  in `firebase-messaging-sw.js`), `scripts/`
- `firebase.json`, `firestore.rules`, `firestore.indexes.json`
- `package.json` (a lockfile too, once you run `npm install` locally —
  `package-lock.json`)
- `env.example` (with blank values — it's a template, not real config)
- `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `tsconfig.json`
- `.gitignore` (added in this pass)
- This file, `RELEASE_CHECKLIST.md`

### 🔴 NEVER commit these
- `.env.local` (or any `.env*` file with real values) — contains your Firebase Admin
  private key, Cloudinary secret, OpenAI key, OTP hash secret, and EmailJS private
  key. `.gitignore` now excludes it, but **double-check** with
  `git status` before your first commit that it isn't already tracked.
- Any Firebase service-account JSON file, if you ever download one instead of using
  env vars.
- `node_modules/`, `.next/` — build output and dependencies, not source.

If `.env.local` was ever committed to a repo before this pass (check `git log
--all --full-history -- .env.local`), rotate **every single value in it**, not just
the EmailJS key — Firebase Admin private key, Cloudinary API secret, OpenAI key, and
OTP hash secret all count as compromised the moment they've touched git history,
even if you delete the file in a later commit (git history still has it).
