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
      attributionSelect.innerHTML = '<option value="">All Submitters</option>' +
        attributions.map(att => `<option value="${att.name}" ${att.name === selectedAttribution ? 'selected' : ''}>${att.name}</option>`).join('');
    }
  }

  // Load categories and attributions
  async function loadFilters() {
    if (filtersLoaded) return;
    filtersLoaded = true;

    try {
      // Fetch categories (always fetch fresh, but use cache as fallback)
      try {
        const catData = await fetchAPI('/api/categories');
        categories = catData.data || [];
        setCachedCategories(categories);
      } catch {
        // Fallback to cache if fetch fails
        const cached = getCachedCategories();
        if (cached) {
          categories = cached;
        }
      }

      // Update category dropdown
      if (categories.length > 0) {
        categorySelect.innerHTML = '<option value="">All Categories</option>' +
          categories.map(cat => `<option value="${cat.id}" ${String(cat.id) === String(selectedCategory) ? 'selected' : ''}>${cat.title}</option>`).join('');
      }

      // Fetch attributions
      try {
        const attData = await fetchAPI('/api/attributions');
        attributions = attData.data || [];
        setCachedAttributions(attributions);
      } catch {
        // Fallback to cache if fetch fails
        const cached = getCachedAttributions();
        if (cached) {
          attributions = cached;
        }
      }

      // Update attribution dropdown
      if (attributions.length > 0) {
        attributionSelect.innerHTML = '<option value="">All Submitters</option>' +
          attributions.map(att => `<option value="${att.name}" ${att.name === selectedAttribution ? 'selected' : ''}>${att.name}</option>`).join('');
      }

    } catch {
      categorySelect.innerHTML = '<option value="">Error loading categories</option>';
      attributionSelect.innerHTML = '<option value="">Error loading attributions</option>';
    }
  }

  // Lazy load on user interaction (fallback if idle callback doesn't fire)
  function setupLazyLoad() {
    let categoryLoadAttempted = false;
    let attributionLoadAttempted = false;

    categorySelect?.addEventListener('focus', () => {
      if (!categoryLoadAttempted && categories.length === 0) {
        categoryLoadAttempted = true;
        loadFilters();
      }
    }, { once: true });

    attributionSelect?.addEventListener('focus', () => {
      if (!attributionLoadAttempted && attributions.length === 0) {
        attributionLoadAttempted = true;
        loadFilters();
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
    if (filters.category_id) cleanFilters.category_id = filters.category_id;
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
  
  // Defer loading filters until browser is idle (non-blocking)
  // This removes /api/categories from the critical rendering path
  deferUntilIdle(() => {
    loadFilters();
  }, 2000);

  return el;
}
