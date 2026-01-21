// Centralized error handling utilities with retry logic
// Provides consistent error handling, notifications, and automatic retry for transient failures

import { showError } from '../components/notification.js';

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
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
export function isTransientError(error) {
  const message = error?.message?.toLowerCase() || '';

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
export function calculateBackoff(attempt, baseDelay = 1000, maxDelay = 10000) {
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
function sleep(ms) {
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
export async function withRetry(fn, options = {}) {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options };
  const { maxRetries, baseDelay, maxDelay, shouldRetry, onRetry } = config;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const isLastAttempt = attempt >= maxRetries;
      const isRetryable = shouldRetry(error);

      if (isLastAttempt || !isRetryable) {
        throw error;
      }

      // Calculate delay and wait
      const delay = calculateBackoff(attempt, baseDelay, maxDelay);

      // Call onRetry callback if provided
      if (typeof onRetry === 'function') {
        onRetry(attempt + 1, error, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
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
export async function safeAsync(fn, options = {}) {
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
    // Call custom error handler if provided
    if (typeof onError === 'function') {
      onError(error);
    }

    // Show notification if requested
    if (showNotification) {
      const message = errorMessage || error.message || 'An unexpected error occurred. Please try again.';
      showError(message);
    }

    return { data: null, error };
  }
}

/**
 * Create a retry function bound to a specific async operation
 * Useful for retry buttons that should re-execute the original operation
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Options for safeAsync
 * @returns {Object} Object with execute() and getLastError() methods
 */
export function createRetryable(fn, options = {}) {
  let lastError = null;
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
export function formatErrorMessage(error, fallbackMessage = 'An unexpected error occurred.') {
  if (!error) {
    return fallbackMessage;
  }

  // If error already has a user-friendly message (from request.js), use it
  if (error.message && !error.message.includes('Error:') && !error.message.includes('TypeError')) {
    return error.message;
  }

  return fallbackMessage;
}
