import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import type { MockInstance } from 'vitest';
import type { Category } from '../src/types/app.d.ts';
import type { SearchFilters } from '../src/types/app.d.ts';
import type { CachedAttribution } from '../src/utils/category-cache.js';
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

  it('loads attributions successfully (object format)', async () => {
    const attributions = [
      { name: 'Alice' },
      { name: 'Bob' }
    ];

    fetchAPISpy
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: attributions });

    const el = mountSearch();

    await vi.waitFor(() => {
      const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
      expect(attributionSelect.textContent).toMatch(/Alice/);
      expect(attributionSelect.textContent).toMatch(/Bob/);
    });

    // When there's no cache, loadFilters() is called immediately (not deferred)
    // deferUntilIdle is only called when cache exists
    expect(deferUntilIdleSpy).not.toHaveBeenCalled();
  });

  it('loads attributions successfully (string format from API)', async () => {
    // API returns array of strings, not objects
    const attributions = ['Alice', 'Bob'];

    fetchAPISpy
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: attributions });

    const el = mountSearch();

    await vi.waitFor(() => {
      const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
      expect(attributionSelect.textContent).toMatch(/Alice/);
      expect(attributionSelect.textContent).toMatch(/Bob/);
    });
  });

  it('filters out null and undefined attributions', async () => {
    const attributions = ['Alice', null, undefined, '', 'Bob'];

    fetchAPISpy
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: attributions });

    const el = mountSearch();

    await vi.waitFor(() => {
      const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
      expect(attributionSelect.textContent).toMatch(/Alice/);
      expect(attributionSelect.textContent).toMatch(/Bob/);
      // Should not contain empty options
      const options = Array.from(attributionSelect.querySelectorAll('option'));
      const emptyOptions = options.filter(o => o.value === 'null' || o.value === 'undefined' || o.textContent === '');
      expect(emptyOptions.length).toBe(0);
    });
  });

  it('filters out "undefined" and "null" string literals from attributions', async () => {
    const attributions = ['Alice', 'undefined', 'null', 'Undefined', 'NULL', 'Bob'];

    fetchAPISpy
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: attributions });

    const el = mountSearch();

    await vi.waitFor(() => {
      const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
      expect(attributionSelect.textContent).toMatch(/Alice/);
      expect(attributionSelect.textContent).toMatch(/Bob/);
      // Should not contain "undefined" or "null" string literals
      const options = Array.from(attributionSelect.querySelectorAll('option'));
      const invalidOptions = options.filter(o => 
        o.value.toLowerCase() === 'undefined' || 
        o.value.toLowerCase() === 'null'
      );
      expect(invalidOptions.length).toBe(0);
    });
  });

  it('filters out whitespace-only attributions', async () => {
    const attributions = ['Alice', '   ', '\t', '\n', 'Bob'];

    fetchAPISpy
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: attributions });

    const el = mountSearch();

    await vi.waitFor(() => {
      const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
      expect(attributionSelect.textContent).toMatch(/Alice/);
      expect(attributionSelect.textContent).toMatch(/Bob/);
      // Should only have "All Submitters" + valid options
      const options = Array.from(attributionSelect.querySelectorAll('option'));
      expect(options.length).toBe(3); // All Submitters, Alice, Bob
    });
  });

  it('filters out "anonymous" attributions', async () => {
    const attributions = ['Alice', 'anonymous', 'Anonymous', 'ANONYMOUS', 'Bob'];

    fetchAPISpy
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: attributions });

    const el = mountSearch();

    await vi.waitFor(() => {
      const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
      expect(attributionSelect.textContent).toMatch(/Alice/);
      expect(attributionSelect.textContent).toMatch(/Bob/);
      // Should not contain "anonymous" in any case
      const options = Array.from(attributionSelect.querySelectorAll('option'));
      const anonymousOptions = options.filter(o => o.value.toLowerCase() === 'anonymous');
      expect(anonymousOptions.length).toBe(0);
    });
  });

  it('filters out non-string attribution names', async () => {
    // Test attributions with objects that have non-string name values
    const attributions = [
      { name: 'Alice' },
      { name: 123 },        // number - should be filtered
      { name: true },       // boolean - should be filtered
      { name: {} },         // object - should be filtered
      { name: 'Bob' }
    ];

    fetchAPISpy
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: attributions });

    const el = mountSearch();

    await vi.waitFor(() => {
      const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
      expect(attributionSelect.textContent).toMatch(/Alice/);
      expect(attributionSelect.textContent).toMatch(/Bob/);
      // Should only have "All Submitters" + valid options
      const options = Array.from(attributionSelect.querySelectorAll('option'));
      expect(options.length).toBe(3); // All Submitters, Alice, Bob
    });
  });

  it('handles filter loading errors gracefully', async () => {
    fetchAPISpy.mockRejectedValue(new Error('Network error'));

    const el = mountSearch();

    // Wait for loadFilters() to execute (called immediately when no cache)
    await new Promise(resolve => setTimeout(resolve, 50));

    const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
    // When fetch fails and no cache exists, dropdown keeps "Loading..." text
    // This is expected behavior - user can still use the dropdown
    expect(categorySelect).toBeTruthy();
    // When there's no cache, loadFilters() is called immediately (not deferred)
    expect(deferUntilIdleSpy).not.toHaveBeenCalled();
  });

  it('populates dropdowns from cache immediately', () => {
    const categories: Category[] = [
      { id: 1, title: 'General', slug: 'general' },
      { id: 2, title: 'Technology', slug: 'technology' }
    ];
    const attributions = [
      { name: 'Alice' },
      { name: 'Bob' }
    ];

    // Set cache before mounting
    cacheUtils.setCachedCategories(categories);
    cacheUtils.setCachedAttributions(attributions);

    const el = mountSearch();

    // Should populate immediately from cache
    const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
    const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;

    expect(categorySelect.textContent).toMatch(/General/);
    expect(categorySelect.textContent).toMatch(/Technology/);
    expect(attributionSelect.textContent).toMatch(/Alice/);
    expect(attributionSelect.textContent).toMatch(/Bob/);
    
    // When cache exists, deferUntilIdle should be called to load fresh data
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
    const attributions = [{ name: 'Alice' }];
    fetchAPISpy
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: attributions });

    let searchFilters: SearchFilters | null = null;
    const onSearch = (filters: SearchFilters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await vi.waitFor(() => {
      const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
      expect(attributionSelect.options.length).toBeGreaterThan(1);
    });

    const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
    attributionSelect.value = 'Alice';

    const searchBtn = el.querySelector('#search-btn') as HTMLElement;
    searchBtn.click();

    expect(searchFilters).toEqual({ attribution: 'Alice' });
  });

  it('calls onSearch with all filters combined', async () => {
    const categories: Category[] = [{ id: 1, title: 'General', slug: 'general' }];
    const attributions = [{ name: 'Alice' }];

    fetchAPISpy
      .mockResolvedValueOnce({ data: categories })
      .mockResolvedValueOnce({ data: attributions });

    let searchFilters: SearchFilters | null = null;
    const onSearch = (filters: SearchFilters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await vi.waitFor(() => {
      const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
      expect(categorySelect.options.length).toBeGreaterThan(1);
    });

    const keywordInput = el.querySelector('#search-keyword') as HTMLInputElement;
    const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
    const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;

    keywordInput.value = 'murphy';
    categorySelect.value = '1';
    attributionSelect.value = 'Alice';

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
    const categories: Category[] = [{ id: 1, title: 'General', slug: 'general' }];
    const attributions = [{ name: 'Alice' }];

    fetchAPISpy
      .mockResolvedValueOnce({ data: categories })
      .mockResolvedValueOnce({ data: attributions });

    let searchFilters: SearchFilters | null = null;
    const onSearch = (filters: SearchFilters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await vi.waitFor(() => {
      const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
      expect(categorySelect.options.length).toBeGreaterThan(1);
    });

    // Set some filters
    const keywordInput = el.querySelector('#search-keyword') as HTMLInputElement;
    const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
    const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;

    keywordInput.value = 'murphy';
    categorySelect.value = '1';
    attributionSelect.value = 'Alice';

    // Clear filters
    const clearBtn = el.querySelector('#clear-btn') as HTMLElement;
    clearBtn.click();

    expect(keywordInput.value).toBe('');
    expect(categorySelect.value).toBe('');
    expect(attributionSelect.value).toBe('');
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

  it('selects initial attribution when provided', async () => {
    const attributions = [
      { name: 'Alice' },
      { name: 'Bob' }
    ];

    fetchAPISpy
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: attributions });

    const el = mountSearch({
      onSearch: () => {},
      initialFilters: { attribution: 'Bob' }
    });

    await vi.waitFor(() => {
      const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
      expect(attributionSelect.value).toBe('Bob');
    });
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

  it('handles missing data property in attributions response', async () => {
    // Second fetch returns object without data property
    fetchAPISpy
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({}); // No data property

    const el = mountSearch();

    await vi.waitFor(() => {
      const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
      // When data property is missing, attributions will be empty array
      // Dropdown only updates if attributions.length > 0, so it stays with "Loading..."
      // But we can verify the component doesn't crash
      expect(attributionSelect).toBeTruthy();
    });
  });

  it('uses cached attributions when fetch fails', async () => {
    // Pre-populate cache with attributions (as objects with name property)
    const cachedAttributions = [{ name: 'Author A' }, { name: 'Author B' }];
    vi.spyOn(cacheUtils, 'getCachedAttributions').mockReturnValue(cachedAttributions);

    // First fetch succeeds for categories, second fetch fails for attributions
    fetchAPISpy
      .mockResolvedValueOnce({ data: [] })
      .mockRejectedValueOnce(new Error('Network error'));

    const el = mountSearch();

    await vi.waitFor(() => {
      const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
      // Should use cached attributions
      expect(attributionSelect.innerHTML).toContain('Author A');
      expect(attributionSelect.innerHTML).toContain('Author B');
    });
  });

  it('loads attributions on focus when empty', async () => {
    // First load with empty attributions
    fetchAPISpy
      .mockResolvedValueOnce({ data: [] }) // categories
      .mockResolvedValueOnce({ data: [] }); // empty attributions

    const el = mountSearch({ append: true });

    await vi.waitFor(() => {
      expect(fetchAPISpy).toHaveBeenCalledTimes(2);
    });

    // Reset mocks for the focus-triggered fetch
    fetchAPISpy.mockClear();
    fetchAPISpy
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: ['New Author'] });

    // Focus on attribution select should trigger reload
    const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
    attributionSelect.dispatchEvent(new FocusEvent('focus'));

    await vi.waitFor(() => {
      expect(fetchAPISpy).toHaveBeenCalled();
    });
  });

  describe('attribution filtering edge cases', () => {
    it('filters out null attributions', async () => {
      vi.spyOn(cacheUtils, 'getCachedAttributions').mockReturnValue([
        { name: 'Valid Author' },
        null,
        { name: 'Another Author' }
      ]);
      fetchAPISpy.mockResolvedValue({ data: [] });

      const el = mountSearch();

      await vi.waitFor(() => {
        const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
        expect(attributionSelect.innerHTML).toContain('Valid Author');
        expect(attributionSelect.innerHTML).toContain('Another Author');
        expect(attributionSelect.innerHTML).not.toContain('null');
      });
    });

    it('filters out attributions with name "undefined" string', async () => {
      vi.spyOn(cacheUtils, 'getCachedAttributions').mockReturnValue([
        { name: 'Valid Author' },
        { name: 'undefined' },
        { name: 'UNDEFINED' }
      ]);
      fetchAPISpy.mockResolvedValue({ data: [] });

      const el = mountSearch();

      await vi.waitFor(() => {
        const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
        expect(attributionSelect.innerHTML).toContain('Valid Author');
        expect(attributionSelect.innerHTML).not.toContain('>undefined<');
        expect(attributionSelect.innerHTML).not.toContain('>UNDEFINED<');
      });
    });

    it('filters out attributions with name "null" string', async () => {
      vi.spyOn(cacheUtils, 'getCachedAttributions').mockReturnValue([
        { name: 'Valid Author' },
        { name: 'null' },
        { name: 'NULL' }
      ]);
      fetchAPISpy.mockResolvedValue({ data: [] });

      const el = mountSearch();

      await vi.waitFor(() => {
        const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
        expect(attributionSelect.innerHTML).toContain('Valid Author');
        expect(attributionSelect.innerHTML).not.toContain('>null<');
        expect(attributionSelect.innerHTML).not.toContain('>NULL<');
      });
    });

    it('filters out empty string attributions', async () => {
      vi.spyOn(cacheUtils, 'getCachedAttributions').mockReturnValue([
        { name: 'Valid Author' },
        { name: '' },
        { name: '   ' }
      ]);
      fetchAPISpy.mockResolvedValue({ data: [] });

      const el = mountSearch();

      await vi.waitFor(() => {
        const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
        expect(attributionSelect.innerHTML).toContain('Valid Author');
        // Empty options would show as empty option text
        const options = attributionSelect.querySelectorAll('option');
        const optionTexts = Array.from(options).map(o => (o.textContent ?? '').trim());
        expect(optionTexts.filter(t => t === '').length).toBe(0);
      });
    });

    it('handles string format attributions', async () => {
      vi.spyOn(cacheUtils, 'getCachedAttributions').mockReturnValue([
        'String Author',
        'Another String Author'
      ]);
      fetchAPISpy.mockResolvedValue({ data: [] });

      const el = mountSearch();

      await vi.waitFor(() => {
        const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
        expect(attributionSelect.innerHTML).toContain('String Author');
        expect(attributionSelect.innerHTML).toContain('Another String Author');
      });
    });

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

    it('marks selected attribution from initial filters', async () => {
      vi.spyOn(cacheUtils, 'getCachedAttributions').mockReturnValue([
        { name: 'Author A' },
        { name: 'Author B' }
      ]);
      fetchAPISpy.mockResolvedValue({ data: [] });

      const el = mountSearch({ initialFilters: { attribution: 'Author B' } });

      await vi.waitFor(() => {
        const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
        const selectedOption = attributionSelect.querySelector('option[selected]');
        expect(selectedOption).toBeTruthy();
        expect(selectedOption!.textContent).toBe('Author B');
      });
    });

    it('handles non-string name values in attributions', async () => {
      vi.spyOn(cacheUtils, 'getCachedAttributions').mockReturnValue([
        { name: 'Valid Author' },
        { name: 123 },
        { name: { nested: 'object' } }
      ] as CachedAttribution[]);
      fetchAPISpy.mockResolvedValue({ data: [] });

      const el = mountSearch();

      await vi.waitFor(() => {
        const attributionSelect = el.querySelector('#search-attribution') as HTMLSelectElement;
        expect(attributionSelect.innerHTML).toContain('Valid Author');
        // Non-string names should be filtered out
        const options = attributionSelect.querySelectorAll('option');
        expect(options.length).toBe(2); // "All Submitters" + "Valid Author"
      });
    });
  });
});
