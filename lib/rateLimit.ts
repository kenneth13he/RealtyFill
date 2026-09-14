// lib/rateLimit.ts
// Minimal in-memory sliding-window rate limiter. Deliberately not backed by
// Redis/Postgres — Step 9 of the plan already commits to a single
// persistent Node process (not serverless/multi-instance), so in-memory
// state here is genuinely fine, not a shortcut that breaks once deployed.
// Resets on every server restart/redeploy — acceptable for its purpose
// (slowing down brute-force login attempts and runaway paid-API usage, not
// a hard security boundary on its own).

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * @returns true if the call is allowed, false if `key` has exceeded `limit`
 * calls within the current `windowMs` window.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count += 1;
  return true;
}
