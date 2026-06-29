# Infinity v5 — Complete Setup Guide

## What you need before starting
- Node.js 18 or newer installed
- A terminal (Command Prompt / PowerShell on Windows, Terminal on Mac)
- Your Firebase project (dagu-8348c) — already connected
- Your Cloudinary account (dotvhzjmc) — already connected

---

## STEP 1 — Fill in the 5 missing credentials in `.env.local`

Open `.env.local` in this folder. Most of it is already filled in.
You only need to replace these 5 values:

### A) Firebase Admin credentials (3 values)
You need a Firebase service account private key.

1. Go to https://console.firebase.google.com
2. Click your project **dagu-8348c**
3. Click the ⚙️ gear icon → **Project settings**
4. Click the **Service accounts** tab
5. Click **"Generate new private key"** → **Generate key**
6. A JSON file downloads. Open it and copy:
   - `client_email` → paste as `FIREBASE_CLIENT_EMAIL`
   - `private_key` → paste as `FIREBASE_PRIVATE_KEY` (keep the quotes around it)
   - `project_id` is already filled in (`dagu-8348c`)

Example of what it looks like after filling in:
```
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-abc12@dagu-8348c.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
```

### B) Cloudinary credentials (2 values)
1. Go to https://cloudinary.com and sign in
2. Your Dashboard shows your **API Key** and **API Secret**
3. Paste them:
   - `CLOUDINARY_API_KEY=your_key_here`
   - `CLOUDINARY_API_SECRET=your_secret_here`

The cloud name (`dotvhzjmc`) is already filled in.

---

## STEP 2 — Install dependencies

Open your terminal, `cd` into this folder, and run:

```bash
npm install
```

Wait for it to finish (1–2 minutes).

---

## STEP 3 — Deploy Firestore indexes (one-time)

The app uses compound Firestore queries that require indexes.
Run this once:

```bash
npx firebase-tools deploy --only firestore:indexes
```

If that fails because firebase-tools isn't installed:
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:indexes
```

**Alternatively**, you can skip this and just run the app — when a query
fails because of a missing index, Firebase will print a link in the
browser console that creates the index automatically in one click.

---

## STEP 4 — Run the app locally

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

---

## STEP 5 — Deploy to Vercel (recommended)

1. Push this folder to a GitHub repository
2. Go to https://vercel.com → New Project → Import from GitHub
3. In the **Environment Variables** section, add every variable from `.env.local`
   - **Important:** for `FIREBASE_PRIVATE_KEY`, paste the full key including
     the `-----BEGIN PRIVATE KEY-----` lines. Vercel handles the newlines correctly.
4. Click Deploy

---

## STEP 6 — Update Firebase Auth authorized domains

After deploying, add your Vercel URL to Firebase:
1. Firebase Console → Authentication → Settings → Authorized domains
2. Add your Vercel domain (e.g. `your-app.vercel.app`)

---

## Existing data from old app

All your existing users, videos, comments, and messages are still in
your Firebase project (`dagu-8348c`) — nothing was deleted. The new app
connects to the same database.

**One important change:** the new app requires posts to have
`moderationStatus = "approved"` to appear in the feed. Existing posts
from the old app won't have this field, so they won't show up.

To make old posts visible, run this one-time fix in the Firebase Console:

1. Go to Firestore → videos collection
2. For each existing video, add the field:
   `moderationStatus` = `"approved"` (string)

Or contact me to generate a migration script that does this automatically.

---

## Optional features

| Feature | What to add |
|---|---|
| AI smart captions | Add `OPENAI_API_KEY` to `.env.local` |
| AI content moderation | Add `OPENAI_API_KEY` to `.env.local` |
| Production rate limiting | Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` |

All optional — the app works fully without them.

---

## Troubleshooting

**"Missing Firebase Admin credentials" error**
→ Check that `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` are set in `.env.local`

**"Cloudinary not configured" when uploading**
→ Check `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in `.env.local`

**Feed is empty / shows no posts**
→ Old posts need `moderationStatus: "approved"` field (see Step 6 above)

**"index required" error in console**
→ Click the link Firebase prints in the error — it creates the index automatically

**Google sign-in popup blocked**
→ Make sure your domain is in Firebase Auth → Authorized domains
