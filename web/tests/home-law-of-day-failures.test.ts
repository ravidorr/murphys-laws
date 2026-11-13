import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/browser', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import { API_BASE_URL } from '../src/utils/constants.ts';

const GOOD_LAW = { id: 42, text: 'The daily failure arrives on schedule.', upvotes: 3, downvotes: 0 };

type LawOfTheDayAnswer = () => Promise<unknown>;

function jsonAnswer(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return Promise.resolve({ ok: init.ok ?? true, status: init.status ?? 200, json: async () => body });
}

/** Answers the law-of-day request with `answer`, and every other request the home page makes with an empty list */
function stubApi(answer: LawOfTheDayAnswer) {
  const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) =>
    String(input).includes('/law-of-day') ? answer() : jsonAnswer({ data: [] })
  );
  globalThis.fetch = fetchMock;
  return fetchMock;
}

function dailyLawRequests(fetchMock: ReturnType<typeof vi.fn>): number {
  return fetchMock.mock.calls.filter(([input]) => String(input).includes('/law-of-day')).length;
}

/**
 * Loads the home view, the ad trigger and Sentry afresh. The page sends at most one Law of the Day event for as long
 * as the api module lives, so every test needs its own copy of it.
 */
async function loadHome() {
  vi.resetModules();
  const Sentry = await import('@sentry/browser');
  const ads = await import('../src/utils/ads.ts');
  const { Home } = await import('../src/views/home.ts');
  return { Sentry, ads, Home };
}

function zoneOf(el: HTMLElement): HTMLElement {
  return el.querySelector<HTMLElement>('[data-home-zone="law-of-day"]')!;
}

async function waitForState(el: HTMLElement, state: string): Promise<void> {
  await vi.waitFor(() => {
    expect(zoneOf(el).dataset.dailyLawState).toBe(state);
  });
}

describe('Home view: Law of the Day load failures', () => {
  beforeEach(() => {
    // The Sentry mock is one object for the whole file, so what it recorded in the last test has to go
    vi.clearAllMocks();
    delete window.__earlyLawOfDay;
  });

  afterEach(() => {
    delete window.__earlyLawOfDay;
    vi.restoreAllMocks();
  });

  describe('a request that failed for a real reason is reported once, with its context', () => {
    it('reports a failure status with the status', async () => {
      stubApi(() => jsonAnswer({}, { ok: false, status: 503 }));
      const { Sentry, Home } = await loadHome();

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'error');

      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
      expect(Sentry.captureMessage).toHaveBeenCalledWith('Law of the Day failed to load: 503', {
        level: 'error',
        extra: { reason: '503', detail: 'API request failed: 503' }
      });
      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(zoneOf(el).querySelector('[data-action="retry"]')).toBeTruthy();
    });

    it.each([
      ['a payload that is not an object', null, 'there is no law in it'],
      ['a payload without a law', {}, 'there is no law in it'],
      ['a null law', { law: null }, 'there is no law in it'],
      ['a law that is not an object', { law: 'text' }, 'there is no law in it'],
      ['a law without an id', { law: { text: 'No id' } }, 'its id is missing or not a positive integer'],
      ['a law with an id that is a string', { law: { id: '7', text: 'String id' } }, 'its id is missing or not a positive integer'],
      ['a law with an id that is not a whole number', { law: { id: 1.5, text: 'Half' } }, 'its id is missing or not a positive integer'],
      ['a law with an id of 0', { law: { id: 0, text: 'Zero' } }, 'its id is missing or not a positive integer'],
      ['a law without text', { law: { id: 1 } }, 'its text is missing or empty'],
      ['a law whose text is not a string', { law: { id: 1, text: 5 } }, 'its text is missing or empty'],
      ['a law whose text is blank', { law: { id: 1, text: '   ' } }, 'its text is missing or empty'],
    ])('reports %s as a shape problem and shows the error state', async (_name, payload, problem) => {
      stubApi(() => jsonAnswer(payload));
      const { Sentry, ads, Home } = await loadHome();
      const shown = vi.spyOn(ads, 'triggerAdSense');

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'error');

      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
      expect(Sentry.captureMessage).toHaveBeenCalledWith('Law of the Day failed to load: shape', {
        level: 'error',
        extra: { reason: 'shape', detail: `The Law of the Day response is not a law: ${problem}` }
      });
      // Nothing malformed reached the renderer, and the ad listener is still told the page is ready
      expect(el.querySelector('#lod-date')).toBeNull();
      expect(shown).toHaveBeenCalledTimes(1);
    });

    it('reports a 404, which is what the API sends when no law is published', async () => {
      stubApi(() => jsonAnswer({ error: 'No published laws available' }, { ok: false, status: 404 }));
      const { Sentry, Home } = await loadHome();

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'error');

      expect(Sentry.captureMessage).toHaveBeenCalledWith('Law of the Day failed to load: 404', {
        level: 'error',
        extra: { reason: '404', detail: 'API request failed: 404' }
      });
    });

    it('reports a body that is not JSON as a parse failure', async () => {
      stubApi(() => Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('Unexpected token <')) }));
      const { Sentry, Home } = await loadHome();

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'error');

      expect(Sentry.captureMessage).toHaveBeenCalledWith('Law of the Day failed to load: parse', {
        level: 'error',
        extra: { reason: 'parse', detail: 'Unexpected token <' }
      });
    });

    it('reports a response that is declared as something other than JSON', async () => {
      stubApi(() => Promise.resolve({ ok: true, headers: new Headers({ 'content-type': 'text/html' }), json: async () => ({}) }));
      const { Sentry, Home } = await loadHome();

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'error');

      expect(Sentry.captureMessage).toHaveBeenCalledWith('Law of the Day failed to load: error', {
        level: 'error',
        extra: { reason: 'error', detail: 'API returned non-JSON response' }
      });
    });

    it('reports a rejection that is not an Error', async () => {
      stubApi(() => Promise.reject('boom'));
      const { Sentry, Home } = await loadHome();

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'error');

      expect(Sentry.captureMessage).toHaveBeenCalledWith('Law of the Day failed to load: error', {
        level: 'error',
        extra: { reason: 'error', detail: 'boom' }
      });
    });
  });

  describe('a good answer', () => {
    it.each([
      ['a full law', GOOD_LAW],
      ['a law with nothing but an id and a text', { id: 7, text: 'Bare minimum.' }],
    ])('shows %s and sends nothing', async (_name, law) => {
      stubApi(() => jsonAnswer({ law }));
      const { Sentry, Home } = await loadHome();

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'ready');

      expect(el.querySelector(`[data-law-id="${law.id}"]`)).toBeTruthy();
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
    });
  });

  describe('transient failures are not reported', () => {
    it.each([
      ['a failed fetch', () => new TypeError('Failed to fetch'), 'network'],
      ['an aborted request', () => new DOMException('The operation was aborted.', 'AbortError'), 'abort'],
      ['a request that timed out', () => new DOMException('The operation timed out.', 'TimeoutError'), 'timeout'],
      ['a failed fetch in Safari', () => new TypeError('Load failed'), 'network'],
      ['a connection lost while the body is read', () => new TypeError('network error'), 'network'],
    ])('does not report %s, and still shows the error state with a retry', async (_name, makeError, reason) => {
      stubApi(() => Promise.reject(makeError()));
      const { Sentry, Home } = await loadHome();

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'error');

      expect(Sentry.captureMessage).not.toHaveBeenCalled();
      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
        category: 'law-of-day',
        message: `Law of the Day failed to load: ${reason}`
      }));
      expect(zoneOf(el).querySelector('[data-action="retry"]')).toBeTruthy();
    });

    it('does not report a failure without an answer while the browser is offline', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      stubApi(() => Promise.reject(new Error('connection lost')));
      const { Sentry, Home } = await loadHome();

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'error');

      expect(Sentry.captureMessage).not.toHaveBeenCalled();
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({ message: 'Law of the Day failed to load: network' }));
    });

    it('still reports an answer that is a failure while the browser claims to be offline', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      stubApi(() => jsonAnswer({}, { ok: false, status: 502 }));
      const { Sentry, Home } = await loadHome();

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'error');

      expect(Sentry.captureMessage).toHaveBeenCalledWith('Law of the Day failed to load: 502', expect.objectContaining({ level: 'error' }));
    });

    it('does not let a transient failure use up the one event, so a later real failure is still reported', async () => {
      let failure: () => Promise<unknown> = () => Promise.reject(new TypeError('Failed to fetch'));
      stubApi(() => failure());
      const { Sentry, Home } = await loadHome();

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'error');
      expect(Sentry.captureMessage).not.toHaveBeenCalled();

      failure = () => jsonAnswer({}, { ok: false, status: 500 });
      zoneOf(el).querySelector<HTMLElement>('[data-action="retry"]')!.click();
      await vi.waitFor(() => expect(Sentry.captureMessage).toHaveBeenCalledTimes(1));
      expect(Sentry.captureMessage).toHaveBeenCalledWith('Law of the Day failed to load: 500', expect.objectContaining({ level: 'error' }));
    });
  });

  describe('an exception while showing the law is reported as a bug of the page', () => {
    it('sends the exception with its stack, and shows the error state', async () => {
      stubApi(() => jsonAnswer({ law: GOOD_LAW }));
      const { Sentry, ads, Home } = await loadHome();
      const renderFailure = new Error('ads blew up');
      vi.spyOn(ads, 'triggerAdSense').mockImplementationOnce(() => {
        throw renderFailure;
      });

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'error');

      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
      expect(Sentry.captureException).toHaveBeenCalledWith(renderFailure, { extra: { stage: 'render' } });
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
      expect(zoneOf(el).textContent).toMatch(/daily law could not be loaded/i);
      expect(zoneOf(el).querySelector('[data-action="retry"]')).toBeTruthy();
    });

    it('still sends it when the browser is offline, because it is not a network failure', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      stubApi(() => jsonAnswer({ law: GOOD_LAW }));
      const { Sentry, ads, Home } = await loadHome();
      vi.spyOn(ads, 'triggerAdSense').mockImplementationOnce(() => {
        throw new Error('ads blew up');
      });

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'error');

      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    });

    it('sends one event when the error state cannot be announced either', async () => {
      stubApi(() => jsonAnswer({ law: GOOD_LAW }));
      const { Sentry, ads, Home } = await loadHome();
      const shown = vi.spyOn(ads, 'triggerAdSense').mockImplementation(() => {
        throw new Error('ads blew up again');
      });

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'error');
      await vi.waitFor(() => expect(shown).toHaveBeenCalledTimes(2));

      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });

    it('sends one event when a failed request cannot announce the error state', async () => {
      stubApi(() => jsonAnswer({}, { ok: false, status: 500 }));
      const { Sentry, ads, Home } = await loadHome();
      vi.spyOn(ads, 'triggerAdSense').mockImplementation(() => {
        throw new Error('ads blew up');
      });

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'error');

      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });

  describe('at most one event is sent per page load', () => {
    it('reports the first failure only, and the retry still asks again', async () => {
      let failing = true;
      const fetchMock = stubApi(() => (failing ? jsonAnswer({}, { ok: false, status: 500 }) : jsonAnswer({ law: GOOD_LAW })));
      const { Sentry, Home } = await loadHome();

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'error');
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);

      // A second failure after a retry is only a breadcrumb
      zoneOf(el).querySelector<HTMLElement>('[data-action="retry"]')!.click();
      expect(zoneOf(el).dataset.dailyLawState).toBe('loading');
      await vi.waitFor(() => expect(dailyLawRequests(fetchMock)).toBe(2));
      await waitForState(el, 'error');
      await vi.waitFor(() => expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({ message: 'Law of the Day failed to load: 500' })));
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);

      // And a third try that works shows the law
      failing = false;
      zoneOf(el).querySelector<HTMLElement>('[data-action="retry"]')!.click();
      await waitForState(el, 'ready');
      expect(dailyLawRequests(fetchMock)).toBe(3);
      expect(el.querySelector('[data-law-id="42"]')).toBeTruthy();
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('does not send a second event for a render exception after a reported failure', async () => {
      let failing = true;
      stubApi(() => (failing ? jsonAnswer({}, { ok: false, status: 500 }) : jsonAnswer({ law: GOOD_LAW })));
      const { Sentry, ads, Home } = await loadHome();

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'error');
      failing = false;
      vi.spyOn(ads, 'triggerAdSense').mockImplementationOnce(() => {
        throw new Error('ads blew up');
      });
      zoneOf(el).querySelector<HTMLElement>('[data-action="retry"]')!.click();
      await vi.waitFor(() => expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({ message: 'Law of the Day failed to render' })));
      await waitForState(el, 'error');

      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('does not add a second event when the early request failed and the fallback request fails too', async () => {
      window.__earlyLawOfDay = {
        law: null,
        url: `${API_BASE_URL}/api/v1/law-of-day`,
        startedAt: Date.now(),
        error: '503',
        promise: Promise.resolve(null)
      };
      stubApi(() => jsonAnswer({}, { ok: false, status: 503 }));
      const { Sentry, Home } = await loadHome();

      const el = Home({ onNavigate: vi.fn() });
      await waitForState(el, 'error');

      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
      expect(Sentry.captureMessage).toHaveBeenCalledWith('Early Law of the Day failed: 503', expect.objectContaining({ level: 'warning' }));
    });
  });
});
