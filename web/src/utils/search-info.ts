import { stripMarkdownFootnotes } from './sanitize.ts';
import { fetchAPI } from './api.ts';
import type { SearchFilters } from '../types/app.d.ts';

interface SearchFilterPart {
  prefix: string;
  value: string;
}

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
    infoElement.replaceChildren();
    return;
  }

  const filterParts: SearchFilterPart[] = [];

  if (filters.q) {
    filterParts.push({ prefix: '', value: filters.q });
  }

  if (filters.category_id) {
    const numericCategoryId = typeof filters.category_id === 'number' || /^\d+$/.test(String(filters.category_id));
    if (numericCategoryId) {
      try {
        const category = await fetchAPI(`/api/v1/categories/${filters.category_id}`) as { title?: string };
        if (category && category.title) {
          filterParts.push({ prefix: 'in category ', value: stripMarkdownFootnotes(category.title) });
        } else {
          filterParts.push({ prefix: 'in category ', value: `#${filters.category_id}` });
        }
      } catch {
        filterParts.push({ prefix: 'in category ', value: `#${filters.category_id}` });
      }
    } else {
      const categoryLabel = String(filters.category_id).replace(/^murphys-/, '').replace(/-laws$/, '').replace(/-/g, ' ');
      filterParts.push({ prefix: 'in category ', value: categoryLabel });
    }
  }

  if (filters.attribution) {
    filterParts.push({ prefix: 'by ', value: filters.attribution });
  }

  const searchInfo = document.createElement('p');
  searchInfo.className = 'search-info';
  searchInfo.append('Search results for: ');

  filterParts.forEach((filterPart, index) => {
    if (index > 0) {
      searchInfo.append(' ');
    }
    searchInfo.append(filterPart.prefix);
    const filterValue = document.createElement('strong');
    filterValue.textContent = filterPart.value;
    searchInfo.append(filterValue);
  });

  infoElement.replaceChildren(searchInfo);
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
