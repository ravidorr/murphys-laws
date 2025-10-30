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

  it('Law of the Day is not clickable/navigable', async () => {
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

    let nav = '';
    const el = Home({ isLoggedIn: false, onNavigate: (name, id) => { nav = `${name}:${id}`; }, _onVote: () => {} });

    await new Promise(r => setTimeout(r, 0));

    // Law of the Day should not have data-law-id attribute
    const block = el.querySelector(`[data-law-id="42"]`);
    expect(block).toBeNull();
  });

  it('shows no Law of the Day when response has no law', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0, limit: 1, offset: 0 })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should still render calculators and submit section, just no Law of the Day
    expect(el.textContent).not.toMatch(/Law of the Day/);
    expect(el.textContent).toMatch(/Calculator|Submit/i);
  });

  it('shows error message on fetch failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Ironically, something went wrong/);

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

  it('renders with no law of the day when data array is empty', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0, limit: 1, offset: 0 })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should render calculator and submit sections but no law of the day
    expect(el.textContent).not.toMatch(/Law of the Day/);
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

    expect(el.textContent).toMatch(/Ironically, something went wrong/);

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
    expect(el.textContent).toMatch(/Calculator|Submit/i);
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

    renderHome(el, null, onNavigate);

    // Should render calculator and submit sections without Law of the Day
    expect(el.textContent).toMatch(/Calculator|Submit/i);
    expect(el.textContent).not.toMatch(/Law of the Day/);
  });

  it('handles valid lawOfTheDay object', () => {
    const el = document.createElement('div');
    const onNavigate = vi.fn();
    const lawOfTheDay = { id: 1, text: 'Test law', upvotes: 5, downvotes: 1 };

    renderHome(el, lawOfTheDay, onNavigate);

    // Should render Law of the Day plus calculator and submit sections
    expect(el.textContent).toMatch(/Law of the Day/);
    expect(el.textContent).toMatch(/Test law/);
    expect(el.textContent).toMatch(/Calculator|Submit/i);
  });
});

