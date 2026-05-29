import { isSentryErrorIgnored, SENTRY_IGNORED_ERROR_PATTERNS } from '../src/utils/sentry-ignore-patterns.ts';

describe('sentry-ignore-patterns', () => {
  describe('isSentryErrorIgnored', () => {
    it('returns true for browser extension errors', () => {
      expect(isSentryErrorIgnored('chrome-extension://abc123 something failed')).toBe(true);
      expect(isSentryErrorIgnored('runtime.sendMessage error')).toBe(true);
      expect(isSentryErrorIgnored('moz-extension://xyz error')).toBe(true);
      expect(isSentryErrorIgnored('Object Not Found Matching Id')).toBe(true);
    });

    it('returns true for webkit messageHandlers probe errors', () => {
      expect(isSentryErrorIgnored("undefined is not an object (evaluating 'window.webkit.messageHandlers')")).toBe(true);
    });

    it('returns true for Android WebView JS-to-Java bridge teardown errors (e.g. Facebook in-app browser)', () => {
      expect(isSentryErrorIgnored('Error invoking enableDidUserTypeOnKeyboardLogging: Java object is gone')).toBe(true);
      expect(isSentryErrorIgnored('Error invoking someMethod: Java object is gone')).toBe(true);
    });

    it('returns true for Sentry SDK internal pageObserver error', () => {
      expect(isSentryErrorIgnored("feature named `pageObserver` was not found")).toBe(true);
      expect(isSentryErrorIgnored("feature named 'pageObserver' was not found")).toBe(true);
      expect(isSentryErrorIgnored('feature named pageObserver was not found')).toBe(true);
    });

    it('returns true for GA gtag unhandled rejection with undefined value', () => {
      expect(isSentryErrorIgnored('Non-Error promise rejection captured with value: undefined')).toBe(true);
    });

    it('returns true for cross-browser fetch transport rejections from disconnected clients', () => {
      // Chrome / Edge
      expect(isSentryErrorIgnored('Failed to fetch')).toBe(true);
      // Firefox
      expect(isSentryErrorIgnored('NetworkError when attempting to fetch resource.')).toBe(true);
      // Safari
      expect(isSentryErrorIgnored('Load failed')).toBe(true);
    });

    it('returns false for application errors', () => {
      expect(isSentryErrorIgnored('Cannot read property "x" of undefined')).toBe(false);
      // Generic-sounding strings that should NOT be swept up by the fetch-transport patterns
      expect(isSentryErrorIgnored('Failed to fetch laws from upstream cache')).toBe(false);
      expect(isSentryErrorIgnored('Network request failed')).toBe(false);
      expect(isSentryErrorIgnored('Service worker registration failed')).toBe(false);
      expect(isSentryErrorIgnored('Importing a module script failed')).toBe(false);
    });
  });

  describe('SENTRY_IGNORED_ERROR_PATTERNS', () => {
    it('has the expected number of patterns', () => {
      expect(SENTRY_IGNORED_ERROR_PATTERNS.length).toBe(12);
      expect(SENTRY_IGNORED_ERROR_PATTERNS.some((p) => p.test('chrome-extension://x'))).toBe(true);
    });
  });
});
