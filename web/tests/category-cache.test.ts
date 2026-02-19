import {
  getCachedCategories,
  setCachedCategories,
  getCachedAttributions,
  setCachedAttributions,
  deferUntilIdle
} from '../src/utils/category-cache.ts';

interface CategoryCacheContext {
  originalStorage?: Storage;
}

function createLocalThis(): () => CategoryCacheContext {
  const context: CategoryCacheContext = {};

  beforeEach(() => {
    Object.keys(context).forEach((key) => {
      delete context[key];
    });
  });

  return () => context;
}

describe('Category cache utilities', () => {
  const local = createLocalThis();

  beforeEach(() => {
    const self = local();
    self.originalStorage = globalThis.localStorage;
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Categories caching', () => {
    it('caches categories and retrieves them', () => {
      const categories = [
        { id: 1, title: 'General' },
        { id: 2, title: 'Technology' }
      ];

      setCachedCategories(categories);
      const cached = getCachedCategories();

      expect(cached).toEqual(categories);
    });

    it('returns null when no cache exists', () => {
      const cached = getCachedCategories();
      expect(cached).toBeNull();
    });

    it('returns null when cache is expired', () => {
      const categories = [{ id: 1, title: 'General' }];

      // Set cache with old timestamp (more than 1 hour ago)
      // Note: This also exercises backward compatibility since the old format
      // lacks a version field (version defaults to 0, which is accepted)
      const oldCache = {
        data: categories,
        timestamp: Date.now() - (2 * 60 * 60 * 1000) // 2 hours ago
      };
      localStorage.setItem('murphys_categories', JSON.stringify(oldCache));

      const cached = getCachedCategories();
      expect(cached).toBeNull();
      expect(localStorage.getItem('murphys_categories')).toBeNull();
    });

    it('handles localStorage errors gracefully', () => {
      // Mock localStorage to throw errors
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      const cached = getCachedCategories();
      expect(cached).toBeNull();
    });

    it('handles localStorage setItem errors gracefully', () => {
      const categories = [{ id: 1, title: 'General' }];

      // Mock localStorage to throw errors
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw
      expect(() => setCachedCategories(categories)).not.toThrow();
    });

    it('handles corrupted cache data gracefully', () => {
      localStorage.setItem('murphys_categories', 'invalid json');

      const cached = getCachedCategories();
      expect(cached).toBeNull();
    });
  });

  describe('Attributions caching', () => {
    it('caches attributions and retrieves them', () => {
      const attributions = [
        { name: 'Alice' },
        { name: 'Bob' }
      ];

      setCachedAttributions(attributions);
      const cached = getCachedAttributions();

      expect(cached).toEqual(attributions);
    });

    it('returns null when no cache exists', () => {
      const cached = getCachedAttributions();
      expect(cached).toBeNull();
    });

    it('returns null when cache is expired', () => {
      const attributions = [{ name: 'Alice' }];

      // Set cache with old timestamp (more than 1 hour ago)
      // Note: This also exercises backward compatibility since the old format
      // lacks a version field (version defaults to 0, which is accepted)
      const oldCache = {
        data: attributions,
        timestamp: Date.now() - (2 * 60 * 60 * 1000) // 2 hours ago
      };
      localStorage.setItem('murphys_attributions', JSON.stringify(oldCache));

      const cached = getCachedAttributions();
      expect(cached).toBeNull();
      expect(localStorage.getItem('murphys_attributions')).toBeNull();
    });

    it('handles localStorage errors gracefully', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      const cached = getCachedAttributions();
      expect(cached).toBeNull();
    });

    it('handles localStorage setItem errors gracefully', () => {
      const attributions = [{ name: 'Alice' }];

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => setCachedAttributions(attributions)).not.toThrow();
    });
  });

  describe('Cache versioning', () => {
    describe('Categories', () => {
      it('reads old cache format without version field (backward compatibility)', () => {
        const categories = [{ id: 1, title: 'General' }];

        // Old format: { data, timestamp } without version
        const oldCache = {
          data: categories,
          timestamp: Date.now()
        };
        localStorage.setItem('murphys_categories', JSON.stringify(oldCache));

        // Should still read successfully (version defaults to 0, which is accepted)
        const cached = getCachedCategories();
        expect(cached).toEqual(categories);
      });

      it('writes new cache format with version field', () => {
        const categories = [{ id: 1, title: 'General' }];

        setCachedCategories(categories);

        const stored = JSON.parse(localStorage.getItem('murphys_categories'));
        expect(stored).toHaveProperty('version');
        expect(stored.version).toBe(1);
        expect(stored).toHaveProperty('data');
        expect(stored).toHaveProperty('timestamp');
      });

      it('accepts cache with current version', () => {
        const categories = [{ id: 1, title: 'General' }];

        // Cache with current version (1)
        const versionedCache = {
          version: 1,
          data: categories,
          timestamp: Date.now()
        };
        localStorage.setItem('murphys_categories', JSON.stringify(versionedCache));

        const cached = getCachedCategories();
        expect(cached).toEqual(categories);
      });

      it('invalidates cache with version below minimum accepted version', () => {
        const categories = [{ id: 1, title: 'General' }];

        // Cache with version below MIN_ACCEPTED_VERSION (which is 0)
        // This exercises the version invalidation branch and simulates
        // the behavior when MIN_ACCEPTED_VERSION is bumped in the future
        const outdatedCache = {
          version: -1,
          data: categories,
          timestamp: Date.now()
        };
        localStorage.setItem('murphys_categories', JSON.stringify(outdatedCache));

        const cached = getCachedCategories();
        expect(cached).toBeNull();
        // Verify the outdated cache was removed from localStorage
        expect(localStorage.getItem('murphys_categories')).toBeNull();
      });

      it('documents version invalidation behavior for future schema changes', () => {
        // This test documents the expected behavior when MIN_ACCEPTED_VERSION is bumped.
        // Currently MIN_ACCEPTED_VERSION = 0, so all versions >= 0 are accepted.
        //
        // When a breaking schema change is needed:
        // 1. Bump CACHE_VERSION to 2 (new caches will have version: 2)
        // 2. Bump MIN_ACCEPTED_VERSION to 1 (invalidates version 0 caches)
        //    Or bump to 2 to invalidate both version 0 and 1
        //
        // After bumping MIN_ACCEPTED_VERSION to 1, caches with version 0 (old format)
        // would be invalidated and removed from localStorage.
        //
        // This behavior cannot be tested without mocking constants, but we verify
        // the version check logic exists by confirming versioned caches work correctly.
        const categories = [{ id: 1, title: 'General' }];

        // Verify the version field is used in cache lookup
        const versionedCache = {
          version: 1,
          data: categories,
          timestamp: Date.now()
        };
        localStorage.setItem('murphys_categories', JSON.stringify(versionedCache));

        const cached = getCachedCategories();
        expect(cached).toEqual(categories);

        // Verify stored cache has version field
        const stored = JSON.parse(localStorage.getItem('murphys_categories'));
        expect(stored.version).toBe(1);
      });
    });

    describe('Attributions', () => {
      it('reads old cache format without version field (backward compatibility)', () => {
        const attributions = [{ name: 'Alice' }];

        // Old format: { data, timestamp } without version
        const oldCache = {
          data: attributions,
          timestamp: Date.now()
        };
        localStorage.setItem('murphys_attributions', JSON.stringify(oldCache));

        // Should still read successfully (version defaults to 0, which is accepted)
        const cached = getCachedAttributions();
        expect(cached).toEqual(attributions);
      });

      it('writes new cache format with version field', () => {
        const attributions = [{ name: 'Alice' }];

        setCachedAttributions(attributions);

        const stored = JSON.parse(localStorage.getItem('murphys_attributions'));
        expect(stored).toHaveProperty('version');
        expect(stored.version).toBe(1);
        expect(stored).toHaveProperty('data');
        expect(stored).toHaveProperty('timestamp');
      });

      it('accepts cache with current version', () => {
        const attributions = [{ name: 'Alice' }];

        // Cache with current version (1)
        const versionedCache = {
          version: 1,
          data: attributions,
          timestamp: Date.now()
        };
        localStorage.setItem('murphys_attributions', JSON.stringify(versionedCache));

        const cached = getCachedAttributions();
        expect(cached).toEqual(attributions);
      });

      it('invalidates cache with version below minimum accepted version', () => {
        const attributions = [{ name: 'Alice' }];

        // Cache with version below MIN_ACCEPTED_VERSION (which is 0)
        // This exercises the version invalidation branch and simulates
        // the behavior when MIN_ACCEPTED_VERSION is bumped in the future
        const outdatedCache = {
          version: -1,
          data: attributions,
          timestamp: Date.now()
        };
        localStorage.setItem('murphys_attributions', JSON.stringify(outdatedCache));

        const cached = getCachedAttributions();
        expect(cached).toBeNull();
        // Verify the outdated cache was removed from localStorage
        expect(localStorage.getItem('murphys_attributions')).toBeNull();
      });
    });
  });

  describe('deferUntilIdle', () => {
    it('calls callback via setTimeout when requestIdleCallback is not available', async () => {
      const callback = vi.fn();
      const originalRIC = globalThis.requestIdleCallback;
      delete globalThis.requestIdleCallback;

      deferUntilIdle(callback);

      // Should be called via setTimeout fallback (async)
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });

      if (originalRIC) {
        globalThis.requestIdleCallback = originalRIC;
      }
    });

    it('uses requestIdleCallback when available', () => {
      const callback = vi.fn();
      const mockIdleCallback = vi.fn((cb) => {
        // Execute immediately for testing
        setTimeout(() => cb({ timeRemaining: () => 5 }), 0);
        return 1; // Return a handle
      });

      globalThis.requestIdleCallback = mockIdleCallback;

      deferUntilIdle(callback, 1000);

      expect(mockIdleCallback).toHaveBeenCalled();
      expect(mockIdleCallback).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout: 1000 }
      );

      // Cleanup
      delete globalThis.requestIdleCallback;
    });

    it('respects timeout parameter', () => {
      const callback = vi.fn();
      const mockIdleCallback = vi.fn((cb) => {
        setTimeout(() => cb({ timeRemaining: () => 5 }), 0);
        return 1;
      });

      globalThis.requestIdleCallback = mockIdleCallback;

      deferUntilIdle(callback, 5000);

      expect(mockIdleCallback).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout: 5000 }
      );

      delete globalThis.requestIdleCallback;
    });
  });
});

