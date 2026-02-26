// Advanced search component for filtering laws

import templateHtml from '@components/templates/advanced-search.html?raw';
import { fetchAPI } from '../utils/api.ts';
import { hydrateIcons } from '../utils/icons.ts';
import { stripMarkdownFootnotes } from '../utils/sanitize.ts';
import {
  getCachedCategories,
  setCachedCategories,
  deferUntilIdle
} from '../utils/category-cache.ts';

const SUBMITTERS_DEBOUNCE_MS = 250;
const SUBMITTERS_LIMIT = 20;

interface AdvancedSearchFilters {
  q?: string;
  category_id?: string | number;
  attribution?: string;
}

export interface AdvancedSearchOptions {
  onSearch: (filters: AdvancedSearchFilters) => void;
  initialFilters?: AdvancedSearchFilters;
  /** Test hook: called with loadFilters so tests can trigger loadFilters(forceReload). */
  _testLoadFiltersRef?: (loadFilters: (forceReload?: boolean) => Promise<void>) => void;
}

export function AdvancedSearch({ onSearch, initialFilters = {} as AdvancedSearchFilters, _testLoadFiltersRef }: AdvancedSearchOptions): HTMLElement {
  const el = document.createElement('section');
  el.className = 'section section-card mb-12';

  let categories: Array<{ id: number; title: string; slug: string }> = [];
  let selectedCategory = initialFilters.category_id || '';
  let selectedAttribution = initialFilters.attribution || '';
  let searchQuery = initialFilters.q || '';
  let filtersLoaded = false;
  let submittersDebounceId: ReturnType<typeof setTimeout> | null = null;
  let listboxSelectedIndex = -1;

  el.innerHTML = templateHtml;
  hydrateIcons(el);

  const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
  const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
  const attributionListbox = el.querySelector('#search-attribution-listbox') as HTMLElement;
  const attributionHidden = el.querySelector('#search-attribution') as HTMLInputElement;
  const keywordInput = el.querySelector('#search-keyword') as HTMLInputElement;
  const searchBtn = el.querySelector('#search-btn') as HTMLButtonElement;
  const clearBtn = el.querySelector('#clear-btn') as HTMLButtonElement;

  if (keywordInput) keywordInput.value = searchQuery;
  if (attributionInput && selectedAttribution) attributionInput.value = selectedAttribution;
  if (attributionHidden) attributionHidden.value = selectedAttribution;

  function hideListbox() {
    if (attributionListbox) {
      attributionListbox.setAttribute('aria-hidden', 'true');
      attributionListbox.innerHTML = '';
      listboxSelectedIndex = -1;
    }
    if (attributionInput) attributionInput.setAttribute('aria-expanded', 'false');
  }

  function showListbox() {
    if (attributionListbox) attributionListbox.setAttribute('aria-hidden', 'false');
    if (attributionInput) attributionInput.setAttribute('aria-expanded', 'true');
  }

  async function fetchSubmitters(q: string): Promise<string[]> {
    const params: Record<string, string> = { limit: String(SUBMITTERS_LIMIT) };
    if (q.trim()) params.q = q.trim();
    const data = await fetchAPI('/api/v1/submitters', params) as { data?: string[] };
    return data.data ?? [];
  }

  function renderListboxItems(names: string[]) {
    if (!attributionListbox) return;
    const options: string[] = [];
    options.push(''); // All Submitters (clear)
    if (!names.includes('Anonymous')) options.push('Anonymous');
    options.push(...names.filter(n => n !== 'Anonymous'));
    attributionListbox.innerHTML = options.map((name, idx) => {
      const label = name === '' ? 'All Submitters' : name;
      return `<div class="submitter-typeahead-item" role="option" data-value="${escapeHtmlAttr(name)}" data-index="${idx}" aria-selected="false">${escapeHtmlText(label)}</div>`;
    }).join('');
    listboxSelectedIndex = -1;
  }

  function escapeHtmlAttr(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escapeHtmlText(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function onSelectSubmitter(value: string, label: string) {
    selectedAttribution = value;
    if (attributionInput) attributionInput.value = label;
    if (attributionHidden) attributionHidden.value = value;
    hideListbox();
  }

  function runSubmittersSearch() {
    const q = attributionInput?.value?.trim() ?? '';
    if (submittersDebounceId) clearTimeout(submittersDebounceId);
    submittersDebounceId = setTimeout(async () => {
      submittersDebounceId = null;
      try {
        const names = await fetchSubmitters(q);
        renderListboxItems(names);
        showListbox();
      } catch {
        hideListbox();
      }
    }, SUBMITTERS_DEBOUNCE_MS);
  }

  function populateDropdowns() {
    const cachedCategories = getCachedCategories();
    if (cachedCategories && cachedCategories.length > 0) {
      categories = cachedCategories;
      categorySelect.innerHTML = '<option value="">All Categories</option>' +
        categories.map(cat => `<option value="${cat.id}" ${String(cat.id) === String(selectedCategory) ? 'selected' : ''}>${stripMarkdownFootnotes(cat.title)}</option>`).join('');
    }
  }

  async function loadFilters(forceReload = false) {
    if (filtersLoaded && !forceReload) return;
    filtersLoaded = true;

    try {
      const catData = await fetchAPI('/api/v1/categories') as { data?: Array<{ id: number; title: string; slug: string }> };
      categories = catData.data || [];
      setCachedCategories(categories);
    } catch {
      const cached = getCachedCategories();
      if (cached && cached.length > 0) categories = cached;
      else if (categorySelect) categorySelect.innerHTML = '<option value="">Error loading categories</option>';
    }

    if (categories.length > 0 && categorySelect) {
      categorySelect.innerHTML = '<option value="">All Categories</option>' +
        categories.map(cat => `<option value="${cat.id}" ${String(cat.id) === String(selectedCategory) ? 'selected' : ''}>${stripMarkdownFootnotes(cat.title)}</option>`).join('');
    }
  }

  _testLoadFiltersRef?.(loadFilters);

  function setupAttributionTypeahead() {
    if (!attributionInput || !attributionListbox) return;

    attributionInput.addEventListener('focus', () => {
      const q = attributionInput.value.trim();
      if (q) runSubmittersSearch();
      else {
        fetchSubmitters('').then(names => {
          renderListboxItems(names);
          showListbox();
        }).catch(() => hideListbox());
      }
    });

    attributionInput.addEventListener('input', () => {
      runSubmittersSearch();
    });

    attributionInput.addEventListener('keydown', (e: KeyboardEvent) => {
      const items = attributionListbox.querySelectorAll('.submitter-typeahead-item');
      if (attributionListbox.getAttribute('aria-hidden') === 'true') {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          e.preventDefault();
          fetchSubmitters(attributionInput.value.trim()).then(names => {
            renderListboxItems(names);
            showListbox();
            listboxSelectedIndex = 0;
            items.forEach((item, i) => item.setAttribute('aria-selected', i === 0 ? 'true' : 'false'));
          }).catch(() => {});
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        listboxSelectedIndex = Math.min(listboxSelectedIndex + 1, items.length - 1);
        items.forEach((item, i) => item.setAttribute('aria-selected', i === listboxSelectedIndex ? 'true' : 'false'));
        items[listboxSelectedIndex]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        listboxSelectedIndex = Math.max(listboxSelectedIndex - 1, 0);
        items.forEach((item, i) => item.setAttribute('aria-selected', i === listboxSelectedIndex ? 'true' : 'false'));
        items[listboxSelectedIndex]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && listboxSelectedIndex >= 0) {
        const item = items[listboxSelectedIndex];
        if (!item) return;
        e.preventDefault();
        const value = item.getAttribute('data-value') ?? '';
        const label = item.textContent?.trim() ?? (value || 'All Submitters');
        onSelectSubmitter(value, label);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideListbox();
      }
    });

    attributionListbox.addEventListener('click', (e: Event) => {
      const target = (e.target as HTMLElement).closest('.submitter-typeahead-item');
      if (!target) return;
      const value = target.getAttribute('data-value') ?? '';
      const label = target.textContent?.trim() ?? (value || 'All Submitters');
      onSelectSubmitter(value, label);
    });
  }

  document.addEventListener('click', function closeListbox(e: Event) {
    if (!el.contains(e.target as Node) && attributionListbox?.getAttribute('aria-hidden') !== 'true') {
      hideListbox();
    }
  });

  function setupLazyLoad() {
    if (categorySelect) {
      categorySelect.addEventListener('focus', () => {
        if (categories.length === 0) loadFilters(true);
      }, { once: true });
    }
  }

  searchBtn?.addEventListener('click', () => {
    const attributionValue = (attributionHidden?.value ?? selectedAttribution) || undefined;
    const filters: AdvancedSearchFilters = {
      q: keywordInput?.value?.trim() ?? '',
      category_id: categorySelect?.value ? Number(categorySelect.value) : undefined,
      attribution: attributionValue
    };
    const cleanFilters: AdvancedSearchFilters = {};
    if (filters.q) cleanFilters.q = filters.q;
    if (filters.category_id !== undefined) cleanFilters.category_id = filters.category_id;
    if (filters.attribution) cleanFilters.attribution = filters.attribution;
    onSearch(cleanFilters);
  });

  clearBtn?.addEventListener('click', () => {
    if (keywordInput) keywordInput.value = '';
    if (categorySelect) categorySelect.value = '';
    selectedAttribution = '';
    if (attributionInput) attributionInput.value = '';
    if (attributionHidden) attributionHidden.value = '';
    hideListbox();
    onSearch({});
  });

  keywordInput?.addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key === 'Enter') searchBtn?.click();
  });

  populateDropdowns();
  setupLazyLoad();
  setupAttributionTypeahead();

  const cachedCategories = getCachedCategories();
  if (cachedCategories && cachedCategories.length > 0) {
    deferUntilIdle(() => loadFilters(), 2000);
  } else {
    loadFilters();
  }

  return el;
}
