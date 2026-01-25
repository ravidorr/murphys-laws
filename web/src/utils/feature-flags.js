/**
 * Feature Flags Utility
 *
 * Provides centralized feature flag management with support for:
 * - Build-time control via environment variables (Vite)
 * - Runtime admin override via localStorage
 *
 * Priority: localStorage override > environment variable > default
 *
 * @example
 * // Check if a feature is enabled
 * if (isFavoritesEnabled()) {
 *   // render favorites UI
 * }
 *
 * @example
 * // Admin: Enable/disable via browser console
 * localStorage.setItem('murphys_ff_favorites', 'false');
 * location.reload();
 *
 * @module feature-flags
 */

/**
 * Feature flag definitions
 * @type {Object.<string, {envKey: string, default: boolean, storageKey: string}>}
 */
const FEATURE_FLAGS = {
  FAVORITES_ENABLED: {
    envKey: 'VITE_FEATURE_FAVORITES',
    default: true,
    storageKey: 'murphys_ff_favorites',
  },
};

/**
 * Check if a feature is enabled
 * @param {string} featureName - Feature flag name (e.g., 'FAVORITES_ENABLED')
 * @returns {boolean} Whether the feature is enabled
 */
export function isFeatureEnabled(featureName) {
  const flag = FEATURE_FLAGS[featureName];
  if (!flag) {
    return false;
  }

  // 1. Check localStorage override (admin control)
  try {
    const override = localStorage.getItem(flag.storageKey);
    if (override !== null) {
      return override === 'true';
    }
  } catch {
    // localStorage unavailable (private mode, etc.)
  }

  // 2. Check environment variable (build-time)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const envValue = import.meta.env[flag.envKey];
    if (envValue !== undefined) {
      return envValue === 'true';
    }
  }

  // 3. Return default
  return flag.default;
}

/**
 * Admin: Set feature flag override
 * @param {string} featureName - Feature flag name
 * @param {boolean|null} enabled - true/false to override, null to clear override
 */
export function setFeatureOverride(featureName, enabled) {
  const flag = FEATURE_FLAGS[featureName];
  if (!flag) {
    return;
  }

  try {
    if (enabled === null) {
      localStorage.removeItem(flag.storageKey);
    } else {
      localStorage.setItem(flag.storageKey, String(enabled));
    }
  } catch {
    // localStorage unavailable
  }
}

/**
 * Get the current state of a feature flag (for debugging)
 * @param {string} featureName - Feature flag name
 * @returns {{enabled: boolean, source: string}} Current state and where it came from
 */
export function getFeatureState(featureName) {
  const flag = FEATURE_FLAGS[featureName];
  if (!flag) {
    return { enabled: false, source: 'unknown' };
  }

  // Check localStorage override
  try {
    const override = localStorage.getItem(flag.storageKey);
    if (override !== null) {
      return { enabled: override === 'true', source: 'localStorage' };
    }
  } catch {
    // localStorage unavailable
  }

  // Check environment variable
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const envValue = import.meta.env[flag.envKey];
    if (envValue !== undefined) {
      return { enabled: envValue === 'true', source: 'environment' };
    }
  }

  return { enabled: flag.default, source: 'default' };
}

// Convenience exports for specific features
export const isFavoritesEnabled = () => isFeatureEnabled('FAVORITES_ENABLED');
