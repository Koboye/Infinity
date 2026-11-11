// Fills android-bluetooth/android-web/ (the web folder of the Capacitor Android app) with the offline games.
// The launcher page (android-web/index.html, committed) opens the live site when there is internet and an offline menu when there is not.
// Run:  node scripts/build-android-web.mjs   (then: npx cap sync android)
import { cpSync, rmSync, mkdirSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'android-bluetooth/android-web';
const COPY = ['games/hillclimb-racing', 'icon-192.png', 'icon-512.png', 'afro-logo.svg', 'manifest.json'];
if (!existsSync(join(OUT, 'index.html'))) { console.error('missing', OUT + '/index.html'); process.exit(1); }
for (const item of COPY) {
  const from = join('public', item), to = join(OUT, item);
  if (!existsSync(from)) { console.error('missing public/' + item); process.exit(1); }
  rmSync(to, { recursive: true, force: true }); mkdirSync(join(to, '..'), { recursive: true });
  cpSync(from, to, { recursive: true });
}
const size = (d) => readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(join(d, e.name)) : statSync(join(d, e.name)).size), 0);
console.log('android-web ready:', (size(OUT) / 1048576).toFixed(1), 'MB →', OUT);
