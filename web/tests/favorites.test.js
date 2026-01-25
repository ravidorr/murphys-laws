import {
  isFavorite,
  getFavorites,
  getFavoritesCount,
  addFavorite,
  removeFavorite,
  toggleFavorite,
  clearAllFavorites,
  exportFavorites,
  importFavorites,
} from '../src/utils/favorites.js';

// Mock feature flags to enable favorites by default
vi.mock('../src/utils/feature-flags.js', () => ({
  isFavoritesEnabled: vi.fn(() => true),
}));

import { isFavoritesEnabled } from '../src/utils/feature-flags.js';

describe('Favorites Service', () => {
  const localThis = {
    mockLaw: null,
    mockLaw2: null,
  };

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset mock to return true (enabled)
    vi.mocked(isFavoritesEnabled).mockReturnValue(true);
    // Set up test data
    localThis.mockLaw = {
      id: 123,
      text: 'Test law text',
      title: 'Test Law',
      attribution: 'Test Author',
      category_id: 1,
      category_slug: 'test-category',
    };
    localThis.mockLaw2 = {
      id: 456,
      text: 'Another law text',
      title: 'Another Law',
    };
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('isFavorite', () => {
    it('returns false when no favorites exist', () => {
      expect(isFavorite(123)).toBe(false);
    });

    it('returns true when law is favorited', () => {
      addFavorite(localThis.mockLaw);
      expect(isFavorite(123)).toBe(true);
    });

    it('returns false for non-favorited law', () => {
      addFavorite(localThis.mockLaw);
      expect(isFavorite(999)).toBe(false);
    });

    it('handles string and number law IDs', () => {
      addFavorite(localThis.mockLaw);
      expect(isFavorite(123)).toBe(true);
      expect(isFavorite('123')).toBe(true);
    });

    it('returns false when feature is disabled', () => {
      vi.mocked(isFavoritesEnabled).mockReturnValue(false);
      addFavorite(localThis.mockLaw);
      expect(isFavorite(123)).toBe(false);
    });
  });

  describe('getFavorites', () => {
    it('returns empty array when no favorites exist', () => {
      expect(getFavorites()).toEqual([]);
    });

    it('returns array of favorited laws', () => {
      addFavorite(localThis.mockLaw);
      addFavorite(localThis.mockLaw2);

      const favorites = getFavorites();
      expect(favorites).toHaveLength(2);
      expect(favorites.map((f) => f.id)).toContain(123);
      expect(favorites.map((f) => f.id)).toContain(456);
    });

    it('returns favorites sorted by savedAt descending (newest first)', () => {
      // Manually set localStorage with different timestamps to ensure ordering
      const now = Date.now();
      localStorage.setItem('murphys_favorites', JSON.stringify({
        '123': { id: 123, text: 'First', savedAt: now - 1000 },
        '456': { id: 456, text: 'Second', savedAt: now },
      }));

      const favorites = getFavorites();
      // Second added (higher timestamp) should be first (newest)
      expect(favorites[0].id).toBe(456);
      expect(favorites[1].id).toBe(123);
    });

    it('returns empty array when feature is disabled', () => {
      addFavorite(localThis.mockLaw);
      vi.mocked(isFavoritesEnabled).mockReturnValue(false);
      expect(getFavorites()).toEqual([]);
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem('murphys_favorites', 'invalid json');
      expect(getFavorites()).toEqual([]);
    });
  });

  describe('getFavoritesCount', () => {
    it('returns 0 when no favorites exist', () => {
      expect(getFavoritesCount()).toBe(0);
    });

    it('returns correct count', () => {
      addFavorite(localThis.mockLaw);
      expect(getFavoritesCount()).toBe(1);

      addFavorite(localThis.mockLaw2);
      expect(getFavoritesCount()).toBe(2);
    });

    it('returns 0 when feature is disabled', () => {
      addFavorite(localThis.mockLaw);
      vi.mocked(isFavoritesEnabled).mockReturnValue(false);
      expect(getFavoritesCount()).toBe(0);
    });
  });

  describe('addFavorite', () => {
    it('adds law to favorites', () => {
      addFavorite(localThis.mockLaw);
      expect(isFavorite(123)).toBe(true);
    });

    it('stores law data correctly', () => {
      addFavorite(localThis.mockLaw);
      const favorites = getFavorites();
      expect(favorites[0]).toMatchObject({
        id: 123,
        text: 'Test law text',
        title: 'Test Law',
        attribution: 'Test Author',
        category_id: 1,
        category_slug: 'test-category',
      });
      expect(favorites[0].savedAt).toBeDefined();
    });

    it('does nothing when law has no id', () => {
      addFavorite({ text: 'No ID' });
      expect(getFavoritesCount()).toBe(0);
    });

    it('does nothing when feature is disabled', () => {
      vi.mocked(isFavoritesEnabled).mockReturnValue(false);
      addFavorite(localThis.mockLaw);
      // Re-enable to check storage
      vi.mocked(isFavoritesEnabled).mockReturnValue(true);
      expect(getFavoritesCount()).toBe(0);
    });

    it('handles localStorage errors gracefully', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw
      expect(() => addFavorite(localThis.mockLaw)).not.toThrow();

      setItemSpy.mockRestore();
    });

    it('updates existing favorite if added again', () => {
      addFavorite(localThis.mockLaw);
      const originalSavedAt = getFavorites()[0].savedAt;

      // Wait a bit and add again
      addFavorite({ ...localThis.mockLaw, text: 'Updated text' });

      const favorites = getFavorites();
      expect(favorites).toHaveLength(1);
      expect(favorites[0].text).toBe('Updated text');
      expect(favorites[0].savedAt).toBeGreaterThanOrEqual(originalSavedAt);
    });
  });

  describe('removeFavorite', () => {
    it('removes law from favorites', () => {
      addFavorite(localThis.mockLaw);
      expect(isFavorite(123)).toBe(true);

      removeFavorite(123);
      expect(isFavorite(123)).toBe(false);
    });

    it('does nothing when law is not favorited', () => {
      expect(() => removeFavorite(123)).not.toThrow();
      expect(getFavoritesCount()).toBe(0);
    });

    it('handles string and number law IDs', () => {
      addFavorite(localThis.mockLaw);
      removeFavorite('123');
      expect(isFavorite(123)).toBe(false);
    });

    it('does nothing when feature is disabled', () => {
      addFavorite(localThis.mockLaw);
      vi.mocked(isFavoritesEnabled).mockReturnValue(false);
      removeFavorite(123);
      // Re-enable to check storage
      vi.mocked(isFavoritesEnabled).mockReturnValue(true);
      expect(isFavorite(123)).toBe(true);
    });
  });

  describe('toggleFavorite', () => {
    it('adds favorite when not favorited and returns true', () => {
      const result = toggleFavorite(localThis.mockLaw);
      expect(result).toBe(true);
      expect(isFavorite(123)).toBe(true);
    });

    it('removes favorite when already favorited and returns false', () => {
      addFavorite(localThis.mockLaw);
      const result = toggleFavorite(localThis.mockLaw);
      expect(result).toBe(false);
      expect(isFavorite(123)).toBe(false);
    });

    it('returns false when law has no id', () => {
      const result = toggleFavorite({ text: 'No ID' });
      expect(result).toBe(false);
    });

    it('returns false when feature is disabled', () => {
      vi.mocked(isFavoritesEnabled).mockReturnValue(false);
      const result = toggleFavorite(localThis.mockLaw);
      expect(result).toBe(false);
    });
  });

  describe('clearAllFavorites', () => {
    it('removes all favorites', () => {
      addFavorite(localThis.mockLaw);
      addFavorite(localThis.mockLaw2);
      expect(getFavoritesCount()).toBe(2);

      clearAllFavorites();
      expect(getFavoritesCount()).toBe(0);
    });

    it('does nothing when feature is disabled', () => {
      addFavorite(localThis.mockLaw);
      vi.mocked(isFavoritesEnabled).mockReturnValue(false);
      clearAllFavorites();
      // Re-enable to check storage
      vi.mocked(isFavoritesEnabled).mockReturnValue(true);
      expect(getFavoritesCount()).toBe(1);
    });

    it('handles localStorage errors gracefully', () => {
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => clearAllFavorites()).not.toThrow();

      removeItemSpy.mockRestore();
    });
  });

  describe('exportFavorites', () => {
    it('returns JSON string of favorites', () => {
      addFavorite(localThis.mockLaw);
      const exported = exportFavorites();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe(123);
    });

    it('returns empty array JSON when no favorites', () => {
      const exported = exportFavorites();
      expect(exported).toBe('[]');
    });

    it('returns empty array JSON when feature is disabled', () => {
      addFavorite(localThis.mockLaw);
      vi.mocked(isFavoritesEnabled).mockReturnValue(false);
      expect(exportFavorites()).toBe('[]');
    });
  });

  describe('importFavorites', () => {
    it('imports favorites from JSON', () => {
      const json = JSON.stringify([
        { id: 100, text: 'Imported law', title: 'Imported' },
        { id: 200, text: 'Another imported', title: 'Another' },
      ]);

      const count = importFavorites(json);
      expect(count).toBe(2);
      expect(isFavorite(100)).toBe(true);
      expect(isFavorite(200)).toBe(true);
    });

    it('preserves existing favorites', () => {
      addFavorite(localThis.mockLaw);

      const json = JSON.stringify([{ id: 100, text: 'Imported law' }]);
      importFavorites(json);

      expect(isFavorite(123)).toBe(true);
      expect(isFavorite(100)).toBe(true);
    });

    it('returns 0 for invalid JSON', () => {
      const count = importFavorites('invalid json');
      expect(count).toBe(0);
    });

    it('returns 0 for non-array JSON', () => {
      const count = importFavorites('{"id": 123}');
      expect(count).toBe(0);
    });

    it('skips items without id', () => {
      const json = JSON.stringify([
        { id: 100, text: 'Valid' },
        { text: 'No ID' },
        { id: 200, text: 'Also valid' },
      ]);

      const count = importFavorites(json);
      expect(count).toBe(2);
    });

    it('returns 0 when feature is disabled', () => {
      vi.mocked(isFavoritesEnabled).mockReturnValue(false);
      const json = JSON.stringify([{ id: 100, text: 'Test' }]);
      const count = importFavorites(json);
      expect(count).toBe(0);
    });
  });
});
