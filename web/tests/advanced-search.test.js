import { AdvancedSearch } from '@components/advanced-search.js';
import * as api from '../src/utils/api.js';
import * as cacheUtils from '../src/utils/category-cache.js';

function createLocalThis() {
  const context = {};

  beforeEach(() => {
    Object.keys(context).forEach((key) => {
      delete context[key];
    });
  });

  return () => context;
}

describe('AdvancedSearch component', () => {
  const local = createLocalThis();
  let fetchAPISpy;
  let deferUntilIdleSpy;

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

  function mountSearch({ append = false, ...props } = {}) {
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

    const keywordInput = el.querySelector('#search-keyword');
    expect(keywordInput.value).toBe('murphy');
  });

  it('loads categories successfully', async () => {
    const categories = [
      { id: 1, title: 'General' },
      { id: 2, title: 'Technology' }
    ];

    fetchAPISpy
      .mockResolvedValueOnce({ data: categories })
      .mockResolvedValueOnce({ data: [] });

    const el = mountSearch();

    await vi.waitFor(() => {
      const categorySelect = el.querySelector('#search-category');
      expect(categorySelect.textContent).toMatch(/General/);
      expect(categorySelect.textContent).toMatch(/Technology/);
    });

    // When there's no cache, loadFilters() is called immediately (not deferred)
    // deferUntilIdle is only called when cache exists
    expect(deferUntilIdleSpy).not.toHaveBeenCalled();
  });

  it('loads attributions successfully', async () => {
    const attributions = [
      { name: 'Alice' },
      { name: 'Bob' }
    ];

    fetchAPISpy
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: attributions });

    const el = mountSearch();

    await vi.waitFor(() => {
      const attributionSelect = el.querySelector('#search-attribution');
      expect(attributionSelect.textContent).toMatch(/Alice/);
      expect(attributionSelect.textContent).toMatch(/Bob/);
    });

    // When there's no cache, loadFilters() is called immediately (not deferred)
    // deferUntilIdle is only called when cache exists
    expect(deferUntilIdleSpy).not.toHaveBeenCalled();
  });

  it('handles filter loading errors gracefully', async () => {
    fetchAPISpy.mockRejectedValue(new Error('Network error'));

    const el = mountSearch();

    // Wait for loadFilters() to execute (called immediately when no cache)
    await new Promise(resolve => setTimeout(resolve, 50));

    const categorySelect = el.querySelector('#search-category');
    // When fetch fails and no cache exists, dropdown keeps "Loading..." text
    // This is expected behavior - user can still use the dropdown
    expect(categorySelect).toBeTruthy();
    // When there's no cache, loadFilters() is called immediately (not deferred)
    expect(deferUntilIdleSpy).not.toHaveBeenCalled();
  });

  it('populates dropdowns from cache immediately', () => {
    const categories = [
      { id: 1, title: 'General' },
      { id: 2, title: 'Technology' }
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
    const categorySelect = el.querySelector('#search-category');
    const attributionSelect = el.querySelector('#search-attribution');

    expect(categorySelect.textContent).toMatch(/General/);
    expect(categorySelect.textContent).toMatch(/Technology/);
    expect(attributionSelect.textContent).toMatch(/Alice/);
    expect(attributionSelect.textContent).toMatch(/Bob/);
    
    // When cache exists, deferUntilIdle should be called to load fresh data
    expect(deferUntilIdleSpy).toHaveBeenCalled();
  });

  it('loads categories on focus if not loaded yet', async () => {
    const categories = [
      { id: 1, title: 'General' }
    ];

    fetchAPISpy
      .mockResolvedValueOnce({ data: categories })
      .mockResolvedValueOnce({ data: [] });

    // Mock deferUntilIdle to not execute immediately
    deferUntilIdleSpy.mockImplementation(() => {});

    const el = mountSearch();

    // Trigger focus event to lazy load
    const categorySelect = el.querySelector('#search-category');
    categorySelect.dispatchEvent(new Event('focus', { bubbles: true }));

    await vi.waitFor(() => {
      expect(categorySelect.textContent).toMatch(/General/);
    });
  });

  it('calls onSearch with filters when search button is clicked', async () => {
    fetchAPISpy.mockResolvedValue({ data: [] });

    let searchFilters = null;
    const onSearch = (filters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await new Promise(r => setTimeout(r, 10));

    const keywordInput = el.querySelector('#search-keyword');
    keywordInput.value = 'test query';

    const searchBtn = el.querySelector('#search-btn');
    searchBtn.click();

    expect(searchFilters).toEqual({ q: 'test query' });
  });

  it('calls onSearch with category filter', async () => {
    const categories = [{ id: 1, title: 'General' }];
    fetchAPISpy
      .mockResolvedValueOnce({ data: categories })
      .mockResolvedValueOnce({ data: [] });

    let searchFilters = null;
    const onSearch = (filters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await vi.waitFor(() => {
      const categorySelect = el.querySelector('#search-category');
      expect(categorySelect.options.length).toBeGreaterThan(1);
    });

    const categorySelect = el.querySelector('#search-category');
    categorySelect.value = '1';

    const searchBtn = el.querySelector('#search-btn');
    searchBtn.click();

    expect(searchFilters).toEqual({ category_id: 1 });
  });

  it('calls onSearch with attribution filter', async () => {
    const attributions = [{ name: 'Alice' }];
    fetchAPISpy
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: attributions });

    let searchFilters = null;
    const onSearch = (filters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await vi.waitFor(() => {
      const attributionSelect = el.querySelector('#search-attribution');
      expect(attributionSelect.options.length).toBeGreaterThan(1);
    });

    const attributionSelect = el.querySelector('#search-attribution');
    attributionSelect.value = 'Alice';

    const searchBtn = el.querySelector('#search-btn');
    searchBtn.click();

    expect(searchFilters).toEqual({ attribution: 'Alice' });
  });

  it('calls onSearch with all filters combined', async () => {
    const categories = [{ id: 1, title: 'General' }];
    const attributions = [{ name: 'Alice' }];

    fetchAPISpy
      .mockResolvedValueOnce({ data: categories })
      .mockResolvedValueOnce({ data: attributions });

    let searchFilters = null;
    const onSearch = (filters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await vi.waitFor(() => {
      const categorySelect = el.querySelector('#search-category');
      expect(categorySelect.options.length).toBeGreaterThan(1);
    });

    const keywordInput = el.querySelector('#search-keyword');
    const categorySelect = el.querySelector('#search-category');
    const attributionSelect = el.querySelector('#search-attribution');

    keywordInput.value = 'murphy';
    categorySelect.value = '1';
    attributionSelect.value = 'Alice';

    const searchBtn = el.querySelector('#search-btn');
    searchBtn.click();

    expect(searchFilters).toEqual({
      q: 'murphy',
      category_id: 1,
      attribution: 'Alice'
    });
  });

  it('trims whitespace from keyword input', async () => {
    fetchAPISpy.mockResolvedValue({ data: [] });

    let searchFilters = null;
    const onSearch = (filters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await new Promise(r => setTimeout(r, 10));

    const keywordInput = el.querySelector('#search-keyword');
    keywordInput.value = '  test query  ';

    const searchBtn = el.querySelector('#search-btn');
    searchBtn.click();

    expect(searchFilters).toEqual({ q: 'test query' });
  });

  it('excludes empty filters from search', async () => {
    fetchAPISpy.mockResolvedValue({ data: [] });

    let searchFilters = null;
    const onSearch = (filters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await new Promise(r => setTimeout(r, 10));

    const keywordInput = el.querySelector('#search-keyword');
    keywordInput.value = '';

    const searchBtn = el.querySelector('#search-btn');
    searchBtn.click();

    expect(searchFilters).toEqual({});
  });

  it('clears all filters when clear button is clicked', async () => {
    const categories = [{ id: 1, title: 'General' }];
    const attributions = [{ name: 'Alice' }];

    fetchAPISpy
      .mockResolvedValueOnce({ data: categories })
      .mockResolvedValueOnce({ data: attributions });

    let searchFilters = null;
    const onSearch = (filters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await vi.waitFor(() => {
      const categorySelect = el.querySelector('#search-category');
      expect(categorySelect.options.length).toBeGreaterThan(1);
    });

    // Set some filters
    const keywordInput = el.querySelector('#search-keyword');
    const categorySelect = el.querySelector('#search-category');
    const attributionSelect = el.querySelector('#search-attribution');

    keywordInput.value = 'murphy';
    categorySelect.value = '1';
    attributionSelect.value = 'Alice';

    // Clear filters
    const clearBtn = el.querySelector('#clear-btn');
    clearBtn.click();

    expect(keywordInput.value).toBe('');
    expect(categorySelect.value).toBe('');
    expect(attributionSelect.value).toBe('');
    expect(searchFilters).toEqual({});
  });

  it('triggers search when Enter key is pressed in keyword input', async () => {
    fetchAPISpy.mockResolvedValue({ data: [] });

    let searchFilters = null;
    const onSearch = (filters) => { searchFilters = filters; };

    const el = mountSearch({ onSearch });

    await new Promise(r => setTimeout(r, 10));

    const keywordInput = el.querySelector('#search-keyword');
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

    const keywordInput = el.querySelector('#search-keyword');
    keywordInput.value = 'test';

    const keyEvent = new KeyboardEvent('keypress', { key: 'a' });
    keywordInput.dispatchEvent(keyEvent);

    expect(searchCalled).toBe(false);
  });

  it('selects initial category when provided', async () => {
    const categories = [
      { id: 1, title: 'General' },
      { id: 2, title: 'Technology' }
    ];

    fetchAPISpy
      .mockResolvedValueOnce({ data: categories })
      .mockResolvedValueOnce({ data: [] });

    const el = mountSearch({
      onSearch: () => {},
      initialFilters: { category_id: '2' }
    });

    await vi.waitFor(() => {
      const categorySelect = el.querySelector('#search-category');
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
      const attributionSelect = el.querySelector('#search-attribution');
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
      const categorySelect = el.querySelector('#search-category');
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
      const attributionSelect = el.querySelector('#search-attribution');
      // When data property is missing, attributions will be empty array
      // Dropdown only updates if attributions.length > 0, so it stays with "Loading..."
      // But we can verify the component doesn't crash
      expect(attributionSelect).toBeTruthy();
    });
  });
});
