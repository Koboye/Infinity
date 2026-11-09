// Client address for rate limits and lockouts.
// The LEFT-most X-Forwarded-For entry is whatever the caller typed, so it can be spoofed to dodge a lockout.
// Trusted sources instead: Vercel's own header, then the entry our proxy appended (counted from the RIGHT).
// TRUST_PROXY_HOPS = number of trusted proxies in front of the app (default 1).
export function clientIp(req, env = process.env) {
  const get = (k) => String(req.headers.get(k) || '').trim();
  const vercel = get('x-vercel-forwarded-for').split(',')[0].trim();
  if (vercel) return vercel;
  const parts = get('x-forwarded-for').split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return 'local';
  const hops = Math.max(1, Number(env.TRUST_PROXY_HOPS) || 1);
  return parts[Math.max(0, parts.length - hops)];
}
