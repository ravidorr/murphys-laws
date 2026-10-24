// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageHtml = readFileSync(resolve(__dirname, '../src/admin-ui/index.html'), 'utf8');
const body = pageHtml.slice(pageHtml.indexOf('<body>') + 6, pageHtml.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/, '');

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
const flush = () => new Promise((r) => setTimeout(r, 0));
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
    await boot(Promise.reject(new TypeError('Failed to fetch')));
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

  it('keeps editing state in other cards and re-enables buttons when a save fails', async () => {
    await boot(jsonResponse(listReply([law(), law({ id: 2, text: 'Second law of enough length' })])));
    await connect();
    const notes = document.getElementById('notes-1') as HTMLInputElement;
    notes.value = 'looks fine';
    const second = document.getElementById('text-2') as HTMLTextAreaElement;
    second.value = 'unsaved edit in another card';

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'This law changed since you loaded it.' }, 409));
    click(document.querySelector('.law .actions button:last-child'));
    await flush();

    expect($('message').textContent).toContain('changed since you loaded it');
    expect([...document.querySelectorAll('.law:first-child button')].every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
    expect((document.getElementById('text-2') as HTMLTextAreaElement).value).toBe('unsaved edit in another card');
  });

  it('shows a distinct message for a law that no longer exists', async () => {
    await boot(jsonResponse(listReply([law()])));
    await connect();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Law not found' }, 404));
    click(button('Approve'));
    await flush();
    expect($('message').textContent).toBe('Law not found');
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

  it('steps back a page when a save empties the last page', async () => {
    const page2 = law({ id: 30, text: 'Only law on the second page' });
    await boot(jsonResponse(listReply(Array.from({ length: 25 }, (_, i) => law({ id: i + 100, text: `Law number ${i} long enough` })), { total: 26 })));
    await connect();
    fetchMock.mockResolvedValueOnce(jsonResponse(listReply([page2], { total: 26 })));
    click($('next'));
    await flush();
    expect(fetchMock.mock.calls[1][0]).toContain('offset=25');

    fetchMock.mockResolvedValueOnce(jsonResponse({ data: law({ id: 30, status: 'published' }) }));
    fetchMock.mockResolvedValueOnce(jsonResponse(listReply(Array.from({ length: 25 }, (_, i) => law({ id: i + 100 })), { total: 25 })));
    click(button('Approve'));
    await flush();
    await flush();
    expect(fetchMock.mock.calls[3][0]).toContain('offset=0');
    expect(document.querySelectorAll('.law').length).toBe(25);
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
