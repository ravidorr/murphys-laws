// Advanced search component for filtering laws

import templateHtml from '@components/templates/advanced-search.html?raw';
import { fetchAPI } from '../utils/api.js';
import { hydrateIcons } from '../utils/icons.js';

export function AdvancedSearch({ onSearch, initialFilters = {} }) {
  const el = document.createElement('section');
  el.className = 'section section-card mb-12';

  // State
  let categories = [];
  let attributions = [];
  let selectedCategory = initialFilters.category_id || '';
  let selectedAttribution = initialFilters.attribution || '';
  let searchQuery = initialFilters.q || '';

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

  // Load categories and attributions
  async function loadFilters() {
    try {
      // Fetch categories
      const catData = await fetchAPI('/api/categories');
      categories = catData.data || [];

      // Update category dropdown
      categorySelect.innerHTML = '<option value="">All Categories</option>' +
        categories.map(cat => `<option value="${cat.id}" ${String(cat.id) === String(selectedCategory) ? 'selected' : ''}>${cat.title}</option>`).join('');

      // Fetch attributions
      const attData = await fetchAPI('/api/attributions');
      attributions = attData.data || [];

      // Update attribution dropdown
      attributionSelect.innerHTML = '<option value="">All Submitters</option>' +
        attributions.map(att => `<option value="${att.name}" ${att.name === selectedAttribution ? 'selected' : ''}>${att.name}</option>`).join('');

    } catch {
      categorySelect.innerHTML = '<option value="">Error loading categories</option>';
      attributionSelect.innerHTML = '<option value="">Error loading attributions</option>';
    }
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

  // Load filters on mount
  loadFilters();

  return el;
}
