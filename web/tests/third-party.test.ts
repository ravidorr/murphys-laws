import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ensureAdsense, initAnalyticsBootstrap } from '../src/utils/third-party.ts';

/** Window plus analytics globals; Vitest's globalThis.window type doesn't merge with src/types/global.d.ts */
type WindowWithAnalytics = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

describe('third-party utilities', () => {
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
        w.requestIdleCallback = undefined;
      }

      addEventListenerSpy = vi.spyOn(globalThis as unknown as { addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void }, 'addEventListener');
    });

    afterEach(() => {
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
        if (originalRequestIdleCallback !== undefined) {
          w.requestIdleCallback = originalRequestIdleCallback;
        }
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

    it('sets up interaction listeners on first call', () => {
      initAnalyticsBootstrap();

      // Verify listeners were added for pointerdown, keydown, and scroll
      const calls = addEventListenerSpy.mock.calls;
      const eventTypes = calls.map((call: unknown[]) => call[0] as string);
      
      expect(eventTypes).toContain('pointerdown');
      expect(eventTypes).toContain('keydown');
      expect(eventTypes).toContain('scroll');
    });

    it('sets up idle callback fallback when available', async () => {
      // Reload module to reset state
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      
      const idleCallbackSpy = vi.fn((cb) => {
        setTimeout(cb, 0);
        return 1;
      });
      globalThis.window.requestIdleCallback = idleCallbackSpy;

      freshInit();

      // requestIdleCallback should be called synchronously
      expect(idleCallbackSpy).toHaveBeenCalled();
    });

    it('uses setTimeout fallback when requestIdleCallback not available', async () => {
      // Reload module to reset state
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      
      const setTimeoutSpy = vi.spyOn(globalThis.window, 'setTimeout');

      freshInit();

      // setTimeout should be called synchronously for idle fallback
      expect(setTimeoutSpy).toHaveBeenCalled();

      setTimeoutSpy.mockRestore();
    });

    it('initializes dataLayer on user interaction', async () => {
      // Reload module to reset state
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      
      freshInit();

      // Simulate pointerdown event
      const pointerdownEvent = new Event('pointerdown', { bubbles: true });
      globalThis.window.dispatchEvent(pointerdownEvent);

      // After interaction, dataLayer should be initialized
      expect((globalThis.window as WindowWithAnalytics).dataLayer).toBeDefined();
      expect(Array.isArray((globalThis.window as WindowWithAnalytics).dataLayer)).toBe(true);
    });

    it('initializes gtag function on user interaction', async () => {
      // Reload module to reset state
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');

      freshInit();

      // Simulate keydown event
      const keydownEvent = new Event('keydown', { bubbles: true });
      globalThis.window.dispatchEvent(keydownEvent);

      // After interaction, gtag should be initialized
      expect((globalThis.window as WindowWithAnalytics).gtag).toBeDefined();
      expect(typeof (globalThis.window as WindowWithAnalytics).gtag).toBe('function');
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
      window.dispatchEvent(new Event('scroll'));

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

    it('removes interaction listeners after first interaction', async () => {
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');

      const removeEventSpy = vi.spyOn(window, 'removeEventListener');

      freshInit();

      // First interaction
      window.dispatchEvent(new Event('pointerdown'));

      // Listeners should be removed
      expect(removeEventSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      expect(removeEventSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(removeEventSpy).toHaveBeenCalledWith('scroll', expect.any(Function));

      removeEventSpy.mockRestore();
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
      window.dispatchEvent(new Event('pointerdown'));

      // gtag should still be the original function
      expect(win.gtag).toBe(existingGtag);
    });

    it('does not trigger loads again if already triggered', async () => {
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');

      freshInit();

      const win = window as WindowWithAnalytics;
      // First trigger via scroll
      window.dispatchEvent(new Event('scroll'));
      const firstDataLayerRef = win.dataLayer;

      // Try to trigger again via keydown (should be no-op since already triggered)
      window.dispatchEvent(new Event('keydown'));

      // dataLayer should be the same reference
      expect(win.dataLayer).toBe(firstDataLayerRef);
    });
  });
});
