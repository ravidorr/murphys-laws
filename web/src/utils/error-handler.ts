// Centralized error handling utilities with retry logic
// Provides consistent error handling, notifications, and automatic retry for transient failures

import * as Sentry from '@sentry/browser';
import { showError } from '../components/notification.ts';

interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

interface SafeAsyncOptions {
  showNotification?: boolean;
  errorMessage?: string;
  retry?: boolean;
  retryConfig?: RetryConfig;
  onError?: (error: Error) => void;
}

interface SafeAsyncResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: Required<Pick<RetryConfig, 'maxRetries' | 'baseDelay' | 'maxDelay'>> & { shouldRetry: (error: Error) => boolean } = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  shouldRetry: (error) => isTransientError(error)
};

/**
 * Determines if an error is transient (worth retrying)
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error is transient
 */
export function isTransientError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  // Network errors are transient
  if (message.includes('network') || message.includes('connection')) {
    return true;
  }

  // Rate limiting is transient
  if (message.includes('rate limit') || message.includes('429')) {
    return true;
  }

  // Server errors (5xx) are potentially transient
  if (message.includes('server') || message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
    return true;
  }

  // Timeout errors are transient
  if (message.includes('timeout') || message.includes('timed out')) {
    return true;
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 * @param {number} attempt - Current attempt number (0-based)
 * @param {number} baseDelay - Base delay in ms
 * @param {number} maxDelay - Maximum delay in ms
 * @returns {number} Delay in ms
 */
export function calculateBackoff(attempt: number, baseDelay = 1000, maxDelay = 10000) {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Add jitter (random 0-25% of delay) to prevent thundering herd
  const jitter = exponentialDelay * Math.random() * 0.25;

  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute an async function with automatic retry for transient failures
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.baseDelay - Base delay between retries in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay between retries in ms (default: 10000)
 * @param {Function} options.shouldRetry - Function to determine if error is retryable
 * @param {Function} options.onRetry - Callback called before each retry with (attempt, error, delay)
 * @returns {Promise<any>} Result of the function
 * @throws {Error} The last error if all retries fail
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryConfig = {}): Promise<T> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options };
  const { maxRetries, baseDelay, maxDelay, shouldRetry, onRetry } = config;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      // Check if we should retry
      const isLastAttempt = attempt >= maxRetries;
      const isRetryable = shouldRetry(err);

      if (isLastAttempt || !isRetryable) {
        throw err;
      }

      // Calculate delay and wait
      const delay = calculateBackoff(attempt, baseDelay, maxDelay);

      // Call onRetry callback if provided
      if (typeof onRetry === 'function') {
        onRetry(attempt + 1, err, delay);
      }

      await sleep(delay);
    }
  }

  // Unreachable — loop always returns or throws
  throw new Error('withRetry: unexpected loop exit');
}

/**
 * Execute an async function with error handling and optional notification
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Options
 * @param {boolean} options.showNotification - Show error notification on failure (default: false)
 * @param {string} options.errorMessage - Custom error message for notification
 * @param {boolean} options.retry - Enable automatic retry for transient errors (default: false)
 * @param {Object} options.retryConfig - Custom retry configuration
 * @param {Function} options.onError - Custom error handler
 * @returns {Promise<{data: any, error: Error|null}>} Result object with data or error
 */
export async function safeAsync<T>(fn: () => Promise<T>, options: SafeAsyncOptions = {}): Promise<SafeAsyncResult<T>> {
  const {
    showNotification = false,
    errorMessage,
    retry = false,
    retryConfig = {},
    onError
  } = options;

  try {
    const executor = retry ? () => withRetry(fn, retryConfig) : fn;
    const data = await executor();
    return { data, error: null };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    // Report error to Sentry for production monitoring
    Sentry.captureException(err);

    // Call custom error handler if provided
    if (typeof onError === 'function') {
      onError(err);
    }

    // Show notification if requested
    if (showNotification) {
      // Filter out unhelpful error messages like "[object Object]"
      const rawMessage = err.message;
      const isUsefulMessage = rawMessage && rawMessage !== '[object Object]';
      const message = errorMessage || (isUsefulMessage ? rawMessage : '') || 'An unexpected error occurred. Please try again.';
      showError(message);
    }

    return { data: null, error: err };
  }
}

/**
 * Create a retry function bound to a specific async operation
 * Useful for retry buttons that should re-execute the original operation
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Options for safeAsync
 * @returns {Object} Object with execute() and getLastError() methods
 */
export function createRetryable(fn: () => Promise<unknown>, options: SafeAsyncOptions = {}) {
  let lastError: Error | null = null;
  let isExecuting = false;

  return {
    /**
     * Execute the operation
     * @returns {Promise<{data: any, error: Error|null}>}
     */
    async execute() {
      if (isExecuting) {
        return { data: null, error: new Error('Operation already in progress') };
      }

      isExecuting = true;
      try {
        const result = await safeAsync(fn, options);
        lastError = result.error;
        return result;
      } finally {
        isExecuting = false;
      }
    },

    /**
     * Get the last error from the most recent execution
     * @returns {Error|null}
     */
    getLastError() {
      return lastError;
    },

    /**
     * Check if operation is currently executing
     * @returns {boolean}
     */
    isExecuting() {
      return isExecuting;
    }
  };
}

/**
 * Format an error for display to users
 * @param {Error} error - The error to format
 * @param {string} fallbackMessage - Fallback message if error has no message
 * @returns {string} User-friendly error message
 */
export function formatErrorMessage(error: unknown, fallbackMessage = 'An unexpected error occurred.') {
  if (!error) {
    return fallbackMessage;
  }

  // If error already has a user-friendly message (from request.js), use it
  const message = error instanceof Error ? error.message : typeof (error as Record<string, unknown>).message === 'string' ? (error as Record<string, unknown>).message as string : null;
  if (message && !message.includes('Error:') && !message.includes('TypeError')) {
    return message;
  }

  return fallbackMessage;
}
