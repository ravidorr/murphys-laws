import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    const el = Browse({ _isLoggedIn: false, searchQuery: 'gravity', onNavigate: () => {}, _onVote: () => {} });
    expect(el.textContent).toMatch(/gravity/);
  });

  it('renders Browse title', () => {
    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });
    expect(el.textContent).toMatch(/Browse/);
    expect(el.textContent).toMatch(/All Laws/);
  });

  it('renders loading state initially', () => {
    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });
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
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });

    await vi.waitFor(() => {
      expect(el.querySelector('[data-vote="up"]')).toBeTruthy();
    }, { timeout: 1000 });

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    upvoteBtn.click();

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to vote:', expect.any(Error));
    }, { timeout: 1000 });

    consoleSpy.mockRestore();
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
});

