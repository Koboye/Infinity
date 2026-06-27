// src/lib/utils/rateLimit.ts
// Persistent rate limiter backed by Upstash Redis.
// Falls back to in-memory if UPSTASH_REDIS_REST_URL is not set (local dev).
// Call sites are unchanged — same rateLimit(key, limit, windowMs) signature.

interface RateLimitResult { ok: boolean; retryAfterMs: number; }

// ── In-memory fallback (local dev / missing env) ────────────────────────────
const localBuckets = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of localBuckets) if (b.resetAt < now) localBuckets.delete(key);
}, 5 * 60_000);

function localLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const b = localBuckets.get(key);
  if (!b || b.resetAt < now) {
    localBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (b.count >= limit) return { ok: false, retryAfterMs: b.resetAt - now };
  b.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

// ── Upstash Redis (production) ───────────────────────────────────────────────
// Uses the REST API directly so no extra npm package is required.
// Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to your env.
async function redisLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const url   = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const rkey  = `rl:${key}`;
  const windowSec = Math.ceil(windowMs / 1000);

  // INCR + EXPIRE in a pipeline (2 commands, 1 round-trip)
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCR', rkey],
      ['EXPIRE', rkey, windowSec, 'NX'], // NX = only set expiry on first write
    ]),
  });

  if (!res.ok) throw new Error(`Upstash error ${res.status}`);
  const [[, count]] = await res.json() as [[string, number], unknown];

  if (count > limit) {
    // Get the remaining TTL so we can return an accurate retryAfterMs
    const ttlRes = await fetch(`${url}/pttl/${rkey}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { result: pttl } = await ttlRes.json() as { result: number };
    return { ok: false, retryAfterMs: Math.max(pttl, 0) };
  }

  return { ok: true, retryAfterMs: 0 };
}

// ── Public API ───────────────────────────────────────────────────────────────
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await redisLimit(key, limit, windowMs);
    } catch (err) {
      // If Redis is unreachable, degrade to in-memory rather than blocking all requests
      console.warn('Upstash rate limit failed, falling back to in-memory:', err);
    }
  }
  return localLimit(key, limit, windowMs);
}
