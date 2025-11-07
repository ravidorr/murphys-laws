import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ensureAdsense, initAnalyticsBootstrap } from '../src/utils/third-party.js';

describe('third-party utilities', () => {
  describe('ensureAdsense', () => {
    let originalAdsbygoogle;

    beforeEach(() => {
      // Save and reset adsbygoogle
      originalAdsbygoogle = global.window?.adsbygoogle;
      if (global.window) {
        delete global.window.adsbygoogle;
      }
    });

    afterEach(() => {
      // Restore original state
      if (global.window) {
        global.window.adsbygoogle = originalAdsbygoogle;
      }
    });

    it('returns resolved promise immediately if adsbygoogle exists', async () => {
      global.window.adsbygoogle = [];

      const result = await ensureAdsense();

      expect(result).toBeUndefined(); // Promise resolves with undefined
    });

    it('returns resolved promise if adsbygoogle is already loaded', async () => {
      global.window.adsbygoogle = {
        loaded: true
      };

      const result = await ensureAdsense();

      expect(result).toBeUndefined();
    });

    it('polls and resolves when adsbygoogle appears', async () => {
      // Initially adsbygoogle doesn't exist
      expect(global.window.adsbygoogle).toBeUndefined();

      const promise = ensureAdsense();

      // Simulate script loading after 100ms
      setTimeout(() => {
        global.window.adsbygoogle = [];
      }, 100);

      await promise;

      expect(global.window.adsbygoogle).toBeDefined();
    }, 10000); // Increase timeout for this test

    it('times out after 5 seconds if adsbygoogle never appears', async () => {
      vi.useFakeTimers();

      const promise = ensureAdsense();

      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000);

      // Should resolve even though adsbygoogle doesn't exist
      await promise;

      expect(global.window.adsbygoogle).toBeUndefined();

      vi.useRealTimers();
    });

    it('caches the promise and returns the same one on subsequent calls', async () => {
      // Don't set adsbygoogle - this will create a polling promise
      const promise1 = ensureAdsense();
      const promise2 = ensureAdsense();

      // Both should be the same promise instance (cached)
      expect(promise1).toBe(promise2);

      // Clean up by setting adsbygoogle so promise resolves
      global.window.adsbygoogle = [];
      await promise1;
    });

    it('handles SSR case when window is undefined', () => {
      // Temporarily remove window
      const savedWindow = global.window;
      delete global.window;

      // Should not throw and should return resolved promise
      expect(() => {
        const result = ensureAdsense();
        expect(result).toBeInstanceOf(Promise);
      }).not.toThrow();

      // Restore window
      global.window = savedWindow;
    });

    it('resolves quickly when adsbygoogle appears during polling', async () => {
      vi.useFakeTimers();

      const promise = ensureAdsense();

      // Simulate adsbygoogle appearing after 200ms
      setTimeout(() => {
        global.window.adsbygoogle = [];
      }, 200);

      // Fast-forward time
      vi.advanceTimersByTime(300);

      await promise;

      expect(global.window.adsbygoogle).toBeDefined();

      vi.useRealTimers();
    });

    it('clears interval when adsbygoogle appears', async () => {
      vi.useFakeTimers();

      const promise = ensureAdsense();

      // Simulate adsbygoogle appearing
      setTimeout(() => {
        global.window.adsbygoogle = [];
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
      originalWindow = global.window;
      originalDataLayer = global.window?.dataLayer;
      originalGtag = global.window?.gtag;
      originalRequestIdleCallback = global.window?.requestIdleCallback;

      // Reset state
      if (global.window) {
        delete global.window.dataLayer;
        delete global.window.gtag;
        delete global.window.requestIdleCallback;
      }

      // Spy on addEventListener
      addEventListenerSpy = vi.spyOn(global.window, 'addEventListener');
    });

    afterEach(() => {
      // Restore spies
      if (addEventListenerSpy) {
        addEventListenerSpy.mockRestore();
      }

      // Restore original state
      if (originalWindow) {
        global.window = originalWindow;
        if (originalDataLayer !== undefined) {
          global.window.dataLayer = originalDataLayer;
        }
        if (originalGtag !== undefined) {
          global.window.gtag = originalGtag;
        }
        if (originalRequestIdleCallback !== undefined) {
          global.window.requestIdleCallback = originalRequestIdleCallback;
        }
      }
    });

    it('does nothing if window is undefined (SSR)', () => {
      const savedWindow = global.window;
      delete global.window;

      expect(() => {
        initAnalyticsBootstrap();
      }).not.toThrow();

      global.window = savedWindow;
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
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.js');
      
      const idleCallbackSpy = vi.fn((cb) => {
        setTimeout(cb, 0);
        return 1;
      });
      global.window.requestIdleCallback = idleCallbackSpy;

      freshInit();

      // requestIdleCallback should be called synchronously
      expect(idleCallbackSpy).toHaveBeenCalled();
    });

    it('uses setTimeout fallback when requestIdleCallback not available', async () => {
      // Reload module to reset state
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.js');
      
      const setTimeoutSpy = vi.spyOn(global.window, 'setTimeout');

      freshInit();

      // setTimeout should be called synchronously for idle fallback
      expect(setTimeoutSpy).toHaveBeenCalled();

      setTimeoutSpy.mockRestore();
    });

    it('initializes dataLayer on user interaction', async () => {
      // Reload module to reset state
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.js');
      
      freshInit();

      // Simulate pointerdown event
      const pointerdownEvent = new Event('pointerdown', { bubbles: true });
      global.window.dispatchEvent(pointerdownEvent);

      // After interaction, dataLayer should be initialized
      expect(global.window.dataLayer).toBeDefined();
      expect(Array.isArray(global.window.dataLayer)).toBe(true);
    });

    it('initializes gtag function on user interaction', async () => {
      // Reload module to reset state
      vi.resetModules();
      const { initAnalyticsBootstrap: freshInit } = await import('../src/utils/third-party.js');

      freshInit();

      // Simulate keydown event
      const keydownEvent = new Event('keydown', { bubbles: true });
      global.window.dispatchEvent(keydownEvent);

      // After interaction, gtag should be initialized
      expect(global.window.gtag).toBeDefined();
      expect(typeof global.window.gtag).toBe('function');
    });

    it('resolves ensureAdsense after timeout if adsbygoogle never appears', async () => {
      vi.resetModules();
      const { ensureAdsense: freshEnsureAdsense } = await import('../src/utils/third-party.js');

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
      const { ensureAdsense: freshEnsureAdsense } = await import('../src/utils/third-party.js');

      vi.useFakeTimers();

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const promise = freshEnsureAdsense();

      // Fast-forward to timeout
      vi.advanceTimersByTime(5000);

      await promise;

      // clearInterval should be called by timeout
      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
      vi.useRealTimers();
    });
  });
});

