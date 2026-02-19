import { escapeHtml, stripMarkdownFootnotes } from './sanitize.ts';
import { fetchAPI } from './api.ts';
import type { SearchFilters } from '../types/app.d.ts';

/**
 * Updates the search info display with current filter information
 * @param {HTMLElement} infoElement - The element to update with search info
 * @param {Object} filters - Current search filters
 * @param {string} [filters.q] - Search query text
 * @param {number} [filters.category_id] - Category ID filter
 * @param {string} [filters.attribution] - Attribution filter
 * @returns {Promise<void>}
 */
export async function updateSearchInfo(infoElement: HTMLElement | null, filters: SearchFilters): Promise<void> {
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
      const category = await fetchAPI(`/api/v1/categories/${filters.category_id}`) as { title?: string };
      if (category && category.title) {
        filterParts.push(`in category <strong>${escapeHtml(stripMarkdownFootnotes(category.title))}</strong>`);
      } else {
        filterParts.push(`in category <strong>#${filters.category_id}</strong>`);
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
export function hasActiveFilters(filters: SearchFilters): boolean {
  return !!(filters.q || filters.category_id || filters.attribution);
}
