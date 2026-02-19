import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ensureAdsense, initAnalyticsBootstrap } from '../src/utils/third-party.ts';

describe('third-party utilities', () => {
  describe('ensureAdsense', () => {
    let originalAdsbygoogle;

    beforeEach(() => {
      // Save and reset adsbygoogle
      originalAdsbygoogle = globalThis.window?.adsbygoogle;
      if (globalThis.window) {
        delete globalThis.window.adsbygoogle;
      }
    });

    afterEach(() => {
      // Restore original state
      if (globalThis.window) {
        globalThis.window.adsbygoogle = originalAdsbygoogle;
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
      // Temporarily remove window
      const savedWindow = globalThis.window;
      delete globalThis.window;

      // Should not throw and should return resolved promise
      expect(() => {
        const result = ensureAdsense();
        expect(result).toBeInstanceOf(Promise);
      }).not.toThrow();

      // Restore window
      globalThis.window = savedWindow;
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
    let originalWindow;
    let originalDataLayer;
    let originalGtag;
    let originalRequestIdleCallback;
    let addEventListenerSpy;

    beforeEach(() => {
      // Save original state
      originalWindow = globalThis.window;
      originalDataLayer = globalThis.window?.dataLayer;
      originalGtag = globalThis.window?.gtag;
      originalRequestIdleCallback = globalThis.window?.requestIdleCallback;

      // Reset state
      if (globalThis.window) {
        delete globalThis.window.dataLayer;
        delete globalThis.window.gtag;
        delete globalThis.window.requestIdleCallback;
      }

      // Spy on addEventListener
      addEventListenerSpy = vi.spyOn(globalThis.window, 'addEventListener');
    });

    afterEach(() => {
      // Restore spies
      if (addEventListenerSpy) {
        addEventListenerSpy.mockRestore();
      }

      // Restore original state
      if (originalWindow) {
        globalThis.window = originalWindow;
        if (originalDataLayer !== undefined) {
          globalThis.window.dataLayer = originalDataLayer;
        }
        if (originalGtag !== undefined) {
          globalThis.window.gtag = originalGtag;
        }
        if (originalRequestIdleCallback !== undefined) {
          globalThis.window.requestIdleCallback = originalRequestIdleCallback;
        }
      }
    });

    it('does nothing if window is undefined (SSR)', () => {
      const savedWindow = globalThis.window;
      delete globalThis.window;

      expect(() => {
        initAnalyticsBootstrap();
      }).not.toThrow();

      globalThis.window = savedWindow;
    });

    it('sets up interaction listeners on first call', () => {
      initAnalyticsBootstrap();

      // Verify listeners were added for pointerdown, keydown, and scroll
      const calls = addEventListenerSpy.mock.calls;
      const eventTypes = calls.map(call => call[0]);
      
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
      expect(globalThis.window.dataLayer).toBeDefined();
      expect(Array.isArray(globalThis.window.dataLayer)).toBe(true);
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
      expect(globalThis.window.gtag).toBeDefined();
      expect(typeof globalThis.window.gtag).toBe('function');
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

      // Check that gtag is defined and functional
      expect(window.gtag).toBeDefined();
      expect(window.dataLayer).toBeDefined();

      // Call gtag and verify it pushes to dataLayer
      const initialLength = window.dataLayer.length;
      window.gtag('event', 'test_event', { test_param: 'value' });
      
      expect(window.dataLayer.length).toBeGreaterThan(initialLength);
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
      
      // Pre-set gtag
      const existingGtag = vi.fn();
      window.gtag = existingGtag;
      window.dataLayer = [];

      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');
      freshInit();

      // Trigger interaction
      window.dispatchEvent(new Event('pointerdown'));

      // gtag should still be the original function
      expect(window.gtag).toBe(existingGtag);
    });

    it('does not trigger loads again if already triggered', async () => {
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.ts');

      freshInit();

      // First trigger via scroll
      window.dispatchEvent(new Event('scroll'));
      const firstDataLayerRef = window.dataLayer;

      // Try to trigger again via keydown (should be no-op since already triggered)
      window.dispatchEvent(new Event('keydown'));

      // dataLayer should be the same reference
      expect(window.dataLayer).toBe(firstDataLayerRef);
    });
  });
});

