/**
 * Favorites Service
 *
 * localStorage-based favorites management for saving laws.
 * All operations check the feature flag before executing.
 *
 * Storage format:
 * {
 *   "lawId": { id, text, title, savedAt }
 * }
 *
 * @example
 * import { toggleFavorite, isFavorite, getFavorites } from './favorites.js';
 *
 * // Toggle favorite state
 * const isNowFavorite = toggleFavorite(law);
 *
 * // Check if favorited
 * if (isFavorite(lawId)) { ... }
 *
 * // Get all favorites
 * const favorites = getFavorites();
 *
 * @module favorites
 */

import { isFavoritesEnabled } from './feature-flags.js';

const FAVORITES_KEY = 'murphys_favorites';

/**
 * Get all favorites from localStorage
 * @returns {Object} Map of lawId -> favorite data
 */
function getFavoritesFromStorage() {
  if (!isFavoritesEnabled()) {
    return {};
  }

  try {
    const data = localStorage.getItem(FAVORITES_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/**
 * Save favorites to localStorage
 * @param {Object} favorites - Map of lawId -> favorite data
 */
function saveFavoritesToStorage(favorites) {
  if (!isFavoritesEnabled()) {
    return;
  }

  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch {
    // Silently handle localStorage errors (quota exceeded, private mode, etc.)
  }
}

/**
 * Check if a law is favorited
 * @param {number|string} lawId - Law ID
 * @returns {boolean} Whether the law is favorited
 */
export function isFavorite(lawId) {
  if (!isFavoritesEnabled()) {
    return false;
  }

  const favorites = getFavoritesFromStorage();
  return Object.prototype.hasOwnProperty.call(favorites, String(lawId));
}

/**
 * Get all favorited laws as an array
 * @returns {Array<Object>} Array of favorite law objects with savedAt timestamp
 */
export function getFavorites() {
  if (!isFavoritesEnabled()) {
    return [];
  }

  const favorites = getFavoritesFromStorage();
  return Object.values(favorites).sort((a, b) => {
    // Sort by savedAt descending (newest first)
    return (b.savedAt || 0) - (a.savedAt || 0);
  });
}

/**
 * Get the count of favorited laws
 * @returns {number} Number of favorited laws
 */
export function getFavoritesCount() {
  if (!isFavoritesEnabled()) {
    return 0;
  }

  const favorites = getFavoritesFromStorage();
  return Object.keys(favorites).length;
}

/**
 * Add a law to favorites
 * @param {Object} law - Law object with at minimum { id }
 * @param {number|string} law.id - Law ID (required)
 * @param {string} [law.text] - Law text
 * @param {string} [law.title] - Law title
 * @param {string} [law.attribution] - Law attribution
 * @param {number} [law.category_id] - Category ID
 * @param {string} [law.category_slug] - Category slug
 */
export function addFavorite(law) {
  if (!isFavoritesEnabled() || !law?.id) {
    return;
  }

  const favorites = getFavoritesFromStorage();
  const lawId = String(law.id);

  favorites[lawId] = {
    id: law.id,
    text: law.text || '',
    title: law.title || '',
    attribution: law.attribution || '',
    category_id: law.category_id,
    category_slug: law.category_slug,
    savedAt: Date.now(),
  };

  saveFavoritesToStorage(favorites);
}

/**
 * Remove a law from favorites
 * @param {number|string} lawId - Law ID
 */
export function removeFavorite(lawId) {
  if (!isFavoritesEnabled()) {
    return;
  }

  const favorites = getFavoritesFromStorage();
  delete favorites[String(lawId)];
  saveFavoritesToStorage(favorites);
}

/**
 * Toggle favorite state for a law
 * @param {Object} law - Law object with at minimum { id }
 * @returns {boolean} New favorite state (true if now favorited, false if removed)
 */
export function toggleFavorite(law) {
  if (!isFavoritesEnabled() || !law?.id) {
    return false;
  }

  const lawId = String(law.id);

  if (isFavorite(lawId)) {
    removeFavorite(lawId);
    return false;
  } else {
    addFavorite(law);
    return true;
  }
}

/**
 * Clear all favorites
 */
export function clearAllFavorites() {
  if (!isFavoritesEnabled()) {
    return;
  }

  try {
    localStorage.removeItem(FAVORITES_KEY);
  } catch {
    // Silently handle localStorage errors
  }
}

/**
 * Export favorites as JSON (for backup)
 * @returns {string} JSON string of all favorites
 */
export function exportFavorites() {
  if (!isFavoritesEnabled()) {
    return '[]';
  }

  return JSON.stringify(getFavorites(), null, 2);
}

/**
 * Import favorites from JSON (restore backup)
 * @param {string} json - JSON string of favorites array
 * @returns {number} Number of favorites imported
 */
export function importFavorites(json) {
  if (!isFavoritesEnabled()) {
    return 0;
  }

  try {
    const imported = JSON.parse(json);
    if (!Array.isArray(imported)) {
      return 0;
    }

    const favorites = getFavoritesFromStorage();
    let count = 0;

    for (const law of imported) {
      if (law?.id) {
        const lawId = String(law.id);
        favorites[lawId] = {
          id: law.id,
          text: law.text || '',
          title: law.title || '',
          attribution: law.attribution || '',
          category_id: law.category_id,
          category_slug: law.category_slug,
          savedAt: law.savedAt || Date.now(),
        };
        count++;
      }
    }

    saveFavoritesToStorage(favorites);
    return count;
  } catch {
    return 0;
  }
}
