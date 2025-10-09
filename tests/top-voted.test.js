import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TopVoted } from '@components/top-voted.js';
import * as api from '../src/utils/api.js';
import * as voting from '../src/utils/voting.js';

describe('TopVoted component', () => {
  let fetchTopVotedSpy;
  let getUserVoteSpy;
  let toggleVoteSpy;

  beforeEach(() => {
    fetchTopVotedSpy = vi.spyOn(api, 'fetchTopVoted');
    getUserVoteSpy = vi.spyOn(voting, 'getUserVote').mockReturnValue(null);
    toggleVoteSpy = vi.spyOn(voting, 'toggleVote').mockResolvedValue({ upvotes: 11, downvotes: 2 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    fetchTopVotedSpy.mockReturnValue(new Promise(() => {})); // Never resolves
    const el = TopVoted();

    expect(el.textContent).toMatch(/Loading/);
  });

  it('renders top voted laws successfully, skipping first', async () => {
    const laws = [
      { id: '1', title: 'LOTD', text: 'Law of the day', upvotes: 100, downvotes: 0, author: 'Author 1' },
      { id: '2', title: 'Law 2', text: 'Text 2', upvotes: 50, downvotes: 5, author: 'Author 2' },
      { id: '3', title: 'Law 3', text: 'Text 3', upvotes: 30, downvotes: 3, author: 'Author 3' },
      { id: '4', title: 'Law 4', text: 'Text 4', upvotes: 20, downvotes: 2, author: 'Author 4' }
    ];
    fetchTopVotedSpy.mockResolvedValue({ data: laws });

    const el = TopVoted();

    await vi.waitFor(() => {
      expect(el.textContent).not.toMatch(/LOTD/);
      expect(el.textContent).toMatch(/Law 2/);
      expect(el.textContent).toMatch(/Law 3/);
      expect(el.textContent).toMatch(/Law 4/);
    });
  });

  it('renders rank numbers starting from #2', async () => {
    const laws = [
      { id: '1', title: 'LOTD', text: 'Law of the day', upvotes: 100, downvotes: 0 },
      { id: '2', title: 'Law 2', text: 'Text 2', upvotes: 50, downvotes: 5 },
      { id: '3', title: 'Law 3', text: 'Text 3', upvotes: 30, downvotes: 3 },
      { id: '4', title: 'Law 4', text: 'Text 4', upvotes: 20, downvotes: 2 }
    ];
    fetchTopVotedSpy.mockResolvedValue({ data: laws });

    const el = TopVoted();

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/#2/);
      expect(el.textContent).toMatch(/#3/);
      expect(el.textContent).toMatch(/#4/);
      expect(el.textContent).not.toMatch(/#1/);
    });
  });

  it('renders law without title', async () => {
    const laws = [
      { id: '1', text: 'LOTD', upvotes: 100, downvotes: 0 },
      { id: '2', text: 'Text without title', upvotes: 10, downvotes: 2 }
    ];
    fetchTopVotedSpy.mockResolvedValue({ data: laws });

    const el = TopVoted();

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Text without title/);
    });
  });

  it('handles missing vote counts gracefully', async () => {
    const laws = [
      { id: '1', text: 'LOTD', upvotes: 100, downvotes: 0 },
      { id: '2', text: 'Law without votes' }
    ];
    fetchTopVotedSpy.mockResolvedValue({ data: laws });

    const el = TopVoted();

    await vi.waitFor(() => {
      const upCount = el.querySelector('[data-vote="up"] .count-num');
      const downCount = el.querySelector('[data-vote="down"] .count-num');
      expect(upCount.textContent).toBe('0');
      expect(downCount.textContent).toBe('0');
    });
  });

  it('handles upvote button click', async () => {
    const laws = [
      { id: '1', text: 'LOTD', upvotes: 100, downvotes: 0 },
      { id: '2', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTopVotedSpy.mockResolvedValue({ data: laws });

    const el = TopVoted();

    await vi.waitFor(() => {
      expect(el.querySelector('[data-vote="up"]')).toBeTruthy();
    });

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    upvoteBtn.click();

    await vi.waitFor(() => {
      expect(toggleVoteSpy).toHaveBeenCalledWith('2', 'up');
    });
  });

  it('handles downvote button click', async () => {
    const laws = [
      { id: '1', text: 'LOTD', upvotes: 100, downvotes: 0 },
      { id: '2', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTopVotedSpy.mockResolvedValue({ data: laws });

    const el = TopVoted();

    await vi.waitFor(() => {
      expect(el.querySelector('[data-vote="down"]')).toBeTruthy();
    });

    const downvoteBtn = el.querySelector('[data-vote="down"]');
    downvoteBtn.click();

    await vi.waitFor(() => {
      expect(toggleVoteSpy).toHaveBeenCalledWith('2', 'down');
    });
  });

  it('updates vote counts after successful vote', async () => {
    toggleVoteSpy.mockResolvedValue({ upvotes: 11, downvotes: 2 });
    const laws = [
      { id: '1', text: 'LOTD', upvotes: 100, downvotes: 0 },
      { id: '2', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTopVotedSpy.mockResolvedValue({ data: laws });

    const el = TopVoted();

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
    toggleVoteSpy.mockResolvedValue({ upvotes: 11, downvotes: 2 });
    getUserVoteSpy.mockReturnValueOnce(null).mockReturnValue('up');
    const laws = [
      { id: '1', text: 'LOTD', upvotes: 100, downvotes: 0 },
      { id: '2', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTopVotedSpy.mockResolvedValue({ data: laws });

    const el = TopVoted();

    await vi.waitFor(() => {
      expect(el.querySelector('[data-vote="up"]')).toBeTruthy();
    });

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    upvoteBtn.click();

    await vi.waitFor(() => {
      expect(upvoteBtn.classList.contains('voted')).toBe(true);
    });
  });

  it('handles vote error gracefully', async () => {
    toggleVoteSpy.mockRejectedValue(new Error('Vote failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const laws = [
      { id: '1', text: 'LOTD', upvotes: 100, downvotes: 0 },
      { id: '2', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTopVotedSpy.mockResolvedValue({ data: laws });

    const el = TopVoted();

    await vi.waitFor(() => {
      expect(el.querySelector('[data-vote="up"]')).toBeTruthy();
    });

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    upvoteBtn.click();

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to vote:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('handles fetch error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchTopVotedSpy.mockRejectedValue(new Error('Fetch failed'));

    const el = TopVoted();

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Failed to load top voted laws/);
    });

    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch top voted laws:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('handles non-array data gracefully', async () => {
    fetchTopVotedSpy.mockResolvedValue({ data: null });

    const el = TopVoted();

    await vi.waitFor(() => {
      expect(el.querySelector('.card-content')).toBeTruthy();
    });
  });

  it('handles empty data array', async () => {
    fetchTopVotedSpy.mockResolvedValue({ data: [] });

    const el = TopVoted();

    await vi.waitFor(() => {
      const lawCards = el.querySelectorAll('.law-card-mini');
      expect(lawCards.length).toBe(0);
    });
  });

  it('handles non-HTMLElement click targets', async () => {
    const laws = [
      { id: '1', text: 'LOTD', upvotes: 100, downvotes: 0 },
      { id: '2', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTopVotedSpy.mockResolvedValue({ data: laws });

    const el = TopVoted();

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
      { id: '1', text: 'LOTD', upvotes: 100, downvotes: 0 },
      { id: '2', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTopVotedSpy.mockResolvedValue({ data: laws });

    const el = TopVoted();

    await vi.waitFor(() => {
      expect(el.querySelector('[data-vote="up"]')).toBeTruthy();
    });

    // Manually create a button without data-law-id
    const fakeBtn = document.createElement('button');
    fakeBtn.setAttribute('data-vote', 'up');
    el.appendChild(fakeBtn);
    fakeBtn.click();

    await new Promise(r => setTimeout(r, 10));
    // toggleVote should not be called
    expect(toggleVoteSpy).not.toHaveBeenCalled();
  });

  it('renders law with attribution', async () => {
    const laws = [
      { id: '1', text: 'LOTD', upvotes: 100, downvotes: 0 },
      { id: '2', text: 'Test law', upvotes: 10, downvotes: 2, author: 'Test Author' }
    ];
    fetchTopVotedSpy.mockResolvedValue({ data: laws });

    const el = TopVoted();

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Test Author/);
    });
  });

  it('shows initial upvote state', async () => {
    getUserVoteSpy.mockReturnValue('up');
    const laws = [
      { id: '1', text: 'LOTD', upvotes: 100, downvotes: 0 },
      { id: '2', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTopVotedSpy.mockResolvedValue({ data: laws });

    const el = TopVoted();

    await vi.waitFor(() => {
      const upvoteBtn = el.querySelector('[data-vote="up"]');
      expect(upvoteBtn.classList.contains('voted')).toBe(true);
    });
  });

  it('shows initial downvote state', async () => {
    getUserVoteSpy.mockReturnValue('down');
    const laws = [
      { id: '1', text: 'LOTD', upvotes: 100, downvotes: 0 },
      { id: '2', text: 'Test law', upvotes: 10, downvotes: 2 }
    ];
    fetchTopVotedSpy.mockResolvedValue({ data: laws });

    const el = TopVoted();

    await vi.waitFor(() => {
      const downvoteBtn = el.querySelector('[data-vote="down"]');
      expect(downvoteBtn.classList.contains('voted')).toBe(true);
    });
  });
});
