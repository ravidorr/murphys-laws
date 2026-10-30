// Request timeout signal that works where AbortSignal.timeout() (Chrome 124, Safari 16) is missing.

/**
 * Returns a signal that aborts with a TimeoutError DOMException after `ms`, or undefined when the
 * browser has no AbortController (the request then runs without a client-side timeout).
 */
export function createTimeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  if (typeof AbortController === 'undefined') return undefined;
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException('The operation timed out.', 'TimeoutError')), ms);
  return controller.signal;
}
