// Gebeta service worker: offline play (computer + pass-and-play) after the first visit.
const V = 'gebeta-v25';
const SHELL = ['/', '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png', '/og-image.png'];
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
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then((res) => { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)); return res; }).catch(() => caches.match(r).then((m) => m || caches.match('/'))));
    return;
  }
  e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => {
    if (res.ok || res.type === 'opaque') { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)); }
    return res;
  })));
});
