const counts = new Map<string, { count: number; reset: number }>();

export async function rateLimit(identifier: string, max: number, windowMs: number) {
  const now = Date.now();
  const entry = counts.get(identifier);
  if (!entry || now > entry.reset) {
    counts.set(identifier, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  entry.count++;
  if (entry.count > max) {
    return { ok: false, retryAfterMs: entry.reset - now };
  }
  return { ok: true, retryAfterMs: 0 };
}
