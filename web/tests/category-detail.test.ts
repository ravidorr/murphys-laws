import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { OnNavigate } from '../src/types/app.d.ts';
import { CategoryDetail } from '../src/views/category-detail.js';
import * as api from '../src/utils/api.js';
import * as structuredData from '../src/modules/structured-data.js';
import type { CleanableElement } from '../src/types/app.js';

// Mock Sentry
vi.mock('@sentry/browser', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn()
}));

import * as Sentry from '@sentry/browser';

// Mock dependencies
vi.mock('../src/utils/api.js', () => ({
  fetchLaws: vi.fn(),
  fetchCategories: vi.fn(),
  fetchAPI: vi.fn()
}));
vi.mock('../src/utils/law-card-renderer.js', () => ({
  renderLawCards: vi.fn((laws: { title?: string }[]) => laws.map((l: { title?: string }) => `<div>${l.title}</div>`).join(''))
}));
vi.mock('../src/modules/structured-data.js');
vi.mock('../src/utils/icons.js', () => ({
  hydrateIcons: vi.fn(),
  createIcon: vi.fn(() => document.createElement('span'))
}));
vi.mock('../src/components/notification.js', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn()
}));
vi.mock('../src/utils/constants.js', () => ({
  SITE_URL: 'https://murphys-laws.com',
  SITE_NAME: "Murphy's Law Archive",
  LAWS_PER_PAGE: 10,
  getRandomLoadingMessage: () => 'Loading...',
  getCategoryDisplayName: (_slug: string, apiTitle: string) => apiTitle
}));
vi.mock('../src/utils/voting.js', () => ({
  addVotingListeners: vi.fn()
}));
vi.mock('../src/utils/search-info.js', () => ({
  updateSearchInfo: vi.fn()
}));
interface AdvancedSearchMockState {
  onSearch?: (filters: Record<string, unknown>) => void;
  initialFilters?: Record<string, unknown>;
}
vi.mock('../src/components/advanced-search.js', () => {
  const localThis: AdvancedSearchMockState = {};
  return {
    AdvancedSearch: vi.fn(({ initialFilters, onSearch }: { initialFilters: Record<string, unknown>; onSearch: (filters: Record<string, unknown>) => void }) => {
      localThis.onSearch = onSearch;
      localThis.initialFilters = initialFilters;
      const el = document.createElement('section');
      el.className = 'section section-card mb-12';
      el.innerHTML = '<div class="test-advanced-search">Advanced Search Mock</div>';
      return el;
    }),
    getLocalThis: (): AdvancedSearchMockState => localThis
  };
});
vi.mock('../src/utils/export-context.js', () => ({
  setExportContent: vi.fn(),
  clearExportContent: vi.fn(),
  ContentType: { LAWS: 'laws' }
}));

describe('CategoryDetail view', () => {
  let onNavigate: Mock<OnNavigate>;
  const categoryId = '1';

  beforeEach(() => {
    onNavigate = vi.fn<OnNavigate>() as Mock<OnNavigate>;
    vi.clearAllMocks();
    
    vi.mocked(api.fetchLaws).mockResolvedValue({
      data: [
        { id: 101, title: 'Law 1', text: 'Text 1', score: 5 },
        { id: 102, title: 'Law 2', text: 'Text 2', score: 3 }
      ],
      total: 2,
      limit: 10,
      offset: 0
    });

    vi.mocked(api.fetchCategories).mockResolvedValue({
      data: [
        { id: 1, slug: 'technology', title: 'Technology', description: 'Tech truths: to err is human, to really foul things up requires a computer.' },
        { id: 2, slug: 'work', title: 'Work', description: undefined }
      ]
    });
  });

  it('L29 B1: parseCategoryParams uses page from URL when present', async () => {
    const orig = window.location;
    Object.defineProperty(window, 'location', { value: { ...orig, search: '?page=2', pathname: '/category/1' }, writable: true });
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(api.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({ offset: 10 }));
    Object.defineProperty(window, 'location', { value: orig, writable: true });
  });

  it('L39 B0: buildCategorySearch does not set page when page is 1', async () => {
    const origLocation = window.location;
    Object.defineProperty(window, 'location', { value: { ...origLocation, search: '', pathname: '/category/1' }, writable: true });
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(api.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
    Object.defineProperty(window, 'location', { value: origLocation, writable: true });
  });

  it('L49 B1: initialParams from location when location is defined', () => {
    expect(typeof location !== 'undefined').toBe(true);
    const el = CategoryDetail({ categoryId, onNavigate });
    expect(el.querySelector('#category-laws-list')).toBeTruthy();
  });

  it('L113 B1: loading placeholder text set when element exists', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    const loadingPlaceholder = el.querySelector('.loading-placeholder p');
    expect(loadingPlaceholder).toBeTruthy();
    expect(loadingPlaceholder!.textContent).toBe('Loading...');
  });

  it('L171 B1: loadPage uses categoryNumericId when set from fetchCategoryDetails', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(api.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({ category_id: 1 }));
  });

  it('L181 L182 B1: category found by slug when categoryId is non-numeric', async () => {
    vi.mocked(api.fetchCategories).mockResolvedValue({
      data: [{ id: 5, slug: 'tech', title: 'Tech', description: 'Desc' }]
    });
    const el = CategoryDetail({ categoryId: 'tech', onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(el.textContent).toContain('Tech');
    expect(api.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({ category_id: 5 }));
  });

  it('L197 B1: setExportContent called when laws loaded', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));
    const { setExportContent } = await import('../src/utils/export-context.js');
    expect(vi.mocked(setExportContent)).toHaveBeenCalled();
  });

  it('L253 B1: breadcrumb replaced when Breadcrumb returns element', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));
    const breadcrumbContainer = el.querySelector('#category-breadcrumb');
    expect(breadcrumbContainer).toBeTruthy();
    expect(breadcrumbContainer!.children.length).toBeGreaterThan(0);
  });

  it('L347 B1: setCategoryItemListSchema called when laws exist', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(structuredData.setCategoryItemListSchema).toHaveBeenCalled();
  });

  it('L369 L371 B1: sort select option selected when sortValue matches', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));
    const sortSelect = el.querySelector('#sort-select') as HTMLSelectElement;
    expect(sortSelect).toBeTruthy();
    expect(sortSelect.value).toBe('score-desc');
  });

  it('L376 L377 B1: sort and order from change event update state', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));
    const sortSelect = el.querySelector('#sort-select') as HTMLSelectElement;
    sortSelect.value = 'created_at-asc';
    sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(api.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({ sort: 'created_at', order: 'asc' }));
  });

  it('renders initial structure', () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    expect(el.querySelector('#category-laws-list')).toBeTruthy();
    expect(el.innerHTML).toContain('Loading...');
  });

  it('fetches category details and laws', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    // Wait for fetchCategoryDetails().then(() => loadPage(1))
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(api.fetchCategories).toHaveBeenCalled();
    expect(api.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({
      category_id: 1,
      limit: 10
    }));

    expect(el.textContent).toContain("Technology's Laws");
    expect(el.textContent).toContain('Law 1');
    expect(el.textContent).toContain('Law 2');
  });

  it('sets structured data with breadcrumbs', async () => {
    CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(structuredData.setJsonLd).toHaveBeenCalledWith('category-detail-breadcrumbs', expect.objectContaining({
      '@type': 'BreadcrumbList'
    }));
    expect(structuredData.setJsonLd).toHaveBeenCalledWith('category-detail-page', expect.objectContaining({
      '@type': 'CollectionPage',
      'name': expect.stringContaining('Technology Laws'),
      'description': 'Tech truths: to err is human, to really foul things up requires a computer.'
    }));
  });

  it('displays category description when available', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const descEl = el.querySelector('#category-description');
    expect(descEl).toBeTruthy();
    expect(descEl!.textContent).toBe('Tech truths: to err is human, to really foul things up requires a computer.');
  });

  it('displays fallback description when description is null', async () => {
    vi.mocked(api.fetchCategories).mockResolvedValue({
      data: [
        { id: 1, slug: 'technology', title: 'Technology', description: undefined },
        { id: 2, slug: 'work', title: 'Work', description: undefined }
      ]
    });

    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const descEl = el.querySelector('#category-description');
    expect(descEl).toBeTruthy();
    expect(descEl!.textContent).toBe('All laws within this category.');
  });

  it('renders category description inside category-laws-card before search info', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const lawsCard = el.querySelector('#category-laws-card');
    expect(lawsCard).toBeTruthy();
    const descEl = lawsCard!.querySelector('#category-description');
    const searchInfoEl = lawsCard!.querySelector('#category-search-info');
    expect(descEl).toBeTruthy();
    expect(searchInfoEl).toBeTruthy();
    const cardHeader = lawsCard!.querySelector('.card-header');
    expect(cardHeader).toBeTruthy();
    const nodes = Array.from(cardHeader!.childNodes).filter((n): n is Element => n.nodeType === Node.ELEMENT_NODE);
    const descIndex = nodes.indexOf(descEl as Element);
    const searchInfoIndex = nodes.indexOf(searchInfoEl as Element);
    expect(descIndex).toBeGreaterThanOrEqual(0);
    expect(searchInfoIndex).toBeGreaterThanOrEqual(0);
    expect(descIndex).toBeLessThan(searchInfoIndex);
  });

  it('renders empty state when no laws found', async () => {
    vi.mocked(api.fetchLaws).mockResolvedValue({ data: [], total: 0, limit: 10, offset: 0 });
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('No laws found');
  });

  it('handles API error', async () => {
    vi.mocked(api.fetchLaws).mockRejectedValue(new Error('Network error'));
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('Of course something went wrong');
  });

  it('handles pagination', async () => {
    vi.mocked(api.fetchLaws).mockResolvedValue({
      data: [],
      total: 20, // Enough for 2 pages
      limit: 10,
      offset: 0
    });
    
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const nextBtn = document.createElement('button');
    nextBtn.dataset.page = '2';
    
    // We need to append the button to 'el' so 'closest' works
    el.appendChild(nextBtn);
    
    nextBtn.dispatchEvent(new Event('click', { bubbles: true }));
    
    expect(api.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({
      offset: 10 // Page 2 offset
    }));
  });

  it('handles law card click navigation', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create a law card element
    const lawCard = document.createElement('div');
    lawCard.className = 'law-card-mini';
    lawCard.dataset.lawId = '123';
    el.appendChild(lawCard);
    
    lawCard.click();

    expect(onNavigate).toHaveBeenCalledWith('law', '123');
  });

  it('does not navigate when clicking buttons inside law card', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create a law card element with a button inside
    const lawCard = document.createElement('div');
    lawCard.className = 'law-card-mini';
    lawCard.dataset.lawId = '123';
    const button = document.createElement('button');
    button.setAttribute('data-action', 'favorite');
    lawCard.appendChild(button);
    el.appendChild(lawCard);
    
    // Reset the mock to clear any previous calls
    onNavigate.mockClear();

    // Click the button inside the card
    button.click();

    // Navigation should NOT be triggered when clicking buttons
    expect(onNavigate).not.toHaveBeenCalledWith('law', expect.anything());
  });

  it('handles law card keyboard navigation with Enter key (WCAG 2.1.1)', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create a law card element
    const lawCard = document.createElement('div');
    lawCard.className = 'law-card-mini';
    lawCard.dataset.lawId = '123';
    el.appendChild(lawCard);
    
    // Simulate Enter key press
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    lawCard.dispatchEvent(enterEvent);

    expect(onNavigate).toHaveBeenCalledWith('law', '123');
  });

  it('handles law card keyboard navigation with Space key (WCAG 2.1.1)', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create a law card element
    const lawCard = document.createElement('div');
    lawCard.className = 'law-card-mini';
    lawCard.dataset.lawId = '123';
    el.appendChild(lawCard);
    
    // Simulate Space key press
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    lawCard.dispatchEvent(spaceEvent);

    expect(onNavigate).toHaveBeenCalledWith('law', '123');
  });

  it('handles navigation button click', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const navBtn = document.createElement('button');
    navBtn.setAttribute('data-nav', 'submit');
    el.appendChild(navBtn);
    
    navBtn.click();

    expect(onNavigate).toHaveBeenCalledWith('submit');
  });

  it('ignores disabled pagination button', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));
    
    vi.mocked(api.fetchLaws).mockClear();

    const disabledBtn = document.createElement('button');
    disabledBtn.dataset.page = '2';
    disabledBtn.setAttribute('disabled', 'true');
    el.appendChild(disabledBtn);
    
    disabledBtn.click();

    // Should not trigger a new fetch since button is disabled
    expect(api.fetchLaws).not.toHaveBeenCalled();
  });

  it('ignores invalid page number', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));
    
    vi.mocked(api.fetchLaws).mockClear();

    const invalidBtn = document.createElement('button');
    invalidBtn.dataset.page = '0'; // Invalid page
    el.appendChild(invalidBtn);
    
    invalidBtn.click();

    expect(api.fetchLaws).not.toHaveBeenCalled();
  });

  it('handles non-Element click target', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null });
    el.dispatchEvent(event);

    // Should not throw and onNavigate not called
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('retry button calls loadPage when clicked (L322-324)', async () => {
    vi.mocked(api.fetchLaws).mockRejectedValueOnce(new Error('Network error'));
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 50));

    const retryBtn = el.querySelector('[data-action="retry"]') as HTMLElement | null;
    expect(retryBtn).toBeTruthy();

    vi.mocked(api.fetchLaws).mockResolvedValue({
      data: [{ id: 1, title: 'Law', text: 'Text', score: 1 }],
      total: 1,
      limit: 10,
      offset: 0
    });
    retryBtn!.click();
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(api.fetchLaws).toHaveBeenCalledTimes(2);
  });

  it('uses category_slug when categoryId is non-numeric and category not in list (L175)', async () => {
    vi.mocked(api.fetchCategories).mockResolvedValue({
      data: [
        { id: 1, slug: 'other-cat', title: 'Other', description: 'Other' }
      ]
    });
    vi.mocked(api.fetchLaws).mockResolvedValue({
      data: [{ id: 1, title: 'Law', text: 'Text', score: 1 }],
      total: 1,
      limit: 10,
      offset: 0
    });
    CategoryDetail({ categoryId: 'rare-slug', onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(api.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({
      category_slug: 'rare-slug'
    }));
  });

  it('handles category not found in categories list', async () => {
    vi.mocked(api.fetchCategories).mockResolvedValue({
      data: [
        { id: 999, slug: 'other', title: 'Other Category' }
      ]
    });
    const el = CategoryDetail({ categoryId: '1', onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Should still render with default "Category" title
    expect(el.querySelector('#category-detail-title')).toBeTruthy();
  });

  it('handles fetchCategories error', async () => {
    vi.mocked(api.fetchCategories).mockRejectedValue(new Error('Network error'));
    
    CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
  });

  it('handles null data in fetchLaws response', async () => {
    vi.mocked(api.fetchLaws).mockResolvedValue({ data: [], total: 0, limit: 10, offset: 0 });
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('No laws found');
  });

  it('handles category slug instead of numeric id', async () => {
    vi.mocked(api.fetchCategories).mockResolvedValue({
      data: [
        { id: 1, slug: 'technology', title: 'Technology Laws', description: 'Tech laws' },
        { id: 2, slug: 'work', title: 'Work Laws', description: 'Work laws' }
      ]
    });

    const el = CategoryDetail({ categoryId: 'technology', onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // After fetching category details, the numeric ID is used for API calls
    expect(api.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({
      category_id: 1
    }));

    // Should find category by slug and display its title
    expect(el.textContent).toContain('Technology Laws');
  });

  it('finds category by slug in fetchCategoryDetails', async () => {
    vi.mocked(api.fetchCategories).mockResolvedValue({
      data: [
        { id: 1, slug: 'computers', title: "Murphy's Computers Laws", description: 'Computer laws description' },
        { id: 2, slug: 'work', title: 'Work Laws', description: 'Work laws' }
      ]
    });

    const el = CategoryDetail({ categoryId: 'computers', onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Should find the category by slug and use its title
    expect(el.textContent).toContain("Murphy's Computers Laws");
  });

  it('displays description when category found by slug', async () => {
    vi.mocked(api.fetchCategories).mockResolvedValue({
      data: [
        { id: 1, slug: 'computers', title: "Murphy's Computers Laws", description: 'Digital doom: programs are obsolete when running.' },
        { id: 2, slug: 'work', title: 'Work Laws', description: 'Work laws' }
      ]
    });

    const el = CategoryDetail({ categoryId: 'computers', onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const descEl = el.querySelector('#category-description');
    expect(descEl).toBeTruthy();
    expect(descEl!.textContent).toBe('Digital doom: programs are obsolete when running.');
  });

  describe('sort controls', () => {
    it('renders sort select dropdown', async () => {
      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const sortSelect = el.querySelector('#sort-select') as HTMLSelectElement | null;
      expect(sortSelect).toBeTruthy();
      expect(sortSelect!.options.length).toBeGreaterThan(0);
    });

    it('changes sort order when select changes', async () => {
      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));
      
      vi.mocked(api.fetchLaws).mockClear();

      const sortSelect = el.querySelector('#sort-select') as HTMLSelectElement | null;
      sortSelect!.value = 'created_at-desc';
      sortSelect!.dispatchEvent(new Event('change', { bubbles: true }));

      expect(api.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({
        sort: 'created_at',
        order: 'desc'
      }));
    });

    it('resets to page 1 when sort changes', async () => {
      vi.mocked(api.fetchLaws).mockResolvedValue({
        data: Array(10).fill({ id: 1, title: 'Law', text: 'Text' }),
        total: 25,
        limit: 10,
        offset: 0
      });

      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      // Navigate to page 2
      const pageBtn = document.createElement('button');
      pageBtn.dataset.page = '2';
      el.appendChild(pageBtn);
      pageBtn.click();
      await new Promise(resolve => setTimeout(resolve, 10));

      vi.mocked(api.fetchLaws).mockClear();

      // Change sort
      const sortSelect = el.querySelector('#sort-select') as HTMLSelectElement | null;
      sortSelect!.value = 'upvotes-desc';
      sortSelect!.dispatchEvent(new Event('change', { bubbles: true }));

      expect(api.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({
        offset: 0 // Page 1
      }));
    });
  });

  describe('result count', () => {
    it('displays result count when laws are loaded', async () => {
      vi.mocked(api.fetchLaws).mockResolvedValue({
        data: [
          { id: 101, title: 'Law 1', text: 'Text 1' },
          { id: 102, title: 'Law 2', text: 'Text 2' }
        ],
        total: 2,
        limit: 10,
        offset: 0
      });

      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const resultCount = el.querySelector('#category-result-count') as HTMLElement | null;
      expect(resultCount).toBeTruthy();
      expect(resultCount!.textContent).toContain('1-2 of 2');
    });

    it('hides result count when no laws', async () => {
      vi.mocked(api.fetchLaws).mockResolvedValue({ data: [], total: 0, limit: 10, offset: 0 });

      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const resultCount = el.querySelector('#category-result-count') as HTMLElement | null;
      expect(resultCount!.style.display).toBe('none');
    });
  });

  describe('advanced search integration', () => {
    it('renders advanced search component', async () => {
      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const searchContainer = el.querySelector('#advanced-search-container');
      expect(searchContainer).toBeTruthy();
      expect(searchContainer!.querySelector('.test-advanced-search')).toBeTruthy();
    });

    it('initializes search with category pre-selected', async () => {
      const { AdvancedSearch } = await import('../src/components/advanced-search.ts');
      
      CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(AdvancedSearch).toHaveBeenCalledWith(expect.objectContaining({
        initialFilters: expect.objectContaining({
          category_id: 1
        })
      }));
    });

    it('reloads laws when search filters change', async () => {
      const mod = await import('../src/components/advanced-search.js') as unknown as { getLocalThis: () => AdvancedSearchMockState };
      const { getLocalThis } = mod;
      
      CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      vi.mocked(api.fetchLaws).mockClear();

      // Simulate search with keyword
      const localThis = getLocalThis();
      localThis.onSearch!({ q: 'test', category_id: 1 });

      expect(api.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({
        q: 'test',
        category_id: 1
      }));
    });

    it('keeps category_id when search is cleared', async () => {
      const mod = await import('../src/components/advanced-search.js') as unknown as { getLocalThis: () => AdvancedSearchMockState };
      const { getLocalThis } = mod;
      
      CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      vi.mocked(api.fetchLaws).mockClear();

      // Simulate clearing search
      const localThis = getLocalThis();
      localThis.onSearch!({});

      // Should still include the category_id
      expect(api.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({
        category_id: 1
      }));
    });
  });

  describe('cleanup', () => {
    it('clears export content on cleanup', async () => {
      const { clearExportContent } = await import('../src/utils/export-context.ts');
      
      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      // Call cleanup
      (el as CleanableElement).cleanup!();

      expect(clearExportContent).toHaveBeenCalled();
    });
  });

  describe('search highlighting', () => {
    it('passes search query to law card renderer', async () => {
      const { renderLawCards } = await import('../src/utils/law-card-renderer.js');
      const mod = await import('../src/components/advanced-search.js') as unknown as { getLocalThis: () => AdvancedSearchMockState };
      const { getLocalThis } = mod;
      
      CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      vi.mocked(renderLawCards).mockClear();

      // Simulate search with keyword
      const localThis = getLocalThis();
      localThis.onSearch!({ q: 'test keyword', category_id: 1 });
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(renderLawCards).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ searchQuery: 'test keyword' })
      );
    });
  });

  describe('keyboard navigation edge cases', () => {
    it('handles non-Element keydown target', async () => {
      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      onNavigate.mockClear();

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      Object.defineProperty(event, 'target', { value: null });
      el.dispatchEvent(event);

      // Should not throw and onNavigate not called
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('ignores non-activation keys', async () => {
      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const lawCard = document.createElement('div');
      lawCard.className = 'law-card-mini';
      lawCard.dataset.lawId = '123';
      el.appendChild(lawCard);

      onNavigate.mockClear();

      // Simulate Tab key press (should be ignored)
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      lawCard.dispatchEvent(tabEvent);

      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  describe('formatPageTitle styling', () => {
    it('wraps only first word in accent for titles ending with Laws', async () => {
      vi.mocked(api.fetchCategories).mockResolvedValue({
        data: [
          { id: 1, slug: 'alarm-clock', title: "Murphy's Alarm Clock Laws", description: 'Alarm clock laws' }
        ]
      });

      const el = CategoryDetail({ categoryId: '1', onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const titleEl = el.querySelector('#category-detail-title');
      expect(titleEl).toBeTruthy();
      // Only "Murphy's" should be in the accent span
      expect(titleEl!.innerHTML).toContain('<span class="accent-text">Murphy\'s</span>');
      expect(titleEl!.innerHTML).toContain('Alarm Clock Laws');
      // Should NOT have the entire title wrapped
      expect(titleEl!.innerHTML).not.toContain('accent-text">Murphy\'s Alarm Clock');
    });

    it('wraps only first word in accent for titles NOT ending with Laws', async () => {
      vi.mocked(api.fetchCategories).mockResolvedValue({
        data: [
          { id: 1, slug: '4x4-car', title: "Murphy's 4X4 Car Laws Section", description: '4x4 laws' }
        ]
      });

      const el = CategoryDetail({ categoryId: '1', onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const titleEl = el.querySelector('#category-detail-title');
      expect(titleEl).toBeTruthy();
      // Only "Murphy's" should be in the accent span, and "'s Laws" should be appended
      expect(titleEl!.innerHTML).toContain('<span class="accent-text">Murphy\'s</span>');
      expect(titleEl!.innerHTML).toContain("4X4 Car Laws Section's Laws");
      // Should NOT have the entire original title wrapped in accent
      expect(titleEl!.innerHTML).not.toContain('accent-text">Murphy\'s 4X4 Car Laws Section\'s');
    });

    it('handles single word title ending with Laws', async () => {
      vi.mocked(api.fetchCategories).mockResolvedValue({
        data: [
          { id: 1, slug: 'laws', title: 'Laws', description: 'Just laws' }
        ]
      });

      const el = CategoryDetail({ categoryId: '1', onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const titleEl = el.querySelector('#category-detail-title');
      expect(titleEl).toBeTruthy();
      // Single word should be wrapped entirely
      expect(titleEl!.innerHTML).toContain('<span class="accent-text">Laws</span>');
    });

    it('handles single word title NOT ending with Laws', async () => {
      vi.mocked(api.fetchCategories).mockResolvedValue({
        data: [
          { id: 1, slug: 'technology', title: 'Technology', description: 'Tech stuff' }
        ]
      });

      const el = CategoryDetail({ categoryId: '1', onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const titleEl = el.querySelector('#category-detail-title');
      expect(titleEl).toBeTruthy();
      // Single word should be wrapped with "'s Laws" appended
      expect(titleEl!.innerHTML).toContain('<span class="accent-text">Technology</span>');
      expect(titleEl!.innerHTML).toContain("'s Laws");
    });
  });

  describe('copy actions', () => {
    it('does not copy when copy-text button has empty value', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const copyTextBtn = document.createElement('button');
      copyTextBtn.setAttribute('data-action', 'copy-text');
      copyTextBtn.setAttribute('data-copy-value', '');
      el.appendChild(copyTextBtn);

      copyTextBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(writeTextMock).not.toHaveBeenCalled();
    });

    it('does not copy when copy-link button has empty value', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const copyLinkBtn = document.createElement('button');
      copyLinkBtn.setAttribute('data-action', 'copy-link');
      copyLinkBtn.setAttribute('data-copy-value', '');
      el.appendChild(copyLinkBtn);

      copyLinkBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(writeTextMock).not.toHaveBeenCalled();
    });

    it('copies law text to clipboard when copy text button is clicked', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const copyTextBtn = document.createElement('button');
      copyTextBtn.setAttribute('data-action', 'copy-text');
      copyTextBtn.setAttribute('data-copy-value', 'Test law text');
      el.appendChild(copyTextBtn);

      copyTextBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(writeTextMock).toHaveBeenCalledWith('Test law text');
    });

    it('copies law link to clipboard when copy link button is clicked', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const copyLinkBtn = document.createElement('button');
      copyLinkBtn.setAttribute('data-action', 'copy-link');
      copyLinkBtn.setAttribute('data-copy-value', 'https://test.com/law/1');
      el.appendChild(copyLinkBtn);

      copyLinkBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(writeTextMock).toHaveBeenCalledWith('https://test.com/law/1');
    });

    it('uses fallback when clipboard API fails on copy text', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard not available'));
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const execCommandMock = vi.fn().mockReturnValue(true);
      document.execCommand = execCommandMock;

      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const copyTextBtn = document.createElement('button');
      copyTextBtn.setAttribute('data-action', 'copy-text');
      copyTextBtn.setAttribute('data-copy-value', 'Test law text');
      el.appendChild(copyTextBtn);

      copyTextBtn.click();
      await new Promise(r => setTimeout(r, 50));

      expect(writeTextMock).toHaveBeenCalled();
      expect(execCommandMock).toHaveBeenCalledWith('copy');
    });

    it('uses fallback when clipboard API fails on copy link', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard not available'));
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const execCommandMock = vi.fn().mockReturnValue(true);
      document.execCommand = execCommandMock;

      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const copyLinkBtn = document.createElement('button');
      copyLinkBtn.setAttribute('data-action', 'copy-link');
      copyLinkBtn.setAttribute('data-copy-value', 'https://test.com/law/1');
      el.appendChild(copyLinkBtn);

      copyLinkBtn.click();
      await new Promise(r => setTimeout(r, 50));

      expect(writeTextMock).toHaveBeenCalled();
      expect(execCommandMock).toHaveBeenCalledWith('copy');
    });
  });
});
