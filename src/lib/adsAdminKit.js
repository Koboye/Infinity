// Presets and helpers behind the owner page's dropdowns (pure, so they are tested).
import { isOwnAdImage } from './adImageCore.js';
export const today = () => new Date().toISOString().slice(0, 10);
export const plus = (d) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
export const GAME_IDS = ['gebeta', 'checkers', 'bingo', 'ludo', 'dominoes'];
export const GAME_NAME = { gebeta: 'Gebeta', checkers: 'Dama (Checkers)', bingo: 'Bingo', ludo: 'Ludo', dominoes: 'Dominoes' };
export const PLACE_LABEL = { splash: 'App open', pre_game: 'Before a game', rewarded: 'Watch for +2 spins' };

// ── dropdown presets (the owner picks; nothing needs typing except the client's own words and links) ──
export const PLACE_PRESETS = [
  ['recommended', 'App open + before games (recommended)', ['splash', 'pre_game']],
  ['splash', 'App open only', ['splash']],
  ['pre_game', 'Before games only', ['pre_game']],
  ['rewarded', 'Watch for free spins only', ['rewarded']],
  ['all', 'Everywhere (all three)', ['splash', 'pre_game', 'rewarded']],
];
export const placeKey = (pl) => { const k = [...(pl || [])].sort().join(); return (PLACE_PRESETS.find((x) => [...x[2]].sort().join() === k) || [])[0] || 'custom'; };
export const CTA_PRESETS = [
  ['Learn more', 'ተጨማሪ ይመልከቱ'], ['Visit website', 'ድረ-ገጽ ይጎብኙ'], ['Get the offer', 'ቅናሹን ያግኙ'], ['Shop now', 'አሁን ይግዙ'],
  ['Order now', 'አሁን ያዝዙ'], ['Call now', 'አሁን ይደውሉ'], ['Open an account', 'አካውንት ይክፈቱ'], ['Register', 'ይመዝገቡ'], ['Book a ticket', 'ትኬት ይያዙ'],
];
export const WEIGHTS = [[1, 'Normal'], [2, 'Double — shown twice as often'], [3, 'Triple'], [5, 'High (5×)'], [10, 'Very high (10×)'], [25, 'Top priority (25×)']];
export const LENGTHS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
export const STARTS = [['today', 'Today', 0], ['tomorrow', 'Tomorrow', 1], ['3d', 'In 3 days', 3], ['week', 'In a week', 7], ['custom', 'Pick a date…', null]];
export const DURATIONS = [[1, '1 day'], [3, '3 days'], [7, '1 week'], [14, '2 weeks'], [30, '1 month'], [60, '2 months'], [90, '3 months'], [0, 'Pick an end date…']];
export const TIMES = [
  ['all', 'All day', null], ['morning', 'Morning (5:00 – 12:00)', [5, 12]], ['afternoon', 'Afternoon (12:00 – 17:00)', [12, 17]],
  ['evening', 'Evening (17:00 – 22:00)', [17, 22]], ['night', 'Night (22:00 – 5:00)', [22, 5]], ['custom', 'Choose hours…', 'custom'],
];
export const timeKey = (f, t) => { if (f === '' || t === '' || f === t) return 'all'; const m = TIMES.find((x) => Array.isArray(x[2]) && x[2][0] === Number(f) && x[2][1] === Number(t)); return m ? m[0] : 'custom'; };
export const PER_USER = [1, 2, 3, 5, 10, 20];
export const DAILY = [[0, 'No limit'], [500, '500 views a day'], [1000, '1,000 views a day'], [2500, '2,500 views a day'], [5000, '5,000 views a day'], [10000, '10,000 views a day'], [25000, '25,000 views a day']];
export const HOURS = Array.from({ length: 24 }, (_, h) => h);
export const slug = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
export const MONTH = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const autoId = (adv, start) => { const b = slug(adv); const d = new Date(`${start || today()}T00:00:00Z`); return b ? `${b}-${MONTH[d.getUTCMonth()]}${String(d.getUTCFullYear()).slice(2)}` : ''; };
export const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86_400_000) + 1;
export const addDays = (d, n) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
export const plain = (f) => {
  const where = (f.placements || []).map((p) => PLACE_LABEL[p]).join(' + ') || 'nowhere';
  const who = f.langs?.length === 1 ? (f.langs[0] === 'en' ? 'English players' : 'አማርኛ players') : 'all players';
  const games = (f.games || []).length ? `before ${(f.games || []).map((g) => GAME_NAME[g] || g).join(', ')}` : 'before any game';
  const time = timeKey(f.hourFrom, f.hourTo) === 'all' ? 'all day' : `${String(f.hourFrom).padStart(2, '0')}:00–${String(f.hourTo).padStart(2, '0')}:00`;
  return `Shows ${where} · to ${who} · ${(f.placements || []).includes('pre_game') ? games : 'on open'} · ${time} · ${f.durationSec}s · ${f.start} → ${f.end} (${Math.max(1, daysBetween(f.start, f.end))} days) · up to ${f.maxPerUser}× per player a day${f.dailyCap > 0 ? ` · ${Number(f.dailyCap).toLocaleString()} views a day in total` : ''}.`;
};

/** Hosts the app's Content-Security-Policy lets ad pictures load from (extra ones come from NEXT_PUBLIC_ADS_IMG_HOSTS). */
export const IMG_HOSTS = ['firebasestorage.googleapis.com', 'storage.googleapis.com', 'lh3.googleusercontent.com'];
/** A plain-words problem with a picture link, or '' when it looks usable. `extra` = space-separated extra hosts (https://host …). */
export function imageProblem(url, extra = '') {
  const v = String(url || '').trim();
  if (!v) return '';
  let u; try { u = new URL(v); } catch { return 'This is not a valid link. It must start with https://'; }
  if (u.protocol !== 'https:') return 'The link must start with https://';
  if (isOwnAdImage(v, typeof location !== 'undefined' ? location.host : '')) return '';   // a picture uploaded in this admin page
  const host = u.hostname.toLowerCase();
  if (/(^|\.)(youtube\.com|youtu\.be|facebook\.com|fb\.com|instagram\.com|t\.me|telegram\.me|tiktok\.com|twitter\.com|x\.com)$/.test(host)) return 'This is a web page, not a picture. Upload a JPG or PNG to Firebase Storage and paste its download link here. (Put this link in "Where a tap goes" instead.)';
  const allowed = [...IMG_HOSTS, ...String(extra).split(/\s+/).filter(Boolean).map((h) => { try { return new URL(h).hostname.toLowerCase(); } catch { return h.toLowerCase(); } })];
  if (!allowed.includes(host)) return `Pictures from ${host} are blocked by the app's security policy. Use a Firebase Storage link, or add https://${host} to NEXT_PUBLIC_ADS_IMG_HOSTS in Vercel and redeploy.`;
  return '';
}
