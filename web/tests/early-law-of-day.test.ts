import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/browser', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import { FETCH_TIMEOUT_MS } from '../src/utils/constants.ts';
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

    // Only Date is frozen (the snippet needs no timers): the vote times below are offsets from Date.now(), and the
    // minute is an exclusive limit (`< 60000` in index.html), so 60 s ago must fall exactly on it
    beforeEach(() => {
      localStorage.clear();
      vi.useFakeTimers({ toFake: ['Date'] });
    });
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

  const abortError = () => new DOMException('Aborted', 'AbortError');

  it.each([
    ['a failed response', () => Promise.resolve(jsonResponse({ error: 'down' }, false)), '503'],
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch')), 'network'],
    ['a request that fetch aborts', () => Promise.reject(abortError()), 'abort'],
    ['a fetch that throws at once', () => { throw new TypeError('Invalid URL'); }, 'error'],
    ['invalid JSON', () => Promise.resolve({ ok: true, json: async () => { throw new SyntaxError('bad json'); } }), 'parse'],
    ['a connection lost while the body is read', () => Promise.resolve({ ok: true, json: async () => { throw new TypeError('network error'); } }), 'network'],
    ['an abort while the body is read', () => Promise.resolve({ ok: true, json: async () => { throw abortError(); } }), 'abort'],
    ['a response that cannot be read at all', () => Promise.resolve({ ok: true }), 'error'],
    ['an empty payload', () => Promise.resolve(jsonResponse(null)), 'shape'],
    ['a payload without a law', () => Promise.resolve(jsonResponse({ law: null })), 'shape'],
    ['a law without text', () => Promise.resolve(jsonResponse({ law: { id: 1 } })), 'shape'],
    ['a law without an id', () => Promise.resolve(jsonResponse({ law: { text: 'No id' } })), 'shape'],
    ['a law with an id that is a string', () => Promise.resolve(jsonResponse({ law: { id: '7', text: 'String id' } })), 'shape'],
    ['a law with an id that is not a whole number', () => Promise.resolve(jsonResponse({ law: { id: 1.5, text: 'Half' } })), 'shape'],
    ['a law with an id of 0', () => Promise.resolve(jsonResponse({ law: { id: 0, text: 'Zero' } })), 'shape'],
    ['a law with a blank text', () => Promise.resolve(jsonResponse({ law: { id: 1, text: '   ' } })), 'shape'],
  ])('resolves to null instead of rejecting on %s, and records why', async (_name, respond, reason) => {
    const zone = mountPrerenderedZone();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(respond));

    runSnippet();

    await expect(window.__earlyLawOfDay!.promise).resolves.toBeNull();
    expect(window.__earlyLawOfDay!.law).toBeNull();
    expect(window.__earlyLawOfDay!.error).toBe(reason);
    expect(zone.querySelector('.law-card-mini')).toBeTruthy();
  });

  it('uses the same timeout as the app', () => {
    const declared = /var TIMEOUT_MS = (\d+);/.exec(readEarlySnippet());

    expect(Number(declared?.[1])).toBe(FETCH_TIMEOUT_MS);
  });

  it('records no error for a good answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ law: LAW })));

    runSnippet();
    await window.__earlyLawOfDay!.promise;

    expect(window.__earlyLawOfDay!.error).toBeNull();
  });

  it('aborts a request that hangs for ten seconds, and records the timeout', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const requestSignal = init.signal!;
      signal = requestSignal;
      return new Promise((_resolve, reject) => {
        requestSignal.addEventListener('abort', () => reject(abortError()));
      });
    }));

    runSnippet();
    const settled = vi.fn();
    void window.__earlyLawOfDay!.promise.then(settled);

    await vi.advanceTimersByTimeAsync(9_999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toHaveBeenCalledWith(null);
    expect(signal!.aborted).toBe(true);
    // The abort that follows the timeout does not overwrite why it ended
    expect(window.__earlyLawOfDay!.error).toBe('timeout');
  });

  it('times out a body that hangs after the headers arrived', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) =>
      Promise.resolve({
        ok: true,
        json: () => new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(abortError()));
        })
      })
    ));

    runSnippet();
    const settled = vi.fn();
    void window.__earlyLawOfDay!.promise.then(settled);

    await vi.advanceTimersByTimeAsync(10_000);

    expect(settled).toHaveBeenCalledWith(null);
    expect(window.__earlyLawOfDay!.error).toBe('timeout');
  });

  it('times out a hung request even where fetch cannot be aborted, and ignores its late answer', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('AbortController', undefined);
    const zone = mountPrerenderedZone();
    let answer!: (response: unknown) => void;
    const fetchMock = vi.fn().mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    vi.stubGlobal('fetch', fetchMock);

    runSnippet();
    const settled = vi.fn();
    void window.__earlyLawOfDay!.promise.then(settled);

    expect(fetchMock.mock.calls[0]![1].signal).toBeUndefined();
    await vi.advanceTimersByTimeAsync(9_999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toHaveBeenCalledWith(null);
    expect(window.__earlyLawOfDay!.error).toBe('timeout');

    // The request answers after the app gave up on it: the state and the page stay as they were
    answer(jsonResponse({ law: LAW }));
    await vi.advanceTimersByTimeAsync(0);
    expect(window.__earlyLawOfDay!.law).toBeNull();
    expect(window.__earlyLawOfDay!.error).toBe('timeout');
    expect(zone.querySelector('.lod-link')).toBeNull();
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

  it('does nothing in a browser without Promise', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // Parsing the page needs Promise (jsdom), so the script is read first and only its run happens without it
    const script = injectEarlyApiBase(readEarlySnippet(), '');
    vi.stubGlobal('Promise', undefined);
    try {
      new Function(script)();
    } finally {
      vi.unstubAllGlobals();
    }

    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.__earlyLawOfDay).toBeUndefined();
  });

  it.each(['#/law/7', '#/calculators/sods-law'])('does nothing on the legacy hash route %s, which the router rewrites', (hash) => {
    history.replaceState(null, '', `/${hash}`);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    runSnippet();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.__earlyLawOfDay).toBeUndefined();
  });

  it.each(['/?utm_source=x#top', '/#/'])('still runs on the home page at %s', (location) => {
    history.replaceState(null, '', location);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ law: LAW }));
    vi.stubGlobal('fetch', fetchMock);

    runSnippet();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  describe('when painting fails', () => {
    function failQuerySelector() {
      const original = document.querySelector.bind(document);
      return vi.spyOn(document, 'querySelector').mockImplementation((selector: string) => {
        if (selector.includes('data-prerendered')) throw new Error('paint exploded');
        return original(selector);
      });
    }

    it('keeps the law, records the failure and lets nothing escape when the page is already parsed', async () => {
      const onError = vi.fn();
      window.addEventListener('error', onError);
      failQuerySelector();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ law: LAW })));

      try {
        runSnippet();
        // The promise and the state agree: both hold the law, and the paint failure is the only error
        await expect(window.__earlyLawOfDay!.promise).resolves.toEqual(LAW);
        expect(window.__earlyLawOfDay!.law).toEqual(LAW);
        expect(window.__earlyLawOfDay!.error).toBe('paint');
        expect(onError).not.toHaveBeenCalled();
      } finally {
        window.removeEventListener('error', onError);
      }
    });

    it('keeps the law and records the failure when the paint cannot even be scheduled', async () => {
      setReadyState('loading');
      const addListener = vi.spyOn(document, 'addEventListener').mockImplementation(() => { throw new Error('no listeners'); });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ law: LAW })));

      runSnippet();

      await expect(window.__earlyLawOfDay!.promise).resolves.toEqual(LAW);
      addListener.mockRestore();
      expect(window.__earlyLawOfDay!.law).toEqual(LAW);
      expect(window.__earlyLawOfDay!.error).toBe('paint');
    });

    it('does not let a throwing readystatechange listener reach the error banner', async () => {
      const onError = vi.fn();
      window.addEventListener('error', onError);
      setReadyState('loading');
      failQuerySelector();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ law: LAW })));

      try {
        runSnippet();
        await window.__earlyLawOfDay!.promise;
        expect(window.__earlyLawOfDay!.error).toBeNull();

        setReadyState('interactive');
        document.dispatchEvent(new Event('readystatechange'));

        expect(onError).not.toHaveBeenCalled();
        expect(window.__earlyLawOfDay!.law).toEqual(LAW);
        expect(window.__earlyLawOfDay!.error).toBe('paint');
      } finally {
        window.removeEventListener('error', onError);
      }
    });
  });
});

describe('the app adopting what the early script fetched', () => {
  const OTHER_LAW: Law = { id: 99, text: 'Fetched by the app itself.', upvotes: 0, downvotes: 0 };

  beforeEach(() => {
    document.body.innerHTML = '';
    history.replaceState(null, '', '/');
    delete window.__earlyLawOfDay;
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    delete window.__earlyLawOfDay;
    document.body.innerHTML = '';
  });

  /** The app's api module, loaded after the environment was set, with the Sentry mock it reports to */
  async function loadApp() {
    const api = await import('../src/utils/api.ts');
    const Sentry = await import('@sentry/browser');
    return { api, Sentry };
  }

  const appResponse = () => ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ law: OTHER_LAW }),
  });

  it.each([
    ['the same origin', ''],
    ['a configured API', 'https://api.example.com'],
  ])('peeks, consumes and fetches the script\'s law for %s without a second request', async (_name, base) => {
    vi.stubEnv('VITE_API_URL', base);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ law: LAW }));
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await loadApp();

    runSnippet(base);
    await window.__earlyLawOfDay!.promise;

    expect(api.peekEarlyLawOfTheDay()).toEqual(LAW);
    // Peeking does not use it up
    expect(window.__earlyLawOfDay).toBeDefined();
    await expect(api.consumeEarlyLawOfTheDay()).resolves.toEqual(LAW);
    expect(window.__earlyLawOfDay).toBeUndefined();

    // Another page load: the same script result is adopted by fetchLawOfTheDay as well
    runSnippet(base);
    await expect(api.fetchLawOfTheDay()).resolves.toMatchObject({ data: [LAW] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([`${base}/api/v1/law-of-day`, `${base}/api/v1/law-of-day`]);
  });

  it('does not adopt a result the script fetched from another API than the app uses', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com');
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ law: LAW })).mockResolvedValue(appResponse());
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await loadApp();

    // A build made without VITE_API_URL: the script asked the page's own origin
    runSnippet('');
    await window.__earlyLawOfDay!.promise;

    expect(api.peekEarlyLawOfTheDay()).toBeNull();
    await expect(api.fetchLawOfTheDay()).resolves.toMatchObject({ data: [OTHER_LAW] });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/v1/law-of-day', 'https://api.example.com/api/v1/law-of-day']);
  });

  it('falls back to its own request and reports why when the script\'s request failed', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ error: 'down' }, false)).mockResolvedValue(appResponse());
    vi.stubGlobal('fetch', fetchMock);
    const { api, Sentry } = await loadApp();

    runSnippet();
    await window.__earlyLawOfDay!.promise;

    expect(api.peekEarlyLawOfTheDay()).toBeNull();
    await expect(api.fetchLawOfTheDay()).resolves.toMatchObject({ data: [OTHER_LAW] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(Sentry.captureMessage).toHaveBeenCalledWith('Early Law of the Day failed: 503', expect.objectContaining({ level: 'warning' }));
  });

  it('shows the error state 10 s after the page started when the API hangs, with no second request', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn()
        .mockImplementationOnce((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }))
        .mockResolvedValue(appResponse());
      vi.stubGlobal('fetch', fetchMock);
      const { api, Sentry } = await loadApp();

      runSnippet();
      // The bundle runs 4 s after the page started and asks for the law
      await vi.advanceTimersByTimeAsync(4_000);
      const pending = api.fetchLawOfTheDay();
      const outcome = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
      await vi.advanceTimersByTimeAsync(5_999);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);

      // The early request used the whole window, so there is nothing left for a second one
      await outcome;
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({ message: 'Early Law of the Day failed: timeout' }));
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries a quickly failed script request with the rest of the 10 s, so a dead API also ends 10 s after the start', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(jsonResponse({ error: 'down' }, false))
        .mockReturnValue(new Promise(() => {}));
      vi.stubGlobal('fetch', fetchMock);
      const { api } = await loadApp();

      runSnippet();
      await vi.advanceTimersByTimeAsync(2_000);
      const pending = api.fetchLawOfTheDay();
      const outcome = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
      await vi.advanceTimersByTimeAsync(7_999);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);

      await outcome;
    } finally {
      vi.useRealTimers();
    }
  });
});
