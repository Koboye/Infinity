import { Redis } from '@upstash/redis';

let redis = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = Redis.fromEnv();
}

// Fallback for local dev without Redis configured — NOT safe for multi-instance
// production use (resets per server restart, doesn't share state across instances).
const memoryStore = new Map();

// key: unique bucket, e.g. `otp:${ip}` or `otp:${email}`
// limit: max requests, windowSeconds: window length
// Returns { allowed, remaining }
export async function rateLimit(key, limit, windowSeconds) {
  if (redis) {
    const now = Date.now();
    const windowKey = `rl:${key}:${Math.floor(now / (windowSeconds * 1000))}`;
    const count = await redis.incr(windowKey);
    if (count === 1) await redis.expire(windowKey, windowSeconds);
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  }

  const now = Date.now();
  const entry = memoryStore.get(key);
  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1 };
  }
  entry.count += 1;
  return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count) };
}

export function clientIp(req) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}
