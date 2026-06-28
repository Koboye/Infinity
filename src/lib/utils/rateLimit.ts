/**
 * Persistent rate limiter using Upstash Redis (recommended for production)
 * with an automatic in-memory fallback for local development.
 *
 * SETUP (one-time):
 *   1. Create a free Redis database at https://console.upstash.com
 *   2. Add to your environment variables:
 *        UPSTASH_REDIS_REST_URL=https://...upstash.io
 *        UPSTASH_REDIS_REST_TOKEN=AX...
 *   3. npm install @upstash/redis
 *
 * When those env vars are absent (local dev, CI) the in-memory fallback
 * is used automatically — no code changes needed between environments.
 */

// ---------- in-memory fallback (dev only) ----------
const _mem = new Map<string, { count: number; reset: number }>();

async function memLimit(
  identifier: string,
  max: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfterMs: number }> {
  const now = Date.now();
  const entry = _mem.get(identifier);
  if (!entry || now > entry.reset) {
    _mem.set(identifier, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  entry.count++;
  if (entry.count > max) {
    return { ok: false, retryAfterMs: entry.reset - now };
  }
  return { ok: true, retryAfterMs: 0 };
}

// ---------- Upstash Redis implementation ----------
async function redisLimit(
  url: string,
  token: string,
  identifier: string,
  max: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfterMs: number }> {
  const key = `rl:${identifier}`;
  const windowSec = Math.ceil(windowMs / 1000);

  // INCR then set expiry only on first call (EXPIRE is a no-op if key already has TTL)
  const incrRes = await fetch(`${url}/incr/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!incrRes.ok) throw new Error('Redis INCR failed');
  const { result: count } = (await incrRes.json()) as { result: number };

  if (count === 1) {
    // First request in this window — set the TTL
    await fetch(`${url}/expire/${key}/${windowSec}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  if (count > max) {
    // Get remaining TTL so we can return a useful retryAfterMs
    const ttlRes = await fetch(`${url}/ttl/${key}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { result: ttl } = ttlRes.ok
      ? ((await ttlRes.json()) as { result: number })
      : { result: windowSec };

    return { ok: false, retryAfterMs: Math.max(0, ttl) * 1000 };
  }

  return { ok: true, retryAfterMs: 0 };
}

// ---------- public API (unchanged call signature) ----------
export async function rateLimit(
  identifier: string,
  max: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfterMs: number }> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      return await redisLimit(url, token, identifier, max, windowMs);
    } catch (err) {
      // If Redis is unreachable, fall back rather than blocking all requests.
      console.error('[rateLimit] Redis error, falling back to in-memory:', err);
    }
  }

  return memLimit(identifier, max, windowMs);
}
