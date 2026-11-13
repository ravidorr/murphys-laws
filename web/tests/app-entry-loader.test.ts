import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { injectEarlyApiBase } from '../scripts/early-api-base.ts';

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ENTRY_URL = '/assets/index-AbCd1234.js';
const HOLD_MS = 1000;

function readScript(marker: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const snippet = [...parsed.querySelectorAll('script')]
    .map((script) => script.textContent ?? '')
    .find((script) => script.includes(marker));
  if (!snippet) throw new Error(`Script with ${marker} not found in index.html`);
  return snippet;
}

const loaderSource = readScript("getElementById('app-entry')");

function runLoader(): void {
  new Function(loaderSource)();
}

function setEarlyRequest(promise: Promise<unknown> | undefined): void {
  window.__earlyLawOfDay = { law: null, url: '/api/v1/law-of-day', startedAt: Date.now(), promise } as unknown as EarlyLawOfDay;
}

/** The inert placeholder the SSG leaves in the head of dist/index.html */
function addPlaceholder(): void {
  const placeholder = document.createElement('script');
  placeholder.type = 'text/plain';
  placeholder.id = 'app-entry';
  placeholder.setAttribute('data-src', ENTRY_URL);
  document.head.appendChild(placeholder);
}

function moduleScripts(): HTMLScriptElement[] {
  return [...document.head.querySelectorAll<HTMLScriptElement>('script[type="module"]')];
}

function setReadyState(state: DocumentReadyState): void {
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => state });
}

/** A promise the test settles by hand, like the early request */
function deferred(): { promise: Promise<unknown>; resolve: (value: unknown) => void; reject: (reason: unknown) => void } {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('app bundle loader in index.html', () => {
  beforeEach(() => {
    document.head.querySelectorAll('script').forEach((script) => script.remove());
    history.replaceState(null, '', '/');
    delete window.__earlyLawOfDay;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete (document as { readyState?: unknown }).readyState;
    delete window.__earlyLawOfDay;
    document.head.querySelectorAll('script').forEach((script) => script.remove());
  });

  it('is plain ES5, because a browser that cannot parse it silently skips the whole script', () => {
    const code = loaderSource.replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\b(?:const|let|class|async|await|import|export)\b|=>|`|\.\.\.|\?\.|\?\?/);
  });

  it('runs after the early request is started and before the stylesheet, which would delay it', () => {
    expect(html.indexOf("getElementById('app-entry')")).toBeGreaterThan(html.indexOf('window.__earlyLawOfDay = state'));
    expect(html.indexOf("getElementById('app-entry')")).toBeLessThan(html.indexOf('href="/styles/site.css"'));
  });

  it('does not ship the placeholder itself: the SSG derives it from the built module script', () => {
    expect(html).not.toContain('id="app-entry"');
    expect(html).toContain('<script type="module" src="src/main.js"></script>');
  });

  it('holds the bundle while the early request is pending', async () => {
    const early = deferred();
    setEarlyRequest(early.promise);
    addPlaceholder();

    runLoader();
    await Promise.resolve();

    expect(moduleScripts()).toHaveLength(0);
  });

  it('starts the bundle as soon as the early request has the law', async () => {
    const early = deferred();
    setEarlyRequest(early.promise);
    addPlaceholder();
    runLoader();

    early.resolve({ id: 7 });
    await early.promise;

    const [script, ...rest] = moduleScripts();
    expect(rest).toHaveLength(0);
    expect(script!.getAttribute('src')).toBe(ENTRY_URL);
    expect(script!.crossOrigin).toBe('anonymous');
  });

  it('starts the bundle when the early request failed, which resolves to null', async () => {
    setEarlyRequest(Promise.resolve(null));
    addPlaceholder();

    runLoader();
    await Promise.resolve();

    expect(moduleScripts()).toHaveLength(1);
  });

  it('starts the bundle if the early request rejects, which it should never do', async () => {
    const early = deferred();
    setEarlyRequest(early.promise);
    addPlaceholder();
    runLoader();

    early.reject(new Error('unexpected'));
    await early.promise.catch(() => undefined);
    await Promise.resolve();

    expect(moduleScripts()).toHaveLength(1);
  });

  it('starts the bundle after the hold when the API never answers, and not before', () => {
    vi.useFakeTimers();
    setEarlyRequest(new Promise(() => undefined));
    addPlaceholder();
    runLoader();

    vi.advanceTimersByTime(HOLD_MS - 1);
    expect(moduleScripts()).toHaveLength(0);
    vi.advanceTimersByTime(1);

    expect(moduleScripts()).toHaveLength(1);
    expect(moduleScripts()[0]!.getAttribute('src')).toBe(ENTRY_URL);
  });

  it('adds the bundle once and leaves no timer behind when the answer wins', async () => {
    vi.useFakeTimers();
    setEarlyRequest(Promise.resolve({ id: 7 }));
    addPlaceholder();
    runLoader();

    await vi.advanceTimersByTimeAsync(0);
    expect(moduleScripts()).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(HOLD_MS * 2);

    expect(moduleScripts()).toHaveLength(1);
  });

  it('adds the bundle once when the hold expires first and the answer comes later', async () => {
    vi.useFakeTimers();
    const early = deferred();
    setEarlyRequest(early.promise);
    addPlaceholder();
    runLoader();

    await vi.advanceTimersByTimeAsync(HOLD_MS);
    early.resolve({ id: 7 });
    await vi.advanceTimersByTimeAsync(0);

    expect(moduleScripts()).toHaveLength(1);
  });

  it.each([
    ['no early request (another path, or a browser without fetch)', () => undefined],
    ['an early state without a promise', () => setEarlyRequest(undefined)],
    ['an early promise that is not a promise', () => setEarlyRequest({ then: 1 } as unknown as Promise<unknown>)],
  ])('starts the bundle at once with %s', (_name, arrange) => {
    arrange();
    addPlaceholder();

    runLoader();

    expect(moduleScripts()).toHaveLength(1);
    expect(moduleScripts()[0]!.getAttribute('src')).toBe(ENTRY_URL);
  });

  it('starts the bundle at once, once, when the early promise throws as soon as the loader uses it', () => {
    vi.useFakeTimers();
    setEarlyRequest({ then: () => { throw new Error('broken promise'); } } as unknown as Promise<unknown>);
    addPlaceholder();

    runLoader();
    vi.advanceTimersByTime(HOLD_MS * 2);

    expect(moduleScripts()).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('still starts the bundle on the later trigger when adding it fails once, because only a successful add counts as started', async () => {
    vi.useFakeTimers();
    const early = deferred();
    setEarlyRequest(early.promise);
    addPlaceholder();
    const append = vi.spyOn(document.head, 'appendChild').mockImplementationOnce(() => { throw new Error('blocked'); });
    runLoader();

    expect(() => vi.advanceTimersByTime(HOLD_MS)).toThrow('blocked');
    expect(moduleScripts()).toHaveLength(0);
    early.resolve({ id: 7 });
    await vi.advanceTimersByTimeAsync(0);
    append.mockRestore();

    expect(moduleScripts()).toHaveLength(1);
  });

  it('waits for the parser to finish before adding the module, because the app needs #app, and adds it once', () => {
    // As in the built page, the loader runs before the parser reaches the placeholder
    setReadyState('loading');
    runLoader();
    expect(moduleScripts()).toHaveLength(0);

    document.dispatchEvent(new Event('readystatechange'));
    expect(moduleScripts()).toHaveLength(0);

    addPlaceholder();
    setReadyState('interactive');
    document.dispatchEvent(new Event('readystatechange'));
    expect(moduleScripts()).toHaveLength(1);

    setReadyState('complete');
    document.dispatchEvent(new Event('readystatechange'));
    expect(moduleScripts()).toHaveLength(1);
  });

  it('waits for the parser even when the answer and the hold both come first', async () => {
    vi.useFakeTimers();
    setReadyState('loading');
    setEarlyRequest(Promise.resolve({ id: 7 }));
    runLoader();

    await vi.advanceTimersByTimeAsync(HOLD_MS);
    expect(moduleScripts()).toHaveLength(0);

    addPlaceholder();
    setReadyState('interactive');
    document.dispatchEvent(new Event('readystatechange'));
    expect(moduleScripts()).toHaveLength(1);
  });

  it('does nothing on a page that keeps its ordinary module script, which has no placeholder', async () => {
    vi.useFakeTimers();
    setEarlyRequest(new Promise(() => undefined));

    runLoader();
    await vi.advanceTimersByTimeAsync(HOLD_MS * 2);

    expect(moduleScripts()).toHaveLength(0);
  });

  describe('with the early request script', () => {
    const earlySource = injectEarlyApiBase(readScript('__earlyLawOfDay = state'), '');

    function runBoth(): void {
      new Function(earlySource)();
      runLoader();
    }

    it('starts the app after the daily law arrived', async () => {
      const response = deferred();
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(response.promise));
      addPlaceholder();

      runBoth();
      expect(moduleScripts()).toHaveLength(0);

      response.resolve({ ok: true, status: 200, json: async () => ({ law: { id: 7, text: 'Everything takes longer.' } }) });
      await window.__earlyLawOfDay!.promise;

      expect(moduleScripts()).toHaveLength(1);
    });

    it('starts the app after a failed request', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      addPlaceholder();

      runBoth();
      await window.__earlyLawOfDay!.promise;

      expect(moduleScripts()).toHaveLength(1);
    });

    it('starts the app after the hold when the request hangs', async () => {
      vi.useFakeTimers();
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)));
      addPlaceholder();

      runBoth();
      await vi.advanceTimersByTimeAsync(HOLD_MS - 1);
      expect(moduleScripts()).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);

      expect(moduleScripts()).toHaveLength(1);
    });

    it('keeps the vote cache bypass of the early request, sends it once and holds the bundle until it settles', async () => {
      const response = deferred();
      const fetchMock = vi.fn().mockReturnValue(response.promise);
      vi.stubGlobal('fetch', fetchMock);
      localStorage.setItem('murphy_last_vote_at', String(Date.now()));
      addPlaceholder();

      try {
        runBoth();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect((fetchMock.mock.calls[0]![1] as RequestInit).cache).toBe('no-cache');
        expect(moduleScripts()).toHaveLength(0);

        response.resolve({ ok: true, status: 200, json: async () => ({ law: { id: 7, text: 'Everything takes longer.' } }) });
        await window.__earlyLawOfDay!.promise;

        expect(moduleScripts()).toHaveLength(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
      } finally {
        localStorage.removeItem('murphy_last_vote_at');
      }
    });

    it('starts the app at once on a legacy hash route, where the early request is not made', () => {
      history.replaceState(null, '', '/#/law/7');
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      addPlaceholder();

      runBoth();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(moduleScripts()).toHaveLength(1);
    });

    it.each(['/browse', '/law/7', '/favorites'])('starts the app at once on %s, where the early request is not made', (pathname) => {
      history.replaceState(null, '', pathname);
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      addPlaceholder();

      runBoth();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(moduleScripts()).toHaveLength(1);
    });

    it('starts the app at once in a browser without fetch', () => {
      vi.stubGlobal('fetch', undefined);
      addPlaceholder();

      runBoth();

      expect(moduleScripts()).toHaveLength(1);
    });
  });
});
