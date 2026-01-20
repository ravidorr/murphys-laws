// Advanced search component for filtering laws

import templateHtml from '@components/templates/advanced-search.html?raw';
import { fetchAPI } from '../utils/api.js';
import { hydrateIcons } from '@utils/icons.js';
import {
  getCachedCategories,
  setCachedCategories,
  getCachedAttributions,
  setCachedAttributions,
  deferUntilIdle
} from '../utils/category-cache.js';

export function AdvancedSearch({ onSearch, initialFilters = {} }) {
  const el = document.createElement('section');
  el.className = 'section section-card mb-12';

  // State
  let categories = [];
  let attributions = [];
  let selectedCategory = initialFilters.category_id || '';
  let selectedAttribution = initialFilters.attribution || '';
  let searchQuery = initialFilters.q || '';
  let filtersLoaded = false;

  // Initial HTML (with loading placeholders)
  el.innerHTML = templateHtml;
  
  // Hydrate icons
  hydrateIcons(el);

  const categorySelect = el.querySelector('#search-category');
  const attributionSelect = el.querySelector('#search-attribution');
  const keywordInput = el.querySelector('#search-keyword');
  const searchBtn = el.querySelector('#search-btn');
  const clearBtn = el.querySelector('#clear-btn');

  if (keywordInput) keywordInput.value = searchQuery;

  // Populate dropdowns with cached or provided data
  function populateDropdowns() {
    // Try to use cached categories first
    const cachedCategories = getCachedCategories();
    if (cachedCategories && cachedCategories.length > 0) {
      categories = cachedCategories;
      categorySelect.innerHTML = '<option value="">All Categories</option>' +
        categories.map(cat => `<option value="${cat.id}" ${String(cat.id) === String(selectedCategory) ? 'selected' : ''}>${cat.title}</option>`).join('');
    }

    // Try to use cached attributions first
    const cachedAttributions = getCachedAttributions();
    if (cachedAttributions && cachedAttributions.length > 0) {
      attributions = cachedAttributions;
      // Filter out null/undefined/empty and handle both string and object formats
      const validAttributions = attributions
        .map(att => {
          const name = typeof att === 'string' ? att : att?.name;
          return name;
        })
        .filter(name => {
          if (!name) return false;
          if (typeof name !== 'string') return false;
          const trimmed = name.trim();
          if (!trimmed) return false;
          if (trimmed.toLowerCase() === 'undefined') return false;
          if (trimmed.toLowerCase() === 'null') return false;
          return true;
        });
      
      attributionSelect.innerHTML = '<option value="">All Submitters</option>' +
        validAttributions.map(name => {
          return `<option value="${name}" ${name === selectedAttribution ? 'selected' : ''}>${name}</option>`;
        }).join('');
    }
  }

  // Load categories and attributions
  async function loadFilters(forceReload = false) {
    if (filtersLoaded && !forceReload) return;
    filtersLoaded = true;

    // Fetch categories (always fetch fresh, but use cache as fallback)
    try {
      const catData = await fetchAPI('/api/v1/categories');
      categories = catData.data || [];
      setCachedCategories(categories);
    } catch {
      // Fallback to cache if fetch fails
      const cached = getCachedCategories();
      if (cached && cached.length > 0) {
        categories = cached;
      } else {
        // Show error if no cache available
        categorySelect.innerHTML = '<option value="">Error loading categories</option>';
      }
    }

    // Update category dropdown
    if (categories.length > 0) {
      categorySelect.innerHTML = '<option value="">All Categories</option>' +
        categories.map(cat => `<option value="${cat.id}" ${String(cat.id) === String(selectedCategory) ? 'selected' : ''}>${cat.title}</option>`).join('');
    }

    // Fetch attributions
    try {
      const attData = await fetchAPI('/api/v1/attributions');
      attributions = attData.data || [];
      setCachedAttributions(attributions);
    } catch {
      // Fallback to cache if fetch fails
      const cached = getCachedAttributions();
      if (cached && cached.length > 0) {
        attributions = cached;
      } else {
        // Show error if no cache available
        attributionSelect.innerHTML = '<option value="">Error loading attributions</option>';
      }
    }

    // Update attribution dropdown
    if (attributions.length > 0) {
      // Filter out null/undefined/empty and handle both string and object formats
      const validAttributions = attributions
        .map(att => {
          // Handle both string format (from API) and object format (legacy)
          const name = typeof att === 'string' ? att : att?.name;
          return name;
        })
        .filter(name => {
          // Filter out null, undefined, empty strings, "undefined" string, and whitespace-only
          if (!name) return false;
          if (typeof name !== 'string') return false;
          const trimmed = name.trim();
          if (!trimmed) return false;
          if (trimmed.toLowerCase() === 'undefined') return false;
          if (trimmed.toLowerCase() === 'null') return false;
          if (trimmed.toLowerCase() === 'anonymous') return false; // Optionally hide anonymous
          return true;
        });
      
      attributionSelect.innerHTML = '<option value="">All Submitters</option>' +
        validAttributions.map(name => {
          return `<option value="${name}" ${name === selectedAttribution ? 'selected' : ''}>${name}</option>`;
        }).join('');
    }
  }

  // Lazy load on user interaction (fallback if idle callback doesn't fire)
  function setupLazyLoad() {
    let categoryLoadAttempted = false;
    let attributionLoadAttempted = false;

    categorySelect?.addEventListener('focus', () => {
      if (!categoryLoadAttempted && categories.length === 0) {
        categoryLoadAttempted = true;
        // Force reload if categories are empty (whether filters were loaded or not)
        loadFilters(true);
      }
    }, { once: true });

    attributionSelect?.addEventListener('focus', () => {
      if (!attributionLoadAttempted && attributions.length === 0) {
        attributionLoadAttempted = true;
        // Force reload if attributions are empty (whether filters were loaded or not)
        loadFilters(true);
      }
    }, { once: true });
  }

  // Handle search
  searchBtn.addEventListener('click', () => {
    const filters = {
      q: keywordInput.value.trim(),
      category_id: categorySelect.value ? Number(categorySelect.value) : null,
      attribution: attributionSelect.value
    };

    // Only include non-empty filters
    const cleanFilters = {};
    if (filters.q) cleanFilters.q = filters.q;
    // Keep category_id even if it's 0 or 'null' as it signifies "All Categories" or a specific category.
    // The previous logic was removing category_id if it was null, which would prevent
    // clearing a category filter explicitly.
    if (filters.category_id !== null) cleanFilters.category_id = filters.category_id;
    if (filters.attribution) cleanFilters.attribution = filters.attribution;

    onSearch(cleanFilters);
  });

  // Handle clear
  clearBtn.addEventListener('click', () => {
    keywordInput.value = '';
    categorySelect.value = '';
    attributionSelect.value = '';
    onSearch({});
  });

  // Allow Enter key to trigger search
  keywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      searchBtn.click();
    }
  });

  // Initialize: populate from cache immediately, then load fresh data when idle
  populateDropdowns();
  setupLazyLoad();
  
  // If no cache exists, load immediately; otherwise defer until idle
  const cachedCategories = getCachedCategories();
  if (cachedCategories && cachedCategories.length > 0) {
    // We have cache, so we can defer loading fresh data
    deferUntilIdle(() => {
      loadFilters();
    }, 2000);
  } else {
    // No cache, load immediately so dropdown gets populated
    loadFilters();
  }

  return el;
}
