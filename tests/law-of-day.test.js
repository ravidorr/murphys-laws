import { LawOfTheDay } from '@components/law-of-day.js';
import * as voting from '../src/utils/voting.js';

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
    const { showButton = true, append = false, onNavigate = () => {} } = options;
    const el = LawOfTheDay({ law, onNavigate, showButton });
    const self = local();
    self.el = el;
    self.appended = append;
    if (append) {
      document.body.appendChild(el);
    }
    return el;
  }

  it('renders skeleton when law is null', () => {
    const el = mountLaw(null);

    const skeleton = el.querySelector('.skeleton');
    expect(skeleton).toBeTruthy();
    expect(skeleton.getAttribute('role')).toBe('status');
  });

  it('renders skeleton when law is undefined', () => {
    const el = mountLaw(undefined);

    expect(el.querySelector('.skeleton')).toBeTruthy();
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

  it('shows "View More Laws" button by default', () => {
    const law = { id: '1', text: 'Test law', upvotes: 5, downvotes: 1 };
    const el = mountLaw(law);

    expect(el.textContent).toMatch(/View More Laws/);
    expect(el.querySelector('[data-nav="browse"]')).toBeTruthy();
  });

  it('hides "View More Laws" button when showButton is false', () => {
    const law = { id: '1', text: 'Test law', upvotes: 5, downvotes: 1 };
    const el = mountLaw(law, { showButton: false });

    expect(el.textContent).not.toMatch(/View More Laws/);
    expect(el.querySelector('[data-nav="browse"]')).toBeFalsy();
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

  it('handles law card click for navigation', () => {
    const law = { id: '1', text: 'Test law', upvotes: 10, downvotes: 2 };
    let navigated = false;
    const onNavigate = (view, id) => {
      navigated = true;
      expect(view).toBe('law');
      expect(id).toBe('1');
    };

    const el = mountLaw(law, { onNavigate });

    const lawBody = el.querySelector('[data-law-id]');
    lawBody.click();

    expect(navigated).toBe(true);
  });

  it('does not navigate when law-id is missing', () => {
    const law = { id: '', text: 'Test law', upvotes: 10, downvotes: 2 };
    let navigated = false;
    const onNavigate = () => { navigated = true; };

    const el = mountLaw(law, { onNavigate });

    // Manually create an element without law-id
    const fakeElement = document.createElement('div');
    el.appendChild(fakeElement);
    fakeElement.click();

    expect(navigated).toBe(false);
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
});
