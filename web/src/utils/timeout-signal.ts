// Request timeout signal that works where AbortSignal.timeout() (Chrome 124, Safari 16) is missing.

/**
 * Returns a signal that aborts after `ms`, or undefined when the browser has no AbortController (the
 * request then runs without a client-side timeout). The fallback aborts without a reason, so the
 * request rejects with an AbortError rather than the TimeoutError the native version produces. Old
 * browsers may not support `new DOMException()` or abort reasons, so neither is used here.
 */
export function createTimeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  if (typeof AbortController === 'undefined') return undefined;
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}
