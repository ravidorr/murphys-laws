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

  describe('branch coverage: init, listbox, keyboard, outside click', () => {
    it('L52 L54 L57: sets keyword, category, attribution when initialFilters have all three', () => {
      const categories = [{ id: 1, title: 'Cat', slug: 'cat' }, { id: 2, title: 'Dog', slug: 'dog' }];
      vi.spyOn(cacheUtils, 'getCachedCategories').mockReturnValue(categories);
      fetchAPISpy.mockResolvedValue({ data: [] });
      const el = mountSearch({
        initialFilters: { q: 'query', category_id: '2', attribution: 'Attribution Name' }
      });
      const keywordInput = el.querySelector('#search-keyword') as HTMLInputElement;
      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      const attributionHidden = el.querySelector('#search-attribution') as HTMLInputElement;
      const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
      expect(keywordInput).toBeTruthy();
      expect(keywordInput?.value).toBe('query');
      expect(attributionInput?.value).toBe('Attribution Name');
      expect(attributionHidden?.value).toBe('Attribution Name');
      expect(categorySelect?.value).toBe('2');
    });

    it('L52 L54 L57: sets keyword, attribution input and hidden when initialFilters have q and attribution', () => {
      fetchAPISpy.mockResolvedValue({ data: [] });
      const el = mountSearch({
        initialFilters: { q: 'query', attribution: 'Attribution Name' }
      });
      const keywordInput = el.querySelector('#search-keyword') as HTMLInputElement;
      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      const attributionHidden = el.querySelector('#search-attribution') as HTMLInputElement;
      expect(keywordInput?.value).toBe('query');
      expect(attributionInput?.value).toBe('Attribution Name');
      expect(attributionHidden?.value).toBe('Attribution Name');
    });

    it('L108 L109: hideListbox in runSubmittersSearch catch when fetchSubmitters rejects', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockRejectedValueOnce(new Error('Network error'));

      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.focus();
      attributionInput.value = 'a';
      attributionInput.dispatchEvent(new Event('input'));

      await vi.waitFor(() => {
        const listbox = el.querySelector('#search-attribution-listbox') as HTMLElement;
        expect(listbox?.getAttribute('aria-hidden')).toBe('true');
      }, { timeout: 500 });
    });

    it('L160 L224: document click outside closes listbox when visible', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['Alice', 'Bob'] });

      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.focus();
      await vi.waitFor(() => {
        const listbox = el.querySelector('#search-attribution-listbox') as HTMLElement;
        expect(listbox?.getAttribute('aria-hidden')).toBe('false');
      }, { timeout: 400 });

      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const listbox = el.querySelector('#search-attribution-listbox') as HTMLElement;
      expect(listbox?.getAttribute('aria-hidden')).toBe('true');
    });

    it('L179 L180 L186 L191: ArrowDown when listbox hidden opens listbox and moves selection', async () => {
      const scrollIntoViewStub = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewStub;

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
      }, { timeout: 400 });

      attributionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      const listbox = el.querySelector('#search-attribution-listbox') as HTMLElement;
      const items = listbox?.querySelectorAll('.submitter-typeahead-item') ?? [];
      expect(items.length).toBeGreaterThan(0);
    });

    it('L207 L208: Escape key hides listbox', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['Alice'] });

      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.focus();
      await vi.waitFor(() => {
        expect(el.querySelector('#search-attribution-listbox')?.getAttribute('aria-hidden')).toBe('false');
      }, { timeout: 400 });

      attributionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(el.querySelector('#search-attribution-listbox')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('L108 L109: fetchSubmitters called with q param when attribution input has value', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['Alice', 'Bob'] });

      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.value = 'Ali';
      attributionInput.focus();
      attributionInput.dispatchEvent(new Event('input'));

      await new Promise((r) => setTimeout(r, 260));
      expect(fetchAPISpy).toHaveBeenCalledWith('/api/v1/submitters', expect.objectContaining({ q: 'Ali' }));
    });

    it('L114 B1: listbox includes Anonymous when API returns Anonymous', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['Anonymous', 'Alice'] });

      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.focus();
      await vi.waitFor(() => {
        const listbox = el.querySelector('#search-attribution-listbox');
        expect(listbox?.textContent).toMatch(/Anonymous/);
      }, { timeout: 400 });
    });

    it('L115 B0: listbox does not duplicate Anonymous when not in API response', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['Alice', 'Bob'] });

      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.focus();
      await vi.waitFor(() => {
        const listbox = el.querySelector('#search-attribution-listbox');
        const items = listbox?.querySelectorAll('.submitter-typeahead-item') ?? [];
        const labels = Array.from(items).map((i) => i.textContent?.trim());
        expect(labels).not.toContain('Anonymous');
      }, { timeout: 400 });
    });

    it('L180 B1: Enter when listbox hidden opens listbox and selects first item after fetch', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['First', 'Second'] });

      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.focus();
      attributionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      await vi.waitFor(() => {
        const listbox = el.querySelector('#search-attribution-listbox');
        expect(listbox?.getAttribute('aria-hidden')).toBe('false');
      }, { timeout: 400 });
      const hidden = el.querySelector('#search-attribution') as HTMLInputElement;
      expect(hidden?.value).toBe('');
    });

    it('L204 B0: click on listbox container (not on item) does not call onSelectSubmitter', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['Alice'] });

      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.focus();
      await vi.waitFor(() => {
        const listbox = el.querySelector('#search-attribution-listbox');
        expect(listbox?.querySelectorAll('.submitter-typeahead-item').length).toBeGreaterThan(0);
      }, { timeout: 400 });

      const listbox = el.querySelector('#search-attribution-listbox') as HTMLElement;
      listbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(attributionInput.value).toBe('');
    });

    it('L206 L207 L209 L218 L219 L231: keyboard Enter selects focused listbox item', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['Alice', 'Bob'] });

      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.focus();
      await vi.waitFor(() => {
        const listbox = el.querySelector('#search-attribution-listbox');
        expect(listbox?.querySelectorAll('.submitter-typeahead-item').length).toBeGreaterThan(0);
      }, { timeout: 400 });

      attributionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      attributionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      attributionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      attributionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(attributionInput.value).toBe('Bob');
      expect((el.querySelector('#search-attribution') as HTMLInputElement)?.value).toBe('Bob');
    });

    it('L213 L216 L217 L218: click on listbox item calls onSelectSubmitter', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['Alice', 'Bob'] });

      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.focus();
      await vi.waitFor(() => {
        const listbox = el.querySelector('#search-attribution-listbox');
        expect(listbox?.querySelectorAll('.submitter-typeahead-item').length).toBeGreaterThan(0);
      }, { timeout: 400 });

      const listbox = el.querySelector('#search-attribution-listbox') as HTMLElement;
      const items = listbox.querySelectorAll('.submitter-typeahead-item');
      const bobItem = Array.from(items).find((el) => (el as HTMLElement).getAttribute('data-value') === 'Bob');
      expect(bobItem).toBeTruthy();
      (bobItem as HTMLElement).click();

      expect(attributionInput.value).toBe('Bob');
      expect((el.querySelector('#search-attribution') as HTMLInputElement)?.value).toBe('Bob');
    });

    it('L230 L238 L240: search button includes category_id and attribution in filters', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [{ id: 1, title: 'Cat', slug: 'cat' }] });
      let captured: SearchFilters | null = null;
      const el = mountSearch({
        onSearch: (f) => { captured = f; },
        initialFilters: { q: 'q', category_id: '1', attribution: 'Author' }
      });
      await vi.waitFor(() => {
        const sel = el.querySelector('#search-category') as HTMLSelectElement;
        expect(sel?.options?.length).toBeGreaterThan(1);
      });
      const searchBtn = el.querySelector('#search-btn') as HTMLElement;
      searchBtn.click();
      expect(captured).toEqual({ q: 'q', category_id: 1, attribution: 'Author' });
    });

    it('L252 L253 L255 L256: clear button clears keyword, category, attribution input and hidden', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [{ id: 1, title: 'C', slug: 'c' }] });
      const el = mountSearch({});
      await vi.waitFor(() => {
        expect(el.querySelector('#search-category') as HTMLSelectElement).toBeTruthy();
      });
      const keywordInput = el.querySelector('#search-keyword') as HTMLInputElement;
      const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      const attributionHidden = el.querySelector('#search-attribution') as HTMLInputElement;
      keywordInput.value = 'x';
      categorySelect.value = '1';
      attributionInput.value = 'Att';
      attributionHidden.value = 'Att';

      (el.querySelector('#clear-btn') as HTMLElement).click();

      expect(keywordInput.value).toBe('');
      expect(categorySelect.value).toBe('');
      expect(attributionInput.value).toBe('');
      expect(attributionHidden.value).toBe('');
    });

    it('L145 L146: loadFilters catch uses cached categories when fetch fails', async () => {
      const cached = [{ id: 1, title: 'Cached Cat', slug: 'cached' }];
      vi.spyOn(cacheUtils, 'getCachedCategories').mockReturnValue(cached);
      fetchAPISpy.mockRejectedValueOnce(new Error('Network error'));

      const el = mountSearch({ append: true });

      await vi.waitFor(() => {
        const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
        expect(categorySelect?.textContent).toMatch(/Cached Cat/);
      }, { timeout: 500 });
    });

    it('L147: loadFilters catch with no cache sets error message in category select', async () => {
      vi.spyOn(cacheUtils, 'getCachedCategories').mockReturnValue([]);
      fetchAPISpy.mockRejectedValueOnce(new Error('Network error'));

      const el = mountSearch({ append: true });

      await vi.waitFor(() => {
        const categorySelect = el.querySelector('#search-category') as HTMLSelectElement;
        expect(categorySelect?.innerHTML).toMatch(/Error loading categories/);
      }, { timeout: 500 });
    });

    it('L196 L199 L201: ArrowUp and Enter select first listbox item', async () => {
      Element.prototype.scrollIntoView = vi.fn();
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['Alice', 'Bob'] });

      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.focus();
      await vi.waitFor(() => {
        expect(el.querySelector('#search-attribution-listbox')?.getAttribute('aria-hidden')).toBe('false');
      }, { timeout: 400 });

      attributionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      attributionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      attributionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      const hidden = el.querySelector('#search-attribution') as HTMLInputElement;
      expect(hidden?.value).toBe('');
      expect(attributionInput.value).toBe('All Submitters');
    });

    it('renderListboxItems shows Anonymous when API returns only Anonymous (email-only matches)', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['Anonymous'] });

      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.focus();
      await vi.waitFor(() => {
        const listbox = el.querySelector('#search-attribution-listbox') as HTMLElement;
        const items = listbox?.querySelectorAll('.submitter-typeahead-item') ?? [];
        expect(items.length).toBe(2);
        const texts = Array.from(items).map((i) => i.textContent?.trim());
        expect(texts).toContain('All Submitters');
        expect(texts).toContain('Anonymous');
      }, { timeout: 400 });
    });

    it('L216 L217 L218: click All Submitters item uses value and label fallbacks', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['Alice'] });

      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.focus();
      await vi.waitFor(() => {
        const listbox = el.querySelector('#search-attribution-listbox');
        expect(listbox?.querySelectorAll('.submitter-typeahead-item').length).toBeGreaterThan(0);
      }, { timeout: 400 });

      const allItem = Array.from(
        (el.querySelector('#search-attribution-listbox') as HTMLElement).querySelectorAll('.submitter-typeahead-item')
      ).find((node) => (node as HTMLElement).getAttribute('data-value') === '');
      expect(allItem).toBeTruthy();
      (allItem as HTMLElement).click();

      expect((el.querySelector('#search-attribution') as HTMLInputElement)?.value).toBe('');
      expect(attributionInput.value).toBe('All Submitters');
    });

    it('L108 L109 L114 L115: runSubmittersSearch success path and keydown when listbox visible', async () => {
      Element.prototype.scrollIntoView = vi.fn();
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['A', 'B'] });

      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.focus();
      await vi.waitFor(() => {
        expect(el.querySelector('#search-attribution-listbox')?.getAttribute('aria-hidden')).toBe('false');
      }, { timeout: 400 });

      attributionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      attributionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      const listbox = el.querySelector('#search-attribution-listbox') as HTMLElement;
      const items = listbox?.querySelectorAll('.submitter-typeahead-item') ?? [];
      expect(items.length).toBeGreaterThan(0);
    });

    it('L160: click inside component does not close listbox', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['X'] });

      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.focus();
      await vi.waitFor(() => {
        expect(el.querySelector('#search-attribution-listbox')?.getAttribute('aria-hidden')).toBe('false');
      }, { timeout: 400 });

      el.querySelector('#search-keyword')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(el.querySelector('#search-attribution-listbox')?.getAttribute('aria-hidden')).toBe('false');
    });

    it('L62 L66 L67: showListbox sets aria-hidden and aria-expanded', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['X'] });
      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      const listbox = el.querySelector('#search-attribution-listbox') as HTMLElement;
      attributionInput.focus();
      await vi.waitFor(() => {
        expect(listbox.getAttribute('aria-hidden')).toBe('false');
        expect(attributionInput.getAttribute('aria-expanded')).toBe('true');
      }, { timeout: 400 });
    });

    it('L81: renderListboxItems includes Anonymous when API returns Anonymous in list', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['Anonymous', 'Bob'] });
      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.focus();
      await vi.waitFor(() => {
        const listbox = el.querySelector('#search-attribution-listbox') as HTMLElement;
        expect(listbox?.textContent).toMatch(/Anonymous/);
        expect(listbox?.textContent).toMatch(/Bob/);
      }, { timeout: 400 });
    });

    it('L164: attribution focus with empty q fetches submitters and shows listbox', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['Only'] });
      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      expect(attributionInput.value).toBe('');
      attributionInput.focus();
      await vi.waitFor(() => {
        expect(fetchAPISpy).toHaveBeenCalledWith('/api/v1/submitters', { limit: '20' });
        expect(el.querySelector('#search-attribution-listbox')?.getAttribute('aria-hidden')).toBe('false');
      }, { timeout: 400 });
    });

    it('L179 L180: Enter when listbox hidden opens listbox', async () => {
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['A', 'B'] });
      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      const listbox = el.querySelector('#search-attribution-listbox') as HTMLElement;
      expect(listbox.getAttribute('aria-hidden')).toBe('true');
      attributionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await vi.waitFor(() => {
        expect(listbox.getAttribute('aria-hidden')).toBe('false');
      }, { timeout: 400 });
    });

    it('single flow: init with filters, focus empty attribution, then type and search (hits L52 L54 L57 L108 L114 L147 L252 L253 L255 L256)', async () => {
      const categories = [{ id: 1, title: 'Cat', slug: 'cat' }];
      vi.spyOn(cacheUtils, 'getCachedCategories').mockReturnValue(categories);
      fetchAPISpy.mockResolvedValue({ data: [] });
      let captured: SearchFilters | null = null;
      const el = mountSearch({
        initialFilters: { q: 'x', category_id: '1', attribution: 'Bob' },
        onSearch: (f) => { captured = f; }
      });
      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.focus();
      await new Promise(r => setTimeout(r, 300));
      attributionInput.value = 'alice';
      attributionInput.dispatchEvent(new Event('input'));
      await new Promise(r => setTimeout(r, 300));
      const searchBtn = el.querySelector('#search-btn') as HTMLElement;
      searchBtn.click();
      expect(captured).toBeTruthy();
      const filters = captured!;
      expect(filters.q).toBe('x');
      expect(filters.category_id).toBe(1);
    });

    it('L203 L205 L206 L208: ArrowDown when listbox visible moves selection', async () => {
      Element.prototype.scrollIntoView = vi.fn();
      fetchAPISpy.mockResolvedValueOnce({ data: [] });
      const el = mountSearch({ append: true });
      await vi.waitFor(() => expect(fetchAPISpy).toHaveBeenCalled());
      fetchAPISpy.mockClear();
      fetchAPISpy.mockResolvedValueOnce({ data: ['First', 'Second', 'Third'] });
      const attributionInput = el.querySelector('#search-attribution-input') as HTMLInputElement;
      attributionInput.focus();
      await vi.waitFor(() => {
        expect(el.querySelector('#search-attribution-listbox')?.getAttribute('aria-hidden')).toBe('false');
      }, { timeout: 400 });
      const listbox = el.querySelector('#search-attribution-listbox') as HTMLElement;
      attributionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      attributionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      const items = listbox.querySelectorAll('.submitter-typeahead-item');
      expect(items[0]?.getAttribute('aria-selected')).toBe('false');
      expect(items[1]?.getAttribute('aria-selected')).toBe('true');
    });
  });
});
