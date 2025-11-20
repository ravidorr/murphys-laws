const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMITS = {
  vote: { max: 30, window: RATE_LIMIT_WINDOW_MS }, // 30 votes per minute
  submit: { max: 3, window: RATE_LIMIT_WINDOW_MS }, // 3 submissions per minute
  email: { max: 5, window: RATE_LIMIT_WINDOW_MS }, // 5 emails per minute
};

const rateLimitStore = new Map();

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime + 60000) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function checkRateLimit(identifier, type) {
  const limit = RATE_LIMITS[type];
  if (!limit) return { allowed: true, remaining: Infinity, resetTime: 0 };

  const key = `${type}:${identifier}`;
  const now = Date.now();

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 0, resetTime: now + limit.window });
  }

  const record = rateLimitStore.get(key);

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
