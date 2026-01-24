import { LawOfTheDay } from '@components/law-of-day.js';
import * as voting from '../src/utils/voting.js';

// Mock notification module to avoid unhandled rejections
vi.mock('../src/components/notification.js', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn()
}));

function createLocalThis() {
  const context = {};

  beforeEach(() => {
    Object.keys(context).forEach((key) => {
      delete context[key];
    });
  });

  return () => context;
}

describe('LawOfTheDay component', () => {
  const local = createLocalThis();
  let getUserVoteSpy;
  let toggleVoteSpy;

  beforeEach(() => {
    getUserVoteSpy = vi.spyOn(voting, 'getUserVote').mockReturnValue(null);
    toggleVoteSpy = vi.spyOn(voting, 'toggleVote').mockResolvedValue({ upvotes: 11, downvotes: 2 });
  });

  afterEach(() => {
    const self = local();
    if (self.appended && self.el?.parentNode) {
      self.el.parentNode.removeChild(self.el);
    }
    if (self.el?.cleanup) self.el.cleanup();
    vi.restoreAllMocks();
  });

  function mountLaw(law, options = {}) {
    const { append = false, onNavigate = () => {} } = options;
    const el = LawOfTheDay({ law, onNavigate });
    const self = local();
    self.el = el;
    self.appended = append;
    if (append) {
      document.body.appendChild(el);
    }
    return el;
  }

  it('renders loading placeholder when law is null', () => {
    const el = mountLaw(null);

    const loading = el.querySelector('.loading-placeholder');
    expect(loading).toBeTruthy();
    expect(loading.getAttribute('role')).toBe('status');
    expect(loading.getAttribute('aria-label')).toBe('Loading Law of the Day');
  });

  it('renders loading placeholder when law is undefined', () => {
    const el = mountLaw(undefined);

    expect(el.querySelector('.loading-placeholder')).toBeTruthy();
  });

  it('renders law with all content', () => {
    const law = {
      id: '1',
      text: 'Anything that can go wrong will go wrong',
      upvotes: 10,
      downvotes: 2,
      author: 'Edward Murphy'
    };

    const el = mountLaw(law);

    expect(el.textContent).toMatch(/Anything that can go wrong will go wrong/);
    expect(el.textContent).toMatch(/Edward Murphy/);
    expect(el.querySelector('[data-vote="up"]')).toBeTruthy();
    expect(el.querySelector('[data-vote="down"]')).toBeTruthy();
  });

  it('shows "Browse All Laws" button and social share buttons', () => {
    const law = { id: '1', text: 'Test law', upvotes: 5, downvotes: 1 };
    const el = mountLaw(law);

    expect(el.textContent).toMatch(/Browse All Laws/);
    expect(el.querySelector('[data-nav="browse"]')).toBeTruthy();

    // Check for social share popover
    const shareWrapper = el.querySelector('.share-wrapper');
    expect(shareWrapper).toBeTruthy();
    expect(shareWrapper.querySelector('.share-trigger')).toBeTruthy();
    const popover = shareWrapper.querySelector('.share-popover');
    expect(popover).toBeTruthy();
    // Check popover has share links
    expect(popover.querySelector('[href*="facebook"]')).toBeTruthy();
    expect(popover.querySelector('[href*="linkedin"]')).toBeTruthy();
    expect(popover.querySelector('[href*="reddit"]')).toBeTruthy();
    expect(popover.querySelector('[href*="mailto"]')).toBeTruthy();
  });

  it('handles upvote button click', async () => {
    const law = { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 };
    const el = mountLaw(law);

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    upvoteBtn.click();

    await vi.waitFor(() => {
      expect(toggleVoteSpy).toHaveBeenCalledWith('1', 'up');
    });
  });

  it('handles downvote button click', async () => {
    const law = { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 };
    const el = mountLaw(law);

    const downvoteBtn = el.querySelector('[data-vote="down"]');
    downvoteBtn.click();

    await vi.waitFor(() => {
      expect(toggleVoteSpy).toHaveBeenCalledWith('1', 'down');
    });
  });

  it('updates vote counts after successful vote', async () => {
    toggleVoteSpy.mockResolvedValue({ upvotes: 11, downvotes: 2 });
    getUserVoteSpy.mockReturnValue('up');

    const law = { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 };
    const el = mountLaw(law);

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

    const law = { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 };
    const el = mountLaw(law);

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    upvoteBtn.click();

    await vi.waitFor(() => {
      expect(upvoteBtn.classList.contains('voted')).toBe(true);
    });
  });

  it('handles vote error gracefully', async () => {
    toggleVoteSpy.mockRejectedValue(new Error('Vote failed'));

    const law = { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 };
    const el = mountLaw(law);

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    upvoteBtn.click();

    await vi.waitFor(() => {
    });

  });

  it('has clickable law link with data-law-id', () => {
    const law = { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 };

    const el = mountLaw(law);

    // Law of the Day should have data-law-id attribute on the link
    const lawLink = el.querySelector('[data-law-id]');
    expect(lawLink).toBeTruthy();
    expect(lawLink.getAttribute('data-law-id')).toBe('1');
  });

  it('navigates to law detail when clicking law link', async () => {
    const law = { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 };
    let navigatedTo = null;
    let navigatedParam = null;
    const onNavigate = (page, param) => {
      navigatedTo = page;
      navigatedParam = param;
    };

    const el = mountLaw(law, { onNavigate });

    const lawLink = el.querySelector('[data-law-id]');
    lawLink.click();

    await vi.waitFor(() => {
      expect(navigatedTo).toBe('law');
      expect(navigatedParam).toBe('1');
    });
  });

  it('does not navigate when law-id is empty', () => {
    const law = { id: '', text: 'Test law', upvotes: 10, downvotes: 2 };
    let navigated = false;
    const onNavigate = () => { navigated = true; };

    const el = mountLaw(law, { onNavigate });

    // The link with empty law-id should not trigger navigation
    const lawLink = el.querySelector('[data-law-id]');
    if (lawLink) {
      lawLink.click();
    }

    expect(navigated).toBe(false);
  });

  it('navigates to browse when Browse All Laws button is clicked', async () => {
    const law = { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 };
    let navigatedTo = null;
    const onNavigate = (page) => {
      navigatedTo = page;
    };

    const el = mountLaw(law, { onNavigate });

    const browseBtn = el.querySelector('[data-nav="browse"]');
    browseBtn.click();

    await vi.waitFor(() => {
      expect(navigatedTo).toBe('browse');
    });
  });

  it('handles non-HTMLElement click targets', () => {
    const law = { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 };
    const el = mountLaw(law);

    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null, writable: false });
    el.dispatchEvent(event);

    // Should not throw error
    expect(true).toBe(true);
  });

  it('shows user vote state with voted class', () => {
    getUserVoteSpy.mockReturnValue('up');

    const law = { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 };
    const el = mountLaw(law);

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    expect(upvoteBtn.classList.contains('voted')).toBe(true);
  });

  it('shows downvote state with voted class', () => {
    getUserVoteSpy.mockReturnValue('down');

    const law = { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 };
    const el = mountLaw(law);

    const downvoteBtn = el.querySelector('[data-vote="down"]');
    expect(downvoteBtn.classList.contains('voted')).toBe(true);
  });

  it('handles missing upvotes and downvotes gracefully', () => {
    const law = { id: '1', text: 'Test law' };
    const el = mountLaw(law);

    const upCount = el.querySelector('[data-vote="up"] .count-num');
    const downCount = el.querySelector('[data-vote="down"] .count-num');

    expect(upCount.textContent).toBe('0');
    expect(downCount.textContent).toBe('0');
  });

  it('stops event propagation when voting', async () => {
    const law = { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 };
    let cardClicked = false;
    const onNavigate = () => { cardClicked = true; };

    const el = mountLaw(law, { onNavigate });

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    upvoteBtn.click();

    await new Promise(r => setTimeout(r, 10));

    // Card click should not have fired due to stopPropagation
    expect(cardClicked).toBe(false);
  });

  it('handles vote error without message property', async () => {
    toggleVoteSpy.mockRejectedValue({ code: 'NETWORK_ERROR' }); // Error without message

    const law = { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 };
    const el = mountLaw(law);

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    upvoteBtn.click();

    await vi.waitFor(() => {
    });

  });

  it('renders law with title and combines title with text', () => {
    const law = {
      id: '1',
      title: "Murphy's Law",
      text: 'Anything that can go wrong will go wrong',
      upvotes: 10,
      downvotes: 2
    };

    const el = mountLaw(law);

    // Should display "title: text" format
    expect(el.textContent).toMatch(/Murphy's Law/);
    expect(el.textContent).toMatch(/Anything that can go wrong will go wrong/);
  });

  it('renders law without title showing only text', () => {
    const law = {
      id: '1',
      title: null,
      text: 'Just the law text',
      upvotes: 5,
      downvotes: 1
    };

    const el = mountLaw(law);

    expect(el.textContent).toMatch(/Just the law text/);
  });

  it('handles law with empty text gracefully', () => {
    const law = {
      id: '1',
      text: '',
      upvotes: 5,
      downvotes: 1
    };

    const el = mountLaw(law);

    // Should still render without errors
    expect(el.querySelector('.share-wrapper')).toBeTruthy();
  });

  it('handles law with undefined text gracefully', () => {
    const law = {
      id: '1',
      text: undefined,
      upvotes: 5,
      downvotes: 1
    };

    const el = mountLaw(law);

    // Should still render without errors
    expect(el.querySelector('.share-wrapper')).toBeTruthy();
  });

  describe('copy actions', () => {
    const localThis = createLocalThis();

    afterEach(() => {
      const self = localThis();
      if (self.appended && self.el?.parentNode) {
        self.el.parentNode.removeChild(self.el);
      }
    });

    function mountLawForCopy(law, options = {}) {
      const { append = false, onNavigate = () => {} } = options;
      const el = LawOfTheDay({ law, onNavigate });
      const self = localThis();
      self.el = el;
      self.appended = append;
      if (append) {
        document.body.appendChild(el);
      }
      return el;
    }

    it('copies law text to clipboard when copy text button is clicked', async () => {
      const law = { id: '1', text: 'Test law text', title: 'Test', upvotes: 10, downvotes: 2 };
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const el = mountLawForCopy(law, { append: true });

      const copyTextBtn = document.createElement('button');
      copyTextBtn.setAttribute('data-action', 'copy-text');
      copyTextBtn.setAttribute('data-copy-value', 'Test law text');
      el.appendChild(copyTextBtn);

      copyTextBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(writeTextMock).toHaveBeenCalledWith('Test law text');
    });

    it('copies law link to clipboard when copy link button is clicked', async () => {
      const law = { id: '1', text: 'Test law text', title: 'Test', upvotes: 10, downvotes: 2 };
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const el = mountLawForCopy(law, { append: true });

      const copyLinkBtn = document.createElement('button');
      copyLinkBtn.setAttribute('data-action', 'copy-link');
      copyLinkBtn.setAttribute('data-copy-value', 'https://test.com/law/1');
      el.appendChild(copyLinkBtn);

      copyLinkBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(writeTextMock).toHaveBeenCalledWith('https://test.com/law/1');
    });

    it('uses fallback when clipboard API fails on copy text', async () => {
      const law = { id: '1', text: 'Test law text', title: 'Test', upvotes: 10, downvotes: 2 };
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard not available'));
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const execCommandMock = vi.fn().mockReturnValue(true);
      document.execCommand = execCommandMock;

      const el = mountLawForCopy(law, { append: true });

      const copyTextBtn = document.createElement('button');
      copyTextBtn.setAttribute('data-action', 'copy-text');
      copyTextBtn.setAttribute('data-copy-value', 'Test law text');
      el.appendChild(copyTextBtn);

      copyTextBtn.click();
      await new Promise(r => setTimeout(r, 50));

      expect(writeTextMock).toHaveBeenCalled();
      expect(execCommandMock).toHaveBeenCalledWith('copy');
    });

    it('uses fallback when clipboard API fails on copy link', async () => {
      const law = { id: '1', text: 'Test law text', title: 'Test', upvotes: 10, downvotes: 2 };
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard not available'));
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const execCommandMock = vi.fn().mockReturnValue(true);
      document.execCommand = execCommandMock;

      const el = mountLawForCopy(law, { append: true });

      const copyLinkBtn = document.createElement('button');
      copyLinkBtn.setAttribute('data-action', 'copy-link');
      copyLinkBtn.setAttribute('data-copy-value', 'https://test.com/law/1');
      el.appendChild(copyLinkBtn);

      copyLinkBtn.click();
      await new Promise(r => setTimeout(r, 50));

      expect(writeTextMock).toHaveBeenCalled();
      expect(execCommandMock).toHaveBeenCalledWith('copy');
    });

    it('uses law.text as fallback when data-copy-value is missing on copy text', async () => {
      const law = { id: '1', text: 'Fallback law text', title: 'Test', upvotes: 10, downvotes: 2 };
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const el = mountLawForCopy(law, { append: true });

      const copyTextBtn = document.createElement('button');
      copyTextBtn.setAttribute('data-action', 'copy-text');
      // No data-copy-value set
      el.appendChild(copyTextBtn);

      copyTextBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(writeTextMock).toHaveBeenCalledWith('Fallback law text');
    });

    it('generates URL as fallback when data-copy-value is missing on copy link', async () => {
      const law = { id: '42', text: 'Test law text', title: 'Test', upvotes: 10, downvotes: 2 };
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const el = mountLawForCopy(law, { append: true });

      const copyLinkBtn = document.createElement('button');
      copyLinkBtn.setAttribute('data-action', 'copy-link');
      // No data-copy-value set
      el.appendChild(copyLinkBtn);

      copyLinkBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('/law/42'));
    });

    it('does not copy when text is empty on copy text', async () => {
      const law = { id: '1', text: '', title: '', upvotes: 10, downvotes: 2 };
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const el = mountLawForCopy(law, { append: true });

      const copyTextBtn = document.createElement('button');
      copyTextBtn.setAttribute('data-action', 'copy-text');
      copyTextBtn.setAttribute('data-copy-value', '');
      el.appendChild(copyTextBtn);

      copyTextBtn.click();
      await new Promise(r => setTimeout(r, 10));

      // Should not have called writeText since text is empty
      expect(writeTextMock).not.toHaveBeenCalled();
    });
  });
});
