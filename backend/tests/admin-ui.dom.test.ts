// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageHtml = readFileSync(resolve(__dirname, '../src/admin-ui/index.html'), 'utf8');
const pageDoc = new DOMParser().parseFromString(pageHtml, 'text/html');
pageDoc.querySelectorAll('script').forEach((node) => node.remove());
const body = pageDoc.body.innerHTML;

const law = (over: Record<string, unknown> = {}) => ({
  id: 1,
  title: 'T',
  text: 'A law of sufficient length',
  status: 'in_review',
  admin_notes: null,
  created_at: '2030-01-01T00:00:00.000Z',
  updated_at: 'v1',
  attributions: [{ name: 'Ann', contact_type: 'email', contact_value: 'a@b.c' }],
  categories: [{ id: 1, name: 'Cat' }],
  ...over,
});
const listReply = (laws: unknown[], over: Record<string, unknown> = {}) => ({
  data: laws,
  total: laws.length,
  counts: { in_review: laws.length, published: 4, rejected: 0 },
  ...over,
});
const jsonResponse = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });
const flush = async () => {
  for (let i = 0; i < 6; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
const $ = (id: string) => document.getElementById(id) as HTMLElement;
const click = (node: Element | null) => (node as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
const submit = (id: string) => $(id).dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
const action = (label: string) => [...document.querySelectorAll('.actions button')].find((b) => b.textContent === label) ?? null;
const button = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.startsWith(label)) ?? null;

describe('admin page', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  const connect = async () => {
    ($('token') as HTMLInputElement).value = ' secret ';
    submit('connect-form');
    await flush();
  };

  beforeEach(async () => {
    document.body.innerHTML = body;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The page asks for its GitHub session as soon as it loads; by default nobody is signed in and sign-in is not offered.
  const signedOut = (oauth = false) => jsonResponse({ authenticated: false, oauth });
  const boot = async (...replies: unknown[]) => bootWith(signedOut(), ...replies);
  const bootWith = async (sessionReply: unknown, ...replies: unknown[]) => {
    fetchMock.mockResolvedValueOnce(sessionReply);
    for (const r of replies) fetchMock.mockResolvedValueOnce(r);
    await import('../src/admin-ui/admin.js');
    await flush();
    // Forget the session check (always the first request) so each test sees only the requests it caused.
    fetchMock.mock.calls.shift();
  };

  it('connects with a bearer token and renders laws as text, never as HTML', async () => {
    await boot(jsonResponse(listReply([law({ text: '<img src=x onerror="window.pwned=1"> payload', title: '<b>x</b>' })])));
    await connect();

    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/admin/laws?status=in_review');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer secret');
    expect(document.querySelector('.law img')).toBeNull();
    expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toContain('<img src=x');
    expect(document.querySelector('.meta')?.textContent).toContain('Ann <a@b.c>');
    expect($('toolbar').hidden).toBe(false);
    expect(button('In review (1)')).not.toBeNull();
    expect(button('All (5)')).not.toBeNull();
  });

  it('renders each law as a card with its details in the header, fields in the body and actions in the footer', async () => {
    await boot(jsonResponse(listReply([law()])));
    await connect();

    const card = document.querySelector('.law') as HTMLElement;
    expect(card.classList.contains('card')).toBe(true);
    expect(card.querySelector(':scope > .card-header .pill')).not.toBeNull();
    expect(card.querySelectorAll(':scope > .card-body .field').length).toBe(4);
    expect(card.querySelector(':scope > .card-footer.actions button')).not.toBeNull();
  });

  it('shows an empty-state message', async () => {
    await boot(jsonResponse(listReply([], { total: 0 })));
    await connect();
    expect($('message').textContent).toBe('Nothing to show for this filter.');
  });

  it('hides the list and asks to reconnect when the token is rejected', async () => {
    await boot(jsonResponse(listReply([law()])), jsonResponse({ error: 'Unauthorized' }, 401));
    await connect();
    click(button('Published'));
    await flush();

    expect($('message').textContent).toContain('Token rejected');
    expect($('toolbar').hidden).toBe(true);
    expect(document.querySelectorAll('.law').length).toBe(0);
  });

  it('keeps the previous view and filter when switching tabs fails', async () => {
    await boot(jsonResponse(listReply([law()])), jsonResponse({ error: 'x' }, 429));
    await connect();
    click(button('Published'));
    await flush();

    expect($('message').textContent).toContain('Too many requests');
    expect(document.querySelectorAll('.law').length).toBe(1);
    expect(button('In review')?.getAttribute('aria-pressed')).toBe('true');
    expect(button('Published')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('explains network failures and unreadable responses', async () => {
    await boot();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await connect();
    expect($('message').textContent).toContain('Cannot reach the server');

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } });
    submit('connect-form');
    await flush();
    expect($('message').textContent).toContain('unreadable response');

    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, json: async () => { throw new SyntaxError('x'); } });
    submit('connect-form');
    await flush();
    expect($('message').textContent).toBe('Request failed (502).');
  });

  it('approves a law: sends only changes, drops the card and updates counts without reloading', async () => {
    await boot(jsonResponse(listReply([law(), law({ id: 2, text: 'Second law of enough length' })])));
    await connect();
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: law({ status: 'published' }) }));
    click(button('Approve'));
    await flush();

    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/v1/admin/laws/1');
    expect(JSON.parse(options.body)).toEqual({ status: 'published', updated_at: 'v1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll('.law').length).toBe(1);
    expect($('message').textContent).toBe('Law #1 updated.');
    expect(button('Published (5)')).not.toBeNull();
    expect(button('In review (1)')).not.toBeNull();
  });

  it.each([
    [{ status: 'queued' }, 'Law #1 updated. Thank-you email is being sent (delivery is not confirmed).'],
    [{ status: 'skipped', reason: 'no_email' }, 'Law #1 updated. The submitter left no email address, so no thank-you was sent.'],
    [{ status: 'skipped', reason: 'not_configured' }, 'Law #1 updated. Email is not set up on the server, so no thank-you was sent.'],
    [null, 'Law #1 updated.'],
    [undefined, 'Law #1 updated.'],
  ])('reports the thank-you outcome %j in the update message', async (thankYou, expected) => {
    await boot(jsonResponse(listReply([law(), law({ id: 2, text: 'Second law of enough length' })])));
    await connect();
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: law({ status: 'published' }), thank_you: thankYou }));
    click(action('Approve'));
    await flush();
    expect($('message').textContent).toBe(expected);
  });

  it('keeps the thank-you note when the list cannot refresh after a concurrent save', async () => {
    await boot(jsonResponse(listReply([law()])));
    await connect();
    let finishSave!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { finishSave = resolve; }));
    click(action('Approve'));
    await flush();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'x' }, 500));
    click(button('Published'));
    await flush();

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'x' }, 500));
    finishSave(jsonResponse({ data: law({ status: 'published' }), thank_you: { status: 'queued' } }));
    await flush();
    expect($('message').textContent).toContain('delivery is not confirmed');
  });

  it('keeps edits in other cards and re-enables buttons when a save fails', async () => {
    await boot(jsonResponse(listReply([law(), law({ id: 2, text: 'Second law of enough length' })])));
    await connect();
    const notes = document.getElementById('notes-1') as HTMLInputElement;
    notes.value = 'looks fine';
    const second = document.getElementById('text-2') as HTMLTextAreaElement;
    second.value = 'unsaved edit in another card';

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Internal Server Error' }, 500));
    click(action('Save edits'));
    await flush();

    expect($('message').textContent).toBe('Internal Server Error');
    expect([...document.querySelectorAll('.law:first-child .actions button')].every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
    expect((document.getElementById('text-2') as HTMLTextAreaElement).value).toBe('unsaved edit in another card');
  });

  it('removes the card and fixes counts when the law no longer exists', async () => {
    await boot(jsonResponse(listReply([law(), law({ id: 2, text: 'Second law of enough length' })])));
    await connect();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Law not found' }, 404));
    click(action('Approve'));
    await flush();

    expect($('message').textContent).toBe('Law #1 no longer exists.');
    expect(document.querySelectorAll('.law').length).toBe(1);
    expect(document.getElementById('text-1')).toBeNull();
    expect(button('In review (1)')).not.toBeNull();
  });

  it('reloads the list after a conflict and tells the admin to apply the edit again', async () => {
    await boot(jsonResponse(listReply([law()])));
    await connect();
    (document.getElementById('notes-1') as HTMLInputElement).value = 'mine';
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'This law changed since you loaded it.' }, 409));
    fetchMock.mockResolvedValueOnce(jsonResponse(listReply([law({ updated_at: 'v2', admin_notes: 'theirs' })])));
    click(action('Save edits'));
    await flush();

    expect($('message').textContent).toContain('apply your edit again');
    expect((document.getElementById('notes-1') as HTMLInputElement).value).toBe('theirs');
    expect(fetchMock.mock.calls[2][0]).toContain('/api/v1/admin/laws?');
  });

  it('shows the server message on a conflict when the reload also fails', async () => {
    await boot(jsonResponse(listReply([law()])));
    await connect();
    (document.getElementById('notes-1') as HTMLInputElement).value = 'mine';
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'This law changed since you loaded it.' }, 409));
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'x' }, 500));
    click(action('Save edits'));
    await flush();
    expect($('message').textContent).toContain('changed since you loaded it');
    expect(document.querySelectorAll('.law').length).toBe(1);
  });

  it('disconnects when the token is rejected during a save', async () => {
    await boot(jsonResponse(listReply([law()])));
    await connect();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401));
    click(action('Approve'));
    await flush();

    expect($('message').textContent).toContain('Token rejected');
    expect($('toolbar').hidden).toBe(true);
    expect(document.querySelectorAll('.law').length).toBe(0);
    expect(($('search') as HTMLInputElement).value).toBe('');
  });

  it('sends the bearer token and only the changed fields when saving', async () => {
    await boot(jsonResponse(listReply([law()])));
    await connect();
    (document.getElementById('notes-1') as HTMLInputElement).value = 'checked twice';
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: law({ admin_notes: 'checked twice', updated_at: 'v2' }) }));
    click(action('Save edits'));
    await flush();

    const [, options] = fetchMock.mock.calls[1];
    expect(options.headers.Authorization).toBe('Bearer secret');
    expect(JSON.parse(options.body)).toEqual({ admin_notes: 'checked twice', updated_at: 'v1' });
  });

  describe('category selector', () => {
    const cats = [{ id: 1, name: 'Cat' }, { id: 2, name: 'Dog' }];
    const select = (id = 1) => document.getElementById(`category-${id}`) as HTMLSelectElement;

    it('lists the server categories with the current one selected', async () => {
      await boot(jsonResponse(listReply([law()], { categories: cats })));
      await connect();
      expect([...select().options].map((o) => o.textContent)).toEqual(['No category', 'Cat', 'Dog']);
      expect(select().value).toBe('1');
      expect(document.querySelector('label[for="category-1"]')?.textContent).toBe('Category');
    });

    it('saves only the new category and shows it on the refreshed card', async () => {
      await boot(jsonResponse(listReply([law()], { categories: cats })));
      await connect();
      select().value = '2';
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: law({ categories: [cats[1]], updated_at: 'v2' }) }));
      click(action('Save edits'));
      await flush();

      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ category_id: 2, updated_at: 'v1' });
      expect($('message').textContent).toBe('Law #1 updated.');
      expect(select().value).toBe('2');
    });

    it('does not send a request when the category is unchanged', async () => {
      await boot(jsonResponse(listReply([law()], { categories: cats })));
      await connect();
      click(action('Save edits'));
      await flush();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect($('message').textContent).toBe('Law #1 has no changes.');
    });

    it('shows a placeholder for a law with several categories and leaves it alone until one is picked', async () => {
      await boot(jsonResponse(listReply([law({ categories: cats })], { categories: cats })));
      await connect();
      expect(select().options[0].textContent).toBe('Several categories (pick one to replace)');
      expect(select().value).toBe('');
      click(action('Save edits'));
      await flush();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("still shows the law's own category when the server sent no category list", async () => {
      await boot(jsonResponse(listReply([law({ categories: [{ id: 9, name: 'Odd' }] })])));
      await connect();
      expect([...select().options].map((o) => o.textContent)).toEqual(['No category', 'Odd']);
      expect(select().value).toBe('9');
    });

    it('never offers the placeholder as a choice, since a category cannot be cleared', async () => {
      await boot(jsonResponse(listReply([law(), law({ id: 2, categories: [] }), law({ id: 3, categories: cats })], { categories: cats })));
      await connect();
      for (const id of [1, 2, 3]) {
        expect(select(id).options[0].disabled).toBe(true);
      }
      expect(select(1).value).toBe('1');
    });

    it('reloads the list when the chosen category no longer exists', async () => {
      await boot(jsonResponse(listReply([law()], { categories: cats })));
      await connect();
      select().value = '2';
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Unknown category' }, 400));
      fetchMock.mockResolvedValueOnce(jsonResponse(listReply([law()], { categories: [cats[0]] })));
      click(action('Save edits'));
      await flush();
      expect($('message').textContent).toBe('That category no longer exists. The list was reloaded; pick a category again.');
      expect([...select().options].map((o) => o.textContent)).toEqual(['No category', 'Cat']);
    });

    it('shows the server message when the reload after an unknown category also fails', async () => {
      await boot(jsonResponse(listReply([law()], { categories: cats })));
      await connect();
      select().value = '2';
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Unknown category' }, 400));
      fetchMock.mockRejectedValueOnce(new Error('offline'));
      click(action('Save edits'));
      await flush();
      expect($('message').textContent).toBe('Unknown category');
    });

    it('shows the server error and keeps the selection when the category is rejected', async () => {
      await boot(jsonResponse(listReply([law()], { categories: cats })));
      await connect();
      select().value = '2';
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'category_id must be a positive integer' }, 400));
      click(action('Save edits'));
      await flush();
      expect($('message').textContent).toBe('category_id must be a positive integer');
      expect(select().value).toBe('2');
      expect((action('Save edits') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('omits updated_at for a law that has none', async () => {
    await boot(jsonResponse(listReply([law({ updated_at: null })])));
    await connect();
    (document.getElementById('notes-1') as HTMLInputElement).value = 'note';
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: law({ admin_notes: 'note', updated_at: 'v2' }) }));
    click(action('Save edits'));
    await flush();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ admin_notes: 'note' });
  });

  it('does not send a request when nothing changed', async () => {
    await boot(jsonResponse(listReply([law()])));
    await connect();
    click(button('Save edits'));
    await flush();
    expect($('message').textContent).toBe('Law #1 has no changes.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('replaces the card in place after saving edits in the same filter', async () => {
    await boot(jsonResponse(listReply([law()])));
    await connect();
    (document.getElementById('title-1') as HTMLInputElement).value = 'New title';
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: law({ title: 'New title', updated_at: 'v2' }) }));
    click(button('Save edits'));
    await flush();
    expect((document.getElementById('title-1') as HTMLInputElement).value).toBe('New title');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reloads the same offset when a save empties a page, falling back a page if nothing is left', async () => {
    const page2 = law({ id: 30, text: 'Only law on the second page' });
    await boot(jsonResponse(listReply(Array.from({ length: 25 }, (_, i) => law({ id: i + 100, text: `Law number ${i} long enough` })), { total: 26 })));
    await connect();
    fetchMock.mockResolvedValueOnce(jsonResponse(listReply([page2], { total: 26 })));
    click($('next'));
    await flush();
    expect(fetchMock.mock.calls[1][0]).toContain('offset=25');

    fetchMock.mockResolvedValueOnce(jsonResponse({ data: law({ id: 30, status: 'published' }) }));
    fetchMock.mockResolvedValueOnce(jsonResponse(listReply([], { total: 25 })));
    fetchMock.mockResolvedValueOnce(jsonResponse(listReply(Array.from({ length: 25 }, (_, i) => law({ id: i + 100 })), { total: 25 })));
    click(action('Approve'));
    await flush();
    expect(fetchMock.mock.calls[3][0]).toContain('offset=25');
    expect(fetchMock.mock.calls[4][0]).toContain('offset=0');
    expect(document.querySelectorAll('.law').length).toBe(25);
  });

  it('pulls in the next laws when a save empties a page that has later pages', async () => {
    await boot(jsonResponse(listReply([law()], { total: 40 })));
    await connect();
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: law({ status: 'published' }) }));
    fetchMock.mockResolvedValueOnce(jsonResponse(listReply([law({ id: 50, text: 'Next law that moved up' })], { total: 39 })));
    click(action('Approve'));
    await flush();
    expect(fetchMock.mock.calls[2][0]).toContain('offset=0');
    expect(document.getElementById('text-50')).not.toBeNull();
  });

  it('continues after the cards still on screen so removed cards do not skip laws', async () => {
    const page = Array.from({ length: 25 }, (_, i) => law({ id: i + 1, text: `Law number ${i} long enough` }));
    await boot(jsonResponse(listReply(page, { total: 40 })));
    await connect();
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: law({ id: 1, status: 'published' }) }));
    click(action('Approve'));
    await flush();
    expect(document.querySelectorAll('.law').length).toBe(24);

    fetchMock.mockResolvedValueOnce(jsonResponse(listReply([law({ id: 99, text: 'Law that moved up one slot' })], { total: 39 })));
    click($('next'));
    await flush();
    expect(fetchMock.mock.calls[2][0]).toContain('offset=24');
  });

  it('reloads instead of patching when a list refresh happened during the save', async () => {
    await boot(jsonResponse(listReply([law()])));
    await connect();
    let finishSave!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { finishSave = resolve; }));
    click(action('Approve'));
    await flush();

    fetchMock.mockResolvedValueOnce(jsonResponse(listReply([law()])));
    click(button('Published'));
    await flush();

    fetchMock.mockResolvedValueOnce(jsonResponse(listReply([law({ id: 7, status: 'published', text: 'Published law shown after reload' })], { counts: { in_review: 0, published: 5, rejected: 0 } })));
    finishSave(jsonResponse({ data: law({ status: 'published' }) }));
    await flush();

    expect($('message').textContent).toBe('Law #1 updated.');
    expect(button('Published (5)')).not.toBeNull();
    expect(button('In review (0)')).not.toBeNull();
  });

  it('says the list could not refresh when the reload after a concurrent save fails', async () => {
    await boot(jsonResponse(listReply([law()])));
    await connect();
    let finishSave!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { finishSave = resolve; }));
    click(action('Approve'));
    await flush();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'x' }, 500));
    click(button('Published'));
    await flush();

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'x' }, 500));
    finishSave(jsonResponse({ data: law({ status: 'published' }) }));
    await flush();
    expect($('message').textContent).toContain('saved, but the list could not refresh');
  });

  it('keeps the success state when refilling an emptied page fails', async () => {
    await boot(jsonResponse(listReply([law()], { total: 40 })));
    await connect();
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: law({ status: 'published' }) }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'x' }, 500));
    click(action('Approve'));
    await flush();
    expect($('message').textContent).toContain('saved, but the list could not refresh');
  });

  it('survives malformed server replies without leaving the page stuck', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await boot(jsonResponse({ nothing: true }));
    await connect();
    expect($('message').textContent).toContain('could not be read');

    fetchMock.mockResolvedValueOnce(jsonResponse(listReply([law()])));
    submit('connect-form');
    await flush();
    expect(document.querySelectorAll('.law').length).toBe(1);

    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    click(action('Approve'));
    await flush();
    expect($('message').textContent).toContain('could not be read');
    expect([...document.querySelectorAll('.actions button')].every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
  });

  it('keeps the old view when rendering a reply throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await boot(jsonResponse(listReply([law()])));
    await connect();
    fetchMock.mockResolvedValueOnce(jsonResponse(listReply([null as never])));
    click(button('Published'));
    await flush();
    expect($('message').textContent).toContain('could not be displayed');
    expect(document.querySelectorAll('.law').length).toBe(1);
    expect(button('In review')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('reports a failure after a successful save when the page cannot refresh', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await boot(jsonResponse(listReply([law()])));
    await connect();
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { status: 'in_review', categories: [null] } }));
    click(action('Approve'));
    await flush();
    expect($('message').textContent).toContain('page could not refresh');
  });

  it('reverts the search box when a search fails and clears the token after connecting', async () => {
    await boot(jsonResponse(listReply([law()])));
    await connect();
    expect(($('token') as HTMLInputElement).value).toBe('');

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'x' }, 500));
    ($('search') as HTMLInputElement).value = 'typo';
    submit('search-form');
    await flush();
    expect(($('search') as HTMLInputElement).value).toBe('');
  });

  it('renders every law field as text, never as HTML', async () => {
    const evil = '"><svg onload="window.pwned=1">';
    await boot(jsonResponse(listReply([law({
      title: evil,
      admin_notes: evil,
      categories: [{ id: 1, name: '<script>window.pwned=1</script>' }],
      attributions: [{ name: '<img src=x onerror="window.pwned=1">', contact_type: 'text', contact_value: null }],
    })])));
    await connect();

    expect(document.querySelector('.law svg, .law script, .law img')).toBeNull();
    expect((document.getElementById('title-1') as HTMLInputElement).value).toBe(evil);
    expect(document.querySelector('.law-head')?.textContent).toContain('<script>window.pwned=1</script>');
    expect((window as unknown as { pwned?: number }).pwned).toBeUndefined();
  });

  it('searches, pages with Previous/Next and ignores out-of-order responses', async () => {
    const many = Array.from({ length: 25 }, (_, i) => law({ id: i + 1, text: `Law number ${i} long enough` }));
    await boot(jsonResponse(listReply(many, { total: 40 })));
    await connect();
    expect(($('prev') as HTMLButtonElement).disabled).toBe(true);
    expect($('page-label').textContent).toBe('1-25 of 40');

    fetchMock.mockResolvedValueOnce(jsonResponse(listReply(many.slice(0, 15), { total: 40 })));
    click($('next'));
    await flush();
    expect($('page-label').textContent).toBe('26-40 of 40');
    expect(($('next') as HTMLButtonElement).disabled).toBe(true);

    fetchMock.mockResolvedValueOnce(jsonResponse(listReply(many, { total: 40 })));
    click($('prev'));
    await flush();
    expect(fetchMock.mock.calls[2][0]).toContain('offset=0');

    let release!: (v: unknown) => void;
    fetchMock.mockReturnValueOnce(new Promise((r) => { release = r; }));
    fetchMock.mockResolvedValueOnce(jsonResponse(listReply([law({ id: 77, text: 'Newer search result law' })])));
    ($('search') as HTMLInputElement).value = 'slow';
    submit('search-form');
    ($('search') as HTMLInputElement).value = 'fast';
    submit('search-form');
    await flush();
    release(jsonResponse(listReply([law({ id: 88, text: 'Stale search result law' })])));
    await flush();

    expect(fetchMock.mock.calls[3][0]).toContain('q=slow');
    expect(fetchMock.mock.calls[4][0]).toContain('q=fast');
    expect(document.getElementById('text-77')).not.toBeNull();
    expect(document.getElementById('text-88')).toBeNull();
  });

  it('shows the empty state when saving the last law leaves nothing', async () => {
    await boot(jsonResponse(listReply([law()], { total: 1 })));
    await connect();
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: law({ status: 'rejected' }) }));
    click(action('Reject'));
    await flush();
    expect($('message').textContent).toBe('Nothing to show for this filter.');
    expect(document.querySelectorAll('.law').length).toBe(0);
  });

  it('offers the right actions for each status', async () => {
    await boot(jsonResponse(listReply([law({ status: 'published' }), law({ id: 2, status: 'rejected', text: 'Rejected law of enough length' })])));
    await connect();
    const labels = (n: number) => [...document.querySelectorAll('.law')[n].querySelectorAll('.actions button')].map((b) => b.textContent);
    expect(labels(0)).toEqual(['Reject', 'Move to review', 'Save edits']);
    expect(labels(1)).toEqual(['Approve', 'Move to review', 'Save edits']);
  });

  describe('GitHub sign-in', () => {
    const signedIn = (login = 'ravidorr') => jsonResponse({ authenticated: true, login, oauth: true });

    it('shows the token form only, with no GitHub link, when the server does not offer sign-in', async () => {
      await boot();
      expect(($('github-signin') as HTMLElement).hidden).toBe(true);
      expect(($('token-fallback') as HTMLDetailsElement).open).toBe(true);
      expect(($('session') as HTMLElement).hidden).toBe(true);
      expect(($('signin-intro') as HTMLElement).hidden).toBe(true);
      expect(($('signin-footer') as HTMLElement).hidden).toBe(false);
    });

    it('offers the GitHub link with the token form tucked away when the server offers sign-in', async () => {
      await bootWith(signedOut(true));
      const link = $('github-signin') as HTMLAnchorElement;
      expect(link.hidden).toBe(false);
      expect(link.getAttribute('href')).toBe('/api/v1/admin/auth/github');
      expect(($('token-fallback') as HTMLDetailsElement).open).toBe(false);
      expect(document.querySelector('#token-fallback summary')?.textContent).toBe('Use an API token');
      expect(($('signin-intro') as HTMLElement).hidden).toBe(false);
      expect(($('signin-footer') as HTMLElement).hidden).toBe(true);
    });

    it('keeps the token form working next to the GitHub link', async () => {
      await bootWith(signedOut(true), jsonResponse(listReply([law()])));
      await connect();
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer secret');
      expect(document.querySelectorAll('.law').length).toBe(1);
    });

    it('loads the laws straight away when the browser already has a session, using the cookie and no token', async () => {
      await bootWith(signedIn(), jsonResponse(listReply([law()])));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/admin/laws?status=in_review');
      expect(options.credentials).toBe('same-origin');
      expect(options.headers.Authorization).toBeUndefined();
      expect(options.headers['X-Admin-Request']).toBe('1');
      expect(document.querySelectorAll('.law').length).toBe(1);
      expect(($('session') as HTMLElement).hidden).toBe(false);
      expect($('session-login').textContent).toBe('ravidorr');
      expect(($('signin') as HTMLElement).hidden).toBe(true);
    });

    it('sends the CSRF header on writes made with the session', async () => {
      await bootWith(signedIn(), jsonResponse(listReply([law()])));
      (document.getElementById('notes-1') as HTMLInputElement).value = 'checked';
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: law({ admin_notes: 'checked', updated_at: 'v2' }) }));
      click(action('Save edits'));
      await flush();

      const [url, options] = fetchMock.mock.calls[1];
      expect(url).toBe('/api/v1/admin/laws/1');
      expect(options.headers['X-Admin-Request']).toBe('1');
      expect(options.headers.Authorization).toBeUndefined();
    });

    it('signs out: asks the server to clear the cookie and returns to the sign-in controls', async () => {
      await bootWith(signedIn(), jsonResponse(listReply([law()])));
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
      click($('sign-out'));
      await flush();

      const [url, options] = fetchMock.mock.calls[1];
      expect(url).toBe('/api/v1/admin/auth/logout');
      expect(options.method).toBe('POST');
      expect(options.headers['X-Admin-Request']).toBe('1');
      expect($('message').textContent).toBe('Signed out.');
      expect(($('session') as HTMLElement).hidden).toBe(true);
      expect(($('signin') as HTMLElement).hidden).toBe(false);
      expect(($('github-signin') as HTMLElement).hidden).toBe(false);
      expect(document.querySelectorAll('.law').length).toBe(0);
      expect($('toolbar').hidden).toBe(true);
    });

    it('stays signed in and says why when signing out fails', async () => {
      await bootWith(signedIn(), jsonResponse(listReply([law()])));
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Forbidden' }, 403));
      click($('sign-out'));
      await flush();

      expect($('message').textContent).toContain('refused');
      expect(($('session') as HTMLElement).hidden).toBe(false);
      expect(document.querySelectorAll('.law').length).toBe(1);
    });

    it('asks to sign in again when the session ends while using the page', async () => {
      await bootWith(signedIn(), jsonResponse(listReply([law()])), jsonResponse({ error: 'Unauthorized' }, 401));
      click(button('Published'));
      await flush();

      expect($('message').textContent).toBe('Your session ended. Sign in with GitHub again.');
      expect(($('session') as HTMLElement).hidden).toBe(true);
      expect(($('github-signin') as HTMLElement).hidden).toBe(false);
      expect(document.querySelectorAll('.law').length).toBe(0);
    });

    it('explains a refused write', async () => {
      await bootWith(signedIn(), jsonResponse(listReply([law()])));
      (document.getElementById('notes-1') as HTMLInputElement).value = 'x';
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Forbidden' }, 403));
      click(action('Save edits'));
      await flush();
      expect($('message').textContent).toBe('This request was refused. Reload the page and sign in again.');
    });

    it.each([
      ['the session check cannot be reached', () => Promise.reject(new TypeError('offline'))],
      ['the session reply is not JSON', () => Promise.resolve({ ok: false, status: 502, json: async () => { throw new SyntaxError('x'); } })],
      ['the session reply is empty', () => Promise.resolve(jsonResponse(null))],
    ])('falls back to the token form when %s', async (_name, sessionReply) => {
      fetchMock.mockImplementationOnce(sessionReply);
      await import('../src/admin-ui/admin.js');
      await flush();

      expect(($('github-signin') as HTMLElement).hidden).toBe(true);
      expect(($('token-fallback') as HTMLDetailsElement).open).toBe(true);
      expect(($('session') as HTMLElement).hidden).toBe(true);
    });

    it('keeps the sign-in card hidden until the session check has answered', async () => {
      let answer: (reply: unknown) => void = () => {};
      fetchMock.mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
      await import('../src/admin-ui/admin.js');
      expect(($('signin') as HTMLElement).hidden).toBe(true);

      answer(signedOut(true));
      await flush();
      expect(($('signin') as HTMLElement).hidden).toBe(false);
    });

    it('marks the card as token-only exactly when GitHub sign-in is not offered', async () => {
      await boot();
      expect($('signin').classList.contains('is-token-only')).toBe(true);
      document.body.innerHTML = body;
      vi.resetModules();
      await bootWith(signedOut(true));
      expect($('signin').classList.contains('is-token-only')).toBe(false);
    });

    it('hides the sign-in card once a token connection has loaded the laws', async () => {
      await bootWith(signedOut(true), jsonResponse(listReply([law()])));
      expect(($('signin') as HTMLElement).hidden).toBe(false);
      await connect();
      expect(($('signin') as HTMLElement).hidden).toBe(true);
      expect(($('session') as HTMLElement).hidden).toBe(true);
    });

    it('does not take over a token connection when the session check answers late', async () => {
      let answer: (reply: unknown) => void = () => {};
      fetchMock.mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
      fetchMock.mockResolvedValueOnce(jsonResponse(listReply([law()])));
      await import('../src/admin-ui/admin.js');
      await connect();
      expect(document.querySelectorAll('.law').length).toBe(1);

      answer(signedIn());
      await flush();
      expect(($('session') as HTMLElement).hidden).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('splitting corollaries out of a law', () => {
    const PARENT = 'A red light turns green right after you stop watching it.';
    const candidates = {
      parent_text: PARENT,
      items: [
        { title: 'The Ignition Corollary', text: 'The engine restarts slowly behind a horn.', labeled: true },
        { title: null, text: 'Remember to breathe while waiting.', labeled: false },
        { title: 'The Green-Light Corollary', text: 'The green lasts just long enough to miss.', labeled: true },
      ],
    };
    const splittable = (over: Record<string, unknown> = {}) => law({ id: 7, title: 'Lights', text: `${PARENT}\n\n• The Ignition Corollary: x`, corollary_candidates: candidates, ...over });
    const cats = [{ id: 1, name: 'Cat' }, { id: 2, name: 'Dog' }];
    const rowsOf = () => [...document.querySelectorAll('.split-row')] as HTMLElement[];
    const field = (row: number, part: 'treat' | 'title' | 'text') => document.getElementById(`split-7-${row}-${part}`) as HTMLInputElement & HTMLSelectElement;
    const approveButton = () => document.querySelector('.split-actions .btn-primary') as HTMLButtonElement;
    const change = (node: HTMLElement, value: string) => {
      (node as HTMLInputElement).value = value;
      node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    };
    const open = async (over: Record<string, unknown> = {}) => {
      await boot(jsonResponse(listReply([splittable(over)], { categories: cats })));
      await connect();
      click(button('Review split'));
    };
    const reply = () => jsonResponse({
      data: splittable({ status: 'published', updated_at: 'v2' }),
      corollaries: [{ id: 11 }, { id: 12 }],
      thank_you: { status: 'queued' },
    });

    it('shows the banner and the Review split button only for laws with candidates', async () => {
      await boot(jsonResponse(listReply([splittable(), law({ id: 8, text: 'A plain law of sufficient length' })], { categories: cats })));
      await connect();
      const banners = document.querySelectorAll('.split-banner');
      expect(banners.length).toBe(1);
      expect(banners[0].textContent).toContain('3 bullets found in the law text, 2 of them labeled as corollaries.');
      expect(banners[0].querySelector('button')?.textContent).toBe('Review split');
      expect(document.querySelector('.split-review')).toBeNull();
    });

    it('refuses to open the review while the Law field has an unsaved edit, and opens it once the edit is undone', async () => {
      await boot(jsonResponse(listReply([splittable()], { categories: cats })));
      await connect();
      const original = (document.getElementById('text-7') as HTMLTextAreaElement).value;
      (document.getElementById('text-7') as HTMLTextAreaElement).value = `${original} typo fixed`;
      click(button('Review split'));
      expect($('message').textContent).toBe('Law #7: save or undo your edit to the law text before reviewing the split.');
      expect($('message').classList.contains('is-error')).toBe(true);
      expect(document.querySelector('.split-review')).toBeNull();

      (document.getElementById('text-7') as HTMLTextAreaElement).value = original;
      click(button('Review split'));
      expect(document.querySelector('.split-review')).not.toBeNull();
    });

    it('shows the banner from the candidates the server returns after a save, and drops it when there are none', async () => {
      await boot(jsonResponse(listReply([splittable()], { categories: cats })));
      await connect();
      (document.getElementById('notes-7') as HTMLInputElement).value = 'checked';
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: splittable({ admin_notes: 'checked', updated_at: 'v2' }) }));
      click(action('Save edits'));
      await flush();
      expect(document.querySelector('.split-banner')).not.toBeNull();

      (document.getElementById('text-7') as HTMLTextAreaElement).value = 'A rewritten law without any bullets at all.';
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: splittable({ text: 'A rewritten law without any bullets at all.', updated_at: 'v3', corollary_candidates: undefined }) }));
      click(action('Save edits'));
      await flush();
      expect(document.querySelector('.split-banner')).toBeNull();
    });

    it('offers the split after a saved edit that added bullets, and then opens the review', async () => {
      await boot(jsonResponse(listReply([law({ id: 7, title: 'Lights', text: 'A plain law of enough length' })], { categories: cats })));
      await connect();
      expect(document.querySelector('.split-banner')).toBeNull();
      (document.getElementById('text-7') as HTMLTextAreaElement).value = splittable().text;
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: splittable({ updated_at: 'v2' }) }));
      click(action('Save edits'));
      await flush();
      expect(document.querySelector('.split-banner')).not.toBeNull();
      click(button('Review split'));
      expect(document.querySelector('.split-review')).not.toBeNull();
    });

    it('opens the review in the card with labeled bullets as corollaries and unlabeled ones kept, then focuses its heading', async () => {
      await open();
      const heading = document.querySelector('.split-review h3') as HTMLElement;
      expect(heading.textContent).toBe('Review the split');
      expect(document.activeElement).toBe(heading);
      expect(heading.tabIndex).toBe(-1);

      expect(rowsOf().length).toBe(3);
      expect([0, 1, 2].map((i) => field(i, 'treat').value)).toEqual(['corollary', 'keep', 'corollary']);
      expect(field(0, 'title').value).toBe('The Ignition Corollary');
      expect(field(1, 'text').value).toBe('Remember to breathe while waiting.');
      expect([...field(0, 'treat').options].map((o) => o.textContent)).toEqual(['Corollary', 'Keep in parent text']);
      expect((document.getElementById('split-parent-7') as HTMLTextAreaElement).value).toBe(PARENT);
      expect(approveButton().textContent).toBe('Approve and publish 3 laws');
      expect(document.querySelector('.split-banner')?.hasAttribute('hidden')).toBe(true);
      expect(document.getElementById('text-7')?.closest('.field')?.hasAttribute('hidden')).toBe(true);
      expect(action('Approve')?.closest('.actions')?.hasAttribute('hidden')).toBe(true);
    });

    it('labels every control in the review', async () => {
      await open();
      for (const node of document.querySelectorAll('.split-review input, .split-review textarea, .split-review select')) {
        expect(document.querySelector(`label[for="${node.id}"]`)?.textContent, node.id).toBeTruthy();
      }
    });

    it('recomposes the parent text live when a bullet is kept or released', async () => {
      await open();
      const composed = () => document.querySelector('.split-composed') as HTMLElement;
      expect(composed().hidden).toBe(false);
      expect(composed().textContent).toContain(`${PARENT}`);
      expect(composed().textContent).toContain('• Remember to breathe while waiting.');
      expect(approveButton().textContent).toBe('Approve and publish 3 laws');

      change(field(1, 'treat'), 'corollary');
      expect(composed().hidden).toBe(true);
      expect(approveButton().textContent).toBe('Approve and publish 4 laws');

      change(field(0, 'treat'), 'keep');
      expect(composed().textContent).toContain('• The Ignition Corollary: The engine restarts slowly behind a horn.');
      expect(approveButton().textContent).toBe('Approve and publish 3 laws');
      expect(rowsOf()[0].querySelector('.field--title')?.hasAttribute('hidden')).toBe(true);
    });

    it('updates the preview when the parent text or a kept bullet is edited', async () => {
      await open();
      change(document.getElementById('split-parent-7') as HTMLElement, 'Edited parent sentence of the law.');
      change(field(1, 'text'), 'Edited kept bullet text.');
      expect(document.querySelector('.split-composed')?.textContent).toContain('Edited parent sentence of the law.\n\n• Edited kept bullet text.');
    });

    it('sends the explicit body, then reloads the list, reports the thank-you and moves focus to the message', async () => {
      await open();
      change(field(0, 'title'), ' The Ignition Corollary! ');
      fetchMock.mockResolvedValueOnce(reply());
      fetchMock.mockResolvedValueOnce(jsonResponse(listReply([], { total: 0, counts: { in_review: 0, published: 7, rejected: 0 } })));
      click(approveButton());
      await flush();

      const [url, options] = fetchMock.mock.calls[1];
      expect(url).toBe('/api/v1/admin/laws/7/split');
      expect(options.method).toBe('POST');
      expect(options.headers.Authorization).toBe('Bearer secret');
      expect(JSON.parse(options.body)).toEqual({
        updated_at: 'v1',
        parent_text: `${PARENT}\n\n• Remember to breathe while waiting.`,
        corollaries: [
          { title: 'The Ignition Corollary!', text: 'The engine restarts slowly behind a horn.' },
          { title: 'The Green-Light Corollary', text: 'The green lasts just long enough to miss.' },
        ],
      });
      expect(fetchMock.mock.calls[2][0]).toContain('/api/v1/admin/laws?');
      expect($('message').textContent).toBe('Law #7 was split into 3 laws. Thank-you email is being sent (delivery is not confirmed).');
      expect(document.activeElement).toBe($('message'));
      expect(button('Published (7)')).not.toBeNull();
      expect(document.querySelectorAll('.law').length).toBe(0);
    });

    it('sends a changed title, notes and category from the card fields', async () => {
      await open();
      (document.getElementById('title-7') as HTMLInputElement).value = 'New title';
      (document.getElementById('notes-7') as HTMLInputElement).value = 'checked';
      (document.getElementById('category-7') as HTMLSelectElement).value = '2';
      fetchMock.mockResolvedValueOnce(reply());
      fetchMock.mockResolvedValueOnce(jsonResponse(listReply([])));
      click(approveButton());
      await flush();
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ title: 'New title', admin_notes: 'checked', category_id: 2 });
    });

    it('says the split was saved when the list cannot refresh afterwards', async () => {
      await open();
      fetchMock.mockResolvedValueOnce(reply());
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'x' }, 500));
      click(approveButton());
      await flush();
      expect($('message').textContent).toBe('Law #7 was split into 3 laws, but the list could not refresh. Click a tab to reload. Thank-you email is being sent (delivery is not confirmed).');
      expect($('message').classList.contains('is-error')).toBe(true);
    });

    it('uses singular wording for a single corollary and omits the thank-you when there was none', async () => {
      await open();
      change(field(2, 'treat'), 'keep');
      expect(approveButton().textContent).toBe('Approve and publish 2 laws');
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: splittable({ status: 'published' }), corollaries: [{ id: 11 }], thank_you: null }));
      fetchMock.mockResolvedValueOnce(jsonResponse(listReply([])));
      click(approveButton());
      await flush();
      expect($('message').textContent).toBe('Law #7 was split into 2 laws.');
    });

    it('Cancel returns to the card with the edits intact and focuses the Review split button', async () => {
      await open();
      (document.getElementById('notes-7') as HTMLInputElement).value = 'kept';
      click(button('Cancel'));

      expect(document.querySelector('.split-review')).toBeNull();
      expect(document.querySelector('.split-banner')?.hasAttribute('hidden')).toBe(false);
      expect(document.getElementById('text-7')?.closest('.field')?.hasAttribute('hidden')).toBe(false);
      expect(action('Approve')?.closest('.actions')?.hasAttribute('hidden')).toBe(false);
      expect((document.getElementById('notes-7') as HTMLInputElement).value).toBe('kept');
      expect(document.activeElement).toBe(button('Review split'));
      expect(fetchMock).toHaveBeenCalledTimes(1);

      click(button('Review split'));
      expect(rowsOf().length).toBe(3);
    });

    it('disables Approve and explains why when no bullet is a corollary or a text is too short', async () => {
      await open();
      const problem = () => document.querySelector('.split-problem') as HTMLElement;
      expect(problem().hidden).toBe(true);
      expect(approveButton().disabled).toBe(false);

      change(field(0, 'treat'), 'keep');
      change(field(2, 'treat'), 'keep');
      expect(approveButton().disabled).toBe(true);
      expect(problem().hidden).toBe(false);
      expect(problem().textContent).toBe('Choose at least one bullet to publish as a corollary.');

      change(field(0, 'treat'), 'corollary');
      change(field(0, 'text'), 'short');
      expect(problem().textContent).toBe('Bullet 1 must be between 10 and 1000 characters.');
      click(approveButton());
      await flush();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('lists every problem, not only the first', async () => {
      await open();
      const items = () => [...document.querySelectorAll('.split-problem li')].map((li) => li.textContent);
      change(field(0, 'text'), 'short');
      change(field(2, 'text'), 'too short');
      expect(items()).toEqual(['Bullet 1 must be between 10 and 1000 characters.', 'Bullet 3 must be between 10 and 1000 characters.']);
      expect(approveButton().disabled).toBe(true);
      change(field(0, 'text'), 'The engine restarts slowly behind a horn.');
      expect(items()).toEqual(['Bullet 3 must be between 10 and 1000 characters.']);
      change(field(2, 'text'), 'The green lasts just long enough to miss.');
      expect(items()).toEqual([]);
      expect((document.querySelector('.split-problem') as HTMLElement).hidden).toBe(true);
    });

    it('enforces the maximum of five corollaries', async () => {
      const items = Array.from({ length: 7 }, (_, i) => ({ title: `Corollary ${i + 1}`, text: `Corollary text number ${i + 1}`, labeled: true }));
      await open({ corollary_candidates: { parent_text: PARENT, items } });

      expect(rowsOf().length).toBe(7);
      const treats = () => [0, 1, 2, 3, 4, 5, 6].map((i) => field(i, 'treat').value);
      expect(treats()).toEqual(['corollary', 'corollary', 'corollary', 'corollary', 'corollary', 'keep', 'keep']);
      expect(approveButton().textContent).toBe('Approve and publish 6 laws');
      expect([...field(5, 'treat').options].map((o) => o.disabled)).toEqual([true, false]);
      expect([...field(0, 'treat').options].map((o) => o.disabled)).toEqual([false, false]);
      expect((button('+ Add a corollary by hand') as HTMLButtonElement).disabled).toBe(true);

      change(field(4, 'treat'), 'keep');
      expect([...field(5, 'treat').options].map((o) => o.disabled)).toEqual([false, false]);
      expect((button('+ Add a corollary by hand') as HTMLButtonElement).disabled).toBe(false);
    });

    it('adds a corollary by hand, focuses it, and can remove it again', async () => {
      await open();
      click(button('+ Add a corollary by hand'));
      expect(rowsOf().length).toBe(4);
      expect(field(3, 'treat').value).toBe('corollary');
      expect(document.activeElement).toBe(field(3, 'title'));
      expect(approveButton().textContent).toBe('Approve and publish 4 laws');
      expect(approveButton().disabled).toBe(true);
      expect(document.querySelector('.split-problem')?.textContent).toBe('Bullet 4 must be between 10 and 1000 characters.');

      change(field(3, 'text'), 'A hand written corollary of the law.');
      expect(approveButton().disabled).toBe(false);
      expect(rowsOf()[0].querySelector('.split-remove')).toBeNull();

      click(rowsOf()[3].querySelector('.split-remove'));
      expect(rowsOf().length).toBe(3);
      expect(approveButton().textContent).toBe('Approve and publish 3 laws');
      expect(document.activeElement).toBe(button('+ Add a corollary by hand'));
    });

    it('relabels the remaining rows after one is removed', async () => {
      await open();
      click(button('+ Add a corollary by hand'));
      click(button('+ Add a corollary by hand'));
      change(field(3, 'text'), 'First hand written corollary here.');
      change(field(4, 'text'), 'Second hand written corollary here.');
      click(rowsOf()[3].querySelector('.split-remove'));
      expect(rowsOf().map((r) => r.querySelector('legend')?.textContent)).toEqual(['Bullet 1', 'Bullet 2', 'Bullet 3', 'Bullet 4']);
      expect(field(3, 'text').value).toBe('Second hand written corollary here.');
    });

    it('reloads the list on a conflict and says to apply the review again', async () => {
      await open();
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'This law changed since you loaded it.' }, 409));
      fetchMock.mockResolvedValueOnce(jsonResponse(listReply([splittable({ updated_at: 'v2' })], { categories: cats })));
      click(approveButton());
      await flush();

      expect($('message').textContent).toBe('Law #7 changed since you loaded it. The list was reloaded; apply your edit again.');
      expect(document.querySelector('.split-review')).toBeNull();
      expect(document.querySelector('.split-banner')?.hasAttribute('hidden')).toBe(false);
    });

    it('re-enables Cancel and Approve and keeps the review usable when a conflict reload fails', async () => {
      await open();
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'This law changed since you loaded it.' }, 409));
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'x' }, 500));
      click(approveButton());
      await flush();
      expect($('message').textContent).toContain('changed since you loaded it');
      expect([...document.querySelectorAll('.split-actions button')].every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
      click(button('Cancel'));
      expect(document.querySelector('.split-review')).toBeNull();
    });

    it('disables both buttons while the split is in flight and sends one request', async () => {
      await open();
      let finish!: (value: unknown) => void;
      fetchMock.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
      click(approveButton());
      await flush();
      expect([...document.querySelectorAll('.split-actions button')].every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
      click(approveButton());
      await flush();
      expect(fetchMock).toHaveBeenCalledTimes(2);

      fetchMock.mockResolvedValueOnce(jsonResponse(listReply([])));
      finish(reply());
      await flush();
      expect($('message').textContent).toContain('was split into 3 laws');
    });

    it('puts the card back as it was when the list cannot refresh after a saved split', async () => {
      await open();
      fetchMock.mockResolvedValueOnce(reply());
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'x' }, 500));
      click(approveButton());
      await flush();
      expect(document.querySelector('.split-review')).toBeNull();
      expect(document.querySelector('.split-banner')?.hasAttribute('hidden')).toBe(false);
      expect(action('Approve')?.closest('.actions')?.hasAttribute('hidden')).toBe(false);
    });

    it('counts the laws the server created, not the rows on screen', async () => {
      await open();
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: splittable({ status: 'published' }), corollaries: [{ id: 11 }, { id: 12 }, { id: 13 }], thank_you: null }));
      fetchMock.mockResolvedValueOnce(jsonResponse(listReply([])));
      click(approveButton());
      await flush();
      expect($('message').textContent).toBe('Law #7 was split into 4 laws.');
    });

    it('disables Approve when the parent text becomes too short and shows corollary text as text, never HTML', async () => {
      await open({ corollary_candidates: { parent_text: PARENT, items: [{ title: '<img src=x onerror=alert(1)>', text: '<b>bold</b> corollary text here', labeled: true }] } });
      expect(document.querySelector('.split-review img, .split-review b')).toBeNull();
      expect(field(0, 'title').value).toBe('<img src=x onerror=alert(1)>');
      change(document.getElementById('split-parent-7') as HTMLElement, 'short');
      expect(approveButton().disabled).toBe(true);
      expect(document.querySelector('.split-problem')?.getAttribute('aria-live')).toBe('polite');
    });

    it('keeps the card actions visible and working outside the review', async () => {
      await boot(jsonResponse(listReply([splittable()], { categories: cats })));
      await connect();
      expect(action('Approve')?.closest('.actions')?.hasAttribute('hidden')).toBe(false);
      expect(action('Reject')).not.toBeNull();
    });

    it('keeps the review open and re-enables the buttons when the server refuses the split', async () => {
      await open();
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Only a law in review can be split' }, 400));
      click(approveButton());
      await flush();
      expect($('message').textContent).toBe('Only a law in review can be split');
      expect($('message').classList.contains('is-error')).toBe(true);
      expect(document.querySelector('.split-review')).not.toBeNull();
      expect([...document.querySelectorAll('.split-actions button')].every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
    });

    it('disconnects when the token is rejected during the split', async () => {
      await open();
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401));
      click(approveButton());
      await flush();
      expect($('message').textContent).toContain('Token rejected');
      expect(document.querySelectorAll('.law').length).toBe(0);
    });

    it('treats an unreadable success reply as a failure to check', async () => {
      await open();
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
      click(approveButton());
      await flush();
      expect($('message').textContent).toContain('server reply could not be read');
      expect(document.querySelector('.split-review')).not.toBeNull();
    });

    it('removes the card when the law no longer exists', async () => {
      await open();
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Law not found' }, 404));
      click(approveButton());
      await flush();
      expect(document.querySelector('.law')).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not offer the split again once the list is reloaded without candidates', async () => {
      await boot(jsonResponse(listReply([splittable()], { categories: cats })));
      await connect();
      fetchMock.mockResolvedValueOnce(jsonResponse(listReply([splittable({ corollary_candidates: undefined })], { categories: cats })));
      click(button('In review'));
      await flush();
      expect(document.querySelector('.split-banner')).toBeNull();
    });
  });

  describe('approving a law that has corollaries', () => {
    it('reloads the list, because the corollaries changed status too', async () => {
      await boot(jsonResponse(listReply([law(), law({ id: 2, text: 'Second law of enough length' })])));
      await connect();
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: law({ status: 'published' }), cascaded: 2 }));
      fetchMock.mockResolvedValueOnce(jsonResponse(listReply([law({ id: 2, text: 'Second law of enough length' })], { counts: { in_review: 1, published: 7, rejected: 0 } })));
      click(action('Approve'));
      await flush();
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect($('message').textContent).toBe('Law #1 updated. 2 corollaries moved with it.');
      expect(button('Published (7)')).not.toBeNull();
    });

    it('shows why a corollary cannot be published before its law', async () => {
      await boot(jsonResponse(listReply([law()])));
      await connect();
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'This corollary cannot be published while its law (#9) is not. Approve the law instead.' }, 400));
      click(action('Approve'));
      await flush();
      expect($('message').textContent).toContain('Approve the law instead');
      expect([...document.querySelectorAll('.actions button')].every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
    });
  });

  describe('a submission: a law with the corollaries its submitter sent', () => {
    const child = (id: number, over: Record<string, unknown> = {}) => ({ id, title: `Name ${id}`, text: `Corollary text number ${id}`, status: 'in_review', updated_at: `c${id}`, ...over });
    const submission = (over: Record<string, unknown> = {}) => law({ id: 1, children: [child(11), child(12), child(13, { status: 'rejected' })], ...over });
    const input = (id: string) => document.getElementById(id) as HTMLInputElement & HTMLTextAreaElement;
    const type = (id: string, value: string) => {
      input(id).value = value;
      input(id).dispatchEvent(new Event('input', { bubbles: true }));
    };
    const requests = () => fetchMock.mock.calls.slice(1).map(([url, init]) => `${init?.method ?? 'GET'} ${url}${init?.body ? ` ${init.body}` : ''}`);
    const open = async (card = submission()) => {
      await boot(jsonResponse(listReply([card])));
      await connect();
    };

    it('shows one card with the corollaries nested as editable rows, a count pill and wording for all of them', async () => {
      await open();
      expect(document.querySelectorAll('.law').length).toBe(1);
      expect(document.querySelector('.pill-count')?.textContent).toBe('1 law + 2 corollaries');
      const section = document.querySelector('.children') as HTMLElement;
      expect(section.getAttribute('aria-labelledby')).toBe(section.querySelector('h3')?.id);
      expect(section.querySelector('h3')?.textContent).toBe('Corollaries submitted with this law');
      const rows = [...section.querySelectorAll('.child-row')];
      expect(rows.map((r) => r.querySelector('legend')?.textContent)).toEqual(['Corollary 1', 'Corollary 2', 'Corollary 3']);
      expect(input('child-11-title').value).toBe('Name 11');
      expect(input('child-11-text').value).toBe('Corollary text number 11');
      expect(document.querySelector('label[for="child-11-text"]')?.textContent).toBe('Text');
      expect(action('Approve all 3')).not.toBeNull();
      expect(action('Reject all')).not.toBeNull();
      expect(action('Approve')).toBeNull();
      expect(document.querySelector('.actions-note')?.textContent).toBe('Rejecting the law rejects its corollaries');
    });

    it('locks a rejected corollary, keeps it visible and gives it no Reject button', async () => {
      await open();
      const rejected = document.querySelectorAll('.child-row')[2] as HTMLElement;
      expect(rejected.classList.contains('is-rejected')).toBe(true);
      expect(rejected.querySelector('.pill-rejected')).not.toBeNull();
      expect(rejected.querySelector('button')).toBeNull();
      expect(input('child-13-text').disabled).toBe(true);
      expect(input('child-13-title').disabled).toBe(true);
      expect([...document.querySelectorAll('.child-row')[0].querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Reject this corollary']);
      expect(document.querySelector('.child-row button')?.getAttribute('aria-label')).toBe('Reject corollary 1');
    });

    it('uses the plain wording and no note for a law with no live corollary or none at all', async () => {
      await open(submission({ children: [child(11, { status: 'rejected' })] }));
      expect(action('Approve')).not.toBeNull();
      expect(action('Reject')).not.toBeNull();
      expect(document.querySelector('.pill-count')).toBeNull();
      expect(document.querySelector('.actions-note')).toBeNull();
    });

    it('shows no note on a published law with corollaries, which offers Move to review', async () => {
      await open(submission({ status: 'published' }));
      expect(action('Move to review')).not.toBeNull();
      expect(document.querySelector('.actions-note')).toBeNull();
      expect(document.querySelectorAll('.child-row').length).toBe(3);
    });

    it('approves all: saves the corollaries first with their own guards, then the law, then reloads', async () => {
      await open();
      type('child-12-text', ' The edited second corollary ');
      type('child-11-title', '');
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: child(11) }))
        .mockResolvedValueOnce(jsonResponse({ data: child(12) }))
        .mockResolvedValueOnce(jsonResponse({ data: submission({ status: 'published' }), cascaded: 2, thank_you: { status: 'queued' } }))
        .mockResolvedValueOnce(jsonResponse(listReply([], { total: 0, counts: { in_review: 0, published: 7, rejected: 1 } })));
      click(action('Approve all 3'));
      await flush();

      expect(requests()).toEqual([
        'POST /api/v1/admin/laws/11 {"title":null,"updated_at":"c11"}',
        'POST /api/v1/admin/laws/12 {"text":"The edited second corollary","updated_at":"c12"}',
        'POST /api/v1/admin/laws/1 {"status":"published","updated_at":"v1"}',
        expect.stringContaining('GET /api/v1/admin/laws?status=in_review'),
      ]);
      expect($('message').textContent).toBe('Law #1 updated. 2 corollaries moved with it. Thank-you email is being sent (delivery is not confirmed).');
      expect(button('Published (7)')).not.toBeNull();
    });

    it('approves all with no edits in one request, then reloads', async () => {
      await open();
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: submission({ status: 'published' }), cascaded: 1 }))
        .mockResolvedValueOnce(jsonResponse(listReply([])));
      click(action('Approve all 3'));
      await flush();
      expect(requests()).toEqual(['POST /api/v1/admin/laws/1 {"status":"published","updated_at":"v1"}', expect.stringContaining('GET ')]);
      expect($('message').textContent).toContain('1 corollary moved with it.');
    });

    it('reloads after a save of a law whose corollaries it shows, even when none moved', async () => {
      await open();
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: submission({ admin_notes: 'x' }) }))
        .mockResolvedValueOnce(jsonResponse(listReply([submission({ admin_notes: 'x' })])));
      type('notes-1', 'x');
      click(action('Save edits'));
      await flush();
      expect(requests()).toHaveLength(2);
      expect($('message').textContent).toBe('Law #1 updated.');
    });

    it('rejects all in one request, which rejects the corollaries on the server', async () => {
      await open();
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: submission({ status: 'rejected' }), cascaded: 2 }))
        .mockResolvedValueOnce(jsonResponse(listReply([])));
      click(action('Reject all'));
      await flush();
      expect(requests()[0]).toBe('POST /api/v1/admin/laws/1 {"status":"rejected","updated_at":"v1"}');
      expect($('message').textContent).toContain('2 corollaries moved with it.');
    });

    it('saves only corollary edits and reloads, without touching the law', async () => {
      await open();
      type('child-11-text', 'A corollary rewritten by the moderator');
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: child(11) }))
        .mockResolvedValueOnce(jsonResponse(listReply([submission()])));
      click(action('Save edits'));
      await flush();
      expect(requests()).toEqual([
        'POST /api/v1/admin/laws/11 {"text":"A corollary rewritten by the moderator","updated_at":"c11"}',
        expect.stringContaining('GET '),
      ]);
      expect($('message').textContent).toBe('Law #1 updated.');
    });

    it('says when a corollary-only save was kept but the list could not refresh', async () => {
      await open();
      type('child-11-text', 'A corollary rewritten by the moderator');
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: child(11) })).mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500));
      click(action('Save edits'));
      await flush();
      expect($('message').textContent).toBe('Law #1 was saved, but the list could not refresh. Click a tab to reload.');
    });

    it('reports no changes when nothing on the card differs', async () => {
      await open();
      click(action('Save edits'));
      await flush();
      expect($('message').textContent).toBe('Law #1 has no changes.');
      expect(requests()).toEqual([]);
    });

    it('stops before any request when a corollary field would be refused, naming the corollary', async () => {
      await open();
      type('child-12-text', 'short');
      click(action('Approve all 3'));
      await flush();
      expect($('message').textContent).toBe('Corollary 2 must be between 10 and 1000 characters.');
      expect($('message').classList.contains('is-error')).toBe(true);
      expect(requests()).toEqual([]);
    });

    it('stops at the first corollary the server refuses, never approves the law, and reloads with what was saved', async () => {
      await open();
      type('child-11-text', 'First edited corollary text');
      type('child-12-text', 'Second edited corollary text');
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: child(11) }))
        .mockResolvedValueOnce(jsonResponse({ error: 'Corollary text is not allowed' }, 400))
        .mockResolvedValueOnce(jsonResponse(listReply([submission()])));
      click(action('Approve all 3'));
      await flush();
      expect(requests().map((r) => r.split(' ').slice(0, 2).join(' '))).toEqual([
        'POST /api/v1/admin/laws/11',
        'POST /api/v1/admin/laws/12',
        'GET /api/v1/admin/laws?status=in_review&limit=25&offset=0',
      ]);
      expect($('message').textContent).toBe('Corollary #12 was not saved: Corollary text is not allowed Saved: #11. The list was reloaded; apply the remaining edits again.');
      expect($('message').classList.contains('is-error')).toBe(true);
    });

    it('shows a refused corollary as it is when nothing was saved before it, and keeps the typed edits', async () => {
      await open();
      type('child-11-text', 'First edited corollary text');
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Server problem' }, 500));
      click(action('Approve all 3'));
      await flush();
      expect($('message').textContent).toBe('Server problem');
      expect(requests()).toHaveLength(1);
      expect(input('child-11-text').value).toBe('First edited corollary text');
      expect([...document.querySelectorAll('.actions button')].every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
    });

    it('reloads when the law save fails after corollary edits were saved, so a retry does not conflict with them', async () => {
      await open();
      type('child-11-text', 'First edited corollary text');
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: child(11) }))
        .mockResolvedValueOnce(jsonResponse({ error: 'Something broke' }, 500))
        .mockResolvedValueOnce(jsonResponse(listReply([submission()])));
      click(action('Approve all 3'));
      await flush();
      expect(requests()).toHaveLength(3);
      expect($('message').textContent).toBe('The law was not saved: Something broke Corollaries saved: #11. The list was reloaded; apply the law edits again.');
    });

    it('leaves the reload failure message alone when the list cannot be reloaded after a partial save', async () => {
      await open();
      type('child-11-text', 'First edited corollary text');
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: child(11) }))
        .mockResolvedValueOnce(jsonResponse({ error: 'Something broke' }, 500))
        .mockResolvedValueOnce(jsonResponse({ error: 'x' }, 429));
      click(action('Approve all 3'));
      await flush();
      expect($('message').textContent).toBe('Too many requests. Wait a minute and retry.');
    });

    it('lets a conflict on the law itself take the usual path after corollary edits were saved', async () => {
      await open();
      type('child-11-text', 'First edited corollary text');
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: child(11) }))
        .mockResolvedValueOnce(jsonResponse({ error: 'This law changed since you loaded it. Reload the list and try again.' }, 409))
        .mockResolvedValueOnce(jsonResponse(listReply([submission()])));
      click(action('Approve all 3'));
      await flush();
      expect($('message').textContent).toContain('Law #1 changed since you loaded it');
    });

    it('checks the law text before saving any corollary, so a predictable refusal never leaves a half save', async () => {
      await open();
      type('child-11-text', 'First edited corollary text');
      type('text-1', 'short');
      click(action('Approve all 3'));
      await flush();
      expect($('message').textContent).toBe('The law text must be between 10 and 1000 characters.');
      expect(requests()).toEqual([]);
    });

    it('rejects all without checking or saving corollary fields that are about to be rejected', async () => {
      await open();
      type('child-11-text', 'short');
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: submission({ status: 'rejected' }), cascaded: 2 }))
        .mockResolvedValueOnce(jsonResponse(listReply([])));
      click(action('Reject all'));
      await flush();
      expect(requests()).toHaveLength(2);
      expect(requests()[0]).toBe('POST /api/v1/admin/laws/1 {"status":"rejected","updated_at":"v1"}');
    });

    it.each([
      [409, 'Corollary changed'],
      [404, 'Law not found'],
    ])('reloads when a corollary save answers %s', async (code, error) => {
      await open();
      type('child-11-text', 'First edited corollary text');
      fetchMock.mockResolvedValueOnce(jsonResponse({ error }, code)).mockResolvedValueOnce(jsonResponse(listReply([submission()])));
      click(action('Approve all 3'));
      await flush();
      expect($('message').textContent).toBe('Corollary #11 changed since you loaded it. The list was reloaded; apply your edit again.');
      expect(requests()).toHaveLength(2);
    });

    it('keeps the server message when the list also cannot be reloaded after a stale corollary', async () => {
      await open();
      type('child-11-text', 'First edited corollary text');
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Gone' }, 409)).mockResolvedValueOnce(jsonResponse({ error: 'x' }, 429));
      click(action('Approve all 3'));
      await flush();
      expect($('message').textContent).toBe('Too many requests. Wait a minute and retry.');
    });

    it('rejects one corollary on its own, then reloads', async () => {
      await open();
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: child(12, { status: 'rejected' }) }))
        .mockResolvedValueOnce(jsonResponse(listReply([submission({ children: [child(11), child(12, { status: 'rejected' }), child(13, { status: 'rejected' })] })])));
      click(document.querySelectorAll('.child-row')[1].querySelector('button'));
      await flush();

      expect(requests()[0]).toBe('POST /api/v1/admin/laws/12 {"status":"rejected","updated_at":"c12"}');
      expect($('message').textContent).toBe('Corollary #12 was rejected.');
      expect(action('Approve all 2')).not.toBeNull();
      expect(document.querySelectorAll('.child-row.is-rejected').length).toBe(2);
    });

    it('refuses to reject a corollary while a field on the card has an unsaved edit, so the reload cannot lose it', async () => {
      await open();
      type('child-12-text', 'An edit that has not been saved');
      click(document.querySelector('.child-row button'));
      await flush();
      expect($('message').textContent).toBe('Law #1: save or undo your edits before rejecting a corollary.');
      expect(requests()).toEqual([]);
      expect(input('child-12-text').value).toBe('An edit that has not been saved');

      type('child-12-text', 'Corollary text number 12');
      type('notes-1', 'a note');
      click(document.querySelector('.child-row button'));
      await flush();
      expect(requests()).toEqual([]);
    });

    it('re-enables the card and shows why when a single reject fails, and recovers from a stale corollary', async () => {
      await open();
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Server problem' }, 500));
      click(document.querySelector('.child-row button'));
      await flush();
      expect($('message').textContent).toBe('Server problem');
      expect([...document.querySelectorAll('.law button')].every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);

      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'stale' }, 409)).mockResolvedValueOnce(jsonResponse(listReply([submission()])));
      click(document.querySelector('.child-row button'));
      await flush();
      expect($('message').textContent).toContain('Corollary #11 changed since you loaded it');
    });

    it('says the reject was saved when the list cannot refresh afterwards', async () => {
      await open();
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: child(11, { status: 'rejected' }) })).mockResolvedValueOnce(jsonResponse({ error: 'x' }, 500));
      click(document.querySelector('.child-row button'));
      await flush();
      expect($('message').textContent).toBe('Corollary #11 was rejected, but the list could not refresh. Click a tab to reload.');
      expect([...document.querySelectorAll('.law button')].every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
    });

    it('renders corollary text as text, never as HTML', async () => {
      await open(submission({ children: [child(11, { title: '<b>t</b>', text: '<img src=x onerror="window.pwned=1"> corollary' })] }));
      expect(document.querySelector('.child-row img')).toBeNull();
      expect(input('child-11-text').value).toContain('<img src=x');
    });

    it('treats a card without a children list as an ordinary law', async () => {
      await open(law());
      expect(document.querySelector('.children')).toBeNull();
      expect(action('Approve')).not.toBeNull();
    });
  });
});
