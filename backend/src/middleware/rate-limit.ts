const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
type RateLimitType = 'vote' | 'submit' | 'email';

interface RateLimitConfig {
  max: number;
  window: number;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

const RATE_LIMITS: Record<RateLimitType, RateLimitConfig> = {
  vote: { max: 30, window: RATE_LIMIT_WINDOW_MS }, // 30 votes per minute
  submit: { max: 3, window: RATE_LIMIT_WINDOW_MS }, // 3 submissions per minute
  email: { max: 5, window: RATE_LIMIT_WINDOW_MS }, // 5 emails per minute
};

const rateLimitStore = new Map<string, RateLimitRecord>();

/* v8 ignore start - Background cleanup interval is tested indirectly */
// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime + 60000) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);
/* v8 ignore stop */

export function checkRateLimit(identifier: string, type: string): RateLimitResult {
  const limit = RATE_LIMITS[type as RateLimitType];
  if (!limit) {
    return { allowed: true, remaining: Infinity, resetTime: 0 };
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
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  record.count++;
  return {
    allowed: true,
    remaining: limit.max - record.count,
    resetTime: record.resetTime,
  };
}
