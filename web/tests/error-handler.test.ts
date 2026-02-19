import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isTransientError,
  calculateBackoff,
  withRetry,
  safeAsync,
  createRetryable,
  formatErrorMessage
} from '../src/utils/error-handler.ts';

// Mock Sentry module
vi.mock('@sentry/browser', () => ({
  captureException: vi.fn()
}));

// Mock notification module
vi.mock('../src/components/notification.js', () => ({
  showError: vi.fn()
}));

import * as Sentry from '@sentry/browser';
import { showError } from '../src/components/notification.js';

describe('Error Handler Utilities', () => {
  /** @type {typeof globalThis} */
  let localThis;

  beforeEach(() => {
    localThis = {
      mockFn: vi.fn(),
      onRetryCallback: vi.fn()
    };
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isTransientError', () => {
    it('returns true for network errors', () => {
      expect(isTransientError(new Error('Network error'))).toBe(true);
      expect(isTransientError(new Error('network connection failed'))).toBe(true);
    });

    it('returns true for connection errors', () => {
      expect(isTransientError(new Error('Connection refused'))).toBe(true);
    });

    it('returns true for rate limit errors', () => {
      expect(isTransientError(new Error('Rate limit exceeded'))).toBe(true);
      expect(isTransientError(new Error('Error 429: Too many requests'))).toBe(true);
    });

    it('returns true for server errors', () => {
      expect(isTransientError(new Error('Server error'))).toBe(true);
      expect(isTransientError(new Error('Error 500'))).toBe(true);
      expect(isTransientError(new Error('502 Bad Gateway'))).toBe(true);
      expect(isTransientError(new Error('503 Service Unavailable'))).toBe(true);
      expect(isTransientError(new Error('504 Gateway Timeout'))).toBe(true);
    });

    it('returns true for timeout errors', () => {
      expect(isTransientError(new Error('Request timeout'))).toBe(true);
      expect(isTransientError(new Error('Operation timed out'))).toBe(true);
    });

    it('returns false for non-transient errors', () => {
      expect(isTransientError(new Error('Invalid input'))).toBe(false);
      expect(isTransientError(new Error('Not found'))).toBe(false);
      expect(isTransientError(new Error('Unauthorized'))).toBe(false);
    });

    it('handles null/undefined errors', () => {
      expect(isTransientError(null)).toBe(false);
      expect(isTransientError(undefined)).toBe(false);
      expect(isTransientError({})).toBe(false);
    });
  });

  describe('calculateBackoff', () => {
    it('calculates exponential backoff', () => {
      // With jitter, we can only check ranges
      const delay0 = calculateBackoff(0, 1000, 10000);
      const delay1 = calculateBackoff(1, 1000, 10000);
      const delay2 = calculateBackoff(2, 1000, 10000);

      // Base delays before jitter: 1000, 2000, 4000
      // With up to 25% jitter: 1000-1250, 2000-2500, 4000-5000
      expect(delay0).toBeGreaterThanOrEqual(1000);
      expect(delay0).toBeLessThanOrEqual(1250);

      expect(delay1).toBeGreaterThanOrEqual(2000);
      expect(delay1).toBeLessThanOrEqual(2500);

      expect(delay2).toBeGreaterThanOrEqual(4000);
      expect(delay2).toBeLessThanOrEqual(5000);
    });

    it('caps delay at maxDelay', () => {
      const delay = calculateBackoff(10, 1000, 5000);
      expect(delay).toBeLessThanOrEqual(5000 * 1.25); // maxDelay plus potential jitter
    });

    it('uses default values', () => {
      const delay = calculateBackoff(0);
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(1250);
    });
  });

  describe('withRetry', () => {
    it('returns result on first success', async () => {
      localThis.mockFn.mockResolvedValue('success');

      const resultPromise = withRetry(localThis.mockFn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(localThis.mockFn).toHaveBeenCalledTimes(1);
    });

    it('retries on transient error and succeeds', async () => {
      localThis.mockFn
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');

      const resultPromise = withRetry(localThis.mockFn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(localThis.mockFn).toHaveBeenCalledTimes(2);
    });

    it('throws after max retries', async () => {
      vi.useRealTimers(); // Use real timers for this test to avoid async handling issues

      const error = new Error('Network error');
      localThis.mockFn.mockRejectedValue(error);

      await expect(withRetry(localThis.mockFn, {
        maxRetries: 2,
        baseDelay: 1, // Use minimal delay for fast test
        maxDelay: 1
      })).rejects.toThrow('Network error');

      expect(localThis.mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('does not retry non-transient errors', async () => {
      const error = new Error('Invalid input');
      localThis.mockFn.mockRejectedValue(error);

      await expect(withRetry(localThis.mockFn)).rejects.toThrow('Invalid input');
      expect(localThis.mockFn).toHaveBeenCalledTimes(1);
    });

    it('calls onRetry callback before each retry', async () => {
      localThis.mockFn
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');

      const resultPromise = withRetry(localThis.mockFn, {
        onRetry: localThis.onRetryCallback,
        baseDelay: 100
      });
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(localThis.onRetryCallback).toHaveBeenCalledTimes(2);
      expect(localThis.onRetryCallback).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
      expect(localThis.onRetryCallback).toHaveBeenCalledWith(2, expect.any(Error), expect.any(Number));
    });

    it('respects custom shouldRetry function', async () => {
      const error = new Error('Custom retryable error');
      localThis.mockFn
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const resultPromise = withRetry(localThis.mockFn, {
        shouldRetry: (err) => err.message.includes('Custom')
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(localThis.mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('safeAsync', () => {
    it('returns data on success', async () => {
      localThis.mockFn.mockResolvedValue('result');

      const { data, error } = await safeAsync(localThis.mockFn);

      expect(data).toBe('result');
      expect(error).toBeNull();
    });

    it('returns error on failure', async () => {
      const testError = new Error('Test error');
      localThis.mockFn.mockRejectedValue(testError);

      const { data, error } = await safeAsync(localThis.mockFn);

      expect(data).toBeNull();
      expect(error).toBe(testError);
    });

    it('reports error to Sentry on failure', async () => {
      const testError = new Error('Test error');
      localThis.mockFn.mockRejectedValue(testError);

      await safeAsync(localThis.mockFn);

      expect(Sentry.captureException).toHaveBeenCalledWith(testError);
    });

    it('shows notification when showNotification is true', async () => {
      localThis.mockFn.mockRejectedValue(new Error('Test error'));

      await safeAsync(localThis.mockFn, { showNotification: true });

      expect(showError).toHaveBeenCalledWith('Test error');
    });

    it('uses custom error message for notification', async () => {
      localThis.mockFn.mockRejectedValue(new Error('Original error'));

      await safeAsync(localThis.mockFn, {
        showNotification: true,
        errorMessage: 'Custom message'
      });

      expect(showError).toHaveBeenCalledWith('Custom message');
    });

    it('calls onError callback', async () => {
      const testError = new Error('Test error');
      localThis.mockFn.mockRejectedValue(testError);
      const onError = vi.fn();

      await safeAsync(localThis.mockFn, { onError });

      expect(onError).toHaveBeenCalledWith(testError);
    });

    it('enables retry when retry option is true', async () => {
      localThis.mockFn
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');

      const resultPromise = safeAsync(localThis.mockFn, { retry: true });
      await vi.runAllTimersAsync();
      const { data, error } = await resultPromise;

      expect(data).toBe('success');
      expect(error).toBeNull();
      expect(localThis.mockFn).toHaveBeenCalledTimes(2);
    });

    it('uses fallback message when error has no message', async () => {
      localThis.mockFn.mockRejectedValue({});

      await safeAsync(localThis.mockFn, { showNotification: true });

      expect(showError).toHaveBeenCalledWith('An unexpected error occurred. Please try again.');
    });

    it('reports error to Sentry even when retry is enabled and fails', async () => {
      vi.useRealTimers();
      const testError = new Error('Network error');
      localThis.mockFn.mockRejectedValue(testError);

      const { error } = await safeAsync(localThis.mockFn, {
        retry: true,
        retryConfig: { maxRetries: 1, baseDelay: 1, maxDelay: 1 }
      });

      expect(error).toBe(testError);
      expect(Sentry.captureException).toHaveBeenCalledWith(testError);
    });

    it('does not call Sentry.captureException on success', async () => {
      localThis.mockFn.mockResolvedValue('result');
      vi.clearAllMocks();

      await safeAsync(localThis.mockFn);

      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('passes custom retryConfig to withRetry', async () => {
      vi.useRealTimers();
      localThis.mockFn.mockRejectedValue(new Error('Network error'));

      await safeAsync(localThis.mockFn, {
        retry: true,
        retryConfig: { maxRetries: 0 }
      });

      // With maxRetries: 0, it should only try once
      expect(localThis.mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('createRetryable', () => {
    it('creates a retryable operation', async () => {
      localThis.mockFn.mockResolvedValue('result');
      const retryable = createRetryable(localThis.mockFn);

      const { data, error } = await retryable.execute();

      expect(data).toBe('result');
      expect(error).toBeNull();
    });

    it('tracks last error', async () => {
      const testError = new Error('Test error');
      localThis.mockFn.mockRejectedValue(testError);
      const retryable = createRetryable(localThis.mockFn);

      await retryable.execute();

      expect(retryable.getLastError()).toBe(testError);
    });

    it('clears last error on success', async () => {
      localThis.mockFn
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce('success');

      const retryable = createRetryable(localThis.mockFn);

      await retryable.execute();
      expect(retryable.getLastError()).toBeInstanceOf(Error);

      await retryable.execute();
      expect(retryable.getLastError()).toBeNull();
    });

    it('prevents concurrent execution', async () => {
      let resolveFirst;
      localThis.mockFn.mockImplementation(() => new Promise(resolve => {
        resolveFirst = resolve;
      }));

      const retryable = createRetryable(localThis.mockFn);

      const firstCall = retryable.execute();
      expect(retryable.isExecuting()).toBe(true);

      const secondCall = await retryable.execute();
      expect(secondCall.error.message).toBe('Operation already in progress');

      resolveFirst('result');
      const firstResult = await firstCall;
      expect(firstResult.data).toBe('result');
      expect(retryable.isExecuting()).toBe(false);
    });

    it('reports execution state', async () => {
      localThis.mockFn.mockResolvedValue('result');
      const retryable = createRetryable(localThis.mockFn);

      expect(retryable.isExecuting()).toBe(false);

      const promise = retryable.execute();
      // Note: isExecuting might already be false if the promise resolves synchronously
      await promise;

      expect(retryable.isExecuting()).toBe(false);
    });
  });

  describe('formatErrorMessage', () => {
    it('returns error message when present', () => {
      expect(formatErrorMessage(new Error('User friendly message'))).toBe('User friendly message');
    });

    it('returns fallback for null error', () => {
      expect(formatErrorMessage(null)).toBe('An unexpected error occurred.');
    });

    it('returns fallback for undefined error', () => {
      expect(formatErrorMessage(undefined)).toBe('An unexpected error occurred.');
    });

    it('uses custom fallback message', () => {
      expect(formatErrorMessage(null, 'Custom fallback')).toBe('Custom fallback');
    });

    it('returns fallback for error with technical message', () => {
      expect(formatErrorMessage(new Error('TypeError: Cannot read property'))).toBe('An unexpected error occurred.');
    });
  });
});
