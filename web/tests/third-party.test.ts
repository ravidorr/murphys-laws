import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ANALYTICS_CEILING_MS, ensureAdsense, initAnalyticsBootstrap, loadScript, scheduleWhenIdle, shouldLoadThirdParty, toAbsoluteUrl } from '../src/utils/third-party.ts';

/** Window plus analytics globals; Vitest's globalThis.window type doesn't merge with src/types/global.d.ts */
type WindowWithAnalytics = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

type IdleWindow = { requestIdleCallback?: typeof window.requestIdleCallback };

let idleQueue: Array<() => void> = [];

/** Replaces requestIdleCallback with a queue the test drains by hand, so "the browser went idle" is explicit. */
function installIdleQueue(): void {
  idleQueue = [];
  (window as unknown as IdleWindow).requestIdleCallback = ((callback: IdleRequestCallback) => {
    idleQueue.push(() => callback({ didTimeout: false, timeRemaining: () => 50 }));
    return idleQueue.length;
  }) as typeof window.requestIdleCallback;
}

/** Runs every callback queued with requestIdleCallback, as the browser would once idle. */
function flushIdle(): void {
  const queued = idleQueue;
  idleQueue = [];
  queued.forEach((callback) => callback());
}

describe('third-party utilities', () => {
  it('loads third-party scripts only on the canonical production host outside tests', () => {
    const originalLocation = window.location;
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('PROD', false);
    expect(shouldLoadThirdParty()).toBe(false);

    vi.stubEnv('PROD', true);
    Object.defineProperty(window, 'location', {
      value: { hostname: 'murphys-laws.com' },
      writable: true
    });
    expect(shouldLoadThirdParty()).toBe(true);

    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
    vi.unstubAllEnvs();
  });

  it('never loads third parties on Kindle, even on the canonical production host', () => {
    const originalLocation = window.location;
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('PROD', true);
    Object.defineProperty(window, 'location', {
      value: { hostname: 'murphys-laws.com' },
      writable: true
    });
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (X11; U; Linux armv7l like Android; en-us) AppleWebKit/531.2+ (KHTML, like Gecko) Version/5.0 Safari/533.2+ Kindle/3.0+');

    try {
      expect(shouldLoadThirdParty()).toBe(false);
    } finally {
      vi.restoreAllMocks();
      Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
      vi.unstubAllEnvs();
    }
  });

  it('does not load third parties without a browser window', () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('PROD', true);
    vi.stubGlobal('window', undefined);

    try {
      expect(shouldLoadThirdParty()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  describe('toAbsoluteUrl', () => {
    it('returns relative paths unchanged without a document', () => {
      vi.stubGlobal('document', undefined);

      try {
        expect(toAbsoluteUrl('/analytics.js')).toBe('/analytics.js');
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('returns malformed URLs unchanged', () => {
      expect(toAbsoluteUrl('http://[invalid')).toBe('http://[invalid');
    });
  });

  describe('ensureAdsense', () => {
    let originalAdsbygoogle: unknown;

    beforeEach(() => {
      const win = globalThis.window as unknown as { adsbygoogle?: unknown };
      originalAdsbygoogle = win?.adsbygoogle;
      if (globalThis.window) {
        win.adsbygoogle = undefined;
      }
    });

    afterEach(() => {
      if (globalThis.window) {
        (globalThis.window as unknown as { adsbygoogle?: unknown }).adsbygoogle = originalAdsbygoogle;
      }
    });

    it('returns resolved promise immediately if adsbygoogle exists', async () => {
      globalThis.window.adsbygoogle = [];

      const result = await ensureAdsense();

      expect(result).toBeUndefined(); // Promise resolves with undefined
    });

    it('returns resolved promise if adsbygoogle is already loaded', async () => {
      globalThis.window.adsbygoogle = [{ loaded: true }];

      const result = await ensureAdsense();

      expect(result).toBeUndefined();
    });

    it('polls and resolves when adsbygoogle appears', async () => {
      // Initially adsbygoogle doesn't exist
      expect(globalThis.window.adsbygoogle).toBeUndefined();

      const promise = ensureAdsense();

      // Simulate script loading after 100ms
      setTimeout(() => {
        globalThis.window.adsbygoogle = [];
      }, 100);

      await promise;

      expect(globalThis.window.adsbygoogle).toBeDefined();
    }, 10000); // Increase timeout for this test

    it('times out after 5 seconds if adsbygoogle never appears', async () => {
      vi.useFakeTimers();

      const promise = ensureAdsense();

      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000);

      // Should resolve even though adsbygoogle doesn't exist
      await promise;

      expect(globalThis.window.adsbygoogle).toBeUndefined();

      vi.useRealTimers();
    });

    it('caches the promise and returns the same one on subsequent calls', async () => {
      // Don't set adsbygoogle - this will create a polling promise
      const promise1 = ensureAdsense();
      const promise2 = ensureAdsense();

      // Both should be the same promise instance (cached)
      expect(promise1).toBe(promise2);

      // Clean up by setting adsbygoogle so promise resolves
      globalThis.window.adsbygoogle = [];
      await promise1;
    });

    it('handles SSR case when window is undefined', () => {
      const g = globalThis as unknown as { window?: Window };
      const savedWindow = g.window;
      g.window = undefined;

      // Should not throw and should return resolved promise
      expect(() => {
        const result = ensureAdsense();
        expect(result).toBeInstanceOf(Promise);
      }).not.toThrow();

      g.window = savedWindow;
    });

    it('resolves quickly when adsbygoogle appears during polling', async () => {
      vi.useFakeTimers();

      const promise = ensureAdsense();

      // Simulate adsbygoogle appearing after 200ms
      setTimeout(() => {
        globalThis.window.adsbygoogle = [];
      }, 200);

      // Fast-forward time
      vi.advanceTimersByTime(300);

      await promise;

      expect(globalThis.window.adsbygoogle).toBeDefined();

      vi.useRealTimers();
    });

    it('clears interval when adsbygoogle appears', async () => {
      vi.useFakeTimers();

      const promise = ensureAdsense();

      // Simulate adsbygoogle appearing
      setTimeout(() => {
        globalThis.window.adsbygoogle = [];
      }, 100);

      vi.advanceTimersByTime(200);

      await promise;

      // Advance more time - interval should be cleared
      vi.advanceTimersByTime(1000);

      // Should still be resolved (no errors)
      await promise;

      vi.useRealTimers();
    });
  });

  describe('initAnalyticsBootstrap', () => {
    let originalWindow: Window | undefined;
    let originalDataLayer: unknown;
    let originalGtag: unknown;
    let originalRequestIdleCallback: typeof window.requestIdleCallback | undefined;
    let addEventListenerSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      const win = globalThis.window as Window & { dataLayer?: unknown; gtag?: unknown };
      originalWindow = win;
      originalDataLayer = win?.dataLayer;
      originalGtag = (win as Window & { gtag?: unknown })?.gtag;
      originalRequestIdleCallback = win?.requestIdleCallback;

      const w = win as unknown as { dataLayer?: unknown; gtag?: unknown; requestIdleCallback?: typeof window.requestIdleCallback };
      if (globalThis.window) {
        w.dataLayer = undefined;
        w.gtag = undefined;
      }
      installIdleQueue();

      addEventListenerSpy = vi.spyOn(globalThis as unknown as { addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void }, 'addEventListener');
    });

    afterEach(() => {
      // Remove load listeners a started module left on window so they cannot fire in a later test
      addEventListenerSpy.mock.calls
        .filter((call: unknown[]) => call[0] === 'load')
        .forEach((call: unknown[]) => window.removeEventListener('load', call[1] as EventListener));

      // Restore spies
      if (addEventListenerSpy) {
        addEventListenerSpy.mockRestore();
      }

      // Restore original state
      if (originalWindow) {
        (globalThis as unknown as { window: Window }).window = originalWindow;
        const w = globalThis.window as unknown as { dataLayer?: unknown; gtag?: unknown; requestIdleCallback?: typeof window.requestIdleCallback };
        if (originalDataLayer !== undefined) {
          w.dataLayer = originalDataLayer;
        }
        if (originalGtag !== undefined) {
          w.gtag = originalGtag;
        }
        w.requestIdleCallback = originalRequestIdleCallback;
      }
    });

    it('does nothing if window is undefined (SSR)', () => {
      const g = globalThis as unknown as { window?: Window };
      const savedWindow = g.window;
      g.window = undefined;

      expect(() => {
        initAnalyticsBootstrap();
      }).not.toThrow();

      g.window = savedWindow;
    });

    it('does not wait for a user interaction', async () => {
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');

      freshInit();

      const eventTypes = addEventListenerSpy.mock.calls.map((call: unknown[]) => call[0] as string);

      // It schedules the load itself instead of listening for the visitor
      expect(idleQueue).toHaveLength(1);
      expect(eventTypes).not.toContain('pointerdown');
      expect(eventTypes).not.toContain('keydown');
      expect(eventTypes).not.toContain('scroll');
    });

    it('leaves everything alone when third-party loading is disabled', async () => {
      vi.resetModules();
      vi.stubEnv('MODE', 'production');
      vi.stubEnv('PROD', false);
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
      try {
        const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');

        freshInit();

        expect(idleQueue).toHaveLength(0);
        expect(setTimeoutSpy).not.toHaveBeenCalled();
        expect(addEventListenerSpy.mock.calls.some((call: unknown[]) => call[0] === 'load')).toBe(false);
      } finally {
        setTimeoutSpy.mockRestore();
        vi.unstubAllEnvs();
      }
    });

    it('does not load analytics before the browser is idle', async () => {
      vi.resetModules();
      document.querySelectorAll('script[src*="googletagmanager"]').forEach((script) => script.remove());
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');

      freshInit();
      window.dispatchEvent(new Event('pointerdown'));
      window.dispatchEvent(new Event('keydown'));
      // A listener on document (not window) would also see these bubbling events
      document.body.dispatchEvent(new Event('keydown', { bubbles: true }));
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      document.body.dispatchEvent(new Event('scroll', { bubbles: true }));

      expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();

      flushIdle();

      expect(document.querySelectorAll('script[src*="googletagmanager"]')).toHaveLength(1);
    });

    it('waits for the load event when the document is still loading', async () => {
      vi.resetModules();
      document.querySelectorAll('script[src*="googletagmanager"]').forEach((script) => script.remove());
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');

      try {
        freshInit();
        expect(idleQueue).toHaveLength(0);
        expect(addEventListenerSpy.mock.calls.some((call: unknown[]) => call[0] === 'load')).toBe(true);

        window.dispatchEvent(new Event('load'));
        expect(idleQueue).toHaveLength(1);
        expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();

        flushIdle();
        expect(document.querySelectorAll('script[src*="googletagmanager"]')).toHaveLength(1);
      } finally {
        readyState.mockRestore();
      }
    });

    it('schedules the load with requestIdleCallback when available', async () => {
      // Reload module to reset state
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      
      const idleCallbackSpy = vi.fn((cb) => {
        setTimeout(cb, 0);
        return 1;
      });
      globalThis.window.requestIdleCallback = idleCallbackSpy;

      freshInit();

      // requestIdleCallback should be called synchronously, bounded by the idle timeout
      expect(idleCallbackSpy).toHaveBeenCalledWith(expect.any(Function), { timeout: 3000 });
    });

    it('uses a timer that fires at exactly 3000 ms when requestIdleCallback is not available', async () => {
      // Reload module to reset state
      vi.resetModules();
      document.querySelectorAll('script[src*="googletagmanager"]').forEach((script) => script.remove());
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      (window as unknown as IdleWindow).requestIdleCallback = undefined;
      vi.useFakeTimers();

      try {
        freshInit();

        vi.advanceTimersByTime(2999);
        expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
        vi.advanceTimersByTime(1);
        expect(document.querySelectorAll('script[src*="googletagmanager"]')).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('loads analytics at the 5000 ms ceiling when the load event never comes', async () => {
      vi.resetModules();
      document.querySelectorAll('script[src*="googletagmanager"]').forEach((script) => script.remove());
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
      vi.useFakeTimers();

      try {
        freshInit();

        expect(ANALYTICS_CEILING_MS).toBe(5000);
        vi.advanceTimersByTime(4999);
        expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
        vi.advanceTimersByTime(1);
        expect(document.querySelectorAll('script[src*="googletagmanager"]')).toHaveLength(1);
      } finally {
        vi.useRealTimers();
        readyState.mockRestore();
      }
    });

    it('does not load a second time when the load event and idle callback arrive after the ceiling', async () => {
      vi.resetModules();
      document.querySelectorAll('script[src*="googletagmanager"]').forEach((script) => script.remove());
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
      vi.useFakeTimers();

      try {
        freshInit();
        vi.advanceTimersByTime(5000);
        expect(document.querySelectorAll('script[src*="googletagmanager"]')).toHaveLength(1);
        const gtagScript = document.querySelector('script[src*="googletagmanager"]');

        window.dispatchEvent(new Event('load'));
        expect(idleQueue).toHaveLength(1);
        flushIdle();

        expect(document.querySelectorAll('script[src*="googletagmanager"]')).toHaveLength(1);
        expect(document.querySelector('script[src*="googletagmanager"]')).toBe(gtagScript);
      } finally {
        vi.useRealTimers();
        readyState.mockRestore();
      }
    });

    it.each([
      ['the idle load runs first and the ceiling follows', true],
      ['the ceiling runs first and the idle load follows', false],
    ])('configures gtag exactly once when %s', async (_name, idleFirst) => {
      vi.resetModules();
      document.querySelectorAll('script[src*="googletagmanager"]').forEach((script) => script.remove());
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      const gtagSpy = vi.fn();
      (window as WindowWithAnalytics).gtag = gtagSpy;
      const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
      vi.useFakeTimers();

      try {
        freshInit();
        const fireIdle = () => {
          // jsdom does not fire the real load event by itself
          window.dispatchEvent(new Event('load'));
          flushIdle();
        };

        if (idleFirst) {
          fireIdle();
          vi.advanceTimersByTime(5000);
        } else {
          vi.advanceTimersByTime(5000);
          fireIdle();
        }
        document.querySelector('script[src*="googletagmanager"]')!.dispatchEvent(new Event('load'));
        await vi.advanceTimersByTimeAsync(0);

        const names = gtagSpy.mock.calls.map((call) => call[0]);
        expect(names.filter((name) => name === 'js')).toHaveLength(1);
        expect(names.filter((name) => name === 'config')).toHaveLength(1);
      } finally {
        vi.useRealTimers();
        readyState.mockRestore();
      }
    });

    it('does not load a second time when the ceiling fires after the idle load already ran', async () => {
      vi.resetModules();
      document.querySelectorAll('script[src*="googletagmanager"]').forEach((script) => script.remove());
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      vi.useFakeTimers();

      try {
        freshInit();
        flushIdle();
        const win = window as WindowWithAnalytics;
        const dataLayer = win.dataLayer;
        const gtag = win.gtag;
        expect(document.querySelectorAll('script[src*="googletagmanager"]')).toHaveLength(1);

        vi.advanceTimersByTime(5000);

        expect(document.querySelectorAll('script[src*="googletagmanager"]')).toHaveLength(1);
        expect(win.dataLayer).toBe(dataLayer);
        expect(win.gtag).toBe(gtag);
      } finally {
        vi.useRealTimers();
      }
    });

    it('initializes dataLayer once the browser is idle', async () => {
      // Reload module to reset state
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      
      freshInit();

      flushIdle();

      // Once idle, dataLayer should be initialized
      expect((globalThis.window as WindowWithAnalytics).dataLayer).toBeDefined();
      expect(Array.isArray((globalThis.window as WindowWithAnalytics).dataLayer)).toBe(true);
    });

    it('initializes gtag function once the browser is idle', async () => {
      // Reload module to reset state
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');

      freshInit();

      flushIdle();

      // Once idle, gtag should be initialized
      expect((globalThis.window as WindowWithAnalytics).gtag).toBeDefined();
      expect(typeof (globalThis.window as WindowWithAnalytics).gtag).toBe('function');
    });

    it('L106 B1: triggerThirdPartyScripts creates gtagPromise when undefined', async () => {
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      freshInit();
      flushIdle();
      const win = globalThis.window as WindowWithAnalytics;
      expect(win.gtag).toBeDefined();
      expect(win.dataLayer).toBeDefined();
    });

    it('resolves ensureAdsense after timeout if adsbygoogle never appears', async () => {
      vi.resetModules();
      const { ensureAdsense: freshEnsureAdsense } = await import('../src/utils/third-party.ts');

      vi.useFakeTimers();

      const promise = freshEnsureAdsense();

      // Fast-forward past the 5 second timeout
      vi.advanceTimersByTime(5001);

      // Promise should resolve even without adsbygoogle
      await promise;

      expect(true).toBe(true); // Test passes if promise resolves

      vi.useRealTimers();
    });

    it('clears interval on timeout in ensureAdsense', async () => {
      vi.resetModules();
      const { ensureAdsense: freshEnsureAdsense } = await import('../src/utils/third-party.ts');

      vi.useFakeTimers();

      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

      const promise = freshEnsureAdsense();

      // Fast-forward to timeout
      vi.advanceTimersByTime(5000);

      await promise;

      // clearInterval should be called by timeout
      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
      vi.useRealTimers();
    });

    it('only initializes once even if called multiple times', async () => {
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');

      const addEventSpy = vi.spyOn(window, 'addEventListener');

      // Call multiple times
      freshInit();
      const firstCallCount = addEventSpy.mock.calls.length;
      
      freshInit();
      freshInit();

      // Should not add more listeners after first call
      expect(addEventSpy.mock.calls.length).toBe(firstCallCount);

      addEventSpy.mockRestore();
    });

    it('gtag function pushes to dataLayer', async () => {
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');

      freshInit();

      // Simulate user interaction to trigger third-party loads
      flushIdle();

      const win = window as WindowWithAnalytics;
      // Check that gtag is defined and functional
      expect(win.gtag).toBeDefined();
      expect(win.dataLayer).toBeDefined();

      // Call gtag and verify it pushes to dataLayer
      const dataLayer = win.dataLayer!;
      const initialLength = dataLayer.length;
      win.gtag!('event', 'test_event', { test_param: 'value' });

      expect(dataLayer.length).toBeGreaterThan(initialLength);
    });

    it('configures an existing gtag after its script finishes loading', async () => {
      const localThis: { gtag: (...args: unknown[]) => void; script?: HTMLScriptElement } = {
        gtag: vi.fn<(...args: unknown[]) => void>(),
      };
      document.querySelectorAll('script[src*="googletagmanager"]').forEach((script) => script.remove());
      vi.resetModules();
      (window as WindowWithAnalytics).gtag = localThis.gtag as WindowWithAnalytics['gtag'];
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');

      freshInit();
      flushIdle();
      localThis.script = document.querySelector('script[src*="googletagmanager"]') as HTMLScriptElement;
      localThis.script.dispatchEvent(new Event('load'));
      await vi.waitFor(() => {
        expect(localThis.gtag).toHaveBeenCalledWith('js', expect.any(Date));
      });

      expect(localThis.gtag).toHaveBeenCalledWith('config', 'G-XG7G6KRP0E', { transport_type: 'beacon' });
    });

    it('tolerates gtag being removed before the analytics script loads', async () => {
      const localThis: { script?: HTMLScriptElement } = {};
      document.querySelectorAll('script[src*="googletagmanager"]').forEach((script) => script.remove());
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');

      freshInit();
      flushIdle();
      localThis.script = document.querySelector('script[src*="googletagmanager"]') as HTMLScriptElement;
      delete (window as WindowWithAnalytics).gtag;
      localThis.script.dispatchEvent(new Event('load'));
      await new Promise((resolve) => setTimeout(resolve, 0));

      // The load handler found no gtag and did not recreate it
      expect((window as WindowWithAnalytics).gtag).toBeUndefined();
    });

    it('loads analytics only once however many times it is started', async () => {
      vi.resetModules();
      document.querySelectorAll('script[src*="googletagmanager"]').forEach((script) => script.remove());
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');

      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

      try {
        freshInit();
        freshInit();

        // One idle callback and one ceiling timer, however many times it is started
        expect(idleQueue).toHaveLength(1);
        expect(setTimeoutSpy.mock.calls.filter((call) => call[1] === 5000)).toHaveLength(1);

        flushIdle();
        flushIdle();

        expect(document.querySelectorAll('script[src*="googletagmanager"]')).toHaveLength(1);
      } finally {
        setTimeoutSpy.mockRestore();
      }
    });

    it('does not reinitialize gtag if already exists', async () => {
      vi.resetModules();

      const win = window as WindowWithAnalytics;
      // Pre-set gtag
      const existingGtag = vi.fn();
      win.gtag = existingGtag;
      win.dataLayer = [];

      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      freshInit();

      // Trigger interaction
      flushIdle();

      // gtag should still be the original function
      expect(win.gtag).toBe(existingGtag);
    });
  });

  describe('scheduleWhenIdle', () => {
    afterEach(() => {
      installIdleQueue();
      vi.useRealTimers();
    });

    it('defaults to the shared idle timeout', () => {
      const spy = vi.fn(() => 1);
      (window as unknown as { requestIdleCallback: unknown }).requestIdleCallback = spy;

      scheduleWhenIdle(() => undefined);

      expect(spy).toHaveBeenCalledWith(expect.any(Function), { timeout: 3000 });
    });

    it('defaults to a 3000 ms timer without requestIdleCallback', () => {
      vi.useFakeTimers();
      (window as unknown as IdleWindow).requestIdleCallback = undefined;
      const callback = vi.fn();

      scheduleWhenIdle(callback);
      vi.advanceTimersByTime(2999);
      expect(callback).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('falls back to a timer of the same length without requestIdleCallback', () => {
      vi.useFakeTimers();
      (window as unknown as IdleWindow).requestIdleCallback = undefined;
      const callback = vi.fn();

      scheduleWhenIdle(callback, 1234);
      vi.advanceTimersByTime(1233);
      expect(callback).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadScript', () => {
    beforeEach(() => {
      installIdleQueue();
    });

    afterEach(() => {
      (window as unknown as IdleWindow).requestIdleCallback = undefined;
    });

    it('resolves immediately without a document', async () => {
      vi.stubGlobal('document', undefined);

      try {
        await expect(loadScript('https://example.com/server.js')).resolves.toBeUndefined();
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('waits for a matching script that already exists in the document', async () => {
      const localThis: { source: string; script?: HTMLScriptElement; promise?: Promise<void> } = {
        source: 'https://example.com/existing.js',
      };
      localThis.script = document.createElement('script');
      localThis.script.src = localThis.source;
      document.head.appendChild(localThis.script);

      localThis.promise = loadScript(localThis.source);
      localThis.script.dispatchEvent(new Event('load'));

      await expect(localThis.promise).resolves.toBeUndefined();
      await expect(loadScript(localThis.source)).resolves.toBeUndefined();
      localThis.script.remove();
    });

    it('copies custom attributes and ignores nullish script properties', async () => {
      const localThis: { source: string; promise?: Promise<void>; script?: HTMLScriptElement } = {
        source: 'https://example.com/custom-attributes.js',
      };
      localThis.promise = loadScript(localThis.source, {
        crossOrigin: 'anonymous',
        'data-purpose': 'analytics',
        defer: undefined,
        nullable: null,
      } as unknown as Parameters<typeof loadScript>[1]);
      localThis.script = document.querySelector(`script[src="${localThis.source}"]`) as HTMLScriptElement;

      expect(localThis.script.crossOrigin).toBe('anonymous');
      expect(localThis.script.getAttribute('data-purpose')).toBe('analytics');
      expect(localThis.script.hasAttribute('nullable')).toBe(false);

      localThis.script.dispatchEvent(new Event('load'));
      await localThis.promise;
    });

    it('sets script props when passed (covers L68 B0)', async () => {
      const promise = loadScript('https://example.com/coverage.js', { async: false, defer: true });
      const script = document.querySelector('script[src*="example.com/coverage"]') as HTMLScriptElement;
      expect(script).toBeTruthy();
      expect(script.async).toBe(false);
      expect(script.defer).toBe(true);
      script.dispatchEvent(new Event('load', { bubbles: false }));
      await promise;
    });

    it('resolve path hits gtag init (L106); reject path hits catch (L109)', async () => {
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      freshInit();
      flushIdle();
      const script = document.querySelector('script[src*="googletagmanager"]') as HTMLScriptElement;
      expect(script).toBeTruthy();
      script.dispatchEvent(new Event('load', { bubbles: false }));
      await new Promise((r) => setTimeout(r, 0));
      const win = window as WindowWithAnalytics;
      expect(win.gtag).toBeDefined();
    });

    it('loadScript reject path (L109)', async () => {
      const badUrl = 'https://invalid.example/nonexistent.js';
      const promise = loadScript(badUrl);
      const script = document.querySelector(`script[src="${badUrl}"]`) as HTMLScriptElement;
      expect(script).toBeTruthy();
      script.dispatchEvent(new Event('error', { bubbles: false }));
      await expect(promise).rejects.toThrow(/Failed to load script/);
    });

    it('gtag loadScript catch path (L106-109): script error is ignored', async () => {
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      freshInit();
      flushIdle();
      const script = document.querySelector('script[src*="googletagmanager"]') as HTMLScriptElement;
      expect(script).toBeTruthy();
      script.dispatchEvent(new Event('error', { bubbles: false }));
      await new Promise((r) => setTimeout(r, 0));
      const win = window as WindowWithAnalytics;
      expect(win.gtag).toBeDefined();
    });

    it('L106: sets window.gtag when undefined once idle', async () => {
      const localThis: { win?: WindowWithAnalytics } = {};
      vi.resetModules();
      localThis.win = globalThis.window as WindowWithAnalytics;
      localThis.win.gtag = undefined;
      localThis.win.dataLayer = undefined;
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      freshInit();
      flushIdle();
      expect(localThis.win.gtag).toBeDefined();
      expect(typeof localThis.win.gtag).toBe('function');
    });

    it('L109: loadScript reject is caught silently (ad blocker path)', async () => {
      const localThis: { script?: HTMLScriptElement } = {};
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      freshInit();
      flushIdle();
      localThis.script = document.querySelector('script[src*="googletagmanager"]') as HTMLScriptElement;
      expect(localThis.script).toBeTruthy();
      localThis.script.dispatchEvent(new Event('error', { bubbles: false }));
      await new Promise((r) => setTimeout(r, 0));
      expect((globalThis.window as WindowWithAnalytics).gtag).toBeDefined();
    });
  });
});
