// Global click / impression limits on Upstash Redis (REST API, no SDK). Same limits as adsGuard.js, but shared by every server
// instance. Fixed-window counter: INCR the key, set its expiry on first use. Never throws and never blocks play: when the env
// vars are missing or Upstash is slow / down, it answers null and the caller falls back to the in-memory guard.
import { GUARD, makeGuard } from './adsGuard.js';

export const upstashConfigured = (env = process.env) => !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

/** true = record it, false = over the limit, null = Upstash unavailable (use the local guard). */
export async function upstashAllow(key, max, windowSec, { env = process.env, fetchImpl = globalThis.fetch, timeoutMs = 700 } = {}) {
  if (!upstashConfigured(env) || typeof fetchImpl !== 'function') return null;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${env.UPSTASH_REDIS_REST_URL.replace(/\/+$/, '')}/pipeline`, {
      method: 'POST', signal: ctl.signal,
      headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCR', key], ['EXPIRE', key, String(windowSec), 'NX']]),
    });
    if (!res.ok) return null;
    const out = await res.json(); const count = Number(out?.[0]?.result);
    return Number.isFinite(count) ? count <= max : null;
  } catch { return null; } finally { clearTimeout(to); }
}

/** One guard for the route: Upstash first, local memory as the safety net. */
export function makeGlobalGuard(opts = {}) {
  const local = makeGuard();
  return async function allow(kind, who, adId, now = Date.now()) {
    const lim = GUARD[kind]; if (!lim) return false;
    const key = `ads:${kind}:${String(who).replace(/[^0-9a-fA-F:.]/g, '').slice(0, 45)}:${adId}`;
    const r = await upstashAllow(key, lim.max, Math.round(lim.windowMs / 1000), opts);
    return r === null ? local(kind, who, adId, now) : r;
  };
}
