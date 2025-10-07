import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdvancedSearch } from '@components/advanced-search.js';
import * as api from '../src/utils/api.js';

describe('AdvancedSearch component', () => {
  let fetchAPISpy;

  beforeEach(() => {
    fetchAPISpy = vi.spyOn(api, 'fetchAPI');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with initial empty filters', () => {
    fetchAPISpy.mockResolvedValue({ data: [] });

    const el = AdvancedSearch({ onSearch: () => {} });

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

    const el = AdvancedSearch({ onSearch: () => {}, initialFilters });

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

    const el = AdvancedSearch({ onSearch: () => {} });

    await vi.waitFor(() => {
      const categorySelect = el.querySelector('#search-category');
      expect(categorySelect.textContent).toMatch(/General/);
      expect(categorySelect.textContent).toMatch(/Technology/);
    });
  });

  it('loads attributions successfully', async () => {
    const attributions = [
      { name: 'Alice' },
      { name: 'Bob' }
    ];

    fetchAPISpy
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: attributions });

    const el = AdvancedSearch({ onSearch: () => {} });

    await vi.waitFor(() => {
      const attributionSelect = el.querySelector('#search-attribution');
      expect(attributionSelect.textContent).toMatch(/Alice/);
      expect(attributionSelect.textContent).toMatch(/Bob/);
    });
  });

  it('handles filter loading errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchAPISpy.mockRejectedValue(new Error('Network error'));

    const el = AdvancedSearch({ onSearch: () => {} });

    await vi.waitFor(() => {
      const categorySelect = el.querySelector('#search-category');
      expect(categorySelect.textContent).toMatch(/Error loading categories/);
    });

    expect(consoleSpy).toHaveBeenCalledWith('Failed to load filters:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('calls onSearch with filters when search button is clicked', async () => {
    fetchAPISpy.mockResolvedValue({ data: [] });

    let searchFilters = null;
    const onSearch = (filters) => { searchFilters = filters; };

    const el = AdvancedSearch({ onSearch });

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

    const el = AdvancedSearch({ onSearch });

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

    const el = AdvancedSearch({ onSearch });

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

    const el = AdvancedSearch({ onSearch });

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

    const el = AdvancedSearch({ onSearch });

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

    const el = AdvancedSearch({ onSearch });

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

    const el = AdvancedSearch({ onSearch });

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

    const el = AdvancedSearch({ onSearch });

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

    const el = AdvancedSearch({ onSearch });

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

    const el = AdvancedSearch({
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

    const el = AdvancedSearch({
      onSearch: () => {},
      initialFilters: { attribution: 'Bob' }
    });

    await vi.waitFor(() => {
      const attributionSelect = el.querySelector('#search-attribution');
      expect(attributionSelect.value).toBe('Bob');
    });
  });
});
