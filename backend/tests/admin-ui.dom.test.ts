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

  const boot = async (...replies: unknown[]) => {
    for (const r of replies) fetchMock.mockResolvedValueOnce(r);
    await import('../src/admin-ui/admin.js');
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
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await boot();
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
});
