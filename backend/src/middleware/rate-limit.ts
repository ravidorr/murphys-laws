const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
type RateLimitType = 'vote' | 'submit' | 'email' | 'admin-fail';

interface RateLimitConfig {
  max: number;
  window: number;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

const RATE_LIMITS: Record<RateLimitType, RateLimitConfig> = {
  vote: { max: 30, window: RATE_LIMIT_WINDOW_MS }, // 30 votes per minute
  submit: { max: 3, window: RATE_LIMIT_WINDOW_MS }, // 3 submissions per minute
  email: { max: 5, window: RATE_LIMIT_WINDOW_MS }, // 5 emails per minute
  'admin-fail': { max: 10, window: RATE_LIMIT_WINDOW_MS }, // 10 failed admin logins per minute
};

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up old rate limit entries every 5 minutes
/* v8 ignore start -- setInterval callback runs every 5 min; never invoked in unit tests */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime + 60000) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);
/* v8 ignore stop */

/**
 * Reads a quota without using any of it up. `allowed` is false once the limit has been reached in the
 * current window, so callers can refuse expensive work for a client that is already over its limit.
 */
export function peekRateLimit(identifier: string, type: string): RateLimitResult {
  const limit = RATE_LIMITS[type as RateLimitType];
  if (!limit) {
    return { allowed: true, limit: Infinity, remaining: Infinity, resetTime: 0 };
  }

  const now = Date.now();
  const record = rateLimitStore.get(`${type}:${identifier}`);
  if (!record || now > record.resetTime) {
    return { allowed: true, limit: limit.max, remaining: limit.max, resetTime: now + limit.window };
  }

  return {
    allowed: record.count < limit.max,
    limit: limit.max,
    remaining: Math.max(0, limit.max - record.count),
    resetTime: record.resetTime,
  };
}

export function checkRateLimit(identifier: string, type: string): RateLimitResult {
  const limit = RATE_LIMITS[type as RateLimitType];
  if (!limit) {
    return { allowed: true, limit: Infinity, remaining: Infinity, resetTime: 0 };
  }

  const key = `${type}:${identifier}`;
  const now = Date.now();

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { count: 0, resetTime: now + limit.window };
    rateLimitStore.set(key, record);
  }

  // Reset if window expired
  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + limit.window;
  }

  if (record.count >= limit.max) {
    return {
      allowed: false,
      limit: limit.max,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  record.count++;
  return {
    allowed: true,
    limit: limit.max,
    remaining: limit.max - record.count,
    resetTime: record.resetTime,
  };
}
