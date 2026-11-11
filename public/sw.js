// Gebeta service worker: offline play (computer + pass-and-play) after the first visit.
const V = 'gebeta-v36';   // v73: bumped so phones drop the old cache and pick up the new brand, friends and rulebook files
const MAX_RUNTIME = 220;   // cap on runtime-cached files so panoramas cannot fill a phone
const keep = (r, res) => { if (!res || !(res.ok || res.type === 'opaque')) return; const c = res.clone(); caches.open(V).then(async (x) => { await x.put(r, c); const ks = await x.keys(); if (ks.length > MAX_RUNTIME) await Promise.all(ks.slice(0, ks.length - MAX_RUNTIME).map((k) => x.delete(k))); }).catch(() => {}); };
const SHELL = ['/', '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png', '/afro-logo.svg', '/og-image.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request; const u = new URL(r.url);
  if (r.method !== 'GET' || u.pathname.startsWith('/api/') || u.pathname.startsWith('/audio/')) return; // audio streams with Range requests; let the network handle it
  const sameOrigin = u.origin === self.location.origin;
  const font = u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !font) return; // never touch Firebase/Auth traffic
  if (r.mode === 'navigate' || u.pathname.startsWith('/games/')) {
    e.respondWith(fetch(r).then((res) => { keep(r, res); return res; }).catch(() => caches.match(r).then((m) => m || caches.match('/'))));
    return;
  }
  e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { keep(r, res); return res; })));
});
