// Ad pictures you upload in the admin page. The browser shrinks the picture first (so a 6 MB phone photo becomes ~200 KB),
// the server checks it again (never trust the browser), keeps it in Firestore (adImages/{id}) and serves it from our own
// address /api/ads/img/{id}. That address is an https link on our own site, so the app's security policy already allows it.

export const AD_IMG_MAX_W = 1080, AD_IMG_MAX_H = 1350;          // 4:5 portrait is the best ad shape on phones
export const AD_IMG_MAX_BYTES = 700 * 1024;                      // a Firestore document may hold 1 MiB: stay well under
export const AD_IMG_MAX_FILE = 25 * 1024 * 1024;                 // largest original the admin may pick
export const AD_IMG_PATH = '/api/ads/img/';
export const AD_IMG_ID = /^[a-f0-9]{24}$/;

/** The largest size that fits inside maxW×maxH and keeps the proportions (never enlarges). */
export function fitInside(w, h, maxW = AD_IMG_MAX_W, maxH = AD_IMG_MAX_H) {
  if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 };
  const k = Math.min(1, maxW / w, maxH / h);
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

const MAGIC = [
  ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/png', (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  ['image/webp', (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50],
];

/** Check an uploaded picture sent as a data URL. Returns { ok, mime, bytes } or { ok:false, error } (error is plain words for the admin). */
export function parseImageDataUrl(input) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(input || ''));
  if (!m) return { ok: false, error: 'That is not a JPG, PNG or WebP picture.' };
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length < 100) return { ok: false, error: 'That picture is empty.' };
  if (bytes.length > AD_IMG_MAX_BYTES) return { ok: false, error: `That picture is too large (${Math.round(bytes.length / 1024)} KB, the limit is ${Math.round(AD_IMG_MAX_BYTES / 1024)} KB).` };
  const real = MAGIC.find(([, test]) => test(bytes));
  if (!real || real[0] !== m[1]) return { ok: false, error: 'The file is not really the picture type it says it is.' };
  return { ok: true, mime: real[0], bytes };
}

/** True for an address of one of our own uploaded pictures, on this site (host given) or any site (host omitted). */
export function isOwnAdImage(url, host = '') {
  let u; try { u = new URL(String(url || '')); } catch { return false; }
  if (u.protocol !== 'https:' || u.search || u.hash) return false;
  if (host && u.host !== host) return false;
  return u.pathname.startsWith(AD_IMG_PATH) && AD_IMG_ID.test(u.pathname.slice(AD_IMG_PATH.length));
}
