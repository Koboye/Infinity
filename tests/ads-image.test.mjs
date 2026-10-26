// Ad picture upload: sizing maths, server-side picture checks, and that our own picture links pass the owner page's validator.
import assert from 'node:assert/strict';
import { fitInside, parseImageDataUrl, isOwnAdImage, AD_IMG_MAX_BYTES, AD_IMG_PATH } from '../src/lib/adImageCore.js';
import { imageProblem } from '../src/lib/adsAdminKit.js';
import { sanitizeAd } from '../src/lib/adsCore.js';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(400, 7)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(400, 1)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(400, 2)]);
const url = (mime, b) => `data:${mime};base64,${b.toString('base64')}`;
const id = 'a1b2c3d4e5f60718293a4b5c';

t('fitInside shrinks big pictures, keeps the shape and never enlarges', () => {
  assert.deepEqual(fitInside(4000, 5000), { w: 1080, h: 1350 });
  assert.deepEqual(fitInside(3000, 1000), { w: 1080, h: 360 });
  assert.deepEqual(fitInside(500, 400), { w: 500, h: 400 });
  assert.deepEqual(fitInside(0, 10), { w: 0, h: 0 });
});
t('accepts real JPG, PNG and WebP pictures', () => {
  for (const [m, b] of [['image/jpeg', jpeg], ['image/png', png], ['image/webp', webp]]) { const r = parseImageDataUrl(url(m, b)); assert.ok(r.ok, m); assert.equal(r.mime, m); }
});
t('rejects other types, scripts and disguised files', () => {
  assert.ok(!parseImageDataUrl(url('image/svg+xml', Buffer.from('<svg onload=alert(1)>'))).ok);
  assert.ok(!parseImageDataUrl('data:text/html;base64,PGgxPg==').ok);
  assert.ok(!parseImageDataUrl(url('image/png', jpeg)).ok, 'a JPEG that claims to be a PNG');
  assert.ok(!parseImageDataUrl(url('image/jpeg', Buffer.from('<script>alert(1)</script>'.repeat(10)))).ok, 'text that claims to be a JPEG');
  assert.ok(!parseImageDataUrl('').ok && !parseImageDataUrl(null).ok && !parseImageDataUrl('https://x/y.png').ok);
});
t('rejects empty and oversize pictures with a readable reason', () => {
  assert.match(parseImageDataUrl(url('image/jpeg', Buffer.from([0xff, 0xd8, 0xff]))).error, /empty/);
  const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(AD_IMG_MAX_BYTES + 10, 3)]);
  assert.match(parseImageDataUrl(url('image/jpeg', big)).error, /too large/);
});
t('recognises our own picture addresses and nothing look-alike', () => {
  assert.ok(isOwnAdImage(`https://infinity-now.vercel.app${AD_IMG_PATH}${id}`));
  assert.ok(isOwnAdImage(`https://infinity-now.vercel.app${AD_IMG_PATH}${id}`, 'infinity-now.vercel.app'));
  assert.ok(!isOwnAdImage(`https://evil.example${AD_IMG_PATH}${id}`, 'infinity-now.vercel.app'), 'other host');
  assert.ok(!isOwnAdImage(`http://infinity-now.vercel.app${AD_IMG_PATH}${id}`), 'not https');
  assert.ok(!isOwnAdImage(`https://infinity-now.vercel.app${AD_IMG_PATH}${id}?x=1`), 'query');
  assert.ok(!isOwnAdImage(`https://infinity-now.vercel.app${AD_IMG_PATH}short`), 'bad id');
  assert.ok(!isOwnAdImage(`https://infinity-now.vercel.app${AD_IMG_PATH}${id}/../x`), 'path trick');
});
t('the owner page accepts an uploaded picture link and still blocks web pages', () => {
  assert.equal(imageProblem(`https://infinity-now.vercel.app${AD_IMG_PATH}${id}`), '');
  assert.match(imageProblem('https://www.youtube.com/watch?v=x'), /web page/);
  assert.match(imageProblem('https://random.example/a.png'), /blocked/);
});
t('the server-side ad validator saves an ad that uses an uploaded picture', () => {
  const r = sanitizeAd({ id: 'abay-bank-oct26', advertiser: 'Abay Bank', category: 'bank', image: `https://infinity-now.vercel.app${AD_IMG_PATH}${id}`, clickUrl: 'https://abay.example', start: '2026-10-26', end: '2026-11-26', placements: ['splash'], durationSec: 5, weight: 1, maxPerUser: 3, active: true });
  assert.ok(r.ok, r.errors?.join('; '));
  assert.ok(r.ad.image.endsWith(id));
});
console.log(`${n} passed`);
