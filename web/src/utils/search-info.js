import { escapeHtml } from './sanitize.js';

/**
 * Updates the search info display with current filter information
 * @param {HTMLElement} infoElement - The element to update with search info
 * @param {Object} filters - Current search filters
 * @param {string} [filters.q] - Search query text
 * @param {number} [filters.category_id] - Category ID filter
 * @param {string} [filters.attribution] - Attribution filter
 * @returns {Promise<void>}
 */
export async function updateSearchInfo(infoElement, filters) {
  if (!infoElement) return;

  const hasFilters = filters.q || filters.category_id || filters.attribution;

  if (!hasFilters) {
    infoElement.innerHTML = '';
    return;
  }

  const filterParts = [];

  if (filters.q) {
    filterParts.push(`<strong>${escapeHtml(filters.q)}</strong>`);
  }

  if (filters.category_id) {
    // Fetch category name
    try {
      const response = await fetch(`/api/categories/${filters.category_id}`);
      if (response.ok) {
        const category = await response.json();
        filterParts.push(`in category <strong>${escapeHtml(category.title)}</strong>`);
      }
    } catch {
      filterParts.push(`in category <strong>#${filters.category_id}</strong>`);
    }
  }

  if (filters.attribution) {
    filterParts.push(`by <strong>${escapeHtml(filters.attribution)}</strong>`);
  }

  infoElement.innerHTML = `<p class="search-info">Search results for: ${filterParts.join(' ')}</p>`;
}

/**
 * Checks if any search filters are currently active
 * @param {Object} filters - Current search filters
 * @param {string} [filters.q] - Search query text
 * @param {number} [filters.category_id] - Category ID filter
 * @param {string} [filters.attribution] - Attribution filter
 * @returns {boolean} True if any filters are active
 */
export function hasActiveFilters(filters) {
  return !!(filters.q || filters.category_id || filters.attribution);
}
