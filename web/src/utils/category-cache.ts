// Category caching utility to reduce API calls and improve performance
// Uses localStorage with TTL and versioning to cache categories

import type { Category } from '../types/app.d.ts';

const CACHE_KEY = 'murphys_categories';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const ATTRIBUTION_CACHE_KEY = 'murphys_attributions';
const CACHE_VERSION = 1; // Bump when schema changes
const MIN_ACCEPTED_VERSION = 0; // For backward compatibility with old caches (bump when breaking changes needed)

/**
 * Get cached categories from localStorage
 * @returns {Array|null} Cached categories or null if expired/missing/outdated
 */
export function getCachedCategories(): Category[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { version, data, timestamp } = JSON.parse(cached) as { version?: number; data: Category[]; timestamp: number };
    const cacheVersion = version ?? 0; // Backward compatibility for old caches
    const now = Date.now();

    // Invalidate if version is below minimum accepted version
    if (cacheVersion < MIN_ACCEPTED_VERSION) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

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
export function setCachedCategories(categories: Category[]): void {
  try {
    const cacheData = {
      version: CACHE_VERSION,
      data: categories,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch {
    // Silently fail if localStorage is unavailable (e.g., private browsing)
  }
}

/** Attribution cache entry: string (name), legacy object with name, or null (filtered out) */
export type CachedAttribution = string | { name?: string } | null;

/**
 * Get cached attributions from localStorage
 * @returns {Array|null} Cached attributions or null if expired/missing/outdated
 */
export function getCachedAttributions(): CachedAttribution[] | null {
  try {
    const cached = localStorage.getItem(ATTRIBUTION_CACHE_KEY);
    if (!cached) return null;

    const { version, data, timestamp } = JSON.parse(cached) as { version?: number; data: CachedAttribution[]; timestamp: number };
    const cacheVersion = version ?? 0; // Backward compatibility for old caches
    const now = Date.now();

    // Invalidate if version is below minimum accepted version
    if (cacheVersion < MIN_ACCEPTED_VERSION) {
      localStorage.removeItem(ATTRIBUTION_CACHE_KEY);
      return null;
    }

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
 * @param {Array} attributions - Attributions array (strings or objects with name)
 */
export function setCachedAttributions(attributions: CachedAttribution[]): void {
  try {
    const cacheData = {
      version: CACHE_VERSION,
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
export function deferUntilIdle(callback: () => void, timeout = 2000): void {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(callback, { timeout });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(callback, 0);
  }
}
