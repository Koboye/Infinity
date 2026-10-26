// Browser side of the ad picture upload: read the chosen file, shrink it to a phone-sized JPEG under the size limit.
import { fitInside, AD_IMG_MAX_BYTES, AD_IMG_MAX_FILE } from './adImageCore.js';

/** File → { dataUrl, w, h, kb }. Throws Error with a plain-words message. Transparent PNGs get a dark backdrop (JPEG has no transparency). */
export async function adImageFromFile(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Please choose a picture (JPG, PNG or WebP).');
  if (file.size > AD_IMG_MAX_FILE) throw new Error('That file is over 25 MB. Choose a smaller picture.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('This picture could not be opened. Try a JPG or PNG.')); i.src = url; });
    let { w, h } = fitInside(img.naturalWidth, img.naturalHeight);
    // try the full size first, then a little smaller, until it fits the limit
    for (let shrink = 1; shrink > 0.3; shrink -= 0.15) {
      const cw = Math.max(1, Math.round(w * shrink)), ch = Math.max(1, Math.round(h * shrink));
      const c = document.createElement('canvas'); c.width = cw; c.height = ch;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#0b1f17'; ctx.fillRect(0, 0, cw, ch); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, cw, ch);
      for (const q of [0.86, 0.76, 0.66, 0.56]) {
        const dataUrl = c.toDataURL('image/jpeg', q);
        const bytes = Math.floor((dataUrl.length - 23) * 0.75);
        if (bytes <= AD_IMG_MAX_BYTES * 0.92) return { dataUrl, w: cw, h: ch, kb: Math.round(bytes / 1024), from: { w: img.naturalWidth, h: img.naturalHeight } };
      }
    }
    throw new Error('This picture is too detailed to shrink enough. Try a simpler one.');
  } finally { URL.revokeObjectURL(url); }
}
