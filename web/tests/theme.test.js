import {
  getTheme,
  setTheme,
  getEffectiveTheme,
  applyTheme,
  cycleTheme,
  getThemeIcon,
  getThemeLabel,
  getThemeTooltip,
  initTheme
} from '../src/utils/theme.js';

describe('Theme utilities', () => {
  const localThis = {
    originalMatchMedia: null
  };

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    localThis.originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    window.matchMedia = localThis.originalMatchMedia;
  });

  describe('getTheme', () => {
    it('returns "auto" when no theme is stored', () => {
      expect(getTheme()).toBe('auto');
    });

    it('returns stored theme when valid', () => {
      localStorage.setItem('murphys_theme', 'dark');
      expect(getTheme()).toBe('dark');

      localStorage.setItem('murphys_theme', 'light');
      expect(getTheme()).toBe('light');

      localStorage.setItem('murphys_theme', 'auto');
      expect(getTheme()).toBe('auto');
    });

    it('returns "auto" for invalid stored values', () => {
      localStorage.setItem('murphys_theme', 'invalid');
      expect(getTheme()).toBe('auto');

      localStorage.setItem('murphys_theme', '');
      expect(getTheme()).toBe('auto');
    });
  });

  describe('setTheme', () => {
    it('stores valid theme in localStorage', () => {
      setTheme('dark');
      expect(localStorage.getItem('murphys_theme')).toBe('dark');

      setTheme('light');
      expect(localStorage.getItem('murphys_theme')).toBe('light');

      setTheme('auto');
      expect(localStorage.getItem('murphys_theme')).toBe('auto');
    });

    it('does not store invalid theme', () => {
      setTheme('invalid');
      expect(localStorage.getItem('murphys_theme')).toBeNull();
    });

    it('applies theme to DOM', () => {
      setTheme('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      setTheme('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('removes data-theme for auto mode', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      setTheme('auto');
      expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    });

    it('handles localStorage.setItem throwing gracefully', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Quota exceeded');
      });

      // Should not throw and should still apply theme to DOM
      expect(() => setTheme('dark')).not.toThrow();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      setItemSpy.mockRestore();
    });
  });

  describe('getEffectiveTheme', () => {
    it('returns the theme for non-auto values', () => {
      expect(getEffectiveTheme('light')).toBe('light');
      expect(getEffectiveTheme('dark')).toBe('dark');
    });

    it('returns "dark" when auto and system prefers dark', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }));

      expect(getEffectiveTheme('auto')).toBe('dark');
    });

    it('returns "light" when auto and system prefers light', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }));

      expect(getEffectiveTheme('auto')).toBe('light');
    });

    it('returns "light" when auto and matchMedia is undefined', () => {
      window.matchMedia = undefined;
      expect(getEffectiveTheme('auto')).toBe('light');
    });
  });

  describe('applyTheme', () => {
    it('sets data-theme attribute for dark', () => {
      applyTheme('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('sets data-theme attribute for light', () => {
      applyTheme('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('removes data-theme attribute for auto', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      applyTheme('auto');
      expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    });

    it('uses stored theme when no argument provided', () => {
      localStorage.setItem('murphys_theme', 'dark');
      applyTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('dispatches themechange event', () => {
      const handler = vi.fn();
      document.addEventListener('themechange', handler);

      applyTheme('dark');

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].detail.theme).toBe('dark');

      document.removeEventListener('themechange', handler);
    });

    it('includes correct effectiveTheme in themechange event for auto mode', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: true, // System prefers dark
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }));

      const handler = vi.fn();
      document.addEventListener('themechange', handler);

      applyTheme('auto');

      expect(handler.mock.calls[0][0].detail.theme).toBe('auto');
      expect(handler.mock.calls[0][0].detail.effectiveTheme).toBe('dark');

      document.removeEventListener('themechange', handler);
    });
  });

  describe('cycleTheme', () => {
    it('cycles from auto to light', () => {
      localStorage.setItem('murphys_theme', 'auto');
      const result = cycleTheme();
      expect(result).toBe('light');
      expect(getTheme()).toBe('light');
    });

    it('cycles from light to dark', () => {
      localStorage.setItem('murphys_theme', 'light');
      const result = cycleTheme();
      expect(result).toBe('dark');
      expect(getTheme()).toBe('dark');
    });

    it('cycles from dark to auto', () => {
      localStorage.setItem('murphys_theme', 'dark');
      const result = cycleTheme();
      expect(result).toBe('auto');
      expect(getTheme()).toBe('auto');
    });

    it('starts from auto when no theme set', () => {
      const result = cycleTheme();
      expect(result).toBe('light');
    });
  });

  describe('getThemeIcon', () => {
    it('returns "sun" for light theme', () => {
      expect(getThemeIcon('light')).toBe('sun');
    });

    it('returns "moon" for dark theme', () => {
      expect(getThemeIcon('dark')).toBe('moon');
    });

    it('returns "sunMoon" for auto theme', () => {
      expect(getThemeIcon('auto')).toBe('sunMoon');
    });

    it('uses stored theme when no argument', () => {
      localStorage.setItem('murphys_theme', 'dark');
      expect(getThemeIcon()).toBe('moon');
    });
  });

  describe('getThemeLabel', () => {
    it('returns correct label for light theme', () => {
      expect(getThemeLabel('light')).toBe('Theme: Light. Click for dark mode');
    });

    it('returns correct label for dark theme', () => {
      expect(getThemeLabel('dark')).toBe('Theme: Dark. Click for system preference');
    });

    it('returns correct label for auto theme', () => {
      expect(getThemeLabel('auto')).toBe('Theme: Auto. Click for light mode');
    });

    it('uses stored theme when no argument', () => {
      localStorage.setItem('murphys_theme', 'light');
      expect(getThemeLabel()).toBe('Theme: Light. Click for dark mode');
    });
  });

  describe('getThemeTooltip', () => {
    it('returns correct tooltip for light theme', () => {
      expect(getThemeTooltip('light')).toBe('Light mode');
    });

    it('returns correct tooltip for dark theme', () => {
      expect(getThemeTooltip('dark')).toBe('Dark mode');
    });

    it('returns correct tooltip for auto theme', () => {
      expect(getThemeTooltip('auto')).toBe('Auto mode');
    });

    it('uses stored theme when no argument', () => {
      localStorage.setItem('murphys_theme', 'dark');
      expect(getThemeTooltip()).toBe('Dark mode');
    });
  });

  describe('initTheme', () => {
    it('applies stored theme on init', () => {
      localStorage.setItem('murphys_theme', 'dark');
      initTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('sets up system preference listener', () => {
      const addEventListenerMock = vi.fn();
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        addEventListener: addEventListenerMock,
        removeEventListener: vi.fn()
      }));

      initTheme();
      expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('dispatches event when system preference changes to dark in auto mode', () => {
      let changeHandler;
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: true, // System prefers dark
        media: query,
        addEventListener: (event, handler) => { changeHandler = handler; },
        removeEventListener: vi.fn()
      }));

      localStorage.setItem('murphys_theme', 'auto');
      initTheme();

      const eventHandler = vi.fn();
      document.addEventListener('themechange', eventHandler);

      // Simulate system preference change
      changeHandler();

      expect(eventHandler).toHaveBeenCalled();
      expect(eventHandler.mock.calls[0][0].detail.effectiveTheme).toBe('dark');

      document.removeEventListener('themechange', eventHandler);
    });

    it('dispatches event when system preference changes to light in auto mode', () => {
      let changeHandler;
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false, // System prefers light
        media: query,
        addEventListener: (event, handler) => { changeHandler = handler; },
        removeEventListener: vi.fn()
      }));

      localStorage.setItem('murphys_theme', 'auto');
      initTheme();

      const eventHandler = vi.fn();
      document.addEventListener('themechange', eventHandler);

      // Simulate system preference change
      changeHandler();

      expect(eventHandler).toHaveBeenCalled();
      expect(eventHandler.mock.calls[0][0].detail.effectiveTheme).toBe('light');

      document.removeEventListener('themechange', eventHandler);
    });

    it('does not dispatch event when system preference changes but not in auto mode', () => {
      let changeHandler;
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: true,
        media: query,
        addEventListener: (event, handler) => { changeHandler = handler; },
        removeEventListener: vi.fn()
      }));

      localStorage.setItem('murphys_theme', 'dark');
      initTheme();

      const eventHandler = vi.fn();
      document.addEventListener('themechange', eventHandler);

      // Clear the handler calls from initTheme's applyTheme
      eventHandler.mockClear();

      // Simulate system preference change
      changeHandler();

      // Should not have been called again since we're in dark mode, not auto
      expect(eventHandler).not.toHaveBeenCalled();

      document.removeEventListener('themechange', eventHandler);
    });
  });

  describe('localStorage unavailable', () => {
    it('handles localStorage being unavailable gracefully', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      // Should not throw
      expect(() => getTheme()).not.toThrow();
      expect(getTheme()).toBe('auto');

      getItemSpy.mockRestore();
    });
  });

  describe('SSR environment (globals undefined)', () => {
    it('getTheme returns "auto" when localStorage is undefined', () => {
      const originalLocalStorage = global.localStorage;
      // @ts-ignore - intentionally setting to undefined for SSR test
      delete global.localStorage;

      expect(getTheme()).toBe('auto');

      global.localStorage = originalLocalStorage;
    });

    it('setTheme still applies theme when localStorage is undefined', () => {
      const originalLocalStorage = global.localStorage;
      // @ts-ignore - intentionally setting to undefined for SSR test
      delete global.localStorage;

      // Should not throw and should still apply theme
      expect(() => setTheme('dark')).not.toThrow();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      global.localStorage = originalLocalStorage;
    });

    it('applyTheme returns early when document is undefined', () => {
      const originalDocument = global.document;
      // @ts-ignore - intentionally setting to undefined for SSR test
      delete global.document;

      // Should not throw
      expect(() => applyTheme('dark')).not.toThrow();

      global.document = originalDocument;
    });
  });
});
