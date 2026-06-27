import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.https://meet-perch-68631.upstash.io!,
  token: process.env.********!,
});

const limiters = new Map<string, Ratelimit>();

function getLimiter(max: number, windowMs: number) {
  const key = `${max}:${windowMs}`;
  if (!limiters.has(key)) {
    limiters.set(key, new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, `${windowMs}ms`),
    }));
  }
  return limiters.get(key)!;
}

export async function rateLimit(identifier: string, max: number, windowMs: number) {
  const limiter = getLimiter(max, windowMs);
  const { success, reset } = await limiter.limit(identifier);
  return { ok: success, retryAfterMs: Math.max(0, reset - Date.now()) };
}
