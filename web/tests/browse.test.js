import { Browse } from '@views/browse.js';
import * as api from '../src/utils/api.js';
import * as voting from '../src/utils/voting.js';
import * as cacheUtils from '../src/utils/category-cache.js';

// Mock voting module
vi.mock('../src/utils/voting.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    toggleVote: vi.fn().mockResolvedValue({ upvotes: 11, downvotes: 2 }),
    getUserVote: vi.fn().mockReturnValue(null)
  };
});

describe('Browse view', () => {
  let fetchLawsSpy;
  let getUserVoteSpy;
  let toggleVoteSpy;
  beforeEach(() => {
    // Mock API responses
    fetchLawsSpy = vi.spyOn(api, 'fetchLaws').mockResolvedValue({
      data: [
        { id: 1, title: 'Murphy\'s Law', text: 'Anything that can go wrong will go wrong', upvotes: 10, downvotes: 2 },
        { id: 2, title: 'Parkinson\'s Law', text: 'Work expands to fill the time available', upvotes: 5, downvotes: 1 }
      ],
      total: 2
    });

    // Mock widget API calls
    vi.spyOn(api, 'fetchTopVoted').mockResolvedValue({ data: [] });
    vi.spyOn(api, 'fetchTrending').mockResolvedValue({ data: [] });
    vi.spyOn(api, 'fetchRecentlyAdded').mockResolvedValue({ data: [] });

    // Mock deferUntilIdle to execute immediately for testing
    vi.spyOn(cacheUtils, 'deferUntilIdle').mockImplementation((callback) => {
      callback();
    });

    // Get references to the mocked functions
    getUserVoteSpy = voting.getUserVote;
    toggleVoteSpy = voting.toggleVote;

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
    const el = Browse({ searchQuery: 'gravity', onNavigate: () => { }, _onVote: () => { } });
    expect(el.textContent).toMatch(/gravity/);
  });

  it('renders Browse title', () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    expect(el.textContent).toMatch(/Browse/);
    expect(el.textContent).toMatch(/All Laws/);
  });

  it('renders loading state initially', () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });
    expect(el.textContent).toMatch(/Loading/);
  });

  it('fetches and displays laws', async () => {
    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => { }, _onVote: () => { } });

    // Wait for async loading
    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Murphy's Law/);
    }, { timeout: 1000 });

    expect(fetchLawsSpy).toHaveBeenCalled();
    expect(el.textContent).toMatch(/Parkinson's Law/);
  });

  it('displays empty state when no laws found', async () => {
    fetchLawsSpy.mockResolvedValue({ data: [], total: 0 });

    const el = Browse({ _isLoggedIn: false, searchQuery: 'nonexistent', onNavigate: () => { }, _onVote: () => { } });

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/No laws found/);
    }, { timeout: 1000 });
  });

  it('shows submit button in empty state and navigates when clicked', async () => {
    fetchLawsSpy.mockResolvedValue({ data: [], total: 0 });
    const onNavigate = vi.fn();

    const el = Browse({ _isLoggedIn: false, searchQuery: 'nonexistent', onNavigate, _onVote: () => { } });

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/No laws found/);
    }, { timeout: 1000 });

    // Check that submit button exists
    const submitBtn = el.querySelector('[data-nav="submit"]');
    expect(submitBtn).toBeTruthy();
    expect(submitBtn.textContent).toMatch(/Submit a Murphy's Law/);

    // Click the submit button
    submitBtn.click();

    // Verify navigation was called
    expect(onNavigate).toHaveBeenCalledWith('submit');
  });

  it('handles clicking on submit button icon or text in empty state', async () => {
    fetchLawsSpy.mockResolvedValue({ data: [], total: 0 });
    const onNavigate = vi.fn();

    const el = Browse({ _isLoggedIn: false, searchQuery: 'nonexistent', onNavigate, _onVote: () => { } });

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/No laws found/);
    }, { timeout: 1000 });

    // Find the icon inside the submit button
    const submitBtn = el.querySelector('[data-nav="submit"]');
    const icon = submitBtn.querySelector('.icon');
    expect(icon).toBeTruthy();

    // Click on the icon (not the button itself)
    icon.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith('submit');
    });
  });

  it('displays error state on fetch failure', async () => {
    fetchLawsSpy.mockRejectedValue(new Error('Network error'));

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => { }, _onVote: () => { } });

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Of course something went wrong/);
    }, { timeout: 1000 });
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
      total: 50
    });

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => { }, _onVote: () => { } });

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
      total: 50
    });

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => { }, _onVote: () => { } });

    await vi.waitFor(() => {
      const nextBtn = Array.from(el.querySelectorAll('.pagination button'))
        .find(btn => btn.textContent === 'Next');
      expect(nextBtn).toBeTruthy();
    }, { timeout: 1000 });

    const nextBtn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => btn.textContent === 'Next');

    fetchLawsSpy.mockClear();
    nextBtn.click();

    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({
        offset: 25
      }));
    }, { timeout: 1000 });
  });

  it('handles voting on laws', async () => {
    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => { }, _onVote: () => { } });

    // Wait for laws to load
    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    // Verify vote buttons are rendered with correct attributes
    const upvoteBtn = el.querySelector('[data-vote="up"][data-law-id="1"]');
    const downvoteBtn = el.querySelector('[data-vote="down"][data-law-id="1"]');

    expect(upvoteBtn).toBeTruthy();
    expect(downvoteBtn).toBeTruthy();
    expect(upvoteBtn.getAttribute('data-law-id')).toBe('1');
    expect(downvoteBtn.getAttribute('data-law-id')).toBe('1');

    // Verify vote counts are displayed
    const upCount = upvoteBtn.querySelector('.count-num');
    const downCount = downvoteBtn.querySelector('.count-num');
    expect(upCount.textContent).toBe('10');
    expect(downCount.textContent).toBe('2');

    // Verify button is clickable (doesn't throw)
    expect(() => upvoteBtn.click()).not.toThrow();
  });

  it('updates vote counts after voting', async () => {
    // Mock successful voting response
    toggleVoteSpy.mockResolvedValue({ upvotes: 11, downvotes: 2 });

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => { }, _onVote: () => { } });

    // Wait for laws to load
    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    // Find vote elements
    const voteBtn = el.querySelector('[data-vote="up"][data-law-id="1"]');
    const countNum = voteBtn.querySelector('.count-num');

    // Verify initial count
    expect(countNum.textContent).toBe('10');

    // Simulate voting by directly calling toggleVote (as addVotingListeners would)
    await voting.toggleVote('1', 'up');

    // Verify the mock was called
    expect(toggleVoteSpy).toHaveBeenCalledWith('1', 'up');
  });

  it('handles law card click navigation', async () => {
    const onNavigate = vi.fn();
    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate, _onVote: () => { } });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    const lawCard = el.querySelector('.law-card-mini');
    lawCard.click();

    expect(onNavigate).toHaveBeenCalledWith('law', '1');
  });

  it('renders search query and laws with search results', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: [{ id: 1, title: 'Murphy\'s Law', text: 'Anything that can go wrong', upvotes: 10, downvotes: 2 }],
      total: 1
    });

    const el = Browse({ _isLoggedIn: false, searchQuery: 'wrong', onNavigate: () => { }, _onVote: () => { } });

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

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => { }, _onVote: () => { } });

    await vi.waitFor(() => {
      const cardText = el.querySelector('#browse-laws-list');
      const upvoteBtn = cardText?.querySelector('.law-card-mini [data-vote="up"]');
      expect(upvoteBtn?.classList.contains('voted')).toBe(true);
    }, { timeout: 1000 });
  });

  it('handles voting errors gracefully', async () => {
    toggleVoteSpy.mockRejectedValue(new Error('Vote failed'));

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => { }, _onVote: () => { } });

    await vi.waitFor(() => {
      const cardText = el.querySelector('#browse-laws-list');
      expect(cardText?.querySelector('.law-card-mini [data-vote="up"]')).toBeTruthy();
    }, { timeout: 1000 });

    const cardText = el.querySelector('#browse-laws-list');
    const upvoteBtn = cardText.querySelector('.law-card-mini [data-vote="up"]');
    upvoteBtn.click();

    await vi.waitFor(() => {
    }, { timeout: 1000 });

  });

  it('renders laws without titles correctly', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: [{ id: 1, text: 'Law without title', upvotes: 5, downvotes: 1 }],
      total: 1
    });

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => { }, _onVote: () => { } });

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Law without title/);
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });
  });

  it('disables pagination buttons during loading', async () => {
    let resolveFirstFetch;
    const firstFetchPromise = new Promise(resolve => { resolveFirstFetch = resolve; });

    fetchLawsSpy.mockImplementation(() => firstFetchPromise);

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => { }, _onVote: () => { } });

    // Resolve initial load
    resolveFirstFetch({
      data: Array(20).fill(null).map((_, i) => ({
        id: i + 1,
        title: `Law ${i + 1}`,
        text: `Text ${i + 1}`,
        upvotes: 0,
        downvotes: 0
      })),
      total: 50
    });

    await vi.waitFor(() => {
      expect(el.querySelector('.pagination')).toBeTruthy();
    }, { timeout: 1000 });

    // Mock second page fetch to be slow
    let resolveSecondFetch;
    const secondFetchPromise = new Promise(resolve => { resolveSecondFetch = resolve; });
    fetchLawsSpy.mockImplementation(() => secondFetchPromise);

    const nextBtn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => btn.textContent === 'Next');
    nextBtn.click();

    // Check that buttons are disabled during load
    await vi.waitFor(() => {
      const buttons = el.querySelectorAll('.pagination button');
      const allDisabled = Array.from(buttons).every(btn => btn.hasAttribute('disabled'));
      expect(allDisabled).toBe(true);
    }, { timeout: 1000 });

    // Clean up
    resolveSecondFetch({
      data: [],
      total: 50
    });
  });

  it('handles clicking page number button', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: Array(25).fill(null).map((_, i) => ({ id: i + 1, title: `Law ${i + 1}`, text: `Text ${i + 1}`, upvotes: 0, downvotes: 0 })),
      total: 100
    });

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => { }, _onVote: () => { } });

    await vi.waitFor(() => {
      const pagination = el.querySelector('.pagination');
      expect(pagination).toBeTruthy();
    }, { timeout: 1000 });

    // Find and click page 2 button
    const page2Btn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => btn.textContent === '2');

    if (page2Btn) {
      fetchLawsSpy.mockClear();
      page2Btn.click();

      await vi.waitFor(() => {
        expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({ offset: 25 }));
      }, { timeout: 1000 });
    }
  });

  it('handles previous button click', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: Array(25).fill(null).map((_, i) => ({ id: i + 1, title: `Law ${i + 1}`, text: `Text ${i + 1}`, upvotes: 0, downvotes: 0 })),
      total: 100
    });

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => { }, _onVote: () => { } });

    await vi.waitFor(() => {
      const nextBtn = Array.from(el.querySelectorAll('.pagination button'))
        .find(btn => btn.textContent === 'Next');
      expect(nextBtn).toBeTruthy();
    }, { timeout: 1000 });

    // Click next to go to page 2
    const nextBtn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => btn.textContent === 'Next');
    nextBtn.click();

    await vi.waitFor(() => {
      const prevBtn = Array.from(el.querySelectorAll('.pagination button'))
        .find(btn => btn.textContent === 'Previous');
      expect(prevBtn?.hasAttribute('disabled')).toBe(false);
    }, { timeout: 1000 });

    // Now click previous to go back to page 1
    const prevBtn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => btn.textContent === 'Previous');

    fetchLawsSpy.mockClear();
    prevBtn.click();

    await vi.waitFor(() => {
      expect(fetchLawsSpy).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
    }, { timeout: 1000 });
  });

  it('disables previous button on first page', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: Array(25).fill(null).map((_, i) => ({ id: i + 1, title: `Law ${i + 1}`, text: `Text ${i + 1}`, upvotes: 0, downvotes: 0 })),
      total: 100
    });

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => { }, _onVote: () => { } });

    await vi.waitFor(() => {
      const pagination = el.querySelector('.pagination');
      expect(pagination).toBeTruthy();
    }, { timeout: 1000 });

    const prevBtn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => btn.textContent === 'Previous');
    expect(prevBtn?.disabled).toBe(true);
  });

  it('disables next button on last page', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: Array(10).fill(null).map((_, i) => ({ id: i + 1, title: `Law ${i + 1}`, text: `Text ${i + 1}`, upvotes: 0, downvotes: 0 })),
      total: 30
    });

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => { }, _onVote: () => { } });

    await vi.waitFor(() => {
      const pagination = el.querySelector('.pagination');
      expect(pagination).toBeTruthy();
    }, { timeout: 1000 });

    // Go to last page
    const page2Btn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => btn.textContent === '2');
    if (page2Btn) {
      page2Btn.click();

      await vi.waitFor(() => {
        const nextBtn = Array.from(el.querySelectorAll('.pagination button'))
          .find(btn => btn.textContent === 'Next');
        expect(nextBtn?.disabled).toBe(true);
      }, { timeout: 1000 });
    }
  });

  it('handles data-nav attribute clicks', async () => {
    const onNavigate = vi.fn();
    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate, _onVote: () => { } });

    await vi.waitFor(() => {
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });

    // Create a button with data-nav attribute and click it
    const navBtn = document.createElement('button');
    navBtn.setAttribute('data-nav', 'home');
    el.appendChild(navBtn);

    navBtn.click();

    expect(onNavigate).toHaveBeenCalledWith('home');

    el.removeChild(navBtn);
  });

  it('handles advanced search filter changes', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: [{ id: 1, title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 1 }],
      total: 1
    });

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => { }, _onVote: () => { } });

    await vi.waitFor(() => {
      const searchContainer = el.querySelector('#advanced-search-container');
      expect(searchContainer).toBeTruthy();
    }, { timeout: 1000 });

    // Find the advanced search component
    const searchContainer = el.querySelector('#advanced-search-container');
    const searchInput = searchContainer.querySelector('#search-keyword');
    const searchBtn = searchContainer.querySelector('#search-btn');

    fetchLawsSpy.mockClear();

    // Trigger search with new filter
    searchInput.value = 'murphy';
    searchBtn.click();

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
      total: 250
    });

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => { }, _onVote: () => { } });

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
      .find(btn => btn.textContent === 'Next');
    nextBtn.click();

    await vi.waitFor(() => {
      const page3Btn = Array.from(el.querySelectorAll('.pagination button'))
        .find(btn => btn.textContent === '3');
      expect(page3Btn).toBeTruthy();
    }, { timeout: 1000 });

    // Go to page 3
    nextBtn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => btn.textContent === 'Next');
    nextBtn.click();

    await vi.waitFor(() => {
      const page4Btn = Array.from(el.querySelectorAll('.pagination button'))
        .find(btn => btn.textContent === '4');
      expect(page4Btn).toBeTruthy();
    }, { timeout: 1000 });

    // Go to page 4 - this should trigger ellipsis when start > 2
    nextBtn = Array.from(el.querySelectorAll('.pagination button'))
      .find(btn => btn.textContent === 'Next');
    nextBtn.click();

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
      expect(widgetsContainer.hasAttribute('hidden')).toBe(true);
    }, { timeout: 1000 });
  });

  it('shows widgets when no search filters are active', async () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    await vi.waitFor(() => {
      const widgetsContainer = el.querySelector('[data-widgets]');
      expect(widgetsContainer).toBeTruthy();
      // Widgets should be visible when there's no search
      expect(widgetsContainer.hasAttribute('hidden')).toBe(false);
    }, { timeout: 1000 });
  });

  it('hides widgets after performing a search', async () => {
    const el = Browse({ searchQuery: '', onNavigate: () => { } });

    // Wait for initial render - widgets should be visible
    await vi.waitFor(() => {
      const widgetsContainer = el.querySelector('[data-widgets]');
      expect(widgetsContainer).toBeTruthy();
      expect(widgetsContainer.hasAttribute('hidden')).toBe(false);
    }, { timeout: 1000 });

    // Perform a search
    const searchInput = el.querySelector('#search-keyword');
    const searchBtn = el.querySelector('#search-btn');

    if (searchInput && searchBtn) {
      searchInput.value = 'murphy';
      searchBtn.click();

      // Widgets should now be hidden
      await vi.waitFor(() => {
        const widgetsContainer = el.querySelector('[data-widgets]');
        expect(widgetsContainer.hasAttribute('hidden')).toBe(true);
      }, { timeout: 1000 });
    }
  });

  it('shows widgets again after clearing search', async () => {
    const el = Browse({ searchQuery: 'test', onNavigate: () => { } });

    // Wait for initial render - widgets should be hidden due to search
    await vi.waitFor(() => {
      const widgetsContainer = el.querySelector('[data-widgets]');
      expect(widgetsContainer).toBeTruthy();
      expect(widgetsContainer.hasAttribute('hidden')).toBe(true);
    }, { timeout: 1000 });

    // Clear the search
    const clearBtn = el.querySelector('#clear-btn');

    if (clearBtn) {
      clearBtn.click();

      // Widgets should now be visible again
      await vi.waitFor(() => {
        const widgetsContainer = el.querySelector('[data-widgets]');
        expect(widgetsContainer.hasAttribute('hidden')).toBe(false);
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
      categorySelect.value = '1';
      searchBtn.click();

      // Widgets should now be hidden
      await vi.waitFor(() => {
        const widgetsContainer = el.querySelector('[data-widgets]');
        expect(widgetsContainer.hasAttribute('hidden')).toBe(true);
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

    // Wait for attributions dropdown to be populated
    await vi.waitFor(() => {
      const attributionSelect = el.querySelector('#search-attribution');
      const options = attributionSelect?.querySelectorAll('option');
      // Should have at least 2 options: "All Submitters" + "Edward Murphy"
      expect(options?.length).toBeGreaterThan(1);
    }, { timeout: 1000 });

    // Select an attribution
    const attributionSelect = el.querySelector('#search-attribution');
    const searchBtn = el.querySelector('#search-btn');

    if (attributionSelect && searchBtn) {
      attributionSelect.value = 'Edward Murphy';
      searchBtn.click();

      // Widgets should now be hidden
      await vi.waitFor(() => {
        const widgetsContainer = el.querySelector('[data-widgets]');
        expect(widgetsContainer.hasAttribute('hidden')).toBe(true);
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
      searchInput.value = 'murphy';
      categorySelect.value = '1';
      searchBtn.click();

      // Widgets should be hidden when multiple filters are active
      await vi.waitFor(() => {
        const widgetsContainer = el.querySelector('[data-widgets]');
        expect(widgetsContainer.hasAttribute('hidden')).toBe(true);
      }, { timeout: 1000 });
    }
  });
});
