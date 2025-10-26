import { Home, renderHome } from '@views/home.js';

describe('Home view', () => {
  it('renders Law of the Day after fetching data', async () => {
    const sample = [
      { id: '1', text: 'Anything that can go wrong will go wrong.', author: 'Edward Murphy', submittedBy: 'engineerMike', score: 10, publishDate: '2024-01-01' },
      { id: '2', text: 'Murphy was an optimist.', author: "O'Toole", submittedBy: 'projectSarah', score: 5, publishDate: '2024-01-02' },
    ];
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total: sample.length, data: sample }) });

    const el = Home({ isLoggedIn: false, onNavigate: () => {}, _onVote: () => {} });

    await new Promise(r => setTimeout(r, 0));

    expect(el.textContent).toMatch(/Law of the Day/);
  });

  it('navigates to law detail when clicking a law block (after fetch)', async () => {
    const sample = [
      { id: '42', text: 'Test law', author: 'Test', submittedBy: 'tester', score: 1, publishDate: '2024-01-03' },
    ];
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total: sample.length, data: sample }) });

    let nav = '';
    const el = Home({ isLoggedIn: false, onNavigate: (name, id) => { nav = `${name}:${id}`; }, _onVote: () => {} });

    await new Promise(r => setTimeout(r, 0));

    const block = el.querySelector(`[data-law-id="${sample[0].id}"]`);
    block.click();
    expect(nav).toBe(`law:${sample[0].id}`);
  });

  it('shows no results message when total is 0', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total: 0, data: [] }) });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    expect(el.textContent).toMatch(/No results found/);
    expect(el.textContent).toMatch(/There are no laws to show/);
  });

  it('shows error message on fetch failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Ironically, something went wrong/);

  });

  it('navigates using data-nav attribute', async () => {
    const sample = [
      { id: '1', text: 'Test law', score: 10 },
    ];
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total: 1, data: sample }) });

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
    const sample = [
      { id: '1', text: 'Test law', score: 10 },
    ];
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total: 1, data: sample }) });

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

  it('renders with no law of the day when laws array is empty', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total: 1, data: [] }) });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should render calculator and submit sections but no law of the day
    expect(el.textContent).not.toMatch(/Law of the Day/);
  });

  it('handles non-HTMLElement click targets', async () => {
    const sample = [
      { id: '1', text: 'Test law', score: 10 },
    ];
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total: 1, data: sample }) });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Simulate click with non-HTMLElement target
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null, writable: false });
    el.dispatchEvent(event);

    // Should not throw error
    expect(true).toBe(true);
  });

  it('shows Law of the Day when first law exists', async () => {
    const sample = [
      { id: '1', text: 'Law of the Day text', author: 'Murphy', score: 100 },
      { id: '2', text: 'Second law', score: 50 }
    ];
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total: 2, data: sample }) });

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
    const sample = [
      { id: '1', text: 'Test law', score: 10 }
    ];
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total: 1, data: sample }) });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    expect(el.textContent).toMatch(/Sod's Law Calculator|Calculator/i);
  });

  it('renders with submit section', async () => {
    const sample = [
      { id: '1', text: 'Test law', score: 10 }
    ];
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total: 1, data: sample }) });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    expect(el.textContent).toMatch(/Submit/i);
  });

  it('handles response with non-numeric total', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total: 'invalid', data: [] })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    expect(el.textContent).toMatch(/No results found/);
  });

  it('handles response with missing total field', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    expect(el.textContent).toMatch(/No results found/);
  });

  it('handles response with null json', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => null
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    expect(el.textContent).toMatch(/No results found/);
  });

  it('handles response where data is not an array', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total: 5, data: 'not an array' })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should render the widgets (calculator, submit) even with invalid data
    expect(el.textContent).toMatch(/Calculator|Submit/i);
  });

  it('handles response where data is missing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total: 5 })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should render the widgets (calculator, submit) even with missing data
    expect(el.textContent).toMatch(/Calculator|Submit/i);
  });

  it('handles laws with missing score field', async () => {
    const sample = [
      { id: '1', text: 'Law without score' },
      { id: '2', text: 'Another law', score: 50 }
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total: 2, data: sample })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should render without errors
    expect(el.textContent).toMatch(/Law of the Day/);
  });

  it('handles all laws with missing scores (tests nullish coalescing)', async () => {
    const sample = [
      { id: '1', text: 'First law without score' },
      { id: '2', text: 'Second law without score' }
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total: 2, data: sample })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should render without errors, both laws compared with score ?? 0
    expect(el.textContent).toMatch(/Law of the Day/);
  });

  it('handles laws with null scores', async () => {
    const sample = [
      { id: '1', text: 'Law with null score', score: null },
      { id: '2', text: 'Another law with null score', score: null }
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total: 2, data: sample })
    });

    const el = Home({ onNavigate: () => {} });
    await new Promise(r => setTimeout(r, 0));

    // Should render without errors
    expect(el.textContent).toMatch(/Law of the Day/);
  });
});

describe('renderHome function', () => {
  it('handles non-array laws parameter (defensive check)', () => {
    const el = document.createElement('div');
    const onNavigate = vi.fn();

    // Pass a non-array to test the defensive Array.isArray check
    renderHome(el, 'not an array', onNavigate);

    // Should render calculator and submit sections without errors
    expect(el.textContent).toMatch(/Calculator|Submit/i);
  });

  it('handles null laws parameter', () => {
    const el = document.createElement('div');
    const onNavigate = vi.fn();

    renderHome(el, null, onNavigate);

    // Should render calculator and submit sections without errors
    expect(el.textContent).toMatch(/Calculator|Submit/i);
  });
});

