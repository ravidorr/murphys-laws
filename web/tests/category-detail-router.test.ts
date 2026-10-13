import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Browse } from '../src/views/browse.js';
import { CategoryDetail } from '../src/views/category-detail.js';
import { defineRoute, navigate, routes, startRouter } from '../src/router.js';
import * as api from '../src/utils/api.js';

vi.mock('@sentry/browser', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn()
}));

vi.mock('../src/utils/api.js', () => ({
  fetchAPI: vi.fn(),
  fetchLaws: vi.fn(),
  fetchCategories: vi.fn(),
  fetchTopVoted: vi.fn(),
  fetchTrending: vi.fn(),
  fetchRecentlyAdded: vi.fn()
}));

vi.mock('../src/utils/icons.js', () => ({
  hydrateIcons: vi.fn(),
  createIcon: vi.fn(() => document.createElement('span'))
}));

vi.mock('../src/utils/voting.js', () => ({
  addVotingListeners: vi.fn()
}));

vi.mock('../src/utils/law-card-renderer.js', () => ({
  renderLawCards: vi.fn((laws: { id: number; title?: string }[]) => laws
    .map(law => `<article class="law-card-mini" data-law-id="${law.id}">${law.title ?? 'Law'}</article>`)
    .join(''))
}));

vi.mock('../src/modules/structured-data.js', () => ({
  setJsonLd: vi.fn(),
  setCategoryItemListSchema: vi.fn()
}));

vi.mock('../src/utils/search-info.js', () => ({
  hasActiveFilters: vi.fn((filters: { q?: string; category_id?: string | number; attribution?: string }) =>
    Boolean(filters.q || filters.category_id || filters.attribution)),
  updateSearchInfo: vi.fn()
}));

vi.mock('../src/components/breadcrumb.js', () => ({
  Breadcrumb: vi.fn(() => document.createElement('nav'))
}));

vi.mock('../src/utils/export-context.js', () => ({
  setExportContent: vi.fn(),
  clearExportContent: vi.fn(),
  ContentType: { LAWS: 'laws' }
}));

describe('Category Detail router integration', () => {
  const categories = [
    { id: 1, slug: 'technology', title: 'Technology', description: 'Technology laws.' },
    { id: 2, slug: 'work', title: 'Work', description: 'Work laws.' }
  ];
  const track = vi.fn();

  beforeEach(() => {
    Object.keys(routes).forEach(route => delete routes[route]);
    document.body.innerHTML = '';
    localStorage.clear();
    history.replaceState(null, '', '/category/technology');
    window.scrollTo = () => {};
    window.pendo = { track };

    vi.mocked(api.fetchAPI).mockImplementation((endpoint: string) => {
      if (endpoint === '/api/v1/categories') return Promise.resolve({ data: categories });
      return Promise.resolve({ data: [] });
    });
    vi.mocked(api.fetchCategories).mockResolvedValue({ data: categories });
    vi.mocked(api.fetchLaws).mockResolvedValue({
      data: [{ id: 1, title: 'Result law', text: 'A result.' }],
      total: 1,
      limit: 25,
      offset: 0
    });
    vi.mocked(api.fetchTopVoted).mockResolvedValue({ data: [], total: 0, limit: 3, offset: 0 });
    vi.mocked(api.fetchTrending).mockResolvedValue({ data: [], total: 0, limit: 3, offset: 0 });
    vi.mocked(api.fetchRecentlyAdded).mockResolvedValue({ data: [], total: 0, limit: 3, offset: 0 });
  });

  afterEach(() => {
    delete window.pendo;
    vi.restoreAllMocks();
  });

  it('renders Browse and tracks a filtered cross-category search', async () => {
    const response = {
      data: [{ id: 1, title: 'Result law', text: 'A result.' }],
      total: 1,
      limit: 25,
      offset: 0
    };
    let resolveCategoryLoad!: (value: typeof response) => void;
    const categoryLoad = new Promise<typeof response>(resolve => {
      resolveCategoryLoad = resolve;
    });
    vi.mocked(api.fetchLaws)
      .mockImplementationOnce(() => categoryLoad)
      .mockResolvedValueOnce(response);

    const root = document.createElement('div');
    document.body.appendChild(root);
    const onNavigate = (page: string, param?: string) => navigate(page, param);
    defineRoute('category', ({ param }) => CategoryDetail({ categoryId: param!, onNavigate }));
    defineRoute('browse', () => Browse({ onNavigate }));
    startRouter(root);

    await vi.waitFor(() => {
      expect((root.querySelector('#search-category') as HTMLSelectElement).options.length).toBeGreaterThan(2);
    });

    (root.querySelector('#search-keyword') as HTMLInputElement).value = 'Computer';
    (root.querySelector('#search-attribution') as HTMLInputElement).value = 'Ada';
    const categorySelect = root.querySelector('#search-category') as HTMLSelectElement;
    categorySelect.value = '2';
    categorySelect.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      expect(root.querySelector('#browse-laws-list .law-card-mini')).toBeTruthy();
      expect(api.fetchLaws).toHaveBeenLastCalledWith(expect.objectContaining({
        category_id: 2,
        q: 'Computer',
        attribution: 'Ada'
      }));
      expect(track).toHaveBeenCalledWith('search_performed', {
        query_length: 8,
        query_token_count: 1,
        category_id: '2',
        attribution: 'Ada',
        sort: 'relevance',
        search_surface: 'category_detail',
        order: 'desc',
        results_count: 1
      });
    });

    expect(track.mock.calls.filter(([eventName]) => eventName === 'search_performed')).toHaveLength(1);
    resolveCategoryLoad(response);
    await new Promise(resolve => setTimeout(resolve, 0));

    const searchParams = new URLSearchParams(location.search);
    expect(location.pathname).toBe('/browse');
    expect(searchParams.get('category_id')).toBe('2');
    expect(searchParams.get('q')).toBe('Computer');
    expect(searchParams.get('attribution')).toBe('Ada');
    expect(track.mock.calls.filter(([eventName]) => eventName === 'search_performed')).toHaveLength(1);
    root.remove();
  });
});
