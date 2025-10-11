import { Browse } from '@views/browse.js';
import * as api from '../src/utils/api.js';
import * as voting from '../src/utils/voting.js';

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

    getUserVoteSpy = vi.spyOn(voting, 'getUserVote').mockReturnValue(null);
    toggleVoteSpy = vi.spyOn(voting, 'toggleVote').mockResolvedValue({ upvotes: 11, downvotes: 2 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows search query when provided', () => {
    const el = Browse({ searchQuery: 'gravity', onNavigate: () => {}, _onVote: () => {} });
    expect(el.textContent).toMatch(/gravity/);
  });

  it('renders Browse title', () => {
    const el = Browse({ searchQuery: '', onNavigate: () => {} });
    expect(el.textContent).toMatch(/Browse/);
    expect(el.textContent).toMatch(/All Laws/);
  });

  it('renders loading state initially', () => {
    const el = Browse({ searchQuery: '', onNavigate: () => {} });
    expect(el.textContent).toMatch(/Loading/);
  });

  it('fetches and displays laws', async () => {
    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });

    // Wait for async loading
    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Murphy's Law/);
    }, { timeout: 1000 });

    expect(fetchLawsSpy).toHaveBeenCalled();
    expect(el.textContent).toMatch(/Parkinson's Law/);
  });

  it('displays empty state when no laws found', async () => {
    fetchLawsSpy.mockResolvedValue({ data: [], total: 0 });

    const el = Browse({ _isLoggedIn: false, searchQuery: 'nonexistent', onNavigate: () => {}, _onVote: () => {} });

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/No laws found/);
    }, { timeout: 1000 });
  });

  it('displays error state on fetch failure', async () => {
    fetchLawsSpy.mockRejectedValue(new Error('Network error'));

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Failed to load laws/);
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

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });

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

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });

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
    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });

    await vi.waitFor(() => {
      expect(el.querySelector('[data-vote="up"]')).toBeTruthy();
    }, { timeout: 1000 });

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    upvoteBtn.click();

    await vi.waitFor(() => {
      expect(toggleVoteSpy).toHaveBeenCalledWith('1', 'up');
    }, { timeout: 1000 });
  });

  it('updates vote counts after voting', async () => {
    toggleVoteSpy.mockResolvedValue({ upvotes: 11, downvotes: 2 });
    getUserVoteSpy.mockReturnValue('up');

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });

    await vi.waitFor(() => {
      expect(el.querySelector('[data-vote="up"]')).toBeTruthy();
    }, { timeout: 1000 });

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    upvoteBtn.click();

    await vi.waitFor(() => {
      const countNum = upvoteBtn.querySelector('.count-num');
      expect(countNum.textContent).toBe('11');
    }, { timeout: 1000 });
  });

  it('handles law card click navigation', async () => {
    const onNavigate = vi.fn();
    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate, _onVote: () => {} });

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

    const el = Browse({ _isLoggedIn: false, searchQuery: 'wrong', onNavigate: () => {}, _onVote: () => {} });

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

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });

    await vi.waitFor(() => {
      const upvoteBtn = el.querySelector('[data-vote="up"]');
      expect(upvoteBtn.classList.contains('voted')).toBe(true);
    }, { timeout: 1000 });
  });

  it('handles voting errors gracefully', async () => {
    toggleVoteSpy.mockRejectedValue(new Error('Vote failed'));

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });

    await vi.waitFor(() => {
      expect(el.querySelector('[data-vote="up"]')).toBeTruthy();
    }, { timeout: 1000 });

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    upvoteBtn.click();

    await vi.waitFor(() => {
    }, { timeout: 1000 });

  });

  it('renders laws without titles correctly', async () => {
    fetchLawsSpy.mockResolvedValue({
      data: [{ id: 1, text: 'Law without title', upvotes: 5, downvotes: 1 }],
      total: 1
    });

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Law without title/);
      expect(el.querySelector('.law-card-mini')).toBeTruthy();
    }, { timeout: 1000 });
  });

  it('disables pagination buttons during loading', async () => {
    let resolveFirstFetch;
    const firstFetchPromise = new Promise(resolve => { resolveFirstFetch = resolve; });

    fetchLawsSpy.mockImplementation(() => firstFetchPromise);

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });

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

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });

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

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });

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

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });

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

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });

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
    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate, _onVote: () => {} });

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

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });

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

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });

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
});
