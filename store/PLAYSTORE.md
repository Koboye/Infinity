# Releasing ገበጣ · ዳማ on Google Play

The app is a Next.js PWA. Google Play accepts it as a **Trusted Web Activity (TWA)** — a thin Android shell around your hosted site. (Online play needs the site hosted, e.g. Firebase Hosting/Vercel, with `NEXT_PUBLIC_FIREBASE_*` set; offline play works from the service worker.)

## 1. Deploy the web app (HTTPS)
`npm run build && npm start` or deploy to Vercel/Firebase. Check at your domain: Lighthouse → "Installable" passes; `/manifest.json` and `/sw.js` load.

## 2. Build the Android bundle (AAB)
```
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://YOUR-DOMAIN/manifest.json   # package id e.g. com.yourname.gebeta
bubblewrap build                                               # outputs app-release-bundle.aab
```
Or use https://www.pwabuilder.com (paste your URL → Android → Play Store package).

## 3. Digital Asset Links (removes the browser address bar)
Put your signing certificate SHA-256 (from Play Console → App signing, and your upload key) into `public/.well-known/assetlinks.json`, set `package_name`, redeploy.

## 4. Play Console
- Create app → upload the `.aab` to Internal testing first, then Production (new personal accounts must run a closed test with 12+ testers for 14 days).
- Store listing text: `store/listing.md`. Graphics needed: 512×512 icon (`public/icon-512.png`), 1024×500 feature graphic, 2–8 phone screenshots (take them from the running app, both languages).
- Privacy policy URL: `https://YOUR-DOMAIN/privacy`. Data safety form: collects email (account), display name, avatar, gameplay results; data is encrypted in transit; users can delete their account by request (add a contact email in the privacy page).
- Content rating questionnaire: no violence, no gambling, no ads → Everyone.
- Target API level and 64-bit are handled by Bubblewrap's current template.

## 5. Before you submit
- Replace `com.example.gebeta` everywhere; set a real support email in `/privacy` and `/terms`.
- Rotate Firebase keys into production env vars; deploy `firestore.rules` and `firestore.indexes.json`.
- Music is original generated audio (no third-party recordings). If you want real recordings (e.g. famous masenqo/Gigi tracks) you must license them from the rights holders.
