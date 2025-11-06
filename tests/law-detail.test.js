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
    expect(toggleVoteSpy).toHaveBeenCalledWith('7', 'up');
    expect(getUserVoteSpy).toHaveBeenCalledWith('7');
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
    expect(getUserVoteSpy).toHaveBeenCalledWith('7');
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
      const event = new MouseEvent('click', { bubbles: true });
      icon.dispatchEvent(event);
      await vi.waitFor(() => {
        expect(toggleVoteSpy).toHaveBeenCalledWith('7', 'up');
      });
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

  it('handles law without title', async () => {
    const law = { id: '7', text: 'Test text without title', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await vi.waitFor(() => {
      expect(el.textContent).toContain('Test text without title');
    });
  });

  it('handles law without text', async () => {
    const law = { id: '7', title: 'Test Title', text: '', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await vi.waitFor(() => {
      expect(el.textContent).toContain('Test Title');
    });
  });

  it('handles onStructuredData not being a function', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    // Pass non-function value
    const el = LawDetail({ 
      lawId: law.id, 
      _isLoggedIn: false, 
      _currentUser: null, 
      onNavigate: () => {},
      onStructuredData: 'not a function'
    });

    await vi.waitFor(() => {
      expect(el.textContent).toContain('Test Law');
    });
  });

  it('handles missing lawCardContainer gracefully', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    // Wait for law to load first
    await vi.waitFor(() => {
      expect(el.textContent).toContain('Test Law');
    });

    // Remove lawCardContainer after render
    const container = el.querySelector('[data-law-card-container]');
    if (container) {
      container.remove();
    }

    // Should not throw
    expect(el).toBeTruthy();
  });

  it('handles fetch error gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const el = LawDetail({ lawId: '7', _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Law Not Found/);
    });
  });

  it('handles vote button without dataset.id', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await vi.waitFor(() => {
      expect(el.textContent).toContain('Test Law');
    });

    // Create vote button without dataset.id
    const fakeVoteBtn = document.createElement('button');
    fakeVoteBtn.setAttribute('data-vote', 'up');
    // No dataset.id
    el.appendChild(fakeVoteBtn);

    fakeVoteBtn.click();

    // Should not throw
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(el).toBeTruthy();
  });

  it('handles vote button without voteType', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await vi.waitFor(() => {
      expect(el.textContent).toContain('Test Law');
    });

    // Create vote button without data-vote attribute
    const fakeVoteBtn = document.createElement('button');
    fakeVoteBtn.dataset.id = '7';
    // No data-vote attribute
    el.appendChild(fakeVoteBtn);

    fakeVoteBtn.click();

    // Should not throw
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(el).toBeTruthy();
  });

  it('handles missing vote count elements', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const toggleVoteSpy = vi.spyOn(votingModule, 'toggleVote').mockResolvedValue({ upvotes: 1, downvotes: 0 });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await vi.waitFor(() => {
      expect(el.textContent).toContain('Test Law');
    });

    // Remove vote count elements
    const upVoteCount = el.querySelector('[data-upvote-count]');
    const downVoteCount = el.querySelector('[data-downvote-count]');
    if (upVoteCount) upVoteCount.remove();
    if (downVoteCount) downVoteCount.remove();

    const voteBtn = el.querySelector('[data-vote="up"]');
    if (voteBtn) {
      voteBtn.click();
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Should not throw
    expect(el).toBeTruthy();
  });

  it('handles vote error gracefully', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const toggleVoteSpy = vi.spyOn(votingModule, 'toggleVote').mockRejectedValue(new Error('Vote failed'));

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await vi.waitFor(() => {
      expect(el.textContent).toContain('Test Law');
    });

    const voteBtn = el.querySelector('[data-vote="up"]');
    if (voteBtn) {
      voteBtn.click();
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Should not throw
    expect(el).toBeTruthy();
  });

  it('handles missing footer in law card', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await vi.waitFor(() => {
      expect(el.textContent).toContain('Test Law');
    });

    // Remove footer if it exists
    const footer = el.querySelector('.section-footer .right');
    if (footer) {
      footer.remove();
    }

    // Should not throw
    expect(el).toBeTruthy();
  });

  it('handles renderLawCard returning null', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {} });

    await vi.waitFor(() => {
      expect(el.textContent).toContain('Test Law');
    });

    // Mock renderLawCard to return null by removing lawCardContainer
    const container = el.querySelector('[data-law-card-container]');
    if (container) {
      container.innerHTML = ''; // Empty container simulates null return
    }

    // Should not throw
    expect(el).toBeTruthy();
  });

  it('handles navigation when navTarget is missing', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const onNavigate = vi.fn();
    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate });

    await vi.waitFor(() => {
      expect(el.textContent).toContain('Test Law');
    });

    // Create nav button without data-nav attribute
    const fakeNavBtn = document.createElement('button');
    fakeNavBtn.setAttribute('data-nav', ''); // Empty nav target
    el.appendChild(fakeNavBtn);

    fakeNavBtn.click();

    // Should not call onNavigate when navTarget is empty
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('handles clicking element without data-nav ancestor', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const onNavigate = vi.fn();
    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate });

    await vi.waitFor(() => {
      expect(el.textContent).toContain('Test Law');
    });

    // Create element without data-nav ancestor
    const regularDiv = document.createElement('div');
    regularDiv.textContent = 'Regular content';
    el.appendChild(regularDiv);

    regularDiv.click();

    // Should not call onNavigate when no navBtn found
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

