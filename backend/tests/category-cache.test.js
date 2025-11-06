import {
  getCachedCategories,
  setCachedCategories,
  getCachedAttributions,
  setCachedAttributions,
  deferUntilIdle
} from '../src/utils/category-cache.js';

function createLocalThis() {
  const context = {};

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
    self.originalStorage = global.localStorage;
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

  describe('deferUntilIdle', () => {
    it('calls callback via setTimeout when requestIdleCallback is not available', async () => {
      const callback = vi.fn();
      const originalRIC = global.requestIdleCallback;
      delete global.requestIdleCallback;

      deferUntilIdle(callback);

      // Should be called via setTimeout fallback (async)
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });

      if (originalRIC) {
        global.requestIdleCallback = originalRIC;
      }
    });

    it('uses requestIdleCallback when available', () => {
      const callback = vi.fn();
      const mockIdleCallback = vi.fn((cb) => {
        // Execute immediately for testing
        setTimeout(() => cb({ timeRemaining: () => 5 }), 0);
        return 1; // Return a handle
      });

      global.requestIdleCallback = mockIdleCallback;

      deferUntilIdle(callback, 1000);

      expect(mockIdleCallback).toHaveBeenCalled();
      expect(mockIdleCallback).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout: 1000 }
      );

      // Cleanup
      delete global.requestIdleCallback;
    });

    it('respects timeout parameter', () => {
      const callback = vi.fn();
      const mockIdleCallback = vi.fn((cb, options) => {
        setTimeout(() => cb({ timeRemaining: () => 5 }), 0);
        return 1;
      });

      global.requestIdleCallback = mockIdleCallback;

      deferUntilIdle(callback, 5000);

      expect(mockIdleCallback).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout: 5000 }
      );

      delete global.requestIdleCallback;
    });
  });
});

