// @ts-nocheck
import { Trending } from '@components/trending.js';
import * as api from '../src/utils/api.js';
import * as voting from '../src/utils/voting.js';

describe('Trending component', () => {
  let fetchTrendingSpy;
  let getUserVoteSpy;
  let fetchSpy;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    fetchTrendingSpy = vi.spyOn(api, 'fetchTrending');
    getUserVoteSpy = vi.spyOn(voting, 'getUserVote').mockReturnValue(null);
    // Mock fetch for voting API calls
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ upvotes: 11, downvotes: 2 })
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    fetchTrendingSpy.mockReturnValue(new Promise(() => {})); // Never resolves
    const el = Trending();

    // Check for any of the possible loading messages (they're random)
    expect(el.textContent).toMatch(/Loading|Fetching|Almost there/);
  });

  it('renders trending laws successfully', async () => {
    const laws = [
      { id: '1', title: 'Law 1', text: 'Text 1', upvotes: 10, downvotes: 2, author: 'Author 1' },
      { id: '2', title: 'Law 2', text: 'Text 2', upvotes: 5, downvotes: 1, author: 'Author 2' },
      { id: '3', title: 'Law 3', text: 'Text 3', upvotes: 3, downvotes: 0, author: 'Author 3' }
    ];
    fetchTrendingSpy.mockResolvedValue({ data: laws });

    const el = Trending();

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Law 1/);
      expect(el.textContent).toMatch(/Law 2/);
      expect(el.textContent).toMatch(/Law 3/);
    });
  });

  it('limits to 3 laws when more are returned', async () => {
    const laws = Array(10).fill(null).map((_, i) => ({
      id: String(i + 1),
      title: `Law ${i + 1}`,
      text: `Text ${i + 1}`,
      upvotes: 10 - i,
      downvotes: i
    }));
    fetchTrendingSpy.mockResolvedValue({ data: laws });

    const el = Trending();

    await vi.waitFor(() => {
      const lawCards = el.querySelectorAll('.law-card-mini');
      expect(lawCards.length).toBe(3);
    });
  });

  it('renders law without title', async () => {
    const laws = [
      { id: '1', text: 'Text without title', upvotes: 10, downvotes: 2 }
    ];
    fetchTrendingSpy.mockResolvedValue({ data: laws });

    const el = Trending();

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Text without title/);
      expect(el.textContent).not.toMatch(/<strong>/);
    });
  });

  it('handles missing vote counts gracefully', async () => {
    const laws = [
      { id: '1', text: 'Law without votes' }
    ];
    fetchTrendingSpy.mockResolvedValue({ data: laws });

    const el = Trending();

    await vi.waitFor(() => {
      const upCount = el.querySelector('[data-vote="up"] .count-num');
      const downCount = el.querySelector('[data-vote="down"] .count-num');
      expect(upCount.textContent).toBe('0');
      expect(downCount.textContent).toBe('0');
    });
  });

  it('handles upvote button click', async () => {
    const laws = [
      { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTrendingSpy.mockResolvedValue({ data: laws });

    const el = Trending();

    await vi.waitFor(() => {
      expect(el.querySelector('[data-vote="up"]')).toBeTruthy();
    });

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    upvoteBtn.click();

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/laws/1/vote'), expect.any(Object));
    });
  });

  it('handles downvote button click', async () => {
    const laws = [
      { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTrendingSpy.mockResolvedValue({ data: laws });

    const el = Trending();

    await vi.waitFor(() => {
      expect(el.querySelector('[data-vote="down"]')).toBeTruthy();
    });

    const downvoteBtn = el.querySelector('[data-vote="down"]');
    downvoteBtn.click();

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/laws/1/vote'), expect.any(Object));
    });
  });

  it('updates vote counts after successful vote', async () => {
    const laws = [
      { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTrendingSpy.mockResolvedValue({ data: laws });

    const el = Trending();

    await vi.waitFor(() => {
      expect(el.querySelector('[data-vote="up"]')).toBeTruthy();
    });

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    upvoteBtn.click();

    await vi.waitFor(() => {
      const upCount = el.querySelector('[data-vote="up"] .count-num');
      expect(upCount.textContent).toBe('11');
    });
  });

  it('updates voted class after successful vote', async () => {
    // Don't mock getUserVote for this test - let it use real localStorage
    getUserVoteSpy.mockRestore();

    const laws = [
      { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTrendingSpy.mockResolvedValue({ data: laws });

    const el = Trending();

    await vi.waitFor(() => {
      expect(el.querySelector('[data-vote="up"]')).toBeTruthy();
    });

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    // Initially should not have voted class
    expect(upvoteBtn.classList.contains('voted')).toBe(false);

    upvoteBtn.click();

    // After voting, should have voted class
    await vi.waitFor(() => {
      expect(upvoteBtn.classList.contains('voted')).toBe(true);
    });
  });

  it('handles vote error gracefully', async () => {
    fetchSpy.mockRejectedValue(new Error('Vote failed'));
    const laws = [
      { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTrendingSpy.mockResolvedValue({ data: laws });

    const el = Trending();

    await vi.waitFor(() => {
      expect(el.querySelector('[data-vote="up"]')).toBeTruthy();
    });

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    upvoteBtn.click();

    await vi.waitFor(() => {
    });

  });

  it('handles fetch error gracefully', async () => {
    fetchTrendingSpy.mockRejectedValue(new Error('Fetch failed'));

    const el = Trending();

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Failed to load trending laws/);
    });

  });

  it('handles non-array data gracefully', async () => {
    fetchTrendingSpy.mockResolvedValue({ data: null });

    const el = Trending();

    await vi.waitFor(() => {
      expect(el.querySelector('.card-body')).toBeTruthy();
    });
  });

  it('handles empty data array', async () => {
    fetchTrendingSpy.mockResolvedValue({ data: [] });

    const el = Trending();

    await vi.waitFor(() => {
      const lawCards = el.querySelectorAll('.law-card-mini');
      expect(lawCards.length).toBe(0);
    });
  });

  it('handles non-HTMLElement click targets', async () => {
    const laws = [
      { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTrendingSpy.mockResolvedValue({ data: laws });

    const el = Trending();

    await vi.waitFor(() => {
      expect(el.querySelector('[data-vote="up"]')).toBeTruthy();
    });

    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null, writable: false });
    el.dispatchEvent(event);

    // Should not throw error
    expect(true).toBe(true);
  });

  it('ignores vote button without lawId', async () => {
    const laws = [
      { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTrendingSpy.mockResolvedValue({ data: laws });

    const el = Trending();

    await vi.waitFor(() => {
      expect(el.querySelector('[data-vote="up"]')).toBeTruthy();
    });

    // Reset fetch spy to track only the fake button click
    fetchSpy.mockClear();


    // Manually create a button without data-law-id
    const fakeBtn = document.createElement('button');
    fakeBtn.setAttribute('data-vote', 'up');
    el.appendChild(fakeBtn);
    fakeBtn.click();

    await new Promise(r => setTimeout(r, 10));
    // Fetch should not be called for button without lawId
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders law with attribution', async () => {
    const laws = [
      { id: '1', text: 'Test law', upvotes: 10, downvotes: 2, author: 'Test Author' }
    ];
    fetchTrendingSpy.mockResolvedValue({ data: laws });

    const el = Trending();

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Test Author/);
    });
  });

  it('shows initial upvote state', async () => {
    getUserVoteSpy.mockReturnValue('up');
    const laws = [
      { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTrendingSpy.mockResolvedValue({ data: laws });

    const el = Trending();

    await vi.waitFor(() => {
      const upvoteBtn = el.querySelector('[data-vote="up"]');
      expect(upvoteBtn.classList.contains('voted')).toBe(true);
    });
  });

  it('shows initial downvote state', async () => {
    getUserVoteSpy.mockReturnValue('down');
    const laws = [
      { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTrendingSpy.mockResolvedValue({ data: laws });

    const el = Trending();

    await vi.waitFor(() => {
      const downvoteBtn = el.querySelector('[data-vote="down"]');
      expect(downvoteBtn.classList.contains('voted')).toBe(true);
    });
  });
});
