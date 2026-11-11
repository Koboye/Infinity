# Android app with Bluetooth (Afro Zone)

The Play Store build today is a TWA (`twa/`): a browser window. A browser cannot do phone-to-phone Bluetooth, so the real app
is a **Capacitor** shell that loads the same website (`https://infinity-now.vercel.app`) and adds one native plugin,
`AfroBluetooth`. The race games already contain the Bluetooth screens: they appear and work **only** when this plugin is present
(`public/games/hillclimb-racing/nearby.js`). In a normal browser the Bluetooth buttons just say it is an Android-app feature.

## Build it (needs Android Studio + Node on your computer)
```bash
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Afro Zone" com.koboye.infinity --web-dir android-web   # or copy capacitor.config.json from this folder
npx cap add android
# 1. copy the Kotlin files into android/app/src/main/java/com/koboye/infinity/  (replace the generated MainActivity)
cp android-bluetooth/AfroBluetoothPlugin.kt android-bluetooth/MainActivity.kt android/app/src/main/java/com/koboye/infinity/
# 2. paste the permissions from AndroidManifest.permissions.xml into android/app/src/main/AndroidManifest.xml
# 3. make sure android-web/index.html exists (it is in this folder) and capacitor.config.json is in the project root
npx cap sync android
npx cap open android      # run on two real phones (Bluetooth does not work in the emulator)
```
Kotlin must be enabled in the Android project (Capacitor 6+ projects already have it; otherwise add the Kotlin Gradle plugin).

## Keep the same app id
`com.koboye.infinity` is the id of the current TWA. Using the same id and the **same signing key** (`twa/android.keystore`)
lets the new app replace the old one for existing players. Raise `versionCode` above the TWA's (1).

## Try it
1. Install on two phones, turn Bluetooth on.
2. Phone A: Games, Hill Climb Racer, ONLINE RACE, NEARBY, **BLUETOOTH · HOST**. Allow "Nearby devices". Accept the "make visible" prompt.
3. Phone B: same screens, **BLUETOOTH · JOIN**, tap Phone A's name (Android may ask to pair, accept on both).
4. The race lobby opens by itself on both phones.

## Honest notes
- Written and checked against the Capacitor and Android Bluetooth APIs, but **not yet run on a device** (no Android build tools or phones were
  available when it was written). Expect to fix small build details on the first compile; the web side is tested against a simulated bridge.
- Classic Bluetooth (RFCOMM) range is a few metres up to about 10 m. Speed is plenty for the race (about 5 small messages a second).
- iPhone: not covered (Android first).
