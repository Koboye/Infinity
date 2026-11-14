import assert from 'node:assert/strict';
process.env.NODE_ENV = 'production';
const { default: cfg } = await import('../next.config.mjs');
const blocks = await cfg.headers();
const toMap = (b) => Object.fromEntries(b.headers.map((x) => [x.key, x.value]));
const games = toMap(blocks.find((b) => b.source.startsWith('/games/')));   // pages Infinity itself embeds for study-break games
const h = toMap(blocks.find((b) => !b.source.startsWith('/games/')));       // every other route
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
t('hides X-Powered-By', () => assert.equal(cfg.poweredByHeader, false));
t('HSTS in production', () => assert.match(h['Strict-Transport-Security'], /max-age=\d{7,}/));
t('clickjacking blocked twice on every app route', () => { assert.equal(h['X-Frame-Options'], 'DENY'); assert.match(h['Content-Security-Policy'], /frame-ancestors 'none'/); });
t('game pages may be framed by Infinity itself only (same origin), never by other sites', () => { assert.equal(games['X-Frame-Options'], 'SAMEORIGIN'); assert.match(games['Content-Security-Policy'], /frame-ancestors 'self'/); assert.ok(!/frame-ancestors[^;]*\*/.test(games['Content-Security-Policy'])); });
t('nosniff + referrer policy', () => { assert.equal(h['X-Content-Type-Options'], 'nosniff'); assert.ok(h['Referrer-Policy']); });
t('permissions policy: camera only for this app (nearby-race QR scan), payment denied', () => { assert.match(h['Permissions-Policy'], /camera=\(self\)/); assert.match(h['Permissions-Policy'], /payment=\(\)/); });
t('CSP: no eval in production, no plugins, locked base/form', () => { const c = h['Content-Security-Policy']; assert.ok(!c.includes("'unsafe-eval'")); assert.match(c, /object-src 'none'/); assert.match(c, /base-uri 'self'/); assert.match(c, /form-action 'self'/); });
console.log(n, 'tests passed');
