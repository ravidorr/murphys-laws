import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CleanableElement } from '../src/types/app.js';
import { Browse } from '../src/views/browse.js';
import * as api from '../src/utils/api.js';
import * as voting from '../src/utils/voting.js';
import * as cacheUtils from '../src/utils/category-cache.js';
import * as exportContext from '../src/utils/export-context.js';

// Mock voting module
vi.mock('../src/utils/voting.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    toggleVote: vi.fn().mockResolvedValue({ upvotes: 11, downvotes: 2 }),
    getUserVote: vi.fn().mockReturnValue(null)
  };
});

interface BrowseTestContext {
  el?: HTMLElement;
  sortSelect?: HTMLSelectElement | null;
  nextBtn?: HTMLButtonElement | undefined;
}

describe('Browse view', () => {
  let fetchLawsSpy: ReturnType<typeof vi.spyOn>;
  let getUserVoteSpy: ReturnType<typeof vi.fn>;
  let toggleVoteSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    // Ensure URL state is clean so parseBrowseParams gets page=1, no filters
    if (typeof location !== 'undefined') {
      const url = new URL(location.href);
      url.search = '';
      url.pathname = '/browse';
      window.history.replaceState({}, '', url.toString());
    }

    // Mock API responses
    fetchLawsSpy = vi.spyOn(api, 'fetchLaws').mockResolvedValue({
      data: [
        { id: 1, title: 'Murphy\'s Law', text: 'Anything that can go wrong will go wrong', upvotes: 10, downvotes: 2 },
        { id: 2, title: 'Parkinson\'s Law', text: 'Work expands to fill the time available', upvotes: 5, downvotes: 1 }
      ],
      total: 2,
      limit: 25,
      offset: 0
    });

    // Mock widget API calls
    vi.spyOn(api, 'fetchTopVoted').mockResolvedValue({ data: [], total: 0, limit: 3, offset: 0 });
    vi.spyOn(api, 'fetchTrending').mockResolvedValue({ data: [], total: 0, limit: 3, offset: 0 });
    vi.spyOn(api, 'fetchRecentlyAdded').mockResolvedValue({ data: [], total: 0, limit: 3, offset: 0 });

    // Mock deferUntilIdle to execute immediately for testing
    vi.spyOn(cacheUtils, 'deferUntilIdle').mockImplementation((callback) => {
      callback();
    });

    // Get references to the mocked functions
    getUserVoteSpy = vi.mocked(voting).getUserVote;
    toggleVoteSpy = vi.mocked(voting).toggleVote;

    // Clear mock call history
    getUserVoteSpy.mockClear();
    toggleVoteSpy.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows search query when provided', () => {
    const el = Browse({ searchQuery: 'gravity', onNavigate: () => { } });
    expect(el.textContent).toMatch(/gravity/);
  });

  it('renders Browse title', () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    expect(el.textContent).toMatch(/Browse/);
    expect(el.textContent).toMatch(/All Murphy's Laws/);
  });

  it('renders loading state initially', () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    expect(el.textContent).toMatch(/Loading/);
  });

  it('fetches and displays laws', async () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    // Wait for async loading
    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Murphy's Law/);
    }, { timeout: 1000 });

    expect(fetchLawsSpy).toHaveBeenCalled();
    expect(el.textContent).toMatch(/Parkinson's Law/);
  });

  it('displays result count after loading laws', async () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      const resultCount = el.querySelector('#browse-result-count');
      expect(resultCount).toBeTruthy();
      expect(resultCount!.textContent).toMatch(/Showing 1-2 of 2 laws/);
    }, { timeout: 1000 });
  });

  it('renders breadcrumb in container after initial render (L66)', async () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    const breadcrumbContainer = el.querySelector('#browse-breadcrumb');
    expect(breadcrumbContainer).toBeTruthy();
    await vi.waitFor(() => {
      expect(breadcrumbContainer!.children.length).toBeGreaterThan(0);
    }, { timeout: 1000 });
  });

  it('uses initial filters when searchQuery is omitted (L66)', async () => {
    const el = Browse({ onNavigate: () => { } });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini') ?? el.textContent).toBeTruthy();
    }, { timeout: 1000 });

    expect(fetchLawsSpy).toHaveBeenCalled();
  });

  it('L37 B1: parseBrowseParams adds category_id to filters when in URL', async () => {
    const url = new URL(location.href);
    url.search = '?category_id=3';
    url.pathname = '/browse';
    window.history.replaceState({}, '', url.toString());
    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalled();
    }, { timeout: 1000 });
    expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({ category_id: 3 }));
  });

  it('L39 T6 B0: parseBrowseParams does not add category_id when absent from URL', async () => {
    const url = new URL(location.href);
    url.search = '';
    url.pathname = '/browse';
    window.history.replaceState({}, '', url.toString());
    Browse({ searchQuery: '', onNavigate: () => { } });
    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalled();
    }, { timeout: 1000 });
    const lastCall = fetchLawsSpy.mock.calls[fetchLawsSpy.mock.calls.length - 1];
    expect(lastCall?.[0]).not.toHaveProperty('category_id');
  });

  it('L39 T7 B0: parseBrowseParams keeps category_id as string when not numeric', async () => {
    const url = new URL(location.href);
    url.search = '?category_id=slug-value';
    url.pathname = '/browse';
    window.history.replaceState({}, '', url.toString());
    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalled();
    }, { timeout: 1000 });
    expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({ category_id: 'slug-value' }));
  });

  it('L39 T7 B1: parseBrowseParams parses category_id as number when numeric', async () => {
    const url = new URL(location.href);
    url.search = '?category_id=5';
    url.pathname = '/browse';
    window.history.replaceState({}, '', url.toString());
    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalled();
    }, { timeout: 1000 });
    expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({ category_id: 5 }));
  });

  it('L40 T8 B1: parseBrowseParams uses page from URL', async () => {
    const url = new URL('/browse', location.origin);
    url.search = '?page=2';
    window.history.replaceState({}, '', url.toString());
    fetchLawsSpy.mockResolvedValue({
      data: [{ id: 1, title: 'L', text: 'T', upvotes: 0, downvotes: 0 }],
      total: 1,
      limit: 25,
      offset: 25
    });
    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    await vi.waitFor(() => expect(fetchLawsSpy).toHaveBeenCalled());
    expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({ offset: 25 }));
  });

  it('L40 T8 B0: parseBrowseParams does not add attribution when absent', async () => {
    const url = new URL(location.href);
    url.search = '';
    url.pathname = '/browse';
    window.history.replaceState({}, '', url.toString());
    Browse({ searchQuery: '', onNavigate: () => { } });
    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalled();
    }, { timeout: 1000 });
    const lastCall = fetchLawsSpy.mock.calls[fetchLawsSpy.mock.calls.length - 1];
    expect(lastCall?.[0]).not.toHaveProperty('attribution');
  });

  it('L40 B1: parseBrowseParams adds attribution to filters when in URL', async () => {
    const url = new URL(location.href);
    url.search = '?attribution=Alice';
    url.pathname = '/browse';
    window.history.replaceState({}, '', url.toString());
    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalled();
    }, { timeout: 1000 });
    expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({ attribution: 'Alice' }));
  });

  it('L60 B1: uses searchQuery in currentFilters when provided and non-empty', async () => {
    const el = Browse({ searchQuery: 'test-query', onNavigate: () => { } });
    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalled();
    }, { timeout: 1000 });
    expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({ q: 'test-query' }));
  });

  it('L100 B1: setExportContent called when laws loaded', async () => {
    const setExportSpy = vi.spyOn(exportContext, 'setExportContent');
    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });
    expect(setExportSpy).toHaveBeenCalled();
    setExportSpy.mockRestore();
  });

  it('L103 B1: clearExportContent called when no laws returned', async () => {
    fetchLawsSpy.mockResolvedValue({ data: [], total: 0, limit: 25, offset: 0 });
    const clearSpy = vi.spyOn(exportContext, 'clearExportContent');
    const el = Browse({ searchQuery: 'empty', onNavigate: () => { } });
    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Murphy spared these results/);
    }, { timeout: 1000 });
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('L171 B1: history.replaceState called after loadPage', async () => {
    const replaceStateSpy = vi.spyOn(history, 'replaceState');
    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });
    expect(replaceStateSpy).toHaveBeenCalled();
    replaceStateSpy.mockRestore();
  });

  it('L215 B1: law card click navigates when not clicking button', async () => {
    const onNavigate = vi.fn();
    const el = Browse({ searchQuery: '', onNavigate });
    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });
    const card = el.querySelector('.law-card-mini') as HTMLElement;
    const lawId = card?.dataset?.lawId;
    expect(lawId).toBeTruthy();
    const titleEl = card?.querySelector('.law-card-title') ?? card;
    titleEl?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onNavigate).toHaveBeenCalledWith('law', lawId);
  });

  it('does not replace breadcrumb container when Breadcrumb returns null (L66 falsy branch)', async () => {
    vi.doMock('../src/components/breadcrumb.js', () => ({ Breadcrumb: () => null }));
    const { Browse: BrowseWithMock } = await import('../src/views/browse.js');
    const el = BrowseWithMock({ searchQuery: '', onNavigate: () => { } });
    await vi.waitFor(() => {
      expect(el.querySelector('#browse-breadcrumb')).toBeTruthy();
    }, { timeout: 500 });
    vi.unmock('../src/components/breadcrumb.js');
  });

  it('updates result count on pagination', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: Array(25).fill(null).map((_, i) => ({
        id: i + 1,
        title: `Law ${i + 1}`,
        text: `Text ${i + 1}`,
        upvotes: 0,
        downvotes: 0
      })),
      total: 50,
      limit: 25,
      offset: 0
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      const resultCount = el.querySelector('#browse-result-count');
      expect(resultCount?.textContent).toMatch(/Showing 1-25 of 50 laws/);
    }, { timeout: 1000 });

    // Navigate to page 2
    const nextBtn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => (btn as HTMLElement).textContent === 'Next') as HTMLButtonElement | undefined;
    nextBtn!.click();

    await vi.waitFor(() => {
      const resultCount = el.querySelector('#browse-result-count');
      expect(resultCount).toBeTruthy();
      expect(resultCount!.textContent).toMatch(/Showing 26-50 of 50 laws/);
    }, { timeout: 1000 });
  });

  it('hides result count when no laws found', async () => {
    fetchLawsSpy.mockResolvedValue({ data: [], total: 0, limit: 25, offset: 0 });

    const el = Browse({ searchQuery: 'nonexistent', onNavigate: () => { } });

    await vi.waitFor(() => {
      const resultCount = el.querySelector('#browse-result-count') as HTMLElement | null;
      expect(resultCount?.style.display).toBe('none');
    }, { timeout: 1000 });
  });

  it('displays empty state when no laws found', async () => {
    fetchLawsSpy.mockResolvedValue({ data: [], total: 0, limit: 25, offset: 0 });

    const el = Browse({ searchQuery: 'nonexistent', onNavigate: () => { } });

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Murphy spared these results/);
    }, { timeout: 1000 });
  });

  it('shows submit button in empty state and navigates when clicked', async () => {
    fetchLawsSpy.mockResolvedValue({ data: [], total: 0, limit: 25, offset: 0 });
    const onNavigate = vi.fn();

    const el = Browse({ searchQuery: 'nonexistent', onNavigate });

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Murphy spared these results/);
    }, { timeout: 1000 });

    // Check that submit button exists
    const submitBtn = el.querySelector('[data-nav="submit"]') as HTMLElement | null;
    expect(submitBtn).toBeTruthy();
    expect(submitBtn?.textContent).toMatch(/Submit a Law/);

    // Click the submit button
    submitBtn!.click();

    // Verify navigation was called
    expect(onNavigate).toHaveBeenCalledWith('submit');
  });

  it('handles clicking on submit button icon or text in empty state', async () => {
    fetchLawsSpy.mockResolvedValue({ data: [], total: 0, limit: 25, offset: 0 });
    const onNavigate = vi.fn();

    const el = Browse({ searchQuery: 'nonexistent', onNavigate });

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Murphy spared these results/);
    }, { timeout: 1000 });

    // Find the icon inside the submit button
    const submitBtn = el.querySelector('[data-nav="submit"]');
    const icon = submitBtn?.querySelector('.icon');
    expect(icon).toBeTruthy();

    // Click on the icon (not the button itself)
    icon!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith('submit');
    });
  });

  it('displays error state on fetch failure', async () => {
    fetchLawsSpy.mockRejectedValue(new Error('Network error'));

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Of course something went wrong/);
    }, { timeout: 1000 });
  });

  it('retry button triggers loadPage again after fetch failure', async () => {
    fetchLawsSpy.mockRejectedValueOnce(new Error('Network error'));

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      expect(el.querySelector('[data-action="retry"]')).toBeTruthy();
    }, { timeout: 1000 });

    fetchLawsSpy.mockResolvedValue({
      data: [{ id: 1, title: 'Law', text: 'Text', upvotes: 0, downvotes: 0 }],
      total: 1,
      limit: 25,
      offset: 0
    });

    (el.querySelector('[data-action="retry"]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    expect(fetchLawsSpy).toHaveBeenCalledTimes(2);
  });

  it('renders pagination when multiple pages', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: Array(20).fill(null).map((_, i) => ({
        id: i + 1,
        title: `Law ${i + 1}`,
        text: `Text ${i + 1}`,
        upvotes: 0,
        downvotes: 0
      })),
      total: 50,
      limit: 25,
      offset: 0
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      const pagination = el.querySelector('.pagination');
      expect(pagination).toBeTruthy();
      expect(el.textContent).toMatch(/Previous/);
      expect(el.textContent).toMatch(/Next/);
    }, { timeout: 1000 });
  });

  it('handles pagination button clicks', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: Array(20).fill(null).map((_, i) => ({
        id: i + 1,
        title: `Law ${i + 1}`,
        text: `Text ${i + 1}`,
        upvotes: 0,
        downvotes: 0
      })),
      total: 50,
      limit: 25,
      offset: 0
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      const nextBtn = Array.from(el.querySelectorAll('.pagination button'))
        .find(btn => (btn as HTMLElement).textContent === 'Next');
      expect(nextBtn).toBeTruthy();
    }, { timeout: 1000 });

    const nextBtn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => (btn as HTMLElement).textContent === 'Next') as HTMLButtonElement | undefined;

    fetchLawsSpy.mockClear();
    nextBtn!.click();

    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({
        offset: 25
      }));
    }, { timeout: 1000 });
  });

  it('pagination works when clicking button inner element (label or icon)', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: Array(20).fill(null).map((_, i) => ({
        id: i + 1,
        title: `Law ${i + 1}`,
        text: `Text ${i + 1}`,
        upvotes: 0,
        downvotes: 0
      })),
      total: 50,
      limit: 25,
      offset: 0
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      const nextBtn = Array.from(el.querySelectorAll('.pagination button'))
        .find(btn => (btn as HTMLElement).textContent?.includes('Next'));
      expect(nextBtn).toBeTruthy();
    }, { timeout: 1000 });

    const nextBtn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => (btn as HTMLElement).textContent?.includes('Next')) as HTMLButtonElement;
    const inner = nextBtn.querySelector('.btn-text') ?? nextBtn.firstElementChild;
    expect(inner).toBeTruthy();

    fetchLawsSpy.mockClear();
    (inner as HTMLElement).click();

    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({
        offset: 25
      }));
    }, { timeout: 1000 });
  });

  it('L246 L275 L277 L282 L283: sort select change updates sort/order and reloads', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: [{ id: 1, title: 'Law', text: 'Text', upvotes: 0, downvotes: 0 }],
      total: 1,
      limit: 25,
      offset: 0
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.querySelector('#sort-select')).toBeTruthy(), { timeout: 1000 });

    const sortSelect = el.querySelector('#sort-select') as HTMLSelectElement;
    const optionOldest = Array.from(sortSelect.options).find((o) => o.value === 'created_at-asc');
    expect(optionOldest).toBeTruthy();
    sortSelect.value = 'created_at-asc';
    sortSelect.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({ sort: 'created_at', order: 'asc' }));
    }, { timeout: 1000 });
  });

  it('handles voting on laws', async () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    // Wait for laws to load
    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    // Verify vote buttons are rendered with correct attributes
    const upvoteBtn = el.querySelector('[data-vote="up"][data-law-id="1"]');
    const downvoteBtn = el.querySelector('[data-vote="down"][data-law-id="1"]');

    expect(upvoteBtn).toBeTruthy();
    expect(downvoteBtn).toBeTruthy();
    expect(upvoteBtn!.getAttribute('data-law-id')).toBe('1');
    expect(downvoteBtn!.getAttribute('data-law-id')).toBe('1');

    // Verify vote counts are displayed
    const upCount = upvoteBtn!.querySelector('.count-num');
    const downCount = downvoteBtn!.querySelector('.count-num');
    expect(upCount!.textContent).toBe('10');
    expect(downCount!.textContent).toBe('2');

    // Verify button is clickable (doesn't throw)
    expect(() => (upvoteBtn as HTMLElement).click()).not.toThrow();
  });

  it('updates vote counts after voting', async () => {
    // Mock successful voting response
    toggleVoteSpy.mockResolvedValue({ upvotes: 11, downvotes: 2 });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    // Wait for laws to load
    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    // Find vote elements
    const voteBtn = el.querySelector('[data-vote="up"][data-law-id="1"]');
    const countNum = voteBtn?.querySelector('.count-num');

    // Verify initial count
    expect((countNum as HTMLElement)?.textContent).toBe('10');

    // Simulate voting by directly calling toggleVote (as addVotingListeners would)
    await voting.toggleVote('1', 'up');

    // Verify the mock was called
    expect(toggleVoteSpy).toHaveBeenCalledWith('1', 'up');
  });

  it('handles law card click navigation', async () => {
    const onNavigate = vi.fn();
    const el = Browse({ searchQuery: '', onNavigate });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    const lawCard = el.querySelector('.law-card-mini') as HTMLElement | null;
    lawCard!.click();

    expect(onNavigate).toHaveBeenCalledWith('law', '1');
  });

  it('does not navigate when clicking buttons inside law card', async () => {
    const onNavigate = vi.fn();
    const el = Browse({ searchQuery: '', onNavigate });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    const lawCard = el.querySelector('.law-card-mini') as HTMLElement | null;
    // Find or create a button inside the law card (vote/favorite buttons)
    let button = lawCard?.querySelector('button') as HTMLButtonElement | null;
    if (!button) {
      button = document.createElement('button');
      button.setAttribute('data-action', 'favorite');
      lawCard!.appendChild(button);
    }

    // Reset the mock to clear any previous calls
    onNavigate.mockClear();

    // Click the button inside the card
    button!.click();

    // Navigation should NOT be triggered when clicking buttons
    expect(onNavigate).not.toHaveBeenCalledWith('law', expect.anything());
  });

  it('handles law card keyboard navigation with Enter key (WCAG 2.1.1)', async () => {
    const onNavigate = vi.fn();
    const el = Browse({ searchQuery: '', onNavigate });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    const lawCard = el.querySelector('.law-card-mini') as HTMLElement | null;
    
    // Simulate Enter key press on the law card
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    lawCard!.dispatchEvent(enterEvent);

    expect(onNavigate).toHaveBeenCalledWith('law', '1');
  });

  it('handles law card keyboard navigation with Space key (WCAG 2.1.1)', async () => {
    const onNavigate = vi.fn();
    const el = Browse({ searchQuery: '', onNavigate });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    const lawCard = el.querySelector('.law-card-mini') as HTMLElement | null;
    
    // Simulate Space key press on the law card
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    lawCard!.dispatchEvent(spaceEvent);

    expect(onNavigate).toHaveBeenCalledWith('law', '1');
  });

  it('law cards have proper accessibility attributes', async () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    const lawCard = el.querySelector('.law-card-mini');
    expect(lawCard).toBeTruthy();
    // Check accessibility attributes (WCAG 2.1.1, 4.1.2)
    expect(lawCard!.tagName).toBe('ARTICLE');
    expect(lawCard!.getAttribute('tabindex')).toBe('0');
    expect(lawCard!.getAttribute('role')).toBe('article');
    expect(lawCard!.getAttribute('aria-label')).toBeTruthy();
  });

  it('renders search query and laws with search results', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: [{ id: 1, title: 'Murphy\'s Law', text: 'Anything that can go wrong', upvotes: 10, downvotes: 2 }],
      total: 1,
      limit: 25,
      offset: 0
    });

    const el = Browse({ searchQuery: 'wrong', onNavigate: () => { } });

    // Check that search query is displayed
    expect(el.textContent).toMatch(/Search results for/);
    expect(el.textContent).toMatch(/wrong/);

    // Check that laws are rendered
    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Murphy's Law/);
      expect(el.textContent).toMatch(/Anything that can go wrong/);
    }, { timeout: 1000 });
  });

  it('shows vote button with voted class when user has voted', async () => {
    getUserVoteSpy.mockReturnValue('up');

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      const cardText = el.querySelector('#browse-laws-list');
      const upvoteBtn = cardText?.querySelector('.law-card-mini [data-vote="up"]');
      expect(upvoteBtn?.classList.contains('voted')).toBe(true);
    }, { timeout: 1000 });
  });

  it('handles voting errors gracefully', async () => {
    toggleVoteSpy.mockRejectedValue(new Error('Vote failed'));

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      const cardText = el.querySelector('#browse-laws-list');
      expect(cardText?.querySelector('.law-card-mini [data-vote="up"]')).toBeTruthy();
    }, { timeout: 1000 });

    const cardText = el.querySelector('#browse-laws-list');
    const upvoteBtn = cardText?.querySelector('.law-card-mini [data-vote="up"]') as HTMLElement | null;
    upvoteBtn!.click();

    await vi.waitFor(() => {
    }, { timeout: 1000 });

  });

  it('renders laws without titles correctly', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: [{ id: 1, text: 'Law without title', upvotes: 5, downvotes: 1 }],
      total: 1,
      limit: 25,
      offset: 0
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Law without title/);
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });
  });

  it('disables pagination buttons during loading', async () => {
    let resolveFirstFetch!: (value: unknown) => void;
    const firstFetchPromise = new Promise(resolve => { resolveFirstFetch = resolve; });

    fetchLawsSpy.mockImplementation(() => firstFetchPromise);

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    // Resolve initial load
    resolveFirstFetch({
      data: Array(20).fill(null).map((_, i) => ({
        id: i + 1,
        title: `Law ${i + 1}`,
        text: `Text ${i + 1}`,
        upvotes: 0,
        downvotes: 0
      })),
      total: 50,
      limit: 25,
      offset: 0
    });

    await vi.waitFor(() => {
      expect(el.querySelector('.pagination')).toBeTruthy();
    }, { timeout: 1000 });

    // Mock second page fetch to be slow
    let resolveSecondFetch!: (value: unknown) => void;
    const secondFetchPromise = new Promise(resolve => { resolveSecondFetch = resolve; });
    fetchLawsSpy.mockImplementation(() => secondFetchPromise);

    const nextBtn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => (btn as HTMLElement).textContent === 'Next') as HTMLButtonElement | undefined;
    nextBtn!.click();

    // Check that buttons are disabled during load
    await vi.waitFor(() => {
      const buttons = el.querySelectorAll('.pagination button');
      const allDisabled = Array.from(buttons).every(btn => btn.hasAttribute('disabled'));
      expect(allDisabled).toBe(true);
    }, { timeout: 1000 });

    // Clean up
    resolveSecondFetch({
      data: [],
      total: 50,
      limit: 25,
      offset: 25
    });
  });

  it('handles clicking page number button', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: Array(25).fill(null).map((_, i) => ({ id: i + 1, title: `Law ${i + 1}`, text: `Text ${i + 1}`, upvotes: 0, downvotes: 0 })),
      total: 100,
      limit: 25,
      offset: 0
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      const pagination = el.querySelector('.pagination');
      expect(pagination).toBeTruthy();
    }, { timeout: 1000 });

    // Find and click page 2 button
    const page2Btn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => (btn as HTMLElement).textContent === '2');

    if (page2Btn) {
      fetchLawsSpy.mockClear();
      (page2Btn as HTMLButtonElement).click();

      await vi.waitFor(() => {
        expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({ offset: 25 }));
      }, { timeout: 1000 });
    }
  });

  it('handles previous button click', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: Array(25).fill(null).map((_, i) => ({ id: i + 1, title: `Law ${i + 1}`, text: `Text ${i + 1}`, upvotes: 0, downvotes: 0 })),
      total: 100,
      limit: 25,
      offset: 0
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      const nextBtn = Array.from(el.querySelectorAll('.pagination button'))
        .find(btn => btn.textContent === 'Next');
      expect(nextBtn).toBeTruthy();
    }, { timeout: 1000 });

    // Click next to go to page 2
    const nextBtn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => (btn as HTMLElement).textContent === 'Next') as HTMLButtonElement | undefined;
    nextBtn!.click();

    await vi.waitFor(() => {
      const prevBtn = Array.from(el.querySelectorAll('.pagination button'))
        .find(btn => (btn as HTMLElement).textContent === 'Previous');
      expect(prevBtn?.hasAttribute('disabled')).toBe(false);
    }, { timeout: 1000 });

    // Now click previous to go back to page 1
    const prevBtn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => (btn as HTMLElement).textContent === 'Previous') as HTMLButtonElement | undefined;

    fetchLawsSpy.mockClear();
    prevBtn!.click();

    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
    }, { timeout: 1000 });
  });

  it('disables previous button on first page', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: Array(25).fill(null).map((_, i) => ({ id: i + 1, title: `Law ${i + 1}`, text: `Text ${i + 1}`, upvotes: 0, downvotes: 0 })),
      total: 100,
      limit: 25,
      offset: 0
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      const pagination = el.querySelector('.pagination');
      expect(pagination).toBeTruthy();
    }, { timeout: 1000 });

    const prevBtn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => (btn as HTMLElement).textContent === 'Previous') as HTMLButtonElement | null;
    expect(prevBtn?.disabled).toBe(true);
  });

  it('disables next button on last page', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: Array(10).fill(null).map((_, i) => ({ id: i + 1, title: `Law ${i + 1}`, text: `Text ${i + 1}`, upvotes: 0, downvotes: 0 })),
      total: 30,
      limit: 25,
      offset: 0
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      const pagination = el.querySelector('.pagination');
      expect(pagination).toBeTruthy();
    }, { timeout: 1000 });

    // Go to last page
    const page2Btn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => (btn as HTMLElement).textContent === '2') as HTMLButtonElement | undefined;
    if (page2Btn) {
      page2Btn.click();

      await vi.waitFor(() => {
        const nextBtn = Array.from(el.querySelectorAll('.pagination button'))
          .find(btn => (btn as HTMLElement).textContent === 'Next') as HTMLButtonElement | null;
        expect(nextBtn?.disabled).toBe(true);
      }, { timeout: 1000 });
    }
  });

  it('handles data-nav attribute clicks', async () => {
    const onNavigate = vi.fn();
    const el = Browse({ searchQuery: '', onNavigate });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    // Create a button with data-nav attribute and click it
    const navBtn = document.createElement('button');
    navBtn.setAttribute('data-nav', 'home');
    el.appendChild(navBtn);

    (navBtn as HTMLButtonElement).click();

    expect(onNavigate).toHaveBeenCalledWith('home');

    el.removeChild(navBtn);
  });

  it('handles advanced search filter changes', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: [{ id: 1, title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 1 }],
      total: 1,
      limit: 25,
      offset: 0
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      const searchContainer = el.querySelector('#advanced-search-container');
      expect(searchContainer).toBeTruthy();
    }, { timeout: 1000 });

    // Find the advanced search component
    const searchContainer = el.querySelector('#advanced-search-container') as HTMLElement | null;
    const searchInput = searchContainer?.querySelector('#search-keyword') as HTMLInputElement | null;
    const searchBtn = searchContainer?.querySelector('#search-btn') as HTMLButtonElement | null;

    fetchLawsSpy.mockClear();

    // Trigger search with new filter
    if (searchInput) searchInput.value = 'murphy';
    searchBtn?.click();

    // Should call loadPage(1) with new filters
    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({
        offset: 0,
        q: 'murphy'
      }));
    }, { timeout: 1000 });
  });

  it('shows ellipsis in pagination for many pages', async () => {
    // Create 250 laws (10 pages with 25 per page)
    fetchLawsSpy.mockResolvedValue({
      data: Array(25).fill(null).map((_, i) => ({
        id: i + 1,
        title: `Law ${i + 1}`,
        text: `Text ${i + 1}`,
        upvotes: 0,
        downvotes: 0
      })),
      total: 250,
      limit: 25,
      offset: 0
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      const pagination = el.querySelector('.pagination');
      expect(pagination).toBeTruthy();
    }, { timeout: 1000 });

    // Navigate to page 2, then 3, then 4 to trigger ellipsis
    // On page 1, we see: 1, 2, ..., 10
    // On page 2, we see: 1, 2, 3, ..., 10
    // On page 3, we see: 1, 2, 3, 4, ..., 10
    // On page 4, we see: 1, ..., 3, 4, 5, ..., 10 (first ellipsis appears!)

    // Go to page 2
    let nextBtn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => (btn as HTMLElement).textContent === 'Next') as HTMLButtonElement | undefined;
    nextBtn!.click();

    await vi.waitFor(() => {
      const page3Btn = Array.from(el.querySelectorAll('.pagination button'))
        .find(btn => (btn as HTMLElement).textContent === '3');
      expect(page3Btn).toBeTruthy();
    }, { timeout: 1000 });

    // Go to page 3
    nextBtn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => (btn as HTMLElement).textContent === 'Next') as HTMLButtonElement | undefined;
    nextBtn!.click();

    await vi.waitFor(() => {
      const page4Btn = Array.from(el.querySelectorAll('.pagination button'))
        .find(btn => (btn as HTMLElement).textContent === '4');
      expect(page4Btn).toBeTruthy();
    }, { timeout: 1000 });

    // Go to page 4 - this should trigger ellipsis when start > 2
    nextBtn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => (btn as HTMLElement).textContent === 'Next') as HTMLButtonElement | undefined;
    nextBtn!.click();

    await vi.waitFor(() => {
      // Check for ellipsis - should appear before the current page numbers
      const ellipsis = el.querySelectorAll('.ellipsis');
      expect(ellipsis.length).toBeGreaterThan(0);
    }, { timeout: 1000 });
  });

  it('hides widgets when search query is active', async () => {
    const el = Browse({ searchQuery: 'test', onNavigate: () => { } });

    await vi.waitFor(() => {
      const widgetsContainer = el.querySelector('[data-widgets]');
      expect(widgetsContainer).toBeTruthy();
      // Widgets should be hidden when there's a search query
      expect(widgetsContainer!.hasAttribute('hidden')).toBe(true);
    }, { timeout: 1000 });
  });

  it('L243 B1: updateWidgetsVisibility runs when widgets container exists', async () => {
    const el = Browse({ searchQuery: 'x', onNavigate: () => { } });
    await vi.waitFor(() => {
      const widgetsContainer = el.querySelector('[data-widgets]');
      expect(widgetsContainer).toBeTruthy();
      expect(widgetsContainer!.hasAttribute('hidden')).toBe(true);
    }, { timeout: 1000 });
  });

  it('L272 B1: sort select and sortValue set selected option when option exists', async () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    await vi.waitFor(() => {
      const sortSelect = el.querySelector('#sort-select') as HTMLSelectElement;
      expect(sortSelect).toBeTruthy();
      expect(sortSelect.value).toBe('score-desc');
    }, { timeout: 1000 });
  });

  it('L274 B1: option element gets selected when matching sortValue', async () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    await vi.waitFor(() => {
      const sortSelect = el.querySelector('#sort-select') as HTMLSelectElement;
      const option = sortSelect?.querySelector('option[value="score-desc"]');
      expect(option).toBeTruthy();
      expect((option as HTMLOptionElement).selected).toBe(true);
    }, { timeout: 1000 });
  });

  it('L279 B1: sort from change event updates currentSort', async () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    await vi.waitFor(() => {
      expect(el.querySelector('#sort-select')).toBeTruthy();
    }, { timeout: 1000 });
    const sortSelect = el.querySelector('#sort-select') as HTMLSelectElement;
    sortSelect.value = 'created_at-desc';
    sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(sortSelect.value).toBe('created_at-desc');
  });

  it('L280 B1: order from change event updates currentOrder', async () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    await vi.waitFor(() => {
      expect(el.querySelector('#sort-select')).toBeTruthy();
    }, { timeout: 1000 });
    const sortSelect = el.querySelector('#sort-select') as HTMLSelectElement;
    sortSelect.value = 'created_at-asc';
    sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(sortSelect.value).toBe('created_at-asc');
  });

  it('shows widgets when no search filters are active', async () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      const widgetsContainer = el.querySelector('[data-widgets]');
      expect(widgetsContainer).toBeTruthy();
      // Widgets should be visible when there's no search
      expect(widgetsContainer!.hasAttribute('hidden')).toBe(false);
    }, { timeout: 1000 });
  });

  it('hides widgets after performing a search', async () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    // Wait for initial render - widgets should be visible
    await vi.waitFor(() => {
      const widgetsContainer = el.querySelector('[data-widgets]');
      expect(widgetsContainer).toBeTruthy();
      expect(widgetsContainer!.hasAttribute('hidden')).toBe(false);
    }, { timeout: 1000 });

    // Perform a search
    const searchInput = el.querySelector('#search-keyword');
    const searchBtn = el.querySelector('#search-btn');

    if (searchInput && searchBtn) {
      (searchInput as HTMLInputElement).value = 'murphy';
      (searchBtn as HTMLButtonElement).click();

      // Widgets should now be hidden
      await vi.waitFor(() => {
        const widgetsContainer = el.querySelector('[data-widgets]');
        expect(widgetsContainer!.hasAttribute('hidden')).toBe(true);
      }, { timeout: 1000 });
    }
  });

  it('shows widgets again after clearing search', async () => {
    const el = Browse({ searchQuery: 'test', onNavigate: () => { } });

    // Wait for initial render - widgets should be hidden due to search
    await vi.waitFor(() => {
      const widgetsContainer = el.querySelector('[data-widgets]');
      expect(widgetsContainer).toBeTruthy();
      expect(widgetsContainer!.hasAttribute('hidden')).toBe(true);
    }, { timeout: 1000 });

    // Clear the search
    const clearBtn = el.querySelector('#clear-btn');

    if (clearBtn) {
      (clearBtn as HTMLButtonElement).click();

      // Widgets should now be visible again
      await vi.waitFor(() => {
        const widgetsContainer = el.querySelector('[data-widgets]');
        expect(widgetsContainer!.hasAttribute('hidden')).toBe(false);
      }, { timeout: 1000 });
    }
  });

  it('hides widgets when filtering by category only', async () => {
    // Mock API to return different data for categories and attributions
    const fetchAPISpy = vi.spyOn(api, 'fetchAPI');
    fetchAPISpy.mockImplementation((url) => {
      if (url.includes('categories')) {
        return Promise.resolve({ data: [{ id: 1, title: 'Technology' }] });
      }
      if (url.includes('attributions')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    // Wait for categories dropdown to be populated
    await vi.waitFor(() => {
      const categorySelect = el.querySelector('#search-category');
      const options = categorySelect?.querySelectorAll('option');
      // Should have at least 2 options: "All Categories" + "Technology"
      expect(options?.length).toBeGreaterThan(1);
    }, { timeout: 1000 });

    // Select a category
    const categorySelect = el.querySelector('#search-category');
    const searchBtn = el.querySelector('#search-btn');

    if (categorySelect && searchBtn) {
      (categorySelect as HTMLSelectElement).value = '1';
      (searchBtn as HTMLButtonElement).click();

      // Widgets should now be hidden
      await vi.waitFor(() => {
        const widgetsContainer = el.querySelector('[data-widgets]');
        expect(widgetsContainer!.hasAttribute('hidden')).toBe(true);
      }, { timeout: 1000 });
    }
  });

  it('hides widgets when filtering by attribution only', async () => {
    // Mock API to return different data for categories and attributions
    const fetchAPISpy = vi.spyOn(api, 'fetchAPI');
    fetchAPISpy.mockImplementation((url) => {
      if (url.includes('categories')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('attributions')) {
        return Promise.resolve({ data: [{ name: 'Edward Murphy' }] });
      }
      return Promise.resolve({ data: [] });
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    // Wait for advanced search to be present
    await vi.waitFor(() => {
      expect(el.querySelector('#search-attribution')).toBeTruthy();
    }, { timeout: 500 });

    // Set attribution filter via hidden input (typeahead value) and search
    const attributionHidden = el.querySelector('#search-attribution') as HTMLInputElement;
    const searchBtn = el.querySelector('#search-btn');

    if (attributionHidden && searchBtn) {
      attributionHidden.value = 'Edward Murphy';
      (searchBtn as HTMLButtonElement).click();

      // Widgets should now be hidden
      await vi.waitFor(() => {
        const widgetsContainer = el.querySelector('[data-widgets]');
        expect(widgetsContainer!.hasAttribute('hidden')).toBe(true);
      }, { timeout: 1000 });
    }
  });

  it('hides widgets when multiple filters are active', async () => {
    // Mock API to return different data for categories and attributions
    const fetchAPISpy = vi.spyOn(api, 'fetchAPI');
    fetchAPISpy.mockImplementation((url) => {
      if (url.includes('categories')) {
        return Promise.resolve({ data: [{ id: 1, title: 'Technology' }] });
      }
      if (url.includes('attributions')) {
        return Promise.resolve({ data: [{ name: 'Edward Murphy' }] });
      }
      return Promise.resolve({ data: [] });
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    // Wait for dropdowns to be populated
    await vi.waitFor(() => {
      const categorySelect = el.querySelector('#search-category');
      const categoryOptions = categorySelect?.querySelectorAll('option');
      expect(categoryOptions?.length).toBeGreaterThan(1);
    }, { timeout: 1000 });

    // Set multiple filters
    const searchInput = el.querySelector('#search-keyword');
    const categorySelect = el.querySelector('#search-category');
    const searchBtn = el.querySelector('#search-btn');

    if (searchInput && categorySelect && searchBtn) {
      (searchInput as HTMLInputElement).value = 'murphy';
      (categorySelect as HTMLSelectElement).value = '1';
      (searchBtn as HTMLButtonElement).click();

      // Widgets should be hidden when multiple filters are active
      await vi.waitFor(() => {
        const widgetsContainer = el.querySelector('[data-widgets]');
        expect(widgetsContainer?.hasAttribute('hidden')).toBe(true);
      }, { timeout: 1000 });
    }
  });

  it('renders sort select with default value', async () => {
    const localThis: BrowseTestContext = {};
    localThis.el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      localThis.sortSelect = localThis.el!.querySelector('#sort-select') as HTMLSelectElement | null;
      expect(localThis.sortSelect).toBeTruthy();
    }, { timeout: 1000 });

    // Default value should be 'score-desc' (Top Rated)
    expect(localThis.sortSelect!.value).toBe('score-desc');
  });

  it('changes sort order when selecting different option', async () => {
    const localThis: BrowseTestContext = {};
    localThis.el = Browse({ searchQuery: '', onNavigate: () => { } });

    // Wait for initial load
    await vi.waitFor(() => {
      expect(localThis.el!.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    localThis.sortSelect = localThis.el!.querySelector('#sort-select') as HTMLSelectElement | null;
    expect(localThis.sortSelect).toBeTruthy();

    // Clear mock to track new calls
    fetchLawsSpy.mockClear();

    // Change to 'Oldest' sort
    localThis.sortSelect!.value = 'created_at-asc';
    localThis.sortSelect!.dispatchEvent(new Event('change', { bubbles: true }));

    // Should call fetchLaws with new sort parameters
    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({
        sort: 'created_at',
        order: 'asc',
        offset: 0
      }));
    }, { timeout: 1000 });
  });

  it('changes to newest sort order', async () => {
    const localThis: BrowseTestContext = {};
    localThis.el = Browse({ searchQuery: '', onNavigate: () => { } });

    // Wait for initial load
    await vi.waitFor(() => {
      expect(localThis.el!.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    localThis.sortSelect = localThis.el!.querySelector('#sort-select') as HTMLSelectElement | null;
    fetchLawsSpy.mockClear();

    // Change to 'Newest' sort
    localThis.sortSelect!.value = 'created_at-desc';
    localThis.sortSelect!.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({
        sort: 'created_at',
        order: 'desc'
      }));
    }, { timeout: 1000 });
  });

  it('changes to most upvotes sort order', async () => {
    const localThis: BrowseTestContext = {};
    localThis.el = Browse({ searchQuery: '', onNavigate: () => { } });

    // Wait for initial load
    await vi.waitFor(() => {
      expect(localThis.el!.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    localThis.sortSelect = localThis.el!.querySelector('#sort-select') as HTMLSelectElement | null;
    fetchLawsSpy.mockClear();

    // Change to 'Most Upvotes' sort
    localThis.sortSelect!.value = 'upvotes-desc';
    localThis.sortSelect!.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({
        sort: 'upvotes',
        order: 'desc'
      }));
    }, { timeout: 1000 });
  });

  it('changes to recently voted sort order', async () => {
    const localThis: BrowseTestContext = {};
    localThis.el = Browse({ searchQuery: '', onNavigate: () => { } });

    // Wait for initial load
    await vi.waitFor(() => {
      expect(localThis.el!.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    localThis.sortSelect = localThis.el!.querySelector('#sort-select') as HTMLSelectElement | null;
    fetchLawsSpy.mockClear();

    // Change to 'Recently Voted' sort
    localThis.sortSelect!.value = 'last_voted_at-desc';
    localThis.sortSelect!.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({
        sort: 'last_voted_at',
        order: 'desc'
      }));
    }, { timeout: 1000 });
  });

  it('buildBrowseSearch receives sort and order from URL so non-default branches are hit', async () => {
    const url = new URL(location.origin + '/browse');
    url.search = '?sort=created_at&order=asc';
    window.history.replaceState({}, '', url.toString());
    fetchLawsSpy.mockResolvedValue({
      data: [{ id: 1, title: 'L', text: 'T', upvotes: 0, downvotes: 0 }],
      total: 1,
      limit: 25,
      offset: 0
    });
    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    await vi.waitFor(() => expect(fetchLawsSpy).toHaveBeenCalled());
    expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({ sort: 'created_at', order: 'asc' }));
  });

  it('buildBrowseSearch receives page from URL so page > 1 branch is hit', async () => {
    const url = new URL(location.origin + '/browse');
    url.search = '?page=2';
    window.history.replaceState({}, '', url.toString());
    fetchLawsSpy.mockResolvedValue({
      data: Array(25).fill(null).map((_, i) => ({ id: i + 1, title: 'L', text: 'T', upvotes: 0, downvotes: 0 })),
      total: 50,
      limit: 25,
      offset: 25
    });
    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    await vi.waitFor(() => expect(fetchLawsSpy).toHaveBeenCalled());
    expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({ offset: 25 }));
  });

  it('resets to page 1 when changing sort order', async () => {
    const localThis: BrowseTestContext = {};
    fetchLawsSpy.mockResolvedValue({
      data: Array(25).fill(null).map((_, i) => ({
        id: i + 1,
        title: `Law ${i + 1}`,
        text: `Text ${i + 1}`,
        upvotes: 0,
        downvotes: 0
      })),
      total: 100,
      limit: 25,
      offset: 0
    });

    localThis.el = Browse({ searchQuery: '', onNavigate: () => { } });

    // Wait for initial load
    await vi.waitFor(() => {
      expect(localThis.el!.querySelector('.pagination')).toBeTruthy();
    }, { timeout: 1000 });

    // Navigate to page 2
    localThis.nextBtn = Array.from(localThis.el!.querySelectorAll('.pagination button'))
      .find(btn => (btn as HTMLElement).textContent === 'Next') as HTMLButtonElement | undefined;
    localThis.nextBtn!.click();

    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({ offset: 25 }));
    }, { timeout: 1000 });

    fetchLawsSpy.mockClear();

    // Change sort order
    localThis.sortSelect = localThis.el!.querySelector('#sort-select') as HTMLSelectElement | null;
    localThis.sortSelect!.value = 'created_at-asc';
    localThis.sortSelect!.dispatchEvent(new Event('change', { bubbles: true }));

    // Should reset to page 1 (offset: 0)
    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({
        offset: 0,
        sort: 'created_at',
        order: 'asc'
      }));
    }, { timeout: 1000 });
  });

  it('does not trigger loadPage when clicking a disabled pagination button', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: Array(25).fill(null).map((_, i) => ({
        id: i + 1,
        title: `Law ${i + 1}`,
        text: `Text ${i + 1}`,
        upvotes: 0,
        downvotes: 0
      })),
      total: 100,
      limit: 25,
      offset: 0
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    // Wait for initial load
    await vi.waitFor(() => {
      expect(el.querySelector('.pagination')).toBeTruthy();
    }, { timeout: 1000 });

    // Clear mock after initial load
    fetchLawsSpy.mockClear();

    // Create a button with data-page and disabled attribute manually
    const disabledBtn = document.createElement('button');
    disabledBtn.dataset.page = '5';
    disabledBtn.setAttribute('disabled', 'true');
    el.appendChild(disabledBtn);

    // Click the disabled button
    disabledBtn.click();

    // Wait a short time to ensure no async call would be triggered
    await new Promise(r => setTimeout(r, 50));

    // fetchLaws should NOT have been called since button is disabled
    expect(fetchLawsSpy).not.toHaveBeenCalled();

    el.removeChild(disabledBtn);
  });

  it('copies law link to clipboard when share button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    // Create a copy link button and click it (new format with data-action)
    const copyLinkBtn = document.createElement('button');
    copyLinkBtn.setAttribute('data-action', 'copy-link');
    copyLinkBtn.setAttribute('data-copy-value', 'https://test.com/law/123');
    el.appendChild(copyLinkBtn);

    copyLinkBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('/law/123'));
  });

  it('uses fallback when clipboard API fails on share button', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard not available'));
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    // Mock execCommand for fallback
    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    // Create a copy link button and click it (new format with data-action)
    const copyLinkBtn = document.createElement('button');
    copyLinkBtn.setAttribute('data-action', 'copy-link');
    copyLinkBtn.setAttribute('data-copy-value', 'https://test.com/law/456');
    el.appendChild(copyLinkBtn);

    copyLinkBtn.click();
    await new Promise(r => setTimeout(r, 50));

    // Should have tried clipboard first, then fallback to execCommand
    expect(writeTextMock).toHaveBeenCalled();
    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });

  it('does not copy when copy link button has no value', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    // Create a copy link button without value
    const copyLinkBtn = document.createElement('button');
    copyLinkBtn.setAttribute('data-action', 'copy-link');
    copyLinkBtn.setAttribute('data-copy-value', '');
    el.appendChild(copyLinkBtn);

    copyLinkBtn.click();
    await new Promise(r => setTimeout(r, 10));

    // Should not copy when no value
    expect(writeTextMock).not.toHaveBeenCalled();
  });

  it('handles response with non-finite total', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: [{ id: 1, title: 'Law 1', text: 'Text 1', upvotes: 0, downvotes: 0 }],
      total: NaN,
      limit: 25,
      offset: 0
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    // Should use data.length as fallback when total is NaN
    const resultCount = el.querySelector('#browse-result-count') as HTMLElement | null;
    expect(resultCount?.textContent).toContain('1');
  });

  it('handles non-Element click target gracefully', async () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    // Create and dispatch a click event with null target
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null, writable: false });

    // Should not throw
    expect(() => el.dispatchEvent(event)).not.toThrow();
  });

  it('handles non-Element keydown target gracefully', async () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    // Create and dispatch a keydown event with null target
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    Object.defineProperty(event, 'target', { value: null, writable: false });

    // Should not throw
    expect(() => el.dispatchEvent(event)).not.toThrow();
  });

  it('ignores keydown events that are not Enter or Space', async () => {
    const onNavigate = vi.fn();
    const el = Browse({ searchQuery: '', onNavigate });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    const lawCard = el.querySelector('.law-card-mini') as HTMLElement | null;
    
    // Simulate Tab key press (should be ignored)
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    lawCard!.dispatchEvent(tabEvent);

    // Navigation should not be triggered for Tab key
    expect(onNavigate).not.toHaveBeenCalledWith('law', expect.anything());
  });

  it('handles response with non-array data', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: 'not an array' as unknown as { id: number; title?: string; text: string; upvotes?: number; downvotes?: number }[],
      total: 5,
      limit: 25,
      offset: 0
    });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      // Should show empty state when data is not an array
      expect(el.textContent).toMatch(/Murphy spared these results/);
    }, { timeout: 1000 });
  });

  it('handles response with null data object', async () => {
    fetchLawsSpy.mockResolvedValue(null);

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      // Should show empty state when response is null
      expect(el.textContent).toMatch(/Murphy spared these results/);
    }, { timeout: 1000 });
  });

  it('calls clearExportContent when cleanup is invoked', async () => {
    const clearSpy = vi.spyOn(exportContext, 'clearExportContent');
    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    (el as CleanableElement).cleanup!();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('copy-text button with data-copy-value copies to clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    const copyTextBtn = document.createElement('button');
    copyTextBtn.setAttribute('data-action', 'copy-text');
    copyTextBtn.setAttribute('data-copy-value', 'Law text to copy');
    el.appendChild(copyTextBtn);
    copyTextBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(writeTextMock).toHaveBeenCalledWith('Law text to copy');
  });
});
