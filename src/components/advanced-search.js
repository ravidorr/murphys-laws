// Advanced search component for filtering laws

import { fetchAPI } from '../utils/api.js';

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
  el.innerHTML = `
    <div class="section-header">
      <h3 class="section-title"><span class="accent-text">Advanced</span> Search</h3>
    </div>
    <div class="section-body">
      <div class="advanced-search-grid">
        <div class="search-field">
          <label for="search-keyword">Keyword</label>
          <input
            type="text"
            id="search-keyword"
            class="input"
            placeholder="Search law text or title..."
            value="${searchQuery}"
          />
        </div>

        <div class="search-field">
          <label for="search-category">Category</label>
          <select id="search-category" class="input">
            <option value="">Loading categories...</option>
          </select>
        </div>

        <div class="search-field">
          <label for="search-attribution">Submitted By</label>
          <select id="search-attribution" class="input">
            <option value="">Loading attributions...</option>
          </select>
        </div>

        <div class="search-actions">
          <button id="search-btn" class="btn" type="button">
            <span class="material-symbols-outlined icon">search</span>
            Search
          </button>
          <button id="clear-btn" class="btn outline" type="button">
            <span class="material-symbols-outlined icon">clear</span>
            Clear
          </button>
        </div>
      </div>
    </div>
  `;

  const categorySelect = el.querySelector('#search-category');
  const attributionSelect = el.querySelector('#search-attribution');
  const keywordInput = el.querySelector('#search-keyword');
  const searchBtn = el.querySelector('#search-btn');
  const clearBtn = el.querySelector('#clear-btn');

  // Load categories and attributions
  async function loadFilters() {
    try {
      // Fetch categories
      const catData = await fetchAPI('/api/categories');
      categories = catData.data || [];

      // Update category dropdown
      categorySelect.innerHTML = '<option value="">All Categories</option>' +
        categories.map(cat => `<option value="${cat.id}" ${cat.id === selectedCategory ? 'selected' : ''}>${cat.title}</option>`).join('');

      // Fetch attributions
      const attData = await fetchAPI('/api/attributions');
      attributions = attData.data || [];

      // Update attribution dropdown
      attributionSelect.innerHTML = '<option value="">All Submitters</option>' +
        attributions.map(att => `<option value="${att.name}" ${att.name === selectedAttribution ? 'selected' : ''}>${att.name}</option>`).join('');

    } catch (error) {
      console.error('Failed to load filters:', error);
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
