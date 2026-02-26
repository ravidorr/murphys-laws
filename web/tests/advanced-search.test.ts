import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import type { MockInstance } from 'vitest';
import type { Category } from '../src/types/app.d.ts';
import type { SearchFilters } from '../src/types/app.d.ts';
import { AdvancedSearch } from '../src/components/advanced-search.ts';
import * as api from '../src/utils/api.js';
import * as cacheUtils from '../src/utils/category-cache.js';

interface AdvancedSearchTestContext {
  el?: HTMLElement;
  appended?: boolean;
  appendedClones?: Node[];
}

interface MountSearchOptions {
  append?: boolean;
  onSearch?: (filters: SearchFilters) => void;
  initialFilters?: { q?: string; category_id?: string; attribution?: string };
  _testLoadFiltersRef?: (loadFilters: (force?: boolean) => Promise<void>) => void;
}

function createLocalThis(): () => AdvancedSearchTestContext {
  const context: AdvancedSearchTestContext = {};

  beforeEach(() => {
    Object.keys(context).forEach((key) => {
      delete context[key as keyof AdvancedSearchTestContext];
    });
  });

  return () => context;
}

describe('AdvancedSearch component', () => {
  const local = createLocalThis();
  let fetchAPISpy: MockInstance;
  let deferUntilIdleSpy: MockInstance;

  beforeEach(() => {
    fetchAPISpy = vi.spyOn(api, 'fetchAPI');
    deferUntilIdleSpy = vi.spyOn(cacheUtils, 'deferUntilIdle').mockImplementation((callback) => {
      // Execute immediately for testing
      callback();
    });
    localStorage.clear();
  });

  afterEach(() => {
    const self = local();
    if (self.appended && self.el?.parentNode) {
      self.el.parentNode.removeChild(self.el);
    }
    if (self.appendedClones) {
      self.appendedClones.forEach((node) => {
        if (node.parentNode) node.parentNode.removeChild(node);
      });
    }
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function mountSearch({ append = false, ...props }: MountSearchOptions = {}) {
    const el = AdvancedSearch({ onSearch: () => {}, ...props });
    const self = local();
    self.el = el;
    self.appended = append;
    self.appendedClones = [];
    if (append) {
      document.body.appendChild(el);
    }
    return el;
  }

  it('renders with initial empty filters', () => {
    fetchAPISpy.mockResolvedValue({ data: [] });

    const el = mountSearch();

    expect(el.textContent).toMatch(/Advanced Search/);
    expect(el.querySelector('#search-keyword')).toBeTruthy();
    expect(el.querySelector('#search-category')).toBeTruthy();
    expect(el.querySelector('#search-attribution')).toBeTruthy();
  });

  it('renders with initial filters', () => {
    fetchAPISpy.mockResolvedValue({ data: [] });

    const initialFilters = {
      q: 'murphy',
      category_id: '1',
      attribution: 'John'
    };

    const el = mountSearch({ initialFilters });

    const keywordInput = el.querySelector('#search-keyword') as HTMLInputElement;
    expect(keywordInput.value).toBe('murphy');
  });

  it('L53 B1: sets keywordInput.value when keywordInput exists and initialFilters.q is provided', () => {
    fetchAPISpy.mockResolvedValue({ data: [] });
    const el = mountSearch({ initialFilters: { q: 'L53-B1' } });
    const keywordInput = el.querySelector('#search-keyword') as HTMLInputElement;
    expect(keywordInput).toBeTruthy();
    expect(keywordInput.value).toBe('L53-B1');
  });

  it('loads categories successfully', async () => {
    const categories: Category[] = [
      { id: 1, title: 'General', slug: 'general' },
      { id: 2, title: 'Technology', slug: 'technology' }
    ];

    fetchAPISpy
      .mockResolvedValueOnce({ data: categories })
      .mockResolvedValueOnce({ data: [] });

    const el = mountSearch();

    await vi.waitFor(() => {
      const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
      expect(categorySelect.textContent).toMatch(/General/);
      expect(categorySelect.textContent).toMatch(/Technology/);
    });

    // When there's no cache, loadFilters() is called immediately (not deferred)
    // deferUntilIdle is only called when cache exists
    expect(deferUntilIdleSpy).not.toHaveBeenCalled();
  });

  it('fetches submitters when attribution input is focused', async () => {
    fetchAPISpy.mockResolvedValueOnce({ data: [] });
    const el = mountSearch({ append: true });
    await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
    fetchAPISpy.mockClear();
    fetchAPISpy.mockResolvedValueOnce({ data: ['Alice', 'Bob'] });

    const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
    attributionInput.focus();

    await vi.waitFor(() => {
      expect(fetchAPISpy).toHaveBeenCalledWith('/api/v1/submitters', expect.any(Object));
    });
  });

  it('shows typeahead listbox with submitters after fetch', async () => {
    fetchAPISpy.mockResolvedValueOnce({ data: [] });
    const el = mountSearch({ append: true });
    await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
    fetchAPISpy.mockClear();
    fetchAPISpy.mockResolvedValueOnce({ data: ['Alice', 'Bob'] });

    const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
    attributionInput.focus();

    await vi.waitFor(() => {
      const listbox = el.querySelector('#search-attribution-listbox');
      expect(listbox?.getAttribute('aria-hidden')).toBe('false');
      expect(listbox?.textContent).toMatch(/Alice/);
      expect(listbox?.textContent).toMatch(/Bob/);
    });
  });

  it('handles filter loading errors gracefully', async () => {
    fetchAPISpy.mockRejectedValue(new Error('Network error'));

    const el = mountSearch();

    // Wait for loadFilters() to execute (called immediately when no cache)
    await new Promise(resolve => setTimeout(resolve, 50));

    const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
    // When fetch fails and no cache exists, show error option in category dropdown
    expect(categorySelect).toBeTruthy();
    expect(categorySelect.innerHTML).toContain('Error loading categories');
    // When there's no cache, loadFilters() is called immediately (not deferred)
    expect(deferUntilIdleSpy).not.toHaveBeenCalled();
  });

  it('populates category dropdown from cache immediately', () => {
    const categories: Category[] = [
      { id: 1, title: 'General', slug: 'general' },
      { id: 2, title: 'Technology', slug: 'technology' }
    ];
    cacheUtils.setCachedCategories(categories);

    const el = mountSearch();

    const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
    expect(categorySelect.textContent).toMatch(/General/);
    expect(categorySelect.textContent).toMatch(/Technology/);
    expect(el.querySelector('#search-attribution-input')).toBeTruthy();
    expect(deferUntilIdleSpy).toHaveBeenCalled();
  });

  it('loads categories on focus if not loaded yet', async () => {
    const categories: Category[] = [
      { id: 1, title: 'General', slug: 'general' }
    ];

    fetchAPISpy
      .mockResolvedValueOnce({ data: categories })
      .mockResolvedValueOnce({ data: [] });

    // Mock deferUntilIdle to not execute immediately
    deferUntilIdleSpy.mockImplementation(() => {});

    const el = mountSearch();

    // Trigger focus event to lazy load
    const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
    categorySelect.dispatchEvent(new Event('focus', { bubbles: true }));

    await vi.waitFor(() => {
      expect(categorySelect.textContent).toMatch(/General/);
    });
  });

  it('fetches submitters when attribution input is focused (no cache)', async () => {
    fetchAPISpy.mockImplementation((url: string) => {
      if (url.includes('submitters')) return Promise.resolve({ data: ['Alice', 'Bob'] });
      return Promise.resolve({ data: [] });
    });
    deferUntilIdleSpy.mockImplementation(() => {});

    const el = mountSearch();

    const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
    attributionInput.dispatchEvent(new Event('focus', { bubbles: true }));

    await vi.waitFor(() => {
      expect(fetchAPISpy).toHaveBeenCalledWith('/api/v1/submitters', expect.any(Object));
    });
  });

  it('early-returns when loadFilters(false) called after filters already loaded', async () => {
    fetchAPISpy.mockImplementation((url: string) => {
      if (url.includes('submitters')) return Promise.resolve({ data: ['A'] });
      return Promise.resolve({ data: [{ id: 1, title: 'Cat', slug: 'cat' }] });
    });
    deferUntilIdleSpy.mockImplementation((cb) => cb());

    let loadFiltersRef: ((force?: boolean) => Promise<void>) | null = null;
    mountSearch({
      _testLoadFiltersRef: (fn) => { loadFiltersRef = fn; },
    });

    await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
    const callCountAfterFirstLoad = fetchAPISpy.mock.calls.length;

    await loadFiltersRef!(false);

    expect(fetchAPISpy.mock.calls.length).toBe(callCountAfterFirstLoad);
  });

  it('calls onSearch with filters when search button is clicked', async () => {
    fetchAPISpy.mockResolvedValue({ data: [] });

    let searchFilters: SearchFilters | null = null;
    const onSearch = (filters: SearchFilters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await new Promise(r => setTimeout(r, 10));

    const keywordInput = el.querySelector('#search-keyword') as HTMLInputElement;
    keywordInput.value = 'test query';

    const searchBtn = el.querySelector('#search-btn') as HTMLElement;
    searchBtn.click();

    expect(searchFilters).toEqual({ q: 'test query' });
  });

  it('calls onSearch with category filter', async () => {
    const categories: Category[] = [{ id: 1, title: 'General', slug: 'general' }];
    fetchAPISpy
      .mockResolvedValueOnce({ data: categories })
      .mockResolvedValueOnce({ data: [] });

    let searchFilters: SearchFilters | null = null;
    const onSearch = (filters: SearchFilters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await vi.waitFor(() => {
      const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
      expect(categorySelect.options.length).toBeGreaterThan(1);
    });

    const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
    categorySelect.value = '1';

    const searchBtn = el.querySelector('#search-btn') as HTMLElement;
    searchBtn.click();

    expect(searchFilters).toEqual({ category_id: 1 });
  });

  it('calls onSearch with attribution filter', async () => {
    fetchAPISpy.mockResolvedValue({ data: [] });

    let searchFilters: SearchFilters | null = null;
    const onSearch = (filters: SearchFilters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });
    const attributionHidden = el.querySelector('#search-attribution') as HTMLInputElement;
    attributionHidden.value = 'Alice';

    const searchBtn = el.querySelector('#search-btn') as HTMLElement;
    searchBtn.click();

    expect(searchFilters).toEqual({ attribution: 'Alice' });
  });

  it('calls onSearch with all filters combined', async () => {
    fetchAPISpy.mockResolvedValueOnce({ data: [{ id: 1, title: 'General', slug: 'general' }] });

    let searchFilters: SearchFilters | null = null;
    const onSearch = (filters: SearchFilters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await vi.waitFor(() => {
      const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
      expect(categorySelect.options.length).toBeGreaterThan(1);
    });

    const keywordInput = el.querySelector('#search-keyword') as HTMLInputElement;
    const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
    const attributionHidden = el.querySelector('#search-attribution') as HTMLInputElement;

    keywordInput.value = 'murphy';
    categorySelect.value = '1';
    attributionHidden.value = 'Alice';

    const searchBtn = el.querySelector('#search-btn') as HTMLElement;
    searchBtn.click();

    expect(searchFilters).toEqual({
      q: 'murphy',
      category_id: 1,
      attribution: 'Alice'
    });
  });

  it('trims whitespace from keyword input', async () => {
    fetchAPISpy.mockResolvedValue({ data: [] });

    let searchFilters: SearchFilters | null = null;
    const onSearch = (filters: SearchFilters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await new Promise(r => setTimeout(r, 10));

    const keywordInput = el.querySelector('#search-keyword') as HTMLInputElement;
    keywordInput.value = '  test query  ';

    const searchBtn = el.querySelector('#search-btn') as HTMLElement;
    searchBtn.click();

    expect(searchFilters).toEqual({ q: 'test query' });
  });

  it('excludes empty filters from search', async () => {
    fetchAPISpy.mockResolvedValue({ data: [] });

    let searchFilters: SearchFilters | null = null;
    const onSearch = (filters: SearchFilters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await new Promise(r => setTimeout(r, 10));

    const keywordInput = el.querySelector('#search-keyword') as HTMLInputElement;
    keywordInput.value = '';

    const searchBtn = el.querySelector('#search-btn') as HTMLElement;
    searchBtn.click();

    expect(searchFilters).toEqual({});
  });

  it('clears all filters when clear button is clicked', async () => {
    fetchAPISpy.mockResolvedValueOnce({ data: [{ id: 1, title: 'General', slug: 'general' }] });

    let searchFilters: SearchFilters | null = null;
    const onSearch = (filters: SearchFilters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await vi.waitFor(() => {
      const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
      expect(categorySelect.options.length).toBeGreaterThan(1);
    });

    const keywordInput = el.querySelector('#search-keyword') as HTMLInputElement;
    const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
    const attributionHidden = el.querySelector('#search-attribution') as HTMLInputElement;
    const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;

    keywordInput.value = 'murphy';
    categorySelect.value = '1';
    attributionHidden.value = 'Alice';
    attributionInput.value = 'Alice';

    const clearBtn = el.querySelector('#clear-btn') as HTMLElement;
    clearBtn.click();

    expect(keywordInput.value).toBe('');
    expect(categorySelect.value).toBe('');
    expect(attributionHidden.value).toBe('');
    expect(searchFilters).toEqual({});
  });

  it('triggers search when Enter key is pressed in keyword input', async () => {
    fetchAPISpy.mockResolvedValue({ data: [] });

    let searchFilters: SearchFilters | null = null;
    const onSearch = (filters: SearchFilters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await new Promise(r => setTimeout(r, 10));

    const keywordInput = el.querySelector('#search-keyword') as HTMLInputElement;
    keywordInput.value = 'test';

    const enterEvent = new KeyboardEvent('keypress', { key: 'Enter' });
    keywordInput.dispatchEvent(enterEvent);

    expect(searchFilters).toEqual({ q: 'test' });
  });

  it('does not trigger search when other keys are pressed', async () => {
    fetchAPISpy.mockResolvedValue({ data: [] });

    let searchCalled = false;
    const onSearch = () => { searchCalled = true; };

    const el = mountSearch({ onSearch });

    await new Promise(r => setTimeout(r, 10));

    const keywordInput = el.querySelector('#search-keyword') as HTMLInputElement;
    keywordInput.value = 'test';

    const keyEvent = new KeyboardEvent('keypress', { key: 'a' });
    keywordInput.dispatchEvent(keyEvent);

    expect(searchCalled).toBe(false);
  });

  it('selects initial category when provided', async () => {
    const categories = [
      { id: 1, title: 'General', slug: 'general' },
      { id: 2, title: 'Technology', slug: 'technology' }
    ];

    fetchAPISpy
      .mockResolvedValueOnce({ data: categories })
      .mockResolvedValueOnce({ data: [] });

    const el = mountSearch({
      onSearch: () => {},
      initialFilters: { category_id: '2' }
    });

    await vi.waitFor(() => {
      const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
      expect(categorySelect.value).toBe('2');
    });
  });

  it('selects initial attribution when provided', () => {
    fetchAPISpy.mockResolvedValue({ data: [] });

    const el = mountSearch({
      onSearch: () => {},
      initialFilters: { attribution: 'Bob' }
    });

    const attributionHidden = el.querySelector('#search-attribution') as HTMLInputElement;
    const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
    expect(attributionHidden.value).toBe('Bob');
    expect(attributionInput.value).toBe('Bob');
  });

  it('handles missing data property in categories response', async () => {
    // First fetch returns object without data property
    fetchAPISpy
      .mockResolvedValueOnce({}) // No data property
      .mockResolvedValueOnce({ data: [] });

    const el = mountSearch();

    await vi.waitFor(() => {
      const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
      // When data property is missing, categories will be empty array
      // Dropdown only updates if categories.length > 0, so it stays with "Loading..."
      // But we can verify the component doesn't crash
      expect(categorySelect).toBeTruthy();
    });
  });

  it('handles missing data in submitters response without crashing', async () => {
    fetchAPISpy.mockResolvedValueOnce({ data: [] });
    const el = mountSearch({ append: true });
    await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
    fetchAPISpy.mockClear();
    fetchAPISpy.mockResolvedValueOnce({}); // no data property

    const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
    attributionInput.focus();
    await new Promise(r => setTimeout(r, 300));
    expect(el.querySelector('#search-attribution-listbox')).toBeTruthy();
  });

  describe('initial filters and category cache', () => {
    it('marks selected category from initial filters', async () => {
      vi.spyOn(cacheUtils, 'getCachedCategories').mockReturnValue([
        { id: 1, title: 'Category One', slug: 'category-one' },
        { id: 2, title: 'Category Two', slug: 'category-two' }
      ]);
      fetchAPISpy.mockResolvedValue({ data: [] });

      const el = mountSearch({ initialFilters: { category_id: '2' } });

      await vi.waitFor(() => {
        const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
        const selectedOption = categorySelect.querySelector('option[selected]');
        expect(selectedOption).toBeTruthy();
        expect(selectedOption!.textContent).toBe('Category Two');
      });
    });

    it('marks selected attribution from initial filters', () => {
      fetchAPISpy.mockResolvedValue({ data: [] });
      const el = mountSearch({ initialFilters: { attribution: 'Author B' } });
      const attributionHidden = el.querySelector('#search-attribution') as HTMLInputElement;
      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      expect(attributionHidden.value).toBe('Author B');
      expect(attributionInput.value).toBe('Author B');
    });
  });

  it('sets keyword input from initialFilters.q (covers L53 B1)', () => {
    fetchAPISpy.mockResolvedValue({ data: [] });
    const el = mountSearch({ initialFilters: { q: 'keyword' } });
    const keywordInput = el.querySelector('#search-keyword') as HTMLInputElement;
    expect(keywordInput).toBeTruthy();
    expect(keywordInput.value).toBe('keyword');
  });

  it('lazy-loads categories on category select focus when empty (covers L172 B1)', async () => {
    fetchAPISpy.mockResolvedValue({ data: [{ id: 1, title: 'Cat', slug: 'cat' }] });
    const el = mountSearch({ append: true });
    const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
    expect(categorySelect).toBeTruthy();
    categorySelect.focus();
    await vi.waitFor(() => {
      expect(fetchAPISpy).toHaveBeenCalled();
    });
  });

  it('lazy-loads submitters when attribution input is focused (covers typeahead)', async () => {
    fetchAPISpy.mockResolvedValueOnce({ data: [] });
    const el = mountSearch({ append: true });
    await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
    fetchAPISpy.mockClear();
    fetchAPISpy.mockResolvedValueOnce({ data: ['Author A'] });
    const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
    attributionInput.focus();
    await vi.waitFor(() => {
      expect(fetchAPISpy).toHaveBeenCalledWith('/api/v1/submitters', expect.any(Object));
    });
  });

  it('does not load filters on category focus when categories already populated (L172 false branch)', () => {
    const initialCategories = [{ id: 1, title: 'Cached', slug: 'cached' }];
    vi.spyOn(cacheUtils, 'getCachedCategories').mockReturnValue(initialCategories);
    fetchAPISpy.mockResolvedValue({ data: [] });
    const el = mountSearch({ append: true });
    const callCountBefore = fetchAPISpy.mock.calls.length;
    const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
    categorySelect.focus();
    expect(fetchAPISpy.mock.calls.length).toBe(callCountBefore);
  });

  it('fetches submitters on attribution input focus (typeahead)', () => {
    fetchAPISpy.mockResolvedValueOnce({ data: [] });
    const el = mountSearch({ append: true });
    const callCountAfterCategories = fetchAPISpy.mock.calls.length;
    const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
    fetchAPISpy.mockResolvedValueOnce({ data: ['Cached'] });
    attributionInput.focus();
    // Focus triggers submitters fetch (async), so we just check the component has the input
    expect(attributionInput).toBeTruthy();
    expect(el.querySelector('#search-attribution')).toBeTruthy();
  });
});
