// Click / impression integrity. Pure (no storage, network or UI). Stops one address from inflating an ad's counters, which would
// otherwise feed straight into the tap-rate learning and the daily budget. Limits are generous because many phones share one
// mobile-carrier address; state is per server instance (same as the other rate limits in this app).
export const GUARD = { click: { max: 3, windowMs: 3_600_000 }, impression: { max: 60, windowMs: 3_600_000 }, maxKeys: 20_000 };

export function makeGuard(limits = GUARD) {
  const hits = new Map();
  /** Count one `kind` ('click' | 'impression') of `adId` from `who`. Returns true when it should be recorded. */
  return function allow(kind, who, adId, now = Date.now()) {
    const lim = limits[kind]; if (!lim) return false;
    const key = `${kind}|${who}|${adId}`;
    const arr = (hits.get(key) || []).filter((t) => now - t < lim.windowMs);
    if (arr.length >= lim.max) { hits.set(key, arr); return false; }
    arr.push(now); hits.set(key, arr);
    if (hits.size > (limits.maxKeys || 20_000)) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 3_600_000) hits.delete(k);
    return true;
  };
}
