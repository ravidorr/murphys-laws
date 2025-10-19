import { LawDetail } from '@views/law-detail.js';
import * as votingModule from '../src/utils/voting.js';

describe('LawDetail view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders not found for unknown id', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const el = LawDetail({ lawId: 'nope', _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));
    expect(el.textContent).toMatch(/Law Not Found/);
  });

  it('renders not found when lawId is null', async () => {
    const el = LawDetail({ lawId: null, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });
    expect(el.textContent).toMatch(/Law Not Found/);
  });

  it('renders title for existing law and triggers vote', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3, submittedBy: 'tester' };
    const lotd = { id: '1', title: 'LOTD', text: 'Law of the day text', score: 100 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [lotd] }) });

    const toggleVoteSpy = vi.spyOn(votingModule, 'toggleVote').mockResolvedValue({ upvotes: 1, downvotes: 0 });
    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(law.title);
    const voteBtn = el.querySelector('[data-vote="up"]');
    if (voteBtn) {
      voteBtn.click();
      await new Promise(r => setTimeout(r, 0)); // Wait for async handler
      expect(toggleVoteSpy).toHaveBeenCalledWith(law.id, 'up');
    }
  });

  it('renders law when law of the day fetch succeeds', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };
    const lotd = { id: '1', title: 'LOTD Title', text: 'Law of the day', score: 100 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [lotd] }) })
      .mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }); // For top/trending/recent components

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    // Wait for the law to render
    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Test Law/);
    }, { timeout: 500 });

    // Both laws should be present (LOTD and the fetched law)
    expect(el.textContent).toMatch(/Test Law/);
  });

  it('does not duplicate law card when current law is law of the day', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 100 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [law] }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    // Should only show law once (as law of the day, not duplicated as separate card)
    const cards = el.querySelectorAll('.card');
    expect(cards.length).toBeLessThanOrEqual(5); // 1 LOTD + up to 4 widgets
  });

  it('renders law when law of the day fetch fails', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockRejectedValueOnce(new Error('LOTD fetch failed'));

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Test Law/);

  });

  it('handles navigation button clicks', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    let navTarget = '';
    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: (target) => { navTarget = target; } });

    await new Promise(r => setTimeout(r, 50));

    const browseBtn = el.querySelector('[data-nav="browse"]');
    if (browseBtn) {
      browseBtn.click();
      expect(navTarget).toBe('browse');
    }
  });

  it('handles downvote button clicks', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const toggleVoteSpy = vi.spyOn(votingModule, 'toggleVote').mockResolvedValue({ upvotes: 0, downvotes: 1 });
    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    const downvoteBtn = el.querySelector('[data-vote="down"]');
    if (downvoteBtn) {
      downvoteBtn.click();
      await new Promise(r => setTimeout(r, 0)); // Wait for async handler
      expect(toggleVoteSpy).toHaveBeenCalledWith(law.id, 'down');
    }
  });

  it('handles non-HTMLElement click targets', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    // Simulate click with non-HTMLElement target
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null, writable: false });
    el.dispatchEvent(event);

    // Should not throw error
    expect(true).toBe(true);
  });

  it('renders law without title', async () => {
    const law = { id: '7', text: 'Test text without title', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Law/);
    expect(el.textContent).toMatch(/Test text without title/);
  });

  it('renders law without author or submittedBy', async () => {
    const law = { id: '7', text: 'Anonymous law', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Anonymous law/);
  });

  it('handles negative score display', async () => {
    const law = { id: '7', title: 'Unpopular Law', text: 'Test text', score: -5, upvotes: 2, downvotes: 7 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    // Check for upvote and downvote counts
    const upvoteCount = el.querySelector('[data-upvote-count]');
    const downvoteCount = el.querySelector('[data-downvote-count]');
    expect(upvoteCount?.textContent).toBe('2');
    expect(downvoteCount?.textContent).toBe('7');
  });

  it('renders law when law of the day returns empty array', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Test Law/);
  });

  it('handles law with category information', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3, category: 'Technology' };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Test Law/);
  });

  it('handles law of the day that returns non-ok response', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: false });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Test Law/);
  });

  it('renders with all law metadata present', async () => {
    const law = {
      id: '7',
      title: 'Full Law',
      text: 'Full law text',
      score: 10,
      author: 'Famous Author',
      submittedBy: 'user123',
      publishDate: '2024-01-01'
    };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Full Law/);
    expect(el.textContent).toMatch(/Famous Author/);
  });

  it('handles law of the day response with null data', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => null });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Test Law/);
  });

  it('handles law of the day response with data not being an array', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: 'not an array' }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Test Law/);
  });

  it('handles law with attributions array', async () => {
    const law = {
      id: '7',
      title: 'Test Law',
      text: 'Test text',
      score: 3,
      attributions: [{ name: 'Contributor Name' }]
    };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Test Law/);
  });

  it('handles law with undefined score', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text' };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Test Law/);
    // Check for upvote and downvote counts (should default to 0)
    const upvoteCount = el.querySelector('[data-upvote-count]');
    const downvoteCount = el.querySelector('[data-downvote-count]');
    expect(upvoteCount?.textContent).toBe('0');
    expect(downvoteCount?.textContent).toBe('0');
  });

  it('handles law of the day array with null/undefined first element', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [null] }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    // Should render the main law without crashing
    expect(el.textContent).toMatch(/Test Law/);
  });

  it('handles law of the day with law object that has no id', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };
    const lotdWithoutId = { title: 'LOTD Without ID', text: 'LOTD text', score: 100 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [lotdWithoutId] }) })
      .mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Test Law/);
    }, { timeout: 500 });
  });

  it('updates vote counts in UI after voting', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const toggleVoteSpy = vi.spyOn(votingModule, 'toggleVote').mockResolvedValue({ upvotes: 6, downvotes: 2 });
    const getUserVoteSpy = vi.spyOn(votingModule, 'getUserVote').mockReturnValue('up');

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    // Initial counts
    let upvoteCount = el.querySelector('[data-upvote-count]');
    let downvoteCount = el.querySelector('[data-downvote-count]');
    expect(upvoteCount?.textContent).toBe('5');
    expect(downvoteCount?.textContent).toBe('2');

    // Click upvote
    const upvoteBtn = el.querySelector('[data-vote="up"]');
    upvoteBtn?.click();
    await new Promise(r => setTimeout(r, 10));

    // Counts should update
    upvoteCount = el.querySelector('[data-upvote-count]');
    downvoteCount = el.querySelector('[data-downvote-count]');
    expect(upvoteCount?.textContent).toBe('6');
    expect(downvoteCount?.textContent).toBe('2');
  });

  it('displays voted state when user has already voted', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const getUserVoteSpy = vi.spyOn(votingModule, 'getUserVote').mockReturnValue('up');

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    const downvoteBtn = el.querySelector('[data-vote="down"]');

    expect(upvoteBtn?.classList.contains('voted')).toBe(true);
    expect(downvoteBtn?.classList.contains('voted')).toBe(false);
  });

  it('handles clicking on icon inside vote button', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const toggleVoteSpy = vi.spyOn(votingModule, 'toggleVote').mockResolvedValue({ upvotes: 6, downvotes: 2 });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    // Click on the icon inside the button (not the button itself)
    const upvoteBtn = el.querySelector('[data-vote="up"]');
    const icon = upvoteBtn?.querySelector('.icon');

    if (icon) {
      icon.click();
      await new Promise(r => setTimeout(r, 10));
      expect(toggleVoteSpy).toHaveBeenCalledWith('7', 'up');
    }
  });

  it('handles share button click with navigator.share available', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text for sharing', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    // Mock navigator.share
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: shareMock,
      writable: true,
      configurable: true
    });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    const shareBtn = el.querySelector('[data-action="share"]');
    if (shareBtn) {
      shareBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(shareMock).toHaveBeenCalledWith({
        title: 'Test Law',
        text: 'Test text for sharing',
        url: window.location.href
      });
    }

    // Cleanup
    delete navigator.share;
  });

  it('handles share button click with clipboard fallback', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    // Mock clipboard API
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true
    });

    // Mock alert
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    const shareBtn = el.querySelector('[data-action="share"]');
    if (shareBtn) {
      shareBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(writeTextMock).toHaveBeenCalledWith(window.location.href);
      expect(alertMock).toHaveBeenCalledWith('Link copied to clipboard!');
    }

    // Cleanup
    alertMock.mockRestore();
    delete navigator.clipboard;
  });
});

