import { Home, renderHome } from '@views/home.js';

describe('Home view', () => {
  it('renders Law of the Day after fetching data', async () => {
    const lawOfTheDay = {
      id: '1',
      text: 'Anything that can go wrong will go wrong.',
      author: 'Edward Murphy',
      upvotes: 10,
      downvotes: 0
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    const el = Home({ isLoggedIn: false, onNavigate: () => {}, _onVote: () => {} });

    await new Promise(r => setTimeout(r, 0));

    expect(el.textContent).toMatch(/Law of the Day/);
  });

  it('Law of the Day is clickable and navigable', async () => {
    const lawOfTheDay = {
      id: 42,
      text: 'Test law',
      author: 'Test',
      upvotes: 1,
      downvotes: 0
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    let _nav = '';
    const el = Home({ isLoggedIn: false, onNavigate: (name, id) => { _nav = `${name}:${id}`; }, _onVote: () => {} });

    await new Promise(r => setTimeout(r, 0));

    // Law of the Day should have data-law-id attribute and be clickable
    const block = el.querySelector(`[data-law-id="42"]`);
    expect(block).toBeTruthy();
    expect(block.classList.contains('lod-link')).toBe(true);
  });

  it('shows no Law of the Day widget when response has no law', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0, limit: 1, offset: 0 })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should still render calculators and submit section, just no Law of the Day widget
    // Check for widget element (has #lod-date) rather than text since hero content mentions "Law of the Day"
    expect(el.querySelector('#lod-date')).toBeNull();
    expect(el.textContent).toMatch(/Calculator|Submit/i);
  });

  it('shows graceful degradation on fetch failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 50));

    // When fetch fails, it falls back to null and still renders calculators
    // The error path is only reached if renderHome itself throws
    expect(el.textContent).toMatch(/Calculator|Submit/i);
  });

  it('navigates to category when clicking category:id nav button', async () => {
    const lawOfTheDay = { id: 1, text: 'Test law', upvotes: 10, downvotes: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    let navTarget = '';
    let navParam = '';
    const el = Home({ onNavigate: (target, param) => { navTarget = target; navParam = param; } });

    await new Promise(r => setTimeout(r, 0));

    // Create a button with category:id format and click it
    const catBtn = document.createElement('button');
    catBtn.setAttribute('data-nav', 'category:technology');
    el.appendChild(catBtn);

    catBtn.click();

    expect(navTarget).toBe('category');
    expect(navParam).toBe('technology');
  });

  it('navigates using data-nav attribute', async () => {
    const lawOfTheDay = { id: 1, text: 'Test law', upvotes: 10, downvotes: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    let navTarget = '';
    const el = Home({ onNavigate: (target) => { navTarget = target; } });

    await new Promise(r => setTimeout(r, 0));

    // Create a button with data-nav and add it to the element
    const navBtn = document.createElement('button');
    navBtn.setAttribute('data-nav', 'browse');
    el.appendChild(navBtn);

    navBtn.click();
    expect(navTarget).toBe('browse');
  });

  it('handles keyboard navigation with Enter key (WCAG 2.1.1)', async () => {
    const lawOfTheDay = { id: 1, text: 'Test law', upvotes: 10, downvotes: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    let navTarget = '';
    const el = Home({ onNavigate: (target) => { navTarget = target; } });

    await new Promise(r => setTimeout(r, 0));

    // Create a button with data-nav and add it to the element
    const navBtn = document.createElement('button');
    navBtn.setAttribute('data-nav', 'browse');
    el.appendChild(navBtn);

    // Simulate Enter key press
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    navBtn.dispatchEvent(enterEvent);

    expect(navTarget).toBe('browse');
  });

  it('handles keyboard navigation with Space key (WCAG 2.1.1)', async () => {
    const lawOfTheDay = { id: 1, text: 'Test law', upvotes: 10, downvotes: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    let navTarget = '';
    const el = Home({ onNavigate: (target) => { navTarget = target; } });

    await new Promise(r => setTimeout(r, 0));

    // Create a button with data-nav and add it to the element
    const navBtn = document.createElement('button');
    navBtn.setAttribute('data-nav', 'browse');
    el.appendChild(navBtn);

    // Simulate Space key press
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    navBtn.dispatchEvent(spaceEvent);

    expect(navTarget).toBe('browse');
  });

  it('handles category keyboard navigation', async () => {
    const lawOfTheDay = { id: 1, text: 'Test law', upvotes: 10, downvotes: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    let navTarget = '';
    let navParam = '';
    const el = Home({ onNavigate: (target, param) => { navTarget = target; navParam = param; } });

    await new Promise(r => setTimeout(r, 0));

    // Create a button with category navigation
    const catBtn = document.createElement('button');
    catBtn.setAttribute('data-nav', 'category:computers');
    el.appendChild(catBtn);

    // Simulate Enter key press
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    catBtn.dispatchEvent(enterEvent);

    expect(navTarget).toBe('category');
    expect(navParam).toBe('computers');
  });

  it('handles law card without id gracefully', async () => {
    const lawOfTheDay = { id: 1, text: 'Test law', upvotes: 10, downvotes: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    let navCalled = false;
    const el = Home({ onNavigate: () => { navCalled = true; } });

    await new Promise(r => setTimeout(r, 0));

    // Create a law card without data-law-id attribute
    const card = document.createElement('div');
    card.setAttribute('data-law-id', '');
    el.appendChild(card);

    card.click();
    expect(navCalled).toBe(false);
  });

  it('renders with no law of the day widget when data array is empty', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0, limit: 1, offset: 0 })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should render calculator and submit sections but no law of the day widget
    // Check for widget element rather than text since hero content mentions "Law of the Day"
    expect(el.querySelector('#lod-date')).toBeNull();
  });

  it('handles non-HTMLElement click targets', async () => {
    const lawOfTheDay = { id: 1, text: 'Test law', upvotes: 10, downvotes: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Simulate click with non-HTMLElement target
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null, writable: false });
    el.dispatchEvent(event);

    // Should not throw error
    expect(true).toBe(true);
  });

  it('shows Law of the Day when law exists', async () => {
    const lawOfTheDay = {
      id: 1,
      text: 'Law of the Day text',
      author: 'Murphy',
      upvotes: 100,
      downvotes: 0
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    expect(el.textContent).toMatch(/Law of the Day/);
    expect(el.textContent).toMatch(/Law of the Day text/);
  });

  it('handles fetch that returns non-ok status', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 50));

    // Graceful degradation
    expect(el.textContent).toMatch(/Calculator|Submit/i);
  });

  it('renders with calculator section', async () => {
    const lawOfTheDay = { id: 1, text: 'Test law', upvotes: 10, downvotes: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    expect(el.textContent).toMatch(/Sod's Law Calculator|Calculator/i);
  });

  it('renders with submit section', async () => {
    const lawOfTheDay = { id: 1, text: 'Test law', upvotes: 10, downvotes: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    expect(el.textContent).toMatch(/Submit/i);
  });

  it('handles response with no data array', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0, limit: 1, offset: 0 })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should render calculator and submit sections even with no law
    expect(el.textContent).toMatch(/Calculator|Submit/i);
  });

  it('handles response with missing data field', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total: 0, limit: 1, offset: 0 })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should render calculator and submit sections
    expect(el.textContent).toMatch(/Calculator|Submit/i);
  });

  it('handles response with null json', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ law: null, featured_date: null })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should render calculator and submit sections even with null law
    expect(el.textContent).toMatch(/Calculator|Submit/i);
  });

  it('handles response where data is not an array', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: 'not an array', total: 5, limit: 1, offset: 0 })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should render the widgets (calculator, submit) even with invalid data
    // It should NOT render error message now
    expect(el.textContent).toMatch(/Calculator|Submit/i);
    expect(el.textContent).not.toMatch(/Connection Error/i);
  });

  it('handles response where data is missing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total: 5, limit: 1, offset: 0 })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should render the widgets (calculator, submit) even with missing data
    expect(el.textContent).toMatch(/Calculator|Submit/i);
  });

  it('handles law without upvotes field', async () => {
    const lawOfTheDay = { id: 1, text: 'Law without upvotes' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should render without errors
    expect(el.textContent).toMatch(/Law of the Day/);
  });

  it('handles law with upvotes as 0', async () => {
    const lawOfTheDay = { id: 1, text: 'First law', upvotes: 0, downvotes: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should render without errors
    expect(el.textContent).toMatch(/Law of the Day/);
  });

  it('handles law with null upvotes', async () => {
    const lawOfTheDay = { id: 1, text: 'Law with null upvotes', upvotes: null, downvotes: null };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should render without errors
    expect(el.textContent).toMatch(/Law of the Day/);
  });
});

describe('renderHome function', () => {
  it('handles null lawOfTheDay parameter', () => {
    const el = document.createElement('div');
    const onNavigate = vi.fn();

    renderHome(el, null, [], onNavigate);

    // Should render calculator and submit sections without Law of the Day widget
    expect(el.textContent).toMatch(/Calculator|Submit/i);
    // Check for widget element rather than text since hero content mentions "Law of the Day"
    expect(el.querySelector('#lod-date')).toBeNull();
  });

  it('handles valid lawOfTheDay object', () => {
    const el = document.createElement('div');
    const onNavigate = vi.fn();
    const lawOfTheDay = { id: 1, text: 'Test law', upvotes: 5, downvotes: 1 };

    renderHome(el, lawOfTheDay, [], onNavigate);

    // Should render Law of the Day plus calculator and submit sections
    expect(el.textContent).toMatch(/Law of the Day/);
    expect(el.textContent).toMatch(/Test law/);
    expect(el.textContent).toMatch(/Calculator|Submit/i);
  });

  it('renders overview section with title in section-header and description in section-subheader', () => {
    const el = document.createElement('div');
    renderHome(el, null, [], vi.fn());

    const sectionCard = el.querySelector('.section-card');
    expect(sectionCard).toBeTruthy();

    const header = sectionCard.querySelector('.section-header');
    expect(header).toBeTruthy();
    expect(header.querySelector('.section-title')).toBeTruthy();
    expect(header.querySelector('p')).toBeNull();

    const subheader = sectionCard.querySelector('.section-subheader');
    expect(subheader).toBeTruthy();
    const subtitle = subheader.querySelector('.section-subtitle');
    expect(subtitle).toBeTruthy();
    expect(subtitle.textContent).toMatch(/Anything that can go wrong, will go wrong/);
  });

});

describe('Home view keyboard navigation for law cards', () => {
  it('navigates to law when pressing Enter on law card with data-law-id', async () => {
    const lawOfTheDay = { id: 42, text: 'Test law', upvotes: 10, downvotes: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    let navTarget = '';
    let navParam = '';
    const el = Home({ onNavigate: (target, param) => { navTarget = target; navParam = param; } });

    await new Promise(r => setTimeout(r, 0));

    // Find the law card element with data-law-id
    const lawCard = el.querySelector('[data-law-id="42"]');
    expect(lawCard).toBeTruthy();

    // Simulate Enter key press on the law card
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    lawCard.dispatchEvent(enterEvent);

    expect(navTarget).toBe('law');
    expect(navParam).toBe('42');
  });

  it('navigates to law when pressing Space on law card with data-law-id', async () => {
    const lawOfTheDay = { id: 42, text: 'Test law', upvotes: 10, downvotes: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    let navTarget = '';
    let navParam = '';
    const el = Home({ onNavigate: (target, param) => { navTarget = target; navParam = param; } });

    await new Promise(r => setTimeout(r, 0));

    // Find the law card element with data-law-id
    const lawCard = el.querySelector('[data-law-id="42"]');
    expect(lawCard).toBeTruthy();

    // Simulate Space key press on the law card
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    lawCard.dispatchEvent(spaceEvent);

    expect(navTarget).toBe('law');
    expect(navParam).toBe('42');
  });

  it('does not navigate when keydown on element without data-law-id or data-nav', async () => {
    const lawOfTheDay = { id: 42, text: 'Test law', upvotes: 10, downvotes: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    let navCalled = false;
    const el = Home({ onNavigate: () => { navCalled = true; } });

    await new Promise(r => setTimeout(r, 0));

    // Add an element without data-law-id or data-nav
    const plainElement = document.createElement('div');
    plainElement.className = 'some-element';
    el.appendChild(plainElement);

    // Simulate Enter key press on the plain element
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    plainElement.dispatchEvent(enterEvent);

    expect(navCalled).toBe(false);
  });

  it('handles non-Element keydown target gracefully', async () => {
    const lawOfTheDay = { id: 1, text: 'Test law', upvotes: 10, downvotes: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Simulate keydown with non-Element target
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    Object.defineProperty(event, 'target', { value: null, writable: false });
    el.dispatchEvent(event);

    // Should not throw error
    expect(true).toBe(true);
  });

  it('ignores keydown events that are not Enter or Space', async () => {
    const lawOfTheDay = { id: 1, text: 'Test law', upvotes: 10, downvotes: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    let navCalled = false;
    const el = Home({ onNavigate: () => { navCalled = true; } });

    await new Promise(r => setTimeout(r, 0));

    // Find a law card
    const lawCard = el.querySelector('[data-law-id]');
    if (lawCard) {
      // Simulate Tab key press (should be ignored)
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      lawCard.dispatchEvent(tabEvent);
    }

    // Navigation should not be triggered for Tab key
    expect(navCalled).toBe(false);
  });

  it('does not navigate when clicking law card with empty data-law-id', async () => {
    const lawOfTheDay = { id: 1, text: 'Test law', upvotes: 10, downvotes: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    let navCalled = false;
    const el = Home({ onNavigate: () => { navCalled = true; } });

    await new Promise(r => setTimeout(r, 0));

    // Create a law card with empty id
    const card = document.createElement('div');
    card.setAttribute('data-law-id', '');
    el.appendChild(card);

    card.click();

    // Navigation should not be triggered for empty id
    expect(navCalled).toBe(false);
  });

  it('does not navigate when clicking buttons inside law card', async () => {
    const localThis = {};
    const lawOfTheDay = { id: 1, text: 'Test law', upvotes: 10, downvotes: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ law: lawOfTheDay, featured_date: '2025-10-29' })
    });

    localThis.onNavigate = vi.fn();
    localThis.el = Home({ onNavigate: localThis.onNavigate });

    await new Promise(r => setTimeout(r, 0));

    // Create a law card with a button inside
    const card = document.createElement('div');
    card.setAttribute('data-law-id', '123');
    const button = document.createElement('button');
    button.setAttribute('data-action', 'favorite');
    card.appendChild(button);
    localThis.el.appendChild(card);

    // Click the button inside the card
    button.click();

    // Navigation should NOT be triggered when clicking buttons
    expect(localThis.onNavigate).not.toHaveBeenCalled();
  });
});

