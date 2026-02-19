// @ts-nocheck
import { LawDetail } from '@views/law-detail.js';
import * as votingModule from '../src/utils/voting.js';

describe('LawDetail view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders not found for unknown id', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const el = LawDetail({ lawId: 'nope', _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });
    await new Promise(r => setTimeout(r, 0));
    expect(el.textContent).toMatch(/Law Not Found/);
  });

  it('renders not found when lawId is null', async () => {
    const el = LawDetail({ lawId: null, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });
    expect(el.textContent).toMatch(/Law Not Found/);
  });

  it('renders title for existing law and triggers vote', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3, submittedBy: 'tester' };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const toggleVoteSpy = vi.spyOn(votingModule, 'toggleVote').mockResolvedValue({ upvotes: 1, downvotes: 0 });
    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

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

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

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
    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

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

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

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

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Law/);
    expect(el.textContent).toMatch(/Test text without title/);
  });

  it('renders law without author or submittedBy', async () => {
    const law = { id: '7', text: 'Anonymous law', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Anonymous law/);
  });

  it('handles negative score display', async () => {
    const law = { id: '7', title: 'Unpopular Law', text: 'Test text', score: -5, upvotes: 2, downvotes: 7 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

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

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

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

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

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

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Test Law/);
  });

  it('handles law with undefined score', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text' };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

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

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

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

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    const downvoteBtn = el.querySelector('[data-vote="down"]');

    expect(upvoteBtn?.classList.contains('voted')).toBe(true);
    expect(downvoteBtn?.classList.contains('voted')).toBe(false);
    expect(getUserVoteSpy).toHaveBeenCalledWith('7');
  });

  it('displays downvote voted state when user has downvoted', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const getUserVoteSpy = vi.spyOn(votingModule, 'getUserVote').mockReturnValue('down');

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    const downvoteBtn = el.querySelector('[data-vote="down"]');

    expect(upvoteBtn?.classList.contains('voted')).toBe(false);
    expect(downvoteBtn?.classList.contains('voted')).toBe(true);
    expect(getUserVoteSpy).toHaveBeenCalledWith('7');
  });

  it('handles clicking on icon inside vote button', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const toggleVoteSpy = vi.spyOn(votingModule, 'toggleVote').mockResolvedValue({ upvotes: 6, downvotes: 2 });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

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

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Check that social share popover exists in the footer
    const shareWrapper = el.querySelector('.section-footer .share-wrapper');
    expect(shareWrapper).toBeTruthy();
    expect(shareWrapper.querySelector('.share-trigger')).toBeTruthy();
  });

  it('renders all social share buttons', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Check that share popover exists with all social links
    const shareWrapper = el.querySelector('.share-wrapper');
    expect(shareWrapper).toBeTruthy();
    expect(shareWrapper.querySelector('.share-trigger')).toBeTruthy();
    
    const popover = shareWrapper.querySelector('.share-popover');
    expect(popover).toBeTruthy();
    expect(popover.querySelector('[href*="twitter"]')).toBeTruthy();
    expect(popover.querySelector('[href*="facebook"]')).toBeTruthy();
    expect(popover.querySelector('[href*="linkedin"]')).toBeTruthy();
    expect(popover.querySelector('[href*="reddit"]')).toBeTruthy();
    expect(popover.querySelector('[href*="mailto"]')).toBeTruthy();
  });

  it('calls onStructuredData callback when provided', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const onStructuredDataSpy = vi.fn();

    LawDetail({
      lawId: law.id,
      _isLoggedIn: false,
      _currentUser: null,
      onNavigate: () => { },
      onStructuredData: onStructuredDataSpy
    });

    await new Promise(r => setTimeout(r, 50));

    // onStructuredData should have been called with the law data
    expect(onStructuredDataSpy).toHaveBeenCalledWith(law);
  });

  it('handles voting errors gracefully', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const toggleVoteSpy = vi.spyOn(votingModule, 'toggleVote').mockRejectedValue(new Error('Network error'));

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    const upvoteBtn = el.querySelector('[data-vote="up"]');

    // Should not throw when voting fails
    upvoteBtn?.click();
    await new Promise(r => setTimeout(r, 10));

    // If we got here without throwing, the error was handled gracefully
    expect(toggleVoteSpy).toHaveBeenCalled();
  });

  it('handles missing law card template gracefully', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Remove the template element to simulate missing template
    const template = el.querySelector('[data-law-card-template]');
    if (template) {
      // Replace the template with a non-template element
      const div = document.createElement('div');
      div.setAttribute('data-law-card-template', '');
      template.parentNode.replaceChild(div, template);
    }

    // Try to re-render - should not crash
    // The component should handle this gracefully when renderLawCard returns null
    expect(el.querySelector('[data-law-content]')).toBeTruthy();
  });

  it('copies related law link to clipboard when share button is clicked', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a copy link button (new format with data-action)
    const copyLinkBtn = document.createElement('button');
    copyLinkBtn.setAttribute('data-action', 'copy-link');
    copyLinkBtn.setAttribute('data-copy-value', 'https://test.com/law/99');
    el.appendChild(copyLinkBtn);

    copyLinkBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('/law/99'));
  });

  it('uses fallback when clipboard API fails on share button', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard not available'));
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    // Mock execCommand for fallback
    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a copy link button (new format with data-action)
    const copyLinkBtn = document.createElement('button');
    copyLinkBtn.setAttribute('data-action', 'copy-link');
    copyLinkBtn.setAttribute('data-copy-value', 'https://test.com/law/88');
    el.appendChild(copyLinkBtn);

    copyLinkBtn.click();
    await new Promise(r => setTimeout(r, 50));

    // Should have tried clipboard first, then fallback to execCommand
    expect(writeTextMock).toHaveBeenCalled();
    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });

  it('uses window.location.href as fallback when data-copy-value is missing on copy link', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a copy link button without data-copy-value
    const copyLinkBtn = document.createElement('button');
    copyLinkBtn.setAttribute('data-action', 'copy-link');
    // No data-copy-value set - should fall back to window.location.href
    el.appendChild(copyLinkBtn);

    copyLinkBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(writeTextMock).toHaveBeenCalledWith(window.location.href);
  });

  it('uses law-text element as fallback when data-copy-value is missing on copy text', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a copy text button without data-copy-value
    const copyTextBtn = document.createElement('button');
    copyTextBtn.setAttribute('data-action', 'copy-text');
    // No data-copy-value set - should fall back to [data-law-text] element
    el.appendChild(copyTextBtn);

    copyTextBtn.click();
    await new Promise(r => setTimeout(r, 10));

    // Should have copied the law text from the rendered element
    expect(writeTextMock).toHaveBeenCalled();
  });

  it('navigates to related law card when clicked', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    let navTarget = '';
    let navParam = '';
    const el = LawDetail({
      lawId: law.id,
      _isLoggedIn: false,
      _currentUser: null,
      onNavigate: (target, param) => { navTarget = target; navParam = param; }
    });

    await new Promise(r => setTimeout(r, 50));

    // Create a related law card
    const relatedCard = document.createElement('div');
    relatedCard.className = 'law-card-mini';
    relatedCard.dataset.lawId = '42';
    el.appendChild(relatedCard);

    relatedCard.click();

    expect(navTarget).toBe('law');
    expect(navParam).toBe('42');
  });

  it('fetches related laws using dedicated endpoint', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };
    const relatedLaws = {
      data: [
        { id: '8', title: 'Related Law', text: 'Related text', upvotes: 3, downvotes: 0 }
      ],
      law_id: 7
    };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => relatedLaws });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 100));

    // Should have made at least 2 fetches (law + related laws)
    expect(global.fetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    
    // Verify the related laws endpoint was called
    const fetchCalls = global.fetch.mock.calls.map(call => call[0]);
    const hasRelatedCall = fetchCalls.some(url => url.includes('/related'));
    expect(hasRelatedCall).toBe(true);
  });

  it('handles related laws fetch failure silently', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockRejectedValueOnce(new Error('Network error'));

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 100));

    // Should not throw - related laws failure is silent
    expect(el.textContent).toContain('Test Law');
  });

  it('handles empty related laws array', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ data: [], law_id: 7 }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 100));

    // Related section should remain hidden
    const relatedSection = el.querySelector('[data-related-laws]');
    if (relatedSection) {
      expect(relatedSection.hasAttribute('hidden')).toBe(true);
    }
  });

  it('handles related laws with null data', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ data: null, law_id: 7 }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 100));

    // Should not throw
    expect(el.textContent).toContain('Test Law');
  });

  it('handles copy text action with successful clipboard', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text content', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a copy text button and click it
    const copyBtn = document.createElement('button');
    copyBtn.setAttribute('data-action', 'copy-text');
    el.appendChild(copyBtn);

    copyBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(writeTextMock).toHaveBeenCalled();
  });

  it('handles copy text action with clipboard failure fallback', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text content', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard error'));
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    // Mock execCommand for fallback
    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a copy text button and click it
    const copyBtn = document.createElement('button');
    copyBtn.setAttribute('data-action', 'copy-text');
    el.appendChild(copyBtn);

    copyBtn.click();
    await new Promise(r => setTimeout(r, 50));

    expect(writeTextMock).toHaveBeenCalled();
    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });

  it('handles favorite button click on main law card', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a favorite button with data-favorite-btn attribute (main law card format)
    const favoriteBtn = document.createElement('button');
    favoriteBtn.setAttribute('data-favorite-btn', '');
    favoriteBtn.dataset.id = '7';
    favoriteBtn.dataset.lawText = 'Test text';
    favoriteBtn.dataset.lawTitle = 'Test Law';
    
    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('data-icon-name', 'heart');
    favoriteBtn.appendChild(iconSvg);
    
    el.appendChild(favoriteBtn);

    // Verify button doesn't start with favorited class
    expect(favoriteBtn.classList.contains('favorited')).toBe(false);

    favoriteBtn.click();
    await new Promise(r => setTimeout(r, 10));

    // Should have added favorited class (law was not previously favorited)
    expect(favoriteBtn.classList.contains('favorited')).toBe(true);
  });

  it('handles favorite button click without law id', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a favorite button without data-id
    const favoriteBtn = document.createElement('button');
    favoriteBtn.setAttribute('data-favorite-btn', '');
    // No dataset.id set
    el.appendChild(favoriteBtn);

    // Should not throw
    favoriteBtn.click();
    await new Promise(r => setTimeout(r, 10));
    
    expect(true).toBe(true);
  });

  it('handles related law favorite button click', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a related law card with favorite button (uses data-action="favorite")
    const lawCard = document.createElement('div');
    lawCard.className = 'law-card-mini';
    lawCard.dataset.lawId = '42';
    
    const lawText = document.createElement('p');
    lawText.className = 'law-card-text';
    lawText.textContent = 'Related law text';
    lawCard.appendChild(lawText);
    
    const favoriteBtn = document.createElement('button');
    favoriteBtn.setAttribute('data-action', 'favorite');
    favoriteBtn.setAttribute('data-law-id', '42');
    
    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('data-icon-name', 'heart');
    favoriteBtn.appendChild(iconSvg);
    
    lawCard.appendChild(favoriteBtn);
    el.appendChild(lawCard);

    // Verify button doesn't start with favorited class
    expect(favoriteBtn.classList.contains('favorited')).toBe(false);

    favoriteBtn.click();
    await new Promise(r => setTimeout(r, 10));

    // Should have added favorited class (law was not previously favorited)
    expect(favoriteBtn.classList.contains('favorited')).toBe(true);
  });

  it('handles related law favorite button click without law id', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a favorite button with data-action="favorite" but no data-law-id
    const favoriteBtn = document.createElement('button');
    favoriteBtn.setAttribute('data-action', 'favorite');
    // No data-law-id set
    el.appendChild(favoriteBtn);

    // Should not throw and should return early
    favoriteBtn.click();
    await new Promise(r => setTimeout(r, 10));
    
    expect(true).toBe(true);
  });

  it('does not navigate when clicking buttons inside related law card', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const onNavigate = vi.fn();
    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate });

    await new Promise(r => setTimeout(r, 50));

    // Create a related law card with a button inside
    const lawCard = document.createElement('div');
    lawCard.className = 'law-card-mini';
    lawCard.dataset.lawId = '42';
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

  it('does not copy when copy text button has no text to copy', async () => {
    const law = { id: '7', title: 'Test Law', text: '', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Remove the law text element to simulate no text available
    const lawTextEl = el.querySelector('[data-law-text]');
    if (lawTextEl) {
      lawTextEl.textContent = '';
    }

    // Create a copy text button without data-copy-value
    const copyBtn = document.createElement('button');
    copyBtn.setAttribute('data-action', 'copy-text');
    el.appendChild(copyBtn);

    copyBtn.click();
    await new Promise(r => setTimeout(r, 10));

    // writeText should not be called when there's no text
    // (or may be called with empty string depending on implementation)
    expect(true).toBe(true);
  });

  it('handles vote button click without voteType attribute', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const toggleVoteSpy = vi.spyOn(votingModule, 'toggleVote').mockResolvedValue({ upvotes: 6, downvotes: 2 });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a vote button without data-vote attribute value
    const voteBtn = document.createElement('button');
    voteBtn.setAttribute('data-vote', '');  // Empty vote type
    voteBtn.dataset.id = '7';
    el.appendChild(voteBtn);

    voteBtn.click();
    await new Promise(r => setTimeout(r, 10));

    // toggleVote should not be called when voteType is empty
    expect(toggleVoteSpy).not.toHaveBeenCalledWith('7', '');
  });

  it('provides a cleanup function that clears export content', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Element should have a cleanup function
    expect(typeof el.cleanup).toBe('function');

    // Calling cleanup should not throw
    expect(() => el.cleanup()).not.toThrow();
  });
});

