# Publish to Google Play (Trusted Web Activity)

1. Deploy the site over HTTPS (e.g. Vercel) and note the domain.
2. Edit `twa/twa-manifest.json`: replace `infinity-now.vercel.app`; keep `packageId` unique forever.
3. `npm i -g @bubblewrap/cli`, then in `twa/`: `bubblewrap init --manifest=https://YOUR-DOMAIN/manifest.json` (or use the file here), then `bubblewrap build`. This makes `app-release-bundle.aab`.
4. Keep `android.keystore` and its password safe and backed up. Never commit it.
5. Play Console → create app → upload the `.aab` → enrol in Play App Signing.
6. Copy the **App signing key SHA-256** from Play Console (Setup → App signing) into `public/.well-known/assetlinks.json`, redeploy. This removes the browser address bar in the app.
7. Listing needs: 512×512 icon (`public/icon-512.png`), 1024×500 feature graphic, 2+ phone screenshots, privacy policy URL (`/privacy`), content rating, Data safety form.
8. New personal developer accounts must run a closed test with 12+ testers for 14 days before production.
9. Ads (v54): the app shows direct, labelled ads and optional rewarded ads. In the Data safety form, answer that no advertising ID is collected and that per-ad view/tap counts are anonymous app-activity analytics; keep `/privacy` as the policy URL. In the content rating questionnaire, state that the app contains ads. Only accept advertisers whose offers fit Play's ads policy.

**This project's live address:** `https://infinity-now.vercel.app` (already filled into `twa/twa-manifest.json`). Quickest way to an Android package without installing anything: open https://www.pwabuilder.com, paste that address, choose Android, download the package (it can also create the signing key for you). Then put the SHA-256 it shows into `public/.well-known/assetlinks.json` and redeploy, so the app opens without a browser bar.
