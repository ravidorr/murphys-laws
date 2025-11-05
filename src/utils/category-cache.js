// Category caching utility to reduce API calls and improve performance
// Uses localStorage with TTL to cache categories

const CACHE_KEY = 'murphys_categories';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const ATTRIBUTION_CACHE_KEY = 'murphys_attributions';

/**
 * Get cached categories from localStorage
 * @returns {Array|null} Cached categories or null if expired/missing
 */
export function getCachedCategories() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is expired
    if (now - timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Cache categories in localStorage
 * @param {Array} categories - Categories array to cache
 */
export function setCachedCategories(categories) {
  try {
    const cacheData = {
      data: categories,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch {
    // Silently fail if localStorage is unavailable (e.g., private browsing)
  }
}

/**
 * Get cached attributions from localStorage
 * @returns {Array|null} Cached attributions or null if expired/missing
 */
export function getCachedAttributions() {
  try {
    const cached = localStorage.getItem(ATTRIBUTION_CACHE_KEY);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is expired
    if (now - timestamp > CACHE_TTL) {
      localStorage.removeItem(ATTRIBUTION_CACHE_KEY);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Cache attributions in localStorage
 * @param {Array} attributions - Attributions array to cache
 */
export function setCachedAttributions(attributions) {
  try {
    const cacheData = {
      data: attributions,
      timestamp: Date.now()
    };
    localStorage.setItem(ATTRIBUTION_CACHE_KEY, JSON.stringify(cacheData));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/**
 * Schedule a function to run when the browser is idle
 * Falls back to setTimeout if requestIdleCallback is not available
 * @param {Function} callback - Function to execute
 * @param {number} timeout - Maximum wait time in ms (default: 2000ms)
 */
export function deferUntilIdle(callback, timeout = 2000) {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(callback, { timeout });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(callback, 0);
  }
}

