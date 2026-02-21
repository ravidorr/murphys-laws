import { isFeatureEnabled, setFeatureOverride, getFeatureState, isFavoritesEnabled } from '../src/utils/feature-flags.ts';

describe('Feature Flags', () => {
  const localThis: { originalEnv: string | undefined | null } = {
    originalEnv: null,
  };

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Store original env
    localThis.originalEnv = import.meta.env.VITE_FEATURE_FAVORITES;
  });

  afterEach(() => {
    localStorage.clear();
    // Restore original env (note: this may not work in all test environments)
    if (localThis.originalEnv !== undefined) {
      import.meta.env.VITE_FEATURE_FAVORITES = localThis.originalEnv;
    } else {
      // If it was originally undefined, delete it
      delete import.meta.env.VITE_FEATURE_FAVORITES;
    }
  });

  describe('isFeatureEnabled', () => {
    it('returns false for unknown feature', () => {
      expect(isFeatureEnabled('UNKNOWN_FEATURE')).toBe(false);
    });

    it('returns default value when no override exists', () => {
      // FAVORITES_ENABLED has default: true
      expect(isFeatureEnabled('FAVORITES_ENABLED')).toBe(true);
    });

    it('respects environment variable when set to true (covers L46 env branch)', () => {
      localStorage.clear();
      import.meta.env.VITE_FEATURE_FAVORITES = 'true';
      expect(isFeatureEnabled('FAVORITES_ENABLED')).toBe(true);
    });

    it('respects environment variable when set to false', () => {
      import.meta.env.VITE_FEATURE_FAVORITES = 'false';
      expect(isFeatureEnabled('FAVORITES_ENABLED')).toBe(false);
    });

    it('localStorage override takes priority over environment variable', () => {
      import.meta.env.VITE_FEATURE_FAVORITES = 'false';
      localStorage.setItem('murphys_ff_favorites', 'true');
      // localStorage should win
      expect(isFeatureEnabled('FAVORITES_ENABLED')).toBe(true);
    });

    it('respects localStorage override when set to true', () => {
      localStorage.setItem('murphys_ff_favorites', 'true');
      expect(isFeatureEnabled('FAVORITES_ENABLED')).toBe(true);
    });

    it('respects localStorage override when set to false', () => {
      localStorage.setItem('murphys_ff_favorites', 'false');
      expect(isFeatureEnabled('FAVORITES_ENABLED')).toBe(false);
    });

    it('handles corrupted localStorage gracefully', () => {
      // Simulate localStorage error by mocking getItem to throw
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should fall back to default
      expect(isFeatureEnabled('FAVORITES_ENABLED')).toBe(true);

      getItemSpy.mockRestore();
    });
  });

  describe('setFeatureOverride', () => {
    it('sets localStorage value to true', () => {
      setFeatureOverride('FAVORITES_ENABLED', true);
      expect(localStorage.getItem('murphys_ff_favorites')).toBe('true');
    });

    it('sets localStorage value to false', () => {
      setFeatureOverride('FAVORITES_ENABLED', false);
      expect(localStorage.getItem('murphys_ff_favorites')).toBe('false');
    });

    it('clears localStorage when null is passed', () => {
      localStorage.setItem('murphys_ff_favorites', 'false');
      setFeatureOverride('FAVORITES_ENABLED', null);
      expect(localStorage.getItem('murphys_ff_favorites')).toBeNull();
    });

    it('does nothing for unknown feature', () => {
      setFeatureOverride('UNKNOWN_FEATURE', true);
      // Should not throw and localStorage should be empty
      expect(localStorage.length).toBe(0);
    });

    it('handles localStorage errors gracefully', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw
      expect(() => setFeatureOverride('FAVORITES_ENABLED', true)).not.toThrow();

      setItemSpy.mockRestore();
    });
  });

  describe('getFeatureState', () => {
    it('returns unknown source for unknown feature', () => {
      const state = getFeatureState('UNKNOWN_FEATURE');
      expect(state).toEqual({ enabled: false, source: 'unknown' });
    });

    it('returns localStorage source when override exists', () => {
      localStorage.setItem('murphys_ff_favorites', 'true');
      const state = getFeatureState('FAVORITES_ENABLED');
      expect(state).toEqual({ enabled: true, source: 'localStorage' });
    });

    it('returns default source when no override', () => {
      const state = getFeatureState('FAVORITES_ENABLED');
      expect(state).toEqual({ enabled: true, source: 'default' });
    });

    it('returns environment source when env variable is set', () => {
      import.meta.env.VITE_FEATURE_FAVORITES = 'false';
      const state = getFeatureState('FAVORITES_ENABLED');
      expect(state).toEqual({ enabled: false, source: 'environment' });
    });

    it('returns environment source when env is set and localStorage has no override (covers L97 B1)', () => {
      localStorage.clear();
      import.meta.env.VITE_FEATURE_FAVORITES = 'true';
      const state = getFeatureState('FAVORITES_ENABLED');
      expect(state).toEqual({ enabled: true, source: 'environment' });
    });

    it('returns default when env key is undefined (L97 default branch)', () => {
      localStorage.clear();
      delete (import.meta.env as Record<string, unknown>).VITE_FEATURE_FAVORITES;
      const state = getFeatureState('FAVORITES_ENABLED');
      expect(state).toEqual({ enabled: true, source: 'default' });
    });

    it('localStorage takes priority over environment in getFeatureState', () => {
      import.meta.env.VITE_FEATURE_FAVORITES = 'false';
      localStorage.setItem('murphys_ff_favorites', 'true');
      const state = getFeatureState('FAVORITES_ENABLED');
      expect(state).toEqual({ enabled: true, source: 'localStorage' });
    });

    it('handles localStorage error gracefully and falls back to default', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      const state = getFeatureState('FAVORITES_ENABLED');
      // Should fall back to default since localStorage throws
      expect(state).toEqual({ enabled: true, source: 'default' });

      getItemSpy.mockRestore();
    });

    it('returns localStorage source with false value', () => {
      localStorage.setItem('murphys_ff_favorites', 'false');
      const state = getFeatureState('FAVORITES_ENABLED');
      expect(state).toEqual({ enabled: false, source: 'localStorage' });
    });
  });

  describe('isFavoritesEnabled', () => {
    it('is a convenience function that checks FAVORITES_ENABLED', () => {
      expect(isFavoritesEnabled()).toBe(true);

      localStorage.setItem('murphys_ff_favorites', 'false');
      expect(isFavoritesEnabled()).toBe(false);

      localStorage.setItem('murphys_ff_favorites', 'true');
      expect(isFavoritesEnabled()).toBe(true);
    });
  });

  describe('localStorage override priority', () => {
    it('localStorage override takes precedence over default', () => {
      // Default is true
      expect(isFeatureEnabled('FAVORITES_ENABLED')).toBe(true);

      // Override to false
      localStorage.setItem('murphys_ff_favorites', 'false');
      expect(isFeatureEnabled('FAVORITES_ENABLED')).toBe(false);

      // Override to true
      localStorage.setItem('murphys_ff_favorites', 'true');
      expect(isFeatureEnabled('FAVORITES_ENABLED')).toBe(true);
    });
  });
});
