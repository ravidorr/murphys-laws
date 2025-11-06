import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ensureAdsense } from '../src/utils/third-party.js';

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
});

