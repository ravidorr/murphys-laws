import { LawDetail } from '@views/law-detail.js';
import * as votingModule from '../src/utils/voting.js';
import * as notification from '../src/components/notification.js';

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

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

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

  it('renders law successfully', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    // Wait for the law to render
    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Test Law/);
    }, { timeout: 500 });

    expect(el.textContent).toMatch(/Test Law/);
  });

  it('handles navigation button clicks', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

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
      .mockResolvedValueOnce({ ok: true, json: async () => law });

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
      .mockResolvedValueOnce({ ok: true, json: async () => law });

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
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Law/);
    expect(el.textContent).toMatch(/Test text without title/);
  });

  it('renders law without author or submittedBy', async () => {
    const law = { id: '7', text: 'Anonymous law', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Anonymous law/);
  });

  it('handles negative score display', async () => {
    const law = { id: '7', title: 'Unpopular Law', text: 'Test text', score: -5, upvotes: 2, downvotes: 7 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    // Check for upvote and downvote counts
    const upvoteCount = el.querySelector('[data-upvote-count]');
    const downvoteCount = el.querySelector('[data-downvote-count]');
    expect(upvoteCount?.textContent).toBe('2');
    expect(downvoteCount?.textContent).toBe('7');
  });


  it('handles law with category information', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3, category: 'Technology' };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

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
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Full Law/);
    expect(el.textContent).toMatch(/Famous Author/);
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
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Test Law/);
  });

  it('handles law with undefined score', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text' };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Test Law/);
    // Check for upvote and downvote counts (should default to 0)
    const upvoteCount = el.querySelector('[data-upvote-count]');
    const downvoteCount = el.querySelector('[data-downvote-count]');
    expect(upvoteCount?.textContent).toBe('0');
    expect(downvoteCount?.textContent).toBe('0');
  });


  it('updates vote counts in UI after voting', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

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
      .mockResolvedValueOnce({ ok: true, json: async () => law });

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
      .mockResolvedValueOnce({ ok: true, json: async () => law });

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

  it('renders social share buttons in footer', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text for sharing', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    // Check that social share buttons exist in the footer
    const shareButtons = el.querySelector('.section-footer .share-buttons');
    expect(shareButtons).toBeTruthy();
  });

  it('renders all social share buttons', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await new Promise(r => setTimeout(r, 50));

    // Check that all 5 social buttons exist
    const twitterBtn = el.querySelector('.share-twitter');
    const facebookBtn = el.querySelector('.share-facebook');
    const linkedinBtn = el.querySelector('.share-linkedin');
    const redditBtn = el.querySelector('.share-reddit');
    const emailBtn = el.querySelector('.share-email');

    expect(twitterBtn).toBeTruthy();
    expect(facebookBtn).toBeTruthy();
    expect(linkedinBtn).toBeTruthy();
    expect(redditBtn).toBeTruthy();
    expect(emailBtn).toBeTruthy();
  });
});

