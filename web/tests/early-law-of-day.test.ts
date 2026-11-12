import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LawOfTheDay } from '../src/components/law-of-day.ts';
import { API_BASE_PLACEHOLDER, injectEarlyApiBase } from '../scripts/early-api-base.ts';
import { LAST_VOTE_AT_KEY } from '../src/utils/recent-vote.ts';
import type { Law } from '../src/types/app.d.ts';

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function readEarlySnippet(): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const snippet = [...parsed.querySelectorAll('script')]
    .map((script) => script.textContent ?? '')
    .find((script) => script.includes('__earlyLawOfDay'));
  if (!snippet) throw new Error('Early Law of the Day snippet not found in index.html');
  return snippet;
}

/** Runs the script as the build leaves it: with the API base the app is built for put in */
function runSnippet(apiBase = ''): void {
  new Function(injectEarlyApiBase(readEarlySnippet(), apiBase))();
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 503, json: async () => body };
}

/** The prerendered zone the SSG writes into dist/index.html, with the fallback card the early paint replaces */
function mountPrerenderedZone(prerendered = true): HTMLElement {
  const zone = document.createElement('div');
  zone.setAttribute('data-home-zone', 'law-of-day');
  if (prerendered) zone.setAttribute('data-prerendered', '');
  zone.innerHTML = '<section><div class="section-body"><article class="law-card-mini">Fallback</article></div></section>';
  document.body.appendChild(zone);
  return zone;
}

function setReadyState(state: DocumentReadyState): void {
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => state });
}

const LAW: Law = { id: 7, text: 'Everything takes longer.', upvotes: 1, downvotes: 0 };

describe('early Law of the Day script in index.html', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    history.replaceState(null, '', '/');
    delete window.__earlyLawOfDay;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete (document as { readyState?: unknown }).readyState;
    delete window.__earlyLawOfDay;
    document.body.innerHTML = '';
  });

  it('is plain ES5, because a browser that cannot parse it silently skips the whole script', () => {
    const snippet = readEarlySnippet();

    expect(snippet).not.toMatch(/\b(?:const|let|class|async|await|import|export)\b|=>|`|\.\.\.|\?\.|\?\?/);
  });

  it('carries the API base placeholder the build replaces, and has no placeholder left once built', () => {
    const snippet = readEarlySnippet();

    expect(snippet).toContain(`'${API_BASE_PLACEHOLDER}/api/v1/law-of-day'`);
    expect(injectEarlyApiBase(snippet, '')).not.toContain(API_BASE_PLACEHOLDER);
  });

  it('requests the same URL the app does when the app is built for another API, and says so', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ law: LAW }));
    vi.stubGlobal('fetch', fetchMock);

    runSnippet('https://api.example.com');

    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.example.com/api/v1/law-of-day');
    expect(window.__earlyLawOfDay!.url).toBe('https://api.example.com/api/v1/law-of-day');
    await window.__earlyLawOfDay!.promise;
  });

  it('starts before the stylesheet so the request is not held back by it', () => {
    expect(html.indexOf('__earlyLawOfDay')).toBeGreaterThan(-1);
    expect(html.indexOf('__earlyLawOfDay')).toBeLessThan(html.indexOf('href="/styles/site.css"'));
  });

  it.each(['/', '/index.html'])('requests the daily law on %s and exposes the result', async (pathname) => {
    history.replaceState(null, '', pathname);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ law: LAW, featured_date: '2026-11-12' }));
    vi.stubGlobal('fetch', fetchMock);

    runSnippet();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/law-of-day');
    expect(window.__earlyLawOfDay!.url).toBe('/api/v1/law-of-day');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ headers: { Accept: 'application/json' } });
    const early = window.__earlyLawOfDay!;
    expect(early.law).toBeNull();
    await expect(early.promise).resolves.toEqual(LAW);
    expect(early.law).toEqual(LAW);
    expect(early.startedAt).toBeLessThanOrEqual(Date.now());
  });

  describe('right after a vote', () => {
    function requestInit(): RequestInit {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ law: LAW }));
      vi.stubGlobal('fetch', fetchMock);
      runSnippet();
      return fetchMock.mock.calls[0]![1] as RequestInit;
    }

    beforeEach(() => localStorage.clear());
    afterEach(() => localStorage.clear());

    it('uses the HTTP cache when this browser has not voted', () => {
      expect(requestInit().cache).toBeUndefined();
    });

    it('asks the network when the last vote was less than a minute ago, so a reload does not show a pre-vote count', () => {
      localStorage.setItem(LAST_VOTE_AT_KEY, String(Date.now() - 59_000));

      expect(requestInit().cache).toBe('no-cache');
    });

    it('uses the HTTP cache again once a minute has passed since the vote', () => {
      localStorage.setItem(LAST_VOTE_AT_KEY, String(Date.now() - 60_000));

      expect(requestInit().cache).toBeUndefined();
    });

    it.each(['', 'soon', '0', '-5'])('ignores an unusable stored time (%j)', (value) => {
      localStorage.setItem(LAST_VOTE_AT_KEY, value);

      expect(requestInit().cache).toBeUndefined();
    });

    it('does not bypass the cache for good because of a time far ahead of the clock', () => {
      localStorage.setItem(LAST_VOTE_AT_KEY, String(Date.now() + 86_400_000));

      expect(requestInit().cache).toBeUndefined();
    });

    it('still requests the law when localStorage throws', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });

      const init = requestInit();

      expect(init.cache).toBeUndefined();
      await expect(window.__earlyLawOfDay!.promise).resolves.toEqual(LAW);
      vi.restoreAllMocks();
    });
  });

  it.each(['/browse', '/law/7', '/calculator/sods-law'])('does nothing on %s', (pathname) => {
    history.replaceState(null, '', pathname);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    runSnippet();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.__earlyLawOfDay).toBeUndefined();
  });

  it('does nothing in a browser without fetch', () => {
    vi.stubGlobal('fetch', undefined);

    runSnippet();

    expect(window.__earlyLawOfDay).toBeUndefined();
  });

  it('paints the law into the prerendered zone and keeps the page structure', async () => {
    const zone = mountPrerenderedZone();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ law: LAW })));

    runSnippet();
    await window.__earlyLawOfDay!.promise;

    const link = zone.querySelector<HTMLAnchorElement>('a.lod-link')!;
    expect(link.getAttribute('href')).toBe('/law/7');
    expect(link.getAttribute('data-law-id')).toBe('7');
    expect(link.getAttribute('aria-label')).toBe('Read full law details');
    expect(link.querySelector('blockquote.lod-quote-large')?.textContent).toBe('Everything takes longer.');
    expect(zone.querySelector('.law-card-mini')).toBeNull();
    expect(zone.querySelector('section')).toBeTruthy();
  });

  it('paints text as text, never as markup', async () => {
    const zone = mountPrerenderedZone();
    const hostile = { ...LAW, title: '<img src=x onerror=alert(1)>', text: '<script>alert(2)</script> & "quotes"' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ law: hostile })));

    runSnippet();
    await window.__earlyLawOfDay!.promise;

    expect(zone.querySelector('img, script')).toBeNull();
    expect(zone.querySelector('.lod-quote-large')?.textContent)
      .toBe('<img src=x onerror=alert(1)>: <script>alert(2)</script> & "quotes"');
  });

  const parityLaws: Array<[string, Law]> = [
    ['plain law', LAW],
    ['title', { ...LAW, id: 8, title: 'Sod & "Murphy"' }],
    ['submitter with note', { ...LAW, id: 9, attributions: [{ name: '  Ed <Murphy>  ', note: ' 1949 ' }] }],
    ['submitter without note', { ...LAW, id: 10, attributions: [{ name: 'Ed' }] }],
    ['note only', { ...LAW, id: 11, attributions: [{ note: 'Folklore' }] }],
    ['author only', { ...LAW, id: 12, author: "O'Toole" }],
    ['empty attribution list', { ...LAW, id: 13, attributions: [] }],
    ['empty attribution list with author', { ...LAW, id: 14, attributions: [], author: 'Anon' }],
  ];

  it.each(parityLaws)('paints the same markup as the app component for a %s', async (_name, law) => {
    const zone = mountPrerenderedZone();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ law })));
    runSnippet();
    await window.__earlyLawOfDay!.promise;

    const component = LawOfTheDay({ law, onNavigate: () => {} });
    const early = zone.querySelector('.section-body')!;
    const expected = component.querySelector('#lod-body')!;

    // The component indents its template; whitespace between the tags does not change the rendered page
    const compact = (markup: string) => markup.replace(/>\s+</g, '><').trim();
    expect(compact(early.innerHTML)).toBe(compact(expected.innerHTML));
  });

  it('leaves the app-rendered zone alone when the response arrives after the bundle replaced the page', async () => {
    const appZone = mountPrerenderedZone(false);
    appZone.innerHTML = '<section><div class="section-body" id="lod-body">App content</div></section>';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ law: LAW })));

    runSnippet();
    await window.__earlyLawOfDay!.promise;

    expect(appZone.textContent).toBe('App content');
    expect(window.__earlyLawOfDay!.law).toEqual(LAW);
  });

  it('still records the law when the page has no Law of the Day zone', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ law: LAW })));

    runSnippet();

    await expect(window.__earlyLawOfDay!.promise).resolves.toEqual(LAW);
  });

  it('waits for the page to be parsed before painting, and paints once', async () => {
    const zone = mountPrerenderedZone();
    setReadyState('loading');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ law: LAW })));

    runSnippet();
    await window.__earlyLawOfDay!.promise;
    expect(zone.querySelector('.lod-link')).toBeNull();

    document.dispatchEvent(new Event('readystatechange'));
    expect(zone.querySelector('.lod-link')).toBeNull();

    setReadyState('interactive');
    document.dispatchEvent(new Event('readystatechange'));
    const link = zone.querySelector('.lod-link');
    expect(link).toBeTruthy();

    setReadyState('complete');
    document.dispatchEvent(new Event('readystatechange'));
    expect(zone.querySelector('.lod-link')).toBe(link);
  });

  it.each([
    ['a failed response', () => Promise.resolve(jsonResponse({ error: 'down' }, false))],
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['invalid JSON', () => Promise.resolve({ ok: true, json: async () => { throw new SyntaxError('bad json'); } })],
    ['an empty payload', () => Promise.resolve(jsonResponse(null))],
    ['a payload without a law', () => Promise.resolve(jsonResponse({ law: null }))],
    ['a law without text', () => Promise.resolve(jsonResponse({ law: { id: 1 } }))],
    ['a law without an id', () => Promise.resolve(jsonResponse({ law: { text: 'No id' } }))],
  ])('resolves to null instead of rejecting on %s', async (_name, respond) => {
    const zone = mountPrerenderedZone();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(respond));

    runSnippet();

    await expect(window.__earlyLawOfDay!.promise).resolves.toBeNull();
    expect(window.__earlyLawOfDay!.law).toBeNull();
    expect(zone.querySelector('.law-card-mini')).toBeTruthy();
  });

  it('aborts a request that hangs for ten seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })
    ));

    runSnippet();
    const settled = vi.fn();
    void window.__earlyLawOfDay!.promise.then(settled);

    await vi.advanceTimersByTimeAsync(9_999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toHaveBeenCalledWith(null);
  });

  it('cancels the timeout once the response arrived', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ law: LAW })));

    runSnippet();
    await window.__earlyLawOfDay!.promise;

    expect(vi.getTimerCount()).toBe(0);
  });

  it('works without AbortController', async () => {
    vi.stubGlobal('AbortController', undefined);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ law: LAW }));
    vi.stubGlobal('fetch', fetchMock);

    runSnippet();

    await expect(window.__earlyLawOfDay!.promise).resolves.toEqual(LAW);
    expect(fetchMock.mock.calls[0]![1].signal).toBeUndefined();
  });
});
